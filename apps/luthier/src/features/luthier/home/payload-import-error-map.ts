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

    if (error.code === 'trailer_not_found') {
      return ct('luthier_import_payload_orchestrator_not_detected')
    }

    if (
      error.code === 'trailer_truncated' ||
      error.code === 'invalid_length' ||
      error.code === 'invalid_checksum'
    ) {
      return ct('luthier_import_payload_orchestrator_corrupted')
    }

    return fallbackByMode(mode, ct)
  }

  const rawMessage = (error instanceof Error ? error.message : String(error)).trim().toLowerCase()
  if (!rawMessage) {
    return fallbackByMode(mode, ct)
  }

  if (hasAny(rawMessage, ['payload trailer not found'])) {
    return ct('luthier_import_payload_orchestrator_not_detected')
  }

  if (
    hasAny(rawMessage, [
      'payload trailer is truncated',
      'payload length is invalid',
      'payload integrity check failed',
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
