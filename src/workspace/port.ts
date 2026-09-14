import type { WorkspaceSnapshot } from '@/domain/workspace'

export interface WorkspacePort {
  getSnapshot: () => Promise<WorkspaceSnapshot>
  selectDocument: (path: string) => Promise<WorkspaceSnapshot>
  writeDocument: (path: string, content: string) => Promise<void>
}
