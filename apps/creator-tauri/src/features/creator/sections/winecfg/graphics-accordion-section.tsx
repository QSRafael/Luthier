import { Show } from 'solid-js'
import { IconAlertCircle } from '@tabler/icons-solidjs'

import { WinecfgFeatureStateField } from '../../../../components/form/FormControls'
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { AccordionSection } from '../../creator-page-shared'
import type { WinecfgAccordionSectionProps } from './shared'

export function WinecfgGraphicsAccordionSection(props: WinecfgAccordionSectionProps) {
  const { config, patchConfig, ct, winecfgVirtualDesktopEnabled, winecfgVirtualDesktopResolution, setWinecfgVirtualDesktopResolutionPart } = props.view

  return (
              <AccordionSection
                open={props.open}
                onToggle={props.onToggle}
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
  )
}
