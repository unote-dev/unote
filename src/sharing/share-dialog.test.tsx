import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareDialog } from '@/sharing/share-dialog'

describe('shareDialog', () => {
  afterEach(() => {
    cleanup()
  })
  it('requires an explicit risk acknowledgement before starting a share', () => {
    const onStart = vi.fn()
    render(<ShareDialog onClose={vi.fn()} onStart={onStart} />)

    expect(screen.getByText('Cloudflare 临时分享风险')).toBeTruthy()
    expect(screen.getByText(/在分享面板中查看进度/)).toBeTruthy()
    expect((screen.getByRole('button', { name: '同意并开始分享' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '同意并开始分享' }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('lets the user dismiss the warning without starting', () => {
    const onClose = vi.fn()
    render(<ShareDialog onClose={onClose} onStart={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
