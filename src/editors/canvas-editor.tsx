import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw'
import { useCallback, useRef } from 'react'
import { parseCanvasDocument } from '@/editors/canvas-document'
import { useI18n } from '@/i18n/locale'

import '@excalidraw/excalidraw/index.css'

export function CanvasEditor({ content, dark, onChange }: { content: string, dark: boolean, onChange: (content: string) => void }) {
  const { locale, t } = useI18n()
  const initializedRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const initialDataRef = useRef<React.ComponentProps<typeof Excalidraw>['initialData']>(null)
  const invalidContentRef = useRef(false)
  if (!initialDataRef.current && !invalidContentRef.current) {
    try {
      initialDataRef.current = parseCanvasDocument(content)
    }
    catch {
      invalidContentRef.current = true
    }
  }
  const handleChange = useCallback((elements: Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>['onChange']>>[0], appState: Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>['onChange']>>[1], files: Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>['onChange']>>[2]) => {
    if (!initializedRef.current) {
      initializedRef.current = true
      return
    }
    onChangeRef.current(serializeAsJSON(elements, appState, files, 'local'))
  }, [])
  if (invalidContentRef.current || !initialDataRef.current)
    return <div className="grid h-full place-items-center p-6 text-sm text-destructive">{t('invalidCanvas')}</div>
  return (
    <div className="h-full min-h-[520px]">
      <Excalidraw
        initialData={initialDataRef.current}
        langCode={locale === 'zh' ? 'zh-CN' : 'en'}
        onChange={handleChange}
        theme={dark ? 'dark' : 'light'}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </div>
  )
}
