import type { EditorCustomHandlers, EditorToolbarItem } from '@nuxt/ui'

export function useNoteEditorToolbar<T extends EditorCustomHandlers>(_customHandlers?: T) {
  const toolbarItems: EditorToolbarItem<T>[][] = [
    [{
      kind: 'undo',
      icon: 'i-lucide-undo',
      tooltip: { text: 'Undo' },
    }, {
      kind: 'redo',
      icon: 'i-lucide-redo',
      tooltip: { text: 'Redo' },
    }],
    [{
      kind: 'heading',
      level: 1,
      label: 'H1',
      tooltip: { text: 'Heading 1' },
    }, {
      kind: 'heading',
      level: 2,
      label: 'H2',
      tooltip: { text: 'Heading 2' },
    }, {
      kind: 'heading',
      level: 3,
      label: 'H3',
      tooltip: { text: 'Heading 3' },
    }],
    [{
      kind: 'bold',
      icon: 'i-lucide-bold',
      tooltip: { text: 'Bold' },
    }, {
      kind: 'italic',
      icon: 'i-lucide-italic',
      tooltip: { text: 'Italic' },
    }, {
      kind: 'underline',
      icon: 'i-lucide-underline',
      tooltip: { text: 'Underline' },
    }, {
      kind: 'strike',
      icon: 'i-lucide-strikethrough',
      tooltip: { text: 'Strikethrough' },
    }, {
      kind: 'code',
      icon: 'i-lucide-code',
      tooltip: { text: 'Code' },
    }],
    [{
      kind: 'bulletList',
      icon: 'i-lucide-list',
      tooltip: { text: 'Bullet List' },
    }, {
      kind: 'orderedList',
      icon: 'i-lucide-list-ordered',
      tooltip: { text: 'Ordered List' },
    }, {
      kind: 'taskList',
      icon: 'i-lucide-list-check',
      tooltip: { text: 'Task List' },
    }],
    [{
      kind: 'blockquote',
      icon: 'i-lucide-text-quote',
      tooltip: { text: 'Blockquote' },
    }, {
      kind: 'codeBlock',
      icon: 'i-lucide-square-code',
      tooltip: { text: 'Code Block' },
    }, {
      kind: 'horizontalRule',
      icon: 'i-lucide-separator-horizontal',
      tooltip: { text: 'Horizontal Rule' },
    }],
    [{
      kind: 'table',
      icon: 'i-lucide-table',
      tooltip: { text: 'Table' },
    }],
  ]

  const bubbleToolbarItems = [
    [{
      kind: 'bold',
      icon: 'i-lucide-bold',
      tooltip: { text: 'Bold' },
    }, {
      kind: 'italic',
      icon: 'i-lucide-italic',
      tooltip: { text: 'Italic' },
    }, {
      kind: 'underline',
      icon: 'i-lucide-underline',
      tooltip: { text: 'Underline' },
    }, {
      kind: 'strike',
      icon: 'i-lucide-strikethrough',
      tooltip: { text: 'Strikethrough' },
    }, {
      kind: 'code',
      icon: 'i-lucide-code',
      tooltip: { text: 'Code' },
    }],
    [{
      slot: 'link' as const,
      icon: 'i-lucide-link',
      tooltip: { text: 'Link' },
    }],
  ] satisfies EditorToolbarItem<T>[][]

  return {
    toolbarItems,
    bubbleToolbarItems,
  }
}
