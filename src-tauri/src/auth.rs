use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::mpsc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rand::RngCore;
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "org.unote.dev";
const KEYRING_USER: &str = "gitee-session";

pub const OAUTH_CALLBACK: &str = "http://127.0.0.1:17331/callback";
pub const OAUTH_SCOPE: &str = "user_info projects";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub host: String,
    pub login: String,
    pub name: String,
    pub avatar_url: String,
    pub repo: String,
    pub public: bool,
    pub token: Token,
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSession {
    pub host: String,
    pub login: String,
    pub name: String,
    pub avatar_url: String,
    pub repo: String,
    pub public: bool,
}

impl Session {
    pub fn public(&self) -> PublicSession {
        PublicSession {
            host: self.host.clone(),
            login: self.login.clone(),
            name: self.name.clone(),
            avatar_url: self.avatar_url.clone(),
            repo: self.repo.clone(),
            public: self.public,
        }
    }

    pub fn git_https_url(&self) -> String {
        format!("https://gitee.com/{}/{}.git", self.login, self.repo)
    }

    pub fn token_needs_refresh(&self) -> bool {
        let now = now_secs();
        self.token.expires_at > 0 && now + 120 >= self.token.expires_at
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("{0}")]
    Message(String),
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: i64,
}

#[derive(Deserialize)]
pub(crate) struct GiteeUser {
    login: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    avatar_url: Option<String>,
}

pub fn oauth_credentials() -> Result<(String, String), AuthError> {
    let id = crate::constants::GITEE_CLIENT_ID;
    let secret = crate::constants::GITEE_CLIENT_SECRET;
    if id.is_empty() || secret.is_empty() {
        return Err(AuthError::Message(
            "未配置 Gitee OAuth 凭据".into(),
        ));
    }
    Ok((id.to_string(), secret.to_string()))
}

pub fn random_state() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn authorize_url(client_id: &str, state: &str) -> String {
    format!(
        "https://gitee.com/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}",
        urlencoding::encode(client_id),
        urlencoding::encode(OAUTH_CALLBACK),
        urlencoding::encode(OAUTH_SCOPE),
        urlencoding::encode(state)
    )
}

pub fn wait_for_callback(expected_state: &str) -> Result<String, AuthError> {
    let listener = TcpListener::bind("127.0.0.1:17331")
        .map_err(|e| AuthError::Message(format!("无法监听 OAuth 回调端口：{e}")))?;
    listener
        .set_nonblocking(false)
        .map_err(|e| AuthError::Message(e.to_string()))?;

    let (mut stream, _) = listener
        .accept()
        .map_err(|_| AuthError::Message("等待 Gitee 授权超时".into()))?;
    let _ = stream.set_read_timeout(Some(Duration::from_secs(30)));
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).unwrap_or(0);
    let req = String::from_utf8_lossy(&buf[..n]);
    let first = req.lines().next().unwrap_or("");
    let query = first
        .split_whitespace()
        .nth(1)
        .and_then(|p| p.split('?').nth(1))
        .unwrap_or("");
    let mut code = None;
    let mut state = None;
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let k = parts.next().unwrap_or("");
        let v = parts.next().unwrap_or("");
        match k {
            "code" => code = Some(urlencoding::decode(v).unwrap_or_default().into_owned()),
            "state" => state = Some(urlencoding::decode(v).unwrap_or_default().into_owned()),
            _ => {}
        }
    }
    let body = if state.as_deref() == Some(expected_state) && code.is_some() {
        "<html><body>授权完成，可以关闭此窗口返回 unote。</body></html>"
    } else {
        "<html><body>授权失败：state 不匹配。</body></html>"
    };
    let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(resp.as_bytes());
    if state.as_deref() != Some(expected_state) {
        return Err(AuthError::Message("OAuth state 校验失败".into()));
    }
    code.ok_or_else(|| AuthError::Message("授权回调缺少 code".into()))
}

pub fn exchange_token(
    client_id: &str,
    client_secret: &str,
    code: &str,
) -> Result<Token, AuthError> {
    let form = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("redirect_uri", OAUTH_CALLBACK),
    ];
    let resp: TokenResponse = reqwest::blocking::Client::new()
        .post("https://gitee.com/oauth/token")
        .form(&form)
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|_| AuthError::Message("换取 token 失败".into()))?
        .json()
        .map_err(|_| AuthError::Message("无法解析 token 响应".into()))?;
    Ok(token_from_response(resp))
}

pub fn refresh_token(session: &mut Session) -> Result<(), AuthError> {
    let Some(refresh) = session.token.refresh_token.clone() else {
        return Ok(());
    };
    let form = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh.as_str()),
    ];
    let resp: TokenResponse = reqwest::blocking::Client::new()
        .post("https://gitee.com/oauth/token")
        .form(&form)
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|_| AuthError::Message("刷新 token 失败".into()))?
        .json()
        .map_err(|_| AuthError::Message("无法解析 token 响应".into()))?;
    session.token = token_from_response(resp);
    Ok(())
}

fn token_from_response(resp: TokenResponse) -> Token {
    Token {
        access_token: resp.access_token,
        refresh_token: resp.refresh_token,
        expires_at: now_secs() + if resp.expires_in > 0 { resp.expires_in } else { 86400 },
    }
}

pub fn fetch_user(access_token: &str) -> Result<GiteeUser, AuthError> {
    reqwest::blocking::Client::new()
        .get("https://gitee.com/api/v5/user")
        .query(&[("access_token", access_token)])
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|_| AuthError::Message("获取用户信息失败".into()))?
        .json()
        .map_err(|_| AuthError::Message("无法解析用户信息".into()))
}

pub fn ensure_remote_repo(session: &Session) -> Result<(), AuthError> {
    let encoded_owner = urlencoding::encode(&session.login);
    let encoded_repo = urlencoding::encode(&session.repo);
    let get_url = format!("https://gitee.com/api/v5/repos/{encoded_owner}/{encoded_repo}");
    let client = reqwest::blocking::Client::new();
    let exists = client
        .get(&get_url)
        .query(&[("access_token", &session.token.access_token)])
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .is_ok();
    if exists {
        return Ok(());
    }
    let private = !session.public;
    #[derive(Serialize)]
    struct CreateRepo {
        access_token: String,
        name: String,
        private: bool,
    }
    client
        .post("https://gitee.com/api/v5/user/repos")
        .json(&CreateRepo {
            access_token: session.token.access_token.clone(),
            name: session.repo.clone(),
            private,
        })
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|_| AuthError::Message("创建 Gitee 仓库失败".into()))?;
    Ok(())
}

fn session_entry() -> Result<keyring::Entry, AuthError> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| AuthError::Message(format!("无法访问系统凭据库：{e}")))
}

pub fn load_session() -> Result<Option<Session>, AuthError> {
    let entry = match session_entry() {
        Ok(entry) => entry,
        #[cfg(target_os = "linux")]
        Err(_) => return Ok(None),
        #[cfg(not(target_os = "linux"))]
        Err(error) => return Err(error),
    };
    let text = match entry.get_password() {
        Ok(text) => text,
        Err(keyring::Error::NoEntry) => return Ok(None),
        #[cfg(target_os = "linux")]
        Err(_) => return Ok(None),
        #[cfg(not(target_os = "linux"))]
        Err(e) => return Err(AuthError::Message(format!("读取登录凭据失败：{e}"))),
    };
    let session = serde_json::from_str(&text)
        .map_err(|e| AuthError::Message(format!("登录凭据无效：{e}")))?;
    Ok(Some(session))
}

pub fn save_session(session: &Session) -> Result<(), AuthError> {
    let json = serde_json::to_string_pretty(session).map_err(|e| AuthError::Message(e.to_string()))?;
    let result = session_entry().and_then(|entry| {
        entry
            .set_password(&json)
            .map_err(|e| AuthError::Message(format!("保存登录凭据失败：{e}")))
    });
    #[cfg(target_os = "linux")]
    return result.or(Ok(()));
    #[cfg(not(target_os = "linux"))]
    result
}

pub fn delete_session() -> Result<(), AuthError> {
    let entry = match session_entry() {
        Ok(entry) => entry,
        #[cfg(target_os = "linux")]
        Err(_) => return Ok(()),
        #[cfg(not(target_os = "linux"))]
        Err(error) => return Err(error),
    };
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        #[cfg(target_os = "linux")]
        Err(_) => Ok(()),
        #[cfg(not(target_os = "linux"))]
        Err(e) => Err(AuthError::Message(format!("删除登录凭据失败：{e}"))),
    }
}

pub fn complete_login(
    open_url: impl FnOnce(&str) -> Result<(), AuthError>,
) -> Result<Session, AuthError> {
    let (client_id, client_secret) = oauth_credentials()?;
    let state = random_state();
    let url = authorize_url(&client_id, &state);
    open_url(&url)?;
    let (tx, rx) = mpsc::channel();
    let expected = state.clone();
    std::thread::spawn(move || {
        let _ = tx.send(wait_for_callback(&expected));
    });
    let code = rx
        .recv_timeout(Duration::from_secs(180))
        .map_err(|_| AuthError::Message("等待 Gitee 授权超时".into()))??;
    let token = exchange_token(&client_id, &client_secret, &code)?;
    let user = fetch_user(&token.access_token)?;
    let login = user.login;
    Ok(Session {
        host: "gitee".into(),
        repo: format!("{login}.gitee.unote"),
        name: user.name.unwrap_or_else(|| login.clone()),
        avatar_url: user.avatar_url.unwrap_or_default(),
        login,
        public: false,
        token,
        client_id,
        client_secret,
    })
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorize_url_includes_state_and_callback() {
        let url = authorize_url("abc", "secret-state");
        assert!(url.contains("client_id=abc"));
        assert!(url.contains("state=secret-state"));
        assert!(url.contains("127.0.0.1"));
        assert!(!url.contains("access_token"));
    }

}
