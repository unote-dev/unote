import { isTauri } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'

export const GITHUB_REPO_URL = 'https://github.com/unote-dev/unote'
export const GITHUB_ISSUE_URL = `${GITHUB_REPO_URL}/issues/new`

export async function openExternal(url: string) {
  if (isTauri()) {
    await openUrl(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
