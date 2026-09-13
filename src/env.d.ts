/// <reference types="vite/client" />

declare module '*.css' {
  const css: string
  export default css
}

declare function defineAppConfig<T>(config: T): T
