import type { DocumentKind } from '@/domain/workspace'

import { lazy, Suspense } from 'react'
import { useI18n } from '@/i18n/locale'

const MarkdownEditor = lazy(() => import('@/editors/markdown-editor').then(module => ({ default: module.MarkdownEditor })))
const CanvasEditor = lazy(() => import('@/editors/canvas-editor').then(module => ({ default: module.CanvasEditor })))
const MindmapEditor = lazy(() => import('@/editors/mindmap-editor').then(module => ({ default: module.MindmapEditor })))
const DiagramEditor = lazy(() => import('@/editors/diagram-editor').then(module => ({ default: module.DiagramEditor })))

export function EditorSurface({ content, dark, documentPath, kind, onChange }: { content: string, dark: boolean, documentPath: string, kind: DocumentKind, onChange: (content: string) => void }) {
  const { t } = useI18n()
  const editor = kind === 'canvas'
    ? <CanvasEditor content={content} dark={dark} onChange={onChange} />
    : kind === 'mindmap'
      ? <MindmapEditor content={content} dark={dark} onChange={onChange} />
      : kind === 'diagram'
        ? <DiagramEditor key={documentPath} content={content} dark={dark} onChange={onChange} />
        : <MarkdownEditor dark={dark} documentPath={documentPath} markdown={content} onChange={onChange} />

  return <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">{t('loadingEditor')}</div>}>{editor}</Suspense>
}
