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
    addWinetricksFromSearch,
  }
}

export type LuthierController = ReturnType<typeof useLuthierController>
export type { AudioDriverOption, UpscaleMethod, GamescopeWindowType }
