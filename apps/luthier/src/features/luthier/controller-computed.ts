/**
 * controller-computed.ts
 *
 * Computed values (createMemo) for the Luthier controller.
 * Extracts memoized state derivations from `useLuthierController.ts`.
 */

import { createMemo } from 'solid-js'
import { translate } from '../../i18n'
import { luthierFormat, luthierTranslate, type LuthierCopyKey } from './copy'
import {
  AUDIO_DRIVERS,
  basename,
  DLL_MODES,
  dirname,
  formatRelativeDirDisplay,
  hasWindowsLauncherExtension,
  isFeatureEnabled,
  isLikelyAbsolutePath,
  prefixHashKey,
  relativeFromRoot,
  relativePathBetween,
  RUNTIME_CANDIDATES,
  stripLauncherExtension,
  type AudioDriverOption,
  type GamescopeWindowType,
  type UpscaleMethod,
} from './controller-utils'
import {
  type LuthierTab,
  type FeatureState,
  type RuntimePreference,
  type RuntimePrimary,
} from '../../models/config'
import type { createLuthierState } from './controller-state'
import { getCreateExecutableValidationErrors } from './domain/create-executable-guards'

type SelectOption<T extends string> = {
  value: T
  label: string
}

export type StatusTone = 'info' | 'success' | 'error'

export function createLuthierComputed(state: ReturnType<typeof createLuthierState>) {
  const configPreview = createMemo(() => JSON.stringify(state.config(), null, 2))
  const t = (key: string) => translate(state.locale(), key)
  const ct = (key: LuthierCopyKey) => luthierTranslate(state.locale(), key)
  const ctf = (key: LuthierCopyKey, params: Record<string, string | number>) =>
    luthierFormat(state.locale(), key, params)

  const tabs: LuthierTab[] = [
    'game',
    'gameFiles',
    'runtime',
    'performance',
    'prefix',
    'winecfg',
    'wrappers',
    'review',
  ]

  const featureStateOptions = createMemo<SelectOption<FeatureState>[]>(() => [
    { value: 'MandatoryOn', label: ct('luthier_mandatory_enabled') },
    { value: 'MandatoryOff', label: ct('luthier_mandatory_disabled') },
    { value: 'OptionalOn', label: ct('luthier_optional_enabled') },
    { value: 'OptionalOff', label: ct('luthier_optional_disabled') },
  ])

  const runtimePrimaryOptions = createMemo<SelectOption<RuntimePrimary>[]>(() =>
    RUNTIME_CANDIDATES.map((value) => ({ value, label: value }))
  )

  const runtimePreferenceOptions = createMemo<SelectOption<RuntimePreference>[]>(() => [
    { value: 'Proton', label: 'Proton-GE' },
    { value: 'Wine', label: 'Wine' },
  ])

  const audioDriverOptions = createMemo<SelectOption<AudioDriverOption>[]>(() => [
    { value: '__none__', label: ct('luthier_runtime_default') },
    { value: 'pipewire', label: 'pipewire' },
    { value: 'pulseaudio', label: 'pulseaudio' },
    { value: 'alsa', label: 'alsa' },
  ])

  const dllModeOptions = createMemo<SelectOption<(typeof DLL_MODES)[number]>[]>(() =>
    DLL_MODES.map((mode) => ({ value: mode, label: mode }))
  )

  const upscaleMethodOptions = createMemo<SelectOption<UpscaleMethod>[]>(() => [
    { value: 'fsr', label: 'AMD FSR' },
    { value: 'nis', label: 'NVIDIA NIS' },
    { value: 'integer', label: ct('luthier_integer_scaling') },
    { value: 'stretch', label: ct('luthier_stretch_image') },
  ])

  const windowTypeOptions = createMemo<SelectOption<GamescopeWindowType>[]>(() => [
    { value: 'fullscreen', label: ct('luthier_fullscreen') },
    { value: 'borderless', label: ct('luthier_borderless') },
    { value: 'windowed', label: ct('luthier_windowed_2') },
  ])

  const prefixPathPreview = createMemo(() => {
    const hash = prefixHashKey(state.config().exe_hash.trim() || '<exe_hash>')
    return `~/.local/share/Luthier/prefixes/${hash}/`
  })

  const exeDirectory = createMemo(() => {
    const current = state.exePath().trim()
    if (!current) return ''
    return dirname(current)
  })

  const exeInsideGameRoot = createMemo(() => {
    const exe = state.exePath().trim()
    const root = state.gameRoot().trim()
    if (!exe || !root) return true
    return relativeFromRoot(root, exe) !== null
  })

  const gameRootRelativeDisplay = createMemo(() => {
    const exeDir = exeDirectory()
    const root = state.gameRoot().trim()

    if (!root) return './'
    if (!exeDir) return './'

    return formatRelativeDirDisplay(relativePathBetween(exeDir, root))
  })

  const runtimeFallbackOrder = createMemo(() => state.config().requirements.runtime.fallback_order)

  const environmentVarsAsList = createMemo(() =>
    Object.entries(state.config().environment.custom_vars).map(([key, value]) => ({ key, value }))
  )

  const audioDriverValue = createMemo<AudioDriverOption>(() => {
    const current = state.config().winecfg.audio_driver
    if (current === 'pipewire' || current === 'pulseaudio' || current === 'alsa') return current
    return '__none__'
  })

  const gamescopeEnabled = createMemo(() =>
    isFeatureEnabled(state.config().environment.gamescope.state)
  )

  const availableFallbackCandidates = createMemo(() =>
    RUNTIME_CANDIDATES.filter(
      (candidate) => candidate !== state.config().requirements.runtime.primary
    )
  )

  const normalizedWinetricksSearch = createMemo(() => state.winetricksSearch().trim().toLowerCase())
  const normalizedHeroSearchGameName = createMemo(() =>
    state.config().game_name.trim().toLowerCase()
  )

  const winetricksCandidates = createMemo(() => {
    const search = normalizedWinetricksSearch()
    if (search.length < 2) return []

    return state
      .winetricksAvailable()
      .filter((verb) => !state.config().dependencies.includes(verb))
      .filter((verb) => verb.toLowerCase().includes(search))
      .slice(0, 24)
  })

  const winetricksExactMatch = createMemo(() => {
    const search = normalizedWinetricksSearch()
    if (!search) return null

    const verb = state.winetricksAvailable().find((item) => item.toLowerCase() === search)
    if (!verb) return null
    if (state.config().dependencies.includes(verb)) return null
    return verb
  })

  const payloadSummary = createMemo(() => ({
    launchArgs: state.config().launch_args.length,
    integrityFiles: state.config().integrity_files.length,
    winetricks: state.config().dependencies.length,
    registry: state.config().registry_keys.length,
    mounts: state.config().folder_mounts.length,
    wrappers: state.config().compatibility.wrapper_commands.length,
    envVars: Object.keys(state.config().environment.custom_vars).length,
  }))

  const hashingExecutable = createMemo(() => {
    const currentExe = state.exePath().trim()
    return !!currentExe && state.hashingExePath() === currentExe
  })

  const createExecutableValidationErrors = createMemo(() =>
    getCreateExecutableValidationErrors({
      config: state.config(),
      locale: state.locale(),
      exePath: state.exePath(),
      gameRoot: state.gameRoot(),
      ct,
    })
  )

  const createExecutableBlockedReason = createMemo(
    () => createExecutableValidationErrors()[0] ?? ''
  )

  const statusTone = createMemo<StatusTone>(() => {
    const text = state.statusMessage().toLowerCase()
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
      state.heroImageSearchCacheGameName() === key &&
      state.heroImageSearchCacheGameId() !== null &&
      state.heroImageSearchCandidates().length > 1
    )
  })

  return {
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
    canSearchAnotherHeroImage,
  }
}
