import { describe, expect, it } from 'vitest'
import { appWindowTitle, providerLabel } from '@/auth/window-title'

describe('window title', () => {
  it('uses UNote-Gitee when signed in with Gitee', () => {
    expect(providerLabel('gitee')).toBe('Gitee')
    expect(appWindowTitle('gitee')).toBe('UNote-Gitee')
  })

  it('falls back to UNote when signed out', () => {
    expect(appWindowTitle(null)).toBe('UNote')
  })
})
