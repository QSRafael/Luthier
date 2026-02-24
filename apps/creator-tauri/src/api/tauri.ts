import type { OpenDialogOptions } from '@tauri-apps/api/dialog'

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
  } catch {
    return browserPickFile(false)
  }
}

export async function pickFolder(options: OpenDialogOptions = {}): Promise<string | null> {
  try {
    const dialog = await import('@tauri-apps/api/dialog')
    const selection = await dialog.open({ multiple: false, directory: true, ...options })
    return typeof selection === 'string' ? selection : null
  } catch {
    return browserPickFile(true)
  }
}

function browserPickFile(directory: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (directory) {
      input.setAttribute('webkitdirectory', '')
    }

    input.onchange = () => {
      const file = input.files?.[0]
      resolve(file?.name ?? null)
    }

    input.oncancel = () => resolve(null)
    input.click()
  })
}
