import { invoke, isTauri } from '@tauri-apps/api/core'

export type SyncStatus = 'idle' | 'saved' | 'syncing' | 'synced' | 'error'

export interface AuthSession {
  avatarUrl: string
  host: string
  login: string
  name: string
  repo: string
}

export interface DesktopSnapshot {
  errorMessage: string | null
  lastSyncAt: number | null
  session: AuthSession | null
  syncStatus: SyncStatus
}

export const desktopAvailable = isTauri()

export function bootstrapDesktop() {
  return invoke<DesktopSnapshot>('bootstrap')
}

export function loginWithGitee() {
  return invoke<DesktopSnapshot>('start_oauth')
}

export function logoutDesktop() {
  return invoke<DesktopSnapshot>('logout')
}

export function syncDesktop() {
  return invoke<DesktopSnapshot>('full_sync')
}
