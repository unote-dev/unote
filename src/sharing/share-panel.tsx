import type { ShareInfo } from '@/sharing/desktop-share'
import { Check, Copy, LoaderCircle, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/locale'
import { cn } from '@/lib/utils'

function publicShareUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  }
  catch {
    return url.split(/[?#]/)[0]
  }
}

export function ShareManager({ className, copiedId, error, onClose, onCopy, onStop, onStopAll, pending, shares }: {
  className?: string
  copiedId: string | null
  error?: string | null
  onClose: () => void
  onCopy: (id: string) => void
  onStop: (id: string) => void
  onStopAll: () => void
  pending?: { name: string } | null
  shares: ShareInfo[]
}) {
  const { t } = useI18n()
  const empty = shares.length === 0 && !pending
  return (
    <div aria-labelledby="share-manager-title" className={cn('flex min-h-0 flex-col rounded-lg border bg-background shadow-lg', className)} role="dialog" onMouseDown={event => event.stopPropagation()}>
      <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold" id="share-manager-title">{t('shareManagerTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('shareManagerLead')}</p>
        </div>
        <Button aria-label={t('closeSharePanel')} className="-mr-2 -mt-1" onClick={onClose} size="icon" variant="ghost">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        {empty && (
          <div className="grid place-items-center gap-3 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Share2 className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('noActiveShares')}</p>
              <p className="text-sm text-muted-foreground">{t('noActiveSharesHint')}</p>
            </div>
          </div>
        )}
        {pending && (
          <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-3">
            <LoaderCircle className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{pending.name}</p>
              <p className="text-xs text-muted-foreground">{t('startingTunnel', { name: pending.name })}</p>
            </div>
          </div>
        )}
        {shares.length > 0 && (
          <ul className={cn('divide-y rounded-lg border', pending && 'mt-3')}>
            {shares.map(share => (
              <li className="space-y-3 p-4" key={share.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{share.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{share.path}</p>
                  </div>
                  <Button aria-label={t('stopShareNamed', { name: share.name })} className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onStop(share.id)} size="sm" variant="ghost">
                    {t('stop')}
                  </Button>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-muted/70 px-2 py-1.5">
                  <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={share.url}>{publicShareUrl(share.url)}</p>
                  <Button className="h-7 shrink-0 px-2" onClick={() => onCopy(share.id)} size="sm" variant="ghost">
                    {copiedId === share.id ? <Check /> : <Copy />}
                    {copiedId === share.id ? t('copied') : t('copyLink')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      </div>
      {shares.length > 0 && (
        <div className="flex shrink-0 justify-end border-t px-6 py-4">
          <Button disabled={Boolean(pending)} onClick={onStopAll} variant="outline">
            {t('stopAll')}
          </Button>
        </div>
      )}
    </div>
  )
}
