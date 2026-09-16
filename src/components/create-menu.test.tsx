import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateMenu } from '@/components/create-menu'

afterEach(cleanup)

describe('create menu', () => {
  it('closes when clicking outside', () => {
    render(<CreateMenu onSelect={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '新建' }))
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes when pressing Escape', () => {
    render(<CreateMenu onSelect={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '新建' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).toBeNull()
  })
})
