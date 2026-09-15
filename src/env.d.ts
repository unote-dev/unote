/// <reference types="vite/client" />

declare module '*.css'

declare module '@mind-elixir/node-menu' {
  import type { MindElixirInstance } from 'mind-elixir'

  const NodeMenu: (instance: MindElixirInstance) => void
  export default NodeMenu
}
