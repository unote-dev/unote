import { useEffect, useRef } from 'react'
import { useI18n } from '@/i18n/locale'

const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&themes=1&noExitBtn=1&saveAndExit=0'

interface DrawioMessage {
  event?: string
  xml?: string
}

export function DiagramEditor({ content, dark, onChange }: { content: string, dark: boolean, onChange: (content: string) => void }) {
  const { locale, t } = useI18n()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const contentRef = useRef(content)
  contentRef.current = content

  useEffect(() => {
    const receiveMessage = (event: MessageEvent) => {
      const frameWindow = frameRef.current?.contentWindow
      if (!frameWindow || event.source !== frameWindow)
        return

      let message: DrawioMessage
      try {
        message = typeof event.data === 'string' ? JSON.parse(event.data) as DrawioMessage : event.data as DrawioMessage
      }
      catch {
        return
      }

      if (message.event === 'init') {
        frameWindow.postMessage(JSON.stringify({
          action: 'load',
          autosave: 1,
          dark,
          noExitBtn: 1,
          saveAndExit: 0,
          xml: contentRef.current,
        }), '*')
      }
      else if ((message.event === 'autosave' || message.event === 'save') && typeof message.xml === 'string') {
        contentRef.current = message.xml
        onChange(message.xml)
      }
    }

    window.addEventListener('message', receiveMessage)
    return () => window.removeEventListener('message', receiveMessage)
  }, [dark, onChange])

  return (
    <iframe
      className="h-full min-h-[520px] w-full border-0 bg-background"
      ref={frameRef}
      src={`${DRAWIO_URL}&lang=${locale === 'zh' ? 'zh' : 'en'}`}
      title={t('diagramEditor')}
    />
  )
}
