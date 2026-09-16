import type { CreateKind } from '@/domain/workspace'
import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CreateMenu } from '@/components/create-menu'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/locale'
import { describeSyncTime } from '@/lib/sync-time'
import { cn } from '@/lib/utils'

export function SidebarHeader({ lastSyncAt, onCreate, onSync, pending, showCreate, syncError, syncLabel, syncStatus }: {
  lastSyncAt: number | null
  onCreate: (kind: CreateKind) => void
  onSync: () => void
  pending: boolean
  showCreate: boolean
  syncError: string | null
  syncLabel: string
  syncStatus: string
}) {
  const { locale, t } = useI18n()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const elapsed = lastSyncAt == null ? null : describeSyncTime(lastSyncAt, now, locale)
  const elapsedLabel = elapsed == null
    ? null
    : elapsed.kind === 'justNow'
      ? t('justNow')
      : elapsed.kind === 'minutes'
        ? t('minutesAgo', { count: elapsed.count })
        : elapsed.kind === 'hours'
          ? t('hoursAgo', { count: elapsed.count })
          : elapsed.value
  const syncing = syncStatus === 'syncing' || pending

  return (
    <div className="relative flex min-h-12 shrink-0 items-center gap-1 border-b px-2 py-1.5">
      <div className="min-w-0 flex-1 px-1" title={syncError ?? undefined}>
        <p aria-live="polite" className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className={cn('size-1.5 shrink-0 rounded-full', syncStatus === 'error' ? 'bg-destructive' : syncing ? 'animate-pulse bg-muted-foreground' : 'bg-emerald-500')} />
          {syncLabel}
        </p>
        <p className="truncate text-xs text-muted-foreground">{elapsedLabel ? t('lastSync', { time: elapsedLabel }) : t('neverSynced')}</p>
      </div>
      <Button aria-label={t('syncNow')} className="size-8" disabled={syncing} onClick={onSync} size="icon" variant="ghost">
        <RefreshCw className={cn(syncing && 'animate-spin')} />
      </Button>
      {showCreate && <CreateMenu onSelect={onCreate} />}
    </div>
  )
}
