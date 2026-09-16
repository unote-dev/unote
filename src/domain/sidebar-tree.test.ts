import type { DocumentEntry, FolderEntry } from '@/domain/workspace'
import { describe, expect, it } from 'vitest'
import { treeEntryVariant } from '@/domain/sidebar-tree'

describe('treeEntryVariant', () => {
  const folder: FolderEntry = { kind: 'folder', name: '项目', path: '项目', children: [] }
  const note: DocumentEntry = { kind: 'markdown', name: '计划.md', path: '项目/计划.md', updatedAt: 0 }

  it('highlights only the open document, not its creation target folder', () => {
    expect(treeEntryVariant(folder, note.path)).toBe('ghost')
    expect(treeEntryVariant(note, note.path)).toBe('secondary')
  })
})
