import { describe, expect, it } from 'vitest'
import { parseCanvasDocument } from '@/editors/canvas-document'

describe('parseCanvasDocument', () => {
  it('removes a JSON-corrupted collaborators map from previously saved canvases', () => {
    const document = parseCanvasDocument(JSON.stringify({
      appState: { collaborators: {}, viewBackgroundColor: '#ffffff' },
      elements: [],
      files: {},
      type: 'excalidraw',
      version: 2,
    })) as { appState: Record<string, unknown> }

    expect(document.appState).not.toHaveProperty('collaborators')
    expect(document.appState.viewBackgroundColor).toBe('#ffffff')
  })
})
