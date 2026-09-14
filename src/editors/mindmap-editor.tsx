import type { Edge, Node } from '@xyflow/react'
import { Background, Controls, ReactFlow } from '@xyflow/react'

import '@xyflow/react/dist/style.css'

const nodes: Node[] = [
  { id: 'root', position: { x: 280, y: 80 }, data: { label: '知识结构' } },
  { id: 'files', position: { x: 100, y: 220 }, data: { label: '真实文件' } },
  { id: 'git', position: { x: 450, y: 220 }, data: { label: 'Git 同步' } },
]

const edges: Edge[] = [
  { id: 'root-files', source: 'root', target: 'files' },
  { id: 'root-git', source: 'root', target: 'git' },
]

export function MindmapEditor() {
  return (
    <div className="h-full min-h-[520px]">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
