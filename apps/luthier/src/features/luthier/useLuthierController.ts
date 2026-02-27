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
import { createLuthierHeroActions } from './luthier-controller-hero-actions'
import { createLuthierWinetricksActions } from './luthier-controller-winetricks-actions'
import { createLuthierFileActions } from './luthier-controller-file-actions'
import { createLuthierBuildActions } from './luthier-controller-build-actions'
import { createLuthierConfigActions } from './luthier-controller-config-actions'

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

  const {
    clearHeroImageSearchCache,
    setHeroImageUrl,
    prepareHeroImageFromUrl,
    searchHeroImageAutomatically
  } = createLuthierHeroActions(state, computed, invokeCommand, ct, ctf, setStatusMessage)

  const {
    hashExecutablePath,
    runHash,
    runTest,
    runCreate
  } = createLuthierBuildActions(state, computed, invokeCommand, ORCHESTRATOR_BASE_PATH, t, setStatusMessage)

  const {
    pickExecutable,
    pickRegistryFile,
    pickGameRootOverride,
    pickIntegrityFileRelative,
    pickMountFolder,
    pickMountSourceRelative,
    extractExecutableIcon
  } = createLuthierFileActions(state, computed, invokeCommand, ct, ctf, setStatusMessage)

  const {
    loadWinetricksCatalog,
    addWinetricksVerb,
    removeWinetricksVerb,
    addWinetricksFromSearch
  } = createLuthierWinetricksActions(state, computed, invokeCommand, ct, ctf, setStatusMessage)

  const {
    setGamescopeState,
    setGamemodeState,
    setMangohudState,
    setRuntimePrimary,
    addFallbackCandidate,
    removeFallbackCandidate,
    moveFallbackCandidate,
    updateCustomVars,
    setTab
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
    addWinetricksFromSearch
  }
}

export type LuthierController = ReturnType<typeof useLuthierController>
export type { AudioDriverOption, UpscaleMethod, GamescopeWindowType }
