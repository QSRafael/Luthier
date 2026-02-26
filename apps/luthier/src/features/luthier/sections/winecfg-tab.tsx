import { IconAlertCircle } from '@tabler/icons-solidjs'

import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import type { LuthierPageSectionProps } from '../luthier-page-shared'
import { WinecfgAudioAccordionSection } from './winecfg/audio-accordion-section'
import { WinecfgDesktopAccordionSection } from './winecfg/desktop-accordion-section'
import { WinecfgDllOverridesItem } from './winecfg/dll-overrides-item'
import { WinecfgDrivesAccordionSection } from './winecfg/drives-accordion-section'
import { WinecfgGraphicsAccordionSection } from './winecfg/graphics-accordion-section'
import { WinecfgWindowsVersionItem } from './winecfg/windows-version-item'

export function WinecfgTabSection(props: LuthierPageSectionProps) {
  const { ct, winecfgAccordionOpen, setWinecfgAccordionOpen } = props.view

  return (
    <section class="stack">
      <Alert variant="warning">
        <IconAlertCircle />
        <AlertTitle>{ct('luthier_winecfg_overrides_do_not_replace_everything')}</AlertTitle>
        <AlertDescription>
          {ct('luthier_settings_in_this_tab_are_additive_overrides_on_top_of_wi')}
        </AlertDescription>
      </Alert>

      <WinecfgDllOverridesItem view={props.view} />
      <WinecfgWindowsVersionItem view={props.view} />

      <div class="grid gap-3">
        <WinecfgGraphicsAccordionSection
          view={props.view}
          open={winecfgAccordionOpen() === 'graphics'}
          onToggle={() => setWinecfgAccordionOpen((prev: string | null) => (prev === 'graphics' ? null : 'graphics'))}
        />
        <WinecfgDesktopAccordionSection
          view={props.view}
          open={winecfgAccordionOpen() === 'desktop'}
          onToggle={() => setWinecfgAccordionOpen((prev: string | null) => (prev === 'desktop' ? null : 'desktop'))}
        />
        <WinecfgDrivesAccordionSection
          view={props.view}
          open={winecfgAccordionOpen() === 'drives'}
          onToggle={() => setWinecfgAccordionOpen((prev: string | null) => (prev === 'drives' ? null : 'drives'))}
        />
        <WinecfgAudioAccordionSection
          view={props.view}
          open={winecfgAccordionOpen() === 'audio'}
          onToggle={() => setWinecfgAccordionOpen((prev: string | null) => (prev === 'audio' ? null : 'audio'))}
        />
      </div>
    </section>
  )
}
