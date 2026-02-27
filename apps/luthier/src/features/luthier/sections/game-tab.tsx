import { createMemo, For, Show } from 'solid-js'
import { IconAlertCircle, IconPlus, IconTrash, IconX } from '@tabler/icons-solidjs'
import { toast } from 'solid-sonner'

import {
  FeatureStateField,
  FieldShell,
  KeyValueListField,
  SegmentedField,
  SelectField,
  StringListField,
  TextInputField,
  ToggleField,
  WinecfgFeatureStateField
} from '../../../components/form/FormControls'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Skeleton } from '../../../components/ui/skeleton'
import { Spinner } from '../../../components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { Textarea } from '../../../components/ui/textarea'
import type { RuntimePreference } from '../../../models/config'
import type { AudioDriverOption, GamescopeWindowType, UpscaleMethod } from '../useLuthierController'
import {
  AccordionSection,
  basenamePath,
  buildFeatureState,
  featureStateEnabled,
  featureStateMandatory,
  posixDirname,
  relativeInsideBase,
  SwitchChoiceCard,
  type LuthierPageSectionProps
} from '../luthier-page-shared'
import { validateRelativeGamePath, validateWindowsPath } from '../luthier-field-validation'

export function GameTabSection(props: LuthierPageSectionProps & { mode?: 'overview' | 'files' }) {
  const mode = props.mode ?? 'overview'
  const {
    gameRoot,
    setGameRoot,
    gameRootManualOverride,
    setGameRootManualOverride,
    gameRootRelativeDisplay,
    exeInsideGameRoot,
    exePath,
    setExePath,
    iconPreviewPath,
    setStatusMessage,
    config,
    patchConfig,
    ct,
    ctf,
    locale,
    prefixPathPreview,
    removeAt,
    pickExecutable,
    pickGameRootOverride,
    pickIntegrityFileRelative,
    pickIntegrityFileRelativeWithBrowser,
    pickMountFolder,
    extractExecutableIcon,
    hashingExecutable,
    extractingExecutableIcon,
    heroImageProcessing,
    heroImageAutoSearching,
    canSearchAnotherHeroImage,
    setHeroImageUrl,
    prepareHeroImageFromUrl,
    searchHeroImageAutomatically,
    gameRootChooserOpen,
    setGameRootChooserOpen,
    mountSourceBrowserOpen,
    setMountSourceBrowserOpen,
    mountBrowserDirs,
    mountBrowserLoading,
    integrityFileBrowserOpen,
    setIntegrityFileBrowserOpen,
    integrityBrowserPath,
    integrityBrowserDirs,
    integrityBrowserFiles,
    integrityBrowserLoading,
    mountDialogOpen,
    setMountDialogOpen,
    mountDraft,
    setMountDraft,
    canChooseGameRoot,
    canPickIntegrityFromGameRoot,
    canAddMount,
    canBrowseMountFolders,
    gameRootAncestorCandidates,
    openGameRootChooser,
    loadMountBrowserDirs,
    openMountSourceBrowser,
    loadIntegrityBrowserEntries,
    mountSourceBrowserSegments,
    mountSourceBrowserCurrentRelative,
    resolveIntegrityFileBrowser,
    integrityFileBrowserSegments,
    integrityFileBrowserCurrentRelative,
  } = props.view

  const mountSourceValidation = createMemo(() =>
    mountDraft().source_relative_path.trim()
      ? validateRelativeGamePath(mountDraft().source_relative_path, locale(), {
        kind: 'folder',
        allowDot: true,
        requireDotPrefix: false
      })
      : {}
  )
  const mountTargetValidation = createMemo(() =>
    mountDraft().target_windows_path.trim() ? validateWindowsPath(mountDraft().target_windows_path, locale()) : {}
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
    <section class="stack">
      <Show when={mode === 'overview'}>
        <>
          <TextInputField
            label={ct('luthier_game_name')}
            help={ct('luthier_name_shown_in_splash_and_local_database')}
            value={config().game_name}
            onInput={(value) => patchConfig((prev) => ({ ...prev, game_name: value }))}
          />

          <FieldShell
            label={ct('luthier_splash_hero_image')}
            help={ct('luthier_hero_image_used_as_splash_background_downloaded_and_emb')}
            hint={ct('luthier_hero_image_ratio_96_31_and_converted_to_webp')}
            footer={
              config().splash.hero_image_data_url.trim() || heroImageProcessing()
                ? (
                  <div class="rounded-md border border-border/60 bg-muted/15 p-3">
                    <div class="relative overflow-hidden rounded-md border border-border/60 bg-black">
                      <div class="aspect-[96/31] w-full" />
                      <Show
                        when={config().splash.hero_image_data_url.trim()}
                        fallback={
                          <div class="absolute inset-0 grid place-items-center">
                            <div class="flex items-center gap-2 text-xs text-muted-foreground">
                              <Spinner class="size-3" />
                              <span>{ct('luthier_processing')}</span>
                            </div>
                          </div>
                        }
                      >
                        <img
                          src={config().splash.hero_image_data_url}
                          alt={ct('luthier_splash_hero_image_preview')}
                          class="absolute inset-0 h-full w-full object-contain"
                        />
                        <Show when={heroImageProcessing()}>
                          <div class="absolute inset-0 bg-background/35 backdrop-blur-[1px]" />
                          <div class="absolute inset-0 grid place-items-center">
                            <div class="flex items-center gap-2 rounded-md bg-background/70 px-2 py-1 text-xs">
                              <Spinner class="size-3" />
                              <span>{ct('luthier_processing')}</span>
                            </div>
                          </div>
                        </Show>
                      </Show>
                    </div>
                  </div>
                )
                : undefined
            }
          >
            <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                value={config().splash.hero_image_url}
                placeholder="https://..."
                onInput={(e) => {
                  setHeroImageUrl(e.currentTarget.value)
                }}
                onBlur={() => {
                  void prepareHeroImageFromUrl()
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={searchHeroImageAutomatically}
                disabled={heroImageAutoSearching() || heroImageProcessing()}
              >
                <Show
                  when={heroImageAutoSearching() || heroImageProcessing()}
                  fallback={
                    canSearchAnotherHeroImage()
                      ? ct('luthier_search_another')
                      : ct('luthier_search_automatically')
                  }
                >
                  <span class="inline-flex items-center gap-2">
                    <Spinner class="size-3" />
                    {heroImageAutoSearching()
                      ? ct('luthier_searching')
                      : ct('luthier_processing')}
                  </span>
                </Show>
              </Button>
            </div>
          </FieldShell>

          <FieldShell
            label={ct('luthier_main_executable_exe')}
            help={ct('luthier_use_picker_to_select_the_real_game_executable')}
          >
            <div class="grid gap-2">
              <div class="picker-row">
                <Input value={exePath()} placeholder="/home/user/Games/MyGame/game.exe" onInput={(e) => setExePath(e.currentTarget.value)} />
                <Button type="button" variant="outline" onClick={pickExecutable}>
                  {ct('luthier_select_file')}
                </Button>
              </div>

              <div class="px-0.5 text-xs">
                <span class="font-medium text-muted-foreground">{ct('luthier_sha_256_hash')}:</span>{' '}
                <Show
                  when={!hashingExecutable()}
                  fallback={
                    <span class="inline-flex items-center gap-2 align-middle">
                      <Spinner class="size-3" />
                      <Skeleton class="h-3 w-36 rounded-sm" />
                    </span>
                  }
                >
                  <span class="break-all font-mono text-foreground">
                    {config().exe_hash.trim() || '—'}
                  </span>
                </Show>
              </div>
            </div>
          </FieldShell>

          <FieldShell
            label={ct('luthier_extracted_icon')}
            help={ct('luthier_game_icon_preview_for_easier_visual_identification')}
            hint={ct('luthier_visual_is_ready_real_extraction_will_be_wired_to_backend')}
          >
            <div class="icon-preview">
              <div class="icon-box">
                <Show when={iconPreviewPath()} fallback={<span>{ct('luthier_no_extracted_icon')}</span>}>
                  <img src={iconPreviewPath()} alt="icon preview" />
                </Show>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={extractExecutableIcon}
                disabled={extractingExecutableIcon()}
              >
                <Show when={!extractingExecutableIcon()} fallback={<span class="inline-flex items-center gap-2"><Spinner class="size-3" />{ct('luthier_processing')}</span>}>
                  {ct('luthier_extract_icon')}
                </Show>
              </Button>
            </div>
          </FieldShell>
        </>
      </Show>

      <Show when={mode === 'files'}>
        <>

          <FieldShell
            label={ct('luthier_game_root_folder')}
            help={ct('luthier_defaults_to_the_main_executable_folder_but_can_be_change')}
            hint={
              !exeInsideGameRoot()
                ? ct('luthier_game_root_hint_invalid_exe_outside_root')
                : gameRootManualOverride()
                  ? ct('luthier_game_root_hint_manual_override')
                  : ct('luthier_game_root_hint_auto')
            }
          >
            <div class="picker-row">
              <Input value={gameRootRelativeDisplay()} placeholder="./" readOnly class="readonly" />
              <Button type="button" variant="outline" onClick={openGameRootChooser} disabled={!canChooseGameRoot()}>
                {ct('luthier_choose_another')}
              </Button>
            </div>
          </FieldShell>

          <FieldShell
            label={ct('luthier_final_prefix_path')}
            help={ct('luthier_automatically_calculated_from_executable_hash')}
          >
            <div class="picker-row">
              <Input value={prefixPathPreview()} readOnly class="readonly" />
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(prefixPathPreview())
                    setStatusMessage(ct('luthier_prefix_path_copied'))
                  } catch {
                    setStatusMessage(ct('luthier_failed_to_copy_to_clipboard'))
                  }
                }}
              >
                {ct('luthier_copy')}
              </Button>
            </div>
          </FieldShell>

          <StringListField
            label={ct('luthier_launch_arguments')}
            help={ct('luthier_extra_arguments_passed_to_game_executable')}
            items={config().launch_args}
            onChange={(items) => patchConfig((prev) => ({ ...prev, launch_args: items }))}
            placeholder={ct('luthier_windowed')}
            addLabel={ct('luthier_add_argument')}
            emptyMessage={ct('luthier_no_launch_argument_added')}
            tableValueHeader={ct('luthier_argument')}
          />

          <StringListField
            label={ct('luthier_required_files')}
            help={ct('luthier_if_any_listed_file_is_missing_from_the_game_folder_start')}
            items={config().integrity_files}
            onChange={(items) => patchConfig((prev) => ({ ...prev, integrity_files: items }))}
            placeholder={ct('luthier_data_core_dll')}
            addLabel={ct('luthier_add_file')}
            pickerLabel={ct('luthier_pick_file_from_game_folder')}
            onPickValue={pickIntegrityFileRelativeWithBrowser ?? pickIntegrityFileRelative}
            pickerDisabled={!canPickIntegrityFromGameRoot()}
            emptyMessage={ct('luthier_no_file_added')}
            tableValueHeader={ct('luthier_relative_file')}
            validateDraft={(value, items) => {
              if (!value.trim()) return undefined
              const validation = validateRelativeGamePath(value, locale(), {
                kind: 'file',
                allowDot: false,
                requireDotPrefix: true
              })
              if (validation.error) return validation
              const duplicate = items.some((item) => item.trim() === value.trim())
              if (duplicate) {
                return { error: ct('luthier_validation_duplicate_required_file') }
              }
              return validation.hint ? validation : undefined
            }}
          />

          <FieldShell
            label={ct('luthier_mounted_folders')}
            help={ct('luthier_maps_a_folder_inside_the_game_to_a_windows_target_inside')}
            controlClass="flex justify-end"
            footer={
              <Show
                when={config().folder_mounts.length > 0}
                fallback={
                  <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    {ct('luthier_no_mount_added')}
                  </div>
                }
              >
                <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
                  <Table>
                    <TableHeader>
                      <TableRow class="hover:bg-transparent">
                        <TableHead>{ct('luthier_relative_source')}</TableHead>
                        <TableHead>{ct('luthier_windows_target')}</TableHead>
                        <TableHead>{ct('luthier_create_source')}</TableHead>
                        <TableHead class="w-[120px] text-right">{ct('luthier_label_actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <For each={config().folder_mounts}>
                        {(item, index) => (
                          <TableRow>
                            <TableCell class="max-w-[220px] truncate font-medium">
                              {item.source_relative_path}
                            </TableCell>
                            <TableCell class="max-w-[280px] truncate text-muted-foreground">
                              {item.target_windows_path}
                            </TableCell>
                            <TableCell class="text-xs text-muted-foreground">
                              {item.create_source_if_missing ? ct('luthier_yes') : ct('luthier_no')}
                            </TableCell>
                            <TableCell class="text-right">
                              <div class="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  class="h-8 px-2 text-xs"
                                  onClick={() => void pickMountFolder(index())}
                                >
                                  {ct('luthier_folder')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    patchConfig((prev) => ({
                                      ...prev,
                                      folder_mounts: removeAt(prev.folder_mounts, index())
                                    }))
                                  }
                                  title={ct('luthier_remove_mount')}
                                >
                                  <IconTrash class="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </For>
                    </TableBody>
                  </Table>
                </div>
              </Show>
            }
          >
            <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setMountDialogOpen(true)}>
              <IconPlus class="size-4" />
              {ct('luthier_add_folder_mount')}
            </Button>
          </FieldShell>
        </>
      </Show>
    </section>
  )
}
