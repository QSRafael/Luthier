import { For } from 'solid-js'
import { IconAlertCircle } from '@tabler/icons-solidjs'

import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemMain, ItemTitle } from '../../../../components/ui/item'
import { Select } from '../../../../components/ui/select'
import { AccordionSection } from '../../creator-page-shared'
import type { WinecfgAccordionSectionProps } from './shared'

export function WinecfgAudioAccordionSection(props: WinecfgAccordionSectionProps) {
  const { config, patchConfig, ct, audioDriverOptions, audioDriverValue } = props.view

  return (
              <AccordionSection
                open={props.open}
                onToggle={props.onToggle}
                title={ct('creator_audio')}
                description={ct('creator_additional_audio_settings_from_winecfg_runtime_defaults')}
              >
                <div class="grid gap-3">
                  <Item>
                    <ItemMain>
                      <ItemContent>
                        <ItemTitle>{ct('creator_audio_driver')}</ItemTitle>
                        <ItemDescription>
                          {ct('creator_select_the_preferred_backend_runtime_default_keeps_wine')}
                        </ItemDescription>
                      </ItemContent>

                      <ItemActions class="md:self-end md:max-w-sm">
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
                      </ItemActions>
                    </ItemMain>

                    <ItemFooter>
                      <Alert variant="warning">
                        <IconAlertCircle />
                        <AlertTitle>{ct('creator_audio_change_only_if_needed')}</AlertTitle>
                        <AlertDescription>
                          {ct('creator_forcing_an_audio_backend_can_fix_compatibility_but_may_w')}
                        </AlertDescription>
                      </Alert>
                    </ItemFooter>
                  </Item>
                </div>
              </AccordionSection>
  )
}
