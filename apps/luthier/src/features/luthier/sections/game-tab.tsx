import { Show } from 'solid-js'
import type { LuthierPageSectionProps } from '../page-shared'
import { GameOverviewContent } from './game-overview-content'
import { GameFilesContent } from './game-files-content'

export function GameTabSection(props: LuthierPageSectionProps & { mode?: 'overview' | 'files' }) {
  const mode = props.mode ?? 'overview'

  return (
    <section class="stack">
      <Show when={mode === 'overview'}>
        <GameOverviewContent view={props.view} />
      </Show>

      <Show when={mode === 'files'}>
        <GameFilesContent view={props.view} />
      </Show>
    </section>
  )
}
