import { describe, expect, it } from 'vitest'

import { decodeDataUrlToBinary } from './data-url'

describe('decodeDataUrlToBinary', () => {
  it('decodes valid base64 data URL into mime and bytes', () => {
    const decoded = decodeDataUrlToBinary('data:image/png;base64,iVBORw==')
    expect(decoded).not.toBeNull()
    expect(decoded?.mime).toBe('image/png')
    expect(decoded?.bytes).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
  })

  it('returns null for malformed data URL', () => {
    expect(decodeDataUrlToBinary('https://example.com/image.png')).toBeNull()
  })
})
