export function normalizeDroppedPath(rawPath: string): string {
  const trimmed = rawPath.trim()
  if (!trimmed.startsWith('file://')) {
    return trimmed
  }

  try {
    const url = new URL(trimmed)
    return decodeURIComponent(url.pathname)
  } catch {
    return trimmed.replace(/^file:\/\//, '')
  }
}

export function basenamePath(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash < 0) return normalized
  return normalized.slice(lastSlash + 1)
}

export function formatBytes(sizeInBytes: number): string {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
    return '0 KB'
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`
}
