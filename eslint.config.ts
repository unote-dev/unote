import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: true,
    react: true,
  },
  {
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: [
      'src-tauri',
      'dist',
    ],
  },
)
