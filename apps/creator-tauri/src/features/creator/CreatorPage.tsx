import { createMemo, createSignal, For, Show } from 'solid-js'
import { IconPlus, IconTrash } from '@tabler/icons-solidjs'

import {
  FeatureStateField,
  FieldShell,
  KeyValueListField,
  SegmentedField,
  SelectField,
  StringListField,
  TextAreaField,
  TextInputField,
  ToggleField
} from '../../components/form/FormControls'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { useTheme } from '../../components/theme-provider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemMain, ItemTitle } from '../../components/ui/item'
import { Select } from '../../components/ui/select'
import { Switch, SwitchControl, SwitchInput, SwitchThumb } from '../../components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import type { Theme } from '../../components/theme-provider'
import { Locale } from '../../i18n'
import { CreatorTab, FeatureState, RuntimePreference } from '../../models/config'
import {
  AudioDriverOption,
  CreatorController,
  GamescopeWindowType,
  UpscaleMethod,
  useCreatorController
} from './useCreatorController'
import { AppSidebar } from './AppSidebar'

function tabLabel(tab: CreatorTab, controller: CreatorController) {
  const tx = controller.tx
  if (tab === 'game') return tx('Jogo', 'Game')
  if (tab === 'runtime') return tx('Runtime', 'Runtime')
  if (tab === 'performance') return tx('Performance e Compatibilidade', 'Performance and Compatibility')
  if (tab === 'prefix') return tx('Prefixo e Dependências', 'Prefix and Dependencies')
  if (tab === 'winecfg') return 'Winecfg'
  if (tab === 'wrappers') return tx('Wrappers e Ambiente', 'Wrappers and Environment')
  if (tab === 'scripts') return tx('Scripts', 'Scripts')
  return tx('Revisão e Gerar', 'Review and Generate')
}

type SwitchChoiceCardProps = {
  title: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function SwitchChoiceCard(props: SwitchChoiceCardProps) {
  const toggle = () => props.onChange(!props.checked)

  return (
    <div
      role="button"
      tabIndex={0}
      class={
        'flex items-center justify-between gap-3 rounded-md border px-3 py-3 transition-colors ' +
        (props.checked
          ? 'border-primary/40 bg-muted/45'
          : 'border-border/60 bg-muted/30 hover:border-border hover:bg-muted/40')
      }
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      }}
    >
      <div class="min-w-0">
        <p class="text-sm font-medium">{props.title}</p>
        <Show when={props.description}>
          <p class="text-xs text-muted-foreground">{props.description}</p>
        </Show>
      </div>
      <Switch checked={props.checked} onChange={props.onChange} onClick={(e) => e.stopPropagation()}>
        <SwitchInput />
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
      </Switch>
    </div>
  )
}

export default function CreatorPage() {
  const controller = useCreatorController()
  const { theme, setTheme } = useTheme()

  const {
    ORCHESTRATOR_BASE_PATH,
    locale,
    setLocale,
    activeTab,
    setActiveTab,
    outputPath,
    setOutputPath,
    gameRoot,
    gameRootManualOverride,
    gameRootRelativeDisplay,
    exeInsideGameRoot,
    exePath,
    setExePath,
    registryImportPath,
    setRegistryImportPath,
    iconPreviewPath,
    statusMessage,
    setStatusMessage,
    resultJson,
    winetricksAvailable,
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
    runtimePreferenceOptions,
    audioDriverOptions,
    dllModeOptions,
    upscaleMethodOptions,
    windowTypeOptions,
    prefixPathPreview,
    environmentVarsAsList,
    audioDriverValue,
    gamescopeEnabled,
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
    applyIconExtractionPlaceholder,
    setGamescopeState,
    setGamemodeState,
    setMangohudState,
    updateCustomVars,
    addWinetricksVerb,
    removeWinetricksVerb,
    addWinetricksFromSearch
  } = controller

  const [registryDialogOpen, setRegistryDialogOpen] = createSignal(false)
  const [registryDraft, setRegistryDraft] = createSignal({
    path: '',
    name: '',
    value_type: 'REG_SZ',
    value: ''
  })

  const [mountDialogOpen, setMountDialogOpen] = createSignal(false)
  const [mountDraft, setMountDraft] = createSignal({
    source_relative_path: '',
    target_windows_path: '',
    create_source_if_missing: true
  })

  const [dllDialogOpen, setDllDialogOpen] = createSignal(false)
  const [dllDraft, setDllDraft] = createSignal({
    dll: '',
    mode: 'builtin'
  })

  const [wrapperDialogOpen, setWrapperDialogOpen] = createSignal(false)
  const [wrapperDraft, setWrapperDraft] = createSignal({
    state: 'OptionalOff' as FeatureState,
    executable: '',
    args: ''
  })

  const [extraDependencyDialogOpen, setExtraDependencyDialogOpen] = createSignal(false)
  const [extraDependencyDraft, setExtraDependencyDraft] = createSignal({
    name: '',
    command: '',
    env_vars: '',
    paths: ''
  })

  const runtimeVersionFieldLabel = () => {
    const preference = config().runner.runtime_preference
    if (preference === 'Proton') return tx('Versão do Proton', 'Proton version')
    if (preference === 'Wine') return tx('Versão do Wine', 'Wine version')
    return tx('Versão de runtime (preferida)', 'Preferred runtime version')
  }

  const runtimeVersionFieldHelp = () => {
    const preference = config().runner.runtime_preference
    if (preference === 'Proton') {
      return tx(
        'Versão alvo do Proton usada pelo orquestrador quando a preferência está em Proton.',
        'Target Proton version used by the orchestrator when preference is Proton.'
      )
    }
    if (preference === 'Wine') {
      return tx(
        'Versão/identificador de Wine esperada quando a preferência está em Wine.',
        'Expected Wine version/identifier when preference is Wine.'
      )
    }
    return tx(
      'Versão preferida para runtime quando o modo Auto escolher Proton/Wine conforme disponibilidade.',
      'Preferred runtime version when Auto mode picks Proton/Wine based on availability.'
    )
  }

  const gamescopeAdditionalOptionsList = createMemo(() => {
    const raw = config().environment.gamescope.additional_options.trim()
    if (!raw) return [] as string[]
    if (raw.includes('\n')) {
      return raw
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    }
    return [raw]
  })

  const setGamescopeAdditionalOptionsList = (items: string[]) => {
    patchConfig((prev) => ({
      ...prev,
      environment: {
        ...prev.environment,
        gamescope: {
          ...prev.environment.gamescope,
          additional_options: items.join(' ').trim()
        }
      }
    }))
  }

  const gamescopeUsesMonitorResolution = createMemo(
    () =>
      !config().environment.gamescope.output_width.trim() &&
      !config().environment.gamescope.output_height.trim()
  )

  const wineWaylandEnabled = createMemo(() => {
    const state = config().compatibility.wine_wayland
    return state === 'MandatoryOn' || state === 'OptionalOn'
  })

  const setGamescopeOutputWidth = (value: string) => {
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

  const setGamescopeOutputHeight = (value: string) => {
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

  return (
    <div class="creator-page">
      <Card>
        <CardHeader class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.09em] text-primary">Game Orchestrator Creator</p>
            <CardTitle class="text-2xl">
              {tx('Editor de Orquestrador', 'Orchestrator Editor')}
            </CardTitle>
            <CardDescription>
              {tx(
                'Interface refeita em componentes shadcn para fluxo direto: escolha do .exe, ajuste por abas e geração.',
                'Interface rebuilt with shadcn components for a direct flow: pick .exe, tune by tabs and generate.'
              )}
            </CardDescription>
          </div>

          <div class="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <div class="w-full sm:min-w-[150px]">
              <label class="mb-1 block text-xs font-medium text-muted-foreground">{t('language')}</label>
              <Select value={locale()} onInput={(e) => setLocale(e.currentTarget.value as Locale)}>
                <option value="pt-BR">pt-BR</option>
                <option value="en-US">en-US</option>
              </Select>
            </div>
            <div class="w-full sm:min-w-[150px]">
              <label class="mb-1 block text-xs font-medium text-muted-foreground">
                {tx('Tema', 'Theme')}
              </label>
              <Select value={theme()} onInput={(e) => setTheme(e.currentTarget.value as Theme)}>
                <option value="dark">{tx('Escuro', 'Dark')}</option>
                <option value="light">{tx('Claro', 'Light')}</option>
                <option value="system">{tx('Sistema', 'System')}</option>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div class="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div class="h-fit lg:sticky lg:top-4">
          <AppSidebar
            appName="Game Orchestrator"
            activeTab={activeTab()}
            onTabChange={setActiveTab}
            tabLabel={(tab) => tabLabel(tab, controller)}
          />
        </div>

        <Card>
          <CardContent class="pt-5">
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
                <Input value={exePath()} placeholder="/home/user/Games/MyGame/game.exe" onInput={(e) => setExePath(e.currentTarget.value)} />
                <Button type="button" class="btn-secondary" onClick={pickExecutable}>
                  {tx('Selecionar arquivo', 'Select file')}
                </Button>
              </div>
            </FieldShell>

            <FieldShell
              label={tx('Pasta raiz do jogo', 'Game root folder')}
              help={tx(
                'Por padrão usa a pasta do executável principal, mas pode ser alterada se o .exe estiver em subpasta.',
                'Defaults to the main executable folder, but can be changed if the .exe is in a subfolder.'
              )}
              hint={tx(
                !exeInsideGameRoot()
                  ? 'Invalido: o executável principal precisa estar dentro da pasta raiz.'
                  : gameRootManualOverride()
                    ? 'Pasta raiz alterada manualmente.'
                    : 'Pasta raiz automática baseada no executável.',
                !exeInsideGameRoot()
                  ? 'Invalid: the main executable must be inside the game root.'
                  : gameRootManualOverride()
                    ? 'Game root manually overridden.'
                    : 'Automatic game root based on the executable.'
              )}
            >
              <div class="picker-row">
                <Input value={gameRootRelativeDisplay()} placeholder="./" readOnly class="readonly" />
                <Button type="button" class="btn-secondary" onClick={pickGameRootOverride}>
                  {tx('Escolher outra', 'Choose another')}
                </Button>
              </div>
            </FieldShell>

            <FieldShell
              label={tx('Hash SHA-256', 'SHA-256 hash')}
              help={tx(
                'Identificador principal para perfil e prefixo por jogo.',
                'Main identifier for profile and per-game prefix.'
              )}
            >
              <div class="picker-row">
                <Input
                  value={config().exe_hash}
                  onInput={(e) =>
                    patchConfig((prev) => ({
                      ...prev,
                      exe_hash: e.currentTarget.value
                    }))
                  }
                />
                <Button type="button" class="btn-secondary" onClick={runHash}>
                  {t('hashButton')}
                </Button>
              </div>
            </FieldShell>

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
                <Button type="button" class="btn-secondary" onClick={applyIconExtractionPlaceholder}>
                  {tx('Extrair ícone', 'Extract icon')}
                </Button>
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
              pickerLabel={tx('Escolher arquivo na pasta do jogo', 'Pick file from game folder')}
              onPickValue={pickIntegrityFileRelative}
            />
          </section>
        </Show>

        <Show when={activeTab() === 'runtime'}>
          <section class="stack">
            <SegmentedField<RuntimePreference>
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

            <Item>
              <ItemMain>
                <ItemContent>
                  <div class="flex items-center gap-2">
                    <ItemTitle>{runtimeVersionFieldLabel()}</ItemTitle>
                    <span
                      class="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-medium text-muted-foreground"
                      title={runtimeVersionFieldHelp()}
                    >
                      ?
                    </span>
                  </div>
                  <ItemDescription>{runtimeVersionFieldHelp()}</ItemDescription>
                </ItemContent>

                <ItemActions class="md:self-end">
                  <Input
                    value={config().runner.proton_version}
                    placeholder={
                      config().runner.runtime_preference === 'Wine' ? 'wine-ge-8-26' : 'GE-Proton9-10'
                    }
                    onInput={(e) =>
                      patchConfig((prev) => ({
                        ...prev,
                        runner: {
                          ...prev.runner,
                          proton_version: e.currentTarget.value
                        }
                      }))
                    }
                  />
                </ItemActions>
              </ItemMain>

              <ItemFooter>
                <div class="grid gap-3 md:grid-cols-2">
                  <SwitchChoiceCard
                    title={tx('Versão obrigatória', 'Required version')}
                    description={tx(
                      'Quando ativado, exige exatamente a versão configurada para executar.',
                      'When enabled, requires the configured runtime version to launch.'
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

                  <SwitchChoiceCard
                    title={tx('Auto update', 'Auto update')}
                    description={tx(
                      'Atualiza metadados do runtime quando aplicável antes da execução.',
                      'Updates runtime metadata when applicable before launching.'
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
                </div>
              </ItemFooter>
            </Item>

            <Item>
              <div class="grid gap-3 md:grid-cols-2">
                <SwitchChoiceCard
                  title="ESYNC"
                  description={tx(
                    'Ativa otimizações de sincronização no runtime.',
                    'Enables synchronization optimizations in runtime.'
                  )}
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

                <SwitchChoiceCard
                  title="FSYNC"
                  description={tx('Ativa otimizações FSYNC quando suportado.', 'Enables FSYNC optimizations when supported.')}
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
              </div>
            </Item>

            <FeatureStateField
              label="UMU"
              help={tx(
                'Controla uso de umu-run conforme política de obrigatoriedade.',
                'Controls umu-run usage according to enforcement policy.'
              )}
              value={config().requirements.umu}
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

            <FeatureStateField
              label={tx('Steam Runtime', 'Steam Runtime')}
              help={tx(
                'Define se steam runtime é obrigatório, opcional ou bloqueado.',
                'Defines whether steam runtime is mandatory, optional or blocked.'
              )}
              value={config().requirements.steam_runtime}
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

            <FeatureStateField
              label="Easy AntiCheat Runtime"
              help={tx('Política para runtime local do Easy AntiCheat.', 'Policy for local Easy AntiCheat runtime.')}
              value={config().compatibility.easy_anti_cheat_runtime}
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

            <FeatureStateField
              label="BattleEye Runtime"
              help={tx('Política para runtime local do BattleEye.', 'Policy for local BattleEye runtime.')}
              value={config().compatibility.battleye_runtime}
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
              controlClass="flex justify-end"
              footer={
                config().extra_system_dependencies.length > 0 ? (
                  <div class="grid gap-2">
                    <For each={config().extra_system_dependencies}>
                      {(item, index) => (
                        <div class="grid items-start gap-2 rounded-md border px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto]">
                          <div class="min-w-0 space-y-1">
                            <p class="truncate text-sm font-medium">{item.name || tx('Sem nome', 'Unnamed')}</p>
                            <Show when={item.check_commands.length > 0}>
                              <p class="truncate text-xs text-muted-foreground">
                                {tx('Comando:', 'Command:')} {joinCommaList(item.check_commands)}
                              </p>
                            </Show>
                            <Show when={item.check_env_vars.length > 0}>
                              <p class="truncate text-xs text-muted-foreground">
                                {tx('Variáveis:', 'Env vars:')} {joinCommaList(item.check_env_vars)}
                              </p>
                            </Show>
                            <Show when={item.check_paths.length > 0}>
                              <p class="truncate text-xs text-muted-foreground">
                                {tx('Paths:', 'Paths:')} {joinCommaList(item.check_paths)}
                              </p>
                            </Show>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              patchConfig((prev) => ({
                                ...prev,
                                extra_system_dependencies: removeAt(prev.extra_system_dependencies, index())
                              }))
                            }
                            title={tx('Remover dependência', 'Remove dependency')}
                          >
                            <IconTrash class="size-4" />
                          </Button>
                        </div>
                      )}
                    </For>
                  </div>
                ) : undefined
              }
            >
              <Dialog open={extraDependencyDialogOpen()} onOpenChange={setExtraDependencyDialogOpen}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="inline-flex items-center gap-1.5"
                  onClick={() => setExtraDependencyDialogOpen(true)}
                >
                  <IconPlus class="size-4" />
                  {tx('Adicionar dependência', 'Add dependency')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tx('Adicionar dependência extra do sistema', 'Add extra system dependency')}</DialogTitle>
                    <DialogDescription>
                      {tx(
                        'Informe como o doctor pode detectar essa dependência (comando, variáveis e paths padrão).',
                        'Define how doctor can detect this dependency (command, env vars and default paths).'
                      )}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <Input
                      value={extraDependencyDraft().name}
                      placeholder={tx('Nome da dependência', 'Dependency name')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          name: e.currentTarget.value
                        }))
                      }
                    />

                    <Input
                      value={extraDependencyDraft().command}
                      placeholder={tx('Comando no terminal (ex.: mangohud)', 'Terminal command (e.g. mangohud)')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          command: e.currentTarget.value
                        }))
                      }
                    />

                    <Input
                      value={extraDependencyDraft().env_vars}
                      placeholder={tx('Variáveis de ambiente (separadas por vírgula)', 'Environment vars (comma-separated)')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          env_vars: e.currentTarget.value
                        }))
                      }
                    />

                    <Input
                      value={extraDependencyDraft().paths}
                      placeholder={tx('Paths padrão (separados por vírgula)', 'Default paths (comma-separated)')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          paths: e.currentTarget.value
                        }))
                      }
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setExtraDependencyDialogOpen(false)}>
                      {tx('Cancelar', 'Cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!extraDependencyDraft().name.trim()}
                      onClick={() => {
                        const draft = extraDependencyDraft()
                        if (!draft.name.trim()) return

                        patchConfig((prev) => ({
                          ...prev,
                          extra_system_dependencies: [
                            ...prev.extra_system_dependencies,
                            {
                              name: draft.name.trim(),
                              state: 'MandatoryOn',
                              check_commands: splitCommaList(draft.command),
                              check_env_vars: splitCommaList(draft.env_vars),
                              check_paths: splitCommaList(draft.paths)
                            }
                          ]
                        }))

                        setExtraDependencyDraft({
                          name: '',
                          command: '',
                          env_vars: '',
                          paths: ''
                        })
                        setExtraDependencyDialogOpen(false)
                      }}
                    >
                      {tx('Confirmar', 'Confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>
          </section>
        </Show>

        <Show when={activeTab() === 'performance'}>
          <section class="stack">
            <FeatureStateField
              label="Gamescope"
              help={tx(
                'Define política do gamescope e sincroniza com requirements.gamescope.',
                'Defines gamescope policy and syncs with requirements.gamescope.'
              )}
              value={config().environment.gamescope.state}
              onChange={setGamescopeState}
              footer={
                <Show
                  when={gamescopeEnabled()}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {tx(
                        'Gamescope está desativado. Ative para configurar resolução, upscale e janela.',
                        'Gamescope is disabled. Enable it to configure resolution, upscale and window mode.'
                      )}
                    </div>
                  }
                >
                  <div class="grid gap-3">
                    <div class="grid gap-3 md:grid-cols-2">
                      <div class="rounded-md border border-border/60 bg-muted/30 p-3">
                        <div class="space-y-1.5">
                          <p class="text-sm font-medium">{tx('Método de upscale', 'Upscale method')}</p>
                          <p class="text-xs text-muted-foreground">
                            {tx('Método usado pelo gamescope para upscale.', 'Method used by gamescope for upscaling.')}
                          </p>
                        </div>
                        <Tabs
                          value={config().environment.gamescope.upscale_method}
                          onChange={(value) =>
                            patchConfig((prev) => ({
                              ...prev,
                              environment: {
                                ...prev.environment,
                                gamescope: {
                                  ...prev.environment.gamescope,
                                  upscale_method: value as UpscaleMethod,
                                  fsr: value === 'fsr'
                                }
                              }
                            }))
                          }
                          class="mt-3"
                        >
                          <TabsList class="grid h-auto w-full grid-cols-4 gap-1">
                            <For each={upscaleMethodOptions()}>
                              {(option) => (
                                <TabsTrigger
                                  value={option.value}
                                  class="h-auto w-full whitespace-normal px-2 py-2 text-center leading-tight"
                                >
                                  {option.label}
                                </TabsTrigger>
                              )}
                            </For>
                          </TabsList>
                        </Tabs>
                      </div>

                      <div class="rounded-md border border-border/60 bg-muted/30 p-3">
                        <div class="space-y-1.5">
                          <p class="text-sm font-medium">{tx('Tipo de janela', 'Window type')}</p>
                          <p class="text-xs text-muted-foreground">
                            {tx('Define comportamento da janela no gamescope.', 'Defines gamescope window behavior.')}
                          </p>
                        </div>
                        <Tabs
                          value={config().environment.gamescope.window_type}
                          onChange={(value) =>
                            patchConfig((prev) => ({
                              ...prev,
                              environment: {
                                ...prev.environment,
                                gamescope: {
                                  ...prev.environment.gamescope,
                                  window_type: value as GamescopeWindowType
                                }
                              }
                            }))
                          }
                          class="mt-3"
                        >
                          <TabsList class="grid h-auto w-full grid-cols-3 gap-1">
                            <For each={windowTypeOptions()}>
                              {(option) => (
                                <TabsTrigger
                                  value={option.value}
                                  class="h-auto w-full whitespace-normal px-2 py-2 text-center leading-tight"
                                >
                                  {option.label}
                                </TabsTrigger>
                              )}
                            </For>
                          </TabsList>
                        </Tabs>
                      </div>
                    </div>

                    <div class="grid gap-3 md:grid-cols-2">
                      <div class="rounded-md border border-border/60 bg-muted/30 p-3">
                        <div class="space-y-1.5">
                          <p class="text-sm font-medium">{tx('Resolução do jogo', 'Game resolution')}</p>
                          <p class="text-xs text-muted-foreground">
                            {tx('Resolução renderizada pelo jogo (largura x altura).', 'Game render resolution (width x height).')}
                          </p>
                        </div>
                        <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                          <Input
                            value={config().environment.gamescope.game_width}
                            placeholder="1080"
                            onInput={(e) =>
                              patchConfig((prev) => ({
                                ...prev,
                                environment: {
                                  ...prev.environment,
                                  gamescope: {
                                    ...prev.environment.gamescope,
                                    game_width: e.currentTarget.value
                                  }
                                }
                              }))
                            }
                          />
                          <span class="text-sm font-semibold text-muted-foreground">x</span>
                          <Input
                            value={config().environment.gamescope.game_height}
                            placeholder="720"
                            onInput={(e) =>
                              patchConfig((prev) => ({
                                ...prev,
                                environment: {
                                  ...prev.environment,
                                  gamescope: {
                                    ...prev.environment.gamescope,
                                    game_height: e.currentTarget.value
                                  }
                                }
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div class="rounded-md border border-border/60 bg-muted/30 p-3">
                        <div class="space-y-1.5">
                          <p class="text-sm font-medium">{tx('Resolução da tela', 'Display resolution')}</p>
                          <p class="text-xs text-muted-foreground">
                            {tx('Resolução final de saída do gamescope (largura x altura).', 'Final gamescope output resolution (width x height).')}
                          </p>
                        </div>

                        <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                          <Input
                            value={config().environment.gamescope.output_width}
                            placeholder={gamescopeUsesMonitorResolution() ? tx('Auto', 'Auto') : '1920'}
                            onInput={(e) => setGamescopeOutputWidth(e.currentTarget.value)}
                          />
                          <span class="text-sm font-semibold text-muted-foreground">x</span>
                          <Input
                            value={config().environment.gamescope.output_height}
                            placeholder={gamescopeUsesMonitorResolution() ? tx('Auto', 'Auto') : '1080'}
                            onInput={(e) => setGamescopeOutputHeight(e.currentTarget.value)}
                          />
                        </div>

                        <div class="mt-3">
                          <SwitchChoiceCard
                            title={tx('Obter resolução do monitor', 'Use monitor resolution')}
                            checked={gamescopeUsesMonitorResolution()}
                            onChange={(checked) => {
                              if (!checked) return
                              patchConfig((prev) => ({
                                ...prev,
                                environment: {
                                  ...prev.environment,
                                  gamescope: {
                                    ...prev.environment.gamescope,
                                    output_width: '',
                                    output_height: '',
                                    resolution: null
                                  }
                                }
                              }))
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div class="grid gap-3 md:grid-cols-2">
                      <SwitchChoiceCard
                        title={tx('Limitar FPS', 'Enable FPS limiter')}
                        description={tx('Ativa limitador de FPS do gamescope.', 'Enables gamescope FPS limiter.')}
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

                      <SwitchChoiceCard
                        title={tx('Forçar captura de cursor', 'Force grab cursor')}
                        description={tx(
                          'Força modo relativo de mouse para evitar perda de foco.',
                          'Forces relative mouse mode to avoid focus loss.'
                        )}
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
                    </div>

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

                    <StringListField
                      label={tx('Opções adicionais do gamescope', 'Gamescope additional options')}
                      help={tx(
                        'Adicione flags extras que serão anexadas ao comando do gamescope.',
                        'Add extra flags that will be appended to the gamescope command.'
                      )}
                      items={gamescopeAdditionalOptionsList()}
                      onChange={setGamescopeAdditionalOptionsList}
                      placeholder={tx('--prefer-vk-device 1002:73bf', '--prefer-vk-device 1002:73bf')}
                      addLabel={tx('Adicionar opção', 'Add option')}
                    />
                  </div>
                </Show>
              }
            />

            <FeatureStateField
              label="Gamemode"
              help={tx('Define política do gamemode.', 'Defines gamemode policy.')}
              value={config().environment.gamemode}
              onChange={setGamemodeState}
            />

            <FeatureStateField
              label="MangoHud"
              help={tx('Define política do MangoHud.', 'Defines MangoHud policy.')}
              value={config().environment.mangohud}
              onChange={setMangohudState}
            />

            <FeatureStateField
              label="Wine-Wayland"
              help={tx('Política para ativar Wine-Wayland.', 'Policy for enabling Wine-Wayland.')}
              value={config().compatibility.wine_wayland}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    wine_wayland: value
                  }
                }))
              }
              footer={
                wineWaylandEnabled() ? (
                  <FeatureStateField
                    label="HDR"
                    help={tx('Política para HDR (depende de Wine-Wayland).', 'Policy for HDR (depends on Wine-Wayland).')}
                    value={config().compatibility.hdr}
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
                ) : undefined
              }
            />

            <FeatureStateField
              label="Auto DXVK-NVAPI"
              help={tx('Controla aplicação automática de DXVK-NVAPI.', 'Controls automatic DXVK-NVAPI setup.')}
              value={config().compatibility.auto_dxvk_nvapi}
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

            <FeatureStateField
              label="Staging"
              help={tx('Controla obrigatoriedade de runtime Wine com staging.', 'Controls mandatory usage of Wine staging runtime.')}
              value={config().compatibility.staging}
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

            <FeatureStateField
              label={tx('Usar GPU dedicada', 'Use dedicated GPU')}
              help={tx(
                'Exporta variáveis de PRIME render offload para tentar usar a GPU dedicada em sistemas híbridos.',
                'Exports PRIME render offload variables to try using the dedicated GPU on hybrid systems.'
              )}
              value={config().environment.prime_offload}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  environment: {
                    ...prev.environment,
                    prime_offload: value
                  }
                }))
              }
            />
          </section>
        </Show>

        <Show when={activeTab() === 'prefix'}>
          <section class="stack">
            <FieldShell
              label={tx('Prefix path final', 'Final prefix path')}
              help={tx(
                'Calculado automaticamente a partir do hash do executável.',
                'Automatically calculated from executable hash.'
              )}
            >
              <div class="picker-row">
                <Input value={prefixPathPreview()} readOnly class="readonly" />
                <Button
                  type="button"
                  class="btn-secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(prefixPathPreview())
                      setStatusMessage(tx('Path do prefixo copiado.', 'Prefix path copied.'))
                    } catch {
                      setStatusMessage(tx('Falha ao copiar para área de transferência.', 'Failed to copy to clipboard.'))
                    }
                  }}
                >
                  {tx('Copiar', 'Copy')}
                </Button>
              </div>
            </FieldShell>

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
                  <Input
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
                  <Button type="button" class="btn-secondary" onClick={addWinetricksFromSearch}>
                    {tx('Adicionar', 'Add')}
                  </Button>
                  <Button type="button" class="btn-secondary" onClick={loadWinetricksCatalog} disabled={winetricksLoading()}>
                    {winetricksLoading() ? tx('Carregando...', 'Loading...') : tx('Atualizar catálogo', 'Refresh catalog')}
                  </Button>
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
                        <Button type="button" class="winetricks-result" onClick={() => addWinetricksVerb(verb)}>
                          <span>{verb}</span>
                          <span>{tx('Adicionar', 'Add')}</span>
                        </Button>
                      )}
                    </For>
                  </div>
                </Show>

                <div class="table-list">
                  <For each={config().dependencies}>
                    {(verb) => (
                      <div class="table-row table-row-single">
                        <Input value={verb} readOnly class="readonly" />
                        <Button type="button" class="btn-danger" onClick={() => removeWinetricksVerb(verb)}>
                          {tx('Remover', 'Remove')}
                        </Button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </FieldShell>

            <FieldShell
              label={tx('Chaves de registro', 'Registry keys')}
              help={tx('Tabela de chaves aplicadas no prefixo após bootstrap.', 'Table of keys applied to prefix after bootstrap.')}
              controlClass="flex justify-end"
              footer={
                <div class="grid gap-2">
                  <Show
                    when={config().registry_keys.length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {tx('Nenhuma chave adicionada.', 'No key added.')}
                      </div>
                    }
                  >
                    <For each={config().registry_keys}>
                      {(item, index) => (
                        <div class="grid items-center gap-2 rounded-md border px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_minmax(0,1fr)_auto]">
                          <span class="truncate text-sm font-medium">{item.path}</span>
                          <span class="truncate text-sm">{item.name}</span>
                          <span class="truncate text-xs text-muted-foreground">{item.value_type}</span>
                          <span class="truncate text-sm text-muted-foreground">{item.value}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              patchConfig((prev) => ({
                                ...prev,
                                registry_keys: removeAt(prev.registry_keys, index())
                              }))
                            }
                            title={tx('Remover chave', 'Remove key')}
                          >
                            <IconTrash class="size-4" />
                          </Button>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              }
            >
              <Dialog open={registryDialogOpen()} onOpenChange={setRegistryDialogOpen}>
                <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setRegistryDialogOpen(true)}>
                  <IconPlus class="size-4" />
                  {tx('Adicionar chave', 'Add key')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tx('Adicionar chave de registro', 'Add registry key')}</DialogTitle>
                    <DialogDescription>
                      {tx('Preencha os campos e confirme para adicionar a linha.', 'Fill fields and confirm to add row.')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <Input
                      value={registryDraft().path}
                      placeholder={tx('Path (HKCU\\...)', 'Path (HKCU\\...)')}
                      onInput={(e) =>
                        setRegistryDraft((prev) => ({
                          ...prev,
                          path: e.currentTarget.value
                        }))
                      }
                    />
                    <Input
                      value={registryDraft().name}
                      placeholder={tx('Nome da chave', 'Key name')}
                      onInput={(e) =>
                        setRegistryDraft((prev) => ({
                          ...prev,
                          name: e.currentTarget.value
                        }))
                      }
                    />
                    <div class="grid gap-2 md:grid-cols-2">
                      <Input
                        value={registryDraft().value_type}
                        placeholder={tx('Tipo (REG_SZ)', 'Type (REG_SZ)')}
                        onInput={(e) =>
                          setRegistryDraft((prev) => ({
                            ...prev,
                            value_type: e.currentTarget.value
                          }))
                        }
                      />
                      <Input
                        value={registryDraft().value}
                        placeholder={tx('Valor', 'Value')}
                        onInput={(e) =>
                          setRegistryDraft((prev) => ({
                            ...prev,
                            value: e.currentTarget.value
                          }))
                        }
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setRegistryDialogOpen(false)}>
                      {tx('Cancelar', 'Cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!registryDraft().path.trim() || !registryDraft().name.trim()}
                      onClick={() => {
                        const draft = registryDraft()
                        if (!draft.path.trim() || !draft.name.trim()) return
                        patchConfig((prev) => ({
                          ...prev,
                          registry_keys: [...prev.registry_keys, draft]
                        }))
                        setRegistryDraft({ path: '', name: '', value_type: 'REG_SZ', value: '' })
                        setRegistryDialogOpen(false)
                      }}
                    >
                      {tx('Confirmar', 'Confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>

            <FieldShell
              label={tx('Import de .reg', '.reg import')}
              help={tx('Selecione um arquivo .reg para importação futura no setup.', 'Select a .reg file for future setup import.')}
            >
              <div class="picker-row">
                <Input value={registryImportPath()} placeholder="./patches/game.reg" onInput={(e) => setRegistryImportPath(e.currentTarget.value)} />
                <Button type="button" class="btn-secondary" onClick={pickRegistryFile}>
                  {tx('Selecionar arquivo', 'Select file')}
                </Button>
              </div>
            </FieldShell>

            <FieldShell
              label={tx('Pastas montadas (folder_mounts)', 'Mounted folders (folder_mounts)')}
              help={tx('Mapeia pasta relativa do jogo para destino Windows dentro do prefixo.', 'Maps game-relative folder to Windows target path inside prefix.')}
              controlClass="flex justify-end"
              footer={
                <div class="grid gap-2">
                  <Show
                    when={config().folder_mounts.length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {tx('Nenhuma montagem adicionada.', 'No mount added.')}
                      </div>
                    }
                  >
                    <For each={config().folder_mounts}>
                      {(item, index) => (
                        <div class="grid items-center gap-2 rounded-md border px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto]">
                          <span class="truncate text-sm font-medium">{item.source_relative_path}</span>
                          <span class="truncate text-sm text-muted-foreground">{item.target_windows_path}</span>
                          <span class="text-xs text-muted-foreground">
                            {item.create_source_if_missing
                              ? tx('Criar origem: sim', 'Create source: yes')
                              : tx('Criar origem: não', 'Create source: no')}
                          </span>
                          <div class="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              class="h-8 px-2 text-xs"
                              onClick={() => void pickMountFolder(index())}
                            >
                              {tx('Pasta', 'Folder')}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                patchConfig((prev) => ({
                                  ...prev,
                                  folder_mounts: removeAt(prev.folder_mounts, index())
                                }))
                              }
                              title={tx('Remover montagem', 'Remove mount')}
                            >
                              <IconTrash class="size-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              }
            >
              <Dialog open={mountDialogOpen()} onOpenChange={setMountDialogOpen}>
                <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setMountDialogOpen(true)}>
                  <IconPlus class="size-4" />
                  {tx('Adicionar montagem', 'Add mount')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tx('Adicionar montagem', 'Add mount')}</DialogTitle>
                    <DialogDescription>
                      {tx(
                        'Defina origem relativa e destino Windows para criar a montagem.',
                        'Set relative source and Windows target to create the mount.'
                      )}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <div class="picker-row">
                      <Input
                        value={mountDraft().source_relative_path}
                        placeholder={tx('Origem relativa (ex.: save)', 'Relative source (e.g. save)')}
                        onInput={(e) =>
                          setMountDraft((prev) => ({
                            ...prev,
                            source_relative_path: e.currentTarget.value
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          const relative = await pickMountSourceRelative()
                          if (!relative) return
                          setMountDraft((prev) => ({
                            ...prev,
                            source_relative_path: relative
                          }))
                        }}
                      >
                        {tx('Escolher pasta', 'Choose folder')}
                      </Button>
                    </div>

                    <Input
                      value={mountDraft().target_windows_path}
                      placeholder={tx('Destino Windows (C:\\users\\...)', 'Windows target (C:\\users\\...)')}
                      onInput={(e) =>
                        setMountDraft((prev) => ({
                          ...prev,
                          target_windows_path: e.currentTarget.value
                        }))
                      }
                    />

                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={mountDraft().create_source_if_missing}
                        onInput={(e) =>
                          setMountDraft((prev) => ({
                            ...prev,
                            create_source_if_missing: e.currentTarget.checked
                          }))
                        }
                      />
                      {tx('Criar origem se estiver ausente', 'Create source if missing')}
                    </label>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setMountDialogOpen(false)}>
                      {tx('Cancelar', 'Cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!mountDraft().source_relative_path.trim() || !mountDraft().target_windows_path.trim()}
                      onClick={() => {
                        const draft = mountDraft()
                        if (!draft.source_relative_path.trim() || !draft.target_windows_path.trim()) return
                        patchConfig((prev) => ({
                          ...prev,
                          folder_mounts: [...prev.folder_mounts, draft]
                        }))
                        setMountDraft({
                          source_relative_path: '',
                          target_windows_path: '',
                          create_source_if_missing: true
                        })
                        setMountDialogOpen(false)
                      }}
                    >
                      {tx('Confirmar', 'Confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>
          </section>
        </Show>

        <Show when={activeTab() === 'winecfg'}>
          <section class="stack">
            <FieldShell
              label={tx('Substituição de DLL', 'DLL overrides')}
              help={tx('Configura overrides por DLL como native/builtin.', 'Configures per-DLL overrides such as native/builtin.')}
              controlClass="flex justify-end"
              footer={
                <div class="grid gap-2">
                  <Show
                    when={config().winecfg.dll_overrides.length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {tx('Nenhum override adicionado.', 'No override added.')}
                      </div>
                    }
                  >
                    <For each={config().winecfg.dll_overrides}>
                      {(item, index) => (
                        <div class="grid items-center gap-2 rounded-md border px-3 py-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                          <span class="truncate text-sm font-medium">{item.dll}</span>
                          <span class="truncate text-xs text-muted-foreground">{item.mode}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              patchConfig((prev) => ({
                                ...prev,
                                winecfg: {
                                  ...prev.winecfg,
                                  dll_overrides: removeAt(prev.winecfg.dll_overrides, index())
                                }
                              }))
                            }
                            title={tx('Remover', 'Remove')}
                          >
                            <IconTrash class="size-4" />
                          </Button>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              }
            >
              <Dialog open={dllDialogOpen()} onOpenChange={setDllDialogOpen}>
                <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setDllDialogOpen(true)}>
                  <IconPlus class="size-4" />
                  {tx('Adicionar DLL override', 'Add DLL override')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tx('Adicionar DLL override', 'Add DLL override')}</DialogTitle>
                    <DialogDescription>
                      {tx('Defina o nome da DLL e o modo de substituição.', 'Set the DLL name and override mode.')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <Input
                      value={dllDraft().dll}
                      placeholder="d3dcompiler_47"
                      onInput={(e) =>
                        setDllDraft((prev) => ({
                          ...prev,
                          dll: e.currentTarget.value
                        }))
                      }
                    />
                    <Select
                      value={dllDraft().mode}
                      onInput={(e) =>
                        setDllDraft((prev) => ({
                          ...prev,
                          mode: e.currentTarget.value
                        }))
                      }
                    >
                      <For each={dllModeOptions()}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                    </Select>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDllDialogOpen(false)}>
                      {tx('Cancelar', 'Cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!dllDraft().dll.trim()}
                      onClick={() => {
                        const draft = dllDraft()
                        if (!draft.dll.trim()) return
                        patchConfig((prev) => ({
                          ...prev,
                          winecfg: {
                            ...prev.winecfg,
                            dll_overrides: [...prev.winecfg.dll_overrides, draft]
                          }
                        }))
                        setDllDraft({ dll: '', mode: 'builtin' })
                        setDllDialogOpen(false)
                      }}
                    >
                      {tx('Confirmar', 'Confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>

            <FeatureStateField
              label={tx('Capturar mouse automaticamente', 'Auto capture mouse')}
              help={tx('Equivalente à opção de captura automática do winecfg.', 'Equivalent to winecfg auto capture mouse option.')}
              value={config().winecfg.auto_capture_mouse}
              onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, auto_capture_mouse: value } }))}
            />

            <FeatureStateField
              label={tx('Permitir decoração de janelas (WM)', 'Allow window decorations (WM)')}
              help={tx('Controla se o gerenciador de janelas decora janelas do jogo.', 'Controls whether window manager decorates game windows.')}
              value={config().winecfg.window_decorations}
              onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, window_decorations: value } }))}
            />

            <FeatureStateField
              label={tx('Permitir controle de janelas (WM)', 'Allow window control (WM)')}
              help={tx('Controla se o WM pode gerenciar posição/estado das janelas.', 'Controls whether WM can manage window position/state.')}
              value={config().winecfg.window_manager_control}
              onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, window_manager_control: value } }))}
            />

            <FeatureStateField
              label={tx('Desktop virtual (estado)', 'Virtual desktop (state)')}
              help={tx('Ativa/desativa emulação de desktop virtual no Wine.', 'Enables/disables virtual desktop emulation in Wine.')}
              value={config().winecfg.virtual_desktop.state}
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

            <FeatureStateField
              label={tx('Integração com desktop', 'Desktop integration')}
              help={tx('Controla integração Wine com shell/desktop do Linux.', 'Controls Wine integration with Linux shell/desktop.')}
              value={config().winecfg.desktop_integration}
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
                <Button
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
                </Button>
              </div>

              <div class="table-list">
                <For each={config().winecfg.drives}>
                  {(item, index) => (
                    <div class="table-row table-row-three">
                      <Input
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
                      <Input
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
                      <Select
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
                      </Select>

                      <Button
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
                      </Button>
                    </div>
                  )}
                </For>

                <Button
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
                </Button>
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
              controlClass="flex justify-end"
              footer={
                <div class="grid gap-2">
                  <Show
                    when={config().compatibility.wrapper_commands.length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {tx('Nenhum wrapper adicionado.', 'No wrapper added.')}
                      </div>
                    }
                  >
                    <For each={config().compatibility.wrapper_commands}>
                      {(item, index) => (
                        <div class="grid items-center gap-2 rounded-md border px-3 py-2 md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                          <span class="truncate text-xs text-muted-foreground">{item.state}</span>
                          <span class="truncate text-sm font-medium">{item.executable}</span>
                          <span class="truncate text-sm text-muted-foreground">{item.args}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              patchConfig((prev) => ({
                                ...prev,
                                compatibility: {
                                  ...prev.compatibility,
                                  wrapper_commands: removeAt(prev.compatibility.wrapper_commands, index())
                                }
                              }))
                            }
                            title={tx('Remover wrapper', 'Remove wrapper')}
                          >
                            <IconTrash class="size-4" />
                          </Button>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              }
            >
              <Dialog open={wrapperDialogOpen()} onOpenChange={setWrapperDialogOpen}>
                <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setWrapperDialogOpen(true)}>
                  <IconPlus class="size-4" />
                  {tx('Adicionar wrapper', 'Add wrapper')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tx('Adicionar wrapper', 'Add wrapper')}</DialogTitle>
                    <DialogDescription>
                      {tx('Defina política, executável e argumentos do wrapper.', 'Set policy, executable and wrapper arguments.')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <Select
                      value={wrapperDraft().state}
                      onInput={(e) =>
                        setWrapperDraft((prev) => ({
                          ...prev,
                          state: e.currentTarget.value as FeatureState
                        }))
                      }
                    >
                      <For each={featureStateOptions()}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                    </Select>
                    <Input
                      value={wrapperDraft().executable}
                      placeholder={tx('Executável (ex.: gamescope)', 'Executable (e.g. gamescope)')}
                      onInput={(e) =>
                        setWrapperDraft((prev) => ({
                          ...prev,
                          executable: e.currentTarget.value
                        }))
                      }
                    />
                    <Input
                      value={wrapperDraft().args}
                      placeholder={tx('Args (ex.: -w 1920 -h 1080)', 'Args (e.g. -w 1920 -h 1080)')}
                      onInput={(e) =>
                        setWrapperDraft((prev) => ({
                          ...prev,
                          args: e.currentTarget.value
                        }))
                      }
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setWrapperDialogOpen(false)}>
                      {tx('Cancelar', 'Cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!wrapperDraft().executable.trim()}
                      onClick={() => {
                        const draft = wrapperDraft()
                        if (!draft.executable.trim()) return
                        patchConfig((prev) => ({
                          ...prev,
                          compatibility: {
                            ...prev.compatibility,
                            wrapper_commands: [...prev.compatibility.wrapper_commands, draft]
                          }
                        }))
                        setWrapperDraft({
                          state: 'OptionalOff',
                          executable: '',
                          args: ''
                        })
                        setWrapperDialogOpen(false)
                      }}
                    >
                      {tx('Confirmar', 'Confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
              <Button type="button" class="btn-test" onClick={runTest}>
                {t('testButton')}
              </Button>
              <Button type="button" class="btn-primary" onClick={runCreate}>
                {t('createButton')}
              </Button>
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
          </CardContent>
        </Card>
      </div>

      <div classList={{ 'status-toast': true, [statusTone()]: true }}>{statusMessage()}</div>
    </div>
  )
}
