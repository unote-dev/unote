import type { Editor } from '@tiptap/core'
import { convertFileSrc } from '@tauri-apps/api/core'
import { saveImage } from '../api/unote'

export function useImagePaste() {
  function handlePaste(event: ClipboardEvent, editor: Editor) {
    const items = event.clipboardData?.items
    console.log('[paste] items:', items?.length, 'types:', [...(items || [])].map(i => i.type))

    if (!items)
      return false

    for (const item of items) {
      if (!item.type.startsWith('image/')) {
        console.log('[paste] skipping non-image:', item.type)
        continue
      }

      const file = item.getAsFile()
      if (!file)
        continue

      event.preventDefault()
      console.log('[paste] image detected, reading...')

      const ed = editor
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string
        console.log('[paste] read complete, base64 length:', base64.length)
        const ext = file.type.split('/')[1] || 'png'
        const filename = `clipboard.${ext}`

        try {
          console.log('[paste] saving image...')
          const absolutePath = await saveImage(base64, filename)
          console.log('[paste] saved to:', absolutePath)
          const src = convertFileSrc(absolutePath)
          console.log('[paste] asset URL:', src)
          ed.chain().focus().setImage({ src }).run()
          console.log('[paste] inserted!')
        }
        catch (e) {
          console.error('[paste] save failed:', e)
          ed.chain().focus().setImage({ src: base64 }).run()
        }
      }
      reader.readAsDataURL(file)

      return true
    }

    console.log('[paste] no image found in clipboard')
    return false
  }

  return { handlePaste }
}
