import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'

import { invokeCommand } from './api/tauri'
import Field from './components/Field'
import { detectLocale, Locale, translate } from './i18n'
import { CreatorTab, defaultGameConfig, GameConfig, RuntimePrimary } from './models/config'

export default function App() {
  const initialLocale = detectLocale()
  const [locale, setLocale] = createSignal<Locale>(initialLocale)
  const [activeTab, setActiveTab] = createSignal<CreatorTab>('game')

  const [baseBinaryPath, setBaseBinaryPath] = createSignal('./target/debug/orchestrator')
  const [outputPath, setOutputPath] = createSignal('./tmp/game-orchestrator')
  const [gameRoot, setGameRoot] = createSignal('./tmp')
  const [exePath, setExePath] = createSignal('')
  const [launchArgsInput, setLaunchArgsInput] = createSignal('')
  const [integrityInput, setIntegrityInput] = createSignal('')
  const [statusMessage, setStatusMessage] = createSignal(translate(initialLocale, 'statusReady'))
  const [resultJson, setResultJson] = createSignal('')

  const [config, setConfig] = createSignal<GameConfig>(defaultGameConfig())

  const configPreview = createMemo(() => JSON.stringify(config(), null, 2))
  const t = (key: string) => translate(locale(), key)
  const tabs: CreatorTab[] = ['game', 'runtime', 'review']

  const tabLabel = (tab: CreatorTab) => {
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
                <span class="help" title={t('launchArgsHelp')}>
                  ?
                </span>
              </div>
              <input
                value={launchArgsInput()}
                onInput={(e) => setLaunchArgsInput(e.currentTarget.value)}
              />
            </label>

            <label class="field">
              <div class="label-row">
                <span>{t('integrityFiles')}</span>
                <span class="help" title={t('integrityFilesHelp')}>
                  ?
                </span>
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
                <span class="help" title={t('runtimePrimaryHelp')}>
                  ?
                </span>
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
                        primary: e.currentTarget.value as RuntimePrimary
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
              <span class="help" title={t('strictRuntimeHelp')}>
                ?
              </span>
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
