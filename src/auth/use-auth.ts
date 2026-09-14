import type { DesktopSnapshot } from '@/auth/desktop-auth'
import { useCallback, useEffect, useState } from 'react'
import { bootstrapDesktop, desktopAvailable, loginWithGitee, logoutDesktop, syncDesktop } from '@/auth/desktop-auth'

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function useAuth() {
  const [snapshot, setSnapshot] = useState<DesktopSnapshot | null>(null)
  const [loading, setLoading] = useState(desktopAvailable)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(() => desktopAvailable ? null : 'Gitee 登录只能在 Unote 桌面应用中使用。')

  useEffect(() => {
    if (!desktopAvailable)
      return
    void bootstrapDesktop()
      .then(setSnapshot)
      .catch(cause => setError(errorText(cause)))
      .finally(() => setLoading(false))
  }, [])

  const run = useCallback(async (action: () => Promise<DesktopSnapshot>) => {
    setPending(true)
    setError(null)
    try {
      const next = await action()
      setSnapshot(next)
      return next
    }
    catch (cause) {
      setError(errorText(cause))
      return null
    }
    finally {
      setPending(false)
    }
  }, [])

  const sync = useCallback(async () => {
    setPending(true)
    setError(null)
    setSnapshot(current => current ? { ...current, errorMessage: null, syncStatus: 'syncing' } : current)
    try {
      const next = await syncDesktop()
      setSnapshot(next)
      return next
    }
    catch (cause) {
      const message = errorText(cause)
      setError(message)
      setSnapshot(current => current ? { ...current, errorMessage: message, syncStatus: 'error' } : current)
      return null
    }
    finally {
      setPending(false)
    }
  }, [])

  return {
    desktopAvailable,
    error,
    login: () => run(loginWithGitee),
    loading,
    logout: () => run(logoutDesktop),
    pending,
    snapshot,
    sync,
  }
}
