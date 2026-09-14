import type { WorkspaceSnapshot } from '@/domain/workspace'

export interface WorkspacePort {
  getSnapshot: () => Promise<WorkspaceSnapshot>
  selectDocument: (path: string) => Promise<WorkspaceSnapshot>
  sync: () => Promise<WorkspaceSnapshot>
}
