import { createSignal } from 'solid-js'
import { IconMenu2 } from '@tabler/icons-solidjs'

import { Button } from '../../../components/ui/button'
import { Card, CardContent } from '../../../components/ui/card'
import type { LuthierTab } from '../../../models/config'
import { AppSidebar } from '../AppSidebar'
import type { LuthierCopyKey } from '../copy'
import { LuthierHomePage } from './LuthierHomePage'
import type { StartActionId } from './start-actions'

type LuthierHomeRouteProps = {
  ct: (key: LuthierCopyKey) => string
  appName: string
  localeLabel: string
  themeLabel: string
  onCycleLocale: () => void
  onCycleTheme: () => void
  onActionSelected: (actionId: StartActionId) => void
  onOpenCreatorTab: (tab: LuthierTab) => void
}

export function LuthierHomeRoute(props: LuthierHomeRouteProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = createSignal(false)

  const tabLabel = (tab: LuthierTab): string => {
    if (tab === 'game') return props.ct('luthier_label_game')
    if (tab === 'gameFiles') return props.ct('luthier_label_game_files_and_launch')
    if (tab === 'runtime') return props.ct('luthier_label_runtime')
    if (tab === 'performance') return props.ct('luthier_enhancements')
    if (tab === 'prefix') return props.ct('luthier_dependencies')
    if (tab === 'winecfg') return 'Winecfg'
    if (tab === 'wrappers') return props.ct('luthier_launch_and_environment')
    return props.ct('luthier_review_and_generate')
  }

  return (
    <div class="luthier-page">
      <div class="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div class="hidden h-fit lg:sticky lg:top-4 lg:block">
          <AppSidebar
            appName={props.appName}
            activeTab="game"
            onTabChange={props.onOpenCreatorTab}
            tabLabel={tabLabel}
            localeLabel={props.localeLabel}
            themeLabel={props.themeLabel}
            onCycleLocale={props.onCycleLocale}
            onCycleTheme={props.onCycleTheme}
            onNavigateHome={() => {
              // Home route already active.
            }}
            homeLabel={props.ct('luthier_home_label')}
            isHomeRoute
          />
        </div>

        {mobileSidebarOpen() ? (
          <>
            <div
              class="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div class="fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] p-3 lg:hidden">
              <AppSidebar
                class="h-full min-h-0 max-w-none"
                appName={props.appName}
                activeTab="game"
                onTabChange={(tab) => {
                  props.onOpenCreatorTab(tab)
                  setMobileSidebarOpen(false)
                }}
                tabLabel={tabLabel}
                localeLabel={props.localeLabel}
                themeLabel={props.themeLabel}
                onCycleLocale={props.onCycleLocale}
                onCycleTheme={props.onCycleTheme}
                onNavigateHome={() => {
                  // Home route already active.
                }}
                homeLabel={props.ct('luthier_home_label')}
                isHomeRoute
              />
            </div>
          </>
        ) : null}

        <Card class="flex min-h-[calc(100vh-2rem)] flex-col">
          <CardContent class="flex flex-1 flex-col pt-5">
            <div class="relative mb-4 flex min-h-10 items-center justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="absolute left-0 h-10 w-10 lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label={props.ct('luthier_open_menu')}
                title={props.ct('luthier_open_menu')}
              >
                <IconMenu2 class="size-4" />
              </Button>
              <div class="min-w-0 px-12 text-center lg:px-0">
                <p class="truncate text-sm font-semibold">{props.ct('luthier_home_title')}</p>
                <p class="text-xs text-muted-foreground">{props.ct('luthier_home_subtitle')}</p>
              </div>
            </div>

            <LuthierHomePage ct={props.ct} onActionSelected={props.onActionSelected} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
