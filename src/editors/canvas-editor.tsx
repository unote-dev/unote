import { Excalidraw } from '@excalidraw/excalidraw'
import { useRef } from 'react'

import '@excalidraw/excalidraw/index.css'

export function CanvasEditor({ content, dark, onChange }: { content: string, dark: boolean, onChange: (content: string) => void }) {
  const initializedRef = useRef(false)
  let initialData
  try {
    initialData = JSON.parse(content)
  }
  catch {
    return <div className="grid h-full place-items-center p-6 text-sm text-destructive">画布文件格式无效。为保护原文件，当前禁止编辑。</div>
  }
  return (
    <div className="h-full min-h-[520px]">
      <Excalidraw
        initialData={initialData}
        onChange={(elements, appState, files) => {
          if (!initializedRef.current) {
            initializedRef.current = true
            return
          }
          onChange(JSON.stringify({ appState, elements, files, source: 'unote', type: 'excalidraw', version: 2 }))
        }}
        theme={dark ? 'dark' : 'light'}
      />
    </div>
  )
}
