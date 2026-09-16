import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountMenu } from '@/components/account-menu'
import { LocaleProvider } from '@/i18n/locale'

afterEach(() => {
  cleanup()
  localStorage.removeItem('locale')
})

describe('account menu', () => {
  it('opens from the footer and switches the chrome to English', () => {
    render(
      <LocaleProvider>
        <AccountMenu
          dark={false}
          login="ada"
          name="Ada"
          onLogout={vi.fn()}
          onToggleDark={vi.fn()}
          pending={false}
        />
      </LocaleProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '账户菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'English' }))
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeTruthy()
  })

  it('opens GitHub issue and repository links from the account menu', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(
      <LocaleProvider>
        <AccountMenu
          dark={false}
          login="ada"
          name="Ada"
          onLogout={vi.fn()}
          onToggleDark={vi.fn()}
          pending={false}
        />
      </LocaleProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '账户菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '反馈问题' }))
    expect(open).toHaveBeenCalledWith('https://github.com/unote-dev/unote/issues/new', '_blank', 'noopener,noreferrer')

    fireEvent.click(screen.getByRole('button', { name: '账户菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '给项目点 Star' }))
    expect(open).toHaveBeenCalledWith('https://github.com/unote-dev/unote', '_blank', 'noopener,noreferrer')
    open.mockRestore()
  })
})
