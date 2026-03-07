import type { GameConfig } from '../../../models/config'

const HERO_IMAGE_MASKED_HINT = 'base-64 image. use --show-base64-hero-image to see'
const WINDOWS_LAUNCHER_EXTENSIONS = /\.(exe|bat|cmd|com)$/i

export type ImportedRuntimePaths = {
  gameRoot: string
  exePath: string
  gameRootManualOverride: boolean
}

export function shouldRefreshImportedHeroImage(importedConfig: GameConfig): boolean {
  const heroImageUrl = importedConfig.splash.hero_image_url.trim()
  if (!heroImageUrl) {
    return false
  }

  const heroImageDataUrl = importedConfig.splash.hero_image_data_url.trim()
  if (!heroImageDataUrl) {
    return true
  }

  if (heroImageDataUrl.startsWith('data:image/')) {
    return false
  }

  return heroImageDataUrl.toLowerCase().startsWith(HERO_IMAGE_MASKED_HINT)
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
  mainExecutablePath: string
): ImportedRuntimePaths | null {
  const normalizedExePath = normalizePath(mainExecutablePath)
  if (!isLikelyAbsolutePath(normalizedExePath)) return null
  if (!WINDOWS_LAUNCHER_EXTENSIONS.test(basename(normalizedExePath))) return null

  const gameRoot = dirname(normalizedExePath)
  if (!gameRoot) return null

  return {
    gameRoot,
    exePath: normalizedExePath,
    gameRootManualOverride: false,
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
