import { createEffect, createMemo, createSignal, For, JSX, Show } from 'solid-js'
import { IconAlertCircle, IconChevronDown, IconMenu2, IconPlus, IconTrash, IconX } from '@tabler/icons-solidjs'
import { Toaster, toast } from 'solid-sonner'

import { invokeCommand } from '../../api/tauri'
import {
  FeatureStateField,
  FieldShell,
  KeyValueListField,
  SegmentedField,
  SelectField,
  StringListField,
  TextInputField,
  ToggleField,
  WinecfgFeatureStateField
} from '../../components/form/FormControls'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
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
import { Spinner } from '../../components/ui/spinner'
import { Switch, SwitchControl, SwitchInput, SwitchThumb } from '../../components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Textarea } from '../../components/ui/textarea'
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
  if (tab === 'performance') return tx('Melhorias', 'Enhancements')
  if (tab === 'prefix') return tx('Dependências', 'Dependencies')
  if (tab === 'winecfg') return 'Winecfg'
  if (tab === 'wrappers') return tx('Execução e Ambiente', 'Launch and Environment')
  if (tab === 'scripts') return tx('Scripts', 'Scripts')
  return tx('Revisão e Gerar', 'Review and Generate')
}

type AccordionSectionProps = {
  title: string
  description?: string
  open: boolean
  onToggle: () => void
  children: JSX.Element
}

function AccordionSection(props: AccordionSectionProps) {
  return (
    <section class="rounded-xl border border-border/70 bg-card/80">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={props.onToggle}
      >
        <div class="min-w-0">
          <p class="text-sm font-semibold">{props.title}</p>
          <Show when={props.description}>
            <p class="text-xs text-muted-foreground">{props.description}</p>
          </Show>
        </div>
        <IconChevronDown
          class={
            'size-4 shrink-0 text-muted-foreground transition-transform ' +
            (props.open ? 'rotate-180' : '')
          }
        />
      </button>
      <Show when={props.open}>
        <div class="border-t border-border/60 px-4 py-3">{props.children}</div>
      </Show>
    </section>
  )
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

type ImportRegistryFileOutput = {
  entries: Array<{ path: string; name: string; value_type: string; value: string }>
  warnings: string[]
}

type ListChildDirectoriesOutput = {
  path: string
  directories: string[]
}

function isLikelyAbsolutePath(path: string) {
  const trimmed = path.trim()
  return trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)
}

function posixDirname(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalized || normalized === '/') return '/'
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return '/'
  return normalized.slice(0, idx)
}

function buildAncestorPathsFromExe(exePath: string): string[] {
  if (!isLikelyAbsolutePath(exePath)) return []
  const dir = posixDirname(exePath)
  const normalized = dir.replace(/\\/g, '/')
  if (!normalized.startsWith('/')) return [dir]
  const parts = normalized.split('/').filter(Boolean)
  const out: string[] = []
  let current = ''
  for (const part of parts) {
    current += `/${part}`
    out.push(current)
  }
  return out
}

function relativeInsideBase(base: string, target: string): string | null {
  const b = base.replace(/\\/g, '/').replace(/\/+$/, '')
  const t = target.replace(/\\/g, '/').replace(/\/+$/, '')
  if (t === b) return '.'
  if (!t.startsWith(`${b}/`)) return null
  return t.slice(b.length + 1) || '.'
}

function basenamePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(idx + 1) : normalized
}

function parseWxH(raw: string | null): { width: string; height: string } {
  if (!raw) return { width: '', height: '' }
  const [width, height] = raw.split('x')
  return { width: width ?? '', height: height ?? '' }
}

function buildWxH(width: string, height: string): string | null {
  const w = width.trim()
  const h = height.trim()
  if (!w || !h) return null
  return `${w}x${h}`
}

function featureStateEnabled(value: FeatureState): boolean {
  return value === 'MandatoryOn' || value === 'OptionalOn'
}

function featureStateMandatory(value: FeatureState): boolean {
  return value === 'MandatoryOn' || value === 'MandatoryOff'
}

function buildFeatureState(enabled: boolean, mandatory: boolean): FeatureState {
  if (enabled) return mandatory ? 'MandatoryOn' : 'OptionalOn'
  return mandatory ? 'MandatoryOff' : 'OptionalOff'
}

export default function CreatorPage() {
  const controller = useCreatorController()
  const { theme, setTheme } = useTheme()

  const {
    locale,
    setLocale,
    activeTab,
    setActiveTab,
    tabs,
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
    statusMessage,
    setStatusMessage,
    resultJson,
    winetricksAvailable,
    winetricksLoading,
    winetricksSource,
    winetricksSearch,
    setWinetricksSearch,
    winetricksCatalogError,
    config,
    patchConfig,
    configPreview,
    t,
    tx,
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
  const [registryImportWarningsOpen, setRegistryImportWarningsOpen] = createSignal(false)
  const [registryImportWarnings, setRegistryImportWarnings] = createSignal<string[]>([])
  const [gameRootChooserOpen, setGameRootChooserOpen] = createSignal(false)
  const [mountSourceBrowserOpen, setMountSourceBrowserOpen] = createSignal(false)
  const [mountBrowserPath, setMountBrowserPath] = createSignal('')
  const [mountBrowserDirs, setMountBrowserDirs] = createSignal<string[]>([])
  const [mountBrowserLoading, setMountBrowserLoading] = createSignal(false)

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
  const [wineDesktopFolderDialogOpen, setWineDesktopFolderDialogOpen] = createSignal(false)
  const [wineDesktopFolderDraft, setWineDesktopFolderDraft] = createSignal({
    folder_key: 'desktop',
    shortcut_name: '',
    linux_path: ''
  })
  const [wineDriveDialogOpen, setWineDriveDialogOpen] = createSignal(false)
  const [wineDriveDraft, setWineDriveDraft] = createSignal({
    letter: 'D',
    host_path: '',
    drive_type: 'auto',
    label: '',
    serial: ''
  })
  const [winecfgAccordionOpen, setWinecfgAccordionOpen] = createSignal<
    'graphics' | 'desktop' | 'drives' | 'audio' | null
  >(null)
  const [lastStatusToastMessage, setLastStatusToastMessage] = createSignal('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = createSignal(false)

  const wineWindowsVersionOptions = [
    { value: '__default__', label: tx('Padrão do runtime (não alterar)', 'Runtime default (do not override)') },
    { value: 'win11', label: 'Windows 11' },
    { value: 'win10', label: 'Windows 10' },
    { value: 'win81', label: 'Windows 8.1' },
    { value: 'win8', label: 'Windows 8' },
    { value: 'win7', label: 'Windows 7' },
    { value: 'vista', label: 'Windows Vista' },
    { value: 'winxp', label: 'Windows XP' }
  ] as const

  const wineDesktopFolderKeyOptions = [
    { value: 'desktop', label: tx('Desktop', 'Desktop') },
    { value: 'documents', label: tx('Documentos', 'Documents') },
    { value: 'downloads', label: tx('Downloads', 'Downloads') },
    { value: 'music', label: tx('Músicas', 'Music') },
    { value: 'pictures', label: tx('Imagens', 'Pictures') },
    { value: 'videos', label: tx('Vídeos', 'Videos') }
  ] as const

  const wineDriveTypeOptions = [
    { value: 'auto', label: tx('Auto detectar', 'Auto detect') },
    { value: 'local_disk', label: tx('Disco rígido local', 'Local hard disk') },
    { value: 'network_share', label: tx('Compartilhamento de rede', 'Network share') },
    { value: 'floppy', label: tx('Disquete', 'Floppy disk') },
    { value: 'cdrom', label: tx('CD-ROM', 'CD-ROM') }
  ] as const

  const allWineDriveLetters = 'DEFGHIJKLMNOPQRSTUVWXY'.split('')
  const availableWineDriveLetters = createMemo(() => {
    const used = new Set(
      config()
        .winecfg.drives.map((item) => item.letter.trim().toUpperCase())
        .filter(Boolean)
    )
    return allWineDriveLetters.filter((letter) => !used.has(letter))
  })

  const winecfgVirtualDesktopEnabled = createMemo(() =>
    featureStateEnabled(config().winecfg.virtual_desktop.state.state)
  )

  const winecfgVirtualDesktopResolution = createMemo(() =>
    parseWxH(config().winecfg.virtual_desktop.resolution)
  )

  const setWinecfgVirtualDesktopResolutionPart = (part: 'width' | 'height', value: string) => {
    patchConfig((prev) => {
      const current = parseWxH(prev.winecfg.virtual_desktop.resolution)
      const next = {
        width: part === 'width' ? value : current.width,
        height: part === 'height' ? value : current.height
      }

      return {
        ...prev,
        winecfg: {
          ...prev.winecfg,
          virtual_desktop: {
            ...prev.winecfg.virtual_desktop,
            resolution: buildWxH(next.width, next.height)
          }
        }
      }
    })
  }

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

  const importRegistryKeysFromRegFile = async () => {
    try {
      const selected = await pickRegistryFile()
      if (!selected) return

      if (!isLikelyAbsolutePath(selected)) {
        setStatusMessage(
          tx(
            'Importação de .reg requer caminho absoluto. No modo navegador (LAN), selecione no app Tauri local.',
            'Importing .reg requires an absolute path. In browser/LAN mode, use the local Tauri app.'
          )
        )
        return
      }

      const result = await invokeCommand<ImportRegistryFileOutput>('cmd_import_registry_file', {
        path: selected
      })

      const existingKeys = new Set(
        config().registry_keys.map((item) =>
          [item.path, item.name, item.value_type, item.value].join('\u0000')
        )
      )

      const deduped = result.entries.filter((item) => {
        const signature = [item.path, item.name, item.value_type, item.value].join('\u0000')
        if (existingKeys.has(signature)) return false
        existingKeys.add(signature)
        return true
      })

      if (deduped.length > 0) {
        patchConfig((prev) => ({
          ...prev,
          registry_keys: [...prev.registry_keys, ...deduped]
        }))
      }

      const warningSuffix =
        result.warnings.length > 0
          ? tx(
              ` (${result.warnings.length} aviso(s) ao importar)`,
              ` (${result.warnings.length} warning(s) while importing)`
            )
          : ''

      setStatusMessage(
        tx(
          `Importadas ${deduped.length} chave(s) de registro do arquivo .reg${warningSuffix}.`,
          `Imported ${deduped.length} registry key(s) from .reg file${warningSuffix}.`
        )
      )

      setRegistryImportWarnings(result.warnings)
      setRegistryImportWarningsOpen(result.warnings.length > 0)
    } catch (error) {
      setStatusMessage(
        tx(
          `Falha ao importar arquivo .reg: ${String(error)}`,
          `Failed to import .reg file: ${String(error)}`
        )
      )
    }
  }

  const gameRootAncestorCandidates = createMemo(() => buildAncestorPathsFromExe(exePath()))

  const openGameRootChooser = () => {
    if (!isLikelyAbsolutePath(exePath())) {
      void pickGameRootOverride()
      return
    }
    setGameRootChooserOpen(true)
  }

  const loadMountBrowserDirs = async (absolutePath: string) => {
    if (!isLikelyAbsolutePath(absolutePath)) {
      setStatusMessage(
        tx(
          'Navegador de pastas montadas requer caminho absoluto da pasta do jogo. Use o app Tauri local.',
          'Mounted-folder browser requires an absolute game root path. Use the local Tauri app.'
        )
      )
      return
    }
    setMountBrowserLoading(true)
    try {
      const result = await invokeCommand<ListChildDirectoriesOutput>('cmd_list_child_directories', {
        path: absolutePath
      })
      setMountBrowserPath(result.path)
      setMountBrowserDirs(result.directories)
    } catch (error) {
      setStatusMessage(
        tx(
          `Falha ao listar pastas: ${String(error)}`,
          `Failed to list folders: ${String(error)}`
        )
      )
    } finally {
      setMountBrowserLoading(false)
    }
  }

  const openMountSourceBrowser = async () => {
    const root = gameRoot().trim()
    if (!root) {
      setStatusMessage(tx('Selecione um executável primeiro para definir a pasta do jogo.', 'Select an executable first to define the game folder.'))
      return
    }
    if (!isLikelyAbsolutePath(root)) {
      setStatusMessage(
        tx(
          'No modo navegador (LAN), o mini navegador de pastas não consegue acessar o filesystem. Use o app Tauri local.',
          'In browser/LAN mode, the mini folder browser cannot access the filesystem. Use the local Tauri app.'
        )
      )
      return
    }
    await loadMountBrowserDirs(root)
    setMountSourceBrowserOpen(true)
  }

  const mountSourceBrowserSegments = createMemo(() => {
    const root = gameRoot().trim()
    const current = mountBrowserPath().trim()
    const relative = root && current ? relativeInsideBase(root, current) : null
    if (!relative || relative === '.') return [] as Array<{ label: string; path: string }>

    let acc = root
    return relative
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        acc = `${acc.replace(/\/+$/, '')}/${segment}`
        return { label: segment, path: acc }
      })
  })

  const mountSourceBrowserCurrentRelative = createMemo(() => {
    const relative = relativeInsideBase(gameRoot().trim(), mountBrowserPath().trim())
    return relative ?? ''
  })

  const cycleLocale = () => {
    setLocale(locale() === 'pt-BR' ? 'en-US' : 'pt-BR')
  }

  const cycleTheme = () => {
    const current = theme()
    if (current === 'dark') {
      setTheme('light')
      return
    }
    if (current === 'light') {
      setTheme('system')
      return
    }
    setTheme('dark')
  }

  const sidebarLocaleLabel = createMemo(() => `${tx('Idioma', 'Language')}: ${locale()}`)

  const sidebarThemeLabel = createMemo(() => {
    const current = theme()
    const label =
      current === 'dark'
        ? tx('Escuro', 'Dark')
        : current === 'light'
          ? tx('Claro', 'Light')
          : tx('Sistema', 'System')
    return `${tx('Tema', 'Theme')}: ${label}`
  })

  const tabIndex = createMemo(() => tabs.indexOf(activeTab()))
  const canGoPrevTab = createMemo(() => tabIndex() > 0)
  const canGoNextTab = createMemo(() => tabIndex() >= 0 && tabIndex() < tabs.length - 1)

  const goPrevTab = () => {
    const index = tabIndex()
    if (index <= 0) return
    setActiveTab(tabs[index - 1])
  }

  const goNextTab = () => {
    const index = tabIndex()
    if (index < 0 || index >= tabs.length - 1) return
    setActiveTab(tabs[index + 1])
  }

  const handleSidebarTabChange = (tab: CreatorTab) => {
    setActiveTab(tab)
    setMobileSidebarOpen(false)
  }

  createEffect(() => {
    const message = statusMessage().trim()
    if (!message) return
    if (message === lastStatusToastMessage()) return
    setLastStatusToastMessage(message)

    const readyPt = 'Pronto.'
    const readyEn = 'Ready.'
    if (message === readyPt || message === readyEn) return

    if (statusTone() === 'error') {
      toast.error(message)
      return
    }
    if (statusTone() === 'success') {
      toast.success(message)
      return
    }
    toast.info(message)
  })

  return (
    <div class="creator-page">
      <div class="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div class="hidden h-fit lg:sticky lg:top-4 lg:block">
          <AppSidebar
            appName="Game Orchestrator"
            activeTab={activeTab()}
            onTabChange={handleSidebarTabChange}
            tabLabel={(tab) => tabLabel(tab, controller)}
            localeLabel={sidebarLocaleLabel()}
            themeLabel={sidebarThemeLabel()}
            onCycleLocale={cycleLocale}
            onCycleTheme={cycleTheme}
          />
        </div>

        <Show when={mobileSidebarOpen()}>
          <div
            class="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div class="fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] p-3 lg:hidden">
            <AppSidebar
              class="h-full min-h-0 max-w-none"
              appName="Game Orchestrator"
              activeTab={activeTab()}
              onTabChange={handleSidebarTabChange}
              tabLabel={(tab) => tabLabel(tab, controller)}
              localeLabel={sidebarLocaleLabel()}
              themeLabel={sidebarThemeLabel()}
              onCycleLocale={cycleLocale}
              onCycleTheme={cycleTheme}
            />
          </div>
        </Show>

        <Card>
          <CardContent class="pt-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              class="lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label={tx('Abrir menu', 'Open menu')}
              title={tx('Abrir menu', 'Open menu')}
            >
              <IconMenu2 class="size-4" />
            </Button>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold">{tabLabel(activeTab(), controller)}</p>
              <p class="text-xs text-muted-foreground">
                {tx('Etapa', 'Step')} {Math.max(tabIndex(), 0) + 1}/{tabs.length}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={goPrevTab} disabled={!canGoPrevTab()}>
              {tx('Retornar', 'Back')}
            </Button>
            <Button type="button" onClick={goNextTab} disabled={!canGoNextTab()}>
              {tx('Avançar', 'Next')}
            </Button>
          </div>
        </div>
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
                <Button type="button" class="btn-secondary" onClick={openGameRootChooser}>
                  {tx('Escolher outra', 'Choose another')}
                </Button>
              </div>
            </FieldShell>

            <Dialog open={gameRootChooserOpen()} onOpenChange={setGameRootChooserOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{tx('Escolher pasta raiz do jogo', 'Choose game root folder')}</DialogTitle>
                  <DialogDescription>
                    {tx(
                      'A pasta raiz deve ser um ancestral da pasta onde está o executável principal.',
                      'The game root must be an ancestor of the folder that contains the main executable.'
                    )}
                  </DialogDescription>
                </DialogHeader>

                <Show
                  when={gameRootAncestorCandidates().length > 0}
                  fallback={
                    <div class="grid gap-3">
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {tx(
                          'Esse fluxo guiado precisa de um caminho absoluto do executável (modo Tauri local).',
                          'This guided flow requires an absolute executable path (local Tauri mode).'
                        )}
                      </div>
                      <div class="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            setGameRootChooserOpen(false)
                            await pickGameRootOverride()
                          }}
                        >
                          {tx('Usar seletor do sistema', 'Use system picker')}
                        </Button>
                      </div>
                    </div>
                  }
                >
                  <div class="grid gap-3">
                    <div class="rounded-md border border-border/60 bg-muted/25 p-3">
                      <p class="mb-2 text-xs font-medium text-muted-foreground">
                        {tx('Breadcrumb da pasta do executável', 'Executable folder breadcrumb')}
                      </p>
                      <nav class="overflow-x-auto" aria-label={tx('Caminho do executável', 'Executable path')}>
                        <ol class="flex min-w-max items-center gap-1 text-xs">
                          <For each={gameRootAncestorCandidates()}>
                            {(candidate, index) => (
                              <>
                                <Show when={index() > 0}>
                                  <li class="text-muted-foreground">/</li>
                                </Show>
                                <li>
                                  <Button
                                    type="button"
                                    variant={gameRoot() === candidate ? 'secondary' : 'ghost'}
                                    size="sm"
                                    class="h-7 px-2"
                                    onClick={() => {
                                      const exeDir = posixDirname(exePath())
                                      setGameRoot(candidate)
                                      setGameRootManualOverride(candidate !== exeDir)
                                      setGameRootChooserOpen(false)
                                    }}
                                  >
                                    {basenamePath(candidate) || '/'}
                                  </Button>
                                </li>
                              </>
                            )}
                          </For>
                        </ol>
                      </nav>
                    </div>

                    <div class="grid gap-2">
                      <p class="text-xs font-medium text-muted-foreground">
                        {tx(
                          'Selecione qual nível acima deve ser a pasta raiz do jogo.',
                          'Select which ancestor level should be the game root.'
                        )}
                      </p>
                      <div class="grid gap-2">
                        <For each={[...gameRootAncestorCandidates()].reverse()}>
                          {(candidate) => {
                            const exeDir = posixDirname(exePath())
                            const relativeToExe = relativeInsideBase(candidate, exeDir)
                            const isAutoRoot = candidate === exeDir
                            return (
                              <button
                                type="button"
                                class={
                                  'grid gap-1 rounded-md border px-3 py-2 text-left transition-colors ' +
                                  (gameRoot() === candidate
                                    ? 'border-primary/40 bg-muted/45'
                                    : 'border-border/60 bg-muted/20 hover:bg-muted/35')
                                }
                                onClick={() => {
                                  setGameRoot(candidate)
                                  setGameRootManualOverride(!isAutoRoot)
                                  setGameRootChooserOpen(false)
                                }}
                              >
                                <span class="text-sm font-medium">{candidate}</span>
                                <span class="text-xs text-muted-foreground">
                                  {isAutoRoot
                                    ? tx('Mesmo diretório do executável (automático)', 'Same directory as executable (automatic)')
                                    : tx(
                                        `Executável fica em: ./${relativeToExe ?? ''}`,
                                        `Executable lives in: ./${relativeToExe ?? ''}`
                                      )}
                                </span>
                              </button>
                            )
                          }}
                        </For>
                      </div>
                    </div>
                  </div>
                </Show>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setGameRootChooserOpen(false)}>
                    {tx('Fechar', 'Close')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
              emptyMessage={tx('Nenhum argumento adicionado.', 'No launch argument added.')}
              tableValueHeader={tx('Argumento', 'Argument')}
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
              emptyMessage={tx('Nenhum arquivo adicionado.', 'No file added.')}
              tableValueHeader={tx('Arquivo relativo', 'Relative file')}
            />

            <FieldShell
              label={tx('Pastas montadas (folder_mounts)', 'Mounted folders (folder_mounts)')}
              help={tx('Mapeia pasta relativa do jogo para destino Windows dentro do prefixo.', 'Maps game-relative folder to Windows target path inside prefix.')}
              controlClass="flex justify-end"
              footer={
                <Show
                  when={config().folder_mounts.length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {tx('Nenhuma montagem adicionada.', 'No mount added.')}
                    </div>
                  }
                >
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{tx('Origem relativa', 'Relative source')}</TableHead>
                          <TableHead>{tx('Destino Windows', 'Windows target')}</TableHead>
                          <TableHead>{tx('Criar origem', 'Create source')}</TableHead>
                          <TableHead class="w-[120px] text-right">{tx('Ações', 'Actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={config().folder_mounts}>
                          {(item, index) => (
                            <TableRow>
                              <TableCell class="max-w-[220px] truncate font-medium">
                                {item.source_relative_path}
                              </TableCell>
                              <TableCell class="max-w-[280px] truncate text-muted-foreground">
                                {item.target_windows_path}
                              </TableCell>
                              <TableCell class="text-xs text-muted-foreground">
                                {item.create_source_if_missing ? tx('Sim', 'Yes') : tx('Não', 'No')}
                              </TableCell>
                              <TableCell class="text-right">
                                <div class="flex items-center justify-end gap-1">
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
                              </TableCell>
                            </TableRow>
                          )}
                        </For>
                      </TableBody>
                    </Table>
                  </div>
                </Show>
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
                        onClick={() => void openMountSourceBrowser()}
                      >
                        {tx('Navegar pastas', 'Browse folders')}
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

              <Dialog open={mountSourceBrowserOpen()} onOpenChange={setMountSourceBrowserOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tx('Selecionar pasta dentro do jogo', 'Select folder inside game')}</DialogTitle>
                    <DialogDescription>
                      {tx(
                        'Mini navegador restrito à pasta raiz do jogo para evitar montagens fora do projeto.',
                        'Mini browser restricted to the game root to prevent mounts outside the project.'
                      )}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-3">
                    <div class="rounded-md border border-border/60 bg-muted/25 p-3">
                      <p class="mb-2 text-xs font-medium text-muted-foreground">
                        {tx('Caminho atual', 'Current path')}
                      </p>
                      <nav class="overflow-x-auto" aria-label={tx('Breadcrumb de pastas', 'Folder breadcrumb')}>
                        <ol class="flex min-w-max items-center gap-1 text-xs">
                          <Show when={gameRoot().trim()}>
                            <li>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                class="h-7 px-2"
                                onClick={() => void loadMountBrowserDirs(gameRoot())}
                              >
                                {basenamePath(gameRoot()) || '/'}
                              </Button>
                            </li>
                          </Show>
                          <For each={mountSourceBrowserSegments()}>
                            {(segment) => (
                              <>
                                <li class="text-muted-foreground">/</li>
                                <li>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="h-7 px-2"
                                    onClick={() => void loadMountBrowserDirs(segment.path)}
                                  >
                                    {segment.label}
                                  </Button>
                                </li>
                              </>
                            )}
                          </For>
                        </ol>
                      </nav>
                    </div>

                    <div class="rounded-md border border-border/60 bg-background/40">
                      <Show
                        when={!mountBrowserLoading()}
                        fallback={
                          <div class="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                            <Spinner class="size-3" />
                            {tx('Carregando pastas...', 'Loading folders...')}
                          </div>
                        }
                      >
                        <Show
                          when={mountBrowserDirs().length > 0}
                          fallback={
                            <div class="px-3 py-2 text-xs text-muted-foreground">
                              {tx('Nenhuma subpasta encontrada.', 'No subfolder found.')}
                            </div>
                          }
                        >
                          <div class="grid gap-1 p-1">
                            <For each={mountBrowserDirs()}>
                              {(dir) => (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  class="justify-start text-left"
                                  onClick={() => void loadMountBrowserDirs(dir)}
                                >
                                  {basenamePath(dir)}
                                </Button>
                              )}
                            </For>
                          </div>
                        </Show>
                      </Show>
                    </div>

                    <div class="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <div class="min-w-0">
                        <p class="text-xs font-medium text-muted-foreground">{tx('Selecionar esta pasta', 'Select this folder')}</p>
                        <p class="truncate text-xs">
                          {mountSourceBrowserCurrentRelative() || './'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => {
                          setMountDraft((prev) => ({
                            ...prev,
                            source_relative_path: mountSourceBrowserCurrentRelative() || './'
                          }))
                          setMountSourceBrowserOpen(false)
                        }}
                      >
                        {tx('Usar esta pasta', 'Use this folder')}
                      </Button>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setMountSourceBrowserOpen(false)}>
                      {tx('Fechar', 'Close')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>
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
              label="Winetricks"
              help={tx(
                'Ativa automaticamente quando existir ao menos um verbo configurado. Use a busca para adicionar verbos do catálogo.',
                'Enabled automatically when at least one verb is configured. Use search to add verbs from the catalog.'
              )}
              controlClass="flex flex-col items-end gap-2"
              footer={
                <div class="grid gap-2">
                  <div class="rounded-md border border-input bg-background px-2 py-2">
                    <div class="flex min-h-9 flex-wrap items-center gap-1.5">
                      <For each={config().dependencies}>
                        {(verb) => (
                          <span class="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/35 px-2 py-1 text-xs">
                            <span class="truncate">{verb}</span>
                            <button
                              type="button"
                              class="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                              onClick={() => removeWinetricksVerb(verb)}
                              aria-label={tx('Remover verbo', 'Remove verb')}
                              title={tx('Remover verbo', 'Remove verb')}
                            >
                              <IconX class="size-3" />
                            </button>
                          </span>
                        )}
                      </For>

                      <Input
                        value={winetricksSearch()}
                        disabled={winetricksCatalogError() || winetricksLoading()}
                        placeholder={
                          winetricksCatalogError()
                            ? tx('Erro ao carregar o catálogo winetricks', 'Failed to load winetricks catalog')
                            : tx('Buscar e adicionar verbos (ex.: vcrun, corefonts)', 'Search and add verbs (e.g. vcrun, corefonts)')
                        }
                        class="h-7 min-w-[220px] flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        onInput={(e) => setWinetricksSearch(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (winetricksCatalogError()) return
                            const exact = winetricksCandidates().find(
                              (item) => item.toLowerCase() === winetricksSearch().trim().toLowerCase()
                            )
                            if (exact) {
                              addWinetricksVerb(exact)
                              setWinetricksSearch('')
                              return
                            }
                            const first = winetricksCandidates()[0]
                            if (first) {
                              addWinetricksVerb(first)
                              setWinetricksSearch('')
                              return
                            }
                            addWinetricksFromSearch()
                          }
                        }}
                      />
                    </div>
                  </div>

                  <Show when={winetricksCatalogError()}>
                    <Alert variant="destructive">
                      <IconAlertCircle />
                      <AlertTitle>{tx('Erro ao carregar o catálogo winetricks', 'Failed to load winetricks catalog')}</AlertTitle>
                      <AlertDescription>
                        {tx(
                          'O catálogo local/remoto não pôde ser carregado. Você ainda pode atualizar o catálogo manualmente.',
                          'The local/remote catalog could not be loaded. You can still refresh the catalog manually.'
                        )}
                      </AlertDescription>
                    </Alert>
                  </Show>

                  <Show
                    when={!winetricksCatalogError() && normalizedWinetricksSearch().length >= 2}
                    fallback={
                      <Show when={!winetricksCatalogError()}>
                        <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                          {tx(
                            'Digite ao menos 2 caracteres para buscar verbos no catálogo.',
                            'Type at least 2 characters to search verbs in the catalog.'
                          )}
                        </div>
                      </Show>
                    }
                  >
                    <div class="max-h-52 overflow-auto rounded-md border border-border/60 bg-muted/25 p-1">
                      <Show
                        when={winetricksCandidates().length > 0}
                        fallback={
                          <div class="px-2 py-2 text-xs text-muted-foreground">
                            {tx('Nenhum item encontrado.', 'No items found.')}
                          </div>
                        }
                      >
                        <div class="grid gap-1">
                          <For each={winetricksCandidates()}>
                            {(verb) => (
                              <button
                                type="button"
                                class="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-accent/40"
                                onClick={() => {
                                  addWinetricksVerb(verb)
                                  setWinetricksSearch('')
                                }}
                              >
                                <span class="truncate">{verb}</span>
                                <span class="text-xs text-muted-foreground">{tx('Adicionar', 'Add')}</span>
                              </button>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              }
            >
              <div class="flex flex-col items-end gap-1.5">
                <Show when={winetricksLoading()}>
                  <div class="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner class="size-3" />
                    <span>{tx('Carregando catálogo em segundo plano...', 'Loading catalog in background...')}</span>
                  </div>
                </Show>
                <Button type="button" class="btn-secondary" onClick={loadWinetricksCatalog} disabled={winetricksLoading()}>
                  {winetricksLoading() ? tx('Carregando...', 'Loading...') : tx('Atualizar catálogo', 'Refresh catalog')}
                </Button>
                <p class="text-xs text-muted-foreground">
                  {tx('Fonte:', 'Source:')} <strong>{winetricksSource()}</strong> ·{' '}
                  {tx('Catálogo:', 'Catalog:')} <strong>{winetricksAvailable().length}</strong>
                </p>
              </div>
            </FieldShell>

            <FieldShell
              label={tx('Chaves de registro', 'Registry keys')}
              help={tx('Tabela de chaves aplicadas no prefixo após bootstrap.', 'Table of keys applied to prefix after bootstrap.')}
              controlClass="flex flex-wrap justify-end gap-2"
              footer={
                <Show
                  when={config().registry_keys.length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {tx('Nenhuma chave adicionada.', 'No key added.')}
                    </div>
                  }
                >
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{tx('Path', 'Path')}</TableHead>
                          <TableHead>{tx('Nome', 'Name')}</TableHead>
                          <TableHead>{tx('Tipo', 'Type')}</TableHead>
                          <TableHead>{tx('Valor', 'Value')}</TableHead>
                          <TableHead class="w-[72px] text-right">{tx('Ações', 'Actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={config().registry_keys}>
                          {(item, index) => (
                            <TableRow>
                              <TableCell class="max-w-[260px] truncate font-medium">{item.path}</TableCell>
                              <TableCell class="max-w-[180px] truncate">{item.name}</TableCell>
                              <TableCell class="max-w-[120px] truncate text-xs text-muted-foreground">
                                {item.value_type}
                              </TableCell>
                              <TableCell class="max-w-[260px] truncate text-muted-foreground">{item.value}</TableCell>
                              <TableCell class="text-right">
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
                              </TableCell>
                            </TableRow>
                          )}
                        </For>
                      </TableBody>
                    </Table>
                  </div>
                </Show>
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

              <Button
                type="button"
                variant="outline"
                size="sm"
                class="inline-flex items-center gap-1.5"
                onClick={importRegistryKeysFromRegFile}
              >
                <IconPlus class="size-4" />
                {tx('Adicionar de arquivo (.reg)', 'Add from file (.reg)')}
              </Button>

              <Dialog open={registryImportWarningsOpen()} onOpenChange={setRegistryImportWarningsOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tx('Avisos da importação de .reg', '.reg import warnings')}</DialogTitle>
                    <DialogDescription>
                      {tx(
                        'Algumas linhas foram ignoradas ou importadas com fallback. Revise os avisos abaixo.',
                        'Some lines were ignored or imported with fallback. Review the warnings below.'
                      )}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="max-h-[50vh] overflow-auto rounded-md border border-border/60 bg-muted/25 p-2">
                    <div class="grid gap-1">
                      <For each={registryImportWarnings()}>
                        {(warning, index) => (
                          <div class="rounded-md border border-border/40 bg-background/70 px-3 py-2 text-xs">
                            <span class="font-medium text-muted-foreground">{index() + 1}.</span>{' '}
                            <span class="break-words">{warning}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" onClick={() => setRegistryImportWarningsOpen(false)}>
                      {tx('Fechar', 'Close')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>

            <FieldShell
              label={tx('Dependências extras do sistema', 'Extra system dependencies')}
              help={tx(
                'Dependências adicionais verificadas no doctor por comando/env/path.',
                'Additional dependencies validated in doctor by command/env/path.'
              )}
              controlClass="flex justify-end"
              footer={
                config().extra_system_dependencies.length > 0 ? (
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{tx('Nome', 'Name')}</TableHead>
                          <TableHead>{tx('Comando', 'Command')}</TableHead>
                          <TableHead>{tx('Variáveis', 'Env vars')}</TableHead>
                          <TableHead>{tx('Paths padrão', 'Default paths')}</TableHead>
                          <TableHead class="w-[72px] text-right">{tx('Ações', 'Actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={config().extra_system_dependencies}>
                          {(item, index) => (
                            <TableRow>
                              <TableCell class="max-w-[220px] truncate font-medium">
                                {item.name || tx('Sem nome', 'Unnamed')}
                              </TableCell>
                              <TableCell class="max-w-[220px] truncate text-muted-foreground">
                                {item.check_commands.length > 0 ? joinCommaList(item.check_commands) : '—'}
                              </TableCell>
                              <TableCell class="max-w-[220px] truncate text-muted-foreground">
                                {item.check_env_vars.length > 0 ? joinCommaList(item.check_env_vars) : '—'}
                              </TableCell>
                              <TableCell class="max-w-[240px] truncate text-muted-foreground">
                                {item.check_paths.length > 0 ? joinCommaList(item.check_paths) : '—'}
                              </TableCell>
                              <TableCell class="text-right">
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
                              </TableCell>
                            </TableRow>
                          )}
                        </For>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    {tx('Nenhuma dependência extra adicionada.', 'No extra dependency added.')}
                  </div>
                )
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

        <Show when={activeTab() === 'winecfg'}>
          <section class="stack">
            <Alert variant="warning">
              <IconAlertCircle />
              <AlertTitle>{tx('Overrides do winecfg (não substituem tudo)', 'Winecfg overrides (do not replace everything)')}</AlertTitle>
              <AlertDescription>
                {tx(
                  'As configurações desta aba são adicionais ao padrão do prefixo/Wine. Se você deixar em "Padrão do Wine", o orquestrador não força esse item.',
                  'Settings in this tab are additive overrides on top of Wine/prefix defaults. If you keep "Wine default", the orchestrator does not force that item.'
                )}
              </AlertDescription>
            </Alert>

            <FieldShell
              label={tx('Substituição de DLL', 'DLL overrides')}
              help={tx('Configura overrides por DLL como native/builtin.', 'Configures per-DLL overrides such as native/builtin.')}
              controlClass="flex justify-end"
              footer={
                <Show
                  when={config().winecfg.dll_overrides.length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {tx('Nenhum override adicionado.', 'No override added.')}
                    </div>
                  }
                >
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{tx('DLL', 'DLL')}</TableHead>
                          <TableHead>{tx('Modo', 'Mode')}</TableHead>
                          <TableHead class="w-[72px] text-right">{tx('Ações', 'Actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={config().winecfg.dll_overrides}>
                          {(item, index) => (
                            <TableRow>
                              <TableCell class="max-w-[260px] truncate font-medium">{item.dll}</TableCell>
                              <TableCell class="w-[220px]">
                                <Select
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
                                  <For each={dllModeOptions()}>
                                    {(option) => <option value={option.value}>{option.label}</option>}
                                  </For>
                                </Select>
                              </TableCell>
                              <TableCell class="text-right">
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
                              </TableCell>
                            </TableRow>
                          )}
                        </For>
                      </TableBody>
                    </Table>
                  </div>
                </Show>
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

            <FieldShell
              label={tx('Versão do Windows (winecfg)', 'Windows version (winecfg)')}
              help={tx(
                'Override opcional da versão do Windows reportada pelo prefixo. Se não configurar, mantém o padrão do runtime/prefixo.',
                'Optional override for the Windows version reported by the prefix. If unset, runtime/prefix defaults are kept.'
              )}
              compact
            >
              <Select
                value={config().winecfg.windows_version ?? '__default__'}
                onInput={(e) =>
                  patchConfig((prev) => ({
                    ...prev,
                    winecfg: {
                      ...prev.winecfg,
                      windows_version: e.currentTarget.value === '__default__' ? null : e.currentTarget.value
                    }
                  }))
                }
              >
                <For each={wineWindowsVersionOptions}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </Select>
            </FieldShell>

            <div class="grid gap-3">
              <AccordionSection
                open={winecfgAccordionOpen() === 'graphics'}
                onToggle={() =>
                  setWinecfgAccordionOpen((prev) => (prev === 'graphics' ? null : 'graphics'))
                }
                title={tx('Gráficos', 'Graphics')}
                description={tx(
                  'Equivalente à aba Gráficos do winecfg. Tudo aqui é adicional ao padrão do prefixo.',
                  'Equivalent to the Graphics tab in winecfg. Everything here is an additive override to prefix defaults.'
                )}
              >
                <div class="grid gap-3">
                  <Alert>
                    <IconAlertCircle />
                    <AlertTitle>{tx('Gráficos = ajustes incrementais', 'Graphics = incremental overrides')}</AlertTitle>
                    <AlertDescription>
                      {tx(
                        'Esses itens não recriam o prefixo. Eles apenas adicionam overrides de comportamento do winecfg sobre o que já existe no prefixo atual.',
                        'These items do not recreate the prefix. They only add winecfg behavior overrides on top of what already exists in the current prefix.'
                      )}
                    </AlertDescription>
                  </Alert>

                  <WinecfgFeatureStateField
                    label={tx('Capturar o mouse automaticamente em janelas em tela cheia', 'Automatically capture mouse in fullscreen windows')}
                    help={tx('Equivalente à opção de captura automática do winecfg.', 'Equivalent to winecfg auto-capture mouse option.')}
                    value={config().winecfg.auto_capture_mouse}
                    onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, auto_capture_mouse: value } }))}
                  />

                  <WinecfgFeatureStateField
                    label={tx('Permitir que o gerenciador de janelas decore as janelas', 'Allow the window manager to decorate windows')}
                    help={tx('Controla decorações de janela gerenciadas pelo WM.', 'Controls window decorations managed by the WM.')}
                    value={config().winecfg.window_decorations}
                    onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, window_decorations: value } }))}
                  />

                  <WinecfgFeatureStateField
                    label={tx('Permitir que o gerenciador de janelas controle as janelas', 'Allow the window manager to control windows')}
                    help={tx('Permite que o WM controle posição/foco/estado das janelas.', 'Lets the WM control window position/focus/state.')}
                    value={config().winecfg.window_manager_control}
                    onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, window_manager_control: value } }))}
                  />

                  <WinecfgFeatureStateField
                    label={tx('Emular uma área de trabalho virtual', 'Emulate a virtual desktop')}
                    help={tx('Quando ativo, o jogo roda dentro de um desktop virtual do Wine.', 'When enabled, the game runs inside a Wine virtual desktop.')}
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

                  <Show when={winecfgVirtualDesktopEnabled()}>
                    <div class="rounded-md border border-border/60 bg-muted/20 p-3">
                      <div class="space-y-1.5">
                        <p class="text-sm font-medium">{tx('Tamanho da área de trabalho virtual', 'Virtual desktop size')}</p>
                        <p class="text-xs text-muted-foreground">
                          {tx('Informe largura x altura (ex.: 1280 x 720).', 'Set width x height (e.g. 1280 x 720).')}
                        </p>
                      </div>
                      <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                        <Input
                          value={winecfgVirtualDesktopResolution().width}
                          placeholder="1280"
                          onInput={(e) => setWinecfgVirtualDesktopResolutionPart('width', e.currentTarget.value)}
                        />
                        <span class="text-sm font-semibold text-muted-foreground">x</span>
                        <Input
                          value={winecfgVirtualDesktopResolution().height}
                          placeholder="720"
                          onInput={(e) => setWinecfgVirtualDesktopResolutionPart('height', e.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </Show>

                  <div class="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="space-y-1.5">
                        <p class="text-sm font-medium">{tx('Resolução da tela (DPI)', 'Screen resolution (DPI)')}</p>
                        <p class="text-xs text-muted-foreground">
                          {tx('Slider de 96 ppp até 480 ppp. Se não configurar, usa o padrão do Wine.', 'Slider from 96 DPI to 480 DPI. If unset, Wine default is used.')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              screen_dpi: null
                            }
                          }))
                        }
                      >
                        {tx('Usar padrão', 'Use default')}
                      </Button>
                    </div>
                    <div class="mt-3 grid gap-2">
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-muted-foreground">96 ppp</span>
                        <span class="font-medium">
                          {(config().winecfg.screen_dpi ?? 96).toString()} ppp
                          <Show when={config().winecfg.screen_dpi == null}>
                            <span class="text-muted-foreground"> ({tx('padrão', 'default')})</span>
                          </Show>
                        </span>
                        <span class="text-muted-foreground">480 ppp</span>
                      </div>
                      <input
                        type="range"
                        min="96"
                        max="480"
                        step="1"
                        value={(config().winecfg.screen_dpi ?? 96).toString()}
                        class="w-full accent-primary"
                        onInput={(e) => {
                          const parsed = Number.parseInt(e.currentTarget.value, 10)
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              screen_dpi: Number.isFinite(parsed) ? parsed : 96
                            }
                          }))
                        }}
                      />
                    </div>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                open={winecfgAccordionOpen() === 'desktop'}
                onToggle={() =>
                  setWinecfgAccordionOpen((prev) => (prev === 'desktop' ? null : 'desktop'))
                }
                title={tx('Integração com área de trabalho', 'Desktop integration')}
                description={tx(
                  'Associações de arquivo/protocolo e mapeamentos de pastas especiais do Wine.',
                  'File/protocol associations and Wine special desktop folder mappings.'
                )}
              >
                <div class="grid gap-3">
                  <Alert>
                    <IconAlertCircle />
                    <AlertTitle>{tx('Integração pode afetar o sistema do usuário', 'Integration can affect user system behavior')}</AlertTitle>
                    <AlertDescription>
                      {tx(
                        'Associações MIME/protocolo e pastas especiais podem alterar integração com desktop. Prefira configurar apenas o necessário para o jogo.',
                        'MIME/protocol associations and special folders can change desktop integration behavior. Configure only what the game needs.'
                      )}
                    </AlertDescription>
                  </Alert>

                  <WinecfgFeatureStateField
                    label={tx('Integração com desktop (geral)', 'Desktop integration (general)')}
                    help={tx('Controla integração do Wine com shell/desktop do Linux.', 'Controls Wine integration with the Linux shell/desktop.')}
                    value={config().winecfg.desktop_integration}
                    onChange={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        winecfg: { ...prev.winecfg, desktop_integration: value }
                      }))
                    }
                  />

                  <WinecfgFeatureStateField
                    label={tx('Tipos MIME (associações de arquivo e protocolo)', 'MIME types (file/protocol associations)')}
                    help={tx('Equivalente a "Manage file and protocol associations".', 'Equivalent to "Manage file and protocol associations".')}
                    value={config().winecfg.mime_associations}
                    onChange={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        winecfg: { ...prev.winecfg, mime_associations: value }
                      }))
                    }
                  />

                  <div class="rounded-xl border border-border/70 bg-card/70 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold">{tx('Pastas especiais', 'Special folders')}</p>
                        <p class="text-xs text-muted-foreground">
                          {tx('Adicione mapeamentos de pasta e atalho para o Wine (override opcional).', 'Add folder + shortcut mappings for Wine (optional override).')}
                        </p>
                      </div>
                      <Dialog open={wineDesktopFolderDialogOpen()} onOpenChange={setWineDesktopFolderDialogOpen}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          class="inline-flex items-center gap-1.5"
                          onClick={() => setWineDesktopFolderDialogOpen(true)}
                        >
                          <IconPlus class="size-4" />
                          {tx('Adicionar pasta', 'Add folder')}
                        </Button>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{tx('Adicionar pasta especial do Wine', 'Add Wine special folder')}</DialogTitle>
                            <DialogDescription>
                              {tx('Defina o tipo da pasta, nome do atalho e caminho Linux.', 'Set folder type, shortcut name and Linux path.')}
                            </DialogDescription>
                          </DialogHeader>

                          <div class="grid gap-2">
                            <Select
                              value={wineDesktopFolderDraft().folder_key}
                              onInput={(e) =>
                                setWineDesktopFolderDraft((prev) => ({ ...prev, folder_key: e.currentTarget.value }))
                              }
                            >
                              <For each={wineDesktopFolderKeyOptions}>
                                {(option) => <option value={option.value}>{option.label}</option>}
                              </For>
                            </Select>
                            <Input
                              value={wineDesktopFolderDraft().shortcut_name}
                              placeholder={tx('Nome do atalho no Wine', 'Shortcut name in Wine')}
                              onInput={(e) =>
                                setWineDesktopFolderDraft((prev) => ({ ...prev, shortcut_name: e.currentTarget.value }))
                              }
                            />
                            <Input
                              value={wineDesktopFolderDraft().linux_path}
                              placeholder="/mnt/games/shared"
                              onInput={(e) =>
                                setWineDesktopFolderDraft((prev) => ({ ...prev, linux_path: e.currentTarget.value }))
                              }
                            />
                            <p class="text-xs text-muted-foreground">
                              {tx('Prefira caminhos genéricos (sem nome de usuário fixo), quando possível.', 'Prefer generic paths (without a fixed username) when possible.')}
                            </p>
                          </div>

                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setWineDesktopFolderDialogOpen(false)}>
                              {tx('Cancelar', 'Cancel')}
                            </Button>
                            <Button
                              type="button"
                              disabled={!wineDesktopFolderDraft().shortcut_name.trim() || !wineDesktopFolderDraft().linux_path.trim()}
                              onClick={() => {
                                const draft = wineDesktopFolderDraft()
                                if (!draft.shortcut_name.trim() || !draft.linux_path.trim()) return
                                patchConfig((prev) => ({
                                  ...prev,
                                  winecfg: {
                                    ...prev.winecfg,
                                    desktop_folders: [
                                      ...prev.winecfg.desktop_folders,
                                      {
                                        folder_key: draft.folder_key,
                                        shortcut_name: draft.shortcut_name.trim(),
                                        linux_path: draft.linux_path.trim()
                                      }
                                    ]
                                  }
                                }))
                                setWineDesktopFolderDraft({ folder_key: 'desktop', shortcut_name: '', linux_path: '' })
                                setWineDesktopFolderDialogOpen(false)
                              }}
                            >
                              {tx('Confirmar', 'Confirm')}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div class="mt-3">
                      <Show
                        when={config().winecfg.desktop_folders.length > 0}
                        fallback={
                          <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                            {tx('Nenhuma pasta especial adicionada.', 'No special folder added.')}
                          </div>
                        }
                      >
                        <div class="rounded-md border border-border/60 bg-background/40">
                          <Table>
                            <TableHeader>
                              <TableRow class="hover:bg-transparent">
                                <TableHead>{tx('Tipo', 'Type')}</TableHead>
                                <TableHead>{tx('Atalho', 'Shortcut')}</TableHead>
                                <TableHead>{tx('Caminho Linux', 'Linux path')}</TableHead>
                                <TableHead class="w-[72px] text-right">{tx('Ações', 'Actions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <For each={config().winecfg.desktop_folders}>
                                {(item, index) => (
                                  <TableRow>
                                    <TableCell class="max-w-[120px] truncate font-medium">{item.folder_key}</TableCell>
                                    <TableCell class="max-w-[180px] truncate">{item.shortcut_name}</TableCell>
                                    <TableCell class="max-w-[320px] truncate text-muted-foreground">{item.linux_path}</TableCell>
                                    <TableCell class="text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() =>
                                          patchConfig((prev) => ({
                                            ...prev,
                                            winecfg: {
                                              ...prev.winecfg,
                                              desktop_folders: removeAt(prev.winecfg.desktop_folders, index())
                                            }
                                          }))
                                        }
                                      >
                                        <IconTrash class="size-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </For>
                            </TableBody>
                          </Table>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                open={winecfgAccordionOpen() === 'drives'}
                onToggle={() =>
                  setWinecfgAccordionOpen((prev) => (prev === 'drives' ? null : 'drives'))
                }
                title={tx('Unidades', 'Drives')}
                description={tx(
                  'Unidades adicionais do Wine como overrides. C: e Z geralmente já existem no prefixo padrão.',
                  'Additional Wine drives as overrides. C: and Z: usually already exist in the default prefix.'
                )}
              >
                <div class="grid gap-3">
                  <Alert variant="warning">
                    <IconAlertCircle />
                    <AlertTitle>{tx('Unidades do Wine exigem cuidado', 'Wine drives require care')}</AlertTitle>
                    <AlertDescription>
                      {tx(
                        'C: e Z: normalmente já existem no prefixo padrão. Adicione novas unidades apenas quando o jogo realmente depender disso e prefira caminhos Linux genéricos.',
                        'C: and Z: usually already exist in the default prefix. Add new drives only when the game really depends on it and prefer generic Linux paths.'
                      )}
                    </AlertDescription>
                  </Alert>

                  <div class="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <div class="grid gap-1">
                      <p>
                        <strong class="text-foreground">C:</strong>{' '}
                        {tx('normalmente aponta para drive_c (interno do prefixo).', 'usually points to drive_c (internal prefix path).')}
                      </p>
                      <p>
                        <strong class="text-foreground">Z:</strong>{' '}
                        {tx('geralmente expõe a raiz do filesystem Linux por compatibilidade.', 'usually exposes the Linux filesystem root for compatibility.')}
                      </p>
                    </div>
                    <div class="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              drives: [
                                {
                                  letter: 'Z',
                                  source_relative_path: '.',
                                  state: 'OptionalOn',
                                  host_path: null,
                                  drive_type: 'auto',
                                  label: null,
                                  serial: null
                                }
                              ]
                            }
                          }))
                        }
                      >
                        {tx('Restaurar padrão exibido (Z:)', 'Restore shown default (Z:)')}
                      </Button>
                    </div>
                  </div>

                  <div class="flex justify-end">
                    <Dialog open={wineDriveDialogOpen()} onOpenChange={setWineDriveDialogOpen}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="inline-flex items-center gap-1.5"
                        onClick={() => {
                          const nextLetter = availableWineDriveLetters()[0] ?? 'D'
                          setWineDriveDraft({
                            letter: nextLetter,
                            host_path: '',
                            drive_type: 'auto',
                            label: '',
                            serial: ''
                          })
                          setWineDriveDialogOpen(true)
                        }}
                      >
                        <IconPlus class="size-4" />
                        {tx('Adicionar unidade', 'Add drive')}
                      </Button>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{tx('Adicionar unidade do Wine', 'Add Wine drive')}</DialogTitle>
                          <DialogDescription>
                            {tx('Escolha uma letra disponível e configure os metadados da unidade.', 'Choose an available letter and configure drive metadata.')}
                          </DialogDescription>
                        </DialogHeader>

                        <div class="grid gap-2">
                          <Select
                            value={wineDriveDraft().letter}
                            onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, letter: e.currentTarget.value }))}
                          >
                            <For each={availableWineDriveLetters().length > 0 ? availableWineDriveLetters() : [wineDriveDraft().letter]}>
                              {(letter) => <option value={letter}>{letter}:</option>}
                            </For>
                          </Select>

                          <Input
                            value={wineDriveDraft().host_path}
                            placeholder="/mnt/storage/shared"
                            onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, host_path: e.currentTarget.value }))}
                          />

                          <Select
                            value={wineDriveDraft().drive_type}
                            onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, drive_type: e.currentTarget.value }))}
                          >
                            <For each={wineDriveTypeOptions}>
                              {(option) => <option value={option.value}>{option.label}</option>}
                            </For>
                          </Select>

                          <div class="grid gap-2 md:grid-cols-2">
                            <Input
                              value={wineDriveDraft().label}
                              placeholder={tx('Rótulo (opcional)', 'Label (optional)')}
                              onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, label: e.currentTarget.value }))}
                            />
                            <Input
                              value={wineDriveDraft().serial}
                              placeholder={tx('Serial (opcional)', 'Serial (optional)')}
                              onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, serial: e.currentTarget.value }))}
                            />
                          </div>

                          <p class="text-xs text-muted-foreground">
                            {tx('Use um diretório Linux genérico quando possível (evite paths fixos com nome de usuário).', 'Use a generic Linux directory when possible (avoid user-specific absolute paths).')}
                          </p>
                        </div>

                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setWineDriveDialogOpen(false)}>
                            {tx('Cancelar', 'Cancel')}
                          </Button>
                          <Button
                            type="button"
                            disabled={!wineDriveDraft().letter.trim() || !wineDriveDraft().host_path.trim()}
                            onClick={() => {
                              const draft = wineDriveDraft()
                              const letter = draft.letter.trim().toUpperCase()
                              if (!letter || !draft.host_path.trim()) return
                              if (config().winecfg.drives.some((item) => item.letter.trim().toUpperCase() === letter)) {
                                setStatusMessage(tx('Essa letra de unidade já está em uso.', 'That drive letter is already in use.'))
                                return
                              }
                              patchConfig((prev) => ({
                                ...prev,
                                winecfg: {
                                  ...prev.winecfg,
                                  drives: [
                                    ...prev.winecfg.drives,
                                    {
                                      letter,
                                      source_relative_path: '',
                                      state: 'OptionalOn',
                                      host_path: draft.host_path.trim(),
                                      drive_type: draft.drive_type as 'auto' | 'local_disk' | 'network_share' | 'floppy' | 'cdrom',
                                      label: draft.label.trim() ? draft.label.trim() : null,
                                      serial: draft.serial.trim() ? draft.serial.trim() : null
                                    }
                                  ]
                                }
                              }))
                              setWineDriveDialogOpen(false)
                            }}
                          >
                            {tx('Confirmar', 'Confirm')}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Show
                    when={config().winecfg.drives.length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {tx('Nenhuma unidade adicional configurada.', 'No additional drive configured.')}
                      </div>
                    }
                  >
                    <div class="rounded-md border border-border/60 bg-background/40">
                      <Table>
                        <TableHeader>
                          <TableRow class="hover:bg-transparent">
                            <TableHead>{tx('Letra', 'Letter')}</TableHead>
                            <TableHead>{tx('Caminho Linux', 'Linux path')}</TableHead>
                            <TableHead>{tx('Tipo', 'Type')}</TableHead>
                            <TableHead>{tx('Rótulo', 'Label')}</TableHead>
                            <TableHead>{tx('Serial', 'Serial')}</TableHead>
                            <TableHead class="w-[72px] text-right">{tx('Ações', 'Actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <For each={config().winecfg.drives}>
                            {(item, index) => (
                              <TableRow>
                                <TableCell class="font-medium">{item.letter}:</TableCell>
                                <TableCell class="max-w-[260px] truncate text-muted-foreground">
                                  {(item.host_path ?? item.source_relative_path) || '—'}
                                </TableCell>
                                <TableCell class="max-w-[160px] truncate text-muted-foreground">
                                  {item.drive_type ?? 'auto'}
                                </TableCell>
                                <TableCell class="max-w-[160px] truncate text-muted-foreground">
                                  {item.label ?? '—'}
                                </TableCell>
                                <TableCell class="max-w-[140px] truncate text-muted-foreground">
                                  {item.serial ?? '—'}
                                </TableCell>
                                <TableCell class="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
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
                                    <IconTrash class="size-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )}
                          </For>
                        </TableBody>
                      </Table>
                    </div>
                  </Show>
                </div>
              </AccordionSection>

              <AccordionSection
                open={winecfgAccordionOpen() === 'audio'}
                onToggle={() =>
                  setWinecfgAccordionOpen((prev) => (prev === 'audio' ? null : 'audio'))
                }
                title={tx('Áudio', 'Audio')}
                description={tx(
                  'Configurações adicionais de áudio do winecfg. O padrão do runtime continua válido se nada for alterado.',
                  'Additional audio settings from winecfg. Runtime defaults remain valid if nothing is changed.'
                )}
              >
                <div class="grid gap-3">
                  <Alert>
                    <IconAlertCircle />
                    <AlertTitle>{tx('Áudio: altere só se precisar', 'Audio: change only if needed')}</AlertTitle>
                    <AlertDescription>
                      {tx(
                        'Forçar backend de áudio pode resolver compatibilidade, mas também pode piorar em outros hosts. O padrão do runtime costuma ser a opção mais portátil.',
                        'Forcing an audio backend can fix compatibility, but may worsen behavior on other hosts. Runtime default is usually the most portable option.'
                      )}
                    </AlertDescription>
                  </Alert>

                  <div class="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div class="space-y-1.5">
                      <p class="text-sm font-medium">{tx('Driver de áudio', 'Audio driver')}</p>
                      <p class="text-xs text-muted-foreground">
                        {tx('Selecione o backend preferido. "Padrão do runtime" mantém o comportamento padrão do Wine.', 'Select the preferred backend. "Runtime default" keeps Wine default behavior.')}
                      </p>
                    </div>
                    <div class="mt-3 max-w-sm">
                      <Select
                        value={audioDriverValue()}
                        onInput={(e) =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              audio_driver: e.currentTarget.value === '__none__' ? null : e.currentTarget.value
                            }
                          }))
                        }
                      >
                        <For each={audioDriverOptions()}>
                          {(option) => <option value={option.value}>{option.label}</option>}
                        </For>
                      </Select>
                    </div>
                  </div>
                </div>
              </AccordionSection>
            </div>
          </section>
        </Show>

        <Show when={activeTab() === 'wrappers' || activeTab() === 'scripts'}>
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
                    <div class="rounded-md border border-border/60 bg-background/40">
                      <Table>
                        <TableHeader>
                          <TableRow class="hover:bg-transparent">
                            <TableHead>{tx('Ativado', 'Enabled')}</TableHead>
                            <TableHead>{tx('Obrigatório', 'Mandatory')}</TableHead>
                            <TableHead>{tx('Executável', 'Executable')}</TableHead>
                            <TableHead>{tx('Argumentos', 'Arguments')}</TableHead>
                            <TableHead class="w-14 text-right">{tx('Ação', 'Action')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <For each={config().compatibility.wrapper_commands}>
                            {(item, index) => (
                              <TableRow>
                                <TableCell>{featureStateEnabled(item.state) ? tx('Sim', 'Yes') : tx('Não', 'No')}</TableCell>
                                <TableCell>{featureStateMandatory(item.state) ? tx('Sim', 'Yes') : tx('Não', 'No')}</TableCell>
                                <TableCell class="font-medium">{item.executable}</TableCell>
                                <TableCell class="text-muted-foreground">{item.args || '—'}</TableCell>
                                <TableCell class="text-right">
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
                                </TableCell>
                              </TableRow>
                            )}
                          </For>
                        </TableBody>
                      </Table>
                    </div>
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

                  <div class="grid gap-3">
                    <div class="grid gap-2 md:grid-cols-2">
                      <SwitchChoiceCard
                        title={tx('Ativado', 'Enabled')}
                        checked={featureStateEnabled(wrapperDraft().state)}
                        onChange={(checked) =>
                          setWrapperDraft((prev) => ({
                            ...prev,
                            state: buildFeatureState(checked, featureStateMandatory(prev.state))
                          }))
                        }
                      />
                      <SwitchChoiceCard
                        title={tx('Obrigatório', 'Mandatory')}
                        checked={featureStateMandatory(wrapperDraft().state)}
                        onChange={(checked) =>
                          setWrapperDraft((prev) => ({
                            ...prev,
                            state: buildFeatureState(featureStateEnabled(prev.state), checked)
                          }))
                        }
                      />
                    </div>
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
              emptyMessage={tx('Nenhuma variável de ambiente adicionada.', 'No environment variable added.')}
              tableHeaders={{
                key: tx('Variável', 'Variable'),
                value: tx('Valor', 'Value')
              }}
            />

            <Alert variant="warning">
              <IconAlertCircle />
              <AlertTitle>{tx('Chaves protegidas pelo runtime', 'Runtime-protected keys')}</AlertTitle>
              <AlertDescription>
                <span class="block">
                  {tx(
                    'As chaves abaixo são reservadas e qualquer override em custom_vars será ignorado.',
                    'The keys below are reserved and any custom_vars override will be ignored.'
                  )}
                </span>
                <span class="mt-1 block font-mono text-[11px]">WINEPREFIX · PROTON_VERB</span>
              </AlertDescription>
            </Alert>

            <FieldShell
              label={tx('Script pre-launch (bash)', 'Pre-launch script (bash)')}
              help={tx('Executado antes do comando principal do jogo.', 'Executed before main game command.')}
              controlClass="hidden"
              footer={
                <Textarea
                  rows={8}
                  value={config().scripts.pre_launch}
                  placeholder="#!/usr/bin/env bash\necho preparing..."
                  onInput={(e) =>
                    patchConfig((prev) => ({
                      ...prev,
                      scripts: { ...prev.scripts, pre_launch: e.currentTarget.value }
                    }))
                  }
                />
              }
            >
              <span />
            </FieldShell>

            <FieldShell
              label={tx('Script post-launch (bash)', 'Post-launch script (bash)')}
              help={tx('Executado após o encerramento do processo do jogo.', 'Executed after game process exits.')}
              controlClass="hidden"
              footer={
                <Textarea
                  rows={8}
                  value={config().scripts.post_launch}
                  placeholder="#!/usr/bin/env bash\necho finished..."
                  onInput={(e) =>
                    patchConfig((prev) => ({
                      ...prev,
                      scripts: { ...prev.scripts, post_launch: e.currentTarget.value }
                    }))
                  }
                />
              }
            >
              <span />
            </FieldShell>

            <Alert variant="warning">
              <IconAlertCircle />
              <AlertTitle>{tx('Scripts locais (MVP)', 'Local scripts (MVP)')}</AlertTitle>
              <AlertDescription>
                <span class="block">
                  {tx(
                    'Scripts aceitam apenas bash e execução local no MVP.',
                    'Scripts accept bash only and local execution in the MVP.'
                  )}
                </span>
                <span class="mt-1 block">
                  {tx(
                    'Scripts não são enviados para a API comunitária. Use apenas comandos confiáveis.',
                    'Scripts are not sent to the community API. Use trusted commands only.'
                  )}
                </span>
              </AlertDescription>
            </Alert>
          </section>
        </Show>

        <Show when={activeTab() === 'review'}>
          <section class="stack">
            <FieldShell
              label={tx('Resumo do payload', 'Payload summary')}
              help={tx('Visão rápida de quantos itens foram configurados por seção.', 'Quick view of how many items were configured per section.')}
              controlClass="hidden"
              footer={
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
              }
            >
              <span />
            </FieldShell>

            <section class="preview">
              <h3>{tx('Preview do Payload JSON', 'Payload JSON Preview')}</h3>
              <pre>{configPreview()}</pre>
            </section>

            <div class="row-actions">
              <Button type="button" class="btn-test" onClick={runTest}>
                {t('testButton')}
              </Button>
              <Button type="button" class="btn-primary" onClick={runCreate}>
                {t('createButton')}
              </Button>
            </div>

            <section class="preview">
              <h3>{tx('Resultado', 'Result')}</h3>
              <pre>{resultJson() || t('noResult')}</pre>
            </section>
          </section>
        </Show>
          </CardContent>
        </Card>
      </div>

      <Toaster
        position="bottom-right"
        theme={theme()}
        richColors
        closeButton
        visibleToasts={5}
      />
    </div>
  )
}
