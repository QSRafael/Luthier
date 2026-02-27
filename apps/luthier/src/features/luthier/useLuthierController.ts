import { createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { toast } from 'solid-sonner'

import { invokeCommand, pickFile, pickFolder } from '../../api/tauri'
import type { SelectOption } from '../../components/form/FormControls'
import { detectLocale, Locale, translate } from '../../i18n'
import { luthierFormat, luthierTranslate, type LuthierCopyKey } from './luthier-copy'
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
} from './luthier-controller-utils'
import {
  validateCommandToken,
  validateDllName,
  validateEnvVarName,
  validateLinuxPath,
  validatePositiveIntegerString,
  validateRegistryPath,
  validateRegistryValueType,
  validateRelativeGamePath,
  validateWindowsDriveSerial,
  validateWindowsFriendlyName,
  validateWindowsPath,
  validateWrapperExecutable,
} from './luthier-field-validation'
import {
  LuthierTab,
  defaultGameConfig,
  FeatureState,
  GameConfig,
  RuntimePreference,
  RuntimePrimary
} from '../../models/config'
import { createLuthierState } from './luthier-controller-state'
import { createLuthierComputed } from './luthier-controller-computed'
import { createLuthierStatus } from './luthier-controller-status'

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

export function useLuthierController() {
  const state = createLuthierState()
  const {
    initialLocale,
    locale,
    setLocale,
    activeTab,
    setActiveTab,
    outputPath,
    setOutputPath,
    gameRoot,
    setGameRoot,
    gameRootManualOverride,
    setGameRootManualOverride,
    exePath,
    setExePath,
    registryImportPath,
    setRegistryImportPath,
    iconPreviewPath,
    setIconPreviewPath,
    heroImageProcessing,
    setHeroImageProcessing,
    heroImageAutoSearching,
    setHeroImageAutoSearching,
    statusMessage,
    setStatusMessage,
    resultJson,
    setResultJson,
    winetricksAvailable,
    setWinetricksAvailable,
    winetricksLoading,
    setWinetricksLoading,
    winetricksSource,
    setWinetricksSource,
    winetricksSearch,
    setWinetricksSearch,
    winetricksLoaded,
    setWinetricksLoaded,
    winetricksCatalogError,
    setWinetricksCatalogError,
    hashingExePath,
    setHashingExePath,
    lastHashedExePath,
    setLastHashedExePath,
    extractingExecutableIcon,
    setExtractingExecutableIcon,
    testingConfiguration,
    setTestingConfiguration,
    creatingExecutable,
    setCreatingExecutable,
    lastPreparedHeroImageUrl,
    setLastPreparedHeroImageUrl,
    heroImageSearchCacheGameName,
    setHeroImageSearchCacheGameName,
    heroImageSearchCacheGameId,
    setHeroImageSearchCacheGameId,
    heroImageSearchCandidates,
    setHeroImageSearchCandidates,
    heroImageSearchIndex,
    setHeroImageSearchIndex,
    config,
    setConfig,
    patchConfig
  } = state

  const computed = createLuthierComputed(state)
  const {
    configPreview,
    t,
    ct,
    ctf,
    tabs,
    featureStateOptions,
    runtimePrimaryOptions,
    runtimePreferenceOptions,
    audioDriverOptions,
    dllModeOptions,
    upscaleMethodOptions,
    windowTypeOptions,
    prefixPathPreview,
    exeDirectory,
    exeInsideGameRoot,
    gameRootRelativeDisplay,
    runtimeFallbackOrder,
    environmentVarsAsList,
    audioDriverValue,
    gamescopeEnabled,
    availableFallbackCandidates,
    normalizedWinetricksSearch,
    normalizedHeroSearchGameName,
    winetricksCandidates,
    winetricksExactMatch,
    payloadSummary,
    hashingExecutable,
    createExecutableValidationErrors,
    createExecutableBlockedReason,
    statusTone,
    canSearchAnotherHeroImage
  } = computed
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


  async function hashExecutablePath(absoluteExePath: string) {
    if (!absoluteExePath.trim()) {
      return
    }

    if (!isLikelyAbsolutePath(absoluteExePath)) {
      return
    }

    try {
      setHashingExePath(absoluteExePath)
      setLastHashedExePath(absoluteExePath)
      const result = await invokeCommand<{ sha256_hex: string }>('cmd_hash_executable', {
        executable_path: absoluteExePath
      })
      if (exePath().trim() === absoluteExePath) {
        patchConfig((prev) => ({ ...prev, exe_hash: result.sha256_hex }))
      }
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
      setStatusMessage(ctf('luthier_winetricks_catalog_loaded_count', { count: result.components.length }))
    } catch (error) {
      setWinetricksAvailable([])
      setWinetricksSource('fallback')
      setWinetricksCatalogError(true)
      setWinetricksLoaded(true)
      setStatusMessage(ctf('luthier_failed_to_load_winetricks_catalog_error', { error: String(error) }))
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
      title: ct('luthier_select_game_executable'),
      filters: [{ name: 'Windows Launchers', extensions: ['exe', 'bat', 'cmd', 'com'] }],
      defaultPath: defaultPathCandidate
    })
    if (!selected) return

    if (!hasWindowsLauncherExtension(selected)) {
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
      title: ct('luthier_select_reg_file'),
      filters: [{ name: 'Registry file', extensions: ['reg'] }]
    })
    if (!selected) return null
    setRegistryImportPath(selected)
    return selected
  }

  const pickGameRootOverride = async () => {
    const selected = await pickFolder({
      title: ct('luthier_select_game_root_folder'),
      defaultPath: (isLikelyAbsolutePath(exeDirectory()) ? exeDirectory() : undefined) ?? undefined
    })
    if (!selected) return

    const currentExe = exePath().trim()
    if (currentExe && relativeFromRoot(selected, currentExe) === null) {
      return
    }

    setGameRootManualOverride(true)
    setGameRoot(selected)
  }

  const pickIntegrityFileRelative = async () => {
    const selected = await pickFile({
      title: ct('luthier_select_required_file'),
      defaultPath: gameRoot() || undefined
    })
    if (!selected) return null

    // Browser fallback may return only a file name; accept as relative input.
    if (!selected.includes('/') && !selected.includes('\\')) {
      return `./${basename(selected)}`
    }

    const relative = relativeFromRoot(gameRoot(), selected)
    if (!relative) {
      return null
    }

    return `./${relative}`
  }

  const pickMountFolder = async (index: number) => {
    const selected = await pickFolder({
      title: ct('luthier_select_folder_to_mount')
    })
    if (!selected) return

    const relative = relativeFromRoot(gameRoot(), selected)
    if (!relative) {
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
      title: ct('luthier_select_folder_to_mount')
    })
    if (!selected) return null

    const relative = relativeFromRoot(gameRoot(), selected)
    if (!relative) {
      return null
    }

    return relative
  }

  const extractExecutableIcon = async () => {
    const currentExe = exePath().trim()
    if (!currentExe) {
      setStatusMessage(ct('luthier_select_an_executable_before_extracting_icon'))
      return
    }

    if (!isLikelyAbsolutePath(currentExe)) {
      setStatusMessage(
        ct('luthier_icon_extraction_requires_an_absolute_path_in_browser_lan_m')
      )
      return
    }

    try {
      setExtractingExecutableIcon(true)
      setStatusMessage(ct('luthier_extracting_icon_from_executable'))
      const result = await invokeCommand<ExtractExecutableIconOutput>('cmd_extract_executable_icon', {
        executable_path: currentExe
      })
      setIconPreviewPath(result.data_url)
      setStatusMessage(
        ctf('luthier_executable_icon_extracted_size', {
          width: result.width,
          height: result.height
        })
      )
    } catch (error) {
      setStatusMessage(ctf('luthier_failed_to_extract_executable_icon_error', { error: String(error) }))
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
      setStatusMessage(ct('luthier_processing_hero_image'))
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
        ctf('luthier_hero_image_ready_size', {
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
      setStatusMessage(ctf('luthier_failed_to_prepare_hero_image_error', { error: String(error) }))
    } finally {
      setHeroImageProcessing(false)
    }
  }

  const searchHeroImageAutomatically = async () => {
    const gameName = config().game_name.trim()
    if (!gameName) {
      setStatusMessage(ct('luthier_type_game_name_before_searching_hero_image'))
      return
    }

    const normalizedGameName = gameName.toLowerCase()
    const cachedCandidates = heroImageSearchCandidates()
    const previousHeroSnapshot = {
      hero_image_url: config().splash.hero_image_url,
      hero_image_data_url: config().splash.hero_image_data_url,
      lastPreparedHeroImageUrl: lastPreparedHeroImageUrl(),
      searchIndex: heroImageSearchIndex()
    }
    if (canSearchAnotherHeroImage() && heroImageSearchCacheGameName() === normalizedGameName) {
      const currentUrl = config().splash.hero_image_url.trim()
      const currentIndex = cachedCandidates.findIndex((candidate) => candidate === currentUrl)
      const baseIndex = currentIndex >= 0 ? currentIndex : heroImageSearchIndex()
      const nextIndex = (baseIndex + 1) % cachedCandidates.length
      const nextUrl = cachedCandidates[nextIndex]
      setHeroImageSearchIndex(nextIndex)
      setHeroImageUrl(nextUrl)
      setStatusMessage(ct('luthier_hero_image_found_processing_preview'))
      await prepareHeroImageFromUrl(nextUrl)
      toast(ct('luthier_hero_image_updated'), {
        action: {
          label: ct('luthier_undo'),
          onClick: () => {
            patchConfig((prev) => ({
              ...prev,
              splash: {
                ...prev.splash,
                hero_image_url: previousHeroSnapshot.hero_image_url,
                hero_image_data_url: previousHeroSnapshot.hero_image_data_url
              }
            }))
            setLastPreparedHeroImageUrl(previousHeroSnapshot.lastPreparedHeroImageUrl)
            setHeroImageSearchIndex(previousHeroSnapshot.searchIndex)
          }
        }
      })
      return
    }

    try {
      setHeroImageAutoSearching(true)
      setStatusMessage(ct('luthier_searching_hero_image'))
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
      setStatusMessage(ct('luthier_hero_image_found_processing_preview'))
      await prepareHeroImageFromUrl(search.image_url)
      toast(ct('luthier_hero_image_updated'), {
        action: {
          label: ct('luthier_undo'),
          onClick: () => {
            patchConfig((prev) => ({
              ...prev,
              splash: {
                ...prev.splash,
                hero_image_url: previousHeroSnapshot.hero_image_url,
                hero_image_data_url: previousHeroSnapshot.hero_image_data_url
              }
            }))
            setLastPreparedHeroImageUrl(previousHeroSnapshot.lastPreparedHeroImageUrl)
            setHeroImageSearchIndex(previousHeroSnapshot.searchIndex)
          }
        }
      })
    } catch (error) {
      setStatusMessage(ctf('luthier_failed_to_search_hero_image_error', { error: String(error) }))
    } finally {
      setHeroImageAutoSearching(false)
    }
  }

  const setGamescopeState = (state: FeatureState) => {
    const normalizedState: FeatureState = state === 'OptionalOff' ? 'MandatoryOff' : state
    patchConfig((prev) => ({
      ...prev,
      environment: {
        ...prev.environment,
        gamescope: {
          ...prev.environment.gamescope,
          state: normalizedState
        }
      },
      requirements: {
        ...prev.requirements,
        gamescope: normalizedState
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
    let added = false
    patchConfig((prev) => {
      if (prev.dependencies.includes(verb)) return prev
      added = true
      return { ...prev, dependencies: [...prev.dependencies, verb] }
    })
    if (!added) return
    toast(ct('luthier_winetricks_verb_added'), {
      description: verb,
      action: {
        label: ct('luthier_undo'),
        onClick: () => removeWinetricksVerb(verb)
      }
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
      return
    }

    addWinetricksVerb(exact)
    setWinetricksSearch('')
  }

  const setTab = (next: string) => {
    if (tabs.includes(next as LuthierTab)) {
      setActiveTab(next as LuthierTab)
    }
  }

  createLuthierStatus(state, computed, { hashExecutablePath, loadWinetricksCatalog })

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

export type LuthierController = ReturnType<typeof useLuthierController>
export type { AudioDriverOption, UpscaleMethod, GamescopeWindowType }
