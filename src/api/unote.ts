import type { CreateNoteResult, Snapshot } from '../types/unote'
import { invoke } from '@tauri-apps/api/core'

export function bootstrap() {
  return invoke<Snapshot>('bootstrap')
}

export function debugOpenTempWorkspace() {
  return invoke<Snapshot>('debug_open_temp_workspace')
}

export function getSnapshot() {
  return invoke<Snapshot>('get_snapshot')
}

export function createNotebook(name: string) {
  return invoke<Snapshot>('create_notebook_cmd', { name })
}

export function renameNotebook(id: string, name: string) {
  return invoke<Snapshot>('rename_notebook_cmd', { id, name })
}

export function trashNotebook(id: string) {
  return invoke<Snapshot>('trash_notebook_cmd', { id })
}

export function restoreNotebook(id: string) {
  return invoke<Snapshot>('restore_notebook_cmd', { id })
}

export function permanentlyDeleteNotebook(id: string) {
  return invoke<Snapshot>('permanently_delete_notebook_cmd', { id })
}

export function createNote(notebookId?: string | null) {
  return invoke<CreateNoteResult>('create_note_cmd', { notebookId: notebookId ?? null })
}

export function updateNote(id: string, title: string, body: string) {
  return invoke<Snapshot>('update_note_cmd', { id, title, body })
}

export function saveWorkspaceNow() {
  return invoke<Snapshot>('save_workspace_now')
}

export function fullSync() {
  return invoke<Snapshot>('full_sync')
}

export function startOAuth() {
  return invoke<Snapshot>('start_oauth')
}

export function logout() {
  return invoke<Snapshot>('logout')
}

export function saveImage(data: string, filename: string) {
  return invoke<string>('save_image_cmd', { data, filename })
}

export function openWorkspaceFolder() {
  return invoke<void>('open_workspace_folder')
}
