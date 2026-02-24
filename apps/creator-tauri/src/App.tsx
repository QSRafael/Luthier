import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'

import { invokeCommand, pickFile, pickFolder } from './api/tauri'
import {
  FieldShell,
  KeyValueItem,
  KeyValueListField,
  SelectField,
  SelectOption,
  StringListField,
  TextAreaField,
  TextInputField,
  ToggleField
} from './components/form/FormControls'
import { detectLocale, Locale, translate } from './i18n'
import {
  CreatorTab,
  defaultGameConfig,
  FeatureState,
  GameConfig,
  RuntimePreference,
  RuntimePrimary
} from './models/config'

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

export default function App() {
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

  const tabLabel = (tab: CreatorTab) => {
    if (tab === 'game') return tx('Jogo', 'Game')
    if (tab === 'runtime') return tx('Runtime', 'Runtime')
    if (tab === 'performance') return tx('Performance e Compatibilidade', 'Performance and Compatibility')
    if (tab === 'prefix') return tx('Prefixo e Dependências', 'Prefix and Dependencies')
    if (tab === 'winecfg') return 'Winecfg'
    if (tab === 'wrappers') return tx('Wrappers e Ambiente', 'Wrappers and Environment')
    if (tab === 'scripts') return tx('Scripts', 'Scripts')
    return tx('Revisão e Gerar', 'Review and Generate')
  }

  const patchConfig = (updater: (prev: GameConfig) => GameConfig) => {
    setConfig((prev) => updater(prev))
  }

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

  const environmentVarsAsList = createMemo<KeyValueItem[]>(() =>
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

  const updateCustomVars = (items: KeyValueItem[]) => {
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

  const payloadSummary = createMemo(() => ({
    launchArgs: config().launch_args.length,
    integrityFiles: config().integrity_files.length,
    winetricks: config().dependencies.length,
    registry: config().registry_keys.length,
    mounts: config().folder_mounts.length,
    wrappers: config().compatibility.wrapper_commands.length,
    envVars: Object.keys(config().environment.custom_vars).length
  }))

  return (
    <div class="app-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">{tx('Game Orchestrator Creator', 'Game Orchestrator Creator')}</p>
          <h1>
            {tx(
              'Configuração visual completa do App Criador',
              'Full visual configuration for Creator App'
            )}
          </h1>
          <p class="subtitle">
            {tx(
              'Abas completas com foco em simplicidade, mas mantendo as opções avançadas.',
              'Complete tabs focused on simplicity while keeping advanced options.'
            )}
          </p>
        </div>

        <div class="status-column">
          <label class="locale-switch">
            <span>{t('language')}</span>
            <select value={locale()} onInput={(e) => setLocale(e.currentTarget.value as Locale)}>
              <option value="pt-BR">pt-BR</option>
              <option value="en-US">en-US</option>
            </select>
          </label>
          <div class="status-badge">{statusMessage()}</div>
        </div>
      </header>

      <nav class="tabs">
        <For each={tabs}>
          {(tab) => (
            <button
              classList={{ tab: true, active: activeTab() === tab }}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tabLabel(tab)}
            </button>
          )}
        </For>
      </nav>

      <main class="panel">
        <Show when={activeTab() === 'game'}>
          <section class="stack">
            <TextInputField
              label={tx('Nome do jogo', 'Game name')}
              help={tx('Nome mostrado na splash e no banco local.', 'Name shown in splash and local database.')}
              value={config().game_name}
              onInput={(value) => patchConfig((prev) => ({ ...prev, game_name: value }))}
            />

            <FieldShell
              label={tx('Executável principal (.exe)', 'Main executable (.exe)')}
              help={tx(
                'Use o picker para selecionar o .exe real do jogo.',
                'Use picker to select the real game executable.'
              )}
            >
              <div class="picker-row">
                <input value={exePath()} placeholder="/home/user/Games/MyGame/game.exe" onInput={(e) => setExePath(e.currentTarget.value)} />
                <button type="button" class="btn-secondary" onClick={pickExecutable}>
                  {tx('Selecionar arquivo', 'Select file')}
                </button>
              </div>
            </FieldShell>

            <FieldShell
              label={tx('Pasta raiz do jogo', 'Game root folder')}
              help={tx(
                'Derivada automaticamente da pasta do executável selecionado.',
                'Automatically derived from selected executable folder.'
              )}
              hint={tx(
                'Não é necessário selecionar pasta manualmente: ela vem do caminho do .exe.',
                'No manual folder picker is needed: this comes from the .exe path.'
              )}
            >
              <input value={gameRoot()} placeholder="/home/user/Games/MyGame" readOnly class="readonly" />
            </FieldShell>

            <TextInputField
              label={tx('Path relativo do exe no payload', 'Relative exe path in payload')}
              help={tx(
                'Sempre relativo ao orquestrador, por exemplo ./game.exe.',
                'Always relative to orchestrator, for example ./game.exe.'
              )}
              value={config().relative_exe_path}
              onInput={(value) => patchConfig((prev) => ({ ...prev, relative_exe_path: value }))}
            />

            <TextInputField
              label={tx('Hash SHA-256', 'SHA-256 hash')}
              help={tx(
                'Identificador principal para perfil e prefixo por jogo.',
                'Main identifier for profile and per-game prefix.'
              )}
              value={config().exe_hash}
              onInput={(value) => patchConfig((prev) => ({ ...prev, exe_hash: value }))}
            />

            <div class="row-actions">
              <button type="button" class="btn-secondary" onClick={runHash}>
                {t('hashButton')}
              </button>
            </div>

            <FieldShell
              label={tx('Ícone extraído', 'Extracted icon')}
              help={tx(
                'Preview do ícone do jogo para facilitar identificação visual.',
                'Game icon preview for easier visual identification.'
              )}
              hint={tx(
                'Visual pronto. A extração real será conectada ao backend na próxima etapa.',
                'Visual is ready. Real extraction will be wired to backend next.'
              )}
            >
              <div class="icon-preview">
                <div class="icon-box">
                  <Show when={iconPreviewPath()} fallback={<span>{tx('Sem ícone extraído', 'No extracted icon')}</span>}>
                    <img src={iconPreviewPath()} alt="icon preview" />
                  </Show>
                </div>
                <button type="button" class="btn-secondary" onClick={applyIconExtractionPlaceholder}>
                  {tx('Extrair ícone', 'Extract icon')}
                </button>
              </div>
            </FieldShell>

            <StringListField
              label={tx('Argumentos de launch', 'Launch arguments')}
              help={tx('Argumentos extras passados para o exe do jogo.', 'Extra arguments passed to game executable.')}
              items={config().launch_args}
              onChange={(items) => patchConfig((prev) => ({ ...prev, launch_args: items }))}
              placeholder={tx('-windowed', '-windowed')}
              addLabel={tx('Adicionar argumento', 'Add argument')}
            />

            <StringListField
              label={tx('Arquivos obrigatórios (integrity_files)', 'Required files (integrity_files)')}
              help={tx('Se algum item faltar, o launch é bloqueado.', 'If any item is missing, launch is blocked.')}
              items={config().integrity_files}
              onChange={(items) => patchConfig((prev) => ({ ...prev, integrity_files: items }))}
              placeholder={tx('./data/core.dll', './data/core.dll')}
              addLabel={tx('Adicionar arquivo', 'Add file')}
            />
          </section>
        </Show>

        <Show when={activeTab() === 'runtime'}>
          <section class="stack">
            <SelectField<RuntimePreference>
              label={tx('Preferência geral de runtime', 'General runtime preference')}
              help={tx('Prioridade macro entre Auto, Proton e Wine.', 'Macro priority among Auto, Proton and Wine.')}
              value={config().runner.runtime_preference}
              options={runtimePreferenceOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  runner: {
                    ...prev.runner,
                    runtime_preference: value
                  }
                }))
              }
            />

            <ToggleField
              label={tx('Runtime estrito', 'Strict runtime')}
              help={tx(
                'Quando ativo, só o runtime primário é aceito (sem fallback).',
                'When enabled, only primary runtime is accepted (no fallback).'
              )}
              checked={config().requirements.runtime.strict}
              onChange={(checked) =>
                patchConfig((prev) => ({
                  ...prev,
                  requirements: {
                    ...prev.requirements,
                    runtime: {
                      ...prev.requirements.runtime,
                      strict: checked
                    }
                  }
                }))
              }
            />

            <SelectField<RuntimePrimary>
              label={tx('Runtime primário', 'Primary runtime')}
              help={tx('Primeiro candidato de execução do jogo.', 'First runtime candidate for launch.')}
              value={config().requirements.runtime.primary}
              options={runtimePrimaryOptions()}
              onChange={setRuntimePrimary}
            />

            <FieldShell
              label={tx('Ordem de fallback', 'Fallback order')}
              help={tx(
                'Adicione candidatos e mova a ordem manualmente.',
                'Add candidates and move order manually.'
              )}
            >
              <div class="table-list">
                <For each={availableFallbackCandidates()}>
                  {(candidate) => {
                    const inFallback = runtimeFallbackOrder().includes(candidate)
                    return (
                      <div class="table-row table-row-fallback">
                        <span>{candidate}</span>
                        <div class="row-actions">
                          <Show
                            when={inFallback}
                            fallback={
                              <button type="button" class="btn-secondary" onClick={() => addFallbackCandidate(candidate)}>
                                {tx('Adicionar', 'Add')}
                              </button>
                            }
                          >
                            <button type="button" class="btn-danger" onClick={() => removeFallbackCandidate(candidate)}>
                              {tx('Remover', 'Remove')}
                            </button>
                          </Show>
                        </div>
                      </div>
                    )
                  }}
                </For>

                <For each={runtimeFallbackOrder()}>
                  {(candidate, index) => (
                    <div class="table-row table-row-fallback">
                      <span>{candidate}</span>
                      <div class="row-actions">
                        <button type="button" class="btn-secondary" onClick={() => moveFallbackCandidate(index(), -1)}>
                          {tx('Subir', 'Up')}
                        </button>
                        <button type="button" class="btn-secondary" onClick={() => moveFallbackCandidate(index(), 1)}>
                          {tx('Descer', 'Down')}
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </FieldShell>

            <TextInputField
              label={tx('Versão do Proton', 'Proton version')}
              help={tx(
                'Versão alvo do Proton quando runtime selecionado usar Proton.',
                'Target Proton version when selected runtime uses Proton.'
              )}
              value={config().runner.proton_version}
              onInput={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  runner: {
                    ...prev.runner,
                    proton_version: value
                  }
                }))
              }
            />

            <ToggleField
              label={tx('Auto update do runner', 'Runner auto update')}
              help={tx(
                'Mantém metadados de runner atualizados quando aplicável.',
                'Keeps runner metadata updated when applicable.'
              )}
              checked={config().runner.auto_update}
              onChange={(checked) =>
                patchConfig((prev) => ({
                  ...prev,
                  runner: {
                    ...prev.runner,
                    auto_update: checked
                  }
                }))
              }
            />

            <ToggleField
              label="ESYNC"
              help={tx('Ativa otimizações de sincronização no runtime.', 'Enables synchronization optimizations in runtime.')}
              checked={config().runner.esync}
              onChange={(checked) =>
                patchConfig((prev) => ({
                  ...prev,
                  runner: {
                    ...prev.runner,
                    esync: checked
                  }
                }))
              }
            />

            <ToggleField
              label="FSYNC"
              help={tx('Ativa otimizações FSYNC quando suportado.', 'Enables FSYNC optimizations when supported.')}
              checked={config().runner.fsync}
              onChange={(checked) =>
                patchConfig((prev) => ({
                  ...prev,
                  runner: {
                    ...prev.runner,
                    fsync: checked
                  }
                }))
              }
            />

            <SelectField<FeatureState>
              label="UMU"
              help={tx(
                'Controla uso de umu-run conforme política de obrigatoriedade.',
                'Controls umu-run usage according to enforcement policy.'
              )}
              value={config().requirements.umu}
              options={featureStateOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  requirements: {
                    ...prev.requirements,
                    umu: value
                  }
                }))
              }
            />

            <SelectField<FeatureState>
              label={tx('Steam Runtime', 'Steam Runtime')}
              help={tx(
                'Define se steam runtime é obrigatório, opcional ou bloqueado.',
                'Defines whether steam runtime is mandatory, optional or blocked.'
              )}
              value={config().requirements.steam_runtime}
              options={featureStateOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  requirements: {
                    ...prev.requirements,
                    steam_runtime: value
                  }
                }))
              }
            />

            <SelectField<FeatureState>
              label="Easy AntiCheat Runtime"
              help={tx('Política para runtime local do Easy AntiCheat.', 'Policy for local Easy AntiCheat runtime.')}
              value={config().compatibility.easy_anti_cheat_runtime}
              options={featureStateOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    easy_anti_cheat_runtime: value
                  }
                }))
              }
            />

            <SelectField<FeatureState>
              label="BattleEye Runtime"
              help={tx('Política para runtime local do BattleEye.', 'Policy for local BattleEye runtime.')}
              value={config().compatibility.battleye_runtime}
              options={featureStateOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    battleye_runtime: value
                  }
                }))
              }
            />

            <FieldShell
              label={tx('Dependências extras do sistema', 'Extra system dependencies')}
              help={tx(
                'Dependências adicionais verificadas no doctor por comando/env/path.',
                'Additional dependencies validated in doctor by command/env/path.'
              )}
            >
              <div class="table-list">
                <For each={config().extra_system_dependencies}>
                  {(item, index) => (
                    <div class="table-card">
                      <div class="table-grid table-grid-two">
                        <input
                          value={item.name}
                          placeholder={tx('Nome da dependência', 'Dependency name')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              extra_system_dependencies: replaceAt(prev.extra_system_dependencies, index(), {
                                ...prev.extra_system_dependencies[index()],
                                name: e.currentTarget.value
                              })
                            }))
                          }
                        />
                        <select
                          value={item.state}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              extra_system_dependencies: replaceAt(prev.extra_system_dependencies, index(), {
                                ...prev.extra_system_dependencies[index()],
                                state: e.currentTarget.value as FeatureState
                              })
                            }))
                          }
                        >
                          <For each={featureStateOptions()}>
                            {(option) => <option value={option.value}>{option.label}</option>}
                          </For>
                        </select>
                      </div>

                      <div class="table-grid table-grid-three">
                        <input
                          value={joinCommaList(item.check_commands)}
                          placeholder={tx('Comandos (vulkaninfo, mangohud)', 'Commands (vulkaninfo, mangohud)')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              extra_system_dependencies: replaceAt(prev.extra_system_dependencies, index(), {
                                ...prev.extra_system_dependencies[index()],
                                check_commands: splitCommaList(e.currentTarget.value)
                              })
                            }))
                          }
                        />
                        <input
                          value={joinCommaList(item.check_env_vars)}
                          placeholder={tx('Variáveis (VAR_A, VAR_B)', 'Env vars (VAR_A, VAR_B)')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              extra_system_dependencies: replaceAt(prev.extra_system_dependencies, index(), {
                                ...prev.extra_system_dependencies[index()],
                                check_env_vars: splitCommaList(e.currentTarget.value)
                              })
                            }))
                          }
                        />
                        <input
                          value={joinCommaList(item.check_paths)}
                          placeholder={tx('Paths padrão (/usr/bin/x)', 'Default paths (/usr/bin/x)')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              extra_system_dependencies: replaceAt(prev.extra_system_dependencies, index(), {
                                ...prev.extra_system_dependencies[index()],
                                check_paths: splitCommaList(e.currentTarget.value)
                              })
                            }))
                          }
                        />
                      </div>

                      <button
                        type="button"
                        class="btn-danger"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            extra_system_dependencies: removeAt(prev.extra_system_dependencies, index())
                          }))
                        }
                      >
                        {tx('Remover dependência', 'Remove dependency')}
                      </button>
                    </div>
                  )}
                </For>

                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() =>
                    patchConfig((prev) => ({
                      ...prev,
                      extra_system_dependencies: [
                        ...prev.extra_system_dependencies,
                        {
                          name: '',
                          state: 'OptionalOff',
                          check_commands: [],
                          check_env_vars: [],
                          check_paths: []
                        }
                      ]
                    }))
                  }
                >
                  {tx('Adicionar dependência extra', 'Add extra dependency')}
                </button>
              </div>
            </FieldShell>
          </section>
        </Show>

        <Show when={activeTab() === 'performance'}>
          <section class="stack">
            <SelectField<FeatureState>
              label="Gamescope"
              help={tx(
                'Define política do gamescope e sincroniza com requirements.gamescope.',
                'Defines gamescope policy and syncs with requirements.gamescope.'
              )}
              value={config().environment.gamescope.state}
              options={featureStateOptions()}
              onChange={setGamescopeState}
            />

            <Show when={gamescopeEnabled()} fallback={<div class="info-card"><span>{tx('Gamescope está desativado. Ative para configurar resolução, upscale e janela.', 'Gamescope is disabled. Enable it to configure resolution, upscale and window mode.')}</span></div>}>
              <SelectField<UpscaleMethod>
                label={tx('Método de upscale', 'Upscale method')}
                help={tx('Método usado pelo gamescope para upscale.', 'Method used by gamescope for upscaling.')}
                value={config().environment.gamescope.upscale_method}
                options={upscaleMethodOptions()}
                onChange={(value) =>
                  patchConfig((prev) => ({
                    ...prev,
                    environment: {
                      ...prev.environment,
                      gamescope: {
                        ...prev.environment.gamescope,
                        upscale_method: value,
                        fsr: value === 'fsr'
                      }
                    }
                  }))
                }
              />

              <div class="table-grid table-grid-two">
                <TextInputField
                  label={tx('Resolução do jogo - largura', 'Game resolution - width')}
                  help={tx('Largura renderizada pelo jogo.', 'Width rendered by the game.')}
                  value={config().environment.gamescope.game_width}
                  onInput={(value) =>
                    patchConfig((prev) => ({
                      ...prev,
                      environment: {
                        ...prev.environment,
                        gamescope: {
                          ...prev.environment.gamescope,
                          game_width: value
                        }
                      }
                    }))
                  }
                />

                <TextInputField
                  label={tx('Resolução do jogo - altura', 'Game resolution - height')}
                  help={tx('Altura renderizada pelo jogo.', 'Height rendered by the game.')}
                  value={config().environment.gamescope.game_height}
                  onInput={(value) =>
                    patchConfig((prev) => ({
                      ...prev,
                      environment: {
                        ...prev.environment,
                        gamescope: {
                          ...prev.environment.gamescope,
                          game_height: value
                        }
                      }
                    }))
                  }
                />
              </div>

              <div class="table-grid table-grid-two">
                <TextInputField
                  label={tx('Resolução da tela - largura', 'Display resolution - width')}
                  help={tx('Largura final de saída do gamescope.', 'Final output width from gamescope.')}
                  value={config().environment.gamescope.output_width}
                  onInput={(value) =>
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
                />

                <TextInputField
                  label={tx('Resolução da tela - altura', 'Display resolution - height')}
                  help={tx('Altura final de saída do gamescope.', 'Final output height from gamescope.')}
                  value={config().environment.gamescope.output_height}
                  onInput={(value) =>
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
                />
              </div>

              <SelectField<GamescopeWindowType>
                label={tx('Tipo de janela', 'Window type')}
                help={tx('Define comportamento da janela no gamescope.', 'Defines gamescope window behavior.')}
                value={config().environment.gamescope.window_type}
                options={windowTypeOptions()}
                onChange={(value) =>
                  patchConfig((prev) => ({
                    ...prev,
                    environment: {
                      ...prev.environment,
                      gamescope: {
                        ...prev.environment.gamescope,
                        window_type: value
                      }
                    }
                  }))
                }
              />

              <ToggleField
                label={tx('Limitar FPS', 'Enable FPS limiter')}
                help={tx('Ativa limitador de FPS do gamescope.', 'Enables gamescope FPS limiter.')}
                checked={config().environment.gamescope.enable_limiter}
                onChange={(checked) =>
                  patchConfig((prev) => ({
                    ...prev,
                    environment: {
                      ...prev.environment,
                      gamescope: {
                        ...prev.environment.gamescope,
                        enable_limiter: checked
                      }
                    }
                  }))
                }
              />

              <Show when={config().environment.gamescope.enable_limiter}>
                <div class="table-grid table-grid-two">
                  <TextInputField
                    label={tx('FPS limite', 'FPS limit')}
                    help={tx('Limite de FPS quando o jogo está em foco.', 'FPS limit when game is focused.')}
                    value={config().environment.gamescope.fps_limiter}
                    onInput={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        environment: {
                          ...prev.environment,
                          gamescope: {
                            ...prev.environment.gamescope,
                            fps_limiter: value
                          }
                        }
                      }))
                    }
                  />

                  <TextInputField
                    label={tx('FPS sem foco', 'FPS limit without focus')}
                    help={tx('Limite de FPS quando o jogo perde foco.', 'FPS limit when game loses focus.')}
                    value={config().environment.gamescope.fps_limiter_no_focus}
                    onInput={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        environment: {
                          ...prev.environment,
                          gamescope: {
                            ...prev.environment.gamescope,
                            fps_limiter_no_focus: value
                          }
                        }
                      }))
                    }
                  />
                </div>
              </Show>

              <ToggleField
                label={tx('Forçar captura de cursor', 'Force grab cursor')}
                help={tx('Força modo relativo de mouse para evitar perda de foco.', 'Forces relative mouse mode to avoid focus loss.')}
                checked={config().environment.gamescope.force_grab_cursor}
                onChange={(checked) =>
                  patchConfig((prev) => ({
                    ...prev,
                    environment: {
                      ...prev.environment,
                      gamescope: {
                        ...prev.environment.gamescope,
                        force_grab_cursor: checked
                      }
                    }
                  }))
                }
              />

              <TextInputField
                label={tx('Opções adicionais do gamescope', 'Gamescope additional options')}
                help={tx('Flags extras adicionadas ao comando do gamescope.', 'Extra flags appended to gamescope command.')}
                value={config().environment.gamescope.additional_options}
                onInput={(value) =>
                  patchConfig((prev) => ({
                    ...prev,
                    environment: {
                      ...prev.environment,
                      gamescope: {
                        ...prev.environment.gamescope,
                        additional_options: value
                      }
                    }
                  }))
                }
              />
            </Show>

            <SelectField<FeatureState>
              label="Gamemode"
              help={tx('Define política do gamemode.', 'Defines gamemode policy.')}
              value={config().environment.gamemode}
              options={featureStateOptions()}
              onChange={setGamemodeState}
            />

            <SelectField<FeatureState>
              label="MangoHud"
              help={tx('Define política do MangoHud.', 'Defines MangoHud policy.')}
              value={config().environment.mangohud}
              options={featureStateOptions()}
              onChange={setMangohudState}
            />

            <SelectField<FeatureState>
              label="Wine-Wayland"
              help={tx('Política para ativar Wine-Wayland.', 'Policy for enabling Wine-Wayland.')}
              value={config().compatibility.wine_wayland}
              options={featureStateOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    wine_wayland: value
                  }
                }))
              }
            />

            <SelectField<FeatureState>
              label="HDR"
              help={tx('Política para HDR (depende de Wine-Wayland).', 'Policy for HDR (depends on Wine-Wayland).')}
              value={config().compatibility.hdr}
              options={featureStateOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    hdr: value
                  }
                }))
              }
            />

            <SelectField<FeatureState>
              label="Auto DXVK-NVAPI"
              help={tx('Controla aplicação automática de DXVK-NVAPI.', 'Controls automatic DXVK-NVAPI setup.')}
              value={config().compatibility.auto_dxvk_nvapi}
              options={featureStateOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    auto_dxvk_nvapi: value
                  }
                }))
              }
            />

            <SelectField<FeatureState>
              label="Staging"
              help={tx('Controla obrigatoriedade de runtime Wine com staging.', 'Controls mandatory usage of Wine staging runtime.')}
              value={config().compatibility.staging}
              options={featureStateOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    staging: value
                  }
                }))
              }
            />

            <ToggleField
              label={tx('Prime Offload', 'Prime Offload')}
              help={tx('Ativa variáveis para offload de GPU dedicada.', 'Enables dedicated GPU offload variables.')}
              checked={config().environment.prime_offload}
              onChange={(checked) =>
                patchConfig((prev) => ({
                  ...prev,
                  environment: {
                    ...prev.environment,
                    prime_offload: checked
                  }
                }))
              }
            />
          </section>
        </Show>

        <Show when={activeTab() === 'prefix'}>
          <section class="stack">
            <TextInputField
              label={tx('Prefix path final', 'Final prefix path')}
              help={tx('Calculado automaticamente a partir do hash do executável.', 'Automatically calculated from executable hash.')}
              value={prefixPathPreview()}
              onInput={() => undefined}
              readonly
            />

            <FieldShell
              label="Winetricks"
              help={tx(
                'Ativa automaticamente quando existir ao menos um verbo configurado.',
                'Enabled automatically when at least one verb is configured.'
              )}
            >
              <div class="info-card">
                <span>
                  {tx('Estado atual:', 'Current state:')} <strong>{config().requirements.winetricks}</strong>
                </span>
              </div>
            </FieldShell>

            <FieldShell
              label={tx('Lista de verbos Winetricks', 'Winetricks verbs list')}
              help={tx(
                'Selecione da lista de componentes disponíveis (modelo Heroic).',
                'Select from available components list (Heroic-like model).'
              )}
            >
              <div class="table-list">
                <div class="winetricks-toolbar">
                  <input
                    value={winetricksSearch()}
                    placeholder={tx('Digite para buscar (ex.: vcrun, corefonts)', 'Type to search (e.g. vcrun, corefonts)')}
                    onInput={(e) => setWinetricksSearch(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addWinetricksFromSearch()
                      }
                    }}
                  />
                  <button type="button" class="btn-secondary" onClick={addWinetricksFromSearch}>
                    {tx('Adicionar', 'Add')}
                  </button>
                  <button type="button" class="btn-secondary" onClick={loadWinetricksCatalog} disabled={winetricksLoading()}>
                    {winetricksLoading() ? tx('Carregando...', 'Loading...') : tx('Atualizar catálogo', 'Refresh catalog')}
                  </button>
                </div>

                <div class="info-card">
                  <span>
                    {tx('Fonte do catálogo:', 'Catalog source:')} <strong>{winetricksSource()}</strong>
                  </span>
                  <span>
                    {tx('Itens no catálogo:', 'Catalog items:')} <strong>{winetricksAvailable().length}</strong>
                  </span>
                  <span>
                    {tx('Resultados atuais:', 'Current matches:')} <strong>{winetricksCandidates().length}</strong>
                  </span>
                </div>

                <Show
                  when={normalizedWinetricksSearch().length >= 2}
                  fallback={
                    <div class="info-card">
                      {tx(
                        'Digite ao menos 2 caracteres para buscar verbos e evitar travamentos na UI.',
                        'Type at least 2 characters to search verbs and keep UI responsive.'
                      )}
                    </div>
                  }
                >
                  <div class="winetricks-results">
                    <For each={winetricksCandidates()}>
                      {(verb) => (
                        <button type="button" class="winetricks-result" onClick={() => addWinetricksVerb(verb)}>
                          <span>{verb}</span>
                          <span>{tx('Adicionar', 'Add')}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                <div class="table-list">
                  <For each={config().dependencies}>
                    {(verb) => (
                      <div class="table-row table-row-single">
                        <input value={verb} readOnly class="readonly" />
                        <button type="button" class="btn-danger" onClick={() => removeWinetricksVerb(verb)}>
                          {tx('Remover', 'Remove')}
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </FieldShell>

            <FieldShell
              label={tx('Chaves de registro', 'Registry keys')}
              help={tx('Tabela de chaves aplicadas no prefixo após bootstrap.', 'Table of keys applied to prefix after bootstrap.')}
            >
              <div class="table-list">
                <For each={config().registry_keys}>
                  {(item, index) => (
                    <div class="table-card">
                      <div class="table-grid table-grid-two">
                        <input
                          value={item.path}
                          placeholder={tx('Path (HKCU\\...)', 'Path (HKCU\\...)')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              registry_keys: replaceAt(prev.registry_keys, index(), {
                                ...prev.registry_keys[index()],
                                path: e.currentTarget.value
                              })
                            }))
                          }
                        />
                        <input
                          value={item.name}
                          placeholder={tx('Nome da chave', 'Key name')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              registry_keys: replaceAt(prev.registry_keys, index(), {
                                ...prev.registry_keys[index()],
                                name: e.currentTarget.value
                              })
                            }))
                          }
                        />
                      </div>

                      <div class="table-grid table-grid-two">
                        <input
                          value={item.value_type}
                          placeholder={tx('Tipo (REG_SZ)', 'Type (REG_SZ)')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              registry_keys: replaceAt(prev.registry_keys, index(), {
                                ...prev.registry_keys[index()],
                                value_type: e.currentTarget.value
                              })
                            }))
                          }
                        />
                        <input
                          value={item.value}
                          placeholder={tx('Valor', 'Value')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              registry_keys: replaceAt(prev.registry_keys, index(), {
                                ...prev.registry_keys[index()],
                                value: e.currentTarget.value
                              })
                            }))
                          }
                        />
                      </div>

                      <button
                        type="button"
                        class="btn-danger"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            registry_keys: removeAt(prev.registry_keys, index())
                          }))
                        }
                      >
                        {tx('Remover chave', 'Remove key')}
                      </button>
                    </div>
                  )}
                </For>

                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() =>
                    patchConfig((prev) => ({
                      ...prev,
                      registry_keys: [...prev.registry_keys, { path: '', name: '', value_type: 'REG_SZ', value: '' }]
                    }))
                  }
                >
                  {tx('Adicionar chave de registro', 'Add registry key')}
                </button>
              </div>
            </FieldShell>

            <FieldShell
              label={tx('Import de .reg', '.reg import')}
              help={tx('Selecione um arquivo .reg para importação futura no setup.', 'Select a .reg file for future setup import.')}
            >
              <div class="picker-row">
                <input value={registryImportPath()} placeholder="./patches/game.reg" onInput={(e) => setRegistryImportPath(e.currentTarget.value)} />
                <button type="button" class="btn-secondary" onClick={pickRegistryFile}>
                  {tx('Selecionar arquivo', 'Select file')}
                </button>
              </div>
            </FieldShell>

            <FieldShell
              label={tx('Pastas montadas (folder_mounts)', 'Mounted folders (folder_mounts)')}
              help={tx('Mapeia pasta relativa do jogo para destino Windows dentro do prefixo.', 'Maps game-relative folder to Windows target path inside prefix.')}
            >
              <div class="table-list">
                <For each={config().folder_mounts}>
                  {(item, index) => (
                    <div class="table-card">
                      <div class="table-grid table-grid-two">
                        <div class="picker-row">
                          <input
                            value={item.source_relative_path}
                            placeholder={tx('Origem relativa (ex.: save)', 'Relative source (e.g. save)')}
                            onInput={(e) =>
                              patchConfig((prev) => ({
                                ...prev,
                                folder_mounts: replaceAt(prev.folder_mounts, index(), {
                                  ...prev.folder_mounts[index()],
                                  source_relative_path: e.currentTarget.value
                                })
                              }))
                            }
                          />
                          <button type="button" class="btn-secondary" onClick={() => void pickMountFolder(index())}>
                            {tx('Escolher pasta', 'Choose folder')}
                          </button>
                        </div>

                        <input
                          value={item.target_windows_path}
                          placeholder={tx('Destino Windows (C:\\users\\...)', 'Windows target (C:\\users\\...)')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              folder_mounts: replaceAt(prev.folder_mounts, index(), {
                                ...prev.folder_mounts[index()],
                                target_windows_path: e.currentTarget.value
                              })
                            }))
                          }
                        />
                      </div>

                      <ToggleField
                        label={tx('Criar origem se estiver ausente', 'Create source if missing')}
                        help={tx('Se ativo, cria pasta de origem automaticamente.', 'When enabled, source folder is created automatically.')}
                        checked={item.create_source_if_missing}
                        onChange={(checked) =>
                          patchConfig((prev) => ({
                            ...prev,
                            folder_mounts: replaceAt(prev.folder_mounts, index(), {
                              ...prev.folder_mounts[index()],
                              create_source_if_missing: checked
                            })
                          }))
                        }
                      />

                      <button
                        type="button"
                        class="btn-danger"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            folder_mounts: removeAt(prev.folder_mounts, index())
                          }))
                        }
                      >
                        {tx('Remover montagem', 'Remove mount')}
                      </button>
                    </div>
                  )}
                </For>

                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() =>
                    patchConfig((prev) => ({
                      ...prev,
                      folder_mounts: [
                        ...prev.folder_mounts,
                        {
                          source_relative_path: '',
                          target_windows_path: '',
                          create_source_if_missing: true
                        }
                      ]
                    }))
                  }
                >
                  {tx('Adicionar montagem', 'Add mount')}
                </button>
              </div>
            </FieldShell>
          </section>
        </Show>

        <Show when={activeTab() === 'winecfg'}>
          <section class="stack">
            <FieldShell
              label={tx('Substituição de DLL', 'DLL overrides')}
              help={tx('Configura overrides por DLL como native/builtin.', 'Configures per-DLL overrides such as native/builtin.')}
            >
              <div class="table-list">
                <For each={config().winecfg.dll_overrides}>
                  {(item, index) => (
                    <div class="table-row table-row-two">
                      <input
                        value={item.dll}
                        placeholder="d3dcompiler_47"
                        onInput={(e) =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              dll_overrides: replaceAt(prev.winecfg.dll_overrides, index(), {
                                ...prev.winecfg.dll_overrides[index()],
                                dll: e.currentTarget.value
                              })
                            }
                          }))
                        }
                      />
                      <select
                        value={item.mode}
                        onInput={(e) =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              dll_overrides: replaceAt(prev.winecfg.dll_overrides, index(), {
                                ...prev.winecfg.dll_overrides[index()],
                                mode: e.currentTarget.value
                              })
                            }
                          }))
                        }
                      >
                        <For each={dllModeOptions()}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                      </select>
                      <button
                        type="button"
                        class="btn-danger"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              dll_overrides: removeAt(prev.winecfg.dll_overrides, index())
                            }
                          }))
                        }
                      >
                        {tx('Remover', 'Remove')}
                      </button>
                    </div>
                  )}
                </For>

                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() =>
                    patchConfig((prev) => ({
                      ...prev,
                      winecfg: {
                        ...prev.winecfg,
                        dll_overrides: [...prev.winecfg.dll_overrides, { dll: '', mode: 'builtin' }]
                      }
                    }))
                  }
                >
                  {tx('Adicionar DLL override', 'Add DLL override')}
                </button>
              </div>
            </FieldShell>

            <SelectField<FeatureState>
              label={tx('Capturar mouse automaticamente', 'Auto capture mouse')}
              help={tx('Equivalente à opção de captura automática do winecfg.', 'Equivalent to winecfg auto capture mouse option.')}
              value={config().winecfg.auto_capture_mouse}
              options={featureStateOptions()}
              onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, auto_capture_mouse: value } }))}
            />

            <SelectField<FeatureState>
              label={tx('Permitir decoração de janelas (WM)', 'Allow window decorations (WM)')}
              help={tx('Controla se o gerenciador de janelas decora janelas do jogo.', 'Controls whether window manager decorates game windows.')}
              value={config().winecfg.window_decorations}
              options={featureStateOptions()}
              onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, window_decorations: value } }))}
            />

            <SelectField<FeatureState>
              label={tx('Permitir controle de janelas (WM)', 'Allow window control (WM)')}
              help={tx('Controla se o WM pode gerenciar posição/estado das janelas.', 'Controls whether WM can manage window position/state.')}
              value={config().winecfg.window_manager_control}
              options={featureStateOptions()}
              onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, window_manager_control: value } }))}
            />

            <SelectField<FeatureState>
              label={tx('Desktop virtual (estado)', 'Virtual desktop (state)')}
              help={tx('Ativa/desativa emulação de desktop virtual no Wine.', 'Enables/disables virtual desktop emulation in Wine.')}
              value={config().winecfg.virtual_desktop.state}
              options={featureStateOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  winecfg: {
                    ...prev.winecfg,
                    virtual_desktop: {
                      ...prev.winecfg.virtual_desktop,
                      state: value
                    }
                  }
                }))
              }
            />

            <TextInputField
              label={tx('Resolução do desktop virtual', 'Virtual desktop resolution')}
              help={tx('Formato sugerido: 1280x720 ou 1920x1080.', 'Suggested format: 1280x720 or 1920x1080.')}
              value={config().winecfg.virtual_desktop.resolution ?? ''}
              onInput={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  winecfg: {
                    ...prev.winecfg,
                    virtual_desktop: {
                      ...prev.winecfg.virtual_desktop,
                      resolution: value.trim() ? value : null
                    }
                  }
                }))
              }
            />

            <SelectField<FeatureState>
              label={tx('Integração com desktop', 'Desktop integration')}
              help={tx('Controla integração Wine com shell/desktop do Linux.', 'Controls Wine integration with Linux shell/desktop.')}
              value={config().winecfg.desktop_integration}
              options={featureStateOptions()}
              onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, desktop_integration: value } }))}
            />

            <FieldShell
              label={tx('Unidades (drives)', 'Drives')}
              help={tx('Mapeia letras de unidade para paths relativos da pasta do jogo.', 'Maps drive letters to relative paths inside game folder.')}
            >
              <div class="info-card">
                <span>
                  <strong>C:</strong> {tx('fixo em drive_c (interno)', 'fixed to drive_c (internal)')}
                </span>
                <span>
                  <strong>Z:</strong> {tx('padrão de compatibilidade (ativado por padrão)', 'compatibility default (enabled by default)')}
                </span>
                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() =>
                    patchConfig((prev) => ({
                      ...prev,
                      winecfg: {
                        ...prev.winecfg,
                        drives: [{ letter: 'Z', source_relative_path: '.', state: 'OptionalOn' }]
                      }
                    }))
                  }
                >
                  {tx('Restaurar padrão de drives', 'Restore default drives')}
                </button>
              </div>

              <div class="table-list">
                <For each={config().winecfg.drives}>
                  {(item, index) => (
                    <div class="table-row table-row-three">
                      <input
                        value={item.letter}
                        placeholder="D"
                        onInput={(e) =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              drives: replaceAt(prev.winecfg.drives, index(), {
                                ...prev.winecfg.drives[index()],
                                letter: e.currentTarget.value
                              })
                            }
                          }))
                        }
                      />
                      <input
                        value={item.source_relative_path}
                        placeholder={tx('Path relativo (ex.: data)', 'Relative path (e.g. data)')}
                        onInput={(e) =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              drives: replaceAt(prev.winecfg.drives, index(), {
                                ...prev.winecfg.drives[index()],
                                source_relative_path: e.currentTarget.value
                              })
                            }
                          }))
                        }
                      />
                      <select
                        value={item.state}
                        onInput={(e) =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              drives: replaceAt(prev.winecfg.drives, index(), {
                                ...prev.winecfg.drives[index()],
                                state: e.currentTarget.value as FeatureState
                              })
                            }
                          }))
                        }
                      >
                        <For each={featureStateOptions()}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                      </select>

                      <button
                        type="button"
                        class="btn-danger"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              drives: removeAt(prev.winecfg.drives, index())
                            }
                          }))
                        }
                      >
                        {tx('Remover', 'Remove')}
                      </button>
                    </div>
                  )}
                </For>

                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() =>
                    patchConfig((prev) => ({
                      ...prev,
                      winecfg: {
                        ...prev.winecfg,
                        drives: [...prev.winecfg.drives, { letter: '', source_relative_path: '', state: 'OptionalOff' }]
                      }
                    }))
                  }
                >
                  {tx('Adicionar unidade', 'Add drive')}
                </button>
              </div>
            </FieldShell>

            <SelectField<AudioDriverOption>
              label={tx('Driver de áudio', 'Audio driver')}
              help={tx('Seleciona backend de áudio preferido no Wine.', 'Selects preferred Wine audio backend.')}
              value={audioDriverValue()}
              options={audioDriverOptions()}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  winecfg: {
                    ...prev.winecfg,
                    audio_driver: value === '__none__' ? null : value
                  }
                }))
              }
            />
          </section>
        </Show>

        <Show when={activeTab() === 'wrappers'}>
          <section class="stack">
            <FieldShell
              label={tx('Wrapper commands', 'Wrapper commands')}
              help={tx('Comandos extras de wrapper antes do runtime final.', 'Extra wrapper commands before final runtime.')}
            >
              <div class="table-list">
                <For each={config().compatibility.wrapper_commands}>
                  {(item, index) => (
                    <div class="table-card">
                      <div class="table-grid table-grid-three">
                        <select
                          value={item.state}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              compatibility: {
                                ...prev.compatibility,
                                wrapper_commands: replaceAt(prev.compatibility.wrapper_commands, index(), {
                                  ...prev.compatibility.wrapper_commands[index()],
                                  state: e.currentTarget.value as FeatureState
                                })
                              }
                            }))
                          }
                        >
                          <For each={featureStateOptions()}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                        </select>
                        <input
                          value={item.executable}
                          placeholder={tx('Executável (ex.: gamescope)', 'Executable (e.g. gamescope)')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              compatibility: {
                                ...prev.compatibility,
                                wrapper_commands: replaceAt(prev.compatibility.wrapper_commands, index(), {
                                  ...prev.compatibility.wrapper_commands[index()],
                                  executable: e.currentTarget.value
                                })
                              }
                            }))
                          }
                        />
                        <input
                          value={item.args}
                          placeholder={tx('Args (ex.: -w 1920 -h 1080)', 'Args (e.g. -w 1920 -h 1080)')}
                          onInput={(e) =>
                            patchConfig((prev) => ({
                              ...prev,
                              compatibility: {
                                ...prev.compatibility,
                                wrapper_commands: replaceAt(prev.compatibility.wrapper_commands, index(), {
                                  ...prev.compatibility.wrapper_commands[index()],
                                  args: e.currentTarget.value
                                })
                              }
                            }))
                          }
                        />
                      </div>

                      <button
                        type="button"
                        class="btn-danger"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            compatibility: {
                              ...prev.compatibility,
                              wrapper_commands: removeAt(prev.compatibility.wrapper_commands, index())
                            }
                          }))
                        }
                      >
                        {tx('Remover wrapper', 'Remove wrapper')}
                      </button>
                    </div>
                  )}
                </For>

                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() =>
                    patchConfig((prev) => ({
                      ...prev,
                      compatibility: {
                        ...prev.compatibility,
                        wrapper_commands: [...prev.compatibility.wrapper_commands, { state: 'OptionalOff', executable: '', args: '' }]
                      }
                    }))
                  }
                >
                  {tx('Adicionar wrapper', 'Add wrapper')}
                </button>
              </div>
            </FieldShell>

            <KeyValueListField
              label={tx('Variáveis de ambiente', 'Environment variables')}
              help={tx('Aplicadas no launch (chaves protegidas são ignoradas pelo runtime).', 'Applied at launch (protected keys are ignored by runtime).')}
              items={environmentVarsAsList()}
              onChange={updateCustomVars}
              keyPlaceholder="WINE_FULLSCREEN_FSR"
              valuePlaceholder="1"
              addLabel={tx('Adicionar variável', 'Add variable')}
              removeLabel={tx('Remover', 'Remove')}
            />

            <FieldShell
              label={tx('Chaves protegidas', 'Protected keys')}
              help={tx('Não podem ser sobrescritas por custom_vars: WINEPREFIX, PROTON_VERB.', 'Cannot be overwritten by custom_vars: WINEPREFIX, PROTON_VERB.')}
            >
              <div class="info-card">
                <code>WINEPREFIX</code>
                <code>PROTON_VERB</code>
              </div>
            </FieldShell>
          </section>
        </Show>

        <Show when={activeTab() === 'scripts'}>
          <section class="stack">
            <TextAreaField
              label={tx('Script pre-launch (bash)', 'Pre-launch script (bash)')}
              help={tx('Executado antes do comando principal do jogo.', 'Executed before main game command.')}
              value={config().scripts.pre_launch}
              rows={8}
              onInput={(value) => patchConfig((prev) => ({ ...prev, scripts: { ...prev.scripts, pre_launch: value } }))}
              placeholder="#!/usr/bin/env bash\necho preparing..."
            />

            <TextAreaField
              label={tx('Script post-launch (bash)', 'Post-launch script (bash)')}
              help={tx('Executado após o encerramento do processo do jogo.', 'Executed after game process exits.')}
              value={config().scripts.post_launch}
              rows={8}
              onInput={(value) => patchConfig((prev) => ({ ...prev, scripts: { ...prev.scripts, post_launch: value } }))}
              placeholder="#!/usr/bin/env bash\necho finished..."
            />

            <FieldShell
              label={tx('Validação básica', 'Basic validation')}
              help={tx('No MVP, os scripts aceitam apenas bash e execução local.', 'In MVP, scripts accept bash only and local execution.')}
            >
              <div class="info-card">
                <span>{tx('Scripts não são enviados para API comunitária.', 'Scripts are not sent to community API.')}</span>
                <span>{tx('Use apenas comandos confiáveis.', 'Use trusted commands only.')}</span>
              </div>
            </FieldShell>
          </section>
        </Show>

        <Show when={activeTab() === 'review'}>
          <section class="stack">
            <TextInputField
              label={tx('Orchestrator base', 'Orchestrator base')}
              help={tx('Caminho fixo do binário base do Orchestrator (não editável).', 'Fixed path to Orchestrator base binary (not editable).')}
              value={ORCHESTRATOR_BASE_PATH}
              onInput={() => undefined}
              readonly
            />

            <TextInputField
              label={tx('Saída do executável', 'Output executable')}
              help={tx('Destino final do orquestrador gerado.', 'Final destination for generated orchestrator.')}
              value={outputPath()}
              onInput={setOutputPath}
            />

            <FieldShell
              label={tx('Resumo do payload', 'Payload summary')}
              help={tx('Visão rápida de quantos itens foram configurados por seção.', 'Quick view of how many items were configured per section.')}
            >
              <div class="summary-grid">
                <div>
                  <strong>{payloadSummary().launchArgs}</strong>
                  <span>{tx('Launch args', 'Launch args')}</span>
                </div>
                <div>
                  <strong>{payloadSummary().integrityFiles}</strong>
                  <span>{tx('Arquivos obrigatórios', 'Required files')}</span>
                </div>
                <div>
                  <strong>{payloadSummary().winetricks}</strong>
                  <span>Winetricks</span>
                </div>
                <div>
                  <strong>{payloadSummary().registry}</strong>
                  <span>{tx('Registro', 'Registry')}</span>
                </div>
                <div>
                  <strong>{payloadSummary().mounts}</strong>
                  <span>{tx('Montagens', 'Mounts')}</span>
                </div>
                <div>
                  <strong>{payloadSummary().wrappers}</strong>
                  <span>Wrappers</span>
                </div>
                <div>
                  <strong>{payloadSummary().envVars}</strong>
                  <span>{tx('Variáveis', 'Variables')}</span>
                </div>
              </div>
            </FieldShell>

            <div class="row-actions">
              <button type="button" class="btn-test" onClick={runTest}>
                {t('testButton')}
              </button>
              <button type="button" class="btn-primary" onClick={runCreate}>
                {t('createButton')}
              </button>
            </div>

            <section class="preview">
              <h3>{tx('Preview do Payload JSON', 'Payload JSON Preview')}</h3>
              <pre>{configPreview()}</pre>
            </section>

            <section class="preview">
              <h3>{tx('Resultado', 'Result')}</h3>
              <pre>{resultJson() || t('noResult')}</pre>
            </section>
          </section>
        </Show>
      </main>
    </div>
  )
}
