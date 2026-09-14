export type DocumentKind = 'markdown' | 'canvas' | 'mindmap'

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
  roots: FolderEntry[]
  selectedPath: string | null
  sync: 'idle' | 'saving' | 'syncing' | 'synced' | 'conflict' | 'error'
}

export function isFolder(entry: FolderEntry | DocumentEntry): entry is FolderEntry {
  return entry.kind === 'folder'
}

export function flattenDocuments(folders: FolderEntry[]): DocumentEntry[] {
  return folders.flatMap(folder => folder.children.flatMap(entry => (
    isFolder(entry) ? flattenDocuments([entry]) : [entry]
  )))
}
