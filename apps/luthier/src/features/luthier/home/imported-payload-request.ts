import type { GameConfig } from '../../../models/config'

export type ImportedPayloadRequest = {
  id: number
  source: 'json' | 'orchestrator'
  fileName: string
  config: GameConfig
}
