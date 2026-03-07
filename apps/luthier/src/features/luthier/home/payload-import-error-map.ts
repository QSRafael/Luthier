import type { LuthierCopyKey } from '../copy'
import { OrchestratorPayloadError } from '../domain/orchestrator-payload'

export type PayloadImportMode = 'payload_json' | 'orchestrator_executable'

export function mapPayloadImportErrorMessage(
  error: unknown,
  mode: PayloadImportMode,
  ct: (key: LuthierCopyKey) => string
): string {
  if (error instanceof OrchestratorPayloadError) {
    if (error.code === 'invalid_json') {
      return ct('luthier_import_payload_invalid_json')
    }

    if (error.code === 'invalid_game_config') {
      return ct('luthier_import_payload_invalid_schema')
    }

    if (error.code === 'container_not_found') {
      return ct('luthier_import_payload_orchestrator_not_detected')
    }

    if (
      error.code === 'container_truncated' ||
      error.code === 'invalid_length' ||
      error.code === 'invalid_checksum' ||
      error.code === 'invalid_manifest' ||
      error.code === 'missing_config_asset' ||
      error.code === 'duplicate_asset_type' ||
      error.code === 'asset_out_of_bounds'
    ) {
      return ct('luthier_import_payload_orchestrator_corrupted')
    }

    return fallbackByMode(mode, ct)
  }

  const rawMessage = (error instanceof Error ? error.message : String(error)).trim().toLowerCase()
  if (!rawMessage) {
    return fallbackByMode(mode, ct)
  }

  if (hasAny(rawMessage, ['asset container not found'])) {
    return ct('luthier_import_payload_orchestrator_not_detected')
  }

  if (
    hasAny(rawMessage, [
      'asset container is truncated',
      'container or asset length is invalid',
      'container integrity check failed',
      'invalid asset container manifest',
      'required embedded asset is missing',
      'duplicate asset type in manifest',
      'asset points outside allowed binary range',
      'invalid checksum',
    ])
  ) {
    return ct('luthier_import_payload_orchestrator_corrupted')
  }

  if (
    hasAny(rawMessage, [
      'invalid json',
      'json error',
      'expected value',
      'not valid utf-8',
      'payload json file is empty',
    ])
  ) {
    return ct('luthier_import_payload_invalid_json')
  }

  if (hasAny(rawMessage, ['invalid_game_config', 'gameconfig', 'must be'])) {
    return ct('luthier_import_payload_invalid_schema')
  }

  return fallbackByMode(mode, ct)
}

function fallbackByMode(mode: PayloadImportMode, ct: (key: LuthierCopyKey) => string): string {
  if (mode === 'payload_json') {
    return ct('luthier_import_payload_invalid_json')
  }

  return ct('luthier_import_payload_orchestrator_not_detected')
}

function hasAny(rawMessage: string, snippets: string[]): boolean {
  return snippets.some((snippet) => rawMessage.includes(snippet))
}
