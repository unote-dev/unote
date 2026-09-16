import type { CreateKind } from '@/domain/workspace'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { KindIcon } from '@/components/kind-icon'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/locale'

export function CreateMenu({ onSelect }: { onSelect: (kind: CreateKind) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open)
      return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target))
        setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const select = (kind: CreateKind) => {
    setOpen(false)
    onSelect(kind)
  }

  return (
    <div ref={rootRef}>
      <Button aria-expanded={open} aria-haspopup="menu" aria-label={t('new')} className="size-8" onClick={() => setOpen(value => !value)} size="icon" variant="ghost">
        <Plus />
      </Button>
      {open && (
        <div className="absolute right-2 top-full z-30 mt-1 w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md" role="menu">
          <Button className="w-full justify-start font-normal" onClick={() => select('markdown')} role="menuitem" variant="ghost">
            <KindIcon kind="markdown" />
            {t('kindNote')}
          </Button>
          <Button className="w-full justify-start font-normal" onClick={() => select('canvas')} role="menuitem" variant="ghost">
            <KindIcon kind="canvas" />
            {t('kindCanvas')}
          </Button>
          <Button className="w-full justify-start font-normal" onClick={() => select('mindmap')} role="menuitem" variant="ghost">
            <KindIcon kind="mindmap" />
            {t('kindMindmap')}
          </Button>
          <Button className="w-full justify-start font-normal" onClick={() => select('diagram')} role="menuitem" variant="ghost">
            <KindIcon kind="diagram" />
            {t('kindDiagram')}
          </Button>
          <div className="-mx-1 my-1 h-px bg-border" role="separator" />
          <Button className="w-full justify-start font-normal" onClick={() => select('folder')} role="menuitem" variant="ghost">
            <KindIcon kind="folder" />
            {t('kindFolder')}
          </Button>
        </div>
      )}
    </div>
  )
}
