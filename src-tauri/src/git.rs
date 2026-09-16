use std::path::Path;

use git2::{Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HistoryRelation {
    Same,
    FastForward,
    Ahead,
    Diverged,
    NoRemote,
}

#[derive(Debug, thiserror::Error)]
pub enum GitError {
    #[error("{0}")]
    Message(String),
}

impl From<git2::Error> for GitError {
    fn from(e: git2::Error) -> Self {
        GitError::Message(e.message().to_string())
    }
}

/// 创建带认证回调的 FetchOptions
fn auth_fetch_opts(token: &str) -> FetchOptions<'static> {
    let token = token.to_owned();
    let mut cbs = RemoteCallbacks::new();
    cbs.credentials(move |_url, _username_from_url, _allowed_types| {
        Cred::userpass_plaintext("oauth2", &token)
    });
    let mut opts = FetchOptions::new();
    opts.remote_callbacks(cbs);
    opts
}

/// 创建带认证回调的 PushOptions
fn auth_push_opts(token: &str) -> PushOptions<'static> {
    let token = token.to_owned();
    let mut cbs = RemoteCallbacks::new();
    cbs.credentials(move |_url, _username_from_url, _allowed_types| {
        Cred::userpass_plaintext("oauth2", &token)
    });
    let mut opts = PushOptions::new();
    opts.remote_callbacks(cbs);
    opts
}

/// 初始化或打开仓库，确保有基本配置
pub fn ensure_repo(repo: &Path) -> Result<(), GitError> {
    if repo.join(".git").exists() {
        // 已存在，确保配置
        let r = Repository::open(repo)?;
        let mut cfg = r.config()?;
        if cfg.get_entry("user.name").is_err() {
            cfg.set_str("user.name", "unote")?;
        }
        if cfg.get_entry("user.email").is_err() {
            cfg.set_str("user.email", "unote@local")?;
        }
        return Ok(());
    }
    std::fs::create_dir_all(repo).map_err(|e| GitError::Message(e.to_string()))?;
    let r = Repository::init(repo)?;
    let mut cfg = r.config()?;
    cfg.set_str("user.name", "unote")?;
    cfg.set_str("user.email", "unote@local")?;
    Ok(())
}

/// 获取当前分支名
pub fn current_branch(repo: &Path) -> Result<Option<String>, GitError> {
    let r = Repository::open(repo)?;
    let head = match r.head() {
        Ok(h) => h,
        Err(_) => return Ok(None),
    };
    if head.is_branch() {
        Ok(head.shorthand().map(|s| s.to_string()))
    } else {
        Ok(None)
    }
}

/// 检查是否已配置 origin remote
pub fn has_origin(repo: &Path) -> bool {
    let Ok(r) = Repository::open(repo) else {
        return false;
    };
    let found = r.find_remote("origin").is_ok();
    found
}

/// 设置 origin remote URL
pub fn set_origin(repo: &Path, url: &str) -> Result<(), GitError> {
    let r = Repository::open(repo)?;
    if r.find_remote("origin").is_ok() {
        r.remote_set_url("origin", url)?;
    } else {
        r.remote("origin", url)?;
    }
    Ok(())
}

/// 如有变更则提交，返回是否有新提交
pub fn commit_if_changed(repo: &Path, message: &str) -> Result<bool, GitError> {
    ensure_repo(repo)?;
    let r = Repository::open(repo)?;

    // 空仓库（无 HEAD）直接允许提交
    let parent_commit = match r.head() {
        Ok(head) => head.peel_to_commit().ok(),
        Err(_) => None,
    };

    // 暂存所有变更
    let mut index = r.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;

    let new_tree_id = index.write_tree()?;
    let new_tree = r.find_tree(new_tree_id)?;

    // 与当前 tree 比较
    if let Some(ref parent) = parent_commit {
        if let Ok(current_tree) = parent.tree() {
            if current_tree.id() == new_tree_id {
                return Ok(false);
            }
        }
    }

    let sig = r
        .signature()
        .or_else(|_| git2::Signature::now("unote", "unote@local"))?;

    let parents: Vec<&git2::Commit> = match &parent_commit {
        Some(c) => vec![c],
        None => vec![],
    };

    r.commit(Some("HEAD"), &sig, &sig, message, &new_tree, &parents)?;
    Ok(true)
}

/// 获取远端更新
pub fn fetch(repo: &Path, token: &str) -> Result<(), GitError> {
    if !has_origin(repo) {
        return Ok(());
    }
    let r = Repository::open(repo)?;
    let mut remote = r.find_remote("origin")?;
    let mut opts = auth_fetch_opts(token);
    remote.fetch(&[] as &[&str], Some(&mut opts), None)?;
    Ok(())
}

/// 推断优先使用的远端分支名
pub fn preferred_remote_branch(repo: &Path) -> Option<String> {
    let Ok(r) = Repository::open(repo) else {
        return None;
    };
    if r.find_reference("refs/remotes/origin/main").is_ok() {
        return Some("main".into());
    }
    if r.find_reference("refs/remotes/origin/master").is_ok() {
        return Some("master".into());
    }
    None
}

/// 分析本地 HEAD 与远端的关系
pub fn analyze_history(repo: &Path) -> Result<HistoryRelation, GitError> {
    if !has_origin(repo) {
        return Ok(HistoryRelation::NoRemote);
    }
    let r = Repository::open(repo)?;
    let local_oid = match r.head() {
        Ok(head) => head
            .target()
            .ok_or_else(|| GitError::Message("HEAD 无目标".into()))?,
        Err(_) => return Ok(HistoryRelation::NoRemote),
    };
    let branch = current_branch(repo)?.or_else(|| preferred_remote_branch(repo));
    let Some(branch) = branch else {
        return Ok(HistoryRelation::Ahead);
    };
    let remote_ref_name = format!("refs/remotes/origin/{branch}");
    let remote_oid = match r.find_reference(&remote_ref_name) {
        Ok(reference) => reference
            .target()
            .ok_or_else(|| GitError::Message("远端引用无目标".into()))?,
        Err(_) => return Ok(HistoryRelation::Ahead),
    };
    if local_oid == remote_oid {
        return Ok(HistoryRelation::Same);
    }
    let base_oid = r.merge_base(local_oid, remote_oid)?;
    if base_oid == local_oid {
        Ok(HistoryRelation::FastForward)
    } else if base_oid == remote_oid {
        Ok(HistoryRelation::Ahead)
    } else {
        Ok(HistoryRelation::Diverged)
    }
}

/// 快进合并到远端
pub fn fast_forward(repo: &Path, branch: &str) -> Result<(), GitError> {
    let r = Repository::open(repo)?;
    let remote_ref_name = format!("refs/remotes/origin/{branch}");
    let remote_ref = r.find_reference(&remote_ref_name)?;
    let remote_oid = remote_ref
        .target()
        .ok_or_else(|| GitError::Message("远端引用无目标".into()))?;
    let remote_commit = r.find_commit(remote_oid)?;
    // 更新本地分支引用
    let local_ref_name = format!("refs/heads/{branch}");
    r.reference(
        &local_ref_name,
        remote_oid,
        true,
        &format!("fast-forward to origin/{branch}"),
    )?;
    // 更新 HEAD 指向的工作目录
    r.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))?;
    let _ = remote_commit;
    Ok(())
}

/// 推送当前分支到 origin
pub fn push_current(repo: &Path, token: &str) -> Result<(), GitError> {
    if !has_origin(repo) {
        return Ok(());
    }
    let r = Repository::open(repo)?;
    let mut remote = r.find_remote("origin")?;
    let mut opts = auth_push_opts(token);
    let branch = current_branch(repo)?;
    let refspec = match branch {
        Some(b) => format!("refs/heads/{b}:refs/heads/{b}"),
        None => "HEAD".to_string(),
    };
    remote.push(&[refspec.as_str()], Some(&mut opts))?;
    Ok(())
}

/// 克隆远程仓库到本地
pub fn clone_repo(url: &str, dest: &Path, token: &str) -> Result<(), GitError> {
    if dest.exists() && dest.join(".git").exists() {
        return Ok(());
    }
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| GitError::Message(e.to_string()))?;
    }
    let mut builder = git2::build::RepoBuilder::new();
    let fetch_opts = auth_fetch_opts(token);
    builder.fetch_options(fetch_opts);
    builder.clone(url, dest)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn commit_skips_empty_and_creates_when_changed() {
        let dir = tempdir().unwrap();
        let repo = dir.path();
        ensure_repo(repo).unwrap();
        std::fs::write(repo.join("readme.md"), "# unote\n").unwrap();
        assert!(commit_if_changed(repo, "unote: 同步文档").unwrap());

        // 验证有1个 commit
        let r = Repository::open(repo).unwrap();
        let head = r.head().unwrap();
        let commit = r.find_commit(head.target().unwrap()).unwrap();
        assert_eq!(commit.summary(), Some("unote: 同步文档"));
        assert_eq!(commit.author().name(), Some("unote"));
        assert_eq!(commit.author().email(), Some("unote@local"));

        // 无变更时跳过
        assert!(!commit_if_changed(repo, "unote: 同步文档").unwrap());

        // 再次变更后新建 commit
        std::fs::write(repo.join("readme.md"), "# unote\n\nupdated\n").unwrap();
        assert!(commit_if_changed(repo, "unote: 同步文档").unwrap());

        let head2 = r.head().unwrap();
        let commit2 = r.find_commit(head2.target().unwrap()).unwrap();
        assert_eq!(commit2.summary(), Some("unote: 同步文档"));
        assert_eq!(commit2.author().name(), Some("unote"));
        assert_eq!(commit2.author().email(), Some("unote@local"));
    }

    #[test]
    fn no_remote_is_not_diverged() {
        let dir = tempdir().unwrap();
        let repo = dir.path();
        ensure_repo(repo).unwrap();
        std::fs::write(repo.join("a.txt"), "a").unwrap();
        commit_if_changed(repo, "unote: 同步文档").unwrap();
        assert_eq!(analyze_history(repo).unwrap(), HistoryRelation::NoRemote);
    }

    #[test]
    fn ensure_repo_sets_config() {
        let dir = tempdir().unwrap();
        let repo = dir.path();
        ensure_repo(repo).unwrap();
        let r = Repository::open(repo).unwrap();
        let cfg = r.config().unwrap();
        assert_eq!(cfg.get_entry("user.name").unwrap().value(), Some("unote"));
        assert_eq!(
            cfg.get_entry("user.email").unwrap().value(),
            Some("unote@local")
        );
    }

    #[test]
    fn current_branch_after_init() {
        let dir = tempdir().unwrap();
        let repo = dir.path();
        ensure_repo(repo).unwrap();
        // 刚 init 无 commit 时 HEAD 不指向有效分支
        assert!(current_branch(repo).unwrap().is_none());
        // 创建一个 commit 后应返回分支名
        std::fs::write(repo.join("b.txt"), "b").unwrap();
        commit_if_changed(repo, "unote: 初始化").unwrap();
        let branch = current_branch(repo).unwrap();
        assert!(branch.is_some());
    }
}
