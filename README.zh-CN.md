<p align="center">
  <img src="src-tauri/icons/icon.png" width="96" alt="UNote logo" />
</p>

<h1 align="center">UNote</h1>

<p align="center">
  Git 优先的桌面文档应用。文件保存在 <strong>你自己的</strong> Git 私有仓库里。
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  简体中文
</p>

<p align="center">
  <a href="https://github.com/unote-dev/unote/actions/workflows/ci.yml"><img src="https://github.com/unote-dev/unote/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/unote-dev/unote/actions/workflows/release.yml"><img src="https://github.com/unote-dev/unote/actions/workflows/release.yml/badge.svg" alt="Release" /></a>
  <a href="https://github.com/unote-dev/unote/releases/latest"><img src="https://img.shields.io/github/v/release/unote-dev/unote" alt="Latest release" /></a>
  <a href="https://github.com/unote-dev/unote/releases/latest"><img src="https://img.shields.io/badge/platform-Windows%20x64-0078D6?logo=windows&logoColor=white" alt="Windows x64" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT" />
</p>

<p align="center">
  <img src="docs/screenshots/hero.png" alt="UNote 浅色 / 深色界面" />
</p>

## 功能

- **Markdown**：基于真实 `.md` 文件的富文本编辑（[MDXEditor](https://www.mdxeditor.dev/)）
- **画布**：自由绘图（[Excalidraw](https://excalidraw.com/)）
- **脑图**：节点式思维导图（[Mind Elixir](https://docs.mind-elixir.com/)）
- **图表**：Draw.io，基于 [diagrams.net](https://www.diagrams.net/)
- **文件夹**：任意嵌套目录，没有额外元数据层
- **回收站**：删除的文档进入仓库 `.trash`
- **Git 同步**：先写本地，再 commit / push
- **临时分享**：Cloudflare Quick Tunnel 只读快照，解密密钥只放在链接 `#` 之后
- **中英界面**：可在账户菜单切换
- **资源文件**：图片等附件放在 `.assets/`，文档可直接引用
- **主题**：浅色、深色，或跟随系统
- **自动更新**：对照 GitHub 最新 Release 检查更新

## 下载

从 [Releases](https://github.com/unote-dev/unote/releases/latest) 下载 Windows NSIS 安装包。

macOS 和 Linux 暂未提供。

## Git 提供方

| 提供方 | 状态 |
| ------ | ---- |
| Gitee | 已支持 |
| GitHub | 即将支持 |
| GitLab | 即将支持 |

## 开发

环境要求：

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/) + MSVC（Windows）
- [Tauri 2 前置依赖](https://v2.tauri.app/start/prerequisites/)

在 Gitee 创建 OAuth 应用，回调地址为 `http://127.0.0.1:17331/callback`，把凭据写入 `src-tauri/src/constants.rs`，然后：

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

### 发布构建

```bash
pnpm tauri build
```

推送 `v*.*.*` 标签会触发 GitHub Actions，构建 NSIS 安装包并发布 Release。详见 [docs/RELEASING.md](docs/RELEASING.md)。

## 技术栈

| 层 | 技术 |
| -- | ---- |
| 桌面 | [Tauri 2](https://v2.tauri.app/) |
| 前端 | React 19、TypeScript、Vite |
| UI | Tailwind CSS 4、[shadcn/ui](https://ui.shadcn.com/) |
| Markdown | [MDXEditor](https://www.mdxeditor.dev/) |
| 画布 | [Excalidraw](https://excalidraw.com/) |
| 脑图 | [Mind Elixir](https://docs.mind-elixir.com/) |
| 后端 | Rust（`git2`、`reqwest`、`keyring`） |
| 认证 | OAuth 2.0，凭据存系统 Keyring |
| 同步 | Git（libgit2） |

## 开源协议

MIT
