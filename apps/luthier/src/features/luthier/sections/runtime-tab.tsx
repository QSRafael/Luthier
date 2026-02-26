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
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemMain, ItemTitle } from '../../../components/ui/item'
import { Select } from '../../../components/ui/select'
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

export function RuntimeTabSection(props: LuthierPageSectionProps) {
    const {
    config,
    patchConfig,
    ct,
    runtimePreferenceOptions,
    runtimeVersionFieldLabel,
    runtimeVersionFieldHelp,
  } = props.view

  return (
          <section class="stack">
            <SegmentedField<RuntimePreference>
              label={ct('luthier_general_runtime_preference')}
              help="Selecione o runtime principal do jogo. Proton-GE é o padrão recomendado."
              value={config().runner.runtime_preference}
              options={runtimePreferenceOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  runner: {
                    ...prev.runner,
                    runtime_preference: value
                  }
                }))
              }
            />

            <Item>
              <ItemMain>
                <ItemContent>
                  <div class="flex items-center gap-2">
                    <ItemTitle>{runtimeVersionFieldLabel()}</ItemTitle>
                    <span
                      class="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-medium text-muted-foreground"
                      title={runtimeVersionFieldHelp()}
                    >
                      ?
                    </span>
                  </div>
                  <ItemDescription>{runtimeVersionFieldHelp()}</ItemDescription>
                </ItemContent>

                <ItemActions class="md:self-end">
                  <Input
                    value={config().runner.proton_version}
                    placeholder={
                      config().runner.runtime_preference === 'Wine' ? 'wine-ge-8-26' : 'GE-Proton-latest'
                    }
                    onInput={(e) =>
                      patchConfig((prev) => ({
                        ...prev,
                        runner: {
                          ...prev.runner,
                          proton_version: e.currentTarget.value
                        }
                      }))
                    }
                  />
                </ItemActions>
              </ItemMain>

              <ItemFooter>
                <div class="grid gap-3 md:grid-cols-2">
                  <SwitchChoiceCard
                    title={ct('luthier_required_version')}
                    description={ct('luthier_when_enabled_requires_the_configured_runtime_version_to')}
                    checked={config().requirements.runtime.strict}
                    onChange={(checked) =>
                      patchConfig((prev) => ({
                        ...prev,
                        requirements: {
                          ...prev.requirements,
                          runtime: {
                            ...prev.requirements.runtime,
                            strict: checked
                          }
                        }
                      }))
                    }
                  />

                  <SwitchChoiceCard
                    title={ct('luthier_auto_update')}
                    description={ct('luthier_updates_runtime_metadata_when_applicable_before_launchin')}
                    checked={config().runner.auto_update}
                    onChange={(checked) =>
                      patchConfig((prev) => ({
                        ...prev,
                        runner: {
                          ...prev.runner,
                          auto_update: checked
                        }
                      }))
                    }
                  />
                </div>
              </ItemFooter>
            </Item>

            <Item>
              <div class="grid gap-3 md:grid-cols-2">
                <SwitchChoiceCard
                  title="ESYNC"
                  description={ct('luthier_enables_synchronization_optimizations_in_runtime')}
                  checked={config().runner.esync}
                  onChange={(checked) =>
                    patchConfig((prev) => ({
                      ...prev,
                      runner: {
                        ...prev.runner,
                        esync: checked
                      }
                    }))
                  }
                />

                <SwitchChoiceCard
                  title="FSYNC"
                  description={ct('luthier_enables_fsync_optimizations_when_supported')}
                  checked={config().runner.fsync}
                  onChange={(checked) =>
                    patchConfig((prev) => ({
                      ...prev,
                      runner: {
                        ...prev.runner,
                        fsync: checked
                      }
                    }))
                  }
                />
              </div>
            </Item>

            <Item>
              <ItemMain>
                <ItemContent>
                  <ItemTitle>UMU</ItemTitle>
                  <ItemDescription>
                    Obrigatório na configuração atual. O launcher usa `umu-run` como runtime padrão para Proton.
                  </ItemDescription>
                </ItemContent>
                <ItemActions class="md:self-end">
                  <div class="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium">
                    Obrigatório
                  </div>
                </ItemActions>
              </ItemMain>
            </Item>

            <FeatureStateField
              label="Easy AntiCheat Runtime"
              help={ct('luthier_policy_for_local_easy_anticheat_runtime')}
              value={config().compatibility.easy_anti_cheat_runtime}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    easy_anti_cheat_runtime: value
                  }
                }))
              }
            />

            <FeatureStateField
              label="BattleEye Runtime"
              help={ct('luthier_policy_for_local_battleeye_runtime')}
              value={config().compatibility.battleye_runtime}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    battleye_runtime: value
                  }
                }))
              }
            />

          </section>
  )
}
