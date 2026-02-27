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

  const {
    loadWinetricksCatalog,
    addWinetricksVerb,
    removeWinetricksVerb,
    addWinetricksFromSearch
  } = createLuthierWinetricksActions(state, computed, invokeCommand, ct, ctf, setStatusMessage)

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
