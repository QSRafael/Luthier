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
import type { GameConfig } from '../../../models/config'
import { cn } from '../../../lib/cva'
import {
  importConfigFromOrchestratorFile,
  importConfigFromPayloadFile,
} from '../application/use-cases/payload-import'
import type { LuthierCopyKey } from '../copy'
import { OrchestratorPayloadError } from '../domain/orchestrator-payload'
import { sonnerNotifier } from '../infrastructure/sonner-notifier'

export type PayloadDialogMode = 'payload_json' | 'orchestrator_executable'

type PayloadFileDialogProps = {
  open: boolean
  mode: PayloadDialogMode
  ct: (key: LuthierCopyKey) => string
  ctf: (key: LuthierCopyKey, params: Record<string, string | number>) => string
  onOpenChange: (open: boolean) => void
  onConfigImported: (payload: {
    source: 'json' | 'orchestrator'
    fileName: string
    config: GameConfig
  }) => void
}

export function PayloadFileDialog(props: PayloadFileDialogProps) {
  let fileInputRef: HTMLInputElement | undefined

  const [selectedFile, setSelectedFile] = createSignal<File | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [errorMessage, setErrorMessage] = createSignal('')
  const [dragActive, setDragActive] = createSignal(false)

  createEffect(() => {
    if (!props.open) {
      setSelectedFile(null)
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

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const [file] = Array.from(files)
    if (!file) return

    if (props.mode === 'payload_json' && !isJsonFile(file)) {
      const message = props.ct('luthier_import_payload_json_required')
      setErrorMessage(message)
      sonnerNotifier.notify(message, { tone: 'error' })
      return
    }

    setSelectedFile(file)
    setErrorMessage('')
  }

  const removeSelectedFile = () => {
    setSelectedFile(null)
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
    const currentFile = selectedFile()
    if (!currentFile || busy()) return

    const confirmationMessage = props.ctf('luthier_import_payload_confirm_replace_file', {
      fileName: currentFile.name,
    })

    if (!window.confirm(confirmationMessage)) {
      return
    }

    setBusy(true)
    setErrorMessage('')

    try {
      const importedConfig =
        props.mode === 'payload_json'
          ? await importConfigFromPayloadFile(currentFile)
          : await importConfigFromOrchestratorFile(currentFile)

      props.onConfigImported({
        source: props.mode === 'payload_json' ? 'json' : 'orchestrator',
        fileName: currentFile.name,
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
              onChange={(event) => handleFileSelection(event.currentTarget.files)}
            />
          </div>

          <Show when={selectedFile()} keyed>
            {(file) => (
              <div class="mt-4 rounded-lg border border-border bg-card p-3">
                <div class="flex items-center gap-3">
                  <div class="inline-flex size-10 items-center justify-center rounded-md bg-muted">
                    <IconFile class="size-5 text-muted-foreground" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p class="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="text-muted-foreground hover:text-destructive"
                    onClick={removeSelectedFile}
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

          <Show when={errorMessage()}>
            {(message) => (
              <Alert variant="destructive" class="mt-4">
                <AlertTitle>{props.ct('luthier_import_payload_failed_title')}</AlertTitle>
                <AlertDescription>{message()}</AlertDescription>
              </Alert>
            )}
          </Show>
        </div>

        <DialogFooter class="rounded-b-xl border-t border-border bg-muted/35 px-6 py-3">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            {props.ct('luthier_label_cancel')}
          </Button>
          <Button type="button" onClick={runImport} disabled={!selectedFile() || busy()}>
            <Show when={busy()} fallback={props.ct('luthier_continue')}>
              <span class="inline-flex items-center gap-2">
                <Spinner class="size-4" />
                {props.ct('luthier_import_payload_processing')}
              </span>
            </Show>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function isJsonFile(file: File): boolean {
  const lowerName = file.name.toLowerCase()
  return lowerName.endsWith('.json') || file.type.includes('json')
}

function formatBytes(sizeInBytes: number): string {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
    return '0 KB'
  }

  const sizeInKb = sizeInBytes / 1024
  if (sizeInKb < 1024) {
    return `${Math.max(1, Math.round(sizeInKb))} KB`
  }

  const sizeInMb = sizeInKb / 1024
  return `${sizeInMb.toFixed(2)} MB`
}

function mapImportErrorMessage(
  error: unknown,
  mode: PayloadDialogMode,
  ct: (key: LuthierCopyKey) => string
): string {
  if (error instanceof OrchestratorPayloadError) {
    if (error.code === 'invalid_json') {
      return ct('luthier_import_payload_invalid_json')
    }

    if (error.code === 'invalid_game_config') {
      return ct('luthier_import_payload_invalid_schema')
    }

    if (mode === 'orchestrator_executable') {
      if (error.code === 'trailer_not_found' || error.code === 'trailer_truncated') {
        return ct('luthier_import_payload_orchestrator_not_detected')
      }
      if (error.code === 'invalid_checksum' || error.code === 'invalid_length') {
        return ct('luthier_import_payload_orchestrator_corrupted')
      }
    }
  }

  return `${ct('luthier_import_payload_unexpected_error')}: ${String(error)}`
}
