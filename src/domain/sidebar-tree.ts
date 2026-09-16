import type { DocumentEntry, FolderEntry } from '@/domain/workspace'
import { isFolder } from '@/domain/workspace'

export function treeEntryVariant(entry: FolderEntry | DocumentEntry, selectedPath: string | null): 'secondary' | 'ghost' {
  if (isFolder(entry))
    return 'ghost'
  return selectedPath === entry.path ? 'secondary' : 'ghost'
}
