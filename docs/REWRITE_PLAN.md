# unote 重写计划

重写按可验证的纵向阶段推进。每一阶段结束时项目必须可编译、核心测试通过，并产生可人工检查的真实仓库。

## 阶段 1：冻结仓库协议

- 定义 `.unote/settings.json` schema v1。
- 定义 Markdown frontmatter、`.mindmap` JSON schema 和 `.excalidraw` 接受规则。
- 实现跨平台安全名称校验。
- 实现忽略点前缀系统路径、符号链接和 Junction 的递归扫描。
- 用临时目录测试嵌套、重名、非法名称和外部变化。

验收：给定真实目录，可稳定生成同一棵文档树；扫描不会越出仓库根目录。

## 阶段 2：深文件存储 module

- 以相对路径替换 Notebook/Note 持久 ID。
- 实现创建、重命名、移动、读取和原子保存。
- 实现 `.trash/` 移入、恢复和永久删除。
- 实现 `.assets/` 保存与显式删除。
- 写入失败时保留原文件，并用故障注入测试部分写入。

验收：操作在文件管理器和 Git diff 中可直接理解；失败不会产生半写入状态。

## 阶段 3：认证与专用仓库

- 提取 AuthProvider seam，首个 adapter 为 Gitee。
- 固定仓库名和私有创建规则。
- 验证空仓库、有效仓库、同名冲突仓库和版本不兼容仓库。
- 提取 CredentialStore seam，接入 Windows/macOS/Linux 安全存储与 Linux 内存 fallback。

验收：token 不出现在仓库、日志或明文设备文件中；同名非 unote 仓库不会被修改。

## 阶段 4：深同步 module

- 将同步状态机从 Tauri 和全局 Mutex 中提取。
- 本地保存与同步彻底解耦，删除 idle push。
- 慢速磁盘、Git、网络操作在全局状态锁外执行。
- 实现自动合并、Markdown 三方合并、冲突副本和删除/修改恢复。
- 使用内存 adapters 测试状态机，再用真实临时 Git 仓库做集成测试。

验收：同步期间编辑不阻塞；所有冲突测试不丢失任一端内容；用户界面不暴露 Git 术语。

## 阶段 5：React 壳与导航

- 移除 Nuxt/Vue，建立 React 19 + Vite 8 + TypeScript。
- 初始化 Tailwind 和 shadcn/ui。
- 建立类型化 workspace interface 与测试 adapter；Rust interface 稳定后再实现 Tauri adapter。
- 实现登录、递归文件树、文档列表、搜索、回收站和同步状态。
- 为前端状态与外部变化冲突添加无需 Tauri 的测试 adapter。

验收：可登录并浏览嵌套真实目录；前端核心状态测试不依赖桌面运行时。

## 阶段 6：三种编辑器

- MDXEditor：CommonMark/GFM、源码模式、Mermaid，禁用 MDX/JSX。
- Excalidraw：标准 `.excalidraw` 读写。
- React Flow：严格树形 `.mindmap` 读写，布局不落盘。
- 三种编辑器统一接入本地保存与外部变化检测。

验收：三种文件均可创建、重命名、编辑、关闭重开和同步；Git diff 中无编辑器私有缓存。

## 阶段 7：搜索、缓存与发布

- 先实现无索引搜索；数据量证明需要时再增加仓库外本地索引。
- 增加自动同步设备设置，默认五分钟且可关闭。
- Windows 完整人工验收。
- Windows/macOS/Linux CI 编译和测试。
- 删除旧模型、旧 Vue 代码和失效依赖。

验收：Rust、前端测试和三平台 CI 全绿；Windows 安装包完成真实 Gitee 双设备场景验收。

## 实施纪律

- 每阶段先写会失败的真实行为测试，再替换实现。
- 不引入旧仓库迁移代码。
- 不同时重写文件协议和 UI；先稳定 Rust interface，再接 React。
- 每个提交只跨一个可验证 seam，避免一次性大爆炸提交。
