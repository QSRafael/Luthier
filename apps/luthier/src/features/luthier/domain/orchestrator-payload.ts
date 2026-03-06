import type { GameConfig } from '../../../models/config'

const TRAILER_MAGIC = new TextEncoder().encode('GOCFGv1')
const JSON_LEN_BYTES = 8
const SHA256_BYTES = 32
const TRAILER_BYTES = TRAILER_MAGIC.length + JSON_LEN_BYTES + SHA256_BYTES

export type OrchestratorPayloadErrorCode =
  | 'trailer_not_found'
  | 'trailer_truncated'
  | 'invalid_length'
  | 'invalid_checksum'
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
  if (binary.length < TRAILER_BYTES) {
    throw new OrchestratorPayloadError(
      'trailer_truncated',
      'Binary is smaller than the payload trailer size.'
    )
  }

  const trailerStart = binary.length - TRAILER_BYTES
  const magicStart = trailerStart
  const magicEnd = magicStart + TRAILER_MAGIC.length

  if (!equalBytes(binary.subarray(magicStart, magicEnd), TRAILER_MAGIC)) {
    throw new OrchestratorPayloadError(
      'trailer_not_found',
      'Executable does not contain the Luthier Orchestrator payload trailer.'
    )
  }

  const configLenStart = magicEnd
  const configLenEnd = configLenStart + JSON_LEN_BYTES
  const configLen = readLeU64AsSafeNumber(binary.subarray(configLenStart, configLenEnd))

  if (configLen < 0 || configLen > trailerStart) {
    throw new OrchestratorPayloadError(
      'invalid_length',
      'Payload length encoded in trailer is invalid.'
    )
  }

  const jsonStart = trailerStart - configLen
  const jsonBytes = binary.subarray(jsonStart, trailerStart)

  const expectedChecksum = binary.subarray(configLenEnd, configLenEnd + SHA256_BYTES)
  const actualChecksum = await sha256(jsonBytes)
  if (!equalBytes(expectedChecksum, actualChecksum)) {
    throw new OrchestratorPayloadError(
      'invalid_checksum',
      'Executable payload checksum does not match trailer metadata.'
    )
  }

  return new TextDecoder().decode(jsonBytes)
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
  requireString(splash, 'hero_image_data_url')

  const scripts = parsed.scripts as Record<string, unknown>
  requireString(scripts, 'pre_launch')
  requireString(scripts, 'post_launch')

  return parsed as GameConfig
}

function readLeU64AsSafeNumber(bytes: Uint8Array): number {
  if (bytes.length !== JSON_LEN_BYTES) {
    throw new OrchestratorPayloadError('invalid_length', 'Trailer length field is malformed.')
  }

  let acc = 0n
  for (let idx = 0; idx < JSON_LEN_BYTES; idx += 1) {
    acc |= BigInt(bytes[idx] ?? 0) << (8n * BigInt(idx))
  }

  if (acc > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new OrchestratorPayloadError(
      'invalid_length',
      'Trailer length exceeds JavaScript safe integer range.'
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
