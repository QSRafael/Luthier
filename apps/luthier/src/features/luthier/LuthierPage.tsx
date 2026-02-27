import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { IconMenu2 } from '@tabler/icons-solidjs'
import { Toaster, toast } from 'solid-sonner'

import { invokeCommand } from '../../api/tauri'
import { FormControlsI18nProvider } from '../../components/form/FormControls'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { useTheme } from '../../components/theme-provider'
import { LuthierTab, FeatureState } from '../../models/config'
import { useLuthierController } from './useLuthierController'
import { AppSidebar } from './AppSidebar'
import { createLuthierPageDialogState } from './luthier-page-dialog-state'
import { createLuthierPageEffects } from './luthier-page-effects'
import {
  buildAncestorPathsFromExe,
  buildWxH,
  featureStateEnabled,
  ImportRegistryFileOutput,
  isLikelyAbsolutePath,
  isTauriLocalRuntime,
  ListChildDirectoriesOutput,
  ListDirectoryEntriesOutput,
  parseWxH,
  relativeInsideBase,
  tabLabel
} from './luthier-page-shared'
import { DependenciesTabSection } from './sections/dependencies-tab'
import { GameTabSection } from './sections/game-tab'
import { LaunchEnvironmentTabSection } from './sections/launch-environment-tab'
import { PerformanceTabSection } from './sections/performance-tab'
import { ReviewTabSection } from './sections/review-tab'
import { RuntimeTabSection } from './sections/runtime-tab'
import { WinecfgTabSection } from './sections/winecfg-tab'

export default function LuthierPage() {
  const controller = useLuthierController()

  const {
    locale,
    setLocale,
    activeTab,
    setActiveTab,
    tabs,
    gameRoot,
    setGameRoot,
    gameRootManualOverride,
    setGameRootManualOverride,
    gameRootRelativeDisplay,
    exeInsideGameRoot,
    exePath,
    setExePath,
    registryImportPath,
    setRegistryImportPath,
    iconPreviewPath,
    statusMessage,
    setStatusMessage,
    resultJson,
    winetricksAvailable,
    winetricksLoading,
    winetricksSource,
    winetricksSearch,
    setWinetricksSearch,
    winetricksCatalogError,
    config,
    patchConfig,
    configPreview,
    t,
    ct,
    ctf,
    runtimePreferenceOptions,
    audioDriverOptions,
    dllModeOptions,
    upscaleMethodOptions,
    windowTypeOptions,
    prefixPathPreview,
    environmentVarsAsList,
    audioDriverValue,
    gamescopeEnabled,
    normalizedWinetricksSearch,
    winetricksCandidates,
    payloadSummary,
    statusTone,
    splitCommaList,
    joinCommaList,
    replaceAt,
    removeAt,
    runTest,
    runCreate,
    loadWinetricksCatalog,
    pickExecutable,
    pickGameRootOverride,
    pickIntegrityFileRelative,
    pickRegistryFile,
    pickMountFolder,
    extractExecutableIcon,
    setGamescopeState,
    setGamemodeState,
    setMangohudState,
    updateCustomVars,
    addWinetricksVerb,
    removeWinetricksVerb,
    addWinetricksFromSearch
  } = controller

  const dialogState = createLuthierPageDialogState()
  const {
    registryDialogOpen,
    setRegistryDialogOpen,
    registryDraft,
    setRegistryDraft,
    registryImportWarningsOpen,
    setRegistryImportWarningsOpen,
    registryImportWarnings,
    setRegistryImportWarnings,
    gameRootChooserOpen,
    setGameRootChooserOpen,
    mountSourceBrowserOpen,
    setMountSourceBrowserOpen,
    mountBrowserPath,
    setMountBrowserPath,
    mountBrowserDirs,
    setMountBrowserDirs,
    mountBrowserLoading,
    setMountBrowserLoading,
    integrityFileBrowserOpen,
    setIntegrityFileBrowserOpen,
    integrityBrowserPath,
    setIntegrityBrowserPath,
    integrityBrowserDirs,
    setIntegrityBrowserDirs,
    integrityBrowserFiles,
    setIntegrityBrowserFiles,
    integrityBrowserLoading,
    setIntegrityBrowserLoading,
    integrityFileBrowserResolve,
    setIntegrityFileBrowserResolve,
    mountDialogOpen,
    setMountDialogOpen,
    mountDraft,
    setMountDraft,
    dllDialogOpen,
    setDllDialogOpen,
    dllDraft,
    setDllDraft,
    wrapperDialogOpen,
    setWrapperDialogOpen,
    wrapperDraft,
    setWrapperDraft,
    launchScriptsAccordionOpen,
    setLaunchScriptsAccordionOpen,
    extraDependencyDialogOpen,
    setExtraDependencyDialogOpen,
    extraDependencyDraft,
    setExtraDependencyDraft,
    wineDesktopFolderDialogOpen,
    setWineDesktopFolderDialogOpen,
    wineDesktopFolderDraft,
    setWineDesktopFolderDraft,
    wineDriveDialogOpen,
    setWineDriveDialogOpen,
    wineDriveDraft,
    setWineDriveDraft,
    winecfgAccordionOpen,
    setWinecfgAccordionOpen,
    lastStatusToastMessage,
    setLastStatusToastMessage,
    mobileSidebarOpen,
    setMobileSidebarOpen
  } = dialogState

  const {
    theme,
    setTheme,
    wineWindowsVersionOptions,
    wineDesktopFolderKeyOptions,
    wineDriveTypeOptions,
    allWineDriveLetters,
    availableWineDriveLetters,
    winecfgVirtualDesktopEnabled,
    winecfgVirtualDesktopResolution,
    setWinecfgVirtualDesktopResolutionPart,
    runtimeVersionFieldLabel,
    runtimeVersionFieldHelp,
    gamescopeAdditionalOptionsList,
    setGamescopeAdditionalOptionsList,
    gamescopeUsesMonitorResolution,
    wineWaylandEnabled,
    setGamescopeOutputWidth,
    setGamescopeOutputHeight,
    canCalculateHash,
    canChooseGameRoot,
    canPickIntegrityFromGameRoot,
    canAddMount,
    canBrowseMountFolders,
    canImportRegistryFromFile,
    importRegistryKeysFromRegFile,
    gameRootAncestorCandidates,
    openGameRootChooser,
    loadMountBrowserDirs,
    loadIntegrityBrowserEntries,
    resolveIntegrityFileBrowser,
    openIntegrityFileBrowser,
    openMountSourceBrowser,
    mountSourceBrowserSegments,
    mountSourceBrowserCurrentRelative,
    integrityFileBrowserSegments,
    integrityFileBrowserCurrentRelative,
    pickIntegrityFileRelativeWithBrowser,
    cycleLocale,
    cycleTheme,
    sidebarLocaleLabel,
    sidebarThemeLabel,
    formControlsI18n,
    tabIndex,
    canGoPrevTab,
    canGoNextTab,
    goPrevTab,
    goNextTab,
    handleSidebarTabChange
  } = createLuthierPageEffects(controller, dialogState)

  const sectionView = {
    ...controller,
    theme,
    setTheme,
    registryDialogOpen,
    setRegistryDialogOpen,
    registryDraft,
    setRegistryDraft,
    registryImportWarningsOpen,
    setRegistryImportWarningsOpen,
    registryImportWarnings,
    setRegistryImportWarnings,
    gameRootChooserOpen,
    setGameRootChooserOpen,
    mountSourceBrowserOpen,
    setMountSourceBrowserOpen,
    mountBrowserPath,
    setMountBrowserPath,
    mountBrowserDirs,
    setMountBrowserDirs,
    mountBrowserLoading,
    setMountBrowserLoading,
    integrityFileBrowserOpen,
    setIntegrityFileBrowserOpen,
    integrityBrowserPath,
    setIntegrityBrowserPath,
    integrityBrowserDirs,
    setIntegrityBrowserDirs,
    integrityBrowserFiles,
    setIntegrityBrowserFiles,
    integrityBrowserLoading,
    setIntegrityBrowserLoading,
    integrityFileBrowserResolve,
    setIntegrityFileBrowserResolve,
    mountDialogOpen,
    setMountDialogOpen,
    mountDraft,
    setMountDraft,
    dllDialogOpen,
    setDllDialogOpen,
    dllDraft,
    setDllDraft,
    wrapperDialogOpen,
    setWrapperDialogOpen,
    wrapperDraft,
    setWrapperDraft,
    launchScriptsAccordionOpen,
    setLaunchScriptsAccordionOpen,
    extraDependencyDialogOpen,
    setExtraDependencyDialogOpen,
    extraDependencyDraft,
    setExtraDependencyDraft,
    wineDesktopFolderDialogOpen,
    setWineDesktopFolderDialogOpen,
    wineDesktopFolderDraft,
    setWineDesktopFolderDraft,
    wineDriveDialogOpen,
    setWineDriveDialogOpen,
    wineDriveDraft,
    setWineDriveDraft,
    winecfgAccordionOpen,
    setWinecfgAccordionOpen,
    lastStatusToastMessage,
    setLastStatusToastMessage,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    wineWindowsVersionOptions,
    wineDesktopFolderKeyOptions,
    wineDriveTypeOptions,
    allWineDriveLetters,
    availableWineDriveLetters,
    winecfgVirtualDesktopEnabled,
    winecfgVirtualDesktopResolution,
    setWinecfgVirtualDesktopResolutionPart,
    runtimeVersionFieldLabel,
    runtimeVersionFieldHelp,
    gamescopeAdditionalOptionsList,
    setGamescopeAdditionalOptionsList,
    gamescopeUsesMonitorResolution,
    wineWaylandEnabled,
    setGamescopeOutputWidth,
    setGamescopeOutputHeight,
    canCalculateHash,
    canChooseGameRoot,
    canPickIntegrityFromGameRoot,
    canAddMount,
    canBrowseMountFolders,
    canImportRegistryFromFile,
    importRegistryKeysFromRegFile,
    pickIntegrityFileRelativeWithBrowser,
    gameRootAncestorCandidates,
    openGameRootChooser,
    loadMountBrowserDirs,
    openMountSourceBrowser,
    mountSourceBrowserSegments,
    mountSourceBrowserCurrentRelative,
    loadIntegrityBrowserEntries,
    openIntegrityFileBrowser,
    resolveIntegrityFileBrowser,
    integrityFileBrowserSegments,
    integrityFileBrowserCurrentRelative,
    cycleLocale,
    cycleTheme,
    sidebarLocaleLabel,
    sidebarThemeLabel,
    formControlsI18n,
    tabIndex,
    canGoPrevTab,
    canGoNextTab,
    goPrevTab,
    goNextTab,
    handleSidebarTabChange,
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
