import type { DocumentEntry, FolderEntry, WorkspaceSnapshot } from '@/domain/workspace'
import type { WorkspacePort } from '@/workspace/port'
import { invoke } from '@tauri-apps/api/core'
import { flattenDocuments } from '@/domain/workspace'

interface BackendEntry {
  children: BackendEntry[]
  kind: 'folder' | 'markdown' | 'canvas' | 'mindmap'
  name: string
  path: string
  updatedAt: number
}

function toEntry(entry: BackendEntry): FolderEntry | DocumentEntry {
  if (entry.kind === 'folder') {
    return {
      children: entry.children.map(toEntry),
      kind: 'folder',
      name: entry.name,
      path: entry.path,
    }
  }
  return { kind: entry.kind, name: entry.name, path: entry.path, updatedAt: entry.updatedAt }
}

export class DesktopWorkspacePort implements WorkspacePort {
  #snapshot: WorkspaceSnapshot | null = null

  async getSnapshot() {
    const roots = (await invoke<BackendEntry[]>('get_content_tree')).map(toEntry)
    const first = flattenDocuments(roots)[0]
    const selected = this.#snapshot?.selectedPath
    const selectedPath = selected && flattenDocuments(roots).some(document => document.path === selected) ? selected : first?.path ?? null
    const selectedContent = selectedPath ? await invoke<string>('read_document', { path: selectedPath }) : ''
    this.#snapshot = { libraryName: '', roots, selectedContent, selectedPath, sync: 'synced' }
    return structuredClone(this.#snapshot)
  }

  async selectDocument(path: string) {
    if (!this.#snapshot)
      await this.getSnapshot()
    const selectedContent = await invoke<string>('read_document', { path })
    this.#snapshot = { ...this.#snapshot!, selectedContent, selectedPath: path }
    return structuredClone(this.#snapshot)
  }

  async writeDocument(path: string, content: string) {
    await invoke('write_document', { content, path })
    if (this.#snapshot?.selectedPath === path)
      this.#snapshot = { ...this.#snapshot, selectedContent: content }
  }
}
