import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SidebarHeader } from '@/components/sidebar-header'
import { LocaleProvider } from '@/i18n/locale'

afterEach(cleanup)

describe('sidebar header', () => {
  it('puts sync next to create and shows the last sync time', () => {
    const onSync = vi.fn()
    render(
      <LocaleProvider>
        <SidebarHeader
          lastSyncAt={Date.now() - 5 * 60_000}
          onCreate={vi.fn()}
          onSync={onSync}
          pending={false}
          showCreate
          syncError={null}
          syncLabel="已同步"
          syncStatus="synced"
        />
      </LocaleProvider>,
    )

    expect(screen.getByText('已同步')).toBeTruthy()
    expect(screen.getByText(/上次同步 5 分钟前/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '立即同步' }))
    expect(onSync).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '新建' })).toBeTruthy()
  })
})
