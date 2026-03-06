import { describe, expect, it } from 'vitest'

import { defaultGameConfig } from '../../../models/config'
import { shouldRefreshImportedHeroImage } from './imported-payload'

function makeConfig(heroImageUrl: string, heroImageDataUrl: string) {
  return {
    ...defaultGameConfig(),
    splash: {
      hero_image_url: heroImageUrl,
      hero_image_data_url: heroImageDataUrl,
    },
  }
}

describe('shouldRefreshImportedHeroImage', () => {
  it('returns false when hero url is empty', () => {
    expect(shouldRefreshImportedHeroImage(makeConfig('', ''))).toBe(false)
  })

  it('returns true when hero data url is missing', () => {
    expect(shouldRefreshImportedHeroImage(makeConfig('https://img', ''))).toBe(true)
  })

  it('returns false when hero data url is valid data uri', () => {
    expect(
      shouldRefreshImportedHeroImage(makeConfig('https://img', 'data:image/webp;base64,abc'))
    ).toBe(false)
  })

  it('returns true when hero data url is masked placeholder', () => {
    expect(
      shouldRefreshImportedHeroImage(
        makeConfig('https://img', 'base-64 image. Use --show-base64-hero-image to see')
      )
    ).toBe(true)
  })

  it('returns false for non-data string that is not masked placeholder', () => {
    expect(shouldRefreshImportedHeroImage(makeConfig('https://img', 'some-random-value'))).toBe(
      false
    )
  })
})
