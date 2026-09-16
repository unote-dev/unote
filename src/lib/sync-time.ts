export type LocaleTag = 'zh' | 'en'

export function timestampToMs(value: number) {
  if (value > 1e16)
    return Math.floor(value / 1e6)
  if (value > 1e12)
    return value
  return value * 1000
}

export type SyncElapsed
  = { kind: 'justNow' }
    | { kind: 'minutes', count: number }
    | { kind: 'hours', count: number }
    | { kind: 'absolute', value: string }

export function describeSyncTime(lastSyncAt: number, now: number, locale: LocaleTag): SyncElapsed {
  const date = new Date(timestampToMs(lastSyncAt))
  const diff = Math.max(0, now - date.getTime())
  if (diff < 45_000)
    return { kind: 'justNow' }
  if (diff < 60 * 60 * 1000)
    return { kind: 'minutes', count: Math.max(1, Math.round(diff / 60_000)) }
  if (diff < 24 * 60 * 60 * 1000)
    return { kind: 'hours', count: Math.max(1, Math.round(diff / 3_600_000)) }
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }
  if (date.getFullYear() !== new Date(now).getFullYear())
    options.year = 'numeric'
  return {
    kind: 'absolute',
    value: new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', options).format(date),
  }
}
