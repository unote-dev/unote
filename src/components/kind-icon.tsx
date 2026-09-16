import type { CreateKind } from '@/domain/workspace'
import { Brain, FileText, Folder, Network, Presentation } from 'lucide-react'

export function KindIcon({ className, kind }: { className?: string, kind: CreateKind }) {
  if (kind === 'canvas')
    return <Presentation className={className} />
  if (kind === 'mindmap')
    return <Brain className={className} />
  if (kind === 'diagram')
    return <Network className={className} />
  if (kind === 'folder')
    return <Folder className={className} />
  return <FileText className={className} />
}
