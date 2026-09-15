import { describe, expect, it } from 'vitest'
import { parseMindmapDocument, serializeMindmapDocument } from '@/editors/mindmap-document'

describe('mindmap document', () => {
  it('parses Mind Elixir data', () => {
    const data = parseMindmapDocument(JSON.stringify({
      direction: 2,
      nodeData: { children: [{ id: 'child', topic: '子节点' }], id: 'root', topic: '主题' },
    }))

    expect(data.nodeData.children?.[0]).toMatchObject({ id: 'child', topic: '子节点' })
    expect(data.direction).toBe(2)
  })

  it('rejects the previous custom tree format', () => {
    expect(() => parseMindmapDocument(JSON.stringify({ id: 'root', text: '主题' }))).toThrow('脑图文件格式无效')
  })

  it('does not persist the application theme', () => {
    const content = serializeMindmapDocument({
      nodeData: { id: 'root', topic: '主题' },
      theme: { name: 'temporary', palette: [] },
    })

    expect(JSON.parse(content)).toEqual({ nodeData: { id: 'root', topic: '主题' } })
  })
})
