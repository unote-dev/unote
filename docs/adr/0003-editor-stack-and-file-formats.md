# 编辑器是文件格式的 adapter

前端使用 React 19、Vite 8 和 shadcn/ui；MDXEditor 编辑普通 CommonMark/GFM，Excalidraw 编辑标准 `.excalidraw`，React Flow 编辑严格树形 `.mindmap`。编辑器内部状态不成为仓库协议，以避免内容被某个 UI 库锁定；我们接受维护三个 adapter 的成本，换取每种文件仍可脱离 unote 理解和处理。
