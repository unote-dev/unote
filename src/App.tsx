import type { DocumentEntry, FolderEntry } from '@/domain/workspace'
import { ChevronRight, FilePenLine, Folder, GitBranch, LogOut, Moon, Plus, RefreshCw, Search, Sun, Trash2 } from 'lucide-react'

import { useEffect, useMemo, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { flattenDocuments, isFolder } from '@/domain/workspace'
import { EditorSurface } from '@/editors/editor-surface'
import { useWorkspace } from '@/workspace/use-workspace'

function TreeNode({ entry, onSelect, selectedPath }: { entry: FolderEntry | DocumentEntry, onSelect: (path: string) => void, selectedPath: string | null }) {
  if (!isFolder(entry)) {
    return (
      <Button className="h-8 w-full justify-start px-2 font-normal" onClick={() => onSelect(entry.path)} variant={selectedPath === entry.path ? 'secondary' : 'ghost'}>
        <FilePenLine className="text-muted-foreground" />
        <span className="truncate">{entry.name}</span>
      </Button>
    )
  }

  return (
    <div>
      <div className="flex h-8 items-center gap-2 px-2 text-sm font-medium">
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <Folder className="size-4 text-muted-foreground" />
        <span className="truncate">{entry.name}</span>
      </div>
      <div className="ml-4 border-l pl-1">
        {entry.children.map(child => <TreeNode entry={child} key={child.path} onSelect={onSelect} selectedPath={selectedPath} />)}
      </div>
    </div>
  )
}

function kindLabel(kind: DocumentEntry['kind']) {
  return { markdown: 'Markdown', canvas: '画布', mindmap: '脑图' }[kind]
}

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && matchMedia('(prefers-color-scheme: dark)').matches))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, setDark] as const
}

export function App() {
  const { snapshot, selectDocument, sync } = useWorkspace()
  const [dark, setDark] = useDarkMode()
  const documents = useMemo(() => flattenDocuments(snapshot?.roots ?? []), [snapshot])
  const selected = documents.find(document => document.path === snapshot?.selectedPath) ?? documents[0]

  if (!snapshot || !selected)
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">正在打开笔记库…</div>

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <a className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2" href="#editor">跳到编辑器</a>

      <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <span className="text-sm font-semibold">Unote</span>
        <div className="flex items-center gap-2" aria-live="polite">
          <span className="text-xs text-muted-foreground">{snapshot.sync === 'synced' ? '已同步' : snapshot.sync}</span>
          <Button onClick={() => void sync()} size="sm" variant="outline">
            <RefreshCw />
            同步
          </Button>
        </div>
      </header>

      <ResizablePanelGroup className="min-h-0 flex-1" orientation="horizontal">
        <ResizablePanel defaultSize={240} minSize={190}>
          <aside className="flex h-full flex-col" aria-label="文件夹导航">
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
              <span className="text-sm font-medium">文件</span>
              <Button aria-label="新建文件夹" size="icon" variant="ghost"><Plus /></Button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
              {snapshot.roots.map(root => <TreeNode entry={root} key={root.path} onSelect={path => void selectDocument(path)} selectedPath={snapshot.selectedPath} />)}
              <Button className="mt-2 w-full justify-start px-2 font-normal text-muted-foreground" variant="ghost">
                <Trash2 />
                回收站
              </Button>
            </nav>
            <div className="flex h-14 shrink-0 items-center gap-2 border-t px-3">
              <Avatar>
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">lin</p>
                <p className="truncate text-xs text-muted-foreground">Gitee</p>
              </div>
              <Button aria-label={dark ? '切换到浅色模式' : '切换到深色模式'} onClick={() => setDark(value => !value)} size="icon" variant="ghost">
                {dark ? <Sun /> : <Moon />}
              </Button>
              <Button aria-label="退出登录" size="icon" variant="ghost"><LogOut /></Button>
            </div>
          </aside>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={280} minSize={220}>
          <section className="flex h-full flex-col bg-muted/30" aria-label="文档列表">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b p-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="搜索当前文件夹" className="pl-8" placeholder="搜索文档" />
              </div>
              <Button aria-label="新建文档" size="icon"><Plus /></Button>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
              {documents.map(document => (
                <Button className="h-auto w-full justify-start px-3 py-2 text-left" key={document.path} onClick={() => void selectDocument(document.path)} variant={selected.path === document.path ? 'secondary' : 'ghost'}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{document.name}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{kindLabel(document.kind)}</span>
                  </span>
                </Button>
              ))}
            </div>
          </section>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel minSize={360}>
          <main className="flex h-full min-w-0 flex-col bg-background" id="editor">
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold">{selected.name}</h1>
                <p className="truncate text-xs text-muted-foreground">{selected.path}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GitBranch className="size-4" />
                <span>本地已保存</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto"><EditorSurface dark={dark} kind={selected.kind} /></div>
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
