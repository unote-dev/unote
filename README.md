# Unote

Git 优先的轻量桌面笔记应用。仓库中的真实目录和文件就是内容模型。

## 技术栈

- Tauri 2 + Rust
- React 19 + Vite 8 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- MDXEditor、Excalidraw、React Flow

## 开发

```bash
pnpm install
pnpm dev
```

桌面开发：

```bash
pnpm tauri dev
```

检查：

```bash
pnpm lint
pnpm test
pnpm build
cd src-tauri && cargo test
```

当前架构和后续阶段见 [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) 与 [docs/REWRITE_PLAN.md](docs/REWRITE_PLAN.md)。
