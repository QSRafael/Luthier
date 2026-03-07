export type DataUrlBinary = {
  mime: string
  bytes: Uint8Array
}

const DATA_URL_BASE64_RE = /^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i

export function decodeDataUrlToBinary(dataUrl: string): DataUrlBinary | null {
  const trimmed = dataUrl.trim()
  const match = DATA_URL_BASE64_RE.exec(trimmed)
  if (!match) return null

  const mime = (match[1] ?? '').trim().toLowerCase()
  const payload = (match[2] ?? '').replace(/\s+/g, '')
  if (!mime || !payload) return null

  const bytes = decodeBase64(payload)
  return { mime, bytes }
}

function decodeBase64(payload: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    const decoded = globalThis.atob(payload)
    const bytes = new Uint8Array(decoded.length)
    for (let idx = 0; idx < decoded.length; idx += 1) {
      bytes[idx] = decoded.charCodeAt(idx)
    }
    return bytes
  }

  // Node/Vitest fallback.
  const maybeBuffer = (
    globalThis as unknown as {
      Buffer?: { from: (value: string, encoding: 'base64') => Uint8Array }
    }
  ).Buffer
  if (maybeBuffer) {
    return Uint8Array.from(maybeBuffer.from(payload, 'base64'))
  }

  throw new Error('base64 decoder is not available in this runtime')
}
