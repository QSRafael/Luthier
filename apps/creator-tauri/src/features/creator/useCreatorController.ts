import { createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'

import { invokeCommand, pickFile, pickFolder } from '../../api/tauri'
import type { SelectOption } from '../../components/form/FormControls'
import { detectLocale, Locale, translate } from '../../i18n'
import { creatorFormat, creatorTranslate, type CreatorCopyKey } from './creator-copy'
import {
  AUDIO_DRIVERS,
  basename,
  DLL_MODES,
  dirname,
  formatRelativeDirDisplay,
  hasWindowsLauncherExtension,
  isFeatureEnabled,
  isLikelyAbsolutePath,
  joinCommaList,
  ORCHESTRATOR_BASE_PATH,
  prefixHashKey,
  relativeFromRoot,
  relativePathBetween,
  removeAt,
  replaceAt,
  RUNTIME_CANDIDATES,
  RUNTIME_PREFERENCES,
  splitCommaList,
  stripLauncherExtension,
  UPSCALE_METHODS,
  WINDOW_TYPES,
  type AudioDriverOption,
  type GamescopeWindowType,
  type UpscaleMethod
} from './creator-controller-utils'
import {
  CreatorTab,
  defaultGameConfig,
  FeatureState,
  GameConfig,
  RuntimePreference,
  RuntimePrimary
} from '../../models/config'

type WinetricksAvailableOutput = {
  source: string
  components: string[]
}

type ExtractExecutableIconOutput = {
  data_url: string
  width: number
  height: number
}

type SearchHeroImageOutput = {
  source: string
  image_url: string
  game_id?: number | null
  candidate_image_urls?: string[]
}

type PrepareHeroImageOutput = {
  source_url: string
  data_url: string
  width: number
  height: number
  original_width: number
  original_height: number
}

type StatusTone = 'info' | 'success' | 'error'

const dedupeUrls = (values: string[]) => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

export function useCreatorController() {
  const initialLocale = detectLocale()
  const [locale, setLocale] = createSignal<Locale>(initialLocale)
  const [activeTab, setActiveTab] = createSignal<CreatorTab>('game')

  const [outputPath, setOutputPath] = createSignal('./tmp/game-orchestrator')
  const [gameRoot, setGameRoot] = createSignal('./tmp')
  const [gameRootManualOverride, setGameRootManualOverride] = createSignal(false)
  const [exePath, setExePath] = createSignal('')
  const [registryImportPath, setRegistryImportPath] = createSignal('')
  const [iconPreviewPath, setIconPreviewPath] = createSignal('')
  const [heroImageProcessing, setHeroImageProcessing] = createSignal(false)
  const [heroImageAutoSearching, setHeroImageAutoSearching] = createSignal(false)
  const [statusMessage, setStatusMessage] = createSignal(translate(initialLocale, 'statusReady'))
  const [resultJson, setResultJson] = createSignal('')

  const [winetricksAvailable, setWinetricksAvailable] = createSignal<string[]>([])
  const [winetricksLoading, setWinetricksLoading] = createSignal(false)
  const [winetricksSource, setWinetricksSource] = createSignal('fallback')
  const [winetricksSearch, setWinetricksSearch] = createSignal('')
  const [winetricksLoaded, setWinetricksLoaded] = createSignal(false)
  const [winetricksCatalogError, setWinetricksCatalogError] = createSignal(false)
  const [hashingExePath, setHashingExePath] = createSignal('')
  const [lastHashedExePath, setLastHashedExePath] = createSignal('')
  const [extractingExecutableIcon, setExtractingExecutableIcon] = createSignal(false)
  const [testingConfiguration, setTestingConfiguration] = createSignal(false)
  const [creatingExecutable, setCreatingExecutable] = createSignal(false)
  const [lastPreparedHeroImageUrl, setLastPreparedHeroImageUrl] = createSignal('')
  const [heroImageSearchCacheGameName, setHeroImageSearchCacheGameName] = createSignal('')
  const [heroImageSearchCacheGameId, setHeroImageSearchCacheGameId] = createSignal<number | null>(null)
  const [heroImageSearchCandidates, setHeroImageSearchCandidates] = createSignal<string[]>([])
  const [heroImageSearchIndex, setHeroImageSearchIndex] = createSignal(0)

  const [config, setConfig] = createSignal<GameConfig>(defaultGameConfig())

  const configPreview = createMemo(() => JSON.stringify(config(), null, 2))
  const t = (key: string) => translate(locale(), key)
  const ct = (key: CreatorCopyKey) => creatorTranslate(locale(), key)
  const ctf = (key: CreatorCopyKey, params: Record<string, string | number>) =>
    creatorFormat(locale(), key, params)

  const tabs: CreatorTab[] = [
    'game',
    'gameFiles',
    'runtime',
    'performance',
    'prefix',
    'winecfg',
    'wrappers',
    'review'
  ]

  const featureStateOptions = createMemo<SelectOption<FeatureState>[]>(() => [
    {
      value: 'MandatoryOn',
      label: ct('creator_mandatory_enabled')
    },
    {
      value: 'MandatoryOff',
      label: ct('creator_mandatory_disabled')
    },
    {
      value: 'OptionalOn',
      label: ct('creator_optional_enabled')
    },
    {
      value: 'OptionalOff',
      label: ct('creator_optional_disabled')
    }
  ])

  const runtimePrimaryOptions = createMemo<SelectOption<RuntimePrimary>[]>(() =>
    RUNTIME_CANDIDATES.map((value) => ({ value, label: value }))
  )

  const runtimePreferenceOptions = createMemo<SelectOption<RuntimePreference>[]>(() => [
    { value: 'Proton', label: 'Proton-GE' },
    { value: 'Wine', label: 'Wine' }
  ])

  const audioDriverOptions = createMemo<SelectOption<AudioDriverOption>[]>(() => [
    {
      value: '__none__',
      label: ct('creator_runtime_default')
    },
    { value: 'pipewire', label: 'pipewire' },
    { value: 'pulseaudio', label: 'pulseaudio' },
    { value: 'alsa', label: 'alsa' }
  ])

  const dllModeOptions = createMemo<SelectOption<(typeof DLL_MODES)[number]>[]>(() =>
    DLL_MODES.map((mode) => ({ value: mode, label: mode }))
  )

  const upscaleMethodOptions = createMemo<SelectOption<UpscaleMethod>[]>(() => [
    { value: 'fsr', label: 'AMD FSR' },
    { value: 'nis', label: 'NVIDIA NIS' },
    { value: 'integer', label: ct('creator_integer_scaling') },
    { value: 'stretch', label: ct('creator_stretch_image') }
  ])

  const windowTypeOptions = createMemo<SelectOption<GamescopeWindowType>[]>(() => [
    { value: 'fullscreen', label: ct('creator_fullscreen') },
    { value: 'borderless', label: ct('creator_borderless') },
    { value: 'windowed', label: ct('creator_windowed_2') }
  ])

  const prefixPathPreview = createMemo(() => {
    const hash = prefixHashKey(config().exe_hash.trim() || '<exe_hash>')
    return `~/.local/share/GameOrchestrator/prefixes/${hash}/`
  })

  const exeDirectory = createMemo(() => {
    const current = exePath().trim()
    if (!current) return ''
    return dirname(current)
  })

  const exeInsideGameRoot = createMemo(() => {
    const exe = exePath().trim()
    const root = gameRoot().trim()
    if (!exe || !root) return true
    return relativeFromRoot(root, exe) !== null
  })

  const gameRootRelativeDisplay = createMemo(() => {
    const exeDir = exeDirectory()
    const root = gameRoot().trim()

    if (!root) return './'
    if (!exeDir) return './'

    return formatRelativeDirDisplay(relativePathBetween(exeDir, root))
  })

  const runtimeFallbackOrder = createMemo(() => config().requirements.runtime.fallback_order)

  const environmentVarsAsList = createMemo(() =>
    Object.entries(config().environment.custom_vars).map(([key, value]) => ({ key, value }))
  )

  const audioDriverValue = createMemo<AudioDriverOption>(() => {
    const current = config().winecfg.audio_driver
    if (current === 'pipewire' || current === 'pulseaudio' || current === 'alsa') return current
    return '__none__'
  })

  const gamescopeEnabled = createMemo(() => isFeatureEnabled(config().environment.gamescope.state))

  const availableFallbackCandidates = createMemo(() =>
    RUNTIME_CANDIDATES.filter((candidate) => candidate !== config().requirements.runtime.primary)
  )

  const normalizedWinetricksSearch = createMemo(() => winetricksSearch().trim().toLowerCase())
  const normalizedHeroSearchGameName = createMemo(() => config().game_name.trim().toLowerCase())

  const winetricksCandidates = createMemo(() => {
    const search = normalizedWinetricksSearch()
    if (search.length < 2) return []

    return winetricksAvailable()
      .filter((verb) => !config().dependencies.includes(verb))
      .filter((verb) => verb.toLowerCase().includes(search))
      .slice(0, 24)
  })

  const winetricksExactMatch = createMemo(() => {
    const search = normalizedWinetricksSearch()
    if (!search) return null

    const verb = winetricksAvailable().find((item) => item.toLowerCase() === search)
    if (!verb) return null
    if (config().dependencies.includes(verb)) return null
    return verb
  })

  const payloadSummary = createMemo(() => ({
    launchArgs: config().launch_args.length,
    integrityFiles: config().integrity_files.length,
    winetricks: config().dependencies.length,
    registry: config().registry_keys.length,
    mounts: config().folder_mounts.length,
    wrappers: config().compatibility.wrapper_commands.length,
    envVars: Object.keys(config().environment.custom_vars).length
  }))

  const hashingExecutable = createMemo(() => {
    const currentExe = exePath().trim()
    return !!currentExe && hashingExePath() === currentExe
  })

  const createExecutableValidationErrors = createMemo(() => {
    const errors: string[] = []
    const cfg = config()
    const gamescope = cfg.environment.gamescope
    const parsePositiveInt = (raw: string) => {
      const trimmed = raw.trim()
      if (!/^\d+$/.test(trimmed)) return null
      const parsed = Number.parseInt(trimmed, 10)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null
    }

    if (isFeatureEnabled(gamescope.state)) {
      const gameWidth = parsePositiveInt(gamescope.game_width)
      const gameHeight = parsePositiveInt(gamescope.game_height)
      if (!gameWidth || !gameHeight) {
        errors.push(ct('creator_fill_gamescope_game_resolution_before_creating'))
      }

      const usesMonitorResolution =
        !gamescope.output_width.trim() && !gamescope.output_height.trim()
      if (!usesMonitorResolution) {
        const outputWidth = parsePositiveInt(gamescope.output_width)
        const outputHeight = parsePositiveInt(gamescope.output_height)
        if (!outputWidth || !outputHeight) {
          errors.push(
            ct('creator_fill_gamescope_output_resolution_or_enable_monitor_auto_befo')
          )
        }
      }

      if (gamescope.enable_limiter) {
        const fpsFocus = parsePositiveInt(gamescope.fps_limiter)
        const fpsNoFocus = parsePositiveInt(gamescope.fps_limiter_no_focus)
        if (!fpsFocus || !fpsNoFocus) {
          errors.push(ct('creator_fill_gamescope_fps_limits_before_creating'))
        }
      }
    }

    return errors
  })
  const createExecutableBlockedReason = createMemo(
    () => createExecutableValidationErrors()[0] ?? ''
  )

  const statusTone = createMemo<StatusTone>(() => {
    const text = statusMessage().toLowerCase()
    if (
      text.includes('falha') ||
      text.includes('failed') ||
      text.includes('error') ||
      text.includes('blocker')
    ) {
      return 'error'
    }

    if (
      text.includes('sucesso') ||
      text.includes('success') ||
      text.includes('conclu') ||
      text.includes('completed')
    ) {
      return 'success'
    }

    return 'info'
  })

  const canSearchAnotherHeroImage = createMemo(() => {
    const key = normalizedHeroSearchGameName()
    return (
      !!key &&
      heroImageSearchCacheGameName() === key &&
      heroImageSearchCacheGameId() !== null &&
      heroImageSearchCandidates().length > 1
    )
  })

  const patchConfig = (updater: (prev: GameConfig) => GameConfig) => {
    setConfig((prev) => updater(prev))
  }

  const clearHeroImageSearchCache = () => {
    setHeroImageSearchCacheGameName('')
    setHeroImageSearchCacheGameId(null)
    setHeroImageSearchCandidates([])
    setHeroImageSearchIndex(0)
  }

  const setHeroImageUrl = (value: string) => {
    const normalized = value.trim()
    const index = heroImageSearchCandidates().findIndex((candidate) => candidate === normalized)
    if (index >= 0) {
      setHeroImageSearchIndex(index)
    }
    patchConfig((prev) => ({
      ...prev,
      splash: {
        ...prev.splash,
        hero_image_url: value
      }
    }))
  }

  createEffect(() => {
    localStorage.setItem('creator.locale', locale())
  })

  createEffect(() => {
    const currentNormalizedName = normalizedHeroSearchGameName()
    const cachedName = heroImageSearchCacheGameName()
    if (!cachedName) return
    if (currentNormalizedName === cachedName) return
    clearHeroImageSearchCache()
  })

  // Runtime UX simplification: default to Proton-GE and enforce UMU in the authoring UI.
  createEffect(() => {
    const current = config()
    let next = current
    let changed = false

    if (current.runner.runtime_preference === 'Auto') {
      next = {
        ...next,
        runner: {
          ...next.runner,
          runtime_preference: 'Proton'
        }
      }
      changed = true
    }

    if (!current.runner.proton_version.trim()) {
      next = {
        ...next,
        runner: {
          ...next.runner,
          proton_version: 'GE-Proton-latest'
        }
      }
      changed = true
    }

    if (current.requirements.umu !== 'MandatoryOn') {
      next = {
        ...next,
        requirements: {
          ...next.requirements,
          umu: 'MandatoryOn'
        }
      }
      changed = true
    }

    if (changed) {
      setConfig(next)
    }
  })

  createEffect(() => {
    const currentExePath = exePath().trim()
    if (!currentExePath) return

    const detectedRoot = dirname(currentExePath)
    if (!detectedRoot || detectedRoot === currentExePath) return

    if (!gameRootManualOverride() && gameRoot() !== detectedRoot) {
      setGameRoot(detectedRoot)
    }
  })

  createEffect(() => {
    const currentExePath = exePath().trim()
    if (!currentExePath) return

    const baseRoot = gameRoot().trim() || dirname(currentExePath)
    const relative = relativeFromRoot(baseRoot, currentExePath)
    const nextRelativePath = relative ? `./${relative}` : `./${basename(currentExePath)}`
    if (config().relative_exe_path !== nextRelativePath) {
      patchConfig((prev) => ({ ...prev, relative_exe_path: nextRelativePath }))
    }
  })

  createEffect(() => {
    const currentExePath = exePath().trim()
    if (!currentExePath) return

    const dir = dirname(currentExePath)
    const file = basename(currentExePath)
    const stem = stripLauncherExtension(file) || file
    const derivedOutput = dir && dir !== file ? `${dir}/${stem}` : stem

    if (derivedOutput && outputPath() !== derivedOutput) {
      setOutputPath(derivedOutput)
    }
  })

  createEffect(() => {
    const hasVerbs = config().dependencies.length > 0
    const expected: FeatureState = hasVerbs ? 'OptionalOn' : 'OptionalOff'

    if (config().requirements.winetricks !== expected) {
      patchConfig((prev) => ({
        ...prev,
        requirements: {
          ...prev.requirements,
          winetricks: expected
        }
      }))
    }
  })

  onMount(() => {
    if (winetricksLoaded() || winetricksLoading()) return
    const timer = window.setTimeout(() => {
      if (!winetricksLoaded() && !winetricksLoading()) {
        void loadWinetricksCatalog()
      }
    }, 250)
    onCleanup(() => window.clearTimeout(timer))
  })

  createEffect(() => {
    const currentPath = exePath().trim()
    if (!currentPath) return
    if (!isLikelyAbsolutePath(currentPath)) return
    if (!hasWindowsLauncherExtension(currentPath)) return
    if (currentPath === hashingExePath() || currentPath === lastHashedExePath()) return

    const timer = window.setTimeout(() => {
      void hashExecutablePath(currentPath)
    }, 200)
    onCleanup(() => window.clearTimeout(timer))
  })

  async function hashExecutablePath(absoluteExePath: string) {
    if (!absoluteExePath.trim()) {
      setStatusMessage(ct('creator_select_an_executable_before_hashing'))
      return
    }

    if (!isLikelyAbsolutePath(absoluteExePath)) {
      setStatusMessage(
        ct('creator_hashing_requires_an_absolute_path_in_browser_lan_mode_us')
      )
      return
    }

    try {
      setHashingExePath(absoluteExePath)
      setLastHashedExePath(absoluteExePath)
      setStatusMessage(t('msgHashStart'))
      const result = await invokeCommand<{ sha256_hex: string }>('cmd_hash_executable', {
        executable_path: absoluteExePath
      })
      if (exePath().trim() === absoluteExePath) {
        patchConfig((prev) => ({ ...prev, exe_hash: result.sha256_hex }))
      }
      setStatusMessage(t('msgHashOk'))
    } catch (error) {
      setStatusMessage(`${t('msgHashFail')} ${String(error)}`)
    } finally {
      if (hashingExePath() === absoluteExePath) {
        setHashingExePath('')
      }
    }
  }

  const runHash = async () => {
    await hashExecutablePath(exePath().trim())
  }

  const runTest = async () => {
    try {
      setTestingConfiguration(true)
      setStatusMessage(t('msgTestStart'))
      const result = await invokeCommand<unknown>('cmd_test_configuration', {
        config_json: configPreview(),
        game_root: gameRoot()
      })
      setResultJson(JSON.stringify(result, null, 2))
      setStatusMessage(t('msgTestOk'))
    } catch (error) {
      setStatusMessage(`${t('msgTestFail')} ${String(error)}`)
    } finally {
      setTestingConfiguration(false)
    }
  }

  const runCreate = async () => {
    const blockedReason = createExecutableBlockedReason()
    if (blockedReason) {
      setStatusMessage(blockedReason)
      return
    }

    try {
      setCreatingExecutable(true)
      setStatusMessage(t('msgCreateStart'))
      const result = await invokeCommand<unknown>('cmd_create_executable', {
        base_binary_path: ORCHESTRATOR_BASE_PATH,
        output_path: outputPath(),
        config_json: configPreview(),
        backup_existing: true,
        make_executable: true,
        icon_png_data_url: iconPreviewPath().trim() || null
      })
      setResultJson(JSON.stringify(result, null, 2))
      setStatusMessage(t('msgCreateOk'))
    } catch (error) {
      setStatusMessage(`${t('msgCreateFail')} ${String(error)}`)
    } finally {
      setCreatingExecutable(false)
    }
  }

  const loadWinetricksCatalog = async () => {
    if (winetricksLoading()) return
    try {
      setWinetricksLoading(true)
      const result = await invokeCommand<WinetricksAvailableOutput>('cmd_winetricks_available')
      setWinetricksAvailable(result.components)
      setWinetricksSource(result.source)
      setWinetricksCatalogError(false)
      setWinetricksLoaded(true)
      setStatusMessage(ctf('creator_winetricks_catalog_loaded_count', { count: result.components.length }))
    } catch (error) {
      setWinetricksAvailable([])
      setWinetricksSource('fallback')
      setWinetricksCatalogError(true)
      setWinetricksLoaded(true)
      setStatusMessage(ctf('creator_failed_to_load_winetricks_catalog_error', { error: String(error) }))
    } finally {
      setWinetricksLoading(false)
    }
  }

  const pickExecutable = async () => {
    const defaultPathCandidate = (() => {
      const exe = exePath().trim()
      if (isLikelyAbsolutePath(exe)) return dirname(exe)
      const root = gameRoot().trim()
      if (isLikelyAbsolutePath(root)) return root
      return undefined
    })()

    const selected = await pickFile({
      title: ct('creator_select_game_executable'),
      filters: [{ name: 'Windows Launchers', extensions: ['exe', 'bat', 'cmd', 'com'] }],
      defaultPath: defaultPathCandidate
    })
    if (!selected) return

    if (!hasWindowsLauncherExtension(selected)) {
      setStatusMessage(
        ct('creator_select_a_valid_windows_launcher_exe_bat_cmd_com')
      )
      return
    }

    setExePath(selected)
    setLastHashedExePath('')
    setIconPreviewPath('')
    patchConfig((prev) => ({ ...prev, exe_hash: '' }))
    const detectedRoot = dirname(selected)
    setGameRootManualOverride(false)
    setGameRoot(detectedRoot)

    const relative = relativeFromRoot(detectedRoot, selected)

    patchConfig((prev) => ({
      ...prev,
      relative_exe_path: relative ? `./${relative}` : `./${basename(selected)}`
    }))
  }

  const pickRegistryFile = async () => {
    const selected = await pickFile({
      title: ct('creator_select_reg_file'),
      filters: [{ name: 'Registry file', extensions: ['reg'] }]
    })
    if (!selected) return null
    setRegistryImportPath(selected)
    return selected
  }

  const pickGameRootOverride = async () => {
    const selected = await pickFolder({
      title: ct('creator_select_game_root_folder'),
      defaultPath: (isLikelyAbsolutePath(exeDirectory()) ? exeDirectory() : undefined) ?? undefined
    })
    if (!selected) return

    const currentExe = exePath().trim()
    if (currentExe && relativeFromRoot(selected, currentExe) === null) {
      setStatusMessage(
        ct('creator_the_selected_game_root_must_contain_the_main_executable')
      )
      return
    }

    setGameRoot(selected)
    setGameRootManualOverride(true)
  }

  const pickIntegrityFileRelative = async () => {
    const selected = await pickFile({
      title: ct('creator_select_required_file'),
      defaultPath: gameRoot() || undefined
    })
    if (!selected) return null

    // Browser fallback may return only a file name; accept as relative input.
    if (!selected.includes('/') && !selected.includes('\\')) {
      return `./${basename(selected)}`
    }

    const relative = relativeFromRoot(gameRoot(), selected)
    if (!relative) {
      setStatusMessage(
        ct('creator_selected_file_must_be_inside_the_game_root_folder')
      )
      return null
    }

    return `./${relative}`
  }

  const pickMountFolder = async (index: number) => {
    const selected = await pickFolder({
      title: ct('creator_select_folder_to_mount')
    })
    if (!selected) return

    const relative = relativeFromRoot(gameRoot(), selected)
    if (!relative) {
      setStatusMessage(
        ct('creator_selected_folder_must_be_inside_game_root_folder')
      )
      return
    }

    patchConfig((prev) => ({
      ...prev,
      folder_mounts: replaceAt(prev.folder_mounts, index, {
        ...prev.folder_mounts[index],
        source_relative_path: relative
      })
    }))
  }

  const pickMountSourceRelative = async () => {
    const selected = await pickFolder({
      title: ct('creator_select_folder_to_mount')
    })
    if (!selected) return null

    const relative = relativeFromRoot(gameRoot(), selected)
    if (!relative) {
      setStatusMessage(
        ct('creator_selected_folder_must_be_inside_game_root_folder')
      )
      return null
    }

    return relative
  }

  const extractExecutableIcon = async () => {
    const currentExe = exePath().trim()
    if (!currentExe) {
      setStatusMessage(ct('creator_select_an_executable_before_extracting_icon'))
      return
    }

    if (!isLikelyAbsolutePath(currentExe)) {
      setStatusMessage(
        ct('creator_icon_extraction_requires_an_absolute_path_in_browser_lan_m')
      )
      return
    }

    try {
      setExtractingExecutableIcon(true)
      setStatusMessage(ct('creator_extracting_icon_from_executable'))
      const result = await invokeCommand<ExtractExecutableIconOutput>('cmd_extract_executable_icon', {
        executable_path: currentExe
      })
      setIconPreviewPath(result.data_url)
      setStatusMessage(
        ctf('creator_executable_icon_extracted_size', {
          width: result.width,
          height: result.height
        })
      )
    } catch (error) {
      setStatusMessage(ctf('creator_failed_to_extract_executable_icon_error', { error: String(error) }))
    } finally {
      setExtractingExecutableIcon(false)
    }
  }

  const prepareHeroImageFromUrl = async (rawUrl?: string) => {
    const imageUrl = (rawUrl ?? config().splash.hero_image_url).trim()

    if (!imageUrl) {
      patchConfig((prev) => ({
        ...prev,
        splash: {
          ...prev.splash,
          hero_image_data_url: ''
        }
      }))
      setLastPreparedHeroImageUrl('')
      return
    }

    if (imageUrl === lastPreparedHeroImageUrl() && config().splash.hero_image_data_url.trim()) {
      return
    }

    try {
      setHeroImageProcessing(true)
      setStatusMessage(ct('creator_processing_hero_image'))
      const result = await invokeCommand<PrepareHeroImageOutput>('cmd_prepare_hero_image', {
        image_url: imageUrl
      })
      patchConfig((prev) => ({
        ...prev,
        splash: {
          ...prev.splash,
          hero_image_url: result.source_url,
          hero_image_data_url: result.data_url
        }
      }))
      setLastPreparedHeroImageUrl(result.source_url)
      setStatusMessage(
        ctf('creator_hero_image_ready_size', {
          width: result.width,
          height: result.height
        })
      )
    } catch (error) {
      patchConfig((prev) => ({
        ...prev,
        splash: {
          ...prev.splash,
          hero_image_data_url: ''
        }
      }))
      setStatusMessage(ctf('creator_failed_to_prepare_hero_image_error', { error: String(error) }))
    } finally {
      setHeroImageProcessing(false)
    }
  }

  const searchHeroImageAutomatically = async () => {
    const gameName = config().game_name.trim()
    if (!gameName) {
      setStatusMessage(ct('creator_type_game_name_before_searching_hero_image'))
      return
    }

    const normalizedGameName = gameName.toLowerCase()
    const cachedCandidates = heroImageSearchCandidates()
    if (canSearchAnotherHeroImage() && heroImageSearchCacheGameName() === normalizedGameName) {
      const currentUrl = config().splash.hero_image_url.trim()
      const currentIndex = cachedCandidates.findIndex((candidate) => candidate === currentUrl)
      const baseIndex = currentIndex >= 0 ? currentIndex : heroImageSearchIndex()
      const nextIndex = (baseIndex + 1) % cachedCandidates.length
      const nextUrl = cachedCandidates[nextIndex]
      setHeroImageSearchIndex(nextIndex)
      setHeroImageUrl(nextUrl)
      setStatusMessage(ct('creator_hero_image_found_processing_preview'))
      await prepareHeroImageFromUrl(nextUrl)
      return
    }

    try {
      setHeroImageAutoSearching(true)
      setStatusMessage(ct('creator_searching_hero_image'))
      const search = await invokeCommand<SearchHeroImageOutput>('cmd_search_hero_image', {
        game_name: gameName
      })
      const candidates = dedupeUrls([
        ...(search.candidate_image_urls ?? []),
        search.image_url
      ])
      const selectedIndex = Math.max(0, candidates.findIndex((candidate) => candidate === search.image_url))
      setHeroImageSearchCacheGameName(normalizedGameName)
      setHeroImageSearchCacheGameId(search.game_id ?? null)
      setHeroImageSearchCandidates(candidates)
      setHeroImageSearchIndex(selectedIndex)
      setHeroImageUrl(search.image_url)
      setStatusMessage(ct('creator_hero_image_found_processing_preview'))
      await prepareHeroImageFromUrl(search.image_url)
    } catch (error) {
      setStatusMessage(ctf('creator_failed_to_search_hero_image_error', { error: String(error) }))
    } finally {
      setHeroImageAutoSearching(false)
    }
  }

  const setGamescopeState = (state: FeatureState) => {
    patchConfig((prev) => ({
      ...prev,
      environment: {
        ...prev.environment,
        gamescope: {
          ...prev.environment.gamescope,
          state
        }
      },
      requirements: {
        ...prev.requirements,
        gamescope: state
      }
    }))
  }

  const setGamemodeState = (state: FeatureState) => {
    patchConfig((prev) => ({
      ...prev,
      environment: {
        ...prev.environment,
        gamemode: state
      },
      requirements: {
        ...prev.requirements,
        gamemode: state
      }
    }))
  }

  const setMangohudState = (state: FeatureState) => {
    patchConfig((prev) => ({
      ...prev,
      environment: {
        ...prev.environment,
        mangohud: state
      },
      requirements: {
        ...prev.requirements,
        mangohud: state
      }
    }))
  }

  const setRuntimePrimary = (primary: RuntimePrimary) => {
    patchConfig((prev) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        runtime: {
          ...prev.requirements.runtime,
          primary,
          fallback_order: prev.requirements.runtime.fallback_order.filter((item) => item !== primary)
        }
      }
    }))
  }

  const addFallbackCandidate = (candidate: RuntimePrimary) => {
    patchConfig((prev) => {
      if (prev.requirements.runtime.fallback_order.includes(candidate)) return prev
      return {
        ...prev,
        requirements: {
          ...prev.requirements,
          runtime: {
            ...prev.requirements.runtime,
            fallback_order: [...prev.requirements.runtime.fallback_order, candidate]
          }
        }
      }
    })
  }

  const removeFallbackCandidate = (candidate: RuntimePrimary) => {
    patchConfig((prev) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        runtime: {
          ...prev.requirements.runtime,
          fallback_order: prev.requirements.runtime.fallback_order.filter((item) => item !== candidate)
        }
      }
    }))
  }

  const moveFallbackCandidate = (index: number, direction: -1 | 1) => {
    patchConfig((prev) => {
      const current = [...prev.requirements.runtime.fallback_order]
      const target = index + direction
      if (target < 0 || target >= current.length) return prev
      const [item] = current.splice(index, 1)
      current.splice(target, 0, item)
      return {
        ...prev,
        requirements: {
          ...prev.requirements,
          runtime: {
            ...prev.requirements.runtime,
            fallback_order: current
          }
        }
      }
    })
  }

  const updateCustomVars = (items: Array<{ key: string; value: string }>) => {
    const nextVars: Record<string, string> = {}
    for (const item of items) {
      const key = item.key.trim()
      if (!key) continue
      nextVars[key] = item.value
    }

    patchConfig((prev) => ({
      ...prev,
      environment: {
        ...prev.environment,
        custom_vars: nextVars
      }
    }))
  }

  const addWinetricksVerb = (verb: string) => {
    patchConfig((prev) => {
      if (prev.dependencies.includes(verb)) return prev
      return { ...prev, dependencies: [...prev.dependencies, verb] }
    })
  }

  const removeWinetricksVerb = (verb: string) => {
    patchConfig((prev) => ({
      ...prev,
      dependencies: prev.dependencies.filter((item) => item !== verb)
    }))
  }

  const addWinetricksFromSearch = () => {
    const exact = winetricksExactMatch()
    if (!exact) {
      setStatusMessage(
        ct('creator_type_at_least_2_characters_and_select_a_valid_catalog_ve')
      )
      return
    }

    addWinetricksVerb(exact)
    setWinetricksSearch('')
  }

  const setTab = (next: string) => {
    if (tabs.includes(next as CreatorTab)) {
      setActiveTab(next as CreatorTab)
    }
  }

  return {
    ORCHESTRATOR_BASE_PATH,
    AUDIO_DRIVERS,
    locale,
    setLocale,
    activeTab,
    setActiveTab,
    setTab,
    tabs,
    outputPath,
    setOutputPath,
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
    setIconPreviewPath,
    heroImageProcessing,
    heroImageAutoSearching,
    canSearchAnotherHeroImage,
    statusMessage,
    setStatusMessage,
    resultJson,
    setResultJson,
    winetricksAvailable,
    setWinetricksAvailable,
    winetricksLoading,
    winetricksSource,
    winetricksSearch,
    setWinetricksSearch,
    winetricksCatalogError,
    hashingExecutable,
    extractingExecutableIcon,
    testingConfiguration,
    creatingExecutable,
    createExecutableValidationErrors,
    createExecutableBlockedReason,
    config,
    patchConfig,
    setHeroImageUrl,
    configPreview,
    t,
    ct,
    ctf,
    featureStateOptions,
    runtimePrimaryOptions,
    runtimePreferenceOptions,
    audioDriverOptions,
    dllModeOptions,
    upscaleMethodOptions,
    windowTypeOptions,
    prefixPathPreview,
    runtimeFallbackOrder,
    environmentVarsAsList,
    audioDriverValue,
    gamescopeEnabled,
    availableFallbackCandidates,
    normalizedWinetricksSearch,
    winetricksCandidates,
    payloadSummary,
    statusTone,
    splitCommaList,
    joinCommaList,
    replaceAt,
    removeAt,
    runHash,
    runTest,
    runCreate,
    loadWinetricksCatalog,
    pickExecutable,
    pickGameRootOverride,
    pickIntegrityFileRelative,
    pickRegistryFile,
    pickMountFolder,
    pickMountSourceRelative,
    extractExecutableIcon,
    prepareHeroImageFromUrl,
    searchHeroImageAutomatically,
    setGamescopeState,
    setGamemodeState,
    setMangohudState,
    setRuntimePrimary,
    addFallbackCandidate,
    removeFallbackCandidate,
    moveFallbackCandidate,
    updateCustomVars,
    addWinetricksVerb,
    removeWinetricksVerb,
    addWinetricksFromSearch
  }
}

export type CreatorController = ReturnType<typeof useCreatorController>
export type { AudioDriverOption, UpscaleMethod, GamescopeWindowType }
