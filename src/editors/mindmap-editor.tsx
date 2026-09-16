import type { MindElixirInstance, Theme, Topic } from 'mind-elixir'
import NodeMenu from '@mind-elixir/node-menu'
import MindElixir from 'mind-elixir'
import { en, zh_CN } from 'mind-elixir/i18n'
import { useEffect, useRef } from 'react'
import { parseMindmapDocument, serializeMindmapDocument } from '@/editors/mindmap-document'
import { useI18n } from '@/i18n/locale'
import 'mind-elixir/style.css'
import '@mind-elixir/node-menu/dist/style.css'

function applicationTheme(dark: boolean): Theme {
  const base = dark ? MindElixir.DARK_THEME : MindElixir.THEME
  return {
    ...base,
    name: dark ? 'unote-dark' : 'unote-light',
    cssVar: {
      ...base.cssVar,
      '--accent-color': 'var(--ring)',
      '--bgcolor': 'var(--background)',
      '--color': 'var(--foreground)',
      '--main-bgcolor': 'var(--card)',
      '--main-bgcolor-transparent': 'color-mix(in oklch, var(--card) 80%, transparent)',
      '--main-color': 'var(--card-foreground)',
      '--panel-bgcolor': 'var(--popover)',
      '--panel-border-color': 'var(--border)',
      '--panel-color': 'var(--popover-foreground)',
      '--root-bgcolor': 'var(--primary)',
      '--root-border-color': 'var(--primary)',
      '--root-color': 'var(--primary-foreground)',
      '--selected': 'var(--ring)',
    },
  }
}

export function MindmapEditor({ content, dark, onChange }: { content: string, dark: boolean, onChange: (content: string) => void }) {
  const { locale, t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<MindElixirInstance>(null)
  const onChangeRef = useRef(onChange)
  const i18nRef = useRef({ locale, t })
  i18nRef.current = { locale, t }
  const initialDocumentRef = useRef<ReturnType<typeof readDocument>>(undefined)
  initialDocumentRef.current ??= readDocument(content)
  const initialThemeRef = useRef(applicationTheme(dark))
  const parsed = initialDocumentRef.current
  const initialDataRef = useRef(parsed.data)
  onChangeRef.current = onChange

  function readDocument(source: string) {
    try {
      return { data: parseMindmapDocument(source), error: null }
    }
    catch (error) {
      return { data: null, error: error instanceof Error ? error.message : t('invalidMindmap') }
    }
  }

  useEffect(() => {
    if (!containerRef.current || !initialDataRef.current)
      return

    const mind = new MindElixir({
      allowUndo: true,
      compact: true,
      direction: MindElixir.RIGHT,
      draggable: true,
      contextMenu: { locale: i18nRef.current.locale === 'zh' ? zh_CN : en },
      el: containerRef.current,
      keypress: true,
      newTopicName: i18nRef.current.t('newNode'),
      overflowHidden: false,
      theme: initialThemeRef.current,
      toolBar: true,
    })
    instanceRef.current = mind
    // NodeMenu 5 reads the locale from the instance instead of contextMenu.locale.
    mind.locale = i18nRef.current.locale === 'zh' ? 'zh_CN' : 'en'
    mind.install(NodeMenu)
    mind.init(initialDataRef.current)

    const activateEditor = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('me-tpc') as Topic | null : null
      if (!target)
        return
      mind.selectNode(target)
      mind.container.focus({ preventScroll: true })
    }
    const editNode = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('me-tpc') as Topic | null : null
      if (target && !mind.nodes.querySelector('#input-box'))
        void mind.beginEdit(target)
    }
    mind.container.addEventListener('click', activateEditor)
    mind.container.addEventListener('dblclick', editNode)

    const save = () => onChangeRef.current(serializeMindmapDocument(mind.getData()))
    const saveOperation = (operation: { name: string }) => {
      if (operation.name !== 'beginEdit')
        save()
    }
    mind.bus.addListener('operation', saveOperation)
    mind.bus.addListener('expandNode', save)
    mind.bus.addListener('changeDirection', save)

    return () => {
      mind.bus.removeListener('operation', saveOperation)
      mind.bus.removeListener('expandNode', save)
      mind.bus.removeListener('changeDirection', save)
      mind.container.removeEventListener('click', activateEditor)
      mind.container.removeEventListener('dblclick', editNode)
      mind.destroy()
      instanceRef.current = null
    }
  }, [])

  useEffect(() => {
    instanceRef.current?.changeTheme(applicationTheme(dark))
  }, [dark])

  useEffect(() => {
    if (instanceRef.current)
      instanceRef.current.locale = locale === 'zh' ? 'zh_CN' : 'en'
  }, [locale])

  if (parsed.error) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-destructive">
        {parsed.error}
        {locale === 'zh' ? '。' : '. '}
        {t('mindmapProtected')}
      </div>
    )
  }

  return <div className="unote-mindmap h-full min-h-[520px] w-full" ref={containerRef} />
}
