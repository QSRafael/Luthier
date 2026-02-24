import { For } from 'solid-js'
import { IconAlertCircle } from '@tabler/icons-solidjs'

import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Select } from '../../../../components/ui/select'
import { AccordionSection } from '../../creator-page-shared'
import type { WinecfgAccordionSectionProps } from './shared'

export function WinecfgAudioAccordionSection(props: WinecfgAccordionSectionProps) {
  const { config, patchConfig, ct, audioDriverOptions, audioDriverValue } = props.view as any

  return (
              <AccordionSection
                open={props.open}
                onToggle={props.onToggle}
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
  )
}
