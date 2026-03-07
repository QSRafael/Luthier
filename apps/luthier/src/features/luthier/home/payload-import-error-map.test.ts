import { describe, expect, it } from 'vitest'

import type { LuthierCopyKey } from '../copy'
import { OrchestratorPayloadError } from '../domain/orchestrator-payload'
import { mapPayloadImportErrorMessage } from './payload-import-error-map'

const messageMap = {
  luthier_import_payload_invalid_json: 'JSON inválido',
  luthier_import_payload_invalid_schema: 'Schema inválido',
  luthier_import_payload_orchestrator_not_detected: 'Não é Luthier Orchestrator',
  luthier_import_payload_orchestrator_corrupted: 'Orquestrador corrompido',
} as const

const ct = (key: LuthierCopyKey): string => {
  const value = messageMap[key as keyof typeof messageMap]
  return value ?? String(key)
}

describe('payload import error mapping', () => {
  it('maps backend container-not-found error to friendly orchestrator message', () => {
    const message = mapPayloadImportErrorMessage(
      new Error('failed to extract payload from orchestrator: embedded asset container not found'),
      'orchestrator_executable',
      ct
    )

    expect(message).toBe('Não é Luthier Orchestrator')
  })

  it('maps invalid utf-8 payload-json errors to friendly json message', () => {
    const message = mapPayloadImportErrorMessage(
      new Error('failed to read payload json file: payload json file is not valid UTF-8'),
      'payload_json',
      ct
    )

    expect(message).toBe('JSON inválido')
  })

  it('maps orchestrator payload parser error codes', () => {
    const message = mapPayloadImportErrorMessage(
      new OrchestratorPayloadError('invalid_game_config', 'Field "runner" is missing.'),
      'payload_json',
      ct
    )

    expect(message).toBe('Schema inválido')
  })

  it('uses mode fallback for unknown backend messages', () => {
    expect(
      mapPayloadImportErrorMessage(new Error('permission denied'), 'orchestrator_executable', ct)
    ).toBe('Não é Luthier Orchestrator')

    expect(mapPayloadImportErrorMessage(new Error('permission denied'), 'payload_json', ct)).toBe(
      'JSON inválido'
    )
  })
})
