import type { OpenDialogOptions } from '@tauri-apps/api/dialog'

export type PrepareHeroImageOutput = {
  source_url: string
  data_url: string
  width: number
  height: number
}

export type SearchHeroImageOutput = {
  game_id?: number
  image_url: string
  candidate_image_urls?: string[]
}
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return typeof w.__TAURI_IPC__ !== 'undefined' || typeof w.__TAURI__ !== 'undefined'
}

export async function invokeCommand<T>(command: string, input?: unknown): Promise<T> {
  const tauri = await import('@tauri-apps/api/tauri')
  if (typeof input === 'undefined') {
    return tauri.invoke<T>(command)
  }
  return tauri.invoke<T>(command, { input })
}

export async function pickFile(options: OpenDialogOptions = {}): Promise<string | null> {
  try {
    const dialog = await import('@tauri-apps/api/dialog')
    const selection = await dialog.open({ multiple: false, ...options })
    return typeof selection === 'string' ? selection : null
  } catch (error) {
    if (isTauriRuntime()) {
      throw error
    }
    return browserPickFile(options)
  }
}

export async function pickFolder(options: OpenDialogOptions = {}): Promise<string | null> {
  try {
    const dialog = await import('@tauri-apps/api/dialog')
    const selection = await dialog.open({ multiple: false, directory: true, ...options })
    return typeof selection === 'string' ? selection : null
  } catch (error) {
    if (isTauriRuntime()) {
      throw error
    }
    return browserPickFolder(options)
  }
}

function browserPickFile(options: OpenDialogOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'

    const accept = options.filters
      ?.flatMap((filter) => filter.extensions ?? [])
      .map((ext) => ext.trim())
      .filter(Boolean)
      .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`))
      .join(',')

    if (accept) {
      input.accept = accept
    }

    input.onchange = () => {
      const file = input.files?.[0]
      resolve(file?.name ?? null)
    }

    input.oncancel = () => resolve(null)
    input.click()
  })
}

function browserPickFolder(options: OpenDialogOptions = {}): Promise<string | null> {
  const title = options.title ?? 'Informe o caminho da pasta'
  const value = window.prompt(title, '')
  const normalized = value?.trim()
  return Promise.resolve(normalized ? normalized : null)
}
