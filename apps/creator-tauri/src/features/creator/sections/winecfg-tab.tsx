import { For, Show } from 'solid-js'
import { IconAlertCircle, IconPlus, IconTrash, IconX } from '@tabler/icons-solidjs'

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
import { Spinner } from '../../../components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { Textarea } from '../../../components/ui/textarea'
import type { RuntimePreference } from '../../../models/config'
import type { AudioDriverOption, GamescopeWindowType, UpscaleMethod } from '../useCreatorController'
import {
  AccordionSection,
  basenamePath,
  buildFeatureState,
  featureStateEnabled,
  featureStateMandatory,
  posixDirname,
  relativeInsideBase,
  SwitchChoiceCard,
  type CreatorPageSectionProps
} from '../creator-page-shared'

export function WinecfgTabSection(props: CreatorPageSectionProps) {
    const {
    setStatusMessage,
    config,
    patchConfig,
    ct,
    audioDriverOptions,
    dllModeOptions,
    audioDriverValue,
    replaceAt,
    removeAt,
    dllDialogOpen,
    setDllDialogOpen,
    dllDraft,
    setDllDraft,
    wineDesktopFolderDialogOpen,
    setWineDesktopFolderDialogOpen,
    wineDesktopFolderDraft,
    setWineDesktopFolderDraft,
    wineDriveDialogOpen,
    setWineDriveDialogOpen,
    wineDriveDraft,
    setWineDriveDraft,
    winecfgAccordionOpen,
    setWinecfgAccordionOpen,
    wineWindowsVersionOptions,
    wineDesktopFolderKeyOptions,
    wineDriveTypeOptions,
    availableWineDriveLetters,
    winecfgVirtualDesktopEnabled,
    winecfgVirtualDesktopResolution,
    setWinecfgVirtualDesktopResolutionPart,
  } = props.view as any

  return (
          <section class="stack">
            <Alert variant="warning">
              <IconAlertCircle />
              <AlertTitle>{ct('creator_winecfg_overrides_do_not_replace_everything')}</AlertTitle>
              <AlertDescription>
                {ct('creator_settings_in_this_tab_are_additive_overrides_on_top_of_wi')}
              </AlertDescription>
            </Alert>

            <FieldShell
              label={ct('creator_dll_overrides')}
              help={ct('creator_configures_per_dll_overrides_such_as_native_builtin')}
              controlClass="flex justify-end"
              footer={
                <Show
                  when={config().winecfg.dll_overrides.length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('creator_no_override_added')}
                    </div>
                  }
                >
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{ct('creator_dll')}</TableHead>
                          <TableHead>{ct('creator_mode')}</TableHead>
                          <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={config().winecfg.dll_overrides}>
                          {(item, index) => (
                            <TableRow>
                              <TableCell class="max-w-[260px] truncate font-medium">{item.dll}</TableCell>
                              <TableCell class="w-[220px]">
                                <Select
                                  value={item.mode}
                                  onInput={(e) =>
                                    patchConfig((prev) => ({
                                      ...prev,
                                      winecfg: {
                                        ...prev.winecfg,
                                        dll_overrides: replaceAt(prev.winecfg.dll_overrides, index(), {
                                          ...prev.winecfg.dll_overrides[index()],
                                          mode: e.currentTarget.value
                                        })
                                      }
                                    }))
                                  }
                                >
                                  <For each={dllModeOptions()}>
                                    {(option) => <option value={option.value}>{option.label}</option>}
                                  </For>
                                </Select>
                              </TableCell>
                              <TableCell class="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    patchConfig((prev) => ({
                                      ...prev,
                                      winecfg: {
                                        ...prev.winecfg,
                                        dll_overrides: removeAt(prev.winecfg.dll_overrides, index())
                                      }
                                    }))
                                  }
                                  title={ct('creator_label_remove')}
                                >
                                  <IconTrash class="size-4" />
                                </Button>
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
              <Dialog open={dllDialogOpen()} onOpenChange={setDllDialogOpen}>
                <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setDllDialogOpen(true)}>
                  <IconPlus class="size-4" />
                  {ct('creator_add_dll_override')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_dll_override')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_set_the_dll_name_and_override_mode')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <Input
                      value={dllDraft().dll}
                      placeholder="d3dcompiler_47"
                      onInput={(e) =>
                        setDllDraft((prev) => ({
                          ...prev,
                          dll: e.currentTarget.value
                        }))
                      }
                    />
                    <Select
                      value={dllDraft().mode}
                      onInput={(e) =>
                        setDllDraft((prev) => ({
                          ...prev,
                          mode: e.currentTarget.value
                        }))
                      }
                    >
                      <For each={dllModeOptions()}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                    </Select>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDllDialogOpen(false)}>
                      {ct('creator_label_cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!dllDraft().dll.trim()}
                      onClick={() => {
                        const draft = dllDraft()
                        if (!draft.dll.trim()) return
                        patchConfig((prev) => ({
                          ...prev,
                          winecfg: {
                            ...prev.winecfg,
                            dll_overrides: [...prev.winecfg.dll_overrides, draft]
                          }
                        }))
                        setDllDraft({ dll: '', mode: 'builtin' })
                        setDllDialogOpen(false)
                      }}
                    >
                      {ct('creator_label_confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>

            <FieldShell
              label={ct('creator_windows_version_winecfg')}
              help={ct('creator_optional_override_for_the_windows_version_reported_by_th')}
              compact
            >
              <Select
                value={config().winecfg.windows_version ?? '__default__'}
                onInput={(e) =>
                  patchConfig((prev) => ({
                    ...prev,
                    winecfg: {
                      ...prev.winecfg,
                      windows_version: e.currentTarget.value === '__default__' ? null : e.currentTarget.value
                    }
                  }))
                }
              >
                <For each={wineWindowsVersionOptions}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </Select>
            </FieldShell>

            <div class="grid gap-3">
              <AccordionSection
                open={winecfgAccordionOpen() === 'graphics'}
                onToggle={() =>
                  setWinecfgAccordionOpen((prev) => (prev === 'graphics' ? null : 'graphics'))
                }
                title={ct('creator_graphics')}
                description={ct('creator_equivalent_to_the_graphics_tab_in_winecfg_everything_her')}
              >
                <div class="grid gap-3">
                  <Alert>
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_graphics_incremental_overrides')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_these_items_do_not_recreate_the_prefix_they_only_add_win')}
                    </AlertDescription>
                  </Alert>

                  <WinecfgFeatureStateField
                    label={ct('creator_automatically_capture_mouse_in_fullscreen_windows')}
                    help={ct('creator_equivalent_to_winecfg_auto_capture_mouse_option')}
                    value={config().winecfg.auto_capture_mouse}
                    onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, auto_capture_mouse: value } }))}
                  />

                  <WinecfgFeatureStateField
                    label={ct('creator_allow_the_window_manager_to_decorate_windows')}
                    help={ct('creator_controls_window_decorations_managed_by_the_wm')}
                    value={config().winecfg.window_decorations}
                    onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, window_decorations: value } }))}
                  />

                  <WinecfgFeatureStateField
                    label={ct('creator_allow_the_window_manager_to_control_windows')}
                    help={ct('creator_lets_the_wm_control_window_position_focus_state')}
                    value={config().winecfg.window_manager_control}
                    onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, window_manager_control: value } }))}
                  />

                  <WinecfgFeatureStateField
                    label={ct('creator_emulate_a_virtual_desktop')}
                    help={ct('creator_when_enabled_the_game_runs_inside_a_wine_virtual_desktop')}
                    value={config().winecfg.virtual_desktop.state}
                    onChange={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        winecfg: {
                          ...prev.winecfg,
                          virtual_desktop: {
                            ...prev.winecfg.virtual_desktop,
                            state: value
                          }
                        }
                      }))
                    }
                  />

                  <Show when={winecfgVirtualDesktopEnabled()}>
                    <div class="rounded-md border border-border/60 bg-muted/20 p-3">
                      <div class="space-y-1.5">
                        <p class="text-sm font-medium">{ct('creator_virtual_desktop_size')}</p>
                        <p class="text-xs text-muted-foreground">
                          {ct('creator_set_width_x_height_e_g_1280_x_720')}
                        </p>
                      </div>
                      <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                        <Input
                          value={winecfgVirtualDesktopResolution().width}
                          placeholder="1280"
                          onInput={(e) => setWinecfgVirtualDesktopResolutionPart('width', e.currentTarget.value)}
                        />
                        <span class="text-sm font-semibold text-muted-foreground">x</span>
                        <Input
                          value={winecfgVirtualDesktopResolution().height}
                          placeholder="720"
                          onInput={(e) => setWinecfgVirtualDesktopResolutionPart('height', e.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </Show>

                  <div class="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="space-y-1.5">
                        <p class="text-sm font-medium">{ct('creator_screen_resolution_dpi')}</p>
                        <p class="text-xs text-muted-foreground">
                          {ct('creator_slider_from_96_dpi_to_480_dpi_if_unset_wine_default_is_u')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              screen_dpi: null
                            }
                          }))
                        }
                      >
                        {ct('creator_use_default')}
                      </Button>
                    </div>
                    <div class="mt-3 grid gap-2">
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-muted-foreground">96 ppp</span>
                        <span class="font-medium">
                          {(config().winecfg.screen_dpi ?? 96).toString()} ppp
                          <Show when={config().winecfg.screen_dpi == null}>
                            <span class="text-muted-foreground"> ({ct('creator_default')})</span>
                          </Show>
                        </span>
                        <span class="text-muted-foreground">480 ppp</span>
                      </div>
                      <input
                        type="range"
                        min="96"
                        max="480"
                        step="1"
                        value={(config().winecfg.screen_dpi ?? 96).toString()}
                        class="w-full accent-primary"
                        onInput={(e) => {
                          const parsed = Number.parseInt(e.currentTarget.value, 10)
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              screen_dpi: Number.isFinite(parsed) ? parsed : 96
                            }
                          }))
                        }}
                      />
                    </div>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                open={winecfgAccordionOpen() === 'desktop'}
                onToggle={() =>
                  setWinecfgAccordionOpen((prev) => (prev === 'desktop' ? null : 'desktop'))
                }
                title={ct('creator_desktop_integration')}
                description={ct('creator_file_protocol_associations_and_wine_special_desktop_fold')}
              >
                <div class="grid gap-3">
                  <Alert>
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_integration_can_affect_user_system_behavior')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_mime_protocol_associations_and_special_folders_can_chang')}
                    </AlertDescription>
                  </Alert>

                  <WinecfgFeatureStateField
                    label={ct('creator_desktop_integration_general')}
                    help={ct('creator_controls_wine_integration_with_the_linux_shell_desktop')}
                    value={config().winecfg.desktop_integration}
                    onChange={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        winecfg: { ...prev.winecfg, desktop_integration: value }
                      }))
                    }
                  />

                  <WinecfgFeatureStateField
                    label={ct('creator_mime_types_file_protocol_associations')}
                    help={ct('creator_equivalent_to_manage_file_and_protocol_associations')}
                    value={config().winecfg.mime_associations}
                    onChange={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        winecfg: { ...prev.winecfg, mime_associations: value }
                      }))
                    }
                  />

                  <div class="rounded-xl border border-border/70 bg-card/70 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold">{ct('creator_special_folders')}</p>
                        <p class="text-xs text-muted-foreground">
                          {ct('creator_add_folder_shortcut_mappings_for_wine_optional_override')}
                        </p>
                      </div>
                      <Dialog open={wineDesktopFolderDialogOpen()} onOpenChange={setWineDesktopFolderDialogOpen}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          class="inline-flex items-center gap-1.5"
                          onClick={() => setWineDesktopFolderDialogOpen(true)}
                        >
                          <IconPlus class="size-4" />
                          {ct('creator_add_folder')}
                        </Button>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{ct('creator_add_wine_special_folder')}</DialogTitle>
                            <DialogDescription>
                              {ct('creator_set_folder_type_shortcut_name_and_linux_path')}
                            </DialogDescription>
                          </DialogHeader>

                          <div class="grid gap-2">
                            <Select
                              value={wineDesktopFolderDraft().folder_key}
                              onInput={(e) =>
                                setWineDesktopFolderDraft((prev) => ({ ...prev, folder_key: e.currentTarget.value }))
                              }
                            >
                              <For each={wineDesktopFolderKeyOptions}>
                                {(option) => <option value={option.value}>{option.label}</option>}
                              </For>
                            </Select>
                            <Input
                              value={wineDesktopFolderDraft().shortcut_name}
                              placeholder={ct('creator_shortcut_name_in_wine')}
                              onInput={(e) =>
                                setWineDesktopFolderDraft((prev) => ({ ...prev, shortcut_name: e.currentTarget.value }))
                              }
                            />
                            <Input
                              value={wineDesktopFolderDraft().linux_path}
                              placeholder="/mnt/games/shared"
                              onInput={(e) =>
                                setWineDesktopFolderDraft((prev) => ({ ...prev, linux_path: e.currentTarget.value }))
                              }
                            />
                            <p class="text-xs text-muted-foreground">
                              {ct('creator_prefer_generic_paths_without_a_fixed_username_when_possi')}
                            </p>
                          </div>

                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setWineDesktopFolderDialogOpen(false)}>
                              {ct('creator_label_cancel')}
                            </Button>
                            <Button
                              type="button"
                              disabled={!wineDesktopFolderDraft().shortcut_name.trim() || !wineDesktopFolderDraft().linux_path.trim()}
                              onClick={() => {
                                const draft = wineDesktopFolderDraft()
                                if (!draft.shortcut_name.trim() || !draft.linux_path.trim()) return
                                patchConfig((prev) => ({
                                  ...prev,
                                  winecfg: {
                                    ...prev.winecfg,
                                    desktop_folders: [
                                      ...prev.winecfg.desktop_folders,
                                      {
                                        folder_key: draft.folder_key,
                                        shortcut_name: draft.shortcut_name.trim(),
                                        linux_path: draft.linux_path.trim()
                                      }
                                    ]
                                  }
                                }))
                                setWineDesktopFolderDraft({ folder_key: 'desktop', shortcut_name: '', linux_path: '' })
                                setWineDesktopFolderDialogOpen(false)
                              }}
                            >
                              {ct('creator_label_confirm')}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div class="mt-3">
                      <Show
                        when={config().winecfg.desktop_folders.length > 0}
                        fallback={
                          <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                            {ct('creator_no_special_folder_added')}
                          </div>
                        }
                      >
                        <div class="rounded-md border border-border/60 bg-background/40">
                          <Table>
                            <TableHeader>
                              <TableRow class="hover:bg-transparent">
                                <TableHead>{ct('creator_type')}</TableHead>
                                <TableHead>{ct('creator_shortcut')}</TableHead>
                                <TableHead>{ct('creator_linux_path')}</TableHead>
                                <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <For each={config().winecfg.desktop_folders}>
                                {(item, index) => (
                                  <TableRow>
                                    <TableCell class="max-w-[120px] truncate font-medium">{item.folder_key}</TableCell>
                                    <TableCell class="max-w-[180px] truncate">{item.shortcut_name}</TableCell>
                                    <TableCell class="max-w-[320px] truncate text-muted-foreground">{item.linux_path}</TableCell>
                                    <TableCell class="text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() =>
                                          patchConfig((prev) => ({
                                            ...prev,
                                            winecfg: {
                                              ...prev.winecfg,
                                              desktop_folders: removeAt(prev.winecfg.desktop_folders, index())
                                            }
                                          }))
                                        }
                                      >
                                        <IconTrash class="size-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </For>
                            </TableBody>
                          </Table>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                open={winecfgAccordionOpen() === 'drives'}
                onToggle={() =>
                  setWinecfgAccordionOpen((prev) => (prev === 'drives' ? null : 'drives'))
                }
                title={ct('creator_drives')}
                description={ct('creator_additional_wine_drives_as_overrides_c_and_z_usually_alre')}
              >
                <div class="grid gap-3">
                  <Alert variant="warning">
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_wine_drives_require_care')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_c_and_z_usually_already_exist_in_the_default_prefix_add')}
                    </AlertDescription>
                  </Alert>

                  <div class="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <div class="grid gap-1">
                      <p>
                        <strong class="text-foreground">C:</strong>{' '}
                        {ct('creator_usually_points_to_drive_c_internal_prefix_path')}
                      </p>
                      <p>
                        <strong class="text-foreground">Z:</strong>{' '}
                        {ct('creator_usually_exposes_the_linux_filesystem_root_for_compatibil')}
                      </p>
                    </div>
                    <div class="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              drives: [
                                {
                                  letter: 'Z',
                                  source_relative_path: '.',
                                  state: 'OptionalOn',
                                  host_path: null,
                                  drive_type: 'auto',
                                  label: null,
                                  serial: null
                                }
                              ]
                            }
                          }))
                        }
                      >
                        {ct('creator_restore_shown_default_z')}
                      </Button>
                    </div>
                  </div>

                  <div class="flex justify-end">
                    <Dialog open={wineDriveDialogOpen()} onOpenChange={setWineDriveDialogOpen}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="inline-flex items-center gap-1.5"
                        onClick={() => {
                          const nextLetter = availableWineDriveLetters()[0] ?? 'D'
                          setWineDriveDraft({
                            letter: nextLetter,
                            host_path: '',
                            drive_type: 'auto',
                            label: '',
                            serial: ''
                          })
                          setWineDriveDialogOpen(true)
                        }}
                      >
                        <IconPlus class="size-4" />
                        {ct('creator_add_drive')}
                      </Button>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{ct('creator_add_wine_drive')}</DialogTitle>
                          <DialogDescription>
                            {ct('creator_choose_an_available_letter_and_configure_drive_metadata')}
                          </DialogDescription>
                        </DialogHeader>

                        <div class="grid gap-2">
                          <Select
                            value={wineDriveDraft().letter}
                            onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, letter: e.currentTarget.value }))}
                          >
                            <For each={availableWineDriveLetters().length > 0 ? availableWineDriveLetters() : [wineDriveDraft().letter]}>
                              {(letter) => <option value={letter}>{letter}:</option>}
                            </For>
                          </Select>

                          <Input
                            value={wineDriveDraft().host_path}
                            placeholder="/mnt/storage/shared"
                            onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, host_path: e.currentTarget.value }))}
                          />

                          <Select
                            value={wineDriveDraft().drive_type}
                            onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, drive_type: e.currentTarget.value }))}
                          >
                            <For each={wineDriveTypeOptions}>
                              {(option) => <option value={option.value}>{option.label}</option>}
                            </For>
                          </Select>

                          <div class="grid gap-2 md:grid-cols-2">
                            <Input
                              value={wineDriveDraft().label}
                              placeholder={ct('creator_label_optional')}
                              onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, label: e.currentTarget.value }))}
                            />
                            <Input
                              value={wineDriveDraft().serial}
                              placeholder={ct('creator_serial_optional')}
                              onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, serial: e.currentTarget.value }))}
                            />
                          </div>

                          <p class="text-xs text-muted-foreground">
                            {ct('creator_use_a_generic_linux_directory_when_possible_avoid_user_s')}
                          </p>
                        </div>

                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setWineDriveDialogOpen(false)}>
                            {ct('creator_label_cancel')}
                          </Button>
                          <Button
                            type="button"
                            disabled={!wineDriveDraft().letter.trim() || !wineDriveDraft().host_path.trim()}
                            onClick={() => {
                              const draft = wineDriveDraft()
                              const letter = draft.letter.trim().toUpperCase()
                              if (!letter || !draft.host_path.trim()) return
                              if (config().winecfg.drives.some((item) => item.letter.trim().toUpperCase() === letter)) {
                                setStatusMessage(ct('creator_that_drive_letter_is_already_in_use'))
                                return
                              }
                              patchConfig((prev) => ({
                                ...prev,
                                winecfg: {
                                  ...prev.winecfg,
                                  drives: [
                                    ...prev.winecfg.drives,
                                    {
                                      letter,
                                      source_relative_path: '',
                                      state: 'OptionalOn',
                                      host_path: draft.host_path.trim(),
                                      drive_type: draft.drive_type as 'auto' | 'local_disk' | 'network_share' | 'floppy' | 'cdrom',
                                      label: draft.label.trim() ? draft.label.trim() : null,
                                      serial: draft.serial.trim() ? draft.serial.trim() : null
                                    }
                                  ]
                                }
                              }))
                              setWineDriveDialogOpen(false)
                            }}
                          >
                            {ct('creator_label_confirm')}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Show
                    when={config().winecfg.drives.length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {ct('creator_no_additional_drive_configured')}
                      </div>
                    }
                  >
                    <div class="rounded-md border border-border/60 bg-background/40">
                      <Table>
                        <TableHeader>
                          <TableRow class="hover:bg-transparent">
                            <TableHead>{ct('creator_letter')}</TableHead>
                            <TableHead>{ct('creator_linux_path')}</TableHead>
                            <TableHead>{ct('creator_type')}</TableHead>
                            <TableHead>{ct('creator_label')}</TableHead>
                            <TableHead>{ct('creator_serial')}</TableHead>
                            <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <For each={config().winecfg.drives}>
                            {(item, index) => (
                              <TableRow>
                                <TableCell class="font-medium">{item.letter}:</TableCell>
                                <TableCell class="max-w-[260px] truncate text-muted-foreground">
                                  {(item.host_path ?? item.source_relative_path) || '—'}
                                </TableCell>
                                <TableCell class="max-w-[160px] truncate text-muted-foreground">
                                  {item.drive_type ?? 'auto'}
                                </TableCell>
                                <TableCell class="max-w-[160px] truncate text-muted-foreground">
                                  {item.label ?? '—'}
                                </TableCell>
                                <TableCell class="max-w-[140px] truncate text-muted-foreground">
                                  {item.serial ?? '—'}
                                </TableCell>
                                <TableCell class="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() =>
                                      patchConfig((prev) => ({
                                        ...prev,
                                        winecfg: {
                                          ...prev.winecfg,
                                          drives: removeAt(prev.winecfg.drives, index())
                                        }
                                      }))
                                    }
                                  >
                                    <IconTrash class="size-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )}
                          </For>
                        </TableBody>
                      </Table>
                    </div>
                  </Show>
                </div>
              </AccordionSection>

              <AccordionSection
                open={winecfgAccordionOpen() === 'audio'}
                onToggle={() =>
                  setWinecfgAccordionOpen((prev) => (prev === 'audio' ? null : 'audio'))
                }
                title={ct('creator_audio')}
                description={ct('creator_additional_audio_settings_from_winecfg_runtime_defaults')}
              >
                <div class="grid gap-3">
                  <Alert>
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_audio_change_only_if_needed')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_forcing_an_audio_backend_can_fix_compatibility_but_may_w')}
                    </AlertDescription>
                  </Alert>

                  <div class="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div class="space-y-1.5">
                      <p class="text-sm font-medium">{ct('creator_audio_driver')}</p>
                      <p class="text-xs text-muted-foreground">
                        {ct('creator_select_the_preferred_backend_runtime_default_keeps_wine')}
                      </p>
                    </div>
                    <div class="mt-3 max-w-sm">
                      <Select
                        value={audioDriverValue()}
                        onInput={(e) =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              audio_driver: e.currentTarget.value === '__none__' ? null : e.currentTarget.value
                            }
                          }))
                        }
                      >
                        <For each={audioDriverOptions()}>
                          {(option) => <option value={option.value}>{option.label}</option>}
                        </For>
                      </Select>
                    </div>
                  </div>
                </div>
              </AccordionSection>
            </div>
          </section>
  )
}
