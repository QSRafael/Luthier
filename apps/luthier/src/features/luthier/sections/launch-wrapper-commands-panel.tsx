import { createMemo, For, Show } from 'solid-js'
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-solidjs'

import { FieldShell, KeyValueListField } from '../../../components/form/FormControls'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'
import {
  featureStateEnabled,
  featureStateMandatory,
  type LuthierPageSectionProps,
} from '../page-shared'
import { validateEnvVarName, validateWrapperExecutable } from '../field-validation'

export function LaunchWrapperCommandsPanel(props: LuthierPageSectionProps) {
  const {
    config,
    patchConfig,
    ct,
    locale,
    environmentVarsAsList,
    removeAt,
    updateCustomVars,
    setWrapperDialogOpen,
    wrapperDraft,
  } = props.view

  const wrapperExecutableValidation = createMemo(() =>
    wrapperDraft().executable.trim()
      ? validateWrapperExecutable(wrapperDraft().executable, locale())
      : {}
  )
  const wrapperDuplicateValidation = createMemo(() => {
    const executable = wrapperDraft().executable.trim()
    const args = wrapperDraft().args.trim()
    if (!executable) return ''
    const duplicate = config().compatibility.wrapper_commands.some(
      (item) => item.executable.trim() === executable && item.args.trim() === args
    )
    if (!duplicate) return ''
    return ct('luthier_validation_duplicate_wrapper')
  })

  return (
    <>
      <FieldShell
        label={ct('luthier_wrapper_commands')}
        help={ct('luthier_commands_executed_before_the_main_runtime_e_g_gamescope')}
        controlClass="flex justify-end"
        footer={
          <div class="grid gap-2">
            <Show
              when={config().compatibility.wrapper_commands.length > 0}
              fallback={
                <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {ct('luthier_no_wrapper_command_added')}
                </div>
              }
            >
              <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
                <Table>
                  <TableHeader>
                    <TableRow class="hover:bg-transparent">
                      <TableHead>{ct('luthier_label_enabled')}</TableHead>
                      <TableHead>{ct('luthier_label_mandatory')}</TableHead>
                      <TableHead>{ct('luthier_executable')}</TableHead>
                      <TableHead>{ct('luthier_arguments')}</TableHead>
                      <TableHead class="w-14 text-right">{ct('luthier_label_action')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <For each={config().compatibility.wrapper_commands}>
                      {(item, index) => (
                        <TableRow>
                          <TableCell>
                            {featureStateEnabled(item.state) ? ct('luthier_yes') : ct('luthier_no')}
                          </TableCell>
                          <TableCell>
                            {featureStateMandatory(item.state)
                              ? ct('luthier_yes')
                              : ct('luthier_no')}
                          </TableCell>
                          <TableCell class="font-medium">{item.executable}</TableCell>
                          <TableCell class="text-muted-foreground">{item.args || '—'}</TableCell>
                          <TableCell class="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                patchConfig((prev) => ({
                                  ...prev,
                                  compatibility: {
                                    ...prev.compatibility,
                                    wrapper_commands: removeAt(
                                      prev.compatibility.wrapper_commands,
                                      index()
                                    ),
                                  },
                                }))
                              }
                              title={ct('luthier_remove_wrapper')}
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
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="inline-flex items-center gap-1.5"
          onClick={() => setWrapperDialogOpen(true)}
        >
          <IconPlus class="size-4" />
          {ct('luthier_add_wrapper')}
        </Button>
      </FieldShell>

      <KeyValueListField
        label={ct('luthier_environment_variables')}
        help={ct('luthier_applied_at_launch_protected_keys_are_ignored_by_runtime')}
        items={environmentVarsAsList()}
        onChange={updateCustomVars}
        keyPlaceholder="WINE_FULLSCREEN_FSR"
        valuePlaceholder="1"
        addLabel={ct('luthier_add_variable')}
        removeLabel={ct('luthier_label_remove')}
        emptyMessage={ct('luthier_no_environment_variable_added')}
        tableHeaders={{
          key: ct('luthier_variable'),
          value: ct('luthier_value'),
        }}
        validateDraft={(draft, items) => {
          if (!draft.key && !draft.value) return undefined
          const keyValidation = validateEnvVarName(draft.key, locale())
          if (keyValidation.error) {
            return { keyError: keyValidation.error, keyHint: keyValidation.hint }
          }

          const duplicate = items.some((item) => item.key.trim() === draft.key.trim())
          if (duplicate) {
            return { formError: ct('luthier_validation_duplicate_env_var') }
          }

          return undefined
        }}
      />

      <Alert variant="warning">
        <IconAlertCircle />
        <AlertTitle>{ct('luthier_runtime_protected_keys')}</AlertTitle>
        <AlertDescription>
          <span class="block">
            {ct('luthier_the_keys_below_are_reserved_if_added_above_they_will_be')}
          </span>
          <span class="mt-1 block font-mono text-[11px]">WINEPREFIX · PROTON_VERB</span>
        </AlertDescription>
      </Alert>
    </>
  )
}
