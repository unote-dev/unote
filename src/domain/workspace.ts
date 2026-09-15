export type DocumentKind = 'markdown' | 'canvas' | 'mindmap'
export type CreateKind = DocumentKind | 'folder'

export interface DocumentEntry {
  kind: DocumentKind
  name: string
  path: string
  updatedAt: number
}

export interface FolderEntry {
  children: Array<FolderEntry | DocumentEntry>
  kind: 'folder'
  name: string
  path: string
}

export interface WorkspaceSnapshot {
  libraryName: string
  roots: Array<FolderEntry | DocumentEntry>
  selectedContent: string
  selectedPath: string | null
  sync: 'idle' | 'saving' | 'syncing' | 'synced' | 'conflict' | 'error'
}

export function isFolder(entry: FolderEntry | DocumentEntry): entry is FolderEntry {
  return entry.kind === 'folder'
}

export function flattenDocuments(entries: Array<FolderEntry | DocumentEntry>): DocumentEntry[] {
  return entries.flatMap(entry => isFolder(entry) ? flattenDocuments(entry.children) : [entry])
}
