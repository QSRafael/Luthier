import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { IconMenu2 } from '@tabler/icons-solidjs'
import { Toaster, toast } from 'solid-sonner'

import { invokeCommand } from '../../api/tauri'
import { FormControlsI18nProvider } from '../../components/form/FormControls'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { useTheme } from '../../components/theme-provider'
import { CreatorTab, FeatureState } from '../../models/config'
import { useCreatorController } from './useCreatorController'
import { AppSidebar } from './AppSidebar'
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
} from './creator-page-shared'
import { DependenciesTabSection } from './sections/dependencies-tab'
import { GameTabSection } from './sections/game-tab'
import { LaunchEnvironmentTabSection } from './sections/launch-environment-tab'
import { PerformanceTabSection } from './sections/performance-tab'
import { ReviewTabSection } from './sections/review-tab'
import { RuntimeTabSection } from './sections/runtime-tab'
import { WinecfgTabSection } from './sections/winecfg-tab'

export default function CreatorPage() {
  const controller = useCreatorController()
  const { theme, setTheme } = useTheme()

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

  const [registryDialogOpen, setRegistryDialogOpen] = createSignal(false)
  const [registryDraft, setRegistryDraft] = createSignal({
    path: '',
    name: '',
    value_type: 'REG_SZ',
    value: ''
  })
  const [registryImportWarningsOpen, setRegistryImportWarningsOpen] = createSignal(false)
  const [registryImportWarnings, setRegistryImportWarnings] = createSignal<string[]>([])
  const [gameRootChooserOpen, setGameRootChooserOpen] = createSignal(false)
  const [mountSourceBrowserOpen, setMountSourceBrowserOpen] = createSignal(false)
  const [mountBrowserPath, setMountBrowserPath] = createSignal('')
  const [mountBrowserDirs, setMountBrowserDirs] = createSignal<string[]>([])
  const [mountBrowserLoading, setMountBrowserLoading] = createSignal(false)
  const [integrityFileBrowserOpen, setIntegrityFileBrowserOpen] = createSignal(false)
  const [integrityBrowserPath, setIntegrityBrowserPath] = createSignal('')
  const [integrityBrowserDirs, setIntegrityBrowserDirs] = createSignal<string[]>([])
  const [integrityBrowserFiles, setIntegrityBrowserFiles] = createSignal<string[]>([])
  const [integrityBrowserLoading, setIntegrityBrowserLoading] = createSignal(false)
  const [integrityFileBrowserResolve, setIntegrityFileBrowserResolve] =
    createSignal<((value: string | null) => void) | null>(null)

  const [mountDialogOpen, setMountDialogOpen] = createSignal(false)
  const [mountDraft, setMountDraft] = createSignal({
    source_relative_path: '',
    target_windows_path: '',
    create_source_if_missing: true
  })

  const [dllDialogOpen, setDllDialogOpen] = createSignal(false)
  const [dllDraft, setDllDraft] = createSignal({
    dll: '',
    mode: 'builtin'
  })

  const [wrapperDialogOpen, setWrapperDialogOpen] = createSignal(false)
  const [wrapperDraft, setWrapperDraft] = createSignal({
    state: 'OptionalOff' as FeatureState,
    executable: '',
    args: ''
  })
  const [launchScriptsAccordionOpen, setLaunchScriptsAccordionOpen] = createSignal(false)

  const [extraDependencyDialogOpen, setExtraDependencyDialogOpen] = createSignal(false)
  const [extraDependencyDraft, setExtraDependencyDraft] = createSignal({
    name: '',
    command: '',
    env_vars: '',
    paths: ''
  })
  const [wineDesktopFolderDialogOpen, setWineDesktopFolderDialogOpen] = createSignal(false)
  const [wineDesktopFolderDraft, setWineDesktopFolderDraft] = createSignal({
    folder_key: 'desktop',
    shortcut_name: '',
    linux_path: ''
  })
  const [wineDriveDialogOpen, setWineDriveDialogOpen] = createSignal(false)
  const [wineDriveDraft, setWineDriveDraft] = createSignal({
    letter: 'D',
    host_path: '',
    drive_type: 'auto',
    label: '',
    serial: ''
  })
  const [winecfgAccordionOpen, setWinecfgAccordionOpen] = createSignal<
    'graphics' | 'desktop' | 'drives' | 'audio' | null
  >(null)
  const [lastStatusToastMessage, setLastStatusToastMessage] = createSignal('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = createSignal(false)

  const wineWindowsVersionOptions = [
    { value: '__default__', label: ct('creator_runtime_default_do_not_override') },
    { value: 'win11', label: 'Windows 11' },
    { value: 'win10', label: 'Windows 10' },
    { value: 'win81', label: 'Windows 8.1' },
    { value: 'win8', label: 'Windows 8' },
    { value: 'win7', label: 'Windows 7' },
    { value: 'vista', label: 'Windows Vista' },
    { value: 'winxp', label: 'Windows XP' }
  ] as const

  const wineDesktopFolderKeyOptions = [
    { value: 'desktop', label: ct('creator_desktop') },
    { value: 'documents', label: ct('creator_documents') },
    { value: 'downloads', label: ct('creator_downloads') },
    { value: 'music', label: ct('creator_music') },
    { value: 'pictures', label: ct('creator_pictures') },
    { value: 'videos', label: ct('creator_videos') }
  ] as const

  const wineDriveTypeOptions = [
    { value: 'auto', label: ct('creator_auto_detect') },
    { value: 'local_disk', label: ct('creator_local_hard_disk') },
    { value: 'network_share', label: ct('creator_network_share') },
    { value: 'floppy', label: ct('creator_floppy_disk') },
    { value: 'cdrom', label: ct('creator_cd_rom') }
  ] as const

  const allWineDriveLetters = 'DEFGHIJKLMNOPQRSTUVWXY'.split('')
  const availableWineDriveLetters = createMemo(() => {
    const used = new Set(
      config()
        .winecfg.drives.map((item) => item.letter.trim().toUpperCase())
        .filter(Boolean)
    )
    return allWineDriveLetters.filter((letter) => !used.has(letter))
  })

  const winecfgVirtualDesktopEnabled = createMemo(() =>
    featureStateEnabled(config().winecfg.virtual_desktop.state.state)
  )

  const winecfgVirtualDesktopResolution = createMemo(() =>
    parseWxH(config().winecfg.virtual_desktop.resolution)
  )

  const setWinecfgVirtualDesktopResolutionPart = (part: 'width' | 'height', value: string) => {
    patchConfig((prev) => {
      const current = parseWxH(prev.winecfg.virtual_desktop.resolution)
      const next = {
        width: part === 'width' ? value : current.width,
        height: part === 'height' ? value : current.height
      }

      return {
        ...prev,
        winecfg: {
          ...prev.winecfg,
          virtual_desktop: {
            ...prev.winecfg.virtual_desktop,
            resolution: buildWxH(next.width, next.height)
          }
        }
      }
    })
  }

  const runtimeVersionFieldLabel = () => {
    const preference = config().runner.runtime_preference
    if (preference === 'Proton') return ct('creator_proton_version')
    if (preference === 'Wine') return ct('creator_wine_version')
    return ct('creator_preferred_runtime_version')
  }

  const runtimeVersionFieldHelp = () => {
    const preference = config().runner.runtime_preference
    if (preference === 'Proton') {
      return ct('creator_target_proton_version_used_by_the_orchestrator_when_pref')
    }
    if (preference === 'Wine') {
      return ct('creator_expected_wine_version_identifier_when_preference_is_wine')
    }
    return ct('creator_preferred_runtime_version_when_auto_mode_picks_proton_wi')
  }

  const gamescopeAdditionalOptionsList = createMemo(() => {
    const raw = config().environment.gamescope.additional_options.trim()
    if (!raw) return [] as string[]
    if (raw.includes('\n')) {
      return raw
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    }
    return [raw]
  })

  const setGamescopeAdditionalOptionsList = (items: string[]) => {
    patchConfig((prev) => ({
      ...prev,
      environment: {
        ...prev.environment,
        gamescope: {
          ...prev.environment.gamescope,
          additional_options: items.join(' ').trim()
        }
      }
    }))
  }

  const gamescopeUsesMonitorResolution = createMemo(
    () =>
      !config().environment.gamescope.output_width.trim() &&
      !config().environment.gamescope.output_height.trim()
  )

  const wineWaylandEnabled = createMemo(() => {
    const state = config().compatibility.wine_wayland
    return state === 'MandatoryOn' || state === 'OptionalOn'
  })

  const setGamescopeOutputWidth = (value: string) => {
    patchConfig((prev) => {
      const nextHeight = prev.environment.gamescope.output_height
      return {
        ...prev,
        environment: {
          ...prev.environment,
          gamescope: {
            ...prev.environment.gamescope,
            output_width: value,
            resolution: value && nextHeight ? `${value}x${nextHeight}` : null
          }
        }
      }
    })
  }

  const setGamescopeOutputHeight = (value: string) => {
    patchConfig((prev) => {
      const nextWidth = prev.environment.gamescope.output_width
      return {
        ...prev,
        environment: {
          ...prev.environment,
          gamescope: {
            ...prev.environment.gamescope,
            output_height: value,
            resolution: nextWidth && value ? `${nextWidth}x${value}` : null
          }
        }
      }
    })
  }

  const canCalculateHash = createMemo(() => isTauriLocalRuntime() && isLikelyAbsolutePath(exePath()))
  const canChooseGameRoot = createMemo(() => exePath().trim().length > 0)
  const canPickIntegrityFromGameRoot = createMemo(() => isLikelyAbsolutePath(gameRoot().trim()))
  const canAddMount = createMemo(() => gameRoot().trim().length > 0)
  const canBrowseMountFolders = createMemo(() => isTauriLocalRuntime() && isLikelyAbsolutePath(gameRoot().trim()))
  const canImportRegistryFromFile = createMemo(() => isTauriLocalRuntime())

  const importRegistryKeysFromRegFile = async () => {
    try {
      const selected = await pickRegistryFile()
      if (!selected) return

      if (!isLikelyAbsolutePath(selected)) {
        setStatusMessage(
          ct('creator_importing_reg_requires_an_absolute_path_in_browser_lan_m')
        )
        return
      }

      const result = await invokeCommand<ImportRegistryFileOutput>('cmd_import_registry_file', {
        path: selected
      })

      const existingKeys = new Set(
        config().registry_keys.map((item) =>
          [item.path, item.name, item.value_type, item.value].join('\u0000')
        )
      )

      const deduped = result.entries.filter((item) => {
        const signature = [item.path, item.name, item.value_type, item.value].join('\u0000')
        if (existingKeys.has(signature)) return false
        existingKeys.add(signature)
        return true
      })

      if (deduped.length > 0) {
        patchConfig((prev) => ({
          ...prev,
          registry_keys: [...prev.registry_keys, ...deduped]
        }))
      }

      const warningSuffix =
        result.warnings.length > 0
          ? ctf('creator_registry_import_warning_suffix_count', { count: result.warnings.length })
          : ''

      const successMessage = ctf('creator_imported_registry_keys_from_reg_file', {
        count: deduped.length,
        warningSuffix
      })

      if (deduped.length > 0) {
        const importedSignatures = new Set(
          deduped.map((item) => [item.path, item.name, item.value_type, item.value].join('\u0000'))
        )
        toast.success(successMessage, {
          description: selected,
          action: {
            label: ct('creator_undo'),
            onClick: () => {
              patchConfig((prev) => ({
                ...prev,
                registry_keys: prev.registry_keys.filter((item) => {
                  const signature = [item.path, item.name, item.value_type, item.value].join('\u0000')
                  return !importedSignatures.has(signature)
                })
              }))
              toast.info(ct('creator_registry_import_undone'))
            }
          }
        })
      } else {
        toast.info(successMessage, { description: selected })
      }

      setRegistryImportWarnings(result.warnings)
      setRegistryImportWarningsOpen(result.warnings.length > 0)
    } catch (error) {
      setStatusMessage(ctf('creator_failed_to_import_reg_file_error', { error: String(error) }))
    }
  }

  const gameRootAncestorCandidates = createMemo(() => buildAncestorPathsFromExe(exePath()))

  const openGameRootChooser = () => {
    if (!isLikelyAbsolutePath(exePath())) {
      void pickGameRootOverride()
      return
    }
    setGameRootChooserOpen(true)
  }

  const loadMountBrowserDirs = async (absolutePath: string) => {
    if (!isLikelyAbsolutePath(absolutePath)) {
      setStatusMessage(
        ct('creator_mounted_folder_browser_requires_an_absolute_game_root_pa')
      )
      return
    }
    setMountBrowserLoading(true)
    try {
      const result = await invokeCommand<ListChildDirectoriesOutput>('cmd_list_child_directories', {
        path: absolutePath
      })
      setMountBrowserPath(result.path)
      setMountBrowserDirs(result.directories)
    } catch (error) {
      setStatusMessage(ctf('creator_failed_to_list_folders_error', { error: String(error) }))
    } finally {
      setMountBrowserLoading(false)
    }
  }

  const loadIntegrityBrowserEntries = async (absolutePath: string) => {
    if (!isLikelyAbsolutePath(absolutePath)) {
      setStatusMessage(
        ct('creator_required_file_browser_requires_an_absolute_game_root_pat')
      )
      return
    }
    setIntegrityBrowserLoading(true)
    try {
      const result = await invokeCommand<ListDirectoryEntriesOutput>('cmd_list_directory_entries', {
        path: absolutePath
      })
      setIntegrityBrowserPath(result.path)
      setIntegrityBrowserDirs(result.directories)
      setIntegrityBrowserFiles(result.files)
    } catch (error) {
      setStatusMessage(ctf('creator_failed_to_list_files_error', { error: String(error) }))
    } finally {
      setIntegrityBrowserLoading(false)
    }
  }

  const resolveIntegrityFileBrowser = (value: string | null) => {
    const resolver = integrityFileBrowserResolve()
    setIntegrityFileBrowserResolve(null)
    if (resolver) resolver(value)
  }

  const openIntegrityFileBrowser = async () => {
    const root = gameRoot().trim()
    if (!root) {
      setStatusMessage(ct('creator_select_an_executable_first_to_define_the_game_folder'))
      return null
    }
    if (!isLikelyAbsolutePath(root)) {
      setStatusMessage(
        ct('creator_in_browser_lan_mode_the_mini_file_browser_cannot_access_')
      )
      return null
    }

    await loadIntegrityBrowserEntries(root)
    setIntegrityFileBrowserOpen(true)

    return new Promise<string | null>((resolve) => {
      setIntegrityFileBrowserResolve(() => resolve)
    })
  }

  const openMountSourceBrowser = async () => {
    const root = gameRoot().trim()
    if (!root) {
      setStatusMessage(ct('creator_select_an_executable_first_to_define_the_game_folder'))
      return
    }
    if (!isLikelyAbsolutePath(root)) {
      setStatusMessage(
        ct('creator_in_browser_lan_mode_the_mini_folder_browser_cannot_acces')
      )
      return
    }
    await loadMountBrowserDirs(root)
    setMountSourceBrowserOpen(true)
  }

  const mountSourceBrowserSegments = createMemo(() => {
    const root = gameRoot().trim()
    const current = mountBrowserPath().trim()
    const relative = root && current ? relativeInsideBase(root, current) : null
    if (!relative || relative === '.') return [] as Array<{ label: string; path: string }>

    let acc = root
    return relative
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        acc = `${acc.replace(/\/+$/, '')}/${segment}`
        return { label: segment, path: acc }
      })
  })

  const mountSourceBrowserCurrentRelative = createMemo(() => {
    const relative = relativeInsideBase(gameRoot().trim(), mountBrowserPath().trim())
    return relative ?? ''
  })

  const integrityFileBrowserSegments = createMemo(() => {
    const root = gameRoot().trim()
    const current = integrityBrowserPath().trim()
    const relative = root && current ? relativeInsideBase(root, current) : null
    if (!relative || relative === '.') return [] as Array<{ label: string; path: string }>

    let acc = root
    return relative
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        acc = `${acc.replace(/\/+$/, '')}/${segment}`
        return { label: segment, path: acc }
      })
  })

  const integrityFileBrowserCurrentRelative = createMemo(() => {
    const relative = relativeInsideBase(gameRoot().trim(), integrityBrowserPath().trim())
    return relative ?? ''
  })

  const pickIntegrityFileRelativeWithBrowser = async () => {
    if (isTauriLocalRuntime() && isLikelyAbsolutePath(gameRoot().trim())) {
      return await openIntegrityFileBrowser()
    }
    return await pickIntegrityFileRelative()
  }

  const cycleLocale = () => {
    setLocale(locale() === 'pt-BR' ? 'en-US' : 'pt-BR')
  }

  const cycleTheme = () => {
    const current = theme()
    if (current === 'dark') {
      setTheme('light')
      return
    }
    if (current === 'light') {
      setTheme('system')
      return
    }
    setTheme('dark')
  }

  const sidebarLocaleLabel = createMemo(() => `${ct('creator_language')}: ${locale()}`)

  const sidebarThemeLabel = createMemo(() => {
    const current = theme()
    const label =
      current === 'dark'
        ? ct('creator_dark')
        : current === 'light'
          ? ct('creator_light')
          : ct('creator_system')
    return `${ct('creator_theme')}: ${label}`
  })

  const formControlsI18n = createMemo(() => ({
    enabled: ct('creator_label_enabled'),
    disabled: ct('creator_label_disabled'),
    mandatory: ct('creator_label_mandatory'),
    wineDefault: ct('creator_use_wine_default'),
    actions: ct('creator_label_actions'),
    action: ct('creator_label_action'),
    add: ct('creator_label_add'),
    addItem: ct('creator_add_item'),
    addListDialogDescription: ct('creator_enter_a_value_and_confirm_to_add_it_to_the_list'),
    addKeyValueDialogDescription: ct('creator_fill_in_key_and_value_to_add_a_new_row'),
    pickFile: ct('creator_choose_file'),
    pickFileHint: ct('creator_select_a_file_to_fill_this_field_automatically'),
    cancel: ct('creator_label_cancel'),
    confirm: ct('creator_label_confirm'),
    remove: ct('creator_label_remove'),
    noItemAdded: ct('creator_no_item_added'),
    keyPlaceholder: ct('creator_key'),
    valuePlaceholder: ct('creator_value')
  }))

  const tabIndex = createMemo(() => tabs.indexOf(activeTab()))
  const canGoPrevTab = createMemo(() => tabIndex() > 0)
  const canGoNextTab = createMemo(() => tabIndex() >= 0 && tabIndex() < tabs.length - 1)

  const goPrevTab = () => {
    const index = tabIndex()
    if (index <= 0) return
    setActiveTab(tabs[index - 1])
  }

  const goNextTab = () => {
    const index = tabIndex()
    if (index < 0 || index >= tabs.length - 1) return
    setActiveTab(tabs[index + 1])
  }

  const handleSidebarTabChange = (tab: CreatorTab) => {
    setActiveTab(tab)
    setMobileSidebarOpen(false)
  }

  createEffect(() => {
    const message = statusMessage().trim()
    if (!message) return
    if (message === lastStatusToastMessage()) return
    setLastStatusToastMessage(message)

    const readyPt = 'Pronto.'
    const readyEn = 'Ready.'
    if (message === readyPt || message === readyEn) return

    if (statusTone() === 'error') {
      toast.error(message)
      return
    }
    if (statusTone() === 'success') {
      toast.success(message)
      return
    }
    toast.info(message)
  })

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
    <div class="creator-page">
      <div class="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div class="hidden h-fit lg:sticky lg:top-4 lg:block">
          <AppSidebar
            appName="Game Orchestrator"
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
              appName="Game Orchestrator"
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
              aria-label={ct('creator_open_menu')}
              title={ct('creator_open_menu')}
            >
              <IconMenu2 class="size-4" />
            </Button>
            <div class="min-w-0 px-12 text-center lg:px-0">
              <p class="truncate text-sm font-semibold">{tabLabel(activeTab(), controller)}</p>
              <p class="text-xs text-muted-foreground">
                {ct('creator_step')} {Math.max(tabIndex(), 0) + 1}/{tabs.length}
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

        <Show when={activeTab() === 'wrappers' || activeTab() === 'scripts'}>
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
                {ct('creator_back')}
              </Button>
            </Show>
          </div>
          <div class="flex justify-end">
            <Show when={canGoNextTab()}>
              <Button type="button" class="h-10" onClick={goNextTab}>
                {ct('creator_next')}
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
