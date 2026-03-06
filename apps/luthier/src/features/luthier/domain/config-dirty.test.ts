import { describe, expect, it } from 'vitest'

import { defaultGameConfig } from '../../../models/config'
import { hasDirtyConfig, serializeConfigSnapshot } from './config-dirty'

describe('config-dirty', () => {
  it('returns false when config matches clean snapshot', () => {
    const config = defaultGameConfig()
    const snapshot = serializeConfigSnapshot(config)
    expect(hasDirtyConfig(config, snapshot)).toBe(false)
  })

  it('returns true when config differs from clean snapshot', () => {
    const clean = defaultGameConfig()
    const edited = defaultGameConfig()
    edited.game_name = 'Age of Empires III'

    const snapshot = serializeConfigSnapshot(clean)
    expect(hasDirtyConfig(edited, snapshot)).toBe(true)
  })
})
