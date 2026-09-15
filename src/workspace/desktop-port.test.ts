import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesktopWorkspacePort } from '@/workspace/desktop-port'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

describe('desktopWorkspacePort', () => {
  beforeEach(() => invoke.mockReset())

  it('maps a nested repository tree and opens the first document', async () => {
    invoke.mockResolvedValueOnce([{ children: [{ children: [], kind: 'markdown', name: '计划', path: '工作/计划.md', updatedAt: 1 }], kind: 'folder', name: '工作', path: '工作', updatedAt: 0 }])
    invoke.mockResolvedValueOnce('# 计划')
    const snapshot = await new DesktopWorkspacePort().getSnapshot()
    expect(snapshot.selectedPath).toBe('工作/计划.md')
    expect(snapshot.selectedContent).toBe('# 计划')
    expect(invoke).toHaveBeenLastCalledWith('read_document', { path: '工作/计划.md' })
  })

  it('writes content to the selected real path', async () => {
    invoke.mockResolvedValue(undefined)
    const port = new DesktopWorkspacePort()
    await port.writeDocument('工作/计划.md', 'updated')
    expect(invoke).toHaveBeenCalledWith('write_document', { content: 'updated', path: '工作/计划.md' })
  })

  it('creates a real document and selects it', async () => {
    const entry = { children: [], kind: 'markdown', name: '计划', path: '工作/计划.md', updatedAt: 1 }
    invoke.mockResolvedValueOnce('工作/计划.md')
    invoke.mockResolvedValueOnce([{ children: [entry], kind: 'folder', name: '工作', path: '工作', updatedAt: 0 }])
    invoke.mockResolvedValueOnce('')
    invoke.mockResolvedValueOnce('')
    const snapshot = await new DesktopWorkspacePort().createContent('工作', '计划', 'markdown')
    expect(invoke).toHaveBeenNthCalledWith(1, 'create_content', { kind: 'markdown', name: '计划', parent: '工作' })
    expect(snapshot.selectedPath).toBe('工作/计划.md')
  })
})
