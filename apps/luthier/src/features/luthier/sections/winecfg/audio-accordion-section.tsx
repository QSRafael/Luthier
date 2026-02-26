import { For } from 'solid-js'
import { IconAlertCircle } from '@tabler/icons-solidjs'

import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMain, ItemTitle } from '../../../../components/ui/item'
import { Tabs, TabsList, TabsTrigger } from '../../../../components/ui/tabs'
import { AccordionSection } from '../../luthier-page-shared'
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
                  <Alert variant="warning">
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_audio_change_only_if_needed')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_forcing_an_audio_backend_can_fix_compatibility_but_may_w')}
                    </AlertDescription>
                  </Alert>

                  <Item>
                    <ItemMain>
                      <ItemContent>
                        <ItemTitle>{ct('creator_audio_driver')}</ItemTitle>
                        <ItemDescription>
                          {ct('creator_select_the_preferred_backend_runtime_default_keeps_wine')}
                        </ItemDescription>
                      </ItemContent>

                      <ItemActions class="md:self-end md:max-w-none">
                        <Tabs
                          value={audioDriverValue()}
                          onChange={(value) =>
                            patchConfig((prev) => ({
                              ...prev,
                              winecfg: {
                                ...prev.winecfg,
                                audio_driver: value === '__none__' ? null : (value as string)
                              }
                            }))
                          }
                          class="items-end"
                        >
                          <TabsList class="w-full justify-start md:w-auto">
                            <For each={audioDriverOptions()}>
                              {(option) => (
                                <TabsTrigger value={option.value} class="min-w-[84px]">
                                  {option.label}
                                </TabsTrigger>
                              )}
                            </For>
                          </TabsList>
                        </Tabs>
                      </ItemActions>
                    </ItemMain>

                  </Item>
                </div>
              </AccordionSection>
  )
}
