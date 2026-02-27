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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Spinner } from '../../../components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs'
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
import { validatePositiveIntegerString } from '../field-validation'

export function PerformanceTabSection(props: LuthierPageSectionProps) {
    const {
    config,
    patchConfig,
    ct,
    locale,
    upscaleMethodOptions,
    windowTypeOptions,
    gamescopeEnabled,
    setGamescopeState,
    setGamemodeState,
    setMangohudState,
    gamescopeAdditionalOptionsList,
    setGamescopeAdditionalOptionsList,
    gamescopeUsesMonitorResolution,
    wineWaylandEnabled,
    setGamescopeOutputWidth,
    setGamescopeOutputHeight,
  } = props.view

  const gamescopeGameWidthValidation = createMemo(() =>
    validatePositiveIntegerString(config().environment.gamescope.game_width, locale(), {
      min: 1,
      max: 16384,
      labelPt: 'Largura da resolução do jogo',
      labelEn: 'Game resolution width'
    })
  )
  const gamescopeGameHeightValidation = createMemo(() =>
    validatePositiveIntegerString(config().environment.gamescope.game_height, locale(), {
      min: 1,
      max: 16384,
      labelPt: 'Altura da resolução do jogo',
      labelEn: 'Game resolution height'
    })
  )
  const gamescopeOutputWidthValidation = createMemo(() =>
    validatePositiveIntegerString(config().environment.gamescope.output_width, locale(), {
      min: 1,
      max: 16384,
      labelPt: 'Largura da resolução de saída',
      labelEn: 'Output resolution width'
    })
  )
  const gamescopeOutputHeightValidation = createMemo(() =>
    validatePositiveIntegerString(config().environment.gamescope.output_height, locale(), {
      min: 1,
      max: 16384,
      labelPt: 'Altura da resolução de saída',
      labelEn: 'Output resolution height'
    })
  )
  const gamescopeFpsFocusValidation = createMemo(() =>
    validatePositiveIntegerString(config().environment.gamescope.fps_limiter, locale(), {
      min: 1,
      max: 1000,
      labelPt: 'Limite de FPS',
      labelEn: 'FPS limit'
    })
  )
  const gamescopeFpsNoFocusValidation = createMemo(() =>
    validatePositiveIntegerString(config().environment.gamescope.fps_limiter_no_focus, locale(), {
      min: 1,
      max: 1000,
      labelPt: 'Limite de FPS sem foco',
      labelEn: 'FPS limit without focus'
    })
  )

  return (
          <section class="stack">
            <FeatureStateField
              label="Gamescope"
              help={ct('luthier_defines_gamescope_policy_and_syncs_with_requirements_gam')}
              value={
                config().environment.gamescope.state === 'OptionalOff'
                  ? 'MandatoryOff'
                  : config().environment.gamescope.state
              }
              onChange={setGamescopeState}
              footer={
                <Show
                  when={gamescopeEnabled()}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('luthier_gamescope_is_disabled_enable_it_to_configure_resolution')}
                    </div>
                  }
                >
                  <div class="grid gap-3">
                    <div class="grid gap-3 md:grid-cols-2">
                      <div class="rounded-md border border-border/60 bg-muted/30 p-3">
                        <div class="space-y-1.5">
                          <p class="text-sm font-medium">{ct('luthier_upscale_method')}</p>
                          <p class="text-xs text-muted-foreground">
                            {ct('luthier_method_used_by_gamescope_for_upscaling')}
                          </p>
                        </div>
                        <Tabs
                          value={config().environment.gamescope.upscale_method}
                          onChange={(value) =>
                            patchConfig((prev) => ({
                              ...prev,
                              environment: {
                                ...prev.environment,
                                gamescope: {
                                  ...prev.environment.gamescope,
                                  upscale_method: value as UpscaleMethod,
                                  fsr: value === 'fsr'
                                }
                              }
                            }))
                          }
                          class="mt-3"
                        >
                          <TabsList class="grid h-auto w-full grid-cols-4 gap-1">
                            <For each={upscaleMethodOptions()}>
                              {(option) => (
                                <TabsTrigger
                                  value={option.value}
                                  class="h-auto w-full whitespace-normal px-2 py-2 text-center leading-tight"
                                >
                                  {option.label}
                                </TabsTrigger>
                              )}
                            </For>
                          </TabsList>
                        </Tabs>
                      </div>

                      <div class="rounded-md border border-border/60 bg-muted/30 p-3">
                        <div class="space-y-1.5">
                          <p class="text-sm font-medium">{ct('luthier_window_type')}</p>
                          <p class="text-xs text-muted-foreground">
                            {ct('luthier_defines_gamescope_window_behavior')}
                          </p>
                        </div>
                        <Tabs
                          value={config().environment.gamescope.window_type}
                          onChange={(value) =>
                            patchConfig((prev) => ({
                              ...prev,
                              environment: {
                                ...prev.environment,
                                gamescope: {
                                  ...prev.environment.gamescope,
                                  window_type: value as GamescopeWindowType
                                }
                              }
                            }))
                          }
                          class="mt-3"
                        >
                          <TabsList class="grid h-auto w-full grid-cols-3 gap-1">
                            <For each={windowTypeOptions()}>
                              {(option) => (
                                <TabsTrigger
                                  value={option.value}
                                  class="h-auto w-full whitespace-normal px-2 py-2 text-center leading-tight"
                                >
                                  {option.label}
                                </TabsTrigger>
                              )}
                            </For>
                          </TabsList>
                        </Tabs>
                      </div>
                    </div>

                    <div class="grid gap-3 md:grid-cols-2">
                      <div class="rounded-md border border-border/60 bg-muted/30 p-3">
                        <div class="space-y-1.5">
                          <p class="text-sm font-medium">{ct('luthier_game_resolution')}</p>
                          <p class="text-xs text-muted-foreground">
                            {ct('luthier_game_render_resolution_width_x_height')}
                          </p>
                        </div>
                        <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                          <Input
                            value={config().environment.gamescope.game_width}
                            placeholder="1080"
                            inputMode="numeric"
                            class={gamescopeGameWidthValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                            onInput={(e) =>
                              patchConfig((prev) => ({
                                ...prev,
                                environment: {
                                  ...prev.environment,
                                  gamescope: {
                                    ...prev.environment.gamescope,
                                    game_width: e.currentTarget.value
                                  }
                                }
                              }))
                            }
                          />
                          <span class="text-sm font-semibold text-muted-foreground">x</span>
                          <Input
                            value={config().environment.gamescope.game_height}
                            placeholder="720"
                            inputMode="numeric"
                            class={gamescopeGameHeightValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                            onInput={(e) =>
                              patchConfig((prev) => ({
                                ...prev,
                                environment: {
                                  ...prev.environment,
                                  gamescope: {
                                    ...prev.environment.gamescope,
                                    game_height: e.currentTarget.value
                                  }
                                }
                              }))
                            }
                          />
                        </div>
                        <Show when={gamescopeGameWidthValidation().error || gamescopeGameHeightValidation().error}>
                          <p class="mt-2 text-xs text-destructive">
                            {gamescopeGameWidthValidation().error ?? gamescopeGameHeightValidation().error}
                          </p>
                        </Show>
                      </div>

                      <div class="rounded-md border border-border/60 bg-muted/30 p-3">
                        <div class="space-y-1.5">
                          <p class="text-sm font-medium">{ct('luthier_display_resolution')}</p>
                          <p class="text-xs text-muted-foreground">
                            {ct('luthier_final_gamescope_output_resolution_width_x_height')}
                          </p>
                        </div>

                        <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                          <Input
                            value={config().environment.gamescope.output_width}
                            placeholder={gamescopeUsesMonitorResolution() ? ct('luthier_auto') : '1920'}
                            disabled={gamescopeUsesMonitorResolution()}
                            inputMode="numeric"
                            class={gamescopeOutputWidthValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                            onInput={(e) => setGamescopeOutputWidth(e.currentTarget.value)}
                          />
                          <span class="text-sm font-semibold text-muted-foreground">x</span>
                          <Input
                            value={config().environment.gamescope.output_height}
                            placeholder={gamescopeUsesMonitorResolution() ? ct('luthier_auto') : '1080'}
                            disabled={gamescopeUsesMonitorResolution()}
                            inputMode="numeric"
                            class={gamescopeOutputHeightValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                            onInput={(e) => setGamescopeOutputHeight(e.currentTarget.value)}
                          />
                        </div>
                        <Show
                          when={
                            !gamescopeUsesMonitorResolution() &&
                            (gamescopeOutputWidthValidation().error || gamescopeOutputHeightValidation().error)
                          }
                        >
                          <p class="mt-2 text-xs text-destructive">
                            {gamescopeOutputWidthValidation().error ?? gamescopeOutputHeightValidation().error}
                          </p>
                        </Show>

                        <div class="mt-3">
                          <SwitchChoiceCard
                            title={ct('luthier_use_monitor_resolution')}
                            checked={gamescopeUsesMonitorResolution()}
                            onChange={(checked) => {
                              patchConfig((prev) => {
                                if (checked) {
                                  return {
                                    ...prev,
                                    environment: {
                                      ...prev.environment,
                                      gamescope: {
                                        ...prev.environment.gamescope,
                                        output_width: '',
                                        output_height: '',
                                        resolution: null
                                      }
                                    }
                                  }
                                }

                                const fallbackWidth =
                                  prev.environment.gamescope.output_width.trim() ||
                                  prev.environment.gamescope.game_width.trim() ||
                                  '1920'
                                const fallbackHeight =
                                  prev.environment.gamescope.output_height.trim() ||
                                  prev.environment.gamescope.game_height.trim() ||
                                  '1080'

                                return {
                                  ...prev,
                                  environment: {
                                    ...prev.environment,
                                    gamescope: {
                                      ...prev.environment.gamescope,
                                      output_width: fallbackWidth,
                                      output_height: fallbackHeight,
                                      resolution: `${fallbackWidth}x${fallbackHeight}`
                                    }
                                  }
                                }
                              })
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div class="grid gap-3 md:grid-cols-2">
                      <SwitchChoiceCard
                        title={ct('luthier_enable_fps_limiter')}
                        description={ct('luthier_enables_gamescope_fps_limiter')}
                        checked={config().environment.gamescope.enable_limiter}
                        onChange={(checked) =>
                          patchConfig((prev) => ({
                            ...prev,
                            environment: {
                              ...prev.environment,
                              gamescope: {
                                ...prev.environment.gamescope,
                                enable_limiter: checked
                              }
                            }
                          }))
                        }
                      />

                      <SwitchChoiceCard
                        title={ct('luthier_force_grab_cursor')}
                        description={ct('luthier_forces_relative_mouse_mode_to_avoid_focus_loss')}
                        checked={config().environment.gamescope.force_grab_cursor}
                        onChange={(checked) =>
                          patchConfig((prev) => ({
                            ...prev,
                            environment: {
                              ...prev.environment,
                              gamescope: {
                                ...prev.environment.gamescope,
                                force_grab_cursor: checked
                              }
                            }
                          }))
                        }
                      />
                    </div>

                    <Show when={config().environment.gamescope.enable_limiter}>
                      <div class="table-grid table-grid-two">
                        <TextInputField
                          label={ct('luthier_fps_limit')}
                          help={ct('luthier_fps_limit_when_game_is_focused')}
                          value={config().environment.gamescope.fps_limiter}
                          inputMode="numeric"
                          error={gamescopeFpsFocusValidation().error}
                          onInput={(value) =>
                            patchConfig((prev) => ({
                              ...prev,
                              environment: {
                                ...prev.environment,
                                gamescope: {
                                  ...prev.environment.gamescope,
                                  fps_limiter: value
                                }
                              }
                            }))
                          }
                        />

                        <TextInputField
                          label={ct('luthier_fps_limit_without_focus')}
                          help={ct('luthier_fps_limit_when_game_loses_focus')}
                          value={config().environment.gamescope.fps_limiter_no_focus}
                          inputMode="numeric"
                          error={gamescopeFpsNoFocusValidation().error}
                          onInput={(value) =>
                            patchConfig((prev) => ({
                              ...prev,
                              environment: {
                                ...prev.environment,
                                gamescope: {
                                  ...prev.environment.gamescope,
                                  fps_limiter_no_focus: value
                                }
                              }
                            }))
                          }
                        />
                      </div>
                    </Show>

                    <StringListField
                      label={ct('luthier_gamescope_additional_options')}
                      help={ct('luthier_add_extra_flags_that_will_be_appended_to_the_gamescope_c')}
                      items={gamescopeAdditionalOptionsList()}
                      onChange={setGamescopeAdditionalOptionsList}
                      placeholder={ct('luthier_prefer_vk_device_1002_73bf')}
                      addLabel={ct('luthier_add_option')}
                    />
                  </div>
                </Show>
              }
            />

            <FeatureStateField
              label="Gamemode"
              help={ct('luthier_defines_gamemode_policy')}
              value={config().environment.gamemode}
              onChange={setGamemodeState}
            />

            <FeatureStateField
              label="MangoHud"
              help={ct('luthier_defines_mangohud_policy')}
              value={config().environment.mangohud}
              onChange={setMangohudState}
            />

            <FeatureStateField
              label="Wine-Wayland"
              help={ct('luthier_policy_for_enabling_wine_wayland')}
              value={config().compatibility.wine_wayland}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    wine_wayland: value
                  }
                }))
              }
              footer={
                wineWaylandEnabled() ? (
                  <FeatureStateField
                    label="HDR"
                    help={ct('luthier_policy_for_hdr_depends_on_wine_wayland')}
                    value={config().compatibility.hdr}
                    onChange={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        compatibility: {
                          ...prev.compatibility,
                          hdr: value
                        }
                      }))
                    }
                  />
                ) : undefined
              }
            />

            <FeatureStateField
              label="Auto DXVK-NVAPI"
              help={ct('luthier_controls_automatic_dxvk_nvapi_setup')}
              value={config().compatibility.auto_dxvk_nvapi}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    auto_dxvk_nvapi: value
                  }
                }))
              }
            />

            <FeatureStateField
              label={ct('luthier_use_dedicated_gpu')}
              help={ct('luthier_exports_prime_render_offload_variables_to_try_using_the')}
              value={config().environment.prime_offload}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  environment: {
                    ...prev.environment,
                    prime_offload: value
                  }
                }))
              }
            />
          </section>
  )
}
