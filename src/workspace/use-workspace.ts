import type { WorkspaceSnapshot } from '@/domain/workspace'

import type { WorkspacePort } from '@/workspace/port'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MemoryWorkspacePort } from '@/workspace/memory-port'

export function useWorkspace(port?: WorkspacePort) {
  const fallbackPort = useMemo(() => new MemoryWorkspacePort(), [])
  const activePort = port ?? fallbackPort
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null)

  useEffect(() => {
    void activePort.getSnapshot().then(setSnapshot)
  }, [activePort])

  const selectDocument = useCallback(async (path: string) => {
    setSnapshot(await activePort.selectDocument(path))
  }, [activePort])

  const sync = useCallback(async () => {
    setSnapshot(await activePort.sync())
  }, [activePort])

  return { snapshot, selectDocument, sync }
}
