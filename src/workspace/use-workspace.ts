import type { CreateKind, WorkspaceSnapshot } from '@/domain/workspace'

import type { WorkspacePort } from '@/workspace/port'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DesktopWorkspacePort } from '@/workspace/desktop-port'

export function useWorkspace(enabled: boolean, port?: WorkspacePort) {
  const fallbackPort = useMemo(() => new DesktopWorkspacePort(), [])
  const activePort = port ?? fallbackPort
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingWriteRef = useRef<{ content: string, path: string } | null>(null)
  const writePromiseRef = useRef(Promise.resolve())

  const queueWrite = useCallback((write: { content: string, path: string }) => {
    writePromiseRef.current = writePromiseRef.current
      .catch(() => undefined)
      .then(() => activePort.writeDocument(write.path, write.content))
    return writePromiseRef.current
  }, [activePort])

  useEffect(() => {
    if (enabled)
      void activePort.getSnapshot().then(setSnapshot)
  }, [activePort, enabled])

  const selectDocument = useCallback(async (path: string) => {
    clearTimeout(saveTimerRef.current)
    const write = pendingWriteRef.current
    pendingWriteRef.current = null
    if (write)
      queueWrite(write)
    await writePromiseRef.current
    setSnapshot(await activePort.selectDocument(path))
  }, [activePort, queueWrite])

  const updateDocument = useCallback((content: string) => {
    setSnapshot(current => current ? { ...current, selectedContent: content } : current)
    if (!snapshot?.selectedPath)
      return
    clearTimeout(saveTimerRef.current)
    const path = snapshot.selectedPath
    pendingWriteRef.current = { content, path }
    saveTimerRef.current = setTimeout(() => {
      pendingWriteRef.current = null
      void queueWrite({ content, path })
    }, 500)
  }, [queueWrite, snapshot?.selectedPath])

  useEffect(() => () => clearTimeout(saveTimerRef.current), [])

  const refresh = useCallback(async () => {
    setSnapshot(await activePort.getSnapshot())
  }, [activePort])

  const flush = useCallback(async () => {
    clearTimeout(saveTimerRef.current)
    const write = pendingWriteRef.current
    pendingWriteRef.current = null
    if (write)
      queueWrite(write)
    await writePromiseRef.current
  }, [queueWrite])

  const createContent = useCallback(async (parent: string, name: string, kind: CreateKind) => {
    await flush()
    setSnapshot(await activePort.createContent(parent, name, kind))
  }, [activePort, flush])

  return { createContent, flush, refresh, selectDocument, snapshot, updateDocument }
}
