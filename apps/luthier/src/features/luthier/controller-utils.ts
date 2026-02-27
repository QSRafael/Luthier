import type { FeatureState, RuntimePrimary } from '../../models/config'

export const ORCHESTRATOR_BASE_PATH = './target/debug/luthier-orchestrator'

export const RUNTIME_CANDIDATES: RuntimePrimary[] = ['ProtonUmu', 'ProtonNative', 'Wine']
export const DLL_MODES = [
  'builtin',
  'native',
  'builtin,native',
  'native,builtin',
  'disabled',
] as const
export const AUDIO_DRIVERS = ['__none__', 'pipewire', 'pulseaudio', 'alsa'] as const
export const UPSCALE_METHODS = ['fsr', 'nis', 'integer', 'stretch'] as const
export const WINDOW_TYPES = ['fullscreen', 'borderless', 'windowed'] as const
const PREFIX_HASH_KEY_LENGTH = 12

export type AudioDriverOption = (typeof AUDIO_DRIVERS)[number]
export type UpscaleMethod = (typeof UPSCALE_METHODS)[number]
export type GamescopeWindowType = (typeof WINDOW_TYPES)[number]

export function replaceAt<T>(items: T[], index: number, next: T): T[] {
  return items.map((item, current) => (current === index ? next : item))
}

export function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, current) => current !== index)
}

export function splitCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function joinCommaList(items: string[]): string {
  return items.join(', ')
}

function normalizePath(raw: string): string {
  return raw.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

export function dirname(raw: string): string {
  const normalized = normalizePath(raw)
  const index = normalized.lastIndexOf('/')
  if (index <= 0) return normalized
  return normalized.slice(0, index)
}

export function basename(raw: string): string {
  const normalized = normalizePath(raw)
  const index = normalized.lastIndexOf('/')
  if (index < 0) return normalized
  return normalized.slice(index + 1)
}

export function stripLauncherExtension(raw: string): string {
  return raw.replace(/\.(exe|bat|cmd|com)$/i, '')
}

export function relativeFromRoot(root: string, path: string): string | null {
  const normalizedRoot = normalizePath(root)
  const normalizedPath = normalizePath(path)

  if (!normalizedRoot || !normalizedPath) return null
  if (normalizedPath === normalizedRoot) return '.'
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1)
  }

  return null
}

export function isFeatureEnabled(state: FeatureState): boolean {
  return state === 'MandatoryOn' || state === 'OptionalOn'
}

function splitPathSegments(raw: string): string[] {
  return normalizePath(raw).split('/').filter(Boolean)
}

function pathPrefix(raw: string): string {
  const normalized = normalizePath(raw)
  if (normalized.startsWith('/')) return '/'
  const driveMatch = normalized.match(/^[a-zA-Z]:/)
  return driveMatch?.[0].toLowerCase() ?? ''
}

export function relativePathBetween(fromPath: string, toPath: string): string | null {
  const fromNormalized = normalizePath(fromPath)
  const toNormalized = normalizePath(toPath)

  if (!fromNormalized || !toNormalized) return null
  if (pathPrefix(fromNormalized) !== pathPrefix(toNormalized)) return null

  const fromParts = splitPathSegments(fromNormalized)
  const toParts = splitPathSegments(toNormalized)

  let shared = 0
  while (
    shared < fromParts.length &&
    shared < toParts.length &&
    fromParts[shared] === toParts[shared]
  ) {
    shared += 1
  }

  const up = Array.from({ length: fromParts.length - shared }, () => '..')
  const down = toParts.slice(shared)
  const parts = [...up, ...down]
  return parts.length ? parts.join('/') : '.'
}

export function formatRelativeDirDisplay(relative: string | null): string {
  if (!relative || relative === '.') return './'
  return relative.endsWith('/') ? relative : `${relative}/`
}

export function isLikelyAbsolutePath(path: string): boolean {
  const trimmed = path.trim()
  return trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)
}

export function hasWindowsLauncherExtension(path: string): boolean {
  const lower = basename(path).toLowerCase()
  return ['.exe', '.bat', '.cmd', '.com'].some((ext) => lower.endsWith(ext))
}

export function prefixHashKey(rawHash: string): string {
  const trimmed = rawHash.trim()
  if (!trimmed) return trimmed

  // Keep placeholders/custom tokens intact; truncate only real hex hashes.
  if (!/^[0-9a-fA-F]+$/.test(trimmed)) return trimmed
  if (trimmed.length <= PREFIX_HASH_KEY_LENGTH) return trimmed

  return trimmed.slice(0, PREFIX_HASH_KEY_LENGTH)
}
