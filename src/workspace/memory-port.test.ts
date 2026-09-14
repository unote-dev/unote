import { describe, expect, it } from 'vitest'

import { flattenDocuments } from '@/domain/workspace'
import { MemoryWorkspacePort } from '@/workspace/memory-port'

describe('memoryWorkspacePort', () => {
  it('exposes nested documents through the workspace interface', async () => {
    const snapshot = await new MemoryWorkspacePort().getSnapshot()
    expect(flattenDocuments(snapshot.roots).map(document => document.kind)).toEqual(['markdown', 'canvas', 'mindmap', 'markdown'])
  })

  it('selects a document by repository-relative path', async () => {
    const port = new MemoryWorkspacePort()
    const snapshot = await port.selectDocument('工作/项目/知识结构.mindmap')
    expect(snapshot.selectedPath).toBe('工作/项目/知识结构.mindmap')
  })
})
