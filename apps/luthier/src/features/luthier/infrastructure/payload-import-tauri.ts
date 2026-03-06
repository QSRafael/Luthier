import { invokeCommand } from '../../../api/tauri'
import type { GameConfig } from '../../../models/config'
import { parseImportedGameConfigJson } from '../domain/orchestrator-payload'

type ReadPayloadFileOutput = {
  payload_json: string
}

export async function importConfigFromPayloadPath(path: string): Promise<GameConfig> {
  const output = await invokeCommand<ReadPayloadFileOutput>('cmd_read_payload_json_file', {
    path,
  })
  return parseImportedGameConfigJson(output.payload_json)
}

export async function importConfigFromOrchestratorPath(path: string): Promise<GameConfig> {
  const output = await invokeCommand<ReadPayloadFileOutput>(
    'cmd_extract_payload_json_from_orchestrator',
    {
      path,
    }
  )
  return parseImportedGameConfigJson(output.payload_json)
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
