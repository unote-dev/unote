<script setup lang="ts">
import type { SplitterItem } from '@nuxt/ui'
import WorkspaceLogin from '~/components/workspace/Login.vue'
import WorkspaceNoteEditor from '~/components/workspace/NoteEditor.vue'
import WorkspaceNoteList from '~/components/workspace/NoteList.vue'
import WorkspaceSidebar from '~/components/workspace/Sidebar.vue'
import { useWorkspace } from '~/composables/useWorkspace'

const { snapshot, loading, init } = useWorkspace()

const showLogin = computed(() => {
  if (loading.value)
    return false
  return !snapshot.value?.session
})

onMounted(() => {
  init()
})

const items: SplitterItem[] = [
  { slot: 'left', minSize: 15, defaultSize: 18 },
  { slot: 'main', minSize: 20, defaultSize: 26 },
  { slot: 'right', minSize: 30 },
]
</script>

<template>
  <div class="h-dvh overflow-hidden bg-background">
    <!-- Loading -->
    <div v-if="loading" class="h-full flex flex-col items-center justify-center gap-3">
      <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-primary" />
      <p class="text-sm text-muted">
        正在打开工作区…
      </p>
    </div>

    <!-- Login -->
    <WorkspaceLogin v-else-if="showLogin" />

    <!-- Workspace -->
    <USplitter
      v-else
      id="unote-workspace"
      :items="items"
      :ui="{
        handle: [
          'data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px',
          'bg-black/10 dark:bg-white/10',
          'data-[state=hover]:bg-primary/50 data-[state=drag]:bg-primary/50',
          'transition-colors',
        ].join(' '),
      }"
      class="h-full overflow-hidden"
    >
      <template #left>
        <div class="h-full w-full">
          <WorkspaceSidebar />
        </div>
      </template>
      <template #main>
        <div class="h-full w-full">
          <WorkspaceNoteList />
        </div>
      </template>
      <template #right>
        <div class="h-full w-full">
          <WorkspaceNoteEditor />
        </div>
      </template>
    </USplitter>
  </div>
</template>
