import { describe, expect, it } from 'vitest'

import { luthierMessages } from './copy'

describe('luthier copy for binary assets', () => {
  it('describes hero image embedding as binary asset in pt-BR and en-US', () => {
    expect(
      luthierMessages['pt-BR'].luthier_hero_image_used_as_splash_background_downloaded_and_emb
    ).toContain('asset binário')
    expect(
      luthierMessages['en-US'].luthier_hero_image_used_as_splash_background_downloaded_and_emb
    ).toContain('binary asset')
  })

  it('does not mention base64 hero payload wording in main copy strings', () => {
    expect(
      luthierMessages[
        'pt-BR'
      ].luthier_hero_image_used_as_splash_background_downloaded_and_emb.toLowerCase()
    ).not.toContain('base64')
    expect(
      luthierMessages[
        'en-US'
      ].luthier_hero_image_used_as_splash_background_downloaded_and_emb.toLowerCase()
    ).not.toContain('base64')
  })
})
