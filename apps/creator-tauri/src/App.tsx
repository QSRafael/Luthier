import { createMemo, createSignal, For, Show } from 'solid-js'

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

async function invokeCommand<T>(command: string, input: unknown): Promise<T> {
  const core = await import('@tauri-apps/api/core')
  return core.invoke<T>(command, { input })
}

export default function App() {
  const tabs = ['Jogo', 'Runtime', 'Revisao e Gerar'] as const
  const [activeTab, setActiveTab] = createSignal<(typeof tabs)[number]>('Jogo')

  const [baseBinaryPath, setBaseBinaryPath] = createSignal('./target/debug/orchestrator')
  const [outputPath, setOutputPath] = createSignal('./tmp/game-orchestrator')
  const [gameRoot, setGameRoot] = createSignal('./tmp')
  const [exePath, setExePath] = createSignal('')
  const [launchArgsInput, setLaunchArgsInput] = createSignal('')
  const [integrityInput, setIntegrityInput] = createSignal('')
  const [statusMessage, setStatusMessage] = createSignal('Pronto')
  const [resultJson, setResultJson] = createSignal('')

  const [config, setConfig] = createSignal<GameConfig>(defaultConfig())

  const configPreview = createMemo(() => JSON.stringify(config(), null, 2))

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
      setStatusMessage('Calculando hash do executavel...')
      const result = await invokeCommand<{ sha256_hex: string }>('cmd_hash_executable', {
        executable_path: exePath()
      })
      setConfig((prev) => ({ ...prev, exe_hash: result.sha256_hex }))
      setStatusMessage('Hash calculado com sucesso')
    } catch (error) {
      setStatusMessage(`Falha ao calcular hash: ${String(error)}`)
    }
  }

  const runTest = async () => {
    try {
      setStatusMessage('Testando configuracao (doctor + prefix plan)...')
      const result = await invokeCommand<unknown>('cmd_test_configuration', {
        config_json: configPreview(),
        game_root: gameRoot()
      })
      setResultJson(JSON.stringify(result, null, 2))
      setStatusMessage('Teste concluido')
    } catch (error) {
      setStatusMessage(`Falha no teste: ${String(error)}`)
    }
  }

  const runCreate = async () => {
    try {
      setStatusMessage('Gerando orquestrador...')
      const result = await invokeCommand<unknown>('cmd_create_executable', {
        base_binary_path: baseBinaryPath(),
        output_path: outputPath(),
        config_json: configPreview(),
        backup_existing: true,
        make_executable: true
      })
      setResultJson(JSON.stringify(result, null, 2))
      setStatusMessage('Executavel gerado com sucesso')
    } catch (error) {
      setStatusMessage(`Falha ao gerar executavel: ${String(error)}`)
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
    setStatusMessage('Listas aplicadas no payload')
  }

  return (
    <div class="app-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Game Orchestrator Creator</p>
          <h1>Fluxo mínimo para gerar e testar o Orquestrador</h1>
          <p class="subtitle">UI inicial para evoluir por fases, com foco em debug e rastreabilidade.</p>
        </div>
        <div class="status-badge">{statusMessage()}</div>
      </header>

      <nav class="tabs">
        <For each={tabs}>
          {(tab) => (
            <button
              classList={{ tab: true, active: activeTab() === tab }}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          )}
        </For>
      </nav>

      <main class="panel">
        <Show when={activeTab() === 'Jogo'}>
          <section class="stack">
            <Field
              label="Nome do jogo"
              help="Nome exibido na splash e nos logs."
              value={config().game_name}
              onInput={setGameName}
            />
            <Field
              label="Executavel (.exe)"
              help="Caminho do exe para hash e referencia de integridade."
              value={exePath()}
              onInput={setExePath}
            />
            <Field
              label="Pasta raiz do jogo"
              help="Usada no comando Testar para validar arquivos obrigatorios."
              value={gameRoot()}
              onInput={setGameRoot}
            />
            <Field
              label="Path relativo do exe no payload"
              help="Sempre relativo; ex.: ./game.exe"
              value={config().relative_exe_path}
              onInput={setRelativeExe}
            />
            <Field
              label="Hash SHA-256"
              help="Identificador do perfil e do prefixo."
              value={config().exe_hash}
              onInput={(v) => setConfig((prev) => ({ ...prev, exe_hash: v }))}
            />

            <div class="row-actions">
              <button type="button" class="btn-secondary" onClick={runHash}>
                Calcular Hash
              </button>
            </div>

            <label class="field">
              <div class="label-row">
                <span>Launch args (separados por espaço)</span>
                <span class="help" title="Ex.: -windowed -nointro">?</span>
              </div>
              <input value={launchArgsInput()} onInput={(e) => setLaunchArgsInput(e.currentTarget.value)} />
            </label>

            <label class="field">
              <div class="label-row">
                <span>Arquivos obrigatórios (1 por linha)</span>
                <span class="help" title="Cada linha vira um item em integrity_files.">?</span>
              </div>
              <textarea
                rows={6}
                value={integrityInput()}
                onInput={(e) => setIntegrityInput(e.currentTarget.value)}
              />
            </label>

            <div class="row-actions">
              <button type="button" class="btn-secondary" onClick={applyLists}>
                Aplicar Listas
              </button>
            </div>
          </section>
        </Show>

        <Show when={activeTab() === 'Runtime'}>
          <section class="stack">
            <Field
              label="Versão do Proton"
              help="Usado quando runtime selecionado for Proton."
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
                <span>Runtime primário</span>
                <span class="help" title="Candidato inicial: ProtonUmu, ProtonNative ou Wine.">?</span>
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
              <span>Runtime estrito (sem fallback)</span>
              <span class="help" title="Se ativo, só tenta o runtime primário.">?</span>
            </label>

            <div class="row-actions">
              <button type="button" class="btn-secondary" onClick={applyRuntimeDefaults}>
                Restaurar defaults de runtime
              </button>
            </div>
          </section>
        </Show>

        <Show when={activeTab() === 'Revisao e Gerar'}>
          <section class="stack">
            <Field
              label="Orchestrator base"
              help="Binário base pré-compilado usado para injetar o payload."
              value={baseBinaryPath()}
              onInput={setBaseBinaryPath}
            />
            <Field
              label="Saída do executável"
              help="Caminho final do orquestrador gerado."
              value={outputPath()}
              onInput={setOutputPath}
            />

            <div class="row-actions">
              <button type="button" class="btn-test" onClick={runTest}>
                Testar
              </button>
              <button type="button" class="btn-primary" onClick={runCreate}>
                Criar Executável
              </button>
            </div>

            <section class="preview">
              <h3>Preview do Payload JSON</h3>
              <pre>{configPreview()}</pre>
            </section>

            <section class="preview">
              <h3>Resultado</h3>
              <pre>{resultJson() || 'Sem resultado ainda.'}</pre>
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
