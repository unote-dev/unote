import type { DocumentKind } from '@/domain/workspace'

import { lazy, Suspense } from 'react'

const MarkdownEditor = lazy(() => import('@/editors/markdown-editor').then(module => ({ default: module.MarkdownEditor })))
const CanvasEditor = lazy(() => import('@/editors/canvas-editor').then(module => ({ default: module.CanvasEditor })))
const MindmapEditor = lazy(() => import('@/editors/mindmap-editor').then(module => ({ default: module.MindmapEditor })))

export function EditorSurface({ dark, kind }: { dark: boolean, kind: DocumentKind }) {
  const editor = kind === 'canvas'
    ? <CanvasEditor dark={dark} />
    : kind === 'mindmap'
      ? <MindmapEditor dark={dark} />
      : <MarkdownEditor dark={dark} />

  return <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">正在加载编辑器…</div>}>{editor}</Suspense>
}
