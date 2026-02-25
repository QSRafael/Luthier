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

export function LaunchEnvironmentTabSection(props: CreatorPageSectionProps) {
    const {
    config,
    patchConfig,
    ct,
    environmentVarsAsList,
    removeAt,
    updateCustomVars,
    wrapperDialogOpen,
    setWrapperDialogOpen,
    wrapperDraft,
    setWrapperDraft,
    launchScriptsAccordionOpen,
    setLaunchScriptsAccordionOpen,
  } = props.view

  return (
          <section class="stack">
            <FieldShell
              label={ct('creator_wrapper_commands')}
              help={ct('creator_commands_executed_before_the_main_runtime_e_g_gamescope')}
              controlClass="flex justify-end"
              footer={
                <div class="grid gap-2">
                  <Show
                    when={config().compatibility.wrapper_commands.length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('creator_no_wrapper_command_added')}
                      </div>
                    }
                  >
                    <div class="rounded-md border border-border/60 bg-background/40">
                      <Table>
                        <TableHeader>
                          <TableRow class="hover:bg-transparent">
                            <TableHead>{ct('creator_label_enabled')}</TableHead>
                            <TableHead>{ct('creator_label_mandatory')}</TableHead>
                            <TableHead>{ct('creator_executable')}</TableHead>
                            <TableHead>{ct('creator_arguments')}</TableHead>
                            <TableHead class="w-14 text-right">{ct('creator_label_action')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <For each={config().compatibility.wrapper_commands}>
                            {(item, index) => (
                              <TableRow>
                                <TableCell>{featureStateEnabled(item.state) ? ct('creator_yes') : ct('creator_no')}</TableCell>
                                <TableCell>{featureStateMandatory(item.state) ? ct('creator_yes') : ct('creator_no')}</TableCell>
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
                                          wrapper_commands: removeAt(prev.compatibility.wrapper_commands, index())
                                        }
                                      }))
                                    }
                                    title={ct('creator_remove_wrapper')}
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
              <Dialog open={wrapperDialogOpen()} onOpenChange={setWrapperDialogOpen}>
                <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setWrapperDialogOpen(true)}>
                  <IconPlus class="size-4" />
                  {ct('creator_add_wrapper')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_wrapper')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_set_policy_executable_and_wrapper_arguments')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-3">
                    <div class="grid gap-2 md:grid-cols-2">
                      <SwitchChoiceCard
                        title={ct('creator_label_enabled')}
                        checked={featureStateEnabled(wrapperDraft().state)}
                        onChange={(checked) =>
                          setWrapperDraft((prev: any) => ({
                            ...prev,
                            state: buildFeatureState(checked, featureStateMandatory(prev.state))
                          }))
                        }
                      />
                      <SwitchChoiceCard
                        title={ct('creator_label_mandatory')}
                        checked={featureStateMandatory(wrapperDraft().state)}
                        onChange={(checked) =>
                          setWrapperDraft((prev: any) => ({
                            ...prev,
                            state: buildFeatureState(featureStateEnabled(prev.state), checked)
                          }))
                        }
                      />
                    </div>
                    <Input
                      value={wrapperDraft().executable}
                      placeholder={ct('creator_executable_e_g_gamescope')}
                      onInput={(e) =>
                        setWrapperDraft((prev: any) => ({
                          ...prev,
                          executable: e.currentTarget.value
                        }))
                      }
                    />
                    <Input
                      value={wrapperDraft().args}
                      placeholder={ct('creator_args_e_g_w_1920_h_1080')}
                      onInput={(e) =>
                        setWrapperDraft((prev: any) => ({
                          ...prev,
                          args: e.currentTarget.value
                        }))
                      }
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setWrapperDialogOpen(false)}>
                      {ct('creator_label_cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!wrapperDraft().executable.trim()}
                      onClick={() => {
                        const draft = wrapperDraft()
                        if (!draft.executable.trim()) return
                        patchConfig((prev) => ({
                          ...prev,
                          compatibility: {
                            ...prev.compatibility,
                            wrapper_commands: [...prev.compatibility.wrapper_commands, draft]
                          }
                        }))
                        setWrapperDraft({
                          state: 'OptionalOff',
                          executable: '',
                          args: ''
                        })
                        setWrapperDialogOpen(false)
                      }}
                    >
                      {ct('creator_label_confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>

            <KeyValueListField
              label={ct('creator_environment_variables')}
              help={ct('creator_applied_at_launch_protected_keys_are_ignored_by_runtime')}
              items={environmentVarsAsList()}
              onChange={updateCustomVars}
              keyPlaceholder="WINE_FULLSCREEN_FSR"
              valuePlaceholder="1"
              addLabel={ct('creator_add_variable')}
              removeLabel={ct('creator_label_remove')}
              emptyMessage={ct('creator_no_environment_variable_added')}
              tableHeaders={{
                key: ct('creator_variable'),
                value: ct('creator_value')
              }}
            />

            <Alert variant="warning">
              <IconAlertCircle />
              <AlertTitle>{ct('creator_runtime_protected_keys')}</AlertTitle>
              <AlertDescription>
                <span class="block">
                  {ct('creator_the_keys_below_are_reserved_if_added_above_they_will_be')}
                </span>
                <span class="mt-1 block font-mono text-[11px]">WINEPREFIX · PROTON_VERB</span>
              </AlertDescription>
            </Alert>

            <AccordionSection
              open={launchScriptsAccordionOpen()}
              onToggle={() => setLaunchScriptsAccordionOpen((prev: boolean) => !prev)}
              title={ct('creator_label_scripts')}
              description={ct('creator_local_scripts_mvp')}
            >
              <div class="grid gap-3">
                <FieldShell
                  label={ct('creator_pre_launch_script_bash')}
                  help={ct('creator_executed_before_starting_the_game')}
                  controlClass="hidden"
                  footer={
                    <Textarea
                      rows={8}
                      value={config().scripts.pre_launch}
                      placeholder="#!/usr/bin/env bash\necho Preparando..."
                      onInput={(e) =>
                        patchConfig((prev) => ({
                          ...prev,
                          scripts: { ...prev.scripts, pre_launch: e.currentTarget.value }
                        }))
                      }
                    />
                  }
                >
                  <span />
                </FieldShell>

                <FieldShell
                  label={ct('creator_post_launch_script_bash')}
                  help={ct('creator_executed_after_the_game_exits')}
                  controlClass="hidden"
                  footer={
                    <Textarea
                      rows={8}
                      value={config().scripts.post_launch}
                      placeholder="#!/usr/bin/env bash\necho Finalizado..."
                      onInput={(e) =>
                        patchConfig((prev) => ({
                          ...prev,
                          scripts: { ...prev.scripts, post_launch: e.currentTarget.value }
                        }))
                      }
                    />
                  }
                >
                  <span />
                </FieldShell>

                <Alert variant="warning">
                  <IconAlertCircle />
                  <AlertTitle>{ct('creator_local_scripts_mvp')}</AlertTitle>
                  <AlertDescription>
                    <span class="block">
                      {ct('creator_scripts_accept_bash_only_and_local_execution_in_the_mvp')}
                    </span>
                    <span class="mt-1 block">
                      {ct('creator_scripts_are_not_sent_to_the_community_api_use_trusted_co')}
                    </span>
                  </AlertDescription>
                </Alert>
              </div>
            </AccordionSection>
          </section>
  )
}
