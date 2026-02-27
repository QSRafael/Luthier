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
import { Spinner } from '../../../components/ui/spinner'
import { type LuthierPageSectionView, basenamePath, relativeInsideBase } from '../page-shared'
import type { FeatureState } from '../../../models/config'
import { validateCommandToken, validateEnvVarName, validateLinuxPath } from '../field-validation'

type RuntimeAndBrowserDialogsProps = {
  view: LuthierPageSectionView
}

export function RuntimeAndBrowserDialogs(props: RuntimeAndBrowserDialogsProps) {
  const { view } = props
  const {
    ct,
    ctf,
    config,
    patchConfig,
    wrapperDialogOpen,
    setWrapperDialogOpen,
    wrapperDraft,
    setWrapperDraft,
    extraDependencyDialogOpen,
    setExtraDependencyDialogOpen,
    extraDependencyDraft,
    setExtraDependencyDraft,
    featureStateOptions,
    gameRoot,
    exePath,
    setGameRoot,
    setGameRootManualOverride,
    setGameRootChooserOpen,
    gameRootChooserOpen,
    gameRootAncestorCandidates,
    pickGameRootOverride,
    integrityFileBrowserOpen,
    setIntegrityFileBrowserOpen,
    integrityBrowserDirs,
    integrityBrowserFiles,
    integrityBrowserLoading,
    integrityFileBrowserSegments,
    loadIntegrityBrowserEntries,
    resolveIntegrityFileBrowser,
    mountSourceBrowserOpen,
    setMountSourceBrowserOpen,
    mountBrowserDirs,
    mountBrowserLoading,
    mountSourceBrowserSegments,
    mountSourceBrowserCurrentRelative,
    loadMountBrowserDirs,
    setMountDraft,
    splitCommaList,
    formControlsI18n,
    locale,
  } = view

  const tForm = () => formControlsI18n()

  const extraDependencyCommandValidation = createMemo(() => {
    for (const token of splitCommaList(extraDependencyDraft().command || '')) {
      const result = validateCommandToken(token, locale())
      if (result.error) return result.error
    }
    return ''
  })
  const extraDependencyEnvVarsValidation = createMemo(() => {
    for (const token of splitCommaList(extraDependencyDraft().env_vars || '')) {
      const result = validateEnvVarName(token, locale())
      if (result.error) return result.error
    }
    return ''
  })
  const extraDependencyPathsValidation = createMemo(() => {
    for (const token of splitCommaList(extraDependencyDraft().paths || '')) {
      const result = validateLinuxPath(token, locale(), true)
      if (result.error) return result.error
    }
    return ''
  })
  const extraDependencyDuplicateValidation = createMemo(() => {
    const name = extraDependencyDraft().name.trim().toLowerCase()
    if (!name) return ''
    const duplicate = config().extra_system_dependencies.some(
      (item) => item.name.trim().toLowerCase() === name
    )
    if (!duplicate) return ''
    return ct('luthier_validation_duplicate_extra_dependency')
  })

  return (
    <>
      {/* ─── Wrapper Command Dialog ─── */}
      <Dialog open={wrapperDialogOpen()} onOpenChange={setWrapperDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ct('luthier_add_wrapper_command')}</DialogTitle>
            <DialogDescription>{tForm().addListDialogDescription}</DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <label class="text-sm font-medium">{ct('luthier_wrapper_executable')}</label>
              <Input
                value={wrapperDraft().executable}
                onInput={(e) =>
                  setWrapperDraft({ ...wrapperDraft(), executable: e.currentTarget.value })
                }
                placeholder="strace"
              />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium">{ct('luthier_arguments_optional')}</label>
              <Input
                value={wrapperDraft().args}
                onInput={(e) => setWrapperDraft({ ...wrapperDraft(), args: e.currentTarget.value })}
                placeholder="-f -e trace=file"
              />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium">{ct('luthier_feature_state')}</label>
              <Select
                value={wrapperDraft().state}
                onInput={(e) =>
                  setWrapperDraft({
                    ...wrapperDraft(),
                    state: e.currentTarget.value as FeatureState,
                  })
                }
              >
                <For each={featureStateOptions()}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWrapperDialogOpen(false)}>
              {tForm().cancel}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (wrapperDraft().executable) {
                  patchConfig((prev) => {
                    const existing = prev.compatibility.wrapper_commands.map((w) => w.executable)
                    if (existing.includes(wrapperDraft().executable.trim())) return prev
                    return {
                      ...prev,
                      compatibility: {
                        ...prev.compatibility,
                        wrapper_commands: [
                          ...prev.compatibility.wrapper_commands,
                          {
                            state: wrapperDraft().state as FeatureState,
                            executable: wrapperDraft().executable.trim(),
                            args: wrapperDraft().args.trim(),
                          },
                        ],
                      },
                    }
                  })
                  setWrapperDraft({
                    state: 'OptionalOff' as FeatureState,
                    executable: '',
                    args: '',
                  })
                  setWrapperDialogOpen(false)
                }
              }}
              disabled={!wrapperDraft().executable.trim()}
            >
              {tForm().add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Extra System Dependency Dialog ─── */}
      <Dialog open={extraDependencyDialogOpen()} onOpenChange={setExtraDependencyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ct('luthier_add_extra_system_dependency')}</DialogTitle>
            <DialogDescription>{tForm().addKeyValueDialogDescription}</DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <label class="text-sm font-medium">{ct('luthier_dependency_name')}</label>
              <Input
                value={extraDependencyDraft().name}
                class={
                  extraDependencyDuplicateValidation()
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
                onInput={(e) =>
                  setExtraDependencyDraft({
                    ...extraDependencyDraft(),
                    name: e.currentTarget.value,
                  })
                }
                placeholder="libgl1-mesa-glx"
              />
              <Show when={extraDependencyDuplicateValidation()}>
                <p class="text-xs text-destructive">{extraDependencyDuplicateValidation()}</p>
              </Show>
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium">{ct('luthier_test_command_optional')}</label>
              <Input
                value={extraDependencyDraft().command}
                class={
                  extraDependencyCommandValidation()
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
                onInput={(e) =>
                  setExtraDependencyDraft({
                    ...extraDependencyDraft(),
                    command: e.currentTarget.value,
                  })
                }
                placeholder={ct('luthier_terminal_command_e_g_mangohud')}
              />
              <Show when={extraDependencyCommandValidation()}>
                <p class="text-xs text-destructive">{extraDependencyCommandValidation()}</p>
              </Show>
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium">{ct('luthier_env_vars')}</label>
              <Input
                value={extraDependencyDraft().env_vars}
                class={
                  extraDependencyEnvVarsValidation()
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
                onInput={(e) =>
                  setExtraDependencyDraft({
                    ...extraDependencyDraft(),
                    env_vars: e.currentTarget.value,
                  })
                }
                placeholder={ct('luthier_environment_vars_comma_separated')}
              />
              <Show when={extraDependencyEnvVarsValidation()}>
                <p class="text-xs text-destructive">{extraDependencyEnvVarsValidation()}</p>
              </Show>
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium">{ct('luthier_default_paths')}</label>
              <Input
                value={extraDependencyDraft().paths}
                class={
                  extraDependencyPathsValidation()
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
                onInput={(e) =>
                  setExtraDependencyDraft({
                    ...extraDependencyDraft(),
                    paths: e.currentTarget.value,
                  })
                }
                placeholder={ct('luthier_default_paths_comma_separated')}
              />
              <Show when={extraDependencyPathsValidation()}>
                <p class="text-xs text-destructive">{extraDependencyPathsValidation()}</p>
              </Show>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExtraDependencyDialogOpen(false)}
            >
              {tForm().cancel}
            </Button>
            <Button
              type="button"
              disabled={
                !extraDependencyDraft().name.trim() ||
                !!extraDependencyDuplicateValidation() ||
                !!extraDependencyCommandValidation() ||
                !!extraDependencyEnvVarsValidation() ||
                !!extraDependencyPathsValidation()
              }
              onClick={() => {
                const draft = extraDependencyDraft()
                if (
                  !draft.name.trim() ||
                  extraDependencyDuplicateValidation() ||
                  extraDependencyCommandValidation() ||
                  extraDependencyEnvVarsValidation() ||
                  extraDependencyPathsValidation()
                ) {
                  return
                }
                patchConfig((prev) => ({
                  ...prev,
                  extra_system_dependencies: [
                    ...prev.extra_system_dependencies,
                    {
                      name: draft.name.trim(),
                      check_commands: splitCommaList(draft.command),
                      check_env_vars: splitCommaList(draft.env_vars),
                      check_paths: splitCommaList(draft.paths),
                      state: 'Enabled' as FeatureState,
                    },
                  ],
                }))
                setExtraDependencyDraft({ name: '', command: '', env_vars: '', paths: '' })
                setExtraDependencyDialogOpen(false)
              }}
            >
              {tForm().add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ─── Game Root Chooser Dialog ─── */}
      <Dialog open={gameRootChooserOpen()} onOpenChange={setGameRootChooserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ct('luthier_choose_game_root_folder')}</DialogTitle>
            <DialogDescription>
              {ct('luthier_the_game_root_must_be_an_ancestor_of_the_folder_that_con')}
            </DialogDescription>
          </DialogHeader>

          <Show
            when={gameRootAncestorCandidates().length > 0}
            fallback={
              <div class="grid gap-3">
                <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {ct('luthier_this_guided_flow_requires_an_absolute_executable_path_lo')}
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
                    {ct('luthier_use_system_picker')}
                  </Button>
                </div>
              </div>
            }
          >
            <div class="grid gap-3">
              <div class="rounded-md border border-border/60 bg-muted/25 p-3">
                <p class="mb-2 text-xs font-medium text-muted-foreground">
                  {ct('luthier_executable_folder_breadcrumb')}
                </p>
                <nav class="overflow-x-auto" aria-label={ct('luthier_executable_path')}>
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
                                const exeDir = basenamePath(exePath())
                                setGameRootManualOverride(candidate !== exeDir)
                                setGameRoot(candidate)
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
                  {ct('luthier_select_which_ancestor_level_should_be_the_game_root')}
                </p>
                <div class="grid gap-2">
                  <For each={[...gameRootAncestorCandidates()].reverse()}>
                    {(candidate) => {
                      const isAutoRoot = candidate === basenamePath(exePath())
                      const relativeToExe = relativeInsideBase(candidate, exePath())
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
                            setGameRootManualOverride(!isAutoRoot)
                            setGameRoot(candidate)
                            setGameRootChooserOpen(false)
                          }}
                        >
                          <span class="text-sm font-medium">{candidate}</span>
                          <span class="text-xs text-muted-foreground">
                            {isAutoRoot
                              ? ct('luthier_same_directory_as_executable_automatic')
                              : ctf('luthier_executable_lives_in_relative_path', {
                                  path: relativeToExe ?? '',
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
              {ct('luthier_close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Integrity File Browser Dialog ─── */}
      <Dialog
        open={integrityFileBrowserOpen?.() ?? false}
        onOpenChange={(open: boolean) => {
          setIntegrityFileBrowserOpen?.(open)
          if (!open) resolveIntegrityFileBrowser?.(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ct('luthier_select_file_inside_game')}</DialogTitle>
            <DialogDescription>
              {ct('luthier_mini_file_browser_restricted_to_the_game_root_to_prevent')}
            </DialogDescription>
          </DialogHeader>

          <div class="grid gap-3">
            <div class="rounded-md border border-border/60 bg-muted/25 p-3">
              <p class="mb-2 text-xs font-medium text-muted-foreground">
                {ct('luthier_current_path')}
              </p>
              <nav class="overflow-x-auto" aria-label={ct('luthier_folder_breadcrumb')}>
                <ol class="flex min-w-max items-center gap-1 text-xs">
                  <Show when={gameRoot().trim()}>
                    <li>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2"
                        onClick={() => void loadIntegrityBrowserEntries?.(gameRoot())}
                      >
                        {basenamePath(gameRoot()) || '/'}
                      </Button>
                    </li>
                  </Show>
                  <For each={integrityFileBrowserSegments?.() ?? []}>
                    {(segment) => (
                      <>
                        <li class="text-muted-foreground">/</li>
                        <li>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            class="h-7 px-2"
                            onClick={() => void loadIntegrityBrowserEntries?.(segment.path)}
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
                when={!(integrityBrowserLoading?.() ?? false)}
                fallback={
                  <div class="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                    <Spinner class="size-3" />
                    {ct('luthier_loading_files')}
                  </div>
                }
              >
                <div class="grid gap-2 p-2">
                  <div class="grid gap-1">
                    <p class="px-1 text-xs font-medium text-muted-foreground">
                      {ct('luthier_folders')}
                    </p>
                    <Show
                      when={(integrityBrowserDirs?.() ?? []).length > 0}
                      fallback={
                        <div class="px-2 py-1 text-xs text-muted-foreground">
                          {ct('luthier_no_subfolder_found')}
                        </div>
                      }
                    >
                      <For each={integrityBrowserDirs?.() ?? []}>
                        {(dir) => (
                          <Button
                            type="button"
                            variant="ghost"
                            class="justify-start text-left"
                            onClick={() => void loadIntegrityBrowserEntries?.(dir)}
                          >
                            {basenamePath(dir)}
                          </Button>
                        )}
                      </For>
                    </Show>
                  </div>

                  <div class="grid gap-1 border-t border-border/60 pt-2">
                    <p class="px-1 text-xs font-medium text-muted-foreground">
                      {ct('luthier_files')}
                    </p>
                    <Show
                      when={(integrityBrowserFiles?.() ?? []).length > 0}
                      fallback={
                        <div class="px-2 py-1 text-xs text-muted-foreground">
                          {ct('luthier_no_file_found_in_current_folder')}
                        </div>
                      }
                    >
                      <For each={integrityBrowserFiles?.() ?? []}>
                        {(file) => {
                          const relative = relativeInsideBase(gameRoot().trim(), file)
                          return (
                            <Button
                              type="button"
                              variant="ghost"
                              class="justify-start text-left"
                              onClick={() => {
                                if (!relative) return
                                resolveIntegrityFileBrowser?.(`./${relative}`)
                                setIntegrityFileBrowserOpen?.(false)
                              }}
                            >
                              {basenamePath(file)}
                            </Button>
                          )
                        }}
                      </For>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>

            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {ct('luthier_select_a_file_to_fill_this_field_automatically')}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIntegrityFileBrowserOpen?.(false)
                resolveIntegrityFileBrowser?.(null)
              }}
            >
              {ct('luthier_close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Mount Source Browser Dialog ─── */}
      <Dialog open={mountSourceBrowserOpen()} onOpenChange={setMountSourceBrowserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ct('luthier_select_folder_inside_game')}</DialogTitle>
            <DialogDescription>
              {ct('luthier_mini_browser_restricted_to_the_game_root_to_prevent_moun')}
            </DialogDescription>
          </DialogHeader>

          <div class="grid gap-3">
            <div class="rounded-md border border-border/60 bg-muted/25 p-3">
              <p class="mb-2 text-xs font-medium text-muted-foreground">
                {ct('luthier_current_path')}
              </p>
              <nav class="overflow-x-auto" aria-label={ct('luthier_folder_breadcrumb')}>
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
                    {ct('luthier_loading_folders')}
                  </div>
                }
              >
                <Show
                  when={mountBrowserDirs().length > 0}
                  fallback={
                    <div class="px-3 py-2 text-xs text-muted-foreground">
                      {ct('luthier_no_subfolder_found')}
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
                <p class="text-xs font-medium text-muted-foreground">
                  {ct('luthier_select_this_folder')}
                </p>
                <p class="truncate text-xs">{mountSourceBrowserCurrentRelative() || './'}</p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setMountDraft((prev: any) => ({
                    ...prev,
                    source_relative_path: mountSourceBrowserCurrentRelative() || './',
                  }))
                  setMountSourceBrowserOpen(false)
                }}
              >
                {ct('luthier_use_this_folder')}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMountSourceBrowserOpen(false)}
            >
              {ct('luthier_close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
