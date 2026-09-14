import type { DocumentEntry, FolderEntry } from '@/domain/workspace'
import { ChevronRight, FilePenLine, Folder, GitBranch, Menu, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { flattenDocuments, isFolder } from '@/domain/workspace'
import { EditorSurface } from '@/editors/editor-surface'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/workspace/use-workspace'

function TreeNode({ entry, onSelect, selectedPath }: { entry: FolderEntry | DocumentEntry, onSelect: (path: string) => void, selectedPath: string | null }) {
  if (!isFolder(entry)) {
    return (
      <button
        className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring', selectedPath === entry.path && 'bg-accent text-accent-foreground')}
        onClick={() => onSelect(entry.path)}
        type="button"
      >
        <FilePenLine className="size-4 text-muted-foreground" />
        <span className="truncate">{entry.name}</span>
      </button>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1 px-1 py-1 text-sm font-medium">
        <ChevronRight className="size-3.5" />
        <Folder className="size-4 text-primary" />
        <span>{entry.name}</span>
      </div>
      <div className="ml-3 border-l pl-2">{entry.children.map(child => <TreeNode entry={child} key={child.path} onSelect={onSelect} selectedPath={selectedPath} />)}</div>
    </div>
  )
}

function kindLabel(kind: DocumentEntry['kind']) {
  return { markdown: 'Markdown', canvas: '画布', mindmap: '脑图' }[kind]
}

export function App() {
  const { snapshot, selectDocument, sync } = useWorkspace()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const documents = useMemo(() => flattenDocuments(snapshot?.roots ?? []), [snapshot])
  const selected = documents.find(document => document.path === snapshot?.selectedPath) ?? documents[0]

  if (!snapshot || !selected)
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">正在打开笔记库…</div>

  return (
    <div className="h-screen overflow-hidden bg-background">
      <a className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-card focus:px-4 focus:py-2" href="#editor">跳到编辑器</a>
      <header className="flex h-12 items-center justify-between border-b bg-card px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button aria-label="打开文件夹导航" className="md:hidden" onClick={() => setSidebarOpen(value => !value)} size="icon" variant="ghost"><Menu /></Button>
          <div className="grid size-7 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">u</div>
          <span className="truncate text-sm font-semibold">{snapshot.libraryName}</span>
        </div>
        <div className="flex items-center gap-2" aria-live="polite">
          <span className="hidden text-xs text-muted-foreground sm:inline">{snapshot.sync === 'synced' ? '已同步' : snapshot.sync}</span>
          <Button onClick={() => void sync()} size="sm" variant="outline">
            <RefreshCw />
            同步
          </Button>
        </div>
      </header>

      <div className="grid h-[calc(100vh-3rem)] md:grid-cols-[240px_280px_minmax(0,1fr)]">
        <aside className={cn('absolute inset-y-12 left-0 z-30 w-64 border-r bg-card p-3 shadow-xl md:static md:block md:w-auto md:shadow-none', !sidebarOpen && 'hidden')} aria-label="文件夹导航">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">文件</span>
            <Button aria-label="新建文件夹" size="icon" variant="ghost"><Plus /></Button>
          </div>
          <nav className="space-y-1">
            {snapshot.roots.map(root => (
              <TreeNode
                entry={root}
                key={root.path}
                onSelect={(path) => {
                  void selectDocument(path)
                  setSidebarOpen(false)
                }}
                selectedPath={snapshot.selectedPath}
              />
            ))}
          </nav>
          <div className="mt-4 border-t pt-3">
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent" type="button">
              <Trash2 className="size-4" />
              回收站
            </button>
          </div>
        </aside>

        <section className="hidden border-r bg-secondary/35 p-3 sm:block" aria-label="文档列表">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 flex-1 items-center gap-2 rounded-md border bg-card px-3">
              <Search className="size-4 text-muted-foreground" />
              <input aria-label="搜索当前文件夹" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="搜索文档" />
            </div>
            <Button aria-label="新建文档" size="icon"><Plus /></Button>
          </div>
          <div className="space-y-1">
            {documents.map(document => (
              <button className={cn('w-full rounded-lg px-3 py-2.5 text-left outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring', selected.path === document.path && 'bg-card shadow-sm')} key={document.path} onClick={() => void selectDocument(document.path)} type="button">
                <div className="truncate text-sm font-medium">{document.name}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{kindLabel(document.kind)}</span>
                  <span>刚刚</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <main className="flex min-w-0 flex-col bg-card" id="editor">
          <div className="flex h-12 items-center justify-between border-b px-4">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{selected.name}</h1>
              <p className="truncate text-xs text-muted-foreground">{selected.path}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="size-4" />
              <span className="hidden sm:inline">本地已保存</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto"><EditorSurface kind={selected.kind} /></div>
        </main>
      </div>
    </div>
  )
}
