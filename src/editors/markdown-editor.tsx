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

const demoMarkdown = `---
updated_at: 1789353600000000000
---

# 产品规划

这是新的 **Git-first** 文档模型。文件本身就是内容真相。

- [x] 真实目录与文件
- [ ] 接入新的 Rust workspace interface

\`\`\`mermaid
flowchart LR
  文件 --> 本地保存 --> Git同步
\`\`\`
`

export function MarkdownEditor({ dark }: { dark: boolean }) {
  return (
    <MDXEditor
      className={cn('min-h-full bg-background', dark && 'dark-theme')}
      contentEditableClassName="px-6 py-4"
      markdown={demoMarkdown}
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
