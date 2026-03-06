import { For } from 'solid-js'

import { Card, CardContent } from '../../../components/ui/card'
import { cn } from '../../../lib/cva'
import type { LuthierCopyKey } from '../copy'
import { START_ACTIONS, type StartActionId } from './start-actions'

type LuthierHomePageProps = {
  ct: (key: LuthierCopyKey) => string
  onActionSelected: (actionId: StartActionId) => void
}

export function LuthierHomePage(props: LuthierHomePageProps) {
  return (
    <div class="space-y-6">
      <div class="space-y-2 px-1 pt-1">
        <h1 class="text-2xl font-semibold tracking-tight">{props.ct('luthier_home_title')}</h1>
        <p class="max-w-3xl text-sm text-muted-foreground">{props.ct('luthier_home_subtitle')}</p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <For each={START_ACTIONS}>
          {(action) => {
            const isDisabled = action.disabled === true
            const disabledHint = isDisabled ? props.ct('luthier_coming_soon') : undefined
            return (
              <Card
                class={cn(
                  'group relative rounded-xl border border-border/70 bg-card p-0 shadow-sm transition-shadow hover:shadow-md',
                  isDisabled && 'opacity-65'
                )}
              >
                <CardContent class="p-6">
                  <button
                    type="button"
                    class="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    disabled={isDisabled}
                    title={disabledHint}
                    aria-label={props.ct(action.titleKey)}
                    onClick={() => props.onActionSelected(action.id)}
                  />

                  <div>
                    <span
                      class={cn(
                        action.iconBackgroundClass,
                        action.iconForegroundClass,
                        action.ringClass,
                        'inline-flex rounded-lg p-3 ring-2 ring-inset'
                      )}
                    >
                      <action.icon class="size-6" />
                    </span>
                  </div>

                  <div class="mt-4 space-y-2">
                    <h3 class="text-pretty text-base font-semibold text-foreground">
                      {props.ct(action.titleKey)}
                    </h3>
                    <p class="text-pretty text-sm text-muted-foreground">
                      {props.ct(action.descriptionKey)}
                    </p>
                    <div class="h-5 text-xs font-medium text-muted-foreground">
                      {isDisabled ? props.ct('luthier_coming_soon') : ''}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }}
        </For>
      </div>
    </div>
  )
}
