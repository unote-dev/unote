import {
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  frontmatterPlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
} from '@mdxeditor/editor'
import { cn } from '@/lib/utils'

import '@mdxeditor/editor/style.css'

export function MarkdownEditor({ dark, markdown, onChange }: { dark: boolean, markdown: string, onChange: (markdown: string) => void }) {
  return (
    <MDXEditor
      className={cn('min-h-full bg-background', dark && 'dark-theme')}
      contentEditableClassName="px-6 py-4"
      markdown={markdown}
      onChange={onChange}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
        codeMirrorPlugin({ codeBlockLanguages: { mermaid: 'Mermaid', txt: 'Text' } }),
        diffSourcePlugin({ viewMode: 'rich-text' }),
        frontmatterPlugin(),
        markdownShortcutPlugin(),
      ]}
    />
  )
}
