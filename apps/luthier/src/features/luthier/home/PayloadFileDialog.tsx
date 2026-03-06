import { Show, createEffect, createSignal } from 'solid-js'
import { IconFile, IconTrash, IconUpload } from '@tabler/icons-solidjs'

import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { Spinner } from '../../../components/ui/spinner'
import { cn } from '../../../lib/cva'
import type { GameConfig } from '../../../models/config'
import {
  importConfigFromOrchestratorFile,
  importConfigFromPayloadFile,
} from '../application/use-cases/payload-import'
import type { LuthierCopyKey } from '../copy'
import { OrchestratorPayloadError } from '../domain/orchestrator-payload'
import {
  importConfigFromOrchestratorPath,
  importConfigFromPayloadPath,
  listenTauriFileDrop,
} from '../infrastructure/payload-import-tauri'
import { sonnerNotifier } from '../infrastructure/sonner-notifier'
import { basenamePath, formatBytes, normalizeDroppedPath } from './payload-file-path'

export type PayloadDialogMode = 'payload_json' | 'orchestrator_executable'

type PayloadFileDialogProps = {
  open: boolean
  mode: PayloadDialogMode
  ct: (key: LuthierCopyKey) => string
  onOpenChange: (open: boolean) => void
  onConfigImported: (payload: {
    source: 'json' | 'orchestrator'
    fileName: string
    config: GameConfig
  }) => void
}

type SelectedInput =
  | {
      kind: 'browser_file'
      file: File
      fileName: string
      secondaryText: string
    }
  | {
      kind: 'tauri_path'
      path: string
      fileName: string
      secondaryText: string
    }

export function PayloadFileDialog(props: PayloadFileDialogProps) {
  let fileInputRef: HTMLInputElement | undefined

  const [selectedInput, setSelectedInput] = createSignal<SelectedInput | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [errorMessage, setErrorMessage] = createSignal('')
  const [dragActive, setDragActive] = createSignal(false)

  createEffect(() => {
    if (!props.open) {
      setSelectedInput(null)
      setErrorMessage('')
      setBusy(false)
      setDragActive(false)
      if (fileInputRef) {
        fileInputRef.value = ''
      }
    }
  })

  createEffect(() => {
    if (!props.open) return

    const preventWindowDrop = (event: DragEvent) => {
      event.preventDefault()
    }

    window.addEventListener('dragover', preventWindowDrop)
    window.addEventListener('drop', preventWindowDrop)

    return () => {
      window.removeEventListener('dragover', preventWindowDrop)
      window.removeEventListener('drop', preventWindowDrop)
    }
  })

  createEffect(() => {
    if (!props.open) return

    let disposed = false
    let unlisten: (() => void) | null = null

    void (async () => {
      try {
        unlisten = await listenTauriFileDrop((event) => {
          if (disposed || busy()) return

          if (event.type === 'hover') {
            setDragActive(true)
            return
          }

          if (event.type === 'cancel') {
            setDragActive(false)
            return
          }

          setDragActive(false)
          const [path] = event.paths
          if (!path) return
          handlePathSelection(path)
        })
      } catch {
        // Ignore listener setup errors and keep browser DnD path working.
      }
    })()

    return () => {
      disposed = true
      if (unlisten) {
        unlisten()
      }
    }
  })

  const preventDragDefaults = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDragEnter = (event: DragEvent) => {
    preventDragDefaults(event)
    if (busy()) return
    setDragActive(true)
  }

  const handleDragOver = (event: DragEvent) => {
    preventDragDefaults(event)
    if (busy()) return
    setDragActive(true)
  }

  const handleDragLeave = (event: DragEvent) => {
    preventDragDefaults(event)
    if (!dragActive()) return

    const currentTarget = event.currentTarget as HTMLElement | null
    const nextTarget = event.relatedTarget as Node | null
    if (currentTarget && nextTarget && currentTarget.contains(nextTarget)) {
      return
    }

    setDragActive(false)
  }

  const handleDrop = (event: DragEvent) => {
    preventDragDefaults(event)
    if (busy()) return

    setDragActive(false)
    const files = event.dataTransfer?.files ?? null
    handleFileSelection(files)
  }

  const handlePathSelection = (rawPath: string) => {
    if (!rawPath.trim()) return

    const normalizedPath = normalizeDroppedPath(rawPath)
    const fileName = basenamePath(normalizedPath)
    setSelectedInput({
      kind: 'tauri_path',
      path: normalizedPath,
      fileName,
      secondaryText: normalizedPath,
    })
    setErrorMessage('')
  }

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const [file] = Array.from(files)
    if (!file) return
    setSelectedInput({
      kind: 'browser_file',
      file,
      fileName: file.name,
      secondaryText: formatBytes(file.size),
    })
    setErrorMessage('')
  }

  const removeSelectedInput = () => {
    setSelectedInput(null)
    setErrorMessage('')
    if (fileInputRef) {
      fileInputRef.value = ''
    }
  }

  const openNativePicker = () => {
    if (busy()) return
    fileInputRef?.click()
  }

  const runImport = async () => {
    const currentInput = selectedInput()
    if (!currentInput || busy()) return

    setBusy(true)
    setErrorMessage('')

    try {
      const importedConfig = await loadConfigFromSelectedInput(currentInput, props.mode)

      props.onConfigImported({
        source: props.mode === 'payload_json' ? 'json' : 'orchestrator',
        fileName: currentInput.fileName,
        config: importedConfig,
      })

      sonnerNotifier.notify(props.ct('luthier_import_payload_success'), { tone: 'success' })
      props.onOpenChange(false)
    } catch (error) {
      const friendlyMessage = mapImportErrorMessage(error, props.mode, props.ct)
      setErrorMessage(friendlyMessage)
      sonnerNotifier.notify(friendlyMessage, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const titleKey =
    props.mode === 'payload_json'
      ? 'luthier_home_import_payload_title'
      : 'luthier_home_extract_payload_title'

  const descriptionKey =
    props.mode === 'payload_json'
      ? 'luthier_home_import_payload_modal_description'
      : 'luthier_home_extract_payload_modal_description'

  const dropzonePrimaryTextKey =
    props.mode === 'payload_json'
      ? 'luthier_import_payload_dropzone_title_json'
      : 'luthier_import_payload_dropzone_title_orchestrator'

  const inputAccept = props.mode === 'payload_json' ? '.json,application/json,text/json' : undefined

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="max-w-xl p-0">
        <DialogHeader class="p-6 pb-4">
          <DialogTitle>{props.ct(titleKey)}</DialogTitle>
          <DialogDescription>{props.ct(descriptionKey)}</DialogDescription>
        </DialogHeader>

        <div class="px-6 pb-5">
          <div
            class={cn(
              'cursor-pointer rounded-md border-2 border-dashed border-border p-8 text-center transition-colors',
              busy() ? 'opacity-70' : 'hover:border-primary/40 hover:bg-muted/20',
              dragActive() && !busy() && 'border-primary/70 bg-primary/5'
            )}
            onClick={openNativePicker}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                openNativePicker()
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div class="mb-2 inline-flex rounded-full bg-muted p-3">
              <IconUpload class="size-5 text-muted-foreground" />
            </div>
            <p class="text-sm font-medium text-foreground">{props.ct(dropzonePrimaryTextKey)}</p>
            <p class="mt-1 text-sm text-muted-foreground">
              {props.ct('luthier_import_payload_dropzone_secondary')}{' '}
              <span class="font-medium text-primary">{props.ct('luthier_click_to_browse')}</span>
            </p>

            <input
              ref={fileInputRef}
              type="file"
              class="hidden"
              accept={inputAccept}
              onChange={(event) => {
                handleFileSelection(event.currentTarget.files)
              }}
            />
          </div>

          <Show when={selectedInput()} keyed>
            {(item) => (
              <div class="mt-4 rounded-lg border border-border bg-card p-3">
                <div class="flex items-center gap-3">
                  <div class="inline-flex size-10 items-center justify-center rounded-md bg-muted">
                    <IconFile class="size-5 text-muted-foreground" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-foreground">{item.fileName}</p>
                    <p class="truncate text-xs text-muted-foreground">{item.secondaryText}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="text-muted-foreground hover:text-destructive"
                    onClick={removeSelectedInput}
                    disabled={busy()}
                    aria-label={props.ct('luthier_label_remove')}
                    title={props.ct('luthier_label_remove')}
                  >
                    <IconTrash class="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </Show>

          <Show when={errorMessage().trim().length > 0}>
            <Alert variant="destructive" class="mt-4">
              <AlertTitle>{props.ct('luthier_import_payload_failed_title')}</AlertTitle>
              <AlertDescription>{errorMessage()}</AlertDescription>
            </Alert>
          </Show>
        </div>

        <DialogFooter class="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            {props.ct('luthier_label_cancel')}
          </Button>
          <Button type="button" onClick={runImport} disabled={!selectedInput() || busy()}>
            <Show when={busy()} fallback={props.ct('luthier_continue')}>
              <span class="inline-flex items-center gap-2">
                <Spinner class="size-4" />
                {props.ct('luthier_processing')}
              </span>
            </Show>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

async function loadConfigFromSelectedInput(
  input: SelectedInput,
  mode: PayloadDialogMode
): Promise<GameConfig> {
  if (input.kind === 'browser_file') {
    if (mode === 'payload_json') {
      return importConfigFromPayloadFile(input.file)
    }
    return importConfigFromOrchestratorFile(input.file)
  }

  if (mode === 'payload_json') {
    return importConfigFromPayloadPath(input.path)
  }
  return importConfigFromOrchestratorPath(input.path)
}

function mapImportErrorMessage(
  error: unknown,
  _mode: PayloadDialogMode,
  ct: (key: LuthierCopyKey) => string
): string {
  if (error instanceof OrchestratorPayloadError) {
    if (error.code === 'invalid_json') {
      return ct('luthier_import_payload_invalid_json')
    }

    if (error.code === 'invalid_game_config') {
      return ct('luthier_import_payload_invalid_schema')
    }

    if (error.code === 'trailer_not_found') {
      return ct('luthier_import_payload_orchestrator_not_detected')
    }

    if (
      error.code === 'trailer_truncated' ||
      error.code === 'invalid_length' ||
      error.code === 'invalid_checksum'
    ) {
      return ct('luthier_import_payload_orchestrator_corrupted')
    }

    if (error.message.trim()) {
      return `${ct('luthier_import_payload_failed_title')}\n${error.message}`
    }

    return ct('luthier_import_payload_failed_title')
  }

  const fallback = ct('luthier_import_payload_failed_title')

  const rawMessage = error instanceof Error ? error.message : String(error)
  if (!rawMessage.trim()) {
    return fallback
  }

  return `${fallback}\n${ct('luthier_import_payload_unexpected_error')}: ${rawMessage}`
}
