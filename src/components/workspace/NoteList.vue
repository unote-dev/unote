<script setup lang="ts">
import type { Note, Scope } from '~/types/unote'
import { useWorkspace } from '~/composables/useWorkspace'
import { matchesSearch, noteSummary } from '~/utils/noteText'

const { snapshot, scope, selectedNoteId, selectNote, createNote } = useWorkspace()
const query = ref('')

const inTrash = computed(() => scope.value.kind === 'trash' || scope.value.kind === 'trashedNotebook')

function scopeName(s: Scope, notebooks: readonly { id: string, name: string }[]): string {
  if (s.kind === 'notebook' || s.kind === 'trashedNotebook')
    return notebooks.find(n => n.id === s.id)?.name ?? (s.kind === 'notebook' ? '笔记本' : '已删除笔记本')
  if (s.kind === 'trash')
    return '回收站'
  return '全部笔记'
}

const scopeTitle = computed(() => {
  if (!snapshot.value)
    return ''
  return scopeName(scope.value, snapshot.value.notebooks)
})

const notes = computed(() => {
  const data = snapshot.value
  if (!data)
    return []
  const s = scope.value
  const notebooks = new Map(data.notebooks.map(n => [n.id, n]))
  let list: Note[] = data.notes.filter((note) => {
    const nb = notebooks.get(note.notebookId)
    if (!nb)
      return false
    switch (s.kind) {
      case 'all': return !nb.trashed
      case 'notebook': return !nb.trashed && note.notebookId === s.id
      case 'trash': return nb.trashed
      case 'trashedNotebook': return nb.trashed && note.notebookId === s.id
      default: return false
    }
  })
  list = list.filter(note => matchesSearch(note.title, note.body, query.value))
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
})

function formatTime(ts: number) {
  if (!ts)
    return ''
  const d = new Date(ts / 1_000_000)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

async function addNote() {
  if (inTrash.value)
    return
  const s = scope.value
  const nbId = s.kind === 'notebook' ? s.id : snapshot.value?.inboxId
  await createNote(nbId || null)
}
</script>

<template>
  <div class="h-full flex flex-col border-r border-default bg-default dark:bg-zinc-950">
    <div class="h-11 px-3 flex items-center justify-between shrink-0 border-b border-default">
      <h2 class="text-sm font-semibold truncate">
        {{ scopeTitle }}
      </h2>
      <UButton v-if="!inTrash" variant="ghost" color="neutral" icon="i-lucide-square-pen" size="xs" @click="addNote" />
    </div>

    <div class="px-3 py-2 shrink-0 border-b border-default">
      <UInput
        v-model="query"
        size="sm"
        placeholder="搜索笔记…"
        icon="i-lucide-search"
        variant="outline"
        :ui="{ base: 'rounded-lg' }"
      />
    </div>

    <ul class="flex-1 overflow-y-auto">
      <li
        v-for="note in notes"
        :key="note.id"
        class="px-3 py-2.5 cursor-pointer transition-colors border-b border-default"
        :class="selectedNoteId === note.id ? 'bg-accent' : 'hover:bg-muted/50'"
        @click="selectNote(note.id)"
      >
        <div class="flex items-baseline justify-between gap-2 mb-0.5">
          <p class="text-sm font-medium truncate">
            {{ note.title || '无标题' }}
          </p>
          <span class="text-[11px] shrink-0 text-muted">{{ formatTime(note.updatedAt) }}</span>
        </div>
        <p class="text-xs text-muted line-clamp-2">
          {{ noteSummary(note.body) || '空笔记' }}
        </p>
      </li>

      <li v-if="!notes.length" class="px-4 py-8 text-center text-sm text-muted">
        {{ query ? '没有匹配的笔记' : '还没有笔记' }}
      </li>
    </ul>
  </div>
</template>
