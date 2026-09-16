import type { CreateKind, DocumentEntry, FolderEntry, WorkspaceSnapshot } from '@/domain/workspace'

export interface WorkspacePort {
  createContent: (parent: string, name: string, kind: CreateKind) => Promise<WorkspaceSnapshot>
  getSnapshot: () => Promise<WorkspaceSnapshot>
  getTrashTree: () => Promise<Array<FolderEntry | DocumentEntry>>
  selectDocument: (path: string) => Promise<WorkspaceSnapshot>
  trashContent: (path: string) => Promise<WorkspaceSnapshot>
  writeDocument: (path: string, content: string) => Promise<void>
}
