export function noteSummary(body: string, maxLength = 80): string {
  const text = body
    .split('\n')
    .map((line) => {
      return line
        .replace(/^#{1,6}\s+/, '')
        .replace(/^>\s+/, '')
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/[*_`]/g, '')
        .trim()
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength)
    return text
  return `${text.slice(0, maxLength)}…`
}

export function matchesSearch(title: string, body: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q)
    return true
  return title.toLowerCase().includes(q) || noteSummary(body, 400).toLowerCase().includes(q)
}

// Reserved folder names (app config, assets, etc.)
const RESERVED_NAMES = new Set([
  '.assets',
  '.git',
  '.unote',
  '.trash',
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
])

// Characters not allowed in file/folder names (Windows)
const INVALID_CHARS = /[\\/:*?"<>|]/

export function validateNotebookName(name: string): { valid: boolean, error?: string } {
  const trimmed = name.trim()
  if (!trimmed)
    return { valid: false, error: '名称不能为空' }
  if (trimmed.length > 200)
    return { valid: false, error: '名称太长（最大 200 字符）' }
  if (INVALID_CHARS.test(trimmed))
    return { valid: false, error: '名称含有非法字符：\\ / : * ? " < > |' }
  if (RESERVED_NAMES.has(trimmed.toLowerCase()))
    return { valid: false, error: '该名称为系统保留名，请换一个' }
  return { valid: true }
}
