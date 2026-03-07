import type { GameConfig } from '../../../models/config'

const CONTAINER_MAGIC = new TextEncoder().encode('GOASv2')
const MANIFEST_LEN_BYTES = 8
const SHA256_BYTES = 32
const FOOTER_BYTES = CONTAINER_MAGIC.length + MANIFEST_LEN_BYTES + SHA256_BYTES

const CONTAINER_VERSION = 2
const ALLOWED_ASSET_TYPES = new Set<AssetType>(['config_json', 'hero_image', 'icon_png'])

type AssetType = 'config_json' | 'hero_image' | 'icon_png'

type ParsedManifest = {
  version: number
  entries: ParsedManifestEntry[]
}

type ParsedManifestEntry = {
  type: AssetType
  offset: number
  len: number
  sha256_hex: string
}

export type OrchestratorPayloadErrorCode =
  | 'container_not_found'
  | 'container_truncated'
  | 'invalid_manifest'
  | 'invalid_length'
  | 'invalid_checksum'
  | 'missing_config_asset'
  | 'duplicate_asset_type'
  | 'asset_out_of_bounds'
  | 'invalid_json'
  | 'invalid_game_config'
  | 'unsupported_crypto'

export class OrchestratorPayloadError extends Error {
  readonly code: OrchestratorPayloadErrorCode

  constructor(code: OrchestratorPayloadErrorCode, message: string) {
    super(message)
    this.name = 'OrchestratorPayloadError'
    this.code = code
  }
}

export async function extractPayloadJsonFromOrchestratorBytes(binary: Uint8Array): Promise<string> {
  if (binary.length < FOOTER_BYTES) {
    throw new OrchestratorPayloadError(
      'container_truncated',
      'Binary is smaller than the embedded asset container footer.'
    )
  }

  const footerStart = binary.length - FOOTER_BYTES
  const magicStart = footerStart
  const magicEnd = magicStart + CONTAINER_MAGIC.length
  if (!equalBytes(binary.subarray(magicStart, magicEnd), CONTAINER_MAGIC)) {
    throw new OrchestratorPayloadError(
      'container_not_found',
      'Executable does not contain an embedded GOASv2 asset container.'
    )
  }

  const manifestLenStart = magicEnd
  const manifestLenEnd = manifestLenStart + MANIFEST_LEN_BYTES
  const manifestLen = readLeU64AsSafeNumber(binary.subarray(manifestLenStart, manifestLenEnd))
  if (manifestLen <= 0 || manifestLen > footerStart) {
    throw new OrchestratorPayloadError(
      'invalid_length',
      'Manifest length encoded in container footer is invalid.'
    )
  }

  const manifestStart = footerStart - manifestLen
  const manifestBytes = binary.subarray(manifestStart, footerStart)
  const expectedManifestChecksum = binary.subarray(manifestLenEnd, manifestLenEnd + SHA256_BYTES)
  const actualManifestChecksum = await sha256(manifestBytes)
  if (!equalBytes(expectedManifestChecksum, actualManifestChecksum)) {
    throw new OrchestratorPayloadError(
      'invalid_checksum',
      'Manifest checksum does not match footer metadata.'
    )
  }

  const manifest = parseManifestJson(new TextDecoder().decode(manifestBytes))
  if (manifest.version !== CONTAINER_VERSION) {
    throw new OrchestratorPayloadError(
      'invalid_manifest',
      `Unsupported manifest version: ${manifest.version}.`
    )
  }

  const seenTypes = new Set<AssetType>()
  let configEntry: ParsedManifestEntry | null = null

  for (const entry of manifest.entries) {
    if (seenTypes.has(entry.type)) {
      throw new OrchestratorPayloadError(
        'duplicate_asset_type',
        `Manifest contains duplicated asset type "${entry.type}".`
      )
    }
    seenTypes.add(entry.type)

    const assetStart = entry.offset
    const assetEnd = safeAdd(assetStart, entry.len)
    if (assetStart < 0 || assetEnd > manifestStart) {
      throw new OrchestratorPayloadError(
        'asset_out_of_bounds',
        `Asset "${entry.type}" points outside the container data range.`
      )
    }

    const assetBytes = binary.subarray(assetStart, assetEnd)
    const expectedAssetChecksum = parseSha256Hex(entry.sha256_hex)
    const actualAssetChecksum = await sha256(assetBytes)
    if (!equalBytes(expectedAssetChecksum, actualAssetChecksum)) {
      throw new OrchestratorPayloadError(
        'invalid_checksum',
        `Asset checksum mismatch for "${entry.type}".`
      )
    }

    if (entry.type === 'config_json') {
      configEntry = entry
    }
  }

  if (!configEntry) {
    throw new OrchestratorPayloadError(
      'missing_config_asset',
      'Manifest does not contain required "config_json" asset.'
    )
  }

  const configBytes = binary.subarray(
    configEntry.offset,
    safeAdd(configEntry.offset, configEntry.len)
  )
  return new TextDecoder().decode(configBytes)
}

export function parseImportedGameConfigJson(raw: string): GameConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new OrchestratorPayloadError(
      'invalid_json',
      `Payload content is not valid JSON: ${String(error)}`
    )
  }

  if (!isRecord(parsed)) {
    throw new OrchestratorPayloadError(
      'invalid_game_config',
      'Payload JSON root must be an object.'
    )
  }

  requireNumber(parsed, 'config_version')
  requireString(parsed, 'created_by')
  requireString(parsed, 'game_name')
  requireString(parsed, 'exe_hash')
  requireString(parsed, 'relative_exe_path')
  requireArray(parsed, 'launch_args')
  requireObject(parsed, 'runner')
  requireObject(parsed, 'environment')
  requireObject(parsed, 'compatibility')
  requireObject(parsed, 'winecfg')
  requireArray(parsed, 'dependencies')
  requireArray(parsed, 'extra_system_dependencies')
  requireObject(parsed, 'requirements')
  requireArray(parsed, 'registry_keys')
  requireArray(parsed, 'integrity_files')
  requireArray(parsed, 'folder_mounts')
  requireObject(parsed, 'splash')
  requireObject(parsed, 'scripts')

  const runner = parsed.runner as Record<string, unknown>
  requireString(runner, 'proton_version')
  requireString(runner, 'runtime_preference')

  const environment = parsed.environment as Record<string, unknown>
  requireObject(environment, 'gamescope')
  requireObject(environment, 'custom_vars')

  const compatibility = parsed.compatibility as Record<string, unknown>
  requireArray(compatibility, 'wrapper_commands')

  const winecfg = parsed.winecfg as Record<string, unknown>
  requireArray(winecfg, 'dll_overrides')
  requireArray(winecfg, 'desktop_folders')
  requireArray(winecfg, 'drives')

  const requirements = parsed.requirements as Record<string, unknown>
  requireObject(requirements, 'runtime')
  const runtime = requirements.runtime as Record<string, unknown>
  requireArray(runtime, 'fallback_order')

  const splash = parsed.splash as Record<string, unknown>
  requireString(splash, 'hero_image_url')

  const scripts = parsed.scripts as Record<string, unknown>
  requireString(scripts, 'pre_launch')
  requireString(scripts, 'post_launch')

  return parsed as GameConfig
}

function parseManifestJson(raw: string): ParsedManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new OrchestratorPayloadError(
      'invalid_manifest',
      `Container manifest is not valid JSON: ${String(error)}`
    )
  }

  if (!isRecord(parsed)) {
    throw new OrchestratorPayloadError('invalid_manifest', 'Manifest root must be an object.')
  }

  if (typeof parsed.version !== 'number' || Number.isNaN(parsed.version)) {
    throw new OrchestratorPayloadError('invalid_manifest', 'Manifest "version" must be a number.')
  }
  if (!Array.isArray(parsed.entries)) {
    throw new OrchestratorPayloadError('invalid_manifest', 'Manifest "entries" must be an array.')
  }

  const entries = (parsed.entries as unknown[]).map((entry, index) =>
    parseManifestEntry(entry, index)
  )

  return {
    version: parsed.version as number,
    entries,
  }
}

function parseManifestEntry(raw: unknown, index: number): ParsedManifestEntry {
  if (!isRecord(raw)) {
    throw new OrchestratorPayloadError(
      'invalid_manifest',
      `Manifest entry #${index + 1} must be an object.`
    )
  }

  if (typeof raw.type !== 'string') {
    throw new OrchestratorPayloadError(
      'invalid_manifest',
      `Manifest entry #${index + 1} has invalid "type".`
    )
  }
  if (typeof raw.sha256_hex !== 'string') {
    throw new OrchestratorPayloadError(
      'invalid_manifest',
      `Manifest entry #${index + 1} has invalid "sha256_hex".`
    )
  }
  if (typeof raw.offset !== 'number' || Number.isNaN(raw.offset)) {
    throw new OrchestratorPayloadError(
      'invalid_manifest',
      `Manifest entry #${index + 1} has invalid "offset".`
    )
  }
  if (typeof raw.len !== 'number' || Number.isNaN(raw.len)) {
    throw new OrchestratorPayloadError(
      'invalid_manifest',
      `Manifest entry #${index + 1} has invalid "len".`
    )
  }

  const assetType = raw.type as string
  if (!ALLOWED_ASSET_TYPES.has(assetType as AssetType)) {
    throw new OrchestratorPayloadError(
      'invalid_manifest',
      `Manifest contains disallowed asset type "${assetType}".`
    )
  }

  const offset = requireSafeInteger(raw.offset, `entries[${index}].offset`)
  const len = requireSafeInteger(raw.len, `entries[${index}].len`)
  if (offset < 0 || len < 0) {
    throw new OrchestratorPayloadError(
      'invalid_length',
      `Manifest entry "${assetType}" has negative offset/len.`
    )
  }

  const sha256Hex = (raw.sha256_hex as string).trim()
  parseSha256Hex(sha256Hex)

  return {
    type: assetType as AssetType,
    offset,
    len,
    sha256_hex: sha256Hex,
  }
}

function requireSafeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value)) {
    throw new OrchestratorPayloadError(
      'invalid_length',
      `Field "${label}" must be a finite integer.`
    )
  }
  if (value > Number.MAX_SAFE_INTEGER) {
    throw new OrchestratorPayloadError(
      'invalid_length',
      `Field "${label}" exceeds JavaScript safe integer range.`
    )
  }
  return value
}

function parseSha256Hex(raw: string): Uint8Array {
  const value = raw.trim()
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new OrchestratorPayloadError(
      'invalid_manifest',
      'Manifest checksum fields must be 64-char SHA-256 hex.'
    )
  }

  const out = new Uint8Array(32)
  for (let idx = 0; idx < out.length; idx += 1) {
    const hi = fromHexNibble(value.charCodeAt(idx * 2))
    const lo = fromHexNibble(value.charCodeAt(idx * 2 + 1))
    out[idx] = (hi << 4) | lo
  }
  return out
}

function fromHexNibble(code: number): number {
  if (code >= 0x30 && code <= 0x39) return code - 0x30
  if (code >= 0x41 && code <= 0x46) return code - 0x41 + 10
  if (code >= 0x61 && code <= 0x66) return code - 0x61 + 10
  throw new OrchestratorPayloadError('invalid_manifest', 'Invalid hex value in checksum.')
}

function safeAdd(left: number, right: number): number {
  const sum = left + right
  if (!Number.isFinite(sum) || sum > Number.MAX_SAFE_INTEGER) {
    throw new OrchestratorPayloadError(
      'invalid_length',
      'Container asset offset/len overflows JavaScript safe integer range.'
    )
  }
  return sum
}

function readLeU64AsSafeNumber(bytes: Uint8Array): number {
  if (bytes.length !== MANIFEST_LEN_BYTES) {
    throw new OrchestratorPayloadError(
      'invalid_length',
      'Footer manifest length field is malformed.'
    )
  }

  let acc = 0n
  for (let idx = 0; idx < MANIFEST_LEN_BYTES; idx += 1) {
    acc |= BigInt(bytes[idx] ?? 0) << (8n * BigInt(idx))
  }

  if (acc > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new OrchestratorPayloadError(
      'invalid_length',
      'Footer manifest length exceeds JavaScript safe integer range.'
    )
  }

  return Number(acc)
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new OrchestratorPayloadError(
      'unsupported_crypto',
      'WebCrypto API is not available in this runtime.'
    )
  }

  const digestInput = new Uint8Array(bytes.byteLength)
  digestInput.set(bytes)
  const digest = await subtle.digest('SHA-256', digestInput)
  return new Uint8Array(digest)
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let idx = 0; idx < a.length; idx += 1) {
    if (a[idx] !== b[idx]) return false
  }
  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireObject(value: Record<string, unknown>, key: string): void {
  if (!isRecord(value[key])) {
    throw new OrchestratorPayloadError(
      'invalid_game_config',
      `Field "${key}" must be an object in imported payload.`
    )
  }
}

function requireArray(value: Record<string, unknown>, key: string): void {
  if (!Array.isArray(value[key])) {
    throw new OrchestratorPayloadError(
      'invalid_game_config',
      `Field "${key}" must be an array in imported payload.`
    )
  }
}

function requireString(value: Record<string, unknown>, key: string): void {
  if (typeof value[key] !== 'string') {
    throw new OrchestratorPayloadError(
      'invalid_game_config',
      `Field "${key}" must be a string in imported payload.`
    )
  }
}

function requireNumber(value: Record<string, unknown>, key: string): void {
  if (typeof value[key] !== 'number' || Number.isNaN(value[key])) {
    throw new OrchestratorPayloadError(
      'invalid_game_config',
      `Field "${key}" must be a valid number in imported payload.`
    )
  }
}
