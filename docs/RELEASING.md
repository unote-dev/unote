# 发布 UNote

当前发布目标是 Windows x64 NSIS 安装包。安装器支持选择当前用户或所有用户、选择安装目录，并为应用内自动更新生成签名产物和 `latest.json`。

## 首次配置

在 GitHub 仓库的 `Settings > Secrets and variables > Actions` 中配置：

- `TAURI_SIGNING_PRIVATE_KEY`：与 `src-tauri/tauri.conf.json` 中公钥配对的 Tauri updater 私钥内容。
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：私钥密码；私钥没有密码时可以不配置。

Tauri updater 签名和 Windows Authenticode 代码签名是两套机制。当前流水线包含 updater 签名，但不包含付费的 Windows 代码签名证书；因此 Windows SmartScreen 仍可能提示未知发布者。

## 发布 0.1.0

1. 确认工作区干净，且 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 的版本均为 `0.1.0`。
2. 在本地执行 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm build`，并在 `src-tauri` 下执行 `cargo test --locked`。
3. 提交并推送全部发布改动。
4. 创建并推送标签：`git tag v0.1.0`，然后 `git push origin v0.1.0`。
5. GitHub Actions 将验证版本、运行测试、构建 NSIS 安装包，并创建 `UNote v0.1.0` Release。
6. 发布完成后确认 Release 同时包含安装器、签名文件和 `latest.json`；缺少任意一项时不要向用户宣布自动更新可用。

后续版本重复上述流程并递增三个版本号。应用启动后会读取 GitHub 最新 Release 的 `latest.json`，发现更高版本时显示更新对话框；更新安装会复用用户首次选择的安装位置。
