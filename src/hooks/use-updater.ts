import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useState } from 'react'

interface UpdateState {
  available: boolean
  version: string
  body: string
  downloading: boolean
  downloaded: number
  total: number | null
  error: string | null
}

export function useUpdater() {
  const [update, setUpdate] = useState<UpdateState>({
    available: false,
    version: '',
    body: '',
    downloading: false,
    downloaded: 0,
    total: null,
    error: null,
  })

  const checkForUpdate = useCallback(async () => {
    try {
      const result = await check()
      if (result) {
        setUpdate(prev => ({
          ...prev,
          available: true,
          version: result.version,
          body: result.body ?? '',
        }))
      }
    }
    catch (err) {
      console.error('Failed to check for updates:', err)
    }
  }, [])

  const installUpdate = useCallback(async () => {
    if (!update.available)
      return
    setUpdate(prev => ({ ...prev, downloading: true, error: null }))
    try {
      const result = await check()
      if (!result)
        return
      await result.downloadAndInstall((progress) => {
        if (progress.event === 'Started' && progress.data.contentLength) {
          setUpdate(prev => ({ ...prev, total: progress.data.contentLength ?? null }))
        }
        else if (progress.event === 'Progress') {
          setUpdate(prev => ({ ...prev, downloaded: prev.downloaded + progress.data.chunkLength }))
        }
        else if (progress.event === 'Finished') {
          setUpdate(prev => ({ ...prev, downloading: false }))
        }
      })
      await relaunch()
    }
    catch (err) {
      setUpdate(prev => ({ ...prev, downloading: false, error: err instanceof Error ? err.message : String(err) }))
    }
  }, [update.available])

  const dismiss = useCallback(() => {
    setUpdate({ available: false, version: '', body: '', downloading: false, downloaded: 0, total: null, error: null })
  }, [])

  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 3000)
    return () => clearTimeout(timer)
  }, [checkForUpdate])

  return { update, installUpdate, dismiss, checkForUpdate }
}
