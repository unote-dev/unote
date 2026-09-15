export function parseCanvasDocument(content: string) {
  const document = JSON.parse(content) as { appState?: Record<string, unknown> }
  if (document.appState && 'collaborators' in document.appState)
    delete document.appState.collaborators
  return document
}
