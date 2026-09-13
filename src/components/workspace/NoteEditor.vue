<script setup lang="ts">
import type { EditorCustomHandlers } from '@nuxt/ui'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useDebounceFn } from '@vueuse/core'
import EditorLinkPopover from '~/components/editor/LinkPopover.vue'
import { useEditorSuggestions } from '~/composables/useEditorSuggestions'
import { useImagePaste } from '~/composables/useImagePaste'
import { useNoteEditorToolbar } from '~/composables/useNoteEditorToolbar'
import { useWorkspace } from '~/composables/useWorkspace'

const { snapshot, selectedNoteId, updateNote } = useWorkspace()

const title = ref('')
const body = ref('')
const rawBody = ref('')
const editorRef = ref<any>(null)
const applying = ref(false)

const note = computed(() => snapshot.value?.notes.find(n => n.id === selectedNoteId.value) ?? null)

const saveHint = computed(() => {
  if (snapshot.value?.saveStatus === 'saving')
    return '保存中…'
  if (snapshot.value?.saveStatus === 'dirty')
    return '未保存'
  return ''
})

const workspaceRoot = computed(() => snapshot.value?.workspaceRoot)

function toDisplayBody(raw: string): string {
  if (!workspaceRoot.value)
    return raw
  return raw.replace(/\.assets\/([\w.-]+)/g, (_, file) => {
    return convertFileSrc(`${workspaceRoot.value}/.assets/${file}`)
  })
}

function toStorageBody(display: string): string {
  if (!workspaceRoot.value)
    return display
  const prefix = convertFileSrc(`${workspaceRoot.value}/.assets/`)
  return display.replaceAll(prefix, '.assets/')
}

// Sync editor content when note changes
watch(note, (value) => {
  applying.value = true
  title.value = value?.title ?? ''
  rawBody.value = value?.body ?? ''
  body.value = toDisplayBody(rawBody.value)
  nextTick(() => {
    applying.value = false
  })
}, { immediate: true })

// Re-convert when workspaceRoot becomes available (initially null)
watch(workspaceRoot, (root) => {
  if (root && rawBody.value && rawBody.value.includes('.assets/')) {
    applying.value = true
    body.value = toDisplayBody(rawBody.value)
    nextTick(() => {
      applying.value = false
    })
  }
})

// Debounced save - 1.5s after last keystroke, skip if content unchanged
const debouncedSave = useDebounceFn(() => {
  if (applying.value || !note.value)
    return
  const t = title.value
  const b = toStorageBody(body.value)
  if (t === (note.value.title ?? '') && b === rawBody.value)
    return
  rawBody.value = b
  updateNote(note.value.id, t, b)
}, 1500)

// Save title changes (debounced)
watch(title, debouncedSave)

const customHandlers = {} satisfies EditorCustomHandlers

const { toolbarItems, bubbleToolbarItems } = useNoteEditorToolbar(customHandlers)
const { items: suggestionItems } = useEditorSuggestions(customHandlers)
const { handlePaste: handleImagePaste } = useImagePaste()

function onUpdate(value: string) {
  body.value = value
  debouncedSave()
}
</script>

<template>
  <div v-if="note" class="h-full flex flex-col bg-default dark:bg-zinc-950">
    <!-- Title -->
    <div class="h-11 px-4 flex items-center gap-2 shrink-0 border-b border-default">
      <UInput v-model="title" variant="none" placeholder="无标题" class="flex-1 font-semibold" />
      <span v-if="saveHint" class="text-xs text-muted shrink-0">{{ saveHint }}</span>
    </div>

    <!-- Editor -->
    <UEditor
      ref="editorRef"
      v-slot="{ editor: slotEditor, handlers }"
      v-model="body"
      content-type="markdown"
      :handlers="customHandlers"
      :editor-props="{
        handlePaste: (_view: any, event: ClipboardEvent) => {
          // editorRef is auto-unwrapped to component instance by Vue
          // exposed editor at .editor is a ShallowRef, unwrap with .value
          const ed = editorRef?.editor?.value
          if (!ed?.chain) return false
          return handleImagePaste(event, ed)
        },
      }"
      placeholder="开始写作…"
      class="flex-1 min-h-0"
      :ui="{
        root: 'flex-1 min-h-0 overflow-hidden',
        base: 'px-4 py-6 sm:px-8',
        content: 'max-w-4xl mx-auto',
      }"
      @update:model-value="onUpdate"
    >
      <!-- Fixed toolbar -->
      <UEditorToolbar
        :editor="slotEditor"
        :items="toolbarItems"
        class="border-b border-muted sticky top-0 inset-x-0 px-4 py-2 z-50 bg-default overflow-x-auto"
      >
        <template #link>
          <EditorLinkPopover :editor="slotEditor" />
        </template>
      </UEditorToolbar>

      <!-- Bubble toolbar -->
      <UEditorToolbar
        :editor="slotEditor"
        :items="bubbleToolbarItems"
        layout="bubble"
        :should-show="({ editor: ed, view, state }: any) => {
          if (ed.isActive('imageUpload') || ed.isActive('image'))
            return false
          const { selection } = state
          return view.hasFocus() && !selection.empty
        }"
      >
        <template #link>
          <EditorLinkPopover :editor="slotEditor" :auto-open="true" />
        </template>
      </UEditorToolbar>

      <!-- Drag handle -->
      <UEditorDragHandle v-slot="{ ui, onClick }" :editor="slotEditor">
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          size="sm"
          :class="ui.handle()"
          @click="(e: MouseEvent) => {
            e.stopPropagation()
            const node = onClick()
            handlers.suggestion?.execute(slotEditor, { pos: node?.pos }).run()
          }"
        />
        <UDropdownMenu
          v-slot="{ open }"
          :modal="false"
          :items="[[
            { kind: 'duplicate', pos: undefined, label: '复制', icon: 'i-lucide-copy' },
          ], [
            { kind: 'moveUp', pos: undefined, label: '上移', icon: 'i-lucide-arrow-up' },
            { kind: 'moveDown', pos: undefined, label: '下移', icon: 'i-lucide-arrow-down' },
          ], [
            { kind: 'delete', pos: undefined, label: '删除', icon: 'i-lucide-trash' },
          ]]"
          :content="{ side: 'left' }"
          :ui="{ content: 'w-48', label: 'text-xs' }"
          @update:open="slotEditor.chain().setMeta('lockDragHandle', $event).run()"
        >
          <UButton
            color="neutral"
            variant="ghost"
            active-variant="soft"
            size="sm"
            icon="i-lucide-grip-vertical"
            :active="open"
            :class="ui.handle()"
          />
        </UDropdownMenu>
      </UEditorDragHandle>

      <!-- Suggestion menu (slash commands) -->
      <UEditorSuggestionMenu
        :editor="slotEditor"
        :items="suggestionItems"
      />
    </UEditor>
  </div>

  <!-- Empty -->
  <div v-else class="h-full flex flex-col items-center justify-center gap-3 bg-default dark:bg-zinc-950">
    <UIcon name="i-lucide-file-text" class="w-12 h-12 text-muted" />
    <p class="text-sm text-muted">
      选择或新建一篇笔记
    </p>
  </div>
</template>
