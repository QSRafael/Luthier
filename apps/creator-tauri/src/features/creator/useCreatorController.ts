import { createEffect, createMemo, createSignal } from 'solid-js'

import { invokeCommand, pickFile, pickFolder } from '../../api/tauri'
import type { SelectOption } from '../../components/form/FormControls'
import { detectLocale, Locale, translate } from '../../i18n'
import {
  CreatorTab,
  defaultGameConfig,
  FeatureState,
  GameConfig,
  RuntimePreference,
  RuntimePrimary
} from '../../models/config'

const ORCHESTRATOR_BASE_PATH = './target/debug/orchestrator'

const RUNTIME_CANDIDATES: RuntimePrimary[] = ['ProtonUmu', 'ProtonNative', 'Wine']
const RUNTIME_PREFERENCES: RuntimePreference[] = ['Auto', 'Proton', 'Wine']
const DLL_MODES = ['builtin', 'native', 'builtin,native', 'native,builtin', 'disabled'] as const
const AUDIO_DRIVERS = ['__none__', 'pipewire', 'pulseaudio', 'alsa'] as const
const UPSCALE_METHODS = ['fsr', 'nis', 'integer', 'stretch'] as const
const WINDOW_TYPES = ['fullscreen', 'borderless', 'windowed'] as const

type AudioDriverOption = (typeof AUDIO_DRIVERS)[number]
type UpscaleMethod = (typeof UPSCALE_METHODS)[number]
type GamescopeWindowType = (typeof WINDOW_TYPES)[number]

type WinetricksAvailableOutput = {
  source: string
  components: string[]
}

type StatusTone = 'info' | 'success' | 'error'

function replaceAt<T>(items: T[], index: number, next: T): T[] {
  return items.map((item, current) => (current === index ? next : item))
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, current) => current !== index)
}

function splitCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function joinCommaList(items: string[]): string {
  return items.join(', ')
}

function normalizePath(raw: string): string {
  return raw.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

function dirname(raw: string): string {
  const normalized = normalizePath(raw)
  const index = normalized.lastIndexOf('/')
  if (index <= 0) return normalized
  return normalized.slice(0, index)
}

function basename(raw: string): string {
  const normalized = normalizePath(raw)
  const index = normalized.lastIndexOf('/')
  if (index < 0) return normalized
  return normalized.slice(index + 1)
}

function relativeFromRoot(root: string, path: string): string | null {
  const normalizedRoot = normalizePath(root)
  const normalizedPath = normalizePath(path)

  if (!normalizedRoot || !normalizedPath) return null
  if (normalizedPath === normalizedRoot) return '.'
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1)
  }

  return null
}

function isFeatureEnabled(state: FeatureState): boolean {
  return state === 'MandatoryOn' || state === 'OptionalOn'
}

export function useCreatorController() {
  const initialLocale = detectLocale()
  const [locale, setLocale] = createSignal<Locale>(initialLocale)
  const [activeTab, setActiveTab] = createSignal<CreatorTab>('game')

  const [outputPath, setOutputPath] = createSignal('./tmp/game-orchestrator')
  const [gameRoot, setGameRoot] = createSignal('./tmp')
  const [exePath, setExePath] = createSignal('')
  const [registryImportPath, setRegistryImportPath] = createSignal('')
  const [iconPreviewPath, setIconPreviewPath] = createSignal('')
  const [statusMessage, setStatusMessage] = createSignal(translate(initialLocale, 'statusReady'))
  const [resultJson, setResultJson] = createSignal('')

  const [winetricksAvailable, setWinetricksAvailable] = createSignal<string[]>([])
  const [winetricksLoading, setWinetricksLoading] = createSignal(false)
  const [winetricksSource, setWinetricksSource] = createSignal('fallback')
  const [winetricksSearch, setWinetricksSearch] = createSignal('')
  const [winetricksLoaded, setWinetricksLoaded] = createSignal(false)

  const [config, setConfig] = createSignal<GameConfig>(defaultGameConfig())

  const configPreview = createMemo(() => JSON.stringify(config(), null, 2))
  const t = (key: string) => translate(locale(), key)
  const tx = (pt: string, en: string) => (locale() === 'pt-BR' ? pt : en)

  const tabs: CreatorTab[] = [
    'game',
    'runtime',
    'performance',
    'prefix',
    'winecfg',
    'wrappers',
    'scripts',
    'review'
  ]

  const featureStateOptions = createMemo<SelectOption<FeatureState>[]>(() => [
    {
      value: 'MandatoryOn',
      label: tx('Obrigatório: Ativado', 'Mandatory: Enabled')
    },
    {
      value: 'MandatoryOff',
      label: tx('Obrigatório: Desativado', 'Mandatory: Disabled')
    },
    {
      value: 'OptionalOn',
      label: tx('Opcional: Ativado', 'Optional: Enabled')
    },
    {
      value: 'OptionalOff',
      label: tx('Opcional: Desativado', 'Optional: Disabled')
    }
  ])

  const runtimePrimaryOptions = createMemo<SelectOption<RuntimePrimary>[]>(() =>
    RUNTIME_CANDIDATES.map((value) => ({ value, label: value }))
  )

  const runtimePreferenceOptions = createMemo<SelectOption<RuntimePreference>[]>(() =>
    RUNTIME_PREFERENCES.map((value) => ({ value, label: value }))
  )

  const audioDriverOptions = createMemo<SelectOption<AudioDriverOption>[]>(() => [
    {
      value: '__none__',
      label: tx('Padrão do runtime', 'Runtime default')
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
    { value: 'integer', label: tx('Escala Inteira', 'Integer Scaling') },
    { value: 'stretch', label: tx('Esticar imagem', 'Stretch image') }
  ])

  const windowTypeOptions = createMemo<SelectOption<GamescopeWindowType>[]>(() => [
    { value: 'fullscreen', label: tx('Tela cheia', 'Fullscreen') },
    { value: 'borderless', label: tx('Sem borda', 'Borderless') },
    { value: 'windowed', label: tx('Janela', 'Windowed') }
  ])

  const prefixPathPreview = createMemo(() => {
    const hash = config().exe_hash.trim() || '<exe_hash>'
    return `~/.local/share/GameOrchestrator/prefixes/${hash}/`
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

  const patchConfig = (updater: (prev: GameConfig) => GameConfig) => {
    setConfig((prev) => updater(prev))
  }

  createEffect(() => {
    localStorage.setItem('creator.locale', locale())
  })

  createEffect(() => {
    const currentExePath = exePath().trim()
    if (!currentExePath) return

    const detectedRoot = dirname(currentExePath)
    if (!detectedRoot || detectedRoot === currentExePath) return

    if (gameRoot() !== detectedRoot) {
      setGameRoot(detectedRoot)
    }

    const relative = relativeFromRoot(detectedRoot, currentExePath)
    const nextRelativePath = relative ? `./${relative}` : `./${basename(currentExePath)}`
    if (config().relative_exe_path !== nextRelativePath) {
      patchConfig((prev) => ({ ...prev, relative_exe_path: nextRelativePath }))
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

  createEffect(() => {
    if (activeTab() === 'prefix' && !winetricksLoaded()) {
      void loadWinetricksCatalog()
    }
  })

  const runHash = async () => {
    if (!exePath().trim()) {
      setStatusMessage(tx('Selecione um executável antes de calcular hash.', 'Select an executable before hashing.'))
      return
    }

    try {
      setStatusMessage(t('msgHashStart'))
      const result = await invokeCommand<{ sha256_hex: string }>('cmd_hash_executable', {
        executable_path: exePath()
      })
      patchConfig((prev) => ({ ...prev, exe_hash: result.sha256_hex }))
      setStatusMessage(t('msgHashOk'))
    } catch (error) {
      setStatusMessage(`${t('msgHashFail')} ${String(error)}`)
    }
  }

  const runTest = async () => {
    try {
      setStatusMessage(t('msgTestStart'))
      const result = await invokeCommand<unknown>('cmd_test_configuration', {
        config_json: configPreview(),
        game_root: gameRoot()
      })
      setResultJson(JSON.stringify(result, null, 2))
      setStatusMessage(t('msgTestOk'))
    } catch (error) {
      setStatusMessage(`${t('msgTestFail')} ${String(error)}`)
    }
  }

  const runCreate = async () => {
    try {
      setStatusMessage(t('msgCreateStart'))
      const result = await invokeCommand<unknown>('cmd_create_executable', {
        base_binary_path: ORCHESTRATOR_BASE_PATH,
        output_path: outputPath(),
        config_json: configPreview(),
        backup_existing: true,
        make_executable: true
      })
      setResultJson(JSON.stringify(result, null, 2))
      setStatusMessage(t('msgCreateOk'))
    } catch (error) {
      setStatusMessage(`${t('msgCreateFail')} ${String(error)}`)
    }
  }

  const loadWinetricksCatalog = async () => {
    try {
      setWinetricksLoading(true)
      const result = await invokeCommand<WinetricksAvailableOutput>('cmd_winetricks_available')
      setWinetricksAvailable(result.components)
      setWinetricksSource(result.source)
      setWinetricksLoaded(true)
      setStatusMessage(
        tx(
          `Catálogo Winetricks carregado (${result.components.length} itens).`,
          `Winetricks catalog loaded (${result.components.length} items).`
        )
      )
    } catch (error) {
      setWinetricksAvailable([])
      setWinetricksSource('fallback')
      setWinetricksLoaded(true)
      setStatusMessage(
        tx(
          `Falha ao carregar catálogo Winetricks: ${String(error)}`,
          `Failed to load Winetricks catalog: ${String(error)}`
        )
      )
    } finally {
      setWinetricksLoading(false)
    }
  }

  const pickExecutable = async () => {
    const selected = await pickFile({
      title: tx('Selecionar executável do jogo', 'Select game executable'),
      filters: [{ name: 'Windows Executable', extensions: ['exe'] }]
    })
    if (!selected) return

    setExePath(selected)
    const detectedRoot = dirname(selected)
    setGameRoot(detectedRoot)

    const relative = relativeFromRoot(detectedRoot, selected)

    patchConfig((prev) => ({
      ...prev,
      relative_exe_path: relative ? `./${relative}` : `./${basename(selected)}`
    }))
  }

  const pickRegistryFile = async () => {
    const selected = await pickFile({
      title: tx('Selecionar arquivo .reg', 'Select .reg file'),
      filters: [{ name: 'Registry file', extensions: ['reg'] }]
    })
    if (!selected) return
    setRegistryImportPath(selected)
  }

  const pickMountFolder = async (index: number) => {
    const selected = await pickFolder({
      title: tx('Selecionar pasta para montar', 'Select folder to mount')
    })
    if (!selected) return

    const relative = relativeFromRoot(gameRoot(), selected)
    if (!relative) {
      setStatusMessage(
        tx(
          'A pasta selecionada precisa estar dentro da pasta raiz do jogo.',
          'Selected folder must be inside game root folder.'
        )
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

  const applyIconExtractionPlaceholder = () => {
    setStatusMessage(
      tx(
        'Extração de ícone será conectada ao backend na próxima etapa funcional.',
        'Icon extraction will be wired to backend in the next functional step.'
      )
    )
    if (!iconPreviewPath()) {
      setIconPreviewPath('')
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
        tx(
          'Digite ao menos 2 caracteres e selecione um verbo válido do catálogo.',
          'Type at least 2 characters and select a valid catalog verb.'
        )
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
    exePath,
    setExePath,
    registryImportPath,
    setRegistryImportPath,
    iconPreviewPath,
    setIconPreviewPath,
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
    config,
    patchConfig,
    configPreview,
    t,
    tx,
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
    pickRegistryFile,
    pickMountFolder,
    applyIconExtractionPlaceholder,
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
