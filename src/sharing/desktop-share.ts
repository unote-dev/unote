import { invoke } from '@tauri-apps/api/core'

export interface ShareInfo {
  id: string
  name: string
  path: string
  url: string
}

export function listShares() {
  return invoke<ShareInfo[]>('list_shares')
}

export function startShare(path: string) {
  return invoke<ShareInfo>('start_share', { path })
}

export function stopShare(id: string) {
  return invoke<ShareInfo[]>('stop_share', { id })
}

export function stopAllShares() {
  return invoke<ShareInfo[]>('stop_all_shares')
}
