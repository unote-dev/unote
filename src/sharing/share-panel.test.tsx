import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareManager } from '@/sharing/share-panel'

const share = {
  id: 'abc',
  name: '计划',
  path: '工作/计划.md',
  url: 'https://example.trycloudflare.com/s/id#key',
}

describe('shareManager', () => {
  afterEach(() => {
    cleanup()
  })
  it('lists active shares in a panel and can stop one', () => {
    const onStop = vi.fn()
    render(<ShareManager copiedId={null} onClose={vi.fn()} onCopy={vi.fn()} onStop={onStop} onStopAll={vi.fn()} shares={[share]} />)
    expect(screen.getByText('计划')).toBeTruthy()
    expect(screen.getByText('工作/计划.md')).toBeTruthy()
    expect(screen.getByText('https://example.trycloudflare.com/s/id')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '停止分享 计划' }))
    expect(onStop).toHaveBeenCalledWith('abc')
  })

  it('shows an empty state when nothing is being shared', () => {
    render(<ShareManager copiedId={null} onClose={vi.fn()} onCopy={vi.fn()} onStop={vi.fn()} onStopAll={vi.fn()} shares={[]} />)
    expect(screen.getByText('没有进行中的临时分享')).toBeTruthy()
  })

  it('shows tunnel progress in the list while starting', () => {
    render(<ShareManager copiedId={null} onClose={vi.fn()} onCopy={vi.fn()} onStop={vi.fn()} onStopAll={vi.fn()} pending={{ name: '计划' }} shares={[]} />)
    expect(screen.getByText(/正在建立「计划」的临时隧道/)).toBeTruthy()
    expect(screen.queryByText('没有进行中的临时分享')).toBeNull()
  })

  it('copies a share link from the list', () => {
    const onCopy = vi.fn()
    render(<ShareManager copiedId={null} onClose={vi.fn()} onCopy={onCopy} onStop={vi.fn()} onStopAll={vi.fn()} shares={[share]} />)
    fireEvent.click(screen.getByRole('button', { name: '复制链接' }))
    expect(onCopy).toHaveBeenCalledWith('abc')
  })
})
