import { describe, expect, it } from 'vitest'

import { defaultGameConfig } from '../../../models/config'
import {
  extractPayloadJsonFromOrchestratorBytes,
  OrchestratorPayloadError,
  parseImportedGameConfigJson,
} from './orchestrator-payload'

const MAGIC = new TextEncoder().encode('GOASv2')

type AssetEntry = {
  type: 'config_json' | 'hero_image' | 'icon_png'
  offset: number
  len: number
  sha256_hex: string
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Test runtime without WebCrypto support')
  }
  const digestInput = new Uint8Array(bytes.byteLength)
  digestInput.set(bytes)
  const digest = new Uint8Array(await subtle.digest('SHA-256', digestInput.buffer))
  return [...digest].map((v) => v.toString(16).padStart(2, '0')).join('')
}

async function buildBinaryWithAssets(
  base: Uint8Array,
  configJson: string,
  heroImage?: Uint8Array,
  iconPng?: Uint8Array
): Promise<Uint8Array> {
  const configBytes = new TextEncoder().encode(configJson)
  const chunks: Uint8Array[] = [base]
  const entries: AssetEntry[] = []

  let offset = base.length
  const pushAsset = async (type: AssetEntry['type'], bytes: Uint8Array) => {
    entries.push({
      type,
      offset,
      len: bytes.length,
      sha256_hex: await sha256Hex(bytes),
    })
    chunks.push(bytes)
    offset += bytes.length
  }

  await pushAsset('config_json', configBytes)
  if (heroImage) await pushAsset('hero_image', heroImage)
  if (iconPng) await pushAsset('icon_png', iconPng)

  const manifestJson = JSON.stringify({ version: 2, entries })
  const manifestBytes = new TextEncoder().encode(manifestJson)
  const manifestDigestInput = new Uint8Array(manifestBytes.byteLength)
  manifestDigestInput.set(manifestBytes)
  const manifestChecksum = new Uint8Array(
    await globalThis.crypto!.subtle.digest('SHA-256', manifestDigestInput.buffer)
  )
  const lenBytes = new Uint8Array(new BigUint64Array([BigInt(manifestBytes.length)]).buffer)

  const totalLength =
    chunks.reduce((sum, part) => sum + part.length, 0) +
    manifestBytes.length +
    MAGIC.length +
    lenBytes.length +
    manifestChecksum.length
  const result = new Uint8Array(totalLength)

  let writeOffset = 0
  for (const part of chunks) {
    result.set(part, writeOffset)
    writeOffset += part.length
  }
  result.set(manifestBytes, writeOffset)
  writeOffset += manifestBytes.length
  result.set(MAGIC, writeOffset)
  writeOffset += MAGIC.length
  result.set(lenBytes, writeOffset)
  writeOffset += lenBytes.length
  result.set(manifestChecksum, writeOffset)

  return result
}

describe('orchestrator payload parser', () => {
  it('extracts payload json from a valid GOASv2 asset container', async () => {
    const payloadJson = JSON.stringify(defaultGameConfig())
    const binary = await buildBinaryWithAssets(new TextEncoder().encode('ELF-DEMO'), payloadJson)

    const extracted = await extractPayloadJsonFromOrchestratorBytes(binary)

    expect(extracted).toEqual(payloadJson)
  })

  it('rejects executables without GOASv2 magic', async () => {
    const badBinary = new TextEncoder().encode('NOT-ORCHESTRATOR')

    await expect(extractPayloadJsonFromOrchestratorBytes(badBinary)).rejects.toMatchObject({
      code: 'container_truncated',
    })
  })

  it('rejects executables with corrupted checksum', async () => {
    const payloadJson = JSON.stringify(defaultGameConfig())
    const binary = await buildBinaryWithAssets(new TextEncoder().encode('ELF-DEMO'), payloadJson)
    binary[10] ^= 0x01

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
