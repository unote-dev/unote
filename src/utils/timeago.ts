/**
 * Format a nanosecond timestamp as a friendly relative string.
 * e.g. "刚刚", "3分钟前", "2小时前", "3天前"
 */
export function formatRelativeTime(nanos: number | null | undefined): string {
  if (!nanos)
    return ''
  const ms = nanos / 1_000_000
  const now = Date.now()
  const diff = Math.max(0, now - ms)
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60)
    return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)
    return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)
    return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

/**
 * Format a nanosecond timestamp as a full local datetime string for tooltips.
 */
export function formatFullTime(nanos: number | null | undefined): string {
  if (!nanos)
    return ''
  const ms = nanos / 1_000_000
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
