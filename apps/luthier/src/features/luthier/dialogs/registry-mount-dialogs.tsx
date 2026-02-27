import { createMemo, For, Show } from 'solid-js'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import type { LuthierPageSectionView } from '../page-shared'
import {
  validateRegistryPath,
  validateRegistryValueType,
  validateRelativeGamePath,
  validateWindowsPath,
} from '../field-validation'

type RegistryMountDialogsProps = {
  view: LuthierPageSectionView
}

export function RegistryMountDialogs(props: RegistryMountDialogsProps) {
  const { view } = props
  const {
    ct,
    config,
    patchConfig,
    registryDraft,
    setRegistryDraft,
    registryDialogOpen,
    setRegistryDialogOpen,
    mountDialogOpen,
    setMountDialogOpen,
    mountDraft,
    setMountDraft,
    registryImportWarningsOpen,
    setRegistryImportWarningsOpen,
    registryImportWarnings,
    formControlsI18n,
    canBrowseMountFolders,
    openMountSourceBrowser,
    locale,
  } = view

  const tForm = () => formControlsI18n()

  const registryPathValidationSafe = createMemo(() =>
    registryDraft().path.trim() ? validateRegistryPath(registryDraft().path, locale()) : {}
  )
  const registryTypeValidation = createMemo(() =>
    registryDraft().value_type.trim()
      ? validateRegistryValueType(registryDraft().value_type, locale())
      : {}
  )
  const registryDuplicateValidation = createMemo(() => {
    const path = registryDraft().path.trim().toLowerCase()
    const name = registryDraft().name.trim().toLowerCase()
    if (!path || !name) return ''
    const duplicate = config().registry_keys.some(
      (item) => item.path.trim().toLowerCase() === path && item.name.trim().toLowerCase() === name
    )
    if (!duplicate) return ''
    return ct('luthier_validation_duplicate_registry_key')
  })

  const mountSourceValidation = createMemo(() =>
    mountDraft().source_relative_path.trim()
      ? validateRelativeGamePath(mountDraft().source_relative_path, locale(), {
          kind: 'folder',
          allowDot: true,
          requireDotPrefix: false,
        })
      : {}
  )
  const mountTargetValidation = createMemo(() =>
    mountDraft().target_windows_path.trim()
      ? validateWindowsPath(mountDraft().target_windows_path, locale())
      : {}
  )
  const mountDuplicateValidation = createMemo(() => {
    const source = mountDraft().source_relative_path.trim()
    const target = mountDraft().target_windows_path.trim().toLowerCase()
    if (!source || !target) return ''
    const duplicateTarget = config().folder_mounts.some(
      (item) => item.target_windows_path.trim().toLowerCase() === target
    )
    if (duplicateTarget) {
      return ct('luthier_validation_duplicate_mount_target')
    }
    const duplicatePair = config().folder_mounts.some(
      (item) =>
        item.source_relative_path.trim() === source &&
        item.target_windows_path.trim().toLowerCase() === target
    )
    if (duplicatePair) {
      return ct('luthier_validation_duplicate_mount')
    }
    return ''
  })

  return (
    <>
      {/* ─── Registry Key Dialog ─── */}
      <Dialog open={registryDialogOpen()} onOpenChange={setRegistryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ct('luthier_add_registry_key')}</DialogTitle>
            <DialogDescription>{tForm().addKeyValueDialogDescription}</DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <label class="text-sm font-medium">{ct('luthier_registry_path')}</label>
              <Input
                value={registryDraft().path}
                class={
                  registryPathValidationSafe().error
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
                onInput={(e) =>
                  setRegistryDraft({ ...registryDraft(), path: e.currentTarget.value })
                }
                placeholder="HKEY_CURRENT_USER\Software\Wine"
              />
              <Show when={registryPathValidationSafe().error || registryPathValidationSafe().hint}>
                <p
                  class={
                    registryPathValidationSafe().error
                      ? 'text-xs text-destructive'
                      : 'text-xs text-muted-foreground'
                  }
                >
                  {registryPathValidationSafe().error ?? registryPathValidationSafe().hint}
                </p>
              </Show>
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium">{tForm().keyPlaceholder}</label>
              <Input
                value={registryDraft().name}
                onInput={(e) =>
                  setRegistryDraft({ ...registryDraft(), name: e.currentTarget.value })
                }
                placeholder="Version"
              />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium">{ct('luthier_windows_registry_value_type')}</label>
              <Select
                value={registryDraft().value_type}
                onInput={(e) =>
                  setRegistryDraft({ ...registryDraft(), value_type: e.currentTarget.value })
                }
              >
                <option value="REG_SZ">REG_SZ (String)</option>
                <option value="REG_DWORD">REG_DWORD (Integer)</option>
              </Select>
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium">{tForm().valuePlaceholder}</label>
              <Input
                value={registryDraft().value}
                onInput={(e) =>
                  setRegistryDraft({ ...registryDraft(), value: e.currentTarget.value })
                }
                placeholder="win10"
              />
            </div>
            <Show when={registryTypeValidation().error || registryTypeValidation().hint}>
              <p
                class={
                  registryTypeValidation().error
                    ? 'text-xs text-destructive'
                    : 'text-xs text-muted-foreground'
                }
              >
                {registryTypeValidation().error ?? registryTypeValidation().hint}
              </p>
            </Show>
            <Show when={registryDuplicateValidation()}>
              <p class="text-xs text-destructive">{registryDuplicateValidation()}</p>
            </Show>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRegistryDialogOpen(false)}>
              {tForm().cancel}
            </Button>
            <Button
              type="button"
              disabled={
                !registryDraft().path.trim() ||
                !registryDraft().name.trim() ||
                !!registryPathValidationSafe().error ||
                !!registryTypeValidation().error ||
                !!registryDuplicateValidation()
              }
              onClick={() => {
                const draft = registryDraft()
                if (
                  !draft.path.trim() ||
                  !draft.name.trim() ||
                  registryPathValidationSafe().error ||
                  registryTypeValidation().error ||
                  registryDuplicateValidation()
                ) {
                  return
                }
                patchConfig((prev) => ({
                  ...prev,
                  registry_keys: [
                    ...prev.registry_keys,
                    {
                      ...draft,
                      path: draft.path.trim().replace(/\//g, '\\'),
                      name: draft.name.trim(),
                      value_type: draft.value_type.trim().toUpperCase() || 'REG_SZ',
                    },
                  ],
                }))
                setRegistryDraft({ path: '', name: '', value_type: 'REG_SZ', value: '' })
                setRegistryDialogOpen(false)
              }}
            >
              {tForm().add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Registry Import Warnings Dialog ─── */}
      <Dialog open={registryImportWarningsOpen()} onOpenChange={setRegistryImportWarningsOpen}>
        <DialogContent class="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{ct('luthier_registry_import_warnings')}</DialogTitle>
            <DialogDescription>
              {ct('luthier_some_warnings_were_found_during_import_please_check')}
            </DialogDescription>
          </DialogHeader>
          <div class="max-h-[60vh] overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-4">
            <ul class="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <For each={registryImportWarnings()}>{(warning) => <li>{warning}</li>}</For>
            </ul>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setRegistryImportWarningsOpen(false)}>
              {ct('luthier_close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Folder Mount Dialog ─── */}
      <Dialog open={mountDialogOpen()} onOpenChange={setMountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ct('luthier_add_mount')}</DialogTitle>
            <DialogDescription>
              {ct('luthier_set_relative_source_and_windows_target_to_create_the_mou')}
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-2">
            <div class="picker-row">
              <Input
                class={
                  mountSourceValidation().error
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
                value={mountDraft().source_relative_path}
                onInput={(e) =>
                  setMountDraft({ ...mountDraft(), source_relative_path: e.currentTarget.value })
                }
                placeholder={ct('luthier_relative_source_e_g_save')}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!canBrowseMountFolders()}
                onClick={() => void openMountSourceBrowser()}
              >
                {ct('luthier_browse_folders')}
              </Button>
            </div>
            <Show when={mountSourceValidation().error || mountSourceValidation().hint}>
              <p
                class={
                  mountSourceValidation().error
                    ? 'text-xs text-destructive'
                    : 'text-xs text-muted-foreground'
                }
              >
                {mountSourceValidation().error ?? mountSourceValidation().hint}
              </p>
            </Show>

            <Input
              value={mountDraft().target_windows_path}
              class={
                mountTargetValidation().error
                  ? 'border-destructive focus-visible:ring-destructive'
                  : ''
              }
              onInput={(e) =>
                setMountDraft({ ...mountDraft(), target_windows_path: e.currentTarget.value })
              }
              placeholder={ct('luthier_windows_target_c_users')}
            />
            <Show when={mountTargetValidation().error || mountTargetValidation().hint}>
              <p
                class={
                  mountTargetValidation().error
                    ? 'text-xs text-destructive'
                    : 'text-xs text-muted-foreground'
                }
              >
                {mountTargetValidation().error ?? mountTargetValidation().hint}
              </p>
            </Show>
            <Show when={mountDuplicateValidation()}>
              <p class="text-xs text-destructive">{mountDuplicateValidation()}</p>
            </Show>

            <label class="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mountDraft().create_source_if_missing}
                onChange={(e) =>
                  setMountDraft({
                    ...mountDraft(),
                    create_source_if_missing: e.currentTarget.checked,
                  })
                }
                class="rounded border-input text-primary shadow-sm focus:ring-primary"
              />
              {ct('luthier_create_source_if_missing')}
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMountDialogOpen(false)}>
              {tForm().cancel}
            </Button>
            <Button
              type="button"
              onClick={() => {
                const draft = mountDraft()
                if (
                  !draft.source_relative_path.trim() ||
                  !draft.target_windows_path.trim() ||
                  mountSourceValidation().error ||
                  mountTargetValidation().error ||
                  mountDuplicateValidation()
                ) {
                  return
                }
                patchConfig((prev) => ({
                  ...prev,
                  folder_mounts: [
                    ...prev.folder_mounts,
                    {
                      ...draft,
                      source_relative_path: draft.source_relative_path.trim(),
                      target_windows_path: draft.target_windows_path.trim(),
                    },
                  ],
                }))
                setMountDraft({
                  source_relative_path: '',
                  target_windows_path: '',
                  create_source_if_missing: true,
                })
                setMountDialogOpen(false)
              }}
              disabled={
                !mountDraft().source_relative_path.trim() ||
                !mountDraft().target_windows_path.trim() ||
                !!mountSourceValidation().error ||
                !!mountTargetValidation().error ||
                !!mountDuplicateValidation()
              }
            >
              {tForm().add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
