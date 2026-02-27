import { createMemo, For, Show } from 'solid-js'
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
} from '../page-shared'
import {
  validateCommandToken,
  validateEnvVarName,
  validateLinuxPath,
  validateRegistryPath,
  validateRegistryValueType,
} from '../field-validation'
import { DependenciesWinetricksPanel } from './dependencies-winetricks-panel'

export function DependenciesTabSection(props: LuthierPageSectionProps) {
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
    locale,
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
  } = props.view

  const registryPathValidationSafe = createMemo(() =>
    registryDraft().path.trim() ? validateRegistryPath(registryDraft().path, locale()) : {}
  )
  const registryTypeValidation = createMemo(() =>
    registryDraft().value_type.trim() ? validateRegistryValueType(registryDraft().value_type, locale()) : {}
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

  const extraDependencyCommandValidation = createMemo(() => {
    for (const token of splitCommaList(extraDependencyDraft().command)) {
      const result = validateCommandToken(token, locale())
      if (result.error) return result.error
    }
    return ''
  })
  const extraDependencyEnvVarsValidation = createMemo(() => {
    for (const token of splitCommaList(extraDependencyDraft().env_vars)) {
      const result = validateEnvVarName(token, locale())
      if (result.error) return result.error
    }
    return ''
  })
  const extraDependencyPathsValidation = createMemo(() => {
    for (const token of splitCommaList(extraDependencyDraft().paths)) {
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
    <section class="stack">
      <DependenciesWinetricksPanel view={props.view} />

      <FieldShell
        label={ct('luthier_registry_keys')}
        help={ct('luthier_table_of_keys_applied_to_prefix_after_bootstrap')}
        controlClass="flex flex-wrap justify-end gap-2"
        footer={
          <Show
            when={config().registry_keys.length > 0}
            fallback={
              <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                {ct('luthier_no_key_added')}
              </div>
            }
          >
            <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
              <Table>
                <TableHeader>
                  <TableRow class="hover:bg-transparent">
                    <TableHead>{ct('luthier_path')}</TableHead>
                    <TableHead>{ct('luthier_name')}</TableHead>
                    <TableHead>{ct('luthier_type')}</TableHead>
                    <TableHead>{ct('luthier_value')}</TableHead>
                    <TableHead class="w-[72px] text-right">{ct('luthier_label_actions')}</TableHead>
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
                            title={ct('luthier_remove_key')}
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
        <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setRegistryDialogOpen(true)}>
          <IconPlus class="size-4" />
          {ct('luthier_add_key')}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          class="inline-flex items-center gap-1.5"
          onClick={importRegistryKeysFromRegFile}
          disabled={!canImportRegistryFromFile()}
        >
          <IconPlus class="size-4" />
          {ct('luthier_add_from_file_reg')}
        </Button>

      </FieldShell>

      <FieldShell
        label={ct('luthier_extra_system_dependencies')}
        help={ct('luthier_additional_dependencies_validated_in_doctor_by_command_e')}
        controlClass="flex justify-end"
        footer={
          config().extra_system_dependencies.length > 0 ? (
            <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
              <Table>
                <TableHeader>
                  <TableRow class="hover:bg-transparent">
                    <TableHead>{ct('luthier_name')}</TableHead>
                    <TableHead>{ct('luthier_command')}</TableHead>
                    <TableHead>{ct('luthier_env_vars')}</TableHead>
                    <TableHead>{ct('luthier_default_paths')}</TableHead>
                    <TableHead class="w-[72px] text-right">{ct('luthier_label_actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={config().extra_system_dependencies}>
                    {(item, index) => (
                      <TableRow>
                        <TableCell class="max-w-[220px] truncate font-medium">
                          {item.name || ct('luthier_unnamed')}
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
                            title={ct('luthier_remove_dependency')}
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
              {ct('luthier_no_extra_dependency_added')}
            </div>
          )
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="inline-flex items-center gap-1.5"
          onClick={() => setExtraDependencyDialogOpen(true)}
        >
          <IconPlus class="size-4" />
          {ct('luthier_add_dependency')}
        </Button>
      </FieldShell>

    </section>
  )
}
