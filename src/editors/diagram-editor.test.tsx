import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DiagramEditor } from '@/editors/diagram-editor'

describe('diagram editor', () => {
  it('loads and autosaves native drawio XML through the embed protocol', () => {
    const onChange = vi.fn()
    render(<DiagramEditor content="<mxGraphModel />" dark={false} onChange={onChange} />)

    const frame = screen.getByTitle('Draw.io 图表编辑器') as HTMLIFrameElement
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
    window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ event: 'init' }), source: frame.contentWindow }))

    expect(postMessage).toHaveBeenCalledWith(expect.stringContaining('<mxGraphModel />'), '*')

    window.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({ event: 'autosave', xml: '<mxGraphModel updated="1" />' }),
      source: frame.contentWindow,
    }))
    expect(onChange).toHaveBeenCalledWith('<mxGraphModel updated="1" />')
  })
})
