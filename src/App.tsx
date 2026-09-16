import type { FormEvent } from 'react'
import type { CreateKind, DocumentEntry, FolderEntry } from '@/domain/workspace'
import type { ShareInfo } from '@/sharing/desktop-share'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ChevronDown, Files, Folder, Share2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LoginScreen } from '@/auth/login-screen'
import { useAuth } from '@/auth/use-auth'
import { appWindowTitle } from '@/auth/window-title'
import { AccountMenu } from '@/components/account-menu'
import { KindIcon } from '@/components/kind-icon'
import { SidebarHeader } from '@/components/sidebar-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { UpdateDialog } from '@/components/update-dialog'
import { treeEntryVariant } from '@/domain/sidebar-tree'
import { flattenDocuments, isFolder } from '@/domain/workspace'
import { EditorSurface } from '@/editors/editor-surface'
import { useUpdater } from '@/hooks/use-updater'
import { useI18n } from '@/i18n/locale'
import { cn } from '@/lib/utils'
import { listShares, startShare, stopAllShares, stopShare } from '@/sharing/desktop-share'
import { ShareDialog } from '@/sharing/share-dialog'
import { ShareManager } from '@/sharing/share-panel'
import { useWorkspace } from '@/workspace/use-workspace'

function TreeNode({ entry, expandedPaths, onFolderSelect, onToggle, onSelect, onTrash, selectedPath }: { entry: FolderEntry | DocumentEntry, expandedPaths: Set<string>, onFolderSelect: (path: string) => void, onToggle: (path: string) => void, onSelect: (path: string) => void, onTrash?: (entry: FolderEntry | DocumentEntry) => void, selectedPath: string | null }) {
  const { t } = useI18n()
  if (!isFolder(entry)) {
    return (
      <div className="group flex items-center gap-0.5">
        <Button className="h-8 min-w-0 flex-1 justify-start px-2 font-normal" onClick={() => onSelect(entry.path)} variant={treeEntryVariant(entry, selectedPath)}>
          <KindIcon className="text-muted-foreground" kind={entry.kind} />
          <span className="truncate">{entry.name}</span>
        </Button>
        {onTrash && <Button aria-label={t('deleteNamed', { name: entry.name })} className="size-8 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => onTrash(entry)} size="icon" title={t('moveToTrash')} variant="ghost"><Trash2 /></Button>}
      </div>
    )
  }
  const expanded = expandedPaths.has(entry.path)
  const selectFolder = () => {
    onToggle(entry.path)
    onFolderSelect(entry.path)
  }
  return (
    <div>
      <div className="group flex items-center gap-0.5">
        <Button className="h-8 min-w-0 flex-1 justify-start px-2 font-medium" onClick={selectFolder} variant={treeEntryVariant(entry, selectedPath)}>
          <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', !expanded && '-rotate-90')} />
          <Folder className="size-4 text-muted-foreground" />
          <span className="truncate">{entry.name}</span>
        </Button>
        {onTrash && <Button aria-label={t('deleteNamed', { name: entry.name })} className="size-8 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => onTrash(entry)} size="icon" title={t('moveToTrash')} variant="ghost"><Trash2 /></Button>}
      </div>
      {expanded && <div className="ml-4 border-l pl-1">{entry.children.map(child => <TreeNode entry={child} expandedPaths={expandedPaths} key={child.path} onFolderSelect={onFolderSelect} onSelect={onSelect} onToggle={onToggle} onTrash={onTrash} selectedPath={selectedPath} />)}</div>}
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
  const { t } = useI18n()
  const auth = useAuth()
  const updater = useUpdater()
  const workspace = useWorkspace(Boolean(auth.snapshot?.session))
  const [dark, setDark] = useDarkMode()
  const [createKind, setCreateKind] = useState<CreateKind | null>(null)
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<FolderEntry | DocumentEntry | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [view, setView] = useState<'all' | 'trash'>('all')
  const [shareOpen, setShareOpen] = useState(false)
  const [sharesOpen, setSharesOpen] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shares, setShares] = useState<ShareInfo[]>([])
  const [pendingShare, setPendingShare] = useState<{ name: string, path: string } | null>(null)
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null)
  const startingShareRef = useRef(false)
  const [selectedDirectory, setSelectedDirectory] = useState('')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set())
  const host = auth.snapshot?.session?.host ?? null
  useEffect(() => {
    const title = appWindowTitle(host)
    document.title = title
    if (!isTauri())
      return
    void getCurrentWindow().setTitle(title).catch(() => undefined)
  }, [host])
  const toggleExpand = (path: string) => setExpandedPaths((prev) => {
    const next = new Set(prev)
    if (next.has(path))
      next.delete(path)
    else
      next.add(path)
    return next
  })
  useEffect(() => {
    if (!auth.snapshot?.session)
      return
    void listShares().then(setShares).catch(() => setShares([]))
  }, [auth.snapshot?.session])
  const visibleRoots = useMemo(() => view === 'trash' ? workspace.trashRoots : workspace.snapshot?.roots ?? [], [view, workspace.snapshot?.roots, workspace.trashRoots])
  const documents = useMemo(() => flattenDocuments(visibleRoots), [visibleRoots])
  const selected = documents.find(document => document.path === workspace.snapshot?.selectedPath)
  const shareCount = shares.length + (pendingShare ? 1 : 0)
  if (auth.loading)
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">{t('checkingSession')}</div>
  if (!auth.snapshot?.session)
    return <LoginScreen desktopAvailable={auth.desktopAvailable} error={auth.desktopAvailable ? auth.error : t('loginDesktopOnly')} onLogin={() => void auth.login()} pending={auth.pending} />
  if (!workspace.snapshot)
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">{t('readingWorkspace')}</div>

  const session = auth.snapshot.session
  const syncLabel = auth.snapshot.syncStatus === 'syncing' ? t('syncing') : auth.snapshot.syncStatus === 'error' ? t('syncFailed') : auth.snapshot.syncStatus === 'synced' ? t('synced') : t('savedLocally')
  const kindTitle = createKind === 'folder' ? t('kindFolder') : createKind === 'markdown' ? t('kindNote') : createKind === 'canvas' ? t('kindCanvas') : createKind === 'mindmap' ? t('kindMindmap') : t('kindDiagram')
  const runSync = async () => {
    await workspace.flush()
    if (await auth.sync())
      await workspace.refresh()
  }
  const beginCreate = (kind: CreateKind) => {
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
  const showAll = () => {
    setSharesOpen(false)
    setView('all')
    setSelectedDirectory('')
  }
  const showTrash = () => {
    setSharesOpen(false)
    setView('trash')
    setSelectedDirectory('')
    void workspace.loadTrash()
  }
  const openShareManager = () => {
    if (sharesOpen) {
      setSharesOpen(false)
      return
    }
    setShareError(null)
    setCopiedShareId(null)
    setSharesOpen(true)
    void listShares().then(setShares).catch(() => setShares([]))
  }
  const requestDelete = (entry: FolderEntry | DocumentEntry) => {
    setDeleteError(null)
    setPendingDelete(entry)
  }
  const confirmDelete = async () => {
    if (!pendingDelete)
      return
    setDeleting(true)
    setDeleteError(null)
    try {
      await workspace.trashContent(pendingDelete.path)
      setPendingDelete(null)
    }
    catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : String(cause))
    }
    finally {
      setDeleting(false)
    }
  }
  const openShare = () => {
    if (!selected || selected.kind !== 'markdown' || pendingShare)
      return
    const existing = shares.find(share => share.path === selected.path)
    if (existing) {
      setCopiedShareId(null)
      setShareError(null)
      setSharesOpen(true)
      return
    }
    setShareError(null)
    setShareOpen(true)
  }
  const startCurrentShare = async () => {
    if (!selected || selected.kind !== 'markdown' || pendingShare || startingShareRef.current)
      return
    const name = selected.name
    const path = selected.path
    startingShareRef.current = true
    setShareOpen(false)
    setShareError(null)
    setCopiedShareId(null)
    setPendingShare({ name, path })
    setSharesOpen(true)
    try {
      await workspace.flush()
      const result = await startShare(path)
      const next = await listShares().catch(() => [result])
      setShares(next)
      setCopiedShareId(result.id)
      await navigator.clipboard.writeText(result.url).catch(() => undefined)
    }
    catch (cause) {
      setShareError(cause instanceof Error ? cause.message : String(cause))
    }
    finally {
      startingShareRef.current = false
      setPendingShare(null)
    }
  }
  const stopCurrentShare = async (id: string) => {
    const next = await stopShare(id)
    setShares(next)
    setCopiedShareId(current => current === id ? null : current)
    setShareError(null)
  }
  const stopEveryShare = async () => {
    const next = await stopAllShares()
    setShares(next)
    setCopiedShareId(null)
    setShareError(null)
  }
  const copyShare = async (id: string) => {
    const share = shares.find(item => item.id === id)
    if (!share)
      return
    await navigator.clipboard.writeText(share.url)
    setCopiedShareId(id)
  }
  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitCreate()
  }
  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <a className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2" href="#editor">{t('skipToEditor')}</a>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={260} maxSize={420} minSize={190}>
          <aside className="flex h-full flex-col" aria-label={t('contents')}>
            <SidebarHeader
              lastSyncAt={auth.snapshot.lastSyncAt}
              onCreate={beginCreate}
              onSync={() => void runSync()}
              pending={auth.pending}
              showCreate={view === 'all'}
              syncError={auth.error ?? auth.snapshot.errorMessage}
              syncLabel={syncLabel}
              syncStatus={auth.snapshot.syncStatus}
            />
            <nav className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
              {visibleRoots.length
                ? visibleRoots.map(root => <TreeNode entry={root} expandedPaths={expandedPaths} key={root.path} onFolderSelect={setSelectedDirectory} onSelect={selectDocument} onToggle={toggleExpand} onTrash={view === 'all' ? requestDelete : undefined} selectedPath={workspace.snapshot?.selectedPath ?? null} />)
                : <p className="px-2 py-6 text-center text-sm text-muted-foreground">{view === 'trash' ? t('trashEmpty') : t('noDocuments')}</p>}
            </nav>
            <nav aria-label={t('library')} className="shrink-0 space-y-0.5 border-t p-2">
              <Button className="h-8 w-full justify-start px-2 font-normal" onClick={showAll} variant={view === 'all' ? 'secondary' : 'ghost'}>
                <Files />
                {t('all')}
              </Button>
              <Button aria-expanded={sharesOpen} className="h-8 w-full justify-start px-2 font-normal" onClick={openShareManager} variant={sharesOpen ? 'secondary' : 'ghost'}>
                <Share2 />
                {t('shares')}
                {shareCount > 0 && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{shareCount}</span>}
              </Button>
              <Button className="h-8 w-full justify-start px-2 font-normal" onClick={showTrash} variant={view === 'trash' ? 'secondary' : 'ghost'}>
                <Trash2 />
                {t('trash')}
              </Button>
            </nav>
            <AccountMenu
              avatarUrl={session.avatarUrl}
              dark={dark}
              login={session.login}
              name={session.name || session.login}
              onLogout={() => void auth.logout()}
              onToggleDark={() => setDark(value => !value)}
              pending={auth.pending}
            />
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
                      {selected.kind === 'markdown' && view === 'all' && (
                        <Button aria-label={t('shareDocument')} className="ml-auto" disabled={Boolean(pendingShare)} onClick={openShare} size="icon" title={shares.some(share => share.path === selected.path) ? t('viewTemporaryShare') : t('temporaryShare')} variant={shares.some(share => share.path === selected.path) ? 'secondary' : 'ghost'}>
                          <Share2 />
                        </Button>
                      )}
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto"><EditorSurface content={workspace.snapshot.selectedContent} dark={dark} documentPath={selected.path} key={selected.path} kind={selected.kind} onChange={workspace.updateDocument} /></div>
                  </>
                )
              : (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">{t('selectDocument')}</div>
                )}
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
      {createKind && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={() => !creating && setCreateKind(null)}>
          <form className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-lg" onMouseDown={event => event.stopPropagation()} onSubmit={handleCreateSubmit}>
            <div>
              <h2 className="text-lg font-semibold">{t('newKind', { kind: kindTitle })}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('location', { path: selectedDirectory || t('workspaceRoot') })}</p>
            </div>
            <Input autoFocus disabled={creating} onChange={event => setCreateName(event.target.value)} placeholder={t('namePlaceholder')} value={createName} />
            {createError && <p className="text-sm text-destructive" role="alert">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button disabled={creating} onClick={() => setCreateKind(null)} type="button" variant="outline">{t('cancel')}</Button>
              <Button disabled={creating || !createName} type="submit">{creating ? t('creating') : t('create')}</Button>
            </div>
          </form>
        </div>
      )}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={() => !deleting && setPendingDelete(null)}>
          <div aria-describedby="delete-description" aria-labelledby="delete-title" className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-lg" role="alertdialog" onMouseDown={event => event.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold" id="delete-title">{t('moveToTrashTitle')}</h2>
              <p className="mt-1 text-sm text-muted-foreground" id="delete-description">{t('moveToTrashBody', { name: pendingDelete.name })}</p>
            </div>
            {deleteError && <p className="text-sm text-destructive" role="alert">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <Button disabled={deleting} onClick={() => setPendingDelete(null)} variant="outline">{t('cancel')}</Button>
              <Button disabled={deleting} onClick={() => void confirmDelete()} variant="destructive">{deleting ? t('deleting') : t('delete')}</Button>
            </div>
          </div>
        </div>
      )}
      {sharesOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={() => setSharesOpen(false)}>
          <ShareManager
            className="max-h-[min(36rem,calc(100vh-2rem))] w-full max-w-xl"
            copiedId={copiedShareId}
            error={shareError}
            onClose={() => setSharesOpen(false)}
            onCopy={id => void copyShare(id)}
            onStop={id => void stopCurrentShare(id)}
            onStopAll={() => void stopEveryShare()}
            pending={pendingShare}
            shares={shares}
          />
        </div>
      )}
      {shareOpen && (
        <ShareDialog
          onClose={() => setShareOpen(false)}
          onStart={() => void startCurrentShare()}
        />
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
