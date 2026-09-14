import type { WorkspaceSnapshot } from '@/domain/workspace'
import type { WorkspacePort } from '@/workspace/port'

const initialSnapshot: WorkspaceSnapshot = {
  libraryName: 'lin.gitee.unote',
  selectedPath: '工作/项目/产品规划.md',
  sync: 'synced',
  roots: [
    {
      kind: 'folder',
      name: '工作',
      path: '工作',
      children: [
        {
          kind: 'folder',
          name: '项目',
          path: '工作/项目',
          children: [
            { kind: 'markdown', name: '产品规划', path: '工作/项目/产品规划.md', updatedAt: Date.now() },
            { kind: 'canvas', name: '架构草图', path: '工作/项目/架构草图.excalidraw', updatedAt: Date.now() - 1000 },
            { kind: 'mindmap', name: '知识结构', path: '工作/项目/知识结构.mindmap', updatedAt: Date.now() - 2000 },
          ],
        },
        { kind: 'markdown', name: '本周记录', path: '工作/本周记录.md', updatedAt: Date.now() - 3000 },
      ],
    },
    { kind: 'folder', name: '生活', path: '生活', children: [] },
  ],
}

export class MemoryWorkspacePort implements WorkspacePort {
  #snapshot = initialSnapshot

  async getSnapshot() {
    return structuredClone(this.#snapshot)
  }

  async selectDocument(path: string) {
    this.#snapshot = { ...this.#snapshot, selectedPath: path }
    return this.getSnapshot()
  }

  async sync() {
    this.#snapshot = { ...this.#snapshot, sync: 'synced' }
    return this.getSnapshot()
  }
}
