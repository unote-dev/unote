import type { MindElixirData, NodeObj } from 'mind-elixir'

function validateNode(value: unknown): asserts value is NodeObj {
  if (!value || typeof value !== 'object')
    throw new Error('脑图节点格式无效')

  const node = value as Partial<NodeObj>
  if (typeof node.id !== 'string' || !node.id)
    throw new Error('脑图节点缺少 id')
  if (typeof node.topic !== 'string')
    throw new TypeError('脑图节点缺少 topic')
  if (node.children !== undefined && !Array.isArray(node.children))
    throw new TypeError('脑图节点的 children 必须是数组')

  node.children?.forEach(validateNode)
}

export function parseMindmapDocument(content: string): MindElixirData {
  const value: unknown = JSON.parse(content)
  if (!value || typeof value !== 'object' || !('nodeData' in value))
    throw new Error('脑图文件格式无效')

  const data = value as MindElixirData
  validateNode(data.nodeData)
  if (data.direction !== undefined && ![0, 1, 2, 3].includes(data.direction))
    throw new Error('脑图方向无效')

  delete data.theme
  return data
}

export function serializeMindmapDocument(data: MindElixirData): string {
  const document = { ...data }
  delete document.theme
  return `${JSON.stringify(document, null, 2)}\n`
}
