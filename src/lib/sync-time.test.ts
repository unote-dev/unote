import { describe, expect, it } from 'vitest'
import { describeSyncTime, timestampToMs } from '@/lib/sync-time'

describe('sync time', () => {
  it('converts rust nanosecond timestamps to milliseconds', () => {
    expect(timestampToMs(1_700_000_000_000_000_000)).toBe(1_700_000_000_000)
  })

  it('describes a recent sync as just now', () => {
    expect(describeSyncTime(1_700_000_000_000, 1_700_000_010_000, 'zh')).toEqual({ kind: 'justNow' })
  })

  it('describes a sync from several minutes ago', () => {
    expect(describeSyncTime(1_700_000_000_000, 1_700_000_000_000 + 5 * 60_000, 'en')).toEqual({
      count: 5,
      kind: 'minutes',
    })
  })
})
