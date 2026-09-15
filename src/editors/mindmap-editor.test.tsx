import { fireEvent, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MindmapEditor } from '@/editors/mindmap-editor'

vi.mock('@mind-elixir/node-menu', () => ({ default: vi.fn() }))

class TestPointerEvent extends MouseEvent {
  pointerId: number
  pointerType: string

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
    this.pointerType = init.pointerType ?? 'mouse'
  }
}

describe('mindmap editor', () => {
  it('selects a node and adds a child with Tab in StrictMode', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })
    window.PointerEvent = TestPointerEvent as typeof PointerEvent
    const onChange = vi.fn()
    const { container } = render(
      <StrictMode>
        <MindmapEditor
          content={JSON.stringify({ nodeData: { children: [], id: 'root', topic: '主题' } })}
          dark={false}
          onChange={onChange}
        />
      </StrictMode>,
    )

    const root = await waitFor(() => container.querySelector('me-root me-tpc') as HTMLElement)
    fireEvent.click(root)

    const map = container.querySelector('.map-container') as HTMLElement
    expect(document.activeElement).toBe(map)
    fireEvent.keyDown(map, { key: 'Tab' })

    await waitFor(() => {
      const saved = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]
      expect(saved).toBeTruthy()
      expect(JSON.parse(saved).nodeData.children).toHaveLength(1)
    })
  })

  it('keeps the native double-click editing gesture', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })
    window.PointerEvent = TestPointerEvent as typeof PointerEvent
    const { container } = render(
      <MindmapEditor
        content={JSON.stringify({ nodeData: { children: [], id: 'root', topic: '主题' } })}
        dark={false}
        onChange={vi.fn()}
      />,
    )
    const root = await waitFor(() => container.querySelector('me-root me-tpc') as HTMLElement)
    fireEvent.doubleClick(root)

    await waitFor(() => expect(container.querySelector('#input-box')).not.toBeNull())
  })

  it('does not steal focus from node-menu inputs', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })
    const { container } = render(
      <MindmapEditor
        content={JSON.stringify({ nodeData: { children: [], id: 'root', topic: '主题' } })}
        dark={false}
        onChange={vi.fn()}
      />,
    )
    const map = await waitFor(() => container.querySelector('.map-container') as HTMLElement)
    const input = document.createElement('input')
    map.appendChild(input)
    input.focus()
    fireEvent.click(input)

    expect(document.activeElement).toBe(input)
  })
})
