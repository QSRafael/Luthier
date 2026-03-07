import { createMemo, createSignal } from 'solid-js'
import { defaultGameConfig, type GameConfig } from '../../models/config'
import { createLuthierBuildActions } from './controller-build-actions'
import { createLuthierComputed } from './controller-computed'
import { createLuthierConfigActions } from './controller-config-actions'
import { createLuthierFileActions } from './controller-file-actions'
import { createLuthierHeroActions } from './controller-hero-actions'
import { createLuthierState } from './controller-state'
import { createLuthierStatus } from './controller-status'
import {
  AUDIO_DRIVERS,
  joinCommaList,
  ORCHESTRATOR_BASE_PATH,
  removeAt,
  replaceAt,
  splitCommaList,
  type AudioDriverOption,
  type GamescopeWindowType,
  type UpscaleMethod,
} from './controller-utils'
import { createLuthierWinetricksActions } from './controller-winetricks-actions'
import { hasDirtyConfig, serializeConfigSnapshot } from './domain/config-dirty'
import {
  deriveImportedRuntimePathsFromMainExecutable,
  resolveSiblingMainExecutablePath,
  shouldRefreshImportedHeroImage,
} from './domain/imported-payload'
import { luthierBackendApi } from './infrastructure/luthier-backend-api'
import { sonnerNotifier } from './infrastructure/sonner-notifier'

export function useLuthierController() {
  const state = createLuthierState()
  const {
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
    heroImageAutoSearching,
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
    extractingExecutableIcon,
    testingConfiguration,
    creatingExecutable,
    config,
    patchConfig,
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
    exeInsideGameRoot,
    gameRootRelativeDisplay,
    runtimeFallbackOrder,
    environmentVarsAsList,
    audioDriverValue,
    gamescopeEnabled,
    availableFallbackCandidates,
    normalizedWinetricksSearch,
    winetricksCandidates,
    payloadSummary,
    hashingExecutable,
    createExecutableValidationErrors,
    createExecutableBlockedReason,
    statusTone,
    canSearchAnotherHeroImage,
  } = computed

  const { setHeroImageUrl, prepareHeroImageFromUrl, searchHeroImageAutomatically } =
    createLuthierHeroActions(
      state,
      computed,
      luthierBackendApi,
      sonnerNotifier,
      ct,
      ctf,
      setStatusMessage
    )

  const { hashExecutablePath, runHash, runTest, runCreate } = createLuthierBuildActions(
    state,
    computed,
    luthierBackendApi,
    ORCHESTRATOR_BASE_PATH,
    t,
    setStatusMessage
  )

  const {
    pickExecutable,
    pickRegistryFile,
    pickGameRootOverride,
    pickIntegrityFileRelative,
    pickMountFolder,
    pickMountSourceRelative,
    extractExecutableIcon,
  } = createLuthierFileActions(state, computed, luthierBackendApi, ct, ctf, setStatusMessage)

  const {
    loadWinetricksCatalog,
    addWinetricksVerb,
    removeWinetricksVerb,
    addWinetricksFromSearch,
  } = createLuthierWinetricksActions(
    state,
    computed,
    luthierBackendApi,
    sonnerNotifier,
    ct,
    ctf,
    setStatusMessage
  )

  const {
    setGamescopeState,
    setGamemodeState,
    setMangohudState,
    setRuntimePrimary,
    addFallbackCandidate,
    removeFallbackCandidate,
    moveFallbackCandidate,
    updateCustomVars,
    setTab,
  } = createLuthierConfigActions(state, tabs)

  createLuthierStatus(state, computed, { hashExecutablePath, loadWinetricksCatalog })

  const [cleanConfigSnapshot, setCleanConfigSnapshot] = createSignal(
    serializeConfigSnapshot(config())
  )
  const defaultConfigSnapshot = serializeConfigSnapshot(defaultGameConfig())
  const hasPendingChanges = createMemo(() => hasDirtyConfig(config(), cleanConfigSnapshot()))
  const hasInProgressData = createMemo(() => {
    if (hasPendingChanges()) return true
    if (serializeConfigSnapshot(config()) !== defaultConfigSnapshot) return true

    return (
      exePath().trim().length > 0 ||
      registryImportPath().trim().length > 0 ||
      iconPreviewPath().trim().length > 0 ||
      resultJson().trim().length > 0 ||
      gameRootManualOverride() ||
      gameRoot() !== './tmp' ||
      outputPath() !== './tmp/luthier'
    )
  })

  const markConfigAsClean = (nextConfig: GameConfig) => {
    setCleanConfigSnapshot(serializeConfigSnapshot(nextConfig))
  }

  const markCurrentConfigAsClean = () => {
    setCleanConfigSnapshot(serializeConfigSnapshot(config()))
  }

  const resetTransientUiState = () => {
    setExePath('')
    setGameRoot('./tmp')
    setGameRootManualOverride(false)
    setOutputPath('./tmp/luthier')
    setRegistryImportPath('')
    setIconPreviewPath('')
    setResultJson('')

    state.setHashingExePath('')
    state.setLastHashedExePath('')
    state.setLastPreparedHeroImageUrl('')
    state.setHeroImageSearchCacheGameName('')
    state.setHeroImageSearchCacheGameId(null)
    state.setHeroImageSearchCandidates([])
    state.setHeroImageSearchIndex(0)

    setActiveTab('game')
  }

  const resetToDefaultConfig = () => {
    const nextConfig = defaultGameConfig()
    state.setConfig(nextConfig)
    markConfigAsClean(nextConfig)
    resetTransientUiState()
    setStatusMessage(ct('luthier_create_new_reset_done'))
  }

  const loadImportedPayload = (
    importedConfig: GameConfig,
    source: 'json' | 'orchestrator',
    fileName: string,
    sourcePath?: string
  ) => {
    state.setConfig(importedConfig)
    markConfigAsClean(importedConfig)
    resetTransientUiState()

    const siblingExecutablePath =
      source === 'orchestrator' && sourcePath ? resolveSiblingMainExecutablePath(sourcePath) : null
    const importedRuntimePaths = siblingExecutablePath
      ? deriveImportedRuntimePathsFromMainExecutable(
          siblingExecutablePath,
          importedConfig.relative_exe_path
        )
      : null
    if (importedRuntimePaths) {
      setGameRoot(importedRuntimePaths.gameRoot)
      setGameRootManualOverride(importedRuntimePaths.gameRootManualOverride)
      setExePath(importedRuntimePaths.exePath)
    } else if (source === 'orchestrator') {
      setGameRoot('')
    }

    const sourceLabel =
      source === 'json'
        ? ct('luthier_payload_source_json')
        : ct('luthier_payload_source_orchestrator')

    setStatusMessage(
      ctf('luthier_import_payload_loaded_source_file', {
        source: sourceLabel,
        fileName,
      })
    )

    if (shouldRefreshImportedHeroImage(importedConfig)) {
      void prepareHeroImageFromUrl(importedConfig.splash.hero_image_url.trim()).finally(() => {
        markCurrentConfigAsClean()
      })
      return
    }

    markCurrentConfigAsClean()
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
    hasPendingChanges,
    hasInProgressData,
    config,
    patchConfig,
    loadImportedPayload,
    resetToDefaultConfig,
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
    addWinetricksFromSearch,
  }
}

export type LuthierController = ReturnType<typeof useLuthierController>
export type { AudioDriverOption, UpscaleMethod, GamescopeWindowType }
