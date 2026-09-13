import type { Scope, Snapshot } from '~/types/unote'

const snapshot = shallowRef<Snapshot | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const selectedNoteId = ref<string | null>(null)
const scope = ref<Scope>({ kind: 'all' })
let listening = false

function applySnapshot(next: Snapshot) {
  snapshot.value = next
  if (selectedNoteId.value && !next.notes.some(note => note.id === selectedNoteId.value))
    selectedNoteId.value = null
}

async function run<T>(task: () => Promise<T>, onSnapshot?: (value: T) => Snapshot | void) {
  error.value = null
  try {
    const value = await task()
    const next = onSnapshot?.(value)
    if (next)
      applySnapshot(next)
    else if (value && typeof value === 'object' && 'notebooks' in (value as object))
      applySnapshot(value as unknown as Snapshot)
    return value
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    throw e
  }
}

export function useWorkspace() {
  async function init() {
    if (!listening) {
      listening = true
      try {
        const { listen } = await import('@tauri-apps/api/event')
        await listen<Snapshot>('unote://snapshot', (event) => {
          applySnapshot(event.payload)
        })
      }
      catch {
        // Running outside Tauri (nuxt-only) has no event bridge.
      }
    }
    loading.value = true
    try {
      await run(() => import('~/api/unote').then(m => m.bootstrap()))
    }
    finally {
      loading.value = false
    }
  }

  function selectScope(next: Scope) {
    scope.value = next
  }

  function selectNote(id: string | null) {
    selectedNoteId.value = id
  }

  return {
    snapshot: readonly(snapshot),
    loading: readonly(loading),
    error,
    selectedNoteId,
    scope,
    init,
    selectScope,
    selectNote,
    createNotebook: (name: string) => run(() => import('~/api/unote').then(m => m.createNotebook(name))),
    renameNotebook: (id: string, name: string) => run(() => import('~/api/unote').then(m => m.renameNotebook(id, name))),
    trashNotebook: (id: string) => run(() => import('~/api/unote').then(m => m.trashNotebook(id))),
    restoreNotebook: async (id: string) => {
      await run(() => import('~/api/unote').then(m => m.restoreNotebook(id)))
      scope.value = { kind: 'notebook', id }
    },
    permanentlyDeleteNotebook: (id: string) => run(() => import('~/api/unote').then(m => m.permanentlyDeleteNotebook(id))),
    createNote: async (notebookId?: string | null) => {
      const result = await run(
        () => import('~/api/unote').then(m => m.createNote(notebookId)),
        value => (value as unknown as { snapshot: Snapshot }).snapshot,
      )
      selectedNoteId.value = result.noteId
      return result
    },
    updateNote: (id: string, title: string, body: string) => run(() => import('~/api/unote').then(m => m.updateNote(id, title, body))),
    saveNow: () => run(() => import('~/api/unote').then(m => m.saveWorkspaceNow())),
    syncNow: () => run(() => import('~/api/unote').then(m => m.fullSync())),
    login: () => run(() => import('~/api/unote').then(m => m.startOAuth())),
    logout: () => run(() => import('~/api/unote').then(m => m.logout())),
    openFolder: () => import('~/api/unote').then(m => m.openWorkspaceFolder()),
    debugOpen: () => run(() => import('~/api/unote').then(m => m.debugOpenTempWorkspace())),
  }
}
