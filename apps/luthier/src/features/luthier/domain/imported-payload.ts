import type { GameConfig } from '../../../models/config'

const WINDOWS_LAUNCHER_EXTENSIONS = /\.(exe|bat|cmd|com)$/i

export type ImportedRuntimePaths = {
  gameRoot: string
  exePath: string
  gameRootManualOverride: boolean
}

export function shouldRefreshImportedHeroImage(importedConfig: GameConfig): boolean {
  return importedConfig.splash.hero_image_url.trim().length > 0
}

export function resolveSiblingMainExecutablePath(orchestratorPath: string): string | null {
  const normalizedSourcePath = normalizePath(orchestratorPath)
  if (!isLikelyAbsolutePath(normalizedSourcePath)) return null

  const orchestratorDir = dirname(normalizedSourcePath)
  const orchestratorName = basename(normalizedSourcePath)
  if (!orchestratorDir || !orchestratorName) return null

  const executableName = `${stripLauncherExtension(orchestratorName)}.exe`
  if (!executableName || executableName === '.exe') return null

  return joinPath(orchestratorDir, executableName)
}

export function deriveImportedRuntimePathsFromMainExecutable(
  mainExecutablePath: string,
  relativeExePath?: string
): ImportedRuntimePaths | null {
  const normalizedExePath = normalizePath(mainExecutablePath)
  if (!isLikelyAbsolutePath(normalizedExePath)) return null
  if (!WINDOWS_LAUNCHER_EXTENSIONS.test(basename(normalizedExePath))) return null

  const executableDir = dirname(normalizedExePath)
  if (!executableDir) return null

  const inferredGameRoot = inferGameRootFromRelativeExePath(
    normalizedExePath,
    executableDir,
    relativeExePath
  )
  const gameRoot = inferredGameRoot ?? executableDir

  return {
    gameRoot,
    exePath: normalizedExePath,
    gameRootManualOverride: gameRoot !== executableDir,
  }
}

function stripLauncherExtension(fileName: string): string {
  return fileName.replace(WINDOWS_LAUNCHER_EXTENSIONS, '')
}

function normalizePath(raw: string): string {
  const normalized = raw.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  if (normalized === '/') return '/'
  if (/^[A-Za-z]:\/$/.test(normalized)) return normalized
  return normalized.replace(/\/$/, '')
}

function isLikelyAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:\//.test(path)
}

function dirname(path: string): string {
  const normalized = normalizePath(path)
  const lastSlashIndex = normalized.lastIndexOf('/')
  if (lastSlashIndex < 0) return ''
  if (lastSlashIndex === 0) return '/'

  const head = normalized.slice(0, lastSlashIndex)
  if (/^[A-Za-z]:$/.test(head)) return `${head}/`
  return head
}

function basename(path: string): string {
  const normalized = normalizePath(path)
  const lastSlashIndex = normalized.lastIndexOf('/')
  if (lastSlashIndex < 0) return normalized
  return normalized.slice(lastSlashIndex + 1)
}

function joinPath(basePath: string, fileName: string): string {
  const normalizedBase = normalizePath(basePath)
  const normalizedFileName = fileName.trim().replace(/^\/+/, '')
  if (!normalizedBase) return normalizedFileName
  if (!normalizedFileName) return normalizedBase

  const baseWithoutTrailingSlash =
    normalizedBase.length > 1 && normalizedBase.endsWith('/')
      ? normalizedBase.slice(0, -1)
      : normalizedBase

  return `${baseWithoutTrailingSlash}/${normalizedFileName}`
}

function inferGameRootFromRelativeExePath(
  normalizedExePath: string,
  executableDir: string,
  relativeExePath?: string
): string | null {
  const normalizedRelativeExePath = normalizeRelativePath(relativeExePath)
  if (!normalizedRelativeExePath) return null

  const relativeSegments = normalizedRelativeExePath.split('/').filter(Boolean)
  if (relativeSegments.length === 0) return null

  const relativeExecutableName = relativeSegments[relativeSegments.length - 1]
  const currentExecutableName = basename(normalizedExePath)
  if (relativeExecutableName.toLowerCase() !== currentExecutableName.toLowerCase()) {
    return null
  }

  const relativeDir = relativeSegments.slice(0, -1).join('/')
  if (!relativeDir) return executableDir

  const suffixToStrip = `/${relativeDir}`
  const stripped = stripSuffixIgnoreCase(executableDir, suffixToStrip)
  return stripped ? normalizePath(stripped) : null
}

function normalizeRelativePath(raw?: string): string | null {
  if (!raw) return null

  let normalized = normalizePath(raw)
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }

  if (!normalized) return null
  if (isLikelyAbsolutePath(normalized)) return null

  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) return null
  if (segments.some((segment) => segment === '.' || segment === '..')) return null

  return segments.join('/')
}

function stripSuffixIgnoreCase(raw: string, suffix: string): string | null {
  const normalizedRaw = normalizePath(raw)
  const normalizedSuffix = normalizePath(suffix)
  if (!normalizedSuffix) return null

  const rawLower = normalizedRaw.toLowerCase()
  const suffixLower = normalizedSuffix.toLowerCase()
  if (!rawLower.endsWith(suffixLower)) return null

  const stripped = normalizedRaw.slice(0, normalizedRaw.length - normalizedSuffix.length)
  if (!stripped) return normalizedRaw.startsWith('/') ? '/' : null
  if (/^[A-Za-z]:$/.test(stripped)) return `${stripped}/`

  return stripped
}
