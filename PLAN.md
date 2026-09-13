# Fix Dark Mode & Resizable Splitter

## 问题分析

### 暗色模式不可用

1. **toggle 逻辑有缺陷**: `colorMode.value` 在首次加载时为 `'auto'`（非 `'dark'`），导致 `isDark` 初始为 `false`，toggle 状态与实际外观不一致。
2. **应使用 `preference`**: Nuxt UI 的 `useColorMode` 封装了 VueUse 的，内部将 `'system'` 映射为 VueUse 的 `'auto'`。toggle 应操作 `preference` 而非 `value`。
3. **CSS selector 缺少 media query fallback**: 只用了 `html.dark` class selector，在 `useDark()` 未正确初始化时暗色不生效。

### 三栏宽度不可调

当前 `index.vue` 使用硬编码 `w-[220px]` / `w-[280px]` / `flex-1` 的 div，完全没有 splitter 功能。需替换为 Nuxt UI 的 `USplitter` 组件。

## 修改方案

### 1. `src/assets/css/main.css` — dark mode CSS

- 将 `html.dark` 替换为 `html.dark, :root:where(.dark)`，兼容 Nuxt UI 的 `.dark` class 生效方式
- 增加 `@media (prefers-color-scheme: dark)` fallback，确保 OS 暗色偏好也能生效（当 localStorage 未设置时）

### 2. `src/App.vue` — 使用 Nuxt UI 的 useColorMode

- 从 `@vueuse/core` 改为 `@nuxt/ui/composables/useColorMode`

### 3. `src/components/workspace/WorkspaceSidebar.vue` — 修复 toggle

- 从 `@vueuse/core` 改为 `@nuxt/ui/composables/useColorMode`
- `colorMode.value` → `colorMode.preference` 用于 toggle
- `isDark` 改用 `colorMode.value === 'dark'`（读 resolved 值）

### 4. `src/pages/index.vue` — 实现三栏可调 splitter

- 导入 `USplitter`（auto-imported by Nuxt UI）
- 将三个固定 div 替换为 `<USplitter>` + `items` 数组 + named slots
- sidebar: 220px, min 160px, max 320px
- note list: 280px, min 200px, max 420px
- editor: 填满剩余空间
- 使用 `autoSaveId` 自动保存用户拖拽后的尺寸到 localStorage

## 涉及文件

| 文件                                            | 改动                                       |
| ----------------------------------------------- | ------------------------------------------ |
| `src/assets/css/main.css`                       | 修改 dark mode selector + 增加 media query |
| `src/App.vue`                                   | useColorMode import 来源                   |
| `src/components/workspace/WorkspaceSidebar.vue` | useColorMode import + toggle 逻辑          |
| `src/pages/index.vue`                           | 替换为 USplitter 三栏布局                  |
