/**
 * controller-state.ts
 *
 * Base state (Signals) for the Luthier controller.
 * Extracts the primary reactive variables from `useLuthierController.ts`.
 */

import { createSignal } from 'solid-js'
import { detectLocale, type Locale, translate } from '../../i18n'
import { type LuthierTab, defaultGameConfig, type GameConfig } from '../../models/config'

export function createLuthierState() {
  const initialLocale = detectLocale()
  const [locale, setLocale] = createSignal<Locale>(initialLocale)
  const [activeTab, setActiveTab] = createSignal<LuthierTab>('game')

  const [outputPath, setOutputPath] = createSignal('./tmp/luthier')
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
  const [heroImageSearchCacheGameId, setHeroImageSearchCacheGameId] = createSignal<number | null>(
    null
  )
  const [heroImageSearchCandidates, setHeroImageSearchCandidates] = createSignal<string[]>([])
  const [heroImageSearchIndex, setHeroImageSearchIndex] = createSignal(0)

  const [config, setConfig] = createSignal<GameConfig>(defaultGameConfig())

  const patchConfig = (updater: (prev: GameConfig) => GameConfig) => {
    setConfig((prev) => updater(prev))
  }

  return {
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
    patchConfig,
  }
}
