import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'

type FeatureState = 'MandatoryOn' | 'MandatoryOff' | 'OptionalOn' | 'OptionalOff'

type GameConfig = {
  config_version: number
  created_by: string
  game_name: string
  exe_hash: string
  relative_exe_path: string
  launch_args: string[]
  runner: {
    proton_version: string
    auto_update: boolean
    esync: boolean
    fsync: boolean
    runtime_preference: 'Auto' | 'Proton' | 'Wine'
  }
  environment: {
    gamemode: FeatureState
    gamescope: {
      state: FeatureState
      resolution: string | null
      fsr: boolean
    }
    mangohud: FeatureState
    prime_offload: boolean
    custom_vars: Record<string, string>
  }
  compatibility: {
    wine_wayland: FeatureState
    hdr: FeatureState
    auto_dxvk_nvapi: FeatureState
    easy_anti_cheat_runtime: FeatureState
    battleye_runtime: FeatureState
    staging: FeatureState
    wrapper_commands: Array<{ state: FeatureState; executable: string; args: string }>
  }
  winecfg: {
    dll_overrides: Array<{ dll: string; mode: string }>
    auto_capture_mouse: FeatureState
    window_decorations: FeatureState
    window_manager_control: FeatureState
    virtual_desktop: { state: FeatureState; resolution: string | null }
    desktop_integration: FeatureState
    drives: Array<{ letter: string; source_relative_path: string; state: FeatureState }>
    audio_driver: string | null
  }
  dependencies: string[]
  extra_system_dependencies: Array<{
    name: string
    state: FeatureState
    check_commands: string[]
    check_env_vars: string[]
    check_paths: string[]
  }>
  requirements: {
    runtime: {
      strict: boolean
      primary: 'ProtonUmu' | 'ProtonNative' | 'Wine'
      fallback_order: Array<'ProtonUmu' | 'ProtonNative' | 'Wine'>
    }
    umu: FeatureState
    winetricks: FeatureState
    gamescope: FeatureState
    gamemode: FeatureState
    mangohud: FeatureState
    steam_runtime: FeatureState
  }
  registry_keys: Array<{ path: string; name: string; value_type: string; value: string }>
  integrity_files: string[]
  folder_mounts: Array<{
    source_relative_path: string
    target_windows_path: string
    create_source_if_missing: boolean
  }>
  scripts: {
    pre_launch: string
    post_launch: string
  }
}

const defaultConfig = (): GameConfig => ({
  config_version: 1,
  created_by: 'creator-ui',
  game_name: '',
  exe_hash: '',
  relative_exe_path: './game.exe',
  launch_args: [],
  runner: {
    proton_version: 'GE-Proton9-10',
    auto_update: false,
    esync: true,
    fsync: true,
    runtime_preference: 'Auto'
  },
  environment: {
    gamemode: 'OptionalOn',
    gamescope: { state: 'OptionalOff', resolution: null, fsr: false },
    mangohud: 'OptionalOff',
    prime_offload: false,
    custom_vars: {}
  },
  compatibility: {
    wine_wayland: 'OptionalOff',
    hdr: 'OptionalOff',
    auto_dxvk_nvapi: 'OptionalOff',
    easy_anti_cheat_runtime: 'OptionalOff',
    battleye_runtime: 'OptionalOff',
    staging: 'OptionalOff',
    wrapper_commands: []
  },
  winecfg: {
    dll_overrides: [],
    auto_capture_mouse: 'OptionalOn',
    window_decorations: 'OptionalOn',
    window_manager_control: 'OptionalOn',
    virtual_desktop: { state: 'OptionalOff', resolution: null },
    desktop_integration: 'OptionalOn',
    drives: [],
    audio_driver: null
  },
  dependencies: [],
  extra_system_dependencies: [],
  requirements: {
    runtime: {
      strict: false,
      primary: 'ProtonNative',
      fallback_order: ['ProtonUmu', 'Wine']
    },
    umu: 'OptionalOn',
    winetricks: 'OptionalOff',
    gamescope: 'OptionalOff',
    gamemode: 'OptionalOn',
    mangohud: 'OptionalOff',
    steam_runtime: 'OptionalOff'
  },
  registry_keys: [],
  integrity_files: [],
  folder_mounts: [],
  scripts: {
    pre_launch: '',
    post_launch: ''
  }
})

type Locale = 'pt-BR' | 'en-US'

const i18n: Record<Locale, Record<string, string>> = {
  'pt-BR': {
    appName: 'Game Orchestrator Creator',
    title: 'Fluxo mínimo para gerar e testar o Orquestrador',
    subtitle: 'UI inicial para evoluir por fases, com foco em debug e rastreabilidade.',
    language: 'Idioma',
    statusReady: 'Pronto',
    tabGame: 'Jogo',
    tabRuntime: 'Runtime',
    tabReview: 'Revisao e Gerar',
    gameName: 'Nome do jogo',
    gameNameHelp: 'Nome exibido na splash e nos logs.',
    exePath: 'Executavel (.exe)',
    exePathHelp: 'Caminho do exe para hash e referencia de integridade.',
    gameRoot: 'Pasta raiz do jogo',
    gameRootHelp: 'Usada no comando Testar para validar arquivos obrigatorios.',
    relativeExePath: 'Path relativo do exe no payload',
    relativeExePathHelp: 'Sempre relativo; ex.: ./game.exe',
    exeHash: 'Hash SHA-256',
    exeHashHelp: 'Identificador do perfil e do prefixo.',
    hashButton: 'Calcular Hash',
    launchArgs: 'Launch args (separados por espaço)',
    launchArgsHelp: 'Ex.: -windowed -nointro',
    integrityFiles: 'Arquivos obrigatórios (1 por linha)',
    integrityFilesHelp: 'Cada linha vira um item em integrity_files.',
    applyLists: 'Aplicar Listas',
    protonVersion: 'Versão do Proton',
    protonVersionHelp: 'Usado quando runtime selecionado for Proton.',
    runtimePrimary: 'Runtime primário',
    runtimePrimaryHelp: 'Candidato inicial: ProtonUmu, ProtonNative ou Wine.',
    strictRuntime: 'Runtime estrito (sem fallback)',
    strictRuntimeHelp: 'Se ativo, só tenta o runtime primário.',
    restoreRuntimeDefaults: 'Restaurar defaults de runtime',
    orchestratorBase: 'Orchestrator base',
    orchestratorBaseHelp: 'Binário base pré-compilado usado para injetar o payload.',
    outputExecutable: 'Saída do executável',
    outputExecutableHelp: 'Caminho final do orquestrador gerado.',
    testButton: 'Testar',
    createButton: 'Criar Executável',
    payloadPreview: 'Preview do Payload JSON',
    resultTitle: 'Resultado',
    noResult: 'Sem resultado ainda.',
    msgHashStart: 'Calculando hash do executavel...',
    msgHashOk: 'Hash calculado com sucesso',
    msgHashFail: 'Falha ao calcular hash:',
    msgTestStart: 'Testando configuracao (doctor + prefix plan)...',
    msgTestOk: 'Teste concluido',
    msgTestFail: 'Falha no teste:',
    msgCreateStart: 'Gerando orquestrador...',
    msgCreateOk: 'Executavel gerado com sucesso',
    msgCreateFail: 'Falha ao gerar executavel:',
    msgListsApplied: 'Listas aplicadas no payload'
  },
  'en-US': {
    appName: 'Game Orchestrator Creator',
    title: 'Minimal flow to test and build the Orchestrator',
    subtitle: 'Initial UI that will evolve by phases, focused on debugging and traceability.',
    language: 'Language',
    statusReady: 'Ready',
    tabGame: 'Game',
    tabRuntime: 'Runtime',
    tabReview: 'Review and Generate',
    gameName: 'Game name',
    gameNameHelp: 'Displayed in splash and logs.',
    exePath: 'Executable (.exe)',
    exePathHelp: 'EXE path used for hashing and integrity checks.',
    gameRoot: 'Game root folder',
    gameRootHelp: 'Used by Test to validate required files.',
    relativeExePath: 'Relative EXE path in payload',
    relativeExePathHelp: 'Always relative; ex.: ./game.exe',
    exeHash: 'SHA-256 hash',
    exeHashHelp: 'Profile and prefix identifier.',
    hashButton: 'Calculate Hash',
    launchArgs: 'Launch args (space separated)',
    launchArgsHelp: 'Ex.: -windowed -nointro',
    integrityFiles: 'Required files (1 per line)',
    integrityFilesHelp: 'Each line becomes one integrity_files item.',
    applyLists: 'Apply Lists',
    protonVersion: 'Proton version',
    protonVersionHelp: 'Used when selected runtime is Proton.',
    runtimePrimary: 'Primary runtime',
    runtimePrimaryHelp: 'Initial candidate: ProtonUmu, ProtonNative or Wine.',
    strictRuntime: 'Strict runtime (no fallback)',
    strictRuntimeHelp: 'When enabled, only the primary runtime is tried.',
    restoreRuntimeDefaults: 'Restore runtime defaults',
    orchestratorBase: 'Orchestrator base',
    orchestratorBaseHelp: 'Prebuilt base binary used to inject payload.',
    outputExecutable: 'Output executable',
    outputExecutableHelp: 'Final generated orchestrator path.',
    testButton: 'Test',
    createButton: 'Create Executable',
    payloadPreview: 'Payload JSON Preview',
    resultTitle: 'Result',
    noResult: 'No result yet.',
    msgHashStart: 'Calculating executable hash...',
    msgHashOk: 'Hash calculated successfully',
    msgHashFail: 'Failed to calculate hash:',
    msgTestStart: 'Testing configuration (doctor + prefix plan)...',
    msgTestOk: 'Test completed',
    msgTestFail: 'Test failed:',
    msgCreateStart: 'Generating orchestrator...',
    msgCreateOk: 'Executable created successfully',
    msgCreateFail: 'Failed to create executable:',
    msgListsApplied: 'Lists applied to payload'
  }
}

function detectLocale(): Locale {
  const saved = localStorage.getItem('creator.locale')
  if (saved === 'pt-BR' || saved === 'en-US') return saved
  const browserLocale = navigator.language
  return browserLocale.startsWith('pt') ? 'pt-BR' : 'en-US'
}

async function invokeCommand<T>(command: string, input: unknown): Promise<T> {
  const core = await import('@tauri-apps/api/core')
  return core.invoke<T>(command, { input })
}

export default function App() {
  const initialLocale = detectLocale()
  const [locale, setLocale] = createSignal<Locale>(initialLocale)
  const [activeTab, setActiveTab] = createSignal<'game' | 'runtime' | 'review'>('game')

  const [baseBinaryPath, setBaseBinaryPath] = createSignal('./target/debug/orchestrator')
  const [outputPath, setOutputPath] = createSignal('./tmp/game-orchestrator')
  const [gameRoot, setGameRoot] = createSignal('./tmp')
  const [exePath, setExePath] = createSignal('')
  const [launchArgsInput, setLaunchArgsInput] = createSignal('')
  const [integrityInput, setIntegrityInput] = createSignal('')
  const [statusMessage, setStatusMessage] = createSignal(i18n[initialLocale].statusReady)
  const [resultJson, setResultJson] = createSignal('')

  const [config, setConfig] = createSignal<GameConfig>(defaultConfig())

  const configPreview = createMemo(() => JSON.stringify(config(), null, 2))
  const t = (key: string) => i18n[locale()][key] ?? key
  const tabs: Array<'game' | 'runtime' | 'review'> = ['game', 'runtime', 'review']

  const tabLabel = (tab: 'game' | 'runtime' | 'review') => {
    if (tab === 'game') return t('tabGame')
    if (tab === 'runtime') return t('tabRuntime')
    return t('tabReview')
  }

  createEffect(() => {
    localStorage.setItem('creator.locale', locale())
  })

  const updateConfig = <K extends keyof GameConfig>(key: K, value: GameConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const setGameName = (value: string) => {
    updateConfig('game_name', value)
  }

  const setRelativeExe = (value: string) => {
    updateConfig('relative_exe_path', value)
  }

  const runHash = async () => {
    try {
      setStatusMessage(t('msgHashStart'))
      const result = await invokeCommand<{ sha256_hex: string }>('cmd_hash_executable', {
        executable_path: exePath()
      })
      setConfig((prev) => ({ ...prev, exe_hash: result.sha256_hex }))
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
        base_binary_path: baseBinaryPath(),
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

  const applyRuntimeDefaults = () => {
    setConfig((prev) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        runtime: {
          strict: false,
          primary: 'ProtonNative',
          fallback_order: ['ProtonUmu', 'Wine']
        }
      }
    }))
  }

  const applyLists = () => {
    const launchArgs = launchArgsInput()
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
    const integrityFiles = integrityInput()
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

    setConfig((prev) => ({
      ...prev,
      launch_args: launchArgs,
      integrity_files: integrityFiles
    }))
    setStatusMessage(t('msgListsApplied'))
  }

  return (
    <div class="app-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">{t('appName')}</p>
          <h1>{t('title')}</h1>
          <p class="subtitle">{t('subtitle')}</p>
        </div>
        <div class="status-column">
          <label class="locale-switch">
            <span>{t('language')}</span>
            <select
              value={locale()}
              onInput={(e) => setLocale(e.currentTarget.value as Locale)}
            >
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
            <Field
              label={t('gameName')}
              help={t('gameNameHelp')}
              value={config().game_name}
              onInput={setGameName}
            />
            <Field
              label={t('exePath')}
              help={t('exePathHelp')}
              value={exePath()}
              onInput={setExePath}
            />
            <Field
              label={t('gameRoot')}
              help={t('gameRootHelp')}
              value={gameRoot()}
              onInput={setGameRoot}
            />
            <Field
              label={t('relativeExePath')}
              help={t('relativeExePathHelp')}
              value={config().relative_exe_path}
              onInput={setRelativeExe}
            />
            <Field
              label={t('exeHash')}
              help={t('exeHashHelp')}
              value={config().exe_hash}
              onInput={(v) => setConfig((prev) => ({ ...prev, exe_hash: v }))}
            />

            <div class="row-actions">
              <button type="button" class="btn-secondary" onClick={runHash}>
                {t('hashButton')}
              </button>
            </div>

            <label class="field">
              <div class="label-row">
                <span>{t('launchArgs')}</span>
                <span class="help" title={t('launchArgsHelp')}>?</span>
              </div>
              <input value={launchArgsInput()} onInput={(e) => setLaunchArgsInput(e.currentTarget.value)} />
            </label>

            <label class="field">
              <div class="label-row">
                <span>{t('integrityFiles')}</span>
                <span class="help" title={t('integrityFilesHelp')}>?</span>
              </div>
              <textarea
                rows={6}
                value={integrityInput()}
                onInput={(e) => setIntegrityInput(e.currentTarget.value)}
              />
            </label>

            <div class="row-actions">
              <button type="button" class="btn-secondary" onClick={applyLists}>
                {t('applyLists')}
              </button>
            </div>
          </section>
        </Show>

        <Show when={activeTab() === 'runtime'}>
          <section class="stack">
            <Field
              label={t('protonVersion')}
              help={t('protonVersionHelp')}
              value={config().runner.proton_version}
              onInput={(v) =>
                setConfig((prev) => ({
                  ...prev,
                  runner: { ...prev.runner, proton_version: v }
                }))
              }
            />

            <label class="field">
              <div class="label-row">
                <span>{t('runtimePrimary')}</span>
                <span class="help" title={t('runtimePrimaryHelp')}>?</span>
              </div>
              <select
                value={config().requirements.runtime.primary}
                onInput={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    requirements: {
                      ...prev.requirements,
                      runtime: {
                        ...prev.requirements.runtime,
                        primary: e.currentTarget.value as 'ProtonUmu' | 'ProtonNative' | 'Wine'
                      }
                    }
                  }))
                }
              >
                <option value="ProtonNative">ProtonNative</option>
                <option value="ProtonUmu">ProtonUmu</option>
                <option value="Wine">Wine</option>
              </select>
            </label>

            <label class="field inline">
              <input
                type="checkbox"
                checked={config().requirements.runtime.strict}
                onInput={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    requirements: {
                      ...prev.requirements,
                      runtime: {
                        ...prev.requirements.runtime,
                        strict: e.currentTarget.checked
                      }
                    }
                  }))
                }
              />
              <span>{t('strictRuntime')}</span>
              <span class="help" title={t('strictRuntimeHelp')}>?</span>
            </label>

            <div class="row-actions">
              <button type="button" class="btn-secondary" onClick={applyRuntimeDefaults}>
                {t('restoreRuntimeDefaults')}
              </button>
            </div>
          </section>
        </Show>

        <Show when={activeTab() === 'review'}>
          <section class="stack">
            <Field
              label={t('orchestratorBase')}
              help={t('orchestratorBaseHelp')}
              value={baseBinaryPath()}
              onInput={setBaseBinaryPath}
            />
            <Field
              label={t('outputExecutable')}
              help={t('outputExecutableHelp')}
              value={outputPath()}
              onInput={setOutputPath}
            />

            <div class="row-actions">
              <button type="button" class="btn-test" onClick={runTest}>
                {t('testButton')}
              </button>
              <button type="button" class="btn-primary" onClick={runCreate}>
                {t('createButton')}
              </button>
            </div>

            <section class="preview">
              <h3>{t('payloadPreview')}</h3>
              <pre>{configPreview()}</pre>
            </section>

            <section class="preview">
              <h3>{t('resultTitle')}</h3>
              <pre>{resultJson() || t('noResult')}</pre>
            </section>
          </section>
        </Show>
      </main>
    </div>
  )
}

type FieldProps = {
  label: string
  help: string
  value: string
  onInput: (value: string) => void
}

function Field(props: FieldProps) {
  return (
    <label class="field">
      <div class="label-row">
        <span>{props.label}</span>
        <span class="help" title={props.help}>
          ?
        </span>
      </div>
      <input value={props.value} onInput={(e) => props.onInput(e.currentTarget.value)} />
    </label>
  )
}
