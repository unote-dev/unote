export function assetReferenceForDocument(documentPath: string, assetPath: string) {
  const depth = Math.max(0, documentPath.split('/').length - 1)
  return `${'../'.repeat(depth)}${assetPath}`
}

export function rootAssetPathFromReference(source: string) {
  const parts = source.replaceAll('\\', '/').split('/')
  while (parts[0] === '..')
    parts.shift()
  return parts.length === 2 && parts[0] === '.assets' && parts[1] ? `.assets/${parts[1]}` : null
}
