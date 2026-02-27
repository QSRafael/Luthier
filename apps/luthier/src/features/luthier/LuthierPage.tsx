import { Show } from 'solid-js'
import { IconMenu2 } from '@tabler/icons-solidjs'
import { Toaster } from 'solid-sonner'

import { FormControlsI18nProvider } from '../../components/form/FormControls'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { useLuthierController } from './useLuthierController'
import { AppSidebar } from './AppSidebar'
import { createLuthierPageDialogState } from './page-dialog-state'
import { createLuthierPageEffects } from './page-effects'
import { tabLabel } from './page-shared'
import { LuthierDialogs } from './LuthierDialogs'
import { DependenciesTabSection } from './sections/dependencies-tab'
import { GameTabSection } from './sections/game-tab'
import { LaunchEnvironmentTabSection } from './sections/launch-environment-tab'
import { PerformanceTabSection } from './sections/performance-tab'
import { ReviewTabSection } from './sections/review-tab'
import { RuntimeTabSection } from './sections/runtime-tab'
import { WinecfgTabSection } from './sections/winecfg-tab'

export default function LuthierPage() {
  const controller = useLuthierController()
  const dialogState = createLuthierPageDialogState()
  const effects = createLuthierPageEffects(controller, dialogState)

  const {
    activeTab,
    tabs,
    ct,
  } = controller

  const {
    setMobileSidebarOpen,
    mobileSidebarOpen,
  } = dialogState

  const {
    theme,
    formControlsI18n,
    tabIndex,
    canGoPrevTab,
    canGoNextTab,
    goPrevTab,
    goNextTab,
    handleSidebarTabChange,
    cycleLocale,
    cycleTheme,
    sidebarLocaleLabel,
    sidebarThemeLabel,
  } = effects

  const sectionView = {
    ...controller,
    ...dialogState,
    ...effects,
  }

  return (
    <FormControlsI18nProvider value={formControlsI18n()}>
      <div class="luthier-page">
        <div class="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div class="hidden h-fit lg:sticky lg:top-4 lg:block">
            <AppSidebar
              appName="Luthier"
              activeTab={activeTab()}
              onTabChange={handleSidebarTabChange}
              tabLabel={(tab) => tabLabel(tab, controller)}
              localeLabel={sidebarLocaleLabel()}
              themeLabel={sidebarThemeLabel()}
              onCycleLocale={cycleLocale}
              onCycleTheme={cycleTheme}
            />
          </div>

          <Show when={mobileSidebarOpen()}>
            <div
              class="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div class="fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] p-3 lg:hidden">
              <AppSidebar
                class="h-full min-h-0 max-w-none"
                appName="Luthier"
                activeTab={activeTab()}
                onTabChange={handleSidebarTabChange}
                tabLabel={(tab) => tabLabel(tab, controller)}
                localeLabel={sidebarLocaleLabel()}
                themeLabel={sidebarThemeLabel()}
                onCycleLocale={cycleLocale}
                onCycleTheme={cycleTheme}
              />
            </div>
          </Show>

          <Card class="flex min-h-[calc(100vh-2rem)] flex-col">
            <CardContent class="flex flex-1 flex-col pt-5">
              <div class="relative mb-4 flex min-h-10 items-center justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  class="absolute left-0 h-10 w-10 lg:hidden"
                  onClick={() => setMobileSidebarOpen(true)}
                  aria-label={ct('luthier_open_menu')}
                  title={ct('luthier_open_menu')}
                >
                  <IconMenu2 class="size-4" />
                </Button>
                <div class="min-w-0 px-12 text-center lg:px-0">
                  <p class="truncate text-sm font-semibold">{tabLabel(activeTab(), controller)}</p>
                  <p class="text-xs text-muted-foreground">
                    {ct('luthier_step')} {Math.max(tabIndex(), 0) + 1}/{tabs.length}
                  </p>
                </div>
              </div>
              <div class="flex-1">
                <Show when={activeTab() === 'game'}>
                  <GameTabSection view={sectionView} mode="overview" />
                </Show>

                <Show when={activeTab() === 'gameFiles'}>
                  <GameTabSection view={sectionView} mode="files" />
                </Show>

                <Show when={activeTab() === 'runtime'}>
                  <RuntimeTabSection view={sectionView} />
                </Show>

                <Show when={activeTab() === 'performance'}>
                  <PerformanceTabSection view={sectionView} />
                </Show>

                <Show when={activeTab() === 'prefix'}>
                  <DependenciesTabSection view={sectionView} />
                </Show>

                <Show when={activeTab() === 'winecfg'}>
                  <WinecfgTabSection view={sectionView} />
                </Show>

                <Show when={activeTab() === 'wrappers'}>
                  <LaunchEnvironmentTabSection view={sectionView} />
                </Show>

                <Show when={activeTab() === 'review'}>
                  <ReviewTabSection view={sectionView} />
                </Show>

              </div>

              <div class="mt-auto grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
                <div class="flex justify-start">
                  <Show when={canGoPrevTab()}>
                    <Button type="button" variant="outline" class="h-10" onClick={goPrevTab}>
                      {ct('luthier_back')}
                    </Button>
                  </Show>
                </div>
                <div class="flex justify-end">
                  <Show when={canGoNextTab()}>
                    <Button type="button" class="h-10" onClick={goNextTab}>
                      {ct('luthier_next')}
                    </Button>
                  </Show>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <LuthierDialogs view={sectionView} />

        <Toaster
          position="bottom-center"
          theme={theme()}
          richColors
          closeButton
          visibleToasts={5}
        />
      </div>
    </FormControlsI18nProvider>
  )
}
