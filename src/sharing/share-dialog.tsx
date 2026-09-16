import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/locale'

interface ShareDialogProps {
  onClose: () => void
  onStart: () => void
}

export function ShareDialog({ onClose, onStart }: ShareDialogProps) {
  const { t } = useI18n()
  const [accepted, setAccepted] = useState(false)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={onClose}>
      <div aria-labelledby="share-title" className="w-full max-w-lg space-y-5 rounded-lg border bg-background p-6 shadow-lg" role="dialog" onMouseDown={event => event.stopPropagation()}>
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold" id="share-title">
            <Share2 className="size-5" />
            {t('shareRiskTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('shareRiskLead')}</p>
        </div>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t('shareRiskMeta')}</li>
          <li>{t('shareRiskSla')}</li>
          <li>{t('shareRiskNetwork')}</li>
          <li>{t('shareRiskDownload')}</li>
          <li>{t('shareRiskKey')}</li>
          <li>{t('shareRiskExpiry')}</li>
        </ul>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
          <input checked={accepted} className="mt-0.5 size-4 accent-primary" onChange={event => setAccepted(event.target.checked)} type="checkbox" />
          <span>{t('shareRiskAccept')}</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="outline">{t('cancel')}</Button>
          <Button disabled={!accepted} onClick={onStart}>{t('shareStart')}</Button>
        </div>
      </div>
    </div>
  )
}
