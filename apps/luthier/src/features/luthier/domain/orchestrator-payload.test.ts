import { describe, expect, it } from 'vitest'

import { defaultGameConfig } from '../../../models/config'
import {
  extractPayloadJsonFromOrchestratorBytes,
  OrchestratorPayloadError,
  parseImportedGameConfigJson,
} from './orchestrator-payload'

const MAGIC = new TextEncoder().encode('GOCFGv1')

async function buildBinaryWithPayload(base: Uint8Array, payload: string): Promise<Uint8Array> {
  const payloadBytes = new TextEncoder().encode(payload)
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Test runtime without WebCrypto support')
  }

  const checksum = new Uint8Array(await subtle.digest('SHA-256', payloadBytes))
  const lenBytes = new Uint8Array(new BigUint64Array([BigInt(payloadBytes.length)]).buffer)

  const result = new Uint8Array(
    base.length + payloadBytes.length + MAGIC.length + 8 + checksum.length
  )
  let offset = 0
  result.set(base, offset)
  offset += base.length
  result.set(payloadBytes, offset)
  offset += payloadBytes.length
  result.set(MAGIC, offset)
  offset += MAGIC.length
  result.set(lenBytes, offset)
  offset += lenBytes.length
  result.set(checksum, offset)

  return result
}

describe('orchestrator payload parser', () => {
  it('extracts payload json from a valid orchestrator trailer', async () => {
    const payloadJson = JSON.stringify(defaultGameConfig())
    const binary = await buildBinaryWithPayload(new TextEncoder().encode('ELF-DEMO'), payloadJson)

    const extracted = await extractPayloadJsonFromOrchestratorBytes(binary)

    expect(extracted).toEqual(payloadJson)
  })

  it('rejects executables without trailer magic', async () => {
    const badBinary = new TextEncoder().encode('NOT-ORCHESTRATOR')

    await expect(extractPayloadJsonFromOrchestratorBytes(badBinary)).rejects.toMatchObject({
      code: 'trailer_truncated',
    })
  })

  it('rejects executables with corrupted checksum', async () => {
    const payloadJson = JSON.stringify(defaultGameConfig())
    const binary = await buildBinaryWithPayload(new TextEncoder().encode('ELF-DEMO'), payloadJson)
    binary[binary.length - 1] ^= 0x01

    await expect(extractPayloadJsonFromOrchestratorBytes(binary)).rejects.toMatchObject({
      code: 'invalid_checksum',
    })
  })

  it('parses imported payload json when game config shape is valid', () => {
    const payloadJson = JSON.stringify(defaultGameConfig())

    const parsed = parseImportedGameConfigJson(payloadJson)

    expect(parsed.game_name).toEqual('')
    expect(parsed.requirements.runtime.primary).toEqual('ProtonUmu')
  })

  it('rejects malformed payload json', () => {
    expect(() => parseImportedGameConfigJson('{"game_name"')).toThrow(OrchestratorPayloadError)
  })

  it('rejects payload json without required game config fields', () => {
    expect(() => parseImportedGameConfigJson('{"foo":"bar"}')).toThrow(OrchestratorPayloadError)
  })
})
