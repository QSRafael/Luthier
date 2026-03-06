import type { GameConfig } from '../../../models/config'

const HERO_IMAGE_MASKED_HINT = 'base-64 image. use --show-base64-hero-image to see'

export function shouldRefreshImportedHeroImage(importedConfig: GameConfig): boolean {
  const heroImageUrl = importedConfig.splash.hero_image_url.trim()
  if (!heroImageUrl) {
    return false
  }

  const heroImageDataUrl = importedConfig.splash.hero_image_data_url.trim()
  if (!heroImageDataUrl) {
    return true
  }

  if (heroImageDataUrl.startsWith('data:image/')) {
    return false
  }

  return heroImageDataUrl.toLowerCase().startsWith(HERO_IMAGE_MASKED_HINT)
}
