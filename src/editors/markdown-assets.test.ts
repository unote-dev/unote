import { describe, expect, it } from 'vitest'
import { assetReferenceForDocument, rootAssetPathFromReference } from '@/editors/markdown-assets'

describe('markdown asset paths', () => {
  it('makes repository assets relative to a nested note', () => {
    expect(assetReferenceForDocument('工作/项目/计划.md', '.assets/image.png')).toBe('../../.assets/image.png')
    expect(assetReferenceForDocument('首页.md', '.assets/image.png')).toBe('.assets/image.png')
  })

  it('recovers the repository asset path for previewing', () => {
    expect(rootAssetPathFromReference('../../.assets/image.png')).toBe('.assets/image.png')
    expect(rootAssetPathFromReference('https://example.com/image.png')).toBeNull()
    expect(rootAssetPathFromReference('https://example.com/.assets/image.png')).toBeNull()
    expect(rootAssetPathFromReference('../notes/.assets/image.png')).toBeNull()
  })
})
