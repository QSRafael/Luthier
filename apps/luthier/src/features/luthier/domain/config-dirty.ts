import type { GameConfig } from '../../../models/config'

export function serializeConfigSnapshot(config: GameConfig): string {
  return JSON.stringify(config)
}

export function hasDirtyConfig(config: GameConfig, cleanSnapshot: string): boolean {
  return serializeConfigSnapshot(config) !== cleanSnapshot
}
