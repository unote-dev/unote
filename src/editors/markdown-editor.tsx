import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  codeMirrorPlugin,
  CreateLink,
  diffSourcePlugin,
  DiffSourceToggleWrapper,
  frontmatterPlugin,
  headingsPlugin,
  imagePlugin,
  InsertImage,
  InsertTable,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from '@mdxeditor/editor'
import { invoke } from '@tauri-apps/api/core'
import { assetReferenceForDocument, rootAssetPathFromReference } from '@/editors/markdown-assets'
import { cn } from '@/lib/utils'
import '@mdxeditor/editor/style.css'

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

async function uploadImage(file: File, documentPath: string) {
  const data = await fileAsDataUrl(file)
  const assetPath = await invoke<string>('save_image_cmd', { data, filename: file.name || 'clipboard.png' })
  return assetReferenceForDocument(documentPath, assetPath)
}

async function previewImage(source: string) {
  const assetPath = rootAssetPathFromReference(source)
  if (!assetPath)
    return source
  return invoke<string>('read_asset_data_url', { path: assetPath })
}

function EditorToolbar() {
  return (
    <DiffSourceToggleWrapper>
      <UndoRedo />
      <Separator />
      <BlockTypeSelect />
      <BoldItalicUnderlineToggles />
      <ListsToggle />
      <Separator />
      <CreateLink />
      <InsertImage />
      <InsertTable />
    </DiffSourceToggleWrapper>
  )
}

export function MarkdownEditor({ dark, documentPath, markdown, onChange }: { dark: boolean, documentPath: string, markdown: string, onChange: (markdown: string) => void }) {
  return (
    <MDXEditor
      className={cn('unote-markdown-editor min-h-full bg-background', dark && 'dark-theme')}
      contentEditableClassName="unote-markdown-content px-8 py-6"
      markdown={markdown}
      onChange={onChange}
      plugins={[
        toolbarPlugin({ toolbarContents: EditorToolbar }),
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        imagePlugin({ imagePreviewHandler: previewImage, imageUploadHandler: file => uploadImage(file, documentPath) }),
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
