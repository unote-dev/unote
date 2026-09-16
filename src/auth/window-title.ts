export function providerLabel(host: string) {
  if (host === 'gitee')
    return 'Gitee'
  if (host === 'github')
    return 'GitHub'
  if (host === 'gitlab')
    return 'GitLab'
  return host
}

export function appWindowTitle(host?: string | null) {
  return host ? `UNote-${providerLabel(host)}` : 'UNote'
}
