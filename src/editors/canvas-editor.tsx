import { Excalidraw } from '@excalidraw/excalidraw'

import '@excalidraw/excalidraw/index.css'

export function CanvasEditor({ dark }: { dark: boolean }) {
  return <div className="h-full min-h-[520px]"><Excalidraw theme={dark ? 'dark' : 'light'} /></div>
}
