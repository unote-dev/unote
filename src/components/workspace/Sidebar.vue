<script setup lang="ts">
import { useWorkspace } from '~/composables/useWorkspace'
import { validateNotebookName } from '~/utils/noteText'
import { formatFullTime, formatRelativeTime } from '~/utils/timeago'

const {
  snapshot,
  scope,
  selectScope,
  createNotebook,
  renameNotebook,
  trashNotebook,
  restoreNotebook,
  permanentlyDeleteNotebook,
  logout,
  openFolder,
  syncNow,
} = useWorkspace()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleTheme() {
  colorMode.value = isDark.value ? 'light' : 'dark'
}

const newName = ref('')
const showNewInput = ref(false)
const newNameError = ref('')
const renameId = ref<string | null>(null)
const renameValue = ref('')
const renameError = ref('')
const confirmTrashId = ref<string | null>(null)
const confirmPurgeId = ref<string | null>(null)
const renameOpen = computed({ get: () => renameId.value !== null, set: (v: boolean) => {
  if (!v)
    renameId.value = null
} })
const trashOpen = computed({ get: () => confirmTrashId.value !== null, set: (v: boolean) => {
  if (!v)
    confirmTrashId.value = null
} })
const purgeOpen = computed({ get: () => confirmPurgeId.value !== null, set: (v: boolean) => {
  if (!v)
    confirmPurgeId.value = null
} })

const activeNotebooks = computed(() => snapshot.value?.notebooks.filter(n => !n.trashed) ?? [])
const trashedNotebooks = computed(() => snapshot.value?.notebooks.filter(n => n.trashed) ?? [])

const syncLabel = computed(() => {
  const s = snapshot.value?.syncStatus
  const save = snapshot.value?.saveStatus
  if (save === 'saving')
    return '保存中'
  if (save === 'dirty')
    return '编辑中'
  switch (s) {
    case 'syncing': return '同步中'
    case 'synced': return '已同步'
    case 'saved': return '已保存'
    case 'error': return '出错'
    default: return '未同步'
  }
})
const syncColor = computed(() => {
  const s = snapshot.value?.syncStatus
  const save = snapshot.value?.saveStatus
  if (save === 'saving' || save === 'dirty')
    return 'warning'
  if (s === 'syncing')
    return 'primary'
  if (s === 'error')
    return 'error'
  return 'success'
})

function validateNewName() {
  const result = validateNotebookName(newName.value)
  newNameError.value = result.valid ? '' : (result.error ?? '')
  return result.valid
}
async function addNotebook() {
  if (!validateNewName())
    return
  const name = newName.value.trim()
  newName.value = ''
  newNameError.value = ''
  showNewInput.value = false
  const previous = new Set(snapshot.value?.notebooks.map(n => n.id) ?? [])
  const result = await createNotebook(name)
  const created = result.notebooks.find(n => !previous.has(n.id))
  if (created)
    selectScope({ kind: 'notebook', id: created.id })
}
function startRename(id: string, name: string) {
  renameId.value = id
  renameValue.value = name
}
function validateRename() {
  const result = validateNotebookName(renameValue.value)
  renameError.value = result.valid ? '' : (result.error ?? '')
  return result.valid
}
async function applyRename() {
  if (!renameId.value || !validateRename())
    return
  await renameNotebook(renameId.value, renameValue.value.trim())
  renameId.value = null
  renameError.value = ''
}
</script>

<template>
  <div class="h-full flex flex-col select-none bg-muted/50 dark:bg-zinc-900 border-r border-default">
    <div class="h-11 px-3 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold">unote</span>
        <UBadge :color="syncColor" variant="subtle" size="sm">
          {{ syncLabel }}
        </UBadge>
      </div>
      <div class="flex items-center gap-1">
        <UTooltip :text="formatFullTime(snapshot?.lastSyncAt)">
          <span v-if="snapshot?.lastSyncAt" class="text-[11px] text-muted">{{ formatRelativeTime(snapshot?.lastSyncAt) }}</span>
        </UTooltip>
        <UButton variant="ghost" color="neutral" icon="i-lucide-refresh-cw" size="xs" :loading="snapshot?.syncStatus === 'syncing'" @click="syncNow()" />
      </div>
    </div>

    <UAlert v-if="snapshot?.errorMessage" color="error" variant="subtle" :title="snapshot.errorMessage" class="mx-2 mb-2" />

    <nav class="flex-1 overflow-y-auto px-2 flex flex-col gap-0.5">
      <UButton block variant="ghost" color="neutral" size="sm" :class="scope.kind === 'all' && 'bg-accent'" icon="i-lucide-file-stack" label="全部笔记" class="justify-start" @click="selectScope({ kind: 'all' })" />

      <div class="flex items-center justify-between px-2 mt-4 mb-1">
        <span class="text-[11px] font-medium uppercase tracking-wider text-muted">笔记本</span>
        <UButton variant="ghost" color="neutral" icon="i-lucide-plus" size="xs" @click="showNewInput = !showNewInput" />
      </div>

      <div v-if="showNewInput" class="px-1 mb-1 flex flex-col gap-1">
        <UInput v-model="newName" size="sm" placeholder="笔记本名称" :color="newNameError ? 'error' : 'neutral'" autofocus @input="validateNewName" @keydown.enter="addNotebook" @keydown.escape="showNewInput = false" />
        <p v-if="newNameError" class="text-[11px] text-error px-1">
          {{ newNameError }}
        </p>
      </div>

      <div v-for="notebook in activeNotebooks" :key="notebook.id" class="group relative">
        <UButton block variant="ghost" color="neutral" size="sm" :class="scope.kind === 'notebook' && scope.id === notebook.id && 'bg-accent'" icon="i-lucide-book-open" class="justify-start" @click="selectScope({ kind: 'notebook', id: notebook.id })">
          <span class="truncate flex-1 text-left">{{ notebook.name }}</span>
        </UButton>
        <div class="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
          <UButton variant="ghost" color="neutral" icon="i-lucide-pencil" size="xs" @click.stop="startRename(notebook.id, notebook.name)" />
          <UButton variant="ghost" color="error" icon="i-lucide-trash-2" size="xs" @click.stop="confirmTrashId = notebook.id" />
        </div>
      </div>

      <USeparator class="my-2" />

      <UButton block variant="ghost" color="neutral" size="sm" :class="scope.kind === 'trash' && 'bg-accent'" icon="i-lucide-trash-2" label="回收站" class="justify-start" @click="selectScope({ kind: 'trash' })" />
      <div v-for="notebook in trashedNotebooks" :key="notebook.id" class="group relative">
        <UButton block variant="ghost" color="neutral" size="sm" :class="scope.kind === 'trashedNotebook' && scope.id === notebook.id && 'bg-accent'" icon="i-lucide-book-open" class="justify-start opacity-50" @click="selectScope({ kind: 'trashedNotebook', id: notebook.id })">
          <span class="truncate flex-1 text-left">{{ notebook.name }}</span>
        </UButton>
        <div class="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
          <UButton variant="ghost" color="primary" icon="i-lucide-rotate-ccw" size="xs" @click.stop="restoreNotebook(notebook.id)" />
          <UButton variant="ghost" color="error" icon="i-lucide-x" size="xs" @click.stop="confirmPurgeId = notebook.id" />
        </div>
      </div>
    </nav>

    <div class="h-11 px-3 flex items-center gap-2 shrink-0 border-t border-default">
      <UAvatar v-if="snapshot?.session?.avatarUrl" :src="snapshot.session.avatarUrl" :alt="snapshot.session.name" size="xs" />
      <UAvatar v-else :text="(snapshot?.session?.name || snapshot?.session?.login || '?')[0]" size="xs" />
      <span class="text-xs truncate flex-1 text-muted">{{ snapshot?.session?.name || snapshot?.session?.login }}</span>
      <UButton variant="ghost" color="neutral" icon="i-lucide-folder-open" size="xs" @click="openFolder()" />
      <UButton variant="ghost" color="neutral" :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'" size="xs" @click="toggleTheme()" />
      <UButton variant="ghost" color="error" icon="i-lucide-log-out" size="xs" @click="logout()" />
    </div>

    <UModal v-model:open="renameOpen">
      <template #content>
        <div class="p-4 flex flex-col gap-3">
          <p class="font-medium">
            重命名笔记本
          </p>
          <UInput v-model="renameValue" :color="renameError ? 'error' : 'neutral'" @input="validateRename" @keydown.enter="applyRename" />
          <p v-if="renameError" class="text-xs text-error">
            {{ renameError }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="renameOpen = false">
              取消
            </UButton>
            <UButton @click="applyRename">
              保存
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
    <UModal v-model:open="trashOpen">
      <template #content>
        <div class="p-4 flex flex-col gap-3">
          <p class="font-medium">
            移到回收站？
          </p>
          <p class="text-sm text-muted">
            笔记文件不会移动或删除，之后可以恢复。
          </p>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="trashOpen = false">
              取消
            </UButton>
            <UButton color="warning" @click="confirmTrashId && trashNotebook(confirmTrashId).then(() => { confirmTrashId = null; selectScope({ kind: 'trash' }) })">
              移到回收站
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
    <UModal v-model:open="purgeOpen">
      <template #content>
        <div class="p-4 flex flex-col gap-3">
          <p class="font-medium">
            永久删除？
          </p>
          <p class="text-sm text-muted">
            将删除笔记本目录。Git 历史仍可能保留旧文件。
          </p>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="purgeOpen = false">
              取消
            </UButton>
            <UButton color="error" @click="confirmPurgeId && permanentlyDeleteNotebook(confirmPurgeId).then(() => { confirmPurgeId = null; selectScope({ kind: 'trash' }) })">
              永久删除
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
