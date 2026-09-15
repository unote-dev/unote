import type { FormEvent } from 'react'
import type { CreateKind, DocumentEntry, FolderEntry } from '@/domain/workspace'
import { Boxes, ChevronDown, Files, FileText, Folder, LogOut, Moon, Network, Plus, RefreshCw, Sun, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { LoginScreen } from '@/auth/login-screen'
import { useAuth } from '@/auth/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { UpdateDialog } from '@/components/update-dialog'
import { flattenDocuments, isFolder } from '@/domain/workspace'
import { EditorSurface } from '@/editors/editor-surface'
import { useUpdater } from '@/hooks/use-updater'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/workspace/use-workspace'

function TreeNode({ entry, expandedPaths, onFolderSelect, onToggle, onSelect, selectedDirectory, selectedPath }: { entry: FolderEntry | DocumentEntry, expandedPaths: Set<string>, onFolderSelect: (path: string) => void, onToggle: (path: string) => void, onSelect: (path: string) => void, selectedDirectory: string, selectedPath: string | null }) {
  if (!isFolder(entry)) {
    const DocumentIcon = entry.kind === 'canvas' ? Boxes : entry.kind === 'mindmap' ? Network : FileText
    return (
      <Button className="h-8 w-full justify-start px-2 font-normal" onClick={() => onSelect(entry.path)} variant={selectedPath === entry.path ? 'secondary' : 'ghost'}>
        <DocumentIcon className="text-muted-foreground" />
        <span className="truncate">{entry.name}</span>
      </Button>
    )
  }
  const expanded = expandedPaths.has(entry.path)
  return (
    <div>
      <Button className="h-8 w-full justify-start px-2 font-medium" onClick={() => { onToggle(entry.path); onFolderSelect(entry.path) }} variant={selectedDirectory === entry.path ? 'secondary' : 'ghost'}>
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', !expanded && '-rotate-90')} />
        <Folder className="size-4 text-muted-foreground" />
        <span className="truncate">{entry.name}</span>
      </Button>
      {expanded && <div className="ml-4 border-l pl-1">{entry.children.map(child => <TreeNode entry={child} expandedPaths={expandedPaths} key={child.path} onFolderSelect={onFolderSelect} onSelect={onSelect} onToggle={onToggle} selectedDirectory={selectedDirectory} selectedPath={selectedPath} />)}</div>}
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
  const updater = useUpdater()
  const workspace = useWorkspace(Boolean(auth.snapshot?.session))
  const [dark, setDark] = useDarkMode()
  const [createKind, setCreateKind] = useState<CreateKind | null>(null)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedDirectory, setSelectedDirectory] = useState('')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const toggleExpand = (path: string) => setExpandedPaths((prev) => {
    const next = new Set(prev)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    return next
  })
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
  const beginCreate = (kind: CreateKind) => {
    setCreateMenuOpen(false)
    setCreateKind(kind)
    setCreateName('')
    setCreateError(null)
  }
  const submitCreate = async () => {
    if (!createKind)
      return
    setCreating(true)
    setCreateError(null)
    try {
      await workspace.createContent(selectedDirectory, createName, createKind)
      setCreateKind(null)
    }
    catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : String(cause))
    }
    finally {
      setCreating(false)
    }
  }
  const selectDocument = (path: string) => {
    void workspace.selectDocument(path)
  }
  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitCreate()
  }
  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <a className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2" href="#editor">跳到编辑器</a>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={260} maxSize={420} minSize={190}>
          <aside className="flex h-full flex-col" aria-label="内容目录">
            <div className="relative flex h-12 shrink-0 items-center justify-between border-b px-3">
              <span className="truncate text-sm font-medium">UNote <span className="text-xs font-normal text-muted-foreground">· {session.host === 'gitee' ? 'Gitee' : session.host === 'github' ? 'GitHub' : session.host === 'gitlab' ? 'GitLab' : session.host}</span></span>
              <Button aria-expanded={createMenuOpen} aria-haspopup="menu" aria-label="新建" onClick={() => setCreateMenuOpen(open => !open)} size="icon" variant="ghost"><Plus /></Button>
              {createMenuOpen && (
                <div className="absolute right-2 top-10 z-30 w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md" role="menu">
                  <Button className="w-full justify-start font-normal" onClick={() => beginCreate('markdown')} role="menuitem" variant="ghost">
                    <FileText />
                    笔记
                  </Button>
                  <Button className="w-full justify-start font-normal" onClick={() => beginCreate('canvas')} role="menuitem" variant="ghost">
                    <Boxes />
                    画布
                  </Button>
                  <Button className="w-full justify-start font-normal" onClick={() => beginCreate('mindmap')} role="menuitem" variant="ghost">
                    <Network />
                    脑图
                  </Button>
                  <div className="-mx-1 my-1 h-px bg-border" role="separator" />
                  <Button className="w-full justify-start font-normal" onClick={() => beginCreate('folder')} role="menuitem" variant="ghost">
                    <Folder />
                    文件夹
                  </Button>
                </div>
              )}
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
              <Button className="w-full justify-start px-2 font-normal" onClick={() => setSelectedDirectory('')} variant={selectedDirectory === '' ? 'secondary' : 'ghost'}>
                <Files />
                全部
              </Button>
              <Button className="w-full justify-start px-2 font-normal text-muted-foreground" variant="ghost">
                <Trash2 />
                回收站
              </Button>
              <div className="mt-2 space-y-1 border-t pt-2">
                {workspace.snapshot.roots.length
                  ? workspace.snapshot.roots.map(root => <TreeNode entry={root} expandedPaths={expandedPaths} key={root.path} onFolderSelect={setSelectedDirectory} onSelect={selectDocument} onToggle={toggleExpand} selectedDirectory={selectedDirectory} selectedPath={workspace.snapshot?.selectedPath ?? null} />)
                  : <p className="px-2 py-6 text-center text-sm text-muted-foreground">仓库里还没有文档</p>}
              </div>
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
                    <div className="min-h-0 flex-1 overflow-auto"><EditorSurface content={workspace.snapshot.selectedContent} dark={dark} documentPath={selected.path} key={selected.path} kind={selected.kind} onChange={workspace.updateDocument} /></div>
                  </>
                )
              : <div className="grid h-full place-items-center text-sm text-muted-foreground">从左侧选择一个文档</div>}
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
      {createKind && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={() => !creating && setCreateKind(null)}>
          <form className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-lg" onMouseDown={event => event.stopPropagation()} onSubmit={handleCreateSubmit}>
            <div>
              <h2 className="text-lg font-semibold">
                新建
                {createKind === 'folder' ? '文件夹' : createKind === 'markdown' ? '笔记' : createKind === 'canvas' ? '画布' : '脑图'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                位置：
                {selectedDirectory || '仓库根目录'}
              </p>
            </div>
            <Input autoFocus disabled={creating} onChange={event => setCreateName(event.target.value)} placeholder="输入名称" value={createName} />
            {createError && <p className="text-sm text-destructive" role="alert">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button disabled={creating} onClick={() => setCreateKind(null)} type="button" variant="outline">取消</Button>
              <Button disabled={creating || !createName} type="submit">{creating ? '正在创建…' : '创建'}</Button>
            </div>
          </form>
        </div>
      )}
      {updater.update.available && (
        <UpdateDialog
          body={updater.update.body}
          downloaded={updater.update.downloaded}
          downloading={updater.update.downloading}
          error={updater.update.error}
          onDismiss={updater.dismiss}
          onInstall={updater.installUpdate}
          total={updater.update.total}
          version={updater.update.version}
        />
      )}
    </div>
  )
}
