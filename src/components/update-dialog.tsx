import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/locale'

interface UpdateDialogProps {
  version: string
  body: string
  downloading: boolean
  downloaded: number
  total: number | null
  error: string | null
  onInstall: () => void
  onDismiss: () => void
}

export function UpdateDialog({ version, body, downloading, downloaded, total, error, onInstall, onDismiss }: UpdateDialogProps) {
  const { t } = useI18n()
  const progress = total ? Math.round((downloaded / total) * 100) : 0
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-lg">
        <div>
          <h2 className="text-lg font-semibold">{t('updateTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            unote v
            {version}
          </p>
        </div>
        {body && (
          <p className="max-h-40 overflow-auto text-sm text-muted-foreground whitespace-pre-wrap">{body}</p>
        )}
        {downloading && (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{total ? `${progress}%` : t('downloading')}</p>
          </div>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          {!downloading && (
            <>
              <Button onClick={onDismiss} type="button" variant="outline">{t('later')}</Button>
              <Button onClick={onInstall} type="button">{t('updateNow')}</Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
