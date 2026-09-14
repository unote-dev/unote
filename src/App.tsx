import type { DocumentEntry, FolderEntry } from '@/domain/workspace'
import { Boxes, ChevronDown, Files, FileText, Folder, LogOut, Moon, Network, Plus, RefreshCw, Sun, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { LoginScreen } from '@/auth/login-screen'
import { useAuth } from '@/auth/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { flattenDocuments, isFolder } from '@/domain/workspace'
import { EditorSurface } from '@/editors/editor-surface'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/workspace/use-workspace'

function TreeNode({ entry, onSelect, selectedPath }: { entry: FolderEntry | DocumentEntry, onSelect: (path: string) => void, selectedPath: string | null }) {
  if (!isFolder(entry)) {
    const DocumentIcon = entry.kind === 'canvas' ? Boxes : entry.kind === 'mindmap' ? Network : FileText
    return (
      <Button className="h-8 w-full justify-start px-2 font-normal" onClick={() => onSelect(entry.path)} variant={selectedPath === entry.path ? 'secondary' : 'ghost'}>
        <DocumentIcon className="text-muted-foreground" />
        <span className="truncate">{entry.name}</span>
      </Button>
    )
  }
  return (
    <div>
      <div className="flex h-8 items-center gap-2 px-2 text-sm font-medium">
        <ChevronDown className="size-3.5 text-muted-foreground" />
        <Folder className="size-4 text-muted-foreground" />
        <span className="truncate">{entry.name}</span>
      </div>
      <div className="ml-4 border-l pl-1">{entry.children.map(child => <TreeNode entry={child} key={child.path} onSelect={onSelect} selectedPath={selectedPath} />)}</div>
    </div>
  )
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
  const auth = useAuth()
  const workspace = useWorkspace(Boolean(auth.snapshot?.session))
  const [dark, setDark] = useDarkMode()
  const documents = useMemo(() => flattenDocuments(workspace.snapshot?.roots ?? []), [workspace.snapshot?.roots])
  const selected = documents.find(document => document.path === workspace.snapshot?.selectedPath)
  if (auth.loading)
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">正在检查登录状态…</div>
  if (!auth.snapshot?.session)
    return <LoginScreen desktopAvailable={auth.desktopAvailable} error={auth.error} onLogin={() => void auth.login()} pending={auth.pending} />
  if (!workspace.snapshot)
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">正在读取本地仓库…</div>

  const session = auth.snapshot.session
  const syncLabel = auth.snapshot.syncStatus === 'syncing' ? '正在同步' : auth.snapshot.syncStatus === 'error' ? '同步失败' : auth.snapshot.syncStatus === 'synced' ? '已同步' : '本地已保存'
  const runSync = async () => {
    await workspace.flush()
    if (await auth.sync())
      await workspace.refresh()
  }
  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <a className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2" href="#editor">跳到编辑器</a>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={260} maxSize={420} minSize={190}>
          <aside className="flex h-full flex-col" aria-label="内容目录">
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
              <span className="truncate text-sm font-medium">{session.repo}</span>
              <Button aria-label="新建" size="icon" variant="ghost"><Plus /></Button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
              {workspace.snapshot.roots.length ? workspace.snapshot.roots.map(root => <TreeNode entry={root} key={root.path} onSelect={path => void workspace.selectDocument(path)} selectedPath={workspace.snapshot?.selectedPath ?? null} />) : <p className="px-2 py-6 text-center text-sm text-muted-foreground">仓库里还没有文档</p>}
              <Button className="mt-2 w-full justify-start px-2 font-normal" variant="secondary">
                <Files />
                全部
              </Button>
              <Button className="w-full justify-start px-2 font-normal text-muted-foreground" variant="ghost">
                <Trash2 />
                回收站
              </Button>
            </nav>
            <div className="flex h-14 shrink-0 items-center gap-2 border-t px-3">
              <Avatar>
                {session.avatarUrl && <AvatarImage alt={session.name || session.login} src={session.avatarUrl} />}
                <AvatarFallback>{session.login.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{session.name || session.login}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground" aria-live="polite" title={auth.error ?? auth.snapshot.errorMessage ?? syncLabel}>
                  <span className={cn('size-1.5 rounded-full', auth.snapshot.syncStatus === 'error' ? 'bg-destructive' : auth.snapshot.syncStatus === 'syncing' ? 'animate-pulse bg-muted-foreground' : 'bg-emerald-500')} />
                  {syncLabel}
                </p>
              </div>
              <Button aria-label="立即同步" disabled={auth.pending} onClick={() => void runSync()} size="icon" variant="ghost"><RefreshCw className={cn(auth.snapshot.syncStatus === 'syncing' && 'animate-spin')} /></Button>
              <Button aria-label={dark ? '切换到浅色模式' : '切换到深色模式'} onClick={() => setDark(value => !value)} size="icon" variant="ghost">{dark ? <Sun /> : <Moon />}</Button>
              <Button aria-label="退出登录" disabled={auth.pending} onClick={() => void auth.logout()} size="icon" variant="ghost"><LogOut /></Button>
            </div>
          </aside>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={420}>
          <main className="flex h-full min-w-0 flex-col bg-background" id="editor">
            {selected
              ? (
                  <>
                    <div className="flex h-12 shrink-0 items-center border-b px-5">
                      <div className="min-w-0">
                        <h1 className="truncate text-sm font-semibold">{selected.name}</h1>
                        <p className="truncate text-xs text-muted-foreground">{selected.path}</p>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto"><EditorSurface content={workspace.snapshot.selectedContent} dark={dark} key={selected.path} kind={selected.kind} onChange={workspace.updateDocument} /></div>
                  </>
                )
              : <div className="grid h-full place-items-center text-sm text-muted-foreground">从左侧选择一个文档</div>}
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
