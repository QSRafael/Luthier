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

export function DependenciesTabSection(props: CreatorPageSectionProps) {
    const {
    winetricksAvailable,
    winetricksLoading,
    winetricksSource,
    winetricksSearch,
    setWinetricksSearch,
    winetricksCatalogError,
    config,
    patchConfig,
    ct,
    normalizedWinetricksSearch,
    winetricksCandidates,
    splitCommaList,
    joinCommaList,
    removeAt,
    loadWinetricksCatalog,
    addWinetricksVerb,
    removeWinetricksVerb,
    addWinetricksFromSearch,
    registryDialogOpen,
    setRegistryDialogOpen,
    registryDraft,
    setRegistryDraft,
    registryImportWarningsOpen,
    setRegistryImportWarningsOpen,
    registryImportWarnings,
    extraDependencyDialogOpen,
    setExtraDependencyDialogOpen,
    extraDependencyDraft,
    setExtraDependencyDraft,
    canImportRegistryFromFile,
    importRegistryKeysFromRegFile,
  } = props.view as any

  return (
          <section class="stack">
            <FieldShell
              label="Winetricks"
              help={ct('creator_enabled_automatically_when_at_least_one_verb_is_configur')}
              controlClass="flex flex-col items-end gap-2"
              footer={
                <div class="grid gap-2">
                  <div class="rounded-md border border-input bg-background px-2 py-2">
                    <div class="flex min-h-9 flex-wrap items-center gap-1.5">
                      <For each={config().dependencies}>
                        {(verb) => (
                          <span class="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/35 px-2 py-1 text-xs">
                            <span class="truncate">{verb}</span>
                            <button
                              type="button"
                              class="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                              onClick={() => removeWinetricksVerb(verb)}
                              aria-label={ct('creator_remove_verb')}
                              title={ct('creator_remove_verb')}
                            >
                              <IconX class="size-3" />
                            </button>
                          </span>
                        )}
                      </For>

                      <Input
                        value={winetricksSearch()}
                        disabled={winetricksCatalogError() || winetricksLoading()}
                        placeholder={
                          winetricksCatalogError()
                            ? ct('creator_failed_to_load_winetricks_catalog')
                            : ct('creator_search_and_add_verbs_e_g_vcrun_corefonts')
                        }
                        class="h-7 min-w-[220px] flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        onInput={(e) => setWinetricksSearch(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (winetricksCatalogError()) return
                            const exact = winetricksCandidates().find(
                              (item) => item.toLowerCase() === winetricksSearch().trim().toLowerCase()
                            )
                            if (exact) {
                              addWinetricksVerb(exact)
                              setWinetricksSearch('')
                              return
                            }
                            const first = winetricksCandidates()[0]
                            if (first) {
                              addWinetricksVerb(first)
                              setWinetricksSearch('')
                              return
                            }
                            addWinetricksFromSearch()
                          }
                        }}
                      />
                    </div>
                  </div>

                  <Show when={winetricksCatalogError()}>
                    <Alert variant="destructive">
                      <IconAlertCircle />
                      <AlertTitle>{ct('creator_failed_to_load_winetricks_catalog')}</AlertTitle>
                      <AlertDescription>
                        {ct('creator_the_local_remote_catalog_could_not_be_loaded_you_can_sti')}
                      </AlertDescription>
                    </Alert>
                  </Show>

                  <Show
                    when={!winetricksCatalogError() && normalizedWinetricksSearch().length >= 2}
                    fallback={
                      <Show when={!winetricksCatalogError()}>
                        <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                          {ct('creator_type_at_least_2_characters_to_search_verbs_in_the_catalo')}
                        </div>
                      </Show>
                    }
                  >
                    <div class="max-h-52 overflow-auto rounded-md border border-border/60 bg-muted/25 p-1">
                      <Show
                        when={winetricksCandidates().length > 0}
                        fallback={
                          <div class="px-2 py-2 text-xs text-muted-foreground">
                            {ct('creator_no_items_found')}
                          </div>
                        }
                      >
                        <div class="grid gap-1">
                          <For each={winetricksCandidates()}>
                            {(verb) => (
                              <button
                                type="button"
                                class="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-accent/40"
                                onClick={() => {
                                  addWinetricksVerb(verb)
                                  setWinetricksSearch('')
                                }}
                              >
                                <span class="truncate">{verb}</span>
                                <span class="text-xs text-muted-foreground">{ct('creator_label_add')}</span>
                              </button>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              }
            >
              <div class="flex flex-col items-end gap-1.5">
                <Show when={winetricksLoading()}>
                  <div class="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner class="size-3" />
                    <span>{ct('creator_loading_catalog_in_background')}</span>
                  </div>
                </Show>
                <Button type="button" variant="outline" onClick={loadWinetricksCatalog} disabled={winetricksLoading()}>
                  {winetricksLoading() ? ct('creator_loading') : ct('creator_refresh_catalog')}
                </Button>
                <p class="text-xs text-muted-foreground">
                  {ct('creator_source')} <strong>{winetricksSource()}</strong> ·{' '}
                  {ct('creator_catalog')} <strong>{winetricksAvailable().length}</strong>
                </p>
              </div>
            </FieldShell>

            <FieldShell
              label={ct('creator_registry_keys')}
              help={ct('creator_table_of_keys_applied_to_prefix_after_bootstrap')}
              controlClass="flex flex-wrap justify-end gap-2"
              footer={
                <Show
                  when={config().registry_keys.length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('creator_no_key_added')}
                    </div>
                  }
                >
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{ct('creator_path')}</TableHead>
                          <TableHead>{ct('creator_name')}</TableHead>
                          <TableHead>{ct('creator_type')}</TableHead>
                          <TableHead>{ct('creator_value')}</TableHead>
                          <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={config().registry_keys}>
                          {(item, index) => (
                            <TableRow>
                              <TableCell class="max-w-[260px] truncate font-medium">{item.path}</TableCell>
                              <TableCell class="max-w-[180px] truncate">{item.name}</TableCell>
                              <TableCell class="max-w-[120px] truncate text-xs text-muted-foreground">
                                {item.value_type}
                              </TableCell>
                              <TableCell class="max-w-[260px] truncate text-muted-foreground">{item.value}</TableCell>
                              <TableCell class="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    patchConfig((prev) => ({
                                      ...prev,
                                      registry_keys: removeAt(prev.registry_keys, index())
                                    }))
                                  }
                                  title={ct('creator_remove_key')}
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
              <Dialog open={registryDialogOpen()} onOpenChange={setRegistryDialogOpen}>
                <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setRegistryDialogOpen(true)}>
                  <IconPlus class="size-4" />
                  {ct('creator_add_key')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_registry_key')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_fill_fields_and_confirm_to_add_row')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <Input
                      value={registryDraft().path}
                      placeholder={ct('creator_path_hkcu')}
                      onInput={(e) =>
                        setRegistryDraft((prev) => ({
                          ...prev,
                          path: e.currentTarget.value
                        }))
                      }
                    />
                    <Input
                      value={registryDraft().name}
                      placeholder={ct('creator_key_name')}
                      onInput={(e) =>
                        setRegistryDraft((prev) => ({
                          ...prev,
                          name: e.currentTarget.value
                        }))
                      }
                    />
                    <div class="grid gap-2 md:grid-cols-2">
                      <Input
                        value={registryDraft().value_type}
                        placeholder={ct('creator_type_reg_sz')}
                        onInput={(e) =>
                          setRegistryDraft((prev) => ({
                            ...prev,
                            value_type: e.currentTarget.value
                          }))
                        }
                      />
                      <Input
                        value={registryDraft().value}
                        placeholder={ct('creator_value')}
                        onInput={(e) =>
                          setRegistryDraft((prev) => ({
                            ...prev,
                            value: e.currentTarget.value
                          }))
                        }
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setRegistryDialogOpen(false)}>
                      {ct('creator_label_cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!registryDraft().path.trim() || !registryDraft().name.trim()}
                      onClick={() => {
                        const draft = registryDraft()
                        if (!draft.path.trim() || !draft.name.trim()) return
                        patchConfig((prev) => ({
                          ...prev,
                          registry_keys: [...prev.registry_keys, draft]
                        }))
                        setRegistryDraft({ path: '', name: '', value_type: 'REG_SZ', value: '' })
                        setRegistryDialogOpen(false)
                      }}
                    >
                      {ct('creator_label_confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                type="button"
                variant="outline"
                size="sm"
                class="inline-flex items-center gap-1.5"
                onClick={importRegistryKeysFromRegFile}
                disabled={!canImportRegistryFromFile()}
              >
                <IconPlus class="size-4" />
                {ct('creator_add_from_file_reg')}
              </Button>

              <Dialog open={registryImportWarningsOpen()} onOpenChange={setRegistryImportWarningsOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_reg_import_warnings')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_some_lines_were_ignored_or_imported_with_fallback_review')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="max-h-[50vh] overflow-auto rounded-md border border-border/60 bg-muted/25 p-2">
                    <div class="grid gap-1">
                      <For each={registryImportWarnings()}>
                        {(warning, index) => (
                          <div class="rounded-md border border-border/40 bg-background/70 px-3 py-2 text-xs">
                            <span class="font-medium text-muted-foreground">{index() + 1}.</span>{' '}
                            <span class="break-words">{warning}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" onClick={() => setRegistryImportWarningsOpen(false)}>
                      {ct('creator_close')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>

            <FieldShell
              label={ct('creator_extra_system_dependencies')}
              help={ct('creator_additional_dependencies_validated_in_doctor_by_command_e')}
              controlClass="flex justify-end"
              footer={
                config().extra_system_dependencies.length > 0 ? (
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{ct('creator_name')}</TableHead>
                          <TableHead>{ct('creator_command')}</TableHead>
                          <TableHead>{ct('creator_env_vars')}</TableHead>
                          <TableHead>{ct('creator_default_paths')}</TableHead>
                          <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={config().extra_system_dependencies}>
                          {(item, index) => (
                            <TableRow>
                              <TableCell class="max-w-[220px] truncate font-medium">
                                {item.name || ct('creator_unnamed')}
                              </TableCell>
                              <TableCell class="max-w-[220px] truncate text-muted-foreground">
                                {item.check_commands.length > 0 ? joinCommaList(item.check_commands) : '—'}
                              </TableCell>
                              <TableCell class="max-w-[220px] truncate text-muted-foreground">
                                {item.check_env_vars.length > 0 ? joinCommaList(item.check_env_vars) : '—'}
                              </TableCell>
                              <TableCell class="max-w-[240px] truncate text-muted-foreground">
                                {item.check_paths.length > 0 ? joinCommaList(item.check_paths) : '—'}
                              </TableCell>
                              <TableCell class="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    patchConfig((prev) => ({
                                      ...prev,
                                      extra_system_dependencies: removeAt(prev.extra_system_dependencies, index())
                                    }))
                                  }
                                  title={ct('creator_remove_dependency')}
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
                ) : (
                  <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    {ct('creator_no_extra_dependency_added')}
                  </div>
                )
              }
            >
              <Dialog open={extraDependencyDialogOpen()} onOpenChange={setExtraDependencyDialogOpen}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="inline-flex items-center gap-1.5"
                  onClick={() => setExtraDependencyDialogOpen(true)}
                >
                  <IconPlus class="size-4" />
                  {ct('creator_add_dependency')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_extra_system_dependency')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_define_how_doctor_can_detect_this_dependency_command_env')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <Input
                      value={extraDependencyDraft().name}
                      placeholder={ct('creator_dependency_name')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          name: e.currentTarget.value
                        }))
                      }
                    />

                    <Input
                      value={extraDependencyDraft().command}
                      placeholder={ct('creator_terminal_command_e_g_mangohud')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          command: e.currentTarget.value
                        }))
                      }
                    />

                    <Input
                      value={extraDependencyDraft().env_vars}
                      placeholder={ct('creator_environment_vars_comma_separated')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          env_vars: e.currentTarget.value
                        }))
                      }
                    />

                    <Input
                      value={extraDependencyDraft().paths}
                      placeholder={ct('creator_default_paths_comma_separated')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          paths: e.currentTarget.value
                        }))
                      }
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setExtraDependencyDialogOpen(false)}>
                      {ct('creator_label_cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!extraDependencyDraft().name.trim()}
                      onClick={() => {
                        const draft = extraDependencyDraft()
                        if (!draft.name.trim()) return

                        patchConfig((prev) => ({
                          ...prev,
                          extra_system_dependencies: [
                            ...prev.extra_system_dependencies,
                            {
                              name: draft.name.trim(),
                              state: 'MandatoryOn',
                              check_commands: splitCommaList(draft.command),
                              check_env_vars: splitCommaList(draft.env_vars),
                              check_paths: splitCommaList(draft.paths)
                            }
                          ]
                        }))

                        setExtraDependencyDraft({
                          name: '',
                          command: '',
                          env_vars: '',
                          paths: ''
                        })
                        setExtraDependencyDialogOpen(false)
                      }}
                    >
                      {ct('creator_label_confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>

          </section>
  )
}
