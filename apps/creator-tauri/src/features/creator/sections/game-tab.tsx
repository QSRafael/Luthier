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

export function GameTabSection(props: CreatorPageSectionProps) {
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
    t,
    ct,
    ctf,
    prefixPathPreview,
    removeAt,
    runHash,
    pickExecutable,
    pickGameRootOverride,
    pickIntegrityFileRelative,
    pickMountFolder,
    applyIconExtractionPlaceholder,
    gameRootChooserOpen,
    setGameRootChooserOpen,
    mountSourceBrowserOpen,
    setMountSourceBrowserOpen,
    mountBrowserDirs,
    mountBrowserLoading,
    mountDialogOpen,
    setMountDialogOpen,
    mountDraft,
    setMountDraft,
    canCalculateHash,
    canChooseGameRoot,
    canPickIntegrityFromGameRoot,
    canAddMount,
    canBrowseMountFolders,
    gameRootAncestorCandidates,
    openGameRootChooser,
    loadMountBrowserDirs,
    openMountSourceBrowser,
    mountSourceBrowserSegments,
    mountSourceBrowserCurrentRelative,
  } = props.view

  return (
          <section class="stack">
            <TextInputField
              label={ct('creator_game_name')}
              help={ct('creator_name_shown_in_splash_and_local_database')}
              value={config().game_name}
              onInput={(value) => patchConfig((prev) => ({ ...prev, game_name: value }))}
            />

            <FieldShell
              label={ct('creator_main_executable_exe')}
              help={ct('creator_use_picker_to_select_the_real_game_executable')}
            >
              <div class="picker-row">
                <Input value={exePath()} placeholder="/home/user/Games/MyGame/game.exe" onInput={(e) => setExePath(e.currentTarget.value)} />
                <Button type="button" variant="outline" onClick={pickExecutable}>
                  {ct('creator_select_file')}
                </Button>
              </div>
            </FieldShell>

            <FieldShell
              label={ct('creator_game_root_folder')}
              help={ct('creator_defaults_to_the_main_executable_folder_but_can_be_change')}
              hint={
                !exeInsideGameRoot()
                  ? ct('creator_game_root_hint_invalid_exe_outside_root')
                  : gameRootManualOverride()
                    ? ct('creator_game_root_hint_manual_override')
                    : ct('creator_game_root_hint_auto')
              }
            >
              <div class="picker-row">
                <Input value={gameRootRelativeDisplay()} placeholder="./" readOnly class="readonly" />
                <Button type="button" variant="outline" onClick={openGameRootChooser} disabled={!canChooseGameRoot()}>
                  {ct('creator_choose_another')}
                </Button>
              </div>
            </FieldShell>

            <Dialog open={gameRootChooserOpen()} onOpenChange={setGameRootChooserOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{ct('creator_choose_game_root_folder')}</DialogTitle>
                  <DialogDescription>
                    {ct('creator_the_game_root_must_be_an_ancestor_of_the_folder_that_con')}
                  </DialogDescription>
                </DialogHeader>

                <Show
                  when={gameRootAncestorCandidates().length > 0}
                  fallback={
                    <div class="grid gap-3">
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {ct('creator_this_guided_flow_requires_an_absolute_executable_path_lo')}
                      </div>
                      <div class="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            setGameRootChooserOpen(false)
                            await pickGameRootOverride()
                          }}
                        >
                          {ct('creator_use_system_picker')}
                        </Button>
                      </div>
                    </div>
                  }
                >
                  <div class="grid gap-3">
                    <div class="rounded-md border border-border/60 bg-muted/25 p-3">
                      <p class="mb-2 text-xs font-medium text-muted-foreground">
                        {ct('creator_executable_folder_breadcrumb')}
                      </p>
                      <nav class="overflow-x-auto" aria-label={ct('creator_executable_path')}>
                        <ol class="flex min-w-max items-center gap-1 text-xs">
                          <For each={gameRootAncestorCandidates()}>
                            {(candidate, index) => (
                              <>
                                <Show when={index() > 0}>
                                  <li class="text-muted-foreground">/</li>
                                </Show>
                                <li>
                                  <Button
                                    type="button"
                                    variant={gameRoot() === candidate ? 'secondary' : 'ghost'}
                                    size="sm"
                                    class="h-7 px-2"
                                    onClick={() => {
                                      const exeDir = posixDirname(exePath())
                                      setGameRoot(candidate)
                                      setGameRootManualOverride(candidate !== exeDir)
                                      setGameRootChooserOpen(false)
                                    }}
                                  >
                                    {basenamePath(candidate) || '/'}
                                  </Button>
                                </li>
                              </>
                            )}
                          </For>
                        </ol>
                      </nav>
                    </div>

                    <div class="grid gap-2">
                      <p class="text-xs font-medium text-muted-foreground">
                        {ct('creator_select_which_ancestor_level_should_be_the_game_root')}
                      </p>
                      <div class="grid gap-2">
                        <For each={[...gameRootAncestorCandidates()].reverse()}>
                          {(candidate) => {
                            const exeDir = posixDirname(exePath())
                            const relativeToExe = relativeInsideBase(candidate, exeDir)
                            const isAutoRoot = candidate === exeDir
                            return (
                              <button
                                type="button"
                                class={
                                  'grid gap-1 rounded-md border px-3 py-2 text-left transition-colors ' +
                                  (gameRoot() === candidate
                                    ? 'border-primary/40 bg-muted/45'
                                    : 'border-border/60 bg-muted/20 hover:bg-muted/35')
                                }
                                onClick={() => {
                                  setGameRoot(candidate)
                                  setGameRootManualOverride(!isAutoRoot)
                                  setGameRootChooserOpen(false)
                                }}
                              >
                                <span class="text-sm font-medium">{candidate}</span>
                                <span class="text-xs text-muted-foreground">
                                  {isAutoRoot
                                    ? ct('creator_same_directory_as_executable_automatic')
                                    : ctf('creator_executable_lives_in_relative_path', {
                                        path: relativeToExe ?? ''
                                      })}
                                </span>
                              </button>
                            )
                          }}
                        </For>
                      </div>
                    </div>
                  </div>
                </Show>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setGameRootChooserOpen(false)}>
                    {ct('creator_close')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <FieldShell
              label={ct('creator_sha_256_hash')}
              help={ct('creator_main_identifier_for_profile_and_per_game_prefix')}
            >
              <div class="picker-row">
                <Input
                  value={config().exe_hash}
                  readOnly
                  class="readonly"
                />
                <Button type="button" variant="outline" onClick={runHash} disabled={!canCalculateHash()}>
                  {t('hashButton')}
                </Button>
              </div>
            </FieldShell>

            <FieldShell
              label={ct('creator_final_prefix_path')}
              help={ct('creator_automatically_calculated_from_executable_hash')}
            >
              <div class="picker-row">
                <Input value={prefixPathPreview()} readOnly class="readonly" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(prefixPathPreview())
                      setStatusMessage(ct('creator_prefix_path_copied'))
                    } catch {
                      setStatusMessage(ct('creator_failed_to_copy_to_clipboard'))
                    }
                  }}
                >
                  {ct('creator_copy')}
                </Button>
              </div>
            </FieldShell>

            <FieldShell
              label={ct('creator_extracted_icon')}
              help={ct('creator_game_icon_preview_for_easier_visual_identification')}
              hint={ct('creator_visual_is_ready_real_extraction_will_be_wired_to_backend')}
            >
              <div class="icon-preview">
                <div class="icon-box">
                  <Show when={iconPreviewPath()} fallback={<span>{ct('creator_no_extracted_icon')}</span>}>
                    <img src={iconPreviewPath()} alt="icon preview" />
                  </Show>
                </div>
                <Button type="button" variant="outline" onClick={applyIconExtractionPlaceholder}>
                  {ct('creator_extract_icon')}
                </Button>
              </div>
            </FieldShell>

            <StringListField
              label={ct('creator_launch_arguments')}
              help={ct('creator_extra_arguments_passed_to_game_executable')}
              items={config().launch_args}
              onChange={(items) => patchConfig((prev) => ({ ...prev, launch_args: items }))}
              placeholder={ct('creator_windowed')}
              addLabel={ct('creator_add_argument')}
              emptyMessage={ct('creator_no_launch_argument_added')}
              tableValueHeader={ct('creator_argument')}
            />

            <StringListField
              label={ct('creator_required_files')}
              help={ct('creator_if_any_listed_file_is_missing_from_the_game_folder_start')}
              items={config().integrity_files}
              onChange={(items) => patchConfig((prev) => ({ ...prev, integrity_files: items }))}
              placeholder={ct('creator_data_core_dll')}
              addLabel={ct('creator_add_file')}
              pickerLabel={ct('creator_pick_file_from_game_folder')}
              onPickValue={pickIntegrityFileRelative}
              pickerDisabled={!canPickIntegrityFromGameRoot()}
              emptyMessage={ct('creator_no_file_added')}
              tableValueHeader={ct('creator_relative_file')}
            />

            <FieldShell
              label={ct('creator_mounted_folders')}
              help={ct('creator_maps_a_folder_inside_the_game_to_a_windows_target_inside')}
              controlClass="flex justify-end"
              footer={
                <Show
                  when={config().folder_mounts.length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('creator_no_mount_added')}
                    </div>
                  }
                >
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{ct('creator_relative_source')}</TableHead>
                          <TableHead>{ct('creator_windows_target')}</TableHead>
                          <TableHead>{ct('creator_create_source')}</TableHead>
                          <TableHead class="w-[120px] text-right">{ct('creator_label_actions')}</TableHead>
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
                                {item.create_source_if_missing ? ct('creator_yes') : ct('creator_no')}
                              </TableCell>
                              <TableCell class="text-right">
                                <div class="flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    class="h-8 px-2 text-xs"
                                    onClick={() => void pickMountFolder(index())}
                                  >
                                    {ct('creator_folder')}
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
                                    title={ct('creator_remove_mount')}
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
              <Dialog open={mountDialogOpen()} onOpenChange={setMountDialogOpen}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="inline-flex items-center gap-1.5"
                  onClick={() => setMountDialogOpen(true)}
                  disabled={!canAddMount()}
                >
                  <IconPlus class="size-4" />
                  {ct('creator_add_mount')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_mount')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_set_relative_source_and_windows_target_to_create_the_mou')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <div class="picker-row">
                      <Input
                        value={mountDraft().source_relative_path}
                        placeholder={ct('creator_relative_source_e_g_save')}
                        onInput={(e) =>
                          setMountDraft((prev: any) => ({
                            ...prev,
                            source_relative_path: e.currentTarget.value
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canBrowseMountFolders()}
                        onClick={() => void openMountSourceBrowser()}
                      >
                        {ct('creator_browse_folders')}
                      </Button>
                    </div>

                    <Input
                      value={mountDraft().target_windows_path}
                      placeholder={ct('creator_windows_target_c_users')}
                      onInput={(e) =>
                        setMountDraft((prev: any) => ({
                          ...prev,
                          target_windows_path: e.currentTarget.value
                        }))
                      }
                    />

                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={mountDraft().create_source_if_missing}
                        onInput={(e) =>
                          setMountDraft((prev: any) => ({
                            ...prev,
                            create_source_if_missing: e.currentTarget.checked
                          }))
                        }
                      />
                      {ct('creator_create_source_if_missing')}
                    </label>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setMountDialogOpen(false)}>
                      {ct('creator_label_cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!mountDraft().source_relative_path.trim() || !mountDraft().target_windows_path.trim()}
                      onClick={() => {
                        const draft = mountDraft()
                        if (!draft.source_relative_path.trim() || !draft.target_windows_path.trim()) return
                        patchConfig((prev) => ({
                          ...prev,
                          folder_mounts: [...prev.folder_mounts, draft]
                        }))
                        setMountDraft({
                          source_relative_path: '',
                          target_windows_path: '',
                          create_source_if_missing: true
                        })
                        setMountDialogOpen(false)
                      }}
                    >
                      {ct('creator_label_confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={mountSourceBrowserOpen()} onOpenChange={setMountSourceBrowserOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_select_folder_inside_game')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_mini_browser_restricted_to_the_game_root_to_prevent_moun')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-3">
                    <div class="rounded-md border border-border/60 bg-muted/25 p-3">
                      <p class="mb-2 text-xs font-medium text-muted-foreground">
                        {ct('creator_current_path')}
                      </p>
                      <nav class="overflow-x-auto" aria-label={ct('creator_folder_breadcrumb')}>
                        <ol class="flex min-w-max items-center gap-1 text-xs">
                          <Show when={gameRoot().trim()}>
                            <li>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                class="h-7 px-2"
                                onClick={() => void loadMountBrowserDirs(gameRoot())}
                              >
                                {basenamePath(gameRoot()) || '/'}
                              </Button>
                            </li>
                          </Show>
                          <For each={mountSourceBrowserSegments()}>
                            {(segment) => (
                              <>
                                <li class="text-muted-foreground">/</li>
                                <li>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="h-7 px-2"
                                    onClick={() => void loadMountBrowserDirs(segment.path)}
                                  >
                                    {segment.label}
                                  </Button>
                                </li>
                              </>
                            )}
                          </For>
                        </ol>
                      </nav>
                    </div>

                    <div class="rounded-md border border-border/60 bg-background/40">
                      <Show
                        when={!mountBrowserLoading()}
                        fallback={
                          <div class="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                            <Spinner class="size-3" />
                            {ct('creator_loading_folders')}
                          </div>
                        }
                      >
                        <Show
                          when={mountBrowserDirs().length > 0}
                          fallback={
                            <div class="px-3 py-2 text-xs text-muted-foreground">
                              {ct('creator_no_subfolder_found')}
                            </div>
                          }
                        >
                          <div class="grid gap-1 p-1">
                            <For each={mountBrowserDirs()}>
                              {(dir) => (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  class="justify-start text-left"
                                  onClick={() => void loadMountBrowserDirs(dir)}
                                >
                                  {basenamePath(dir)}
                                </Button>
                              )}
                            </For>
                          </div>
                        </Show>
                      </Show>
                    </div>

                    <div class="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <div class="min-w-0">
                        <p class="text-xs font-medium text-muted-foreground">{ct('creator_select_this_folder')}</p>
                        <p class="truncate text-xs">
                          {mountSourceBrowserCurrentRelative() || './'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => {
                          setMountDraft((prev: any) => ({
                            ...prev,
                            source_relative_path: mountSourceBrowserCurrentRelative() || './'
                          }))
                          setMountSourceBrowserOpen(false)
                        }}
                      >
                        {ct('creator_use_this_folder')}
                      </Button>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setMountSourceBrowserOpen(false)}>
                      {ct('creator_close')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>
          </section>
  )
}
