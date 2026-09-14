import type { Edge, Node } from '@xyflow/react'
import { Background, Controls, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

interface MindmapNode {
  children?: MindmapNode[]
  id: string
  text?: string
  title?: string
}

function layout(root: MindmapNode) {
  const nodes: Node[] = []
  const edges: Edge[] = []
  let row = 0
  function visit(node: MindmapNode, depth: number, parent?: string) {
    const currentRow = row++
    nodes.push({ data: { label: node.text ?? node.title ?? node.id }, id: node.id, position: { x: depth * 240, y: currentRow * 100 } })
    if (parent)
      edges.push({ id: `${parent}-${node.id}`, source: parent, target: node.id })
    node.children?.forEach(child => visit(child, depth + 1, node.id))
  }
  visit(root, 0)
  return { edges, nodes }
}

export function MindmapEditor({ content, dark }: { content: string, dark: boolean }) {
  let graph = { edges: [] as Edge[], nodes: [] as Node[] }
  try {
    graph = layout(JSON.parse(content) as MindmapNode)
  }
  catch {
    // Invalid files remain untouched and render as an empty canvas.
  }
  return (
    <div className="h-full min-h-[520px]">
      <ReactFlow colorMode={dark ? 'dark' : 'light'} edges={graph.edges} fitView nodes={graph.nodes}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
