export type SyncStatus = 'idle' | 'saved' | 'syncing' | 'synced' | 'error'
export type SaveStatus = 'saved' | 'dirty' | 'saving'

export interface Notebook {
  id: string
  name: string
  trashed: boolean
}

export interface Note {
  id: string
  title: string
  type: string
  body: string
  notebookId: string
  updatedAt: number
}

export interface PublicSession {
  host: string
  login: string
  name: string
  avatarUrl: string
  repo: string
  public: boolean
}

export interface Snapshot {
  opened: boolean
  debug: boolean
  isDebugBuild: boolean
  workspaceRoot: string | null
  inboxId: string
  notebooks: Notebook[]
  notes: Note[]
  syncStatus: SyncStatus
  saveStatus: SaveStatus
  errorMessage: string | null
  lastSyncAt: number | null
  session: PublicSession | null
}

export interface CreateNoteResult {
  snapshot: Snapshot
  noteId: string
}

export type Scope
  = { kind: 'all' }
    | { kind: 'notebook', id: string }
    | { kind: 'trash' }
    | { kind: 'trashedNotebook', id: string }
