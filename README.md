<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" alt="UNote Logo" />
</p>

<h1 align="center">UNote</h1>

<p align="center">Git 优先的轻量桌面文档应用。</p>

<p align="center">
  <a href="https://github.com/unote-dev/unote/releases/latest">下载</a> ·
  <a href="#开发">开发</a> ·
  <a href="#技术栈">技术栈</a>
</p>

---

## 简介

UNote 是一个基于 Git 的个人文档管理工具。你的文档以真实目录和文件的形式存储在 **你的 Git 私有仓库** 中，UNote 负责编辑、导航与安全同步。

- **数据主权**：文档存储在你的私有仓库，只有你自己可以访问
- **离线优先**：所有编辑先写入本地，网络可用时自动同步
- **开源透明**：代码完全开源，无遥测、无数据收集

## 功能

- **Markdown 编辑**：基于 MDXEditor 的富文本编辑体验
- **画布文档**：基于 Excalidraw 的自由绘图与白板
- **脑图**：基于 Mind Elixir 的节点式思维导图
- **图表文档**：基于 diagrams.net 的 Draw.io 编辑器
- **文件夹管理**：支持任意嵌套目录结构
- **回收站**：文档移到仓库 `.trash` 目录
- **临时分享**：Cloudflare Quick Tunnel 只读快照，密钥只在链接 `#` 之后
- **Git 同步**：自动 commit + push，支持多设备同步
- **中英界面**：可在账户菜单切换
- **资源管理**：图片等附件存储在 `.assets/` 目录，文档可直接引用
- **暗色模式**：跟随系统或手动切换

## 认证提供方

| 提供方 | 状态     |
| ------ | -------- |
| Gitee  | 已支持   |
| GitHub | 即将支持 |
| GitLab | 即将支持 |

## 下载

从 [GitHub Releases](https://github.com/unote-dev/unote/releases/latest) 下载最新版本。

当前支持：

- Windows（NSIS 安装包 / 便携版）

> macOS 和 Linux 支持将在后续版本中提供。

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/) + MSVC (Windows) / Xcode (macOS)
- [Tauri 2 前置依赖](https://v2.tauri.app/start/prerequisites/)

### 快速开始

在 `src-tauri/src/constants.rs` 中填写你的 Gitee OAuth 应用凭据（回调地址 `http://127.0.0.1:17331/callback`），然后：

```bash
pnpm install
pnpm tauri dev
```

### 检查

```bash
pnpm lint
pnpm test
pnpm build
cd src-tauri && cargo test
```

### 构建发布

```bash
pnpm tauri build
```

打 tag 自动触发 GitHub Actions 构建并发布：

```bash
git tag v0.2.0
git push origin v0.2.0
```

## 技术栈

| 层            | 技术                                                 |
| ------------- | ---------------------------------------------------- |
| 桌面框架      | [Tauri 2](https://v2.tauri.app/)                     |
| 前端          | React 19 + TypeScript 6 + Vite 8                     |
| UI            | Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) |
| Markdown 编辑 | [MDXEditor](https://www.mdxeditor.dev/)              |
| 画布          | [Excalidraw](https://excalidraw.com/)                |
| 脑图          | [Mind Elixir](https://docs.mind-elixir.com/)         |
| 后端          | Rust (git2, reqwest, keyring)                        |
| 认证          | OAuth 2.0 + 系统 Keyring 存储                        |
| 同步          | Git (libgit2)                                        |

## 开源协议

[MIT](LICENSE)
