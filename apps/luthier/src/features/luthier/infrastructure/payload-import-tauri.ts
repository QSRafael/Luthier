import { invokeCommand, pickFile } from '../../../api/tauri'
import type { GameConfig } from '../../../models/config'
import { parseImportedGameConfigJson } from '../domain/orchestrator-payload'

type ReadPayloadFileOutput = {
  payload_json: string
}

type ListDirectoryEntriesOutput = {
  path: string
  directories: string[]
  files: string[]
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

export async function pickPayloadImportPath(
  mode: 'payload_json' | 'orchestrator_executable'
): Promise<string | null | undefined> {
  const filters = mode === 'payload_json' ? [{ name: 'JSON', extensions: ['json'] }] : undefined

  const selected = await pickFile({
    multiple: false,
    filters,
  })

  if (typeof selected !== 'string') return null
  if (isLikelyAbsolutePath(selected)) return selected
  return undefined
}

export async function pathExists(path: string): Promise<boolean> {
  if (!path.trim()) return false

  try {
    const { dirPath } = splitPath(path)
    if (!dirPath) return false

    const output = await invokeCommand<ListDirectoryEntriesOutput>('cmd_list_directory_entries', {
      path: dirPath,
    })

    return hasPathInDirectoryListing(path, output.files)
  } catch {
    return false
  }
}

type TauriFileDropEvent =
  | { type: 'hover'; paths: string[] }
  | { type: 'drop'; paths: string[] }
  | { type: 'cancel' }

function isLikelyAbsolutePath(path: string): boolean {
  const trimmed = path.trim()
  return trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)
}

function splitPath(path: string): { dirPath: string; fileName: string } {
  const trimmed = path.trim().replace(/\\/g, '/')
  const lastSlash = trimmed.lastIndexOf('/')
  if (lastSlash < 0) return { dirPath: '', fileName: trimmed }
  if (lastSlash === 0) return { dirPath: '/', fileName: trimmed.slice(1) }
  return {
    dirPath: trimmed.slice(0, lastSlash),
    fileName: trimmed.slice(lastSlash + 1),
  }
}

export function hasPathInDirectoryListing(targetPath: string, listedPaths: string[]): boolean {
  const { fileName } = splitPath(targetPath)
  if (!fileName) return false

  const targetLower = fileName.toLowerCase()
  return listedPaths.some((path) => splitPath(path).fileName.toLowerCase() === targetLower)
}

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return typeof w.__TAURI_IPC__ !== 'undefined' || typeof w.__TAURI__ !== 'undefined'
}
