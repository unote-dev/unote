use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use pulldown_cmark::{html, Event, Options, Parser};
use rand::RngCore;
use serde::Serialize;
use sha2::{Digest, Sha256};

const CLOUDFLARED_GITHUB_URL: &str =
    "https://github.com/cloudflare/cloudflared/releases/download/2026.9.1/cloudflared-windows-amd64.exe";
const CLOUDFLARED_SHA256: &str = "2837888cc0f5d58f15b6dc478376de90b4d3ba5241c7947455d1e0a0df429712";
const MAX_ASSET_BYTES: u64 = 10 * 1024 * 1024;
const MAX_SHARES: usize = 8;

fn cloudflared_download_urls() -> [String; 2] {
    [
        format!("https://gh-proxy.com/{CLOUDFLARED_GITHUB_URL}"),
        CLOUDFLARED_GITHUB_URL.to_string(),
    ]
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub url: String,
}

pub struct ShareState {
    active: Mutex<HashMap<String, ActiveShare>>,
}

struct ActiveShare {
    child: Child,
    info: ShareInfo,
    stopped: Arc<AtomicBool>,
}

impl ShareState {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(HashMap::new()),
        }
    }

    pub fn list(&self) -> Vec<ShareInfo> {
        let mut active = self.active.lock().unwrap();
        prune_dead(&mut active);
        let mut items: Vec<_> = active.values().map(|share| share.info.clone()).collect();
        items.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
        items
    }

    pub fn stop_one(&self, id: &str) -> Result<(), String> {
        let mut active = self.active.lock().unwrap();
        prune_dead(&mut active);
        let Some(mut share) = active.remove(id) else {
            return Err("分享不存在或已停止".into());
        };
        share.stopped.store(true, Ordering::Relaxed);
        let _ = share.child.kill();
        let _ = share.child.wait();
        Ok(())
    }

    pub fn stop_all(&self) {
        let mut active = self.active.lock().unwrap();
        for (_, mut share) in active.drain() {
            share.stopped.store(true, Ordering::Relaxed);
            let _ = share.child.kill();
            let _ = share.child.wait();
        }
    }
}

fn prune_dead(active: &mut HashMap<String, ActiveShare>) {
    active.retain(|_, share| match share.child.try_wait() {
        Ok(None) => true,
        _ => {
            share.stopped.store(true, Ordering::Relaxed);
            false
        }
    });
}

impl Drop for ShareState {
    fn drop(&mut self) {
        self.stop_all();
    }
}

pub fn start(
    state: &ShareState,
    repository_root: &Path,
    app_data: &Path,
    document_path: &str,
) -> Result<ShareInfo, String> {
    let relative = Path::new(document_path);
    if relative.extension().and_then(|value| value.to_str()) != Some("md") {
        return Err("目前仅支持分享 Markdown 文档".into());
    }
    {
        let mut active = state.active.lock().unwrap();
        prune_dead(&mut active);
        if active.len() >= MAX_SHARES {
            return Err("同时最多 8 条临时分享，请先在「分享」里停止一条".into());
        }
    }
    let markdown = crate::content::read(repository_root, document_path)?;
    let markdown = embed_local_assets(repository_root, relative, &markdown)?;
    let name = relative
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("UNote 分享")
        .to_string();
    let document = render_document(&name, &markdown);
    let encrypted = encrypt(document.as_bytes())?;
    let token = random_url_token(24);
    let stopped = Arc::new(AtomicBool::new(false));
    let port = start_local_server(token.clone(), encrypted.payload, stopped.clone())?;

    let tunnel = (|| {
        let executable = ensure_cloudflared(app_data)?;
        start_tunnel(&executable, port)
    })();
    let (child, public_origin) = match tunnel {
        Ok(tunnel) => tunnel,
        Err(error) => {
            stopped.store(true, Ordering::Relaxed);
            return Err(error);
        }
    };
    let url = public_share_url(&public_origin, &token, &encrypted.key);
    let info = ShareInfo {
        id: token.clone(),
        name,
        path: document_path.to_string(),
        url,
    };
    {
        let mut active = state.active.lock().unwrap();
        prune_dead(&mut active);
        if active.len() >= MAX_SHARES {
            stopped.store(true, Ordering::Relaxed);
            let mut child = child;
            let _ = child.kill();
            let _ = child.wait();
            return Err("同时最多 8 条临时分享，请先在「分享」里停止一条".into());
        }
        active.insert(
            token,
            ActiveShare {
                child,
                info: info.clone(),
                stopped,
            },
        );
    }
    Ok(info)
}

fn public_share_url(origin: &str, token: &str, key: &str) -> String {
    format!("{origin}/s/{token}#{key}")
}

struct EncryptedDocument {
    key: String,
    payload: String,
}

fn encrypt(document: &[u8]) -> Result<EncryptedDocument, String> {
    let mut key = [0_u8; 32];
    let mut nonce = [0_u8; 12];
    rand::thread_rng().fill_bytes(&mut key);
    rand::thread_rng().fill_bytes(&mut nonce);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|error| error.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), document)
        .map_err(|_| "无法加密分享快照".to_string())?;
    let payload = serde_json::json!({
        "ciphertext": STANDARD.encode(ciphertext),
        "iv": STANDARD.encode(nonce),
    })
    .to_string();
    Ok(EncryptedDocument {
        key: URL_SAFE_NO_PAD.encode(key),
        payload,
    })
}

fn random_url_token(bytes: usize) -> String {
    let mut value = vec![0_u8; bytes];
    rand::thread_rng().fill_bytes(&mut value);
    URL_SAFE_NO_PAD.encode(value)
}

fn render_document(title: &str, markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    let parser = Parser::new_ext(markdown, options).map(|event| match event {
        Event::Html(value) | Event::InlineHtml(value) => Event::Text(value),
        event => event,
    });
    let mut body = String::new();
    html::push_html(&mut body, parser);
    format!(
        r#"<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{}</title><style>{}</style></head><body><main><article>{}</article><footer>由 UNote 临时分享 · 分享者停止分享后链接即失效</footer></main></body></html>"#,
        escape_html(title),
        SHARE_CSS,
        body
    )
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn embed_local_assets(root: &Path, document: &Path, markdown: &str) -> Result<String, String> {
    let assets = root.join(".assets");
    if !assets.is_dir() {
        return Ok(markdown.to_string());
    }
    if fs::symlink_metadata(&assets)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err("资源目录不能是符号链接".into());
    }
    let depth = document
        .parent()
        .map(|parent| parent.components().count())
        .unwrap_or(0);
    let prefix = "../".repeat(depth);
    let mut result = markdown.to_string();
    for entry in fs::read_dir(&assets).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        if !metadata.is_file() || metadata.len() > MAX_ASSET_BYTES {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        let mime = asset_mime(&entry.path());
        let data = fs::read(entry.path()).map_err(|error| error.to_string())?;
        let data_url = format!("data:{mime};base64,{}", STANDARD.encode(data));
        result = result.replace(&format!("{prefix}.assets/{name}"), &data_url);
        if depth == 0 {
            result = result.replace(&format!(".assets/{name}"), &data_url);
        }
    }
    Ok(result)
}

fn asset_mime(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "gif" => "image/gif",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        _ => "image/png",
    }
}

fn start_local_server(
    token: String,
    payload: String,
    stopped: Arc<AtomicBool>,
) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    let connections = Arc::new(AtomicUsize::new(0));
    thread::spawn(move || {
        while !stopped.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((stream, _)) if connections.load(Ordering::Relaxed) < 32 => {
                    let token = token.clone();
                    let payload = payload.clone();
                    let connections = connections.clone();
                    connections.fetch_add(1, Ordering::Relaxed);
                    thread::spawn(move || {
                        handle_request(stream, &token, &payload);
                        connections.fetch_sub(1, Ordering::Relaxed);
                    });
                }
                Ok((_stream, _)) => {}
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(20));
                }
                Err(_) => break,
            }
        }
    });
    Ok(port)
}

fn handle_request(mut stream: TcpStream, token: &str, payload: &str) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(3)));
    let mut request = [0_u8; 8192];
    let Ok(length) = stream.read(&mut request) else {
        return;
    };
    let request = String::from_utf8_lossy(&request[..length]);
    let mut request_line = request
        .lines()
        .next()
        .unwrap_or_default()
        .split_whitespace();
    let method = request_line.next();
    let target = request_line.next().map(share_request_path);
    let document_path = format!("/s/{token}");
    let payload_path = format!("{document_path}/payload");
    let nonce = random_url_token(16);
    let (status, content_type, body) = match (method, target.as_deref()) {
        (Some("GET"), Some("/")) => ("200 OK", "text/plain; charset=utf-8", "ok".into()),
        (Some("GET"), Some(path)) if path == document_path => {
            ("200 OK", "text/html; charset=utf-8", viewer_shell(&nonce))
        }
        (Some("GET"), Some(path)) if path == payload_path => {
            ("200 OK", "application/json", payload.to_string())
        }
        _ => (
            "404 Not Found",
            "text/plain; charset=utf-8",
            "分享不存在或已失效".to_string(),
        ),
    };
    let headers = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nX-Robots-Tag: noindex, nofollow\r\nContent-Security-Policy: default-src 'none'; script-src 'nonce-{nonce}'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(headers.as_bytes());
    let _ = stream.write_all(body.as_bytes());
}

fn share_request_path(target: &str) -> String {
    let path = if let Some(scheme) = target.find("://") {
        let after_host = &target[scheme + 3..];
        after_host
            .find('/')
            .map(|index| &after_host[index..])
            .unwrap_or("/")
    } else {
        target
    };
    let path = path.split(['?', '#']).next().unwrap_or("/");
    if path.len() > 1 {
        path.trim_end_matches('/').to_string()
    } else {
        path.to_string()
    }
}

fn viewer_shell(nonce: &str) -> String {
    format!(
        r#"<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UNote 临时分享</title><style>body{{font-family:system-ui,sans-serif;display:grid;min-height:100vh;place-items:center;margin:0;color:#18181b}}p{{color:#71717a}}</style></head><body><div><strong>正在解密笔记…</strong><p id="status">请稍候</p></div><script nonce="{nonce}">(async()=>{{const s=document.querySelector('#status');try{{const raw=location.hash.slice(1).replace(/-/g,'+').replace(/_/g,'/');const keyBytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));if(keyBytes.length!==32)throw new Error('分享链接缺少有效的解密密钥，请从 UNote 复制完整链接（含 # 后面的部分）');const base=location.pathname.replace(/\/$/,'');const payload=await fetch(base+'/payload',{{cache:'no-store'}}).then(r=>{{if(!r.ok)throw new Error('分享不存在或已失效');return r.json()}});const decode=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey('raw',keyBytes,'AES-GCM',false,['decrypt']);const clear=await crypto.subtle.decrypt({{name:'AES-GCM',iv:decode(payload.iv)}},key,decode(payload.ciphertext));document.open();document.write(new TextDecoder().decode(clear));document.close()}}catch(e){{s.textContent=e instanceof Error?e.message:String(e)}}}})()</script></body></html>"#
    )
}

fn ensure_cloudflared(app_data: &Path) -> Result<PathBuf, String> {
    let tools = app_data.join("tools");
    fs::create_dir_all(&tools).map_err(|error| error.to_string())?;
    let executable = tools.join("cloudflared.exe");
    if executable.is_file() {
        if file_sha256(&executable)? == CLOUDFLARED_SHA256 {
            return Ok(executable);
        }
        fs::remove_file(&executable).map_err(|error| error.to_string())?;
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(120))
        .user_agent("UNote/0.1")
        .build()
        .map_err(|error| error.to_string())?;
    let mut last_error = "未知错误".to_string();
    let mut bytes = None;
    for url in cloudflared_download_urls() {
        match client
            .get(&url)
            .send()
            .and_then(reqwest::blocking::Response::error_for_status)
            .and_then(|response| response.bytes())
        {
            Ok(payload) => {
                let digest = format!("{:x}", Sha256::digest(&payload));
                if digest == CLOUDFLARED_SHA256 {
                    bytes = Some(payload);
                    break;
                }
                last_error = "cloudflared 下载文件校验失败，已拒绝运行".into();
            }
            Err(error) => last_error = error.to_string(),
        }
    }
    let bytes = bytes.ok_or_else(|| format!("下载 cloudflared 失败：{last_error}"))?;
    let temporary = tools.join("cloudflared.download");
    fs::write(&temporary, bytes).map_err(|error| error.to_string())?;
    fs::rename(&temporary, &executable).map_err(|error| error.to_string())?;
    Ok(executable)
}

fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut digest = Sha256::new();
    std::io::copy(&mut file, &mut digest).map_err(|error| error.to_string())?;
    Ok(format!("{:x}", digest.finalize()))
}

enum TunnelEvent {
    Url(String),
    Ready,
}

fn start_tunnel(executable: &Path, port: u16) -> Result<(Child, String), String> {
    let mut command = Command::new(executable);
    command
        .args([
            "tunnel",
            "--no-autoupdate",
            "--protocol",
            "http2",
            "--edge-ip-version",
            "4",
            "--url",
            &format!("http://127.0.0.1:{port}"),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("无法启动 cloudflared：{error}"))?;
    let (sender, receiver) = mpsc::channel();
    if let Some(output) = child.stdout.take() {
        read_tunnel_output(output, sender.clone());
    }
    if let Some(output) = child.stderr.take() {
        read_tunnel_output(output, sender.clone());
    }
    drop(sender);
    let deadline = Instant::now() + Duration::from_secs(45);
    let mut public_origin = None;
    let mut ready = false;
    loop {
        match receiver.recv_timeout(Duration::from_millis(250)) {
            Ok(TunnelEvent::Url(url)) => public_origin = Some(url),
            Ok(TunnelEvent::Ready) => ready = true,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => {}
        }
        if ready {
            if let Some(url) = public_origin {
                return Ok((child, url));
            }
        }
        if child
            .try_wait()
            .map_err(|error| error.to_string())?
            .is_some()
        {
            return Err("Cloudflare 临时隧道启动失败，进程已退出。国内网络可能无法稳定连接 trycloudflare.com。".into());
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            if public_origin.is_some() {
                return Err("隧道地址已创建，但未能连上 Cloudflare（Error 1033）。请检查网络后重试，并在分享期间保持 UNote 运行。".into());
            }
            return Err("等待 Cloudflare 临时地址超时，请检查网络后重试".into());
        }
    }
}

fn read_tunnel_output(output: impl Read + Send + 'static, sender: mpsc::Sender<TunnelEvent>) {
    thread::spawn(move || {
        let mut reader = BufReader::new(output);
        let mut buf = Vec::new();
        loop {
            buf.clear();
            match reader.read_until(b'\n', &mut buf) {
                Ok(0) => break,
                Ok(_) => {
                    let line = String::from_utf8_lossy(&buf);
                    if let Some(url) = extract_trycloudflare_url(&line) {
                        let _ = sender.send(TunnelEvent::Url(url));
                    }
                    if tunnel_connection_ready(&line) {
                        let _ = sender.send(TunnelEvent::Ready);
                    }
                }
                Err(_) => break,
            }
        }
    });
}

fn tunnel_connection_ready(line: &str) -> bool {
    let lower = line.to_ascii_lowercase();
    lower.contains("registered tunnel connection") || lower.contains("connection registered")
}

fn extract_trycloudflare_url(line: &str) -> Option<String> {
    line.split_whitespace().find_map(|part| {
        let value = part.trim_matches(|character: char| {
            !character.is_ascii_alphanumeric() && !":/.-".contains(character)
        });
        if value.starts_with("https://") && value.ends_with(".trycloudflare.com") {
            Some(value.to_string())
        } else {
            None
        }
    })
}

const SHARE_CSS: &str = r#"
:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.7;background:#fff;color:#18181b}body{margin:0}main{max-width:760px;margin:0 auto;padding:48px 24px 72px}article{overflow-wrap:anywhere}h1,h2,h3{line-height:1.25;margin:1.6em 0 .6em}h1{font-size:2rem;border-bottom:1px solid #e4e4e7;padding-bottom:.4em}h2{font-size:1.5rem}h3{font-size:1.2rem}p,ul,ol,pre,blockquote,table{margin:1em 0}a{color:#2563eb}img{display:block;max-width:100%;height:auto;border-radius:8px}blockquote{border-left:3px solid #d4d4d8;margin-left:0;padding-left:1em;color:#52525b}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#f4f4f5;border-radius:4px;padding:.15em .35em}pre{overflow:auto;background:#18181b;color:#fafafa;border-radius:8px;padding:16px}pre code{background:transparent;padding:0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d4d4d8;padding:8px 10px;text-align:left}input[type=checkbox]{margin-right:.5em}footer{border-top:1px solid #e4e4e7;color:#71717a;font-size:.8rem;margin-top:64px;padding-top:20px}@media(prefers-color-scheme:dark){:root{background:#09090b;color:#fafafa}a{color:#60a5fa}blockquote{color:#a1a1aa}code{background:#27272a}th,td{border-color:#3f3f46}h1,footer{border-color:#27272a}}
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use aes_gcm::aead::Aead;

    fn local_http_client() -> reqwest::blocking::Client {
        reqwest::blocking::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap()
    }

    #[test]
    fn encrypts_a_snapshot_with_a_url_fragment_key() {
        let encrypted = encrypt(b"secret note").unwrap();
        let value: serde_json::Value = serde_json::from_str(&encrypted.payload).unwrap();
        let key = URL_SAFE_NO_PAD.decode(encrypted.key).unwrap();
        let nonce = STANDARD.decode(value["iv"].as_str().unwrap()).unwrap();
        let ciphertext = STANDARD
            .decode(value["ciphertext"].as_str().unwrap())
            .unwrap();
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        assert_eq!(
            cipher
                .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
                .unwrap(),
            b"secret note"
        );
    }

    #[test]
    fn share_url_puts_the_key_only_in_the_fragment() {
        let url = public_share_url("https://example.trycloudflare.com", "token", "secret-key");
        assert_eq!(url, "https://example.trycloudflare.com/s/token#secret-key");
        assert!(!url.contains('?'));
        let viewer = viewer_shell("nonce");
        assert!(viewer.contains("location.hash.slice(1)"));
        assert!(!viewer.contains("URLSearchParams"));
        assert!(!viewer.contains("location.search"));
    }

    #[test]
    fn share_request_path_strips_proxy_noise() {
        assert_eq!(share_request_path("/s/secret-id"), "/s/secret-id");
        assert_eq!(
            share_request_path("/s/secret-id?__cf_chl_tk=x"),
            "/s/secret-id"
        );
        assert_eq!(share_request_path("/s/secret-id/"), "/s/secret-id");
        assert_eq!(
            share_request_path("/s/secret-id/payload?x=1"),
            "/s/secret-id/payload"
        );
        assert_eq!(
            share_request_path("http://127.0.0.1:8/s/secret-id?x=1"),
            "/s/secret-id"
        );
    }

    #[test]
    fn extracts_only_trycloudflare_https_urls() {
        assert_eq!(
            extract_trycloudflare_url("INF Your quick Tunnel has been created! Visit it at https://quiet-tree.trycloudflare.com"),
            Some("https://quiet-tree.trycloudflare.com".into())
        );
        assert_eq!(extract_trycloudflare_url("https://example.com"), None);
    }

    #[test]
    fn url_alone_is_not_a_ready_tunnel() {
        assert!(!tunnel_connection_ready(
            "INF Your quick Tunnel has been created! Visit it at https://quiet-tree.trycloudflare.com"
        ));
        assert!(tunnel_connection_ready(
            "INF Registered tunnel connection connIndex=0 location=sjc01 protocol=http2"
        ));
        assert!(tunnel_connection_ready(
            "INF Connection registered connIndex=0"
        ));
    }

    #[test]
    fn renders_markdown_and_embeds_local_images() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join(".assets")).unwrap();
        fs::create_dir(dir.path().join("notes")).unwrap();
        fs::write(dir.path().join(".assets/image.png"), b"png").unwrap();
        let markdown = embed_local_assets(
            dir.path(),
            Path::new("notes/test.md"),
            "# Title\n\n![x](../.assets/image.png)",
        )
        .unwrap();
        assert!(markdown.contains("data:image/png;base64,cG5n"));
        let html = render_document("Title", &markdown);
        assert!(html.contains("<h1>Title</h1>"));
        let hostile = render_document("Title", "<script>alert(location.hash)</script>");
        assert!(!hostile.contains("<script>alert"));
        assert!(hostile.contains("&lt;script&gt;"));
    }

    #[test]
    fn viewer_script_decrypts_rust_snapshot_to_note_html() {
        let markdown = "# 计划\n\n这是必须看见的正文";
        let html = render_document("计划", markdown);
        assert!(
            html.contains("这是必须看见的正文"),
            "rendered share html lost the note body: {html}"
        );
        let encrypted = encrypt(html.as_bytes()).unwrap();
        let fixture = tempfile::tempdir().unwrap();
        fs::write(fixture.path().join("key.txt"), &encrypted.key).unwrap();
        fs::write(fixture.path().join("payload.json"), &encrypted.payload).unwrap();
        let script = fixture.path().join("decrypt.mjs");
        fs::write(
            &script,
            r#"
import { readFileSync } from 'node:fs';
const key = readFileSync(process.argv[2], 'utf8').trim();
const payload = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const raw = key.replace(/-/g, '+').replace(/_/g, '/');
const keyBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
if (keyBytes.length !== 32) {
  console.error('bad key length ' + keyBytes.length);
  process.exit(1);
}
const decode = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
const clear = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv: decode(payload.iv) },
  cryptoKey,
  decode(payload.ciphertext),
);
const html = new TextDecoder().decode(clear);
if (!html.includes('这是必须看见的正文')) {
  console.error(html);
  process.exit(1);
}
"#,
        )
        .unwrap();
        let output = std::process::Command::new("node")
            .arg(&script)
            .arg(fixture.path().join("key.txt"))
            .arg(fixture.path().join("payload.json"))
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "browser decrypt of share snapshot failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn local_server_serves_share_page_when_proxy_adds_query_or_slash() {
        let stopped = Arc::new(AtomicBool::new(false));
        let port = start_local_server(
            "secret-id".into(),
            "{\"ciphertext\":\"x\"}".into(),
            stopped.clone(),
        )
        .unwrap();
        let client = local_http_client();
        let page = client
            .get(format!(
                "http://127.0.0.1:{port}/s/secret-id?__cf_chl_tk=cloudflare"
            ))
            .send()
            .unwrap();
        assert_eq!(page.status(), reqwest::StatusCode::OK);
        assert!(
            page.text().unwrap().contains("正在解密笔记"),
            "query string from a proxy must not hide the share viewer"
        );
        let trailing = client
            .get(format!("http://127.0.0.1:{port}/s/secret-id/"))
            .send()
            .unwrap();
        assert_eq!(trailing.status(), reqwest::StatusCode::OK);
        let payload = client
            .get(format!(
                "http://127.0.0.1:{port}/s/secret-id/payload?__cf_chl_tk=cloudflare"
            ))
            .send()
            .unwrap();
        assert_eq!(payload.status(), reqwest::StatusCode::OK);
        stopped.store(true, Ordering::Relaxed);
    }

    #[test]
    fn local_server_exposes_only_the_random_share_route() {
        let stopped = Arc::new(AtomicBool::new(false));
        let port = start_local_server(
            "secret-id".into(),
            "{\"ciphertext\":\"x\"}".into(),
            stopped.clone(),
        )
        .unwrap();
        let client = local_http_client();
        let page = client
            .get(format!("http://127.0.0.1:{port}/s/secret-id"))
            .send()
            .unwrap();
        assert!(page.status().is_success());
        assert_eq!(page.headers()["x-robots-tag"], "noindex, nofollow");
        let csp = page.headers()["content-security-policy"].to_str().unwrap();
        assert!(csp.contains("script-src 'nonce-"));
        assert!(!csp.contains("script-src 'unsafe-inline'"));
        let missing = client
            .get(format!("http://127.0.0.1:{port}/s/wrong"))
            .send()
            .unwrap();
        assert_eq!(missing.status(), reqwest::StatusCode::NOT_FOUND);
        let health = client
            .get(format!("http://127.0.0.1:{port}/"))
            .send()
            .unwrap();
        assert_eq!(health.status(), reqwest::StatusCode::OK);
        stopped.store(true, Ordering::Relaxed);
    }

    #[test]
    fn prefers_github_proxy_for_cloudflared_download() {
        let urls = cloudflared_download_urls();
        assert_eq!(
            urls[0],
            format!("https://gh-proxy.com/{CLOUDFLARED_GITHUB_URL}")
        );
        assert_eq!(urls[1], CLOUDFLARED_GITHUB_URL);
    }

    #[test]
    fn lists_no_shares_initially() {
        let state = ShareState::new();
        assert!(state.list().is_empty());
        assert_eq!(state.stop_one("missing").unwrap_err(), "分享不存在或已停止");
        state.stop_all();
        assert!(state.list().is_empty());
    }

    #[test]
    #[ignore = "downloads cloudflared and requires external network access"]
    fn cloudflare_quick_tunnel_smoke_test() {
        let repository = tempfile::tempdir().unwrap();
        let app_data = tempfile::tempdir().unwrap();
        fs::write(repository.path().join("test.md"), "# Shared").unwrap();
        let state = ShareState::new();
        let info = start(&state, repository.path(), app_data.path(), "test.md").unwrap();
        assert!(info.url.starts_with("https://"));
        assert!(info.url.contains(".trycloudflare.com/s/"));
        assert!(info.url.contains('#'));
        assert!(!info.url.contains('?'));
        assert_eq!(state.list().len(), 1);
        let public_url = info.url.split('#').next().unwrap();
        let response = reqwest::blocking::get(public_url).unwrap();
        assert!(response.status().is_success());
        assert!(response.text().unwrap().contains("正在解密笔记"));
        state.stop_one(&info.id).unwrap();
        assert!(state.list().is_empty());
    }
}
