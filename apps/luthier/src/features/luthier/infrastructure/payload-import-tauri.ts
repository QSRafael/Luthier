import type { GameConfig } from '../../../models/config'
import {
  extractPayloadJsonFromOrchestratorBytes,
  parseImportedGameConfigJson,
} from '../domain/orchestrator-payload'

export async function importConfigFromPayloadPath(path: string): Promise<GameConfig> {
  const fs = await import('@tauri-apps/api/fs')
  const raw = await fs.readTextFile(path)
  return parseImportedGameConfigJson(raw)
}

export async function importConfigFromOrchestratorPath(path: string): Promise<GameConfig> {
  const fs = await import('@tauri-apps/api/fs')
  const bytes = await fs.readBinaryFile(path)
  const payloadJson = await extractPayloadJsonFromOrchestratorBytes(bytes)
  return parseImportedGameConfigJson(payloadJson)
}

export async function listenTauriFileDrop(
  onEvent: (event: TauriFileDropEvent) => void
): Promise<() => void> {
  const runtime = isTauriRuntime()
  if (!runtime) {
    return () => {
      // No-op outside Tauri runtime.
    }
  }

  const { appWindow } = await import('@tauri-apps/api/window')
  return appWindow.onFileDropEvent((event) => {
    onEvent(event.payload)
  })
}

type TauriFileDropEvent =
  | { type: 'hover'; paths: string[] }
  | { type: 'drop'; paths: string[] }
  | { type: 'cancel' }

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return typeof w.__TAURI_IPC__ !== 'undefined' || typeof w.__TAURI__ !== 'undefined'
}
