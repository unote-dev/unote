import type { CreateKind, WorkspaceSnapshot } from '@/domain/workspace'

export interface WorkspacePort {
  createContent: (parent: string, name: string, kind: CreateKind) => Promise<WorkspaceSnapshot>
  getSnapshot: () => Promise<WorkspaceSnapshot>
  selectDocument: (path: string) => Promise<WorkspaceSnapshot>
  writeDocument: (path: string, content: string) => Promise<void>
}
