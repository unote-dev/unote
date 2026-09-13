import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST

export default defineConfig(() => ({
  plugins: [
    vue(),
    ui({
      autoImport: {
        imports: [
          'vue',
          '@vueuse/core',
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '~': resolve(dirname(fileURLToPath(import.meta.url)), 'src'),
    },
  },
  optimizeDeps: {
    holdUntilCrawlEnd: false,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
}))
