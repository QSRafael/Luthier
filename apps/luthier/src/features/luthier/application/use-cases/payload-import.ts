import type { GameConfig } from '../../../../models/config'
import {
  extractPayloadJsonFromOrchestratorBytes,
  parseImportedGameConfigJson,
} from '../../domain/orchestrator-payload'

export async function importConfigFromPayloadFile(file: File): Promise<GameConfig> {
  const raw = await file.text()
  return parseImportedGameConfigJson(raw)
}

export async function importConfigFromOrchestratorFile(file: File): Promise<GameConfig> {
  const bytes = await readFileAsUint8Array(file)
  const payloadJson = await extractPayloadJsonFromOrchestratorBytes(bytes)
  return parseImportedGameConfigJson(payloadJson)
}

async function readFileAsUint8Array(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer()
  return new Uint8Array(buffer)
}
