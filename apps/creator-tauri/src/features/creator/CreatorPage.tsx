import { createEffect, createMemo, createSignal, For, JSX, Show } from 'solid-js'
import { IconAlertCircle, IconChevronDown, IconMenu2, IconPlus, IconTrash, IconX } from '@tabler/icons-solidjs'
import { Toaster, toast } from 'solid-sonner'

import { invokeCommand } from '../../api/tauri'
import {
  FeatureStateField,
  FieldShell,
  FormControlsI18nProvider,
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
import type { CreatorCopyKey } from './creator-copy'

function tabLabel(tab: CreatorTab, controller: CreatorController) {
  const ct = controller.ct as (key: CreatorCopyKey) => string
  if (tab === 'game') return ct('creator_label_game')
  if (tab === 'runtime') return ct('creator_label_runtime')
  if (tab === 'performance') return ct('creator_enhancements')
  if (tab === 'prefix') return ct('creator_dependencies')
  if (tab === 'winecfg') return 'Winecfg'
  if (tab === 'wrappers') return ct('creator_launch_and_environment')
  if (tab === 'scripts') return ct('creator_label_scripts')
  return ct('creator_review_and_generate')
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
          ? 'border-primary/40 bg-accent/30'
          : 'border-border/60 bg-background/70 hover:border-border hover:bg-accent/20')
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

function isTauriLocalRuntime() {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return typeof w.__TAURI_IPC__ !== 'undefined' || typeof w.__TAURI__ !== 'undefined'
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
    ct,
    ctf,
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
    { value: '__default__', label: ct('creator_runtime_default_do_not_override') },
    { value: 'win11', label: 'Windows 11' },
    { value: 'win10', label: 'Windows 10' },
    { value: 'win81', label: 'Windows 8.1' },
    { value: 'win8', label: 'Windows 8' },
    { value: 'win7', label: 'Windows 7' },
    { value: 'vista', label: 'Windows Vista' },
    { value: 'winxp', label: 'Windows XP' }
  ] as const

  const wineDesktopFolderKeyOptions = [
    { value: 'desktop', label: ct('creator_desktop') },
    { value: 'documents', label: ct('creator_documents') },
    { value: 'downloads', label: ct('creator_downloads') },
    { value: 'music', label: ct('creator_music') },
    { value: 'pictures', label: ct('creator_pictures') },
    { value: 'videos', label: ct('creator_videos') }
  ] as const

  const wineDriveTypeOptions = [
    { value: 'auto', label: ct('creator_auto_detect') },
    { value: 'local_disk', label: ct('creator_local_hard_disk') },
    { value: 'network_share', label: ct('creator_network_share') },
    { value: 'floppy', label: ct('creator_floppy_disk') },
    { value: 'cdrom', label: ct('creator_cd_rom') }
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
    if (preference === 'Proton') return ct('creator_proton_version')
    if (preference === 'Wine') return ct('creator_wine_version')
    return ct('creator_preferred_runtime_version')
  }

  const runtimeVersionFieldHelp = () => {
    const preference = config().runner.runtime_preference
    if (preference === 'Proton') {
      return ct('creator_target_proton_version_used_by_the_orchestrator_when_pref')
    }
    if (preference === 'Wine') {
      return ct('creator_expected_wine_version_identifier_when_preference_is_wine')
    }
    return ct('creator_preferred_runtime_version_when_auto_mode_picks_proton_wi')
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

  const canCalculateHash = createMemo(() => isTauriLocalRuntime() && isLikelyAbsolutePath(exePath()))
  const canChooseGameRoot = createMemo(() => exePath().trim().length > 0)
  const canPickIntegrityFromGameRoot = createMemo(() => isLikelyAbsolutePath(gameRoot().trim()))
  const canAddMount = createMemo(() => gameRoot().trim().length > 0)
  const canBrowseMountFolders = createMemo(() => isTauriLocalRuntime() && isLikelyAbsolutePath(gameRoot().trim()))
  const canImportRegistryFromFile = createMemo(() => isTauriLocalRuntime())

  const importRegistryKeysFromRegFile = async () => {
    try {
      const selected = await pickRegistryFile()
      if (!selected) return

      if (!isLikelyAbsolutePath(selected)) {
        setStatusMessage(
          ct('creator_importing_reg_requires_an_absolute_path_in_browser_lan_m')
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
          ? ctf('creator_registry_import_warning_suffix_count', { count: result.warnings.length })
          : ''

      setStatusMessage(
        ctf('creator_imported_registry_keys_from_reg_file', {
          count: deduped.length,
          warningSuffix
        })
      )

      setRegistryImportWarnings(result.warnings)
      setRegistryImportWarningsOpen(result.warnings.length > 0)
    } catch (error) {
      setStatusMessage(ctf('creator_failed_to_import_reg_file_error', { error: String(error) }))
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
        ct('creator_mounted_folder_browser_requires_an_absolute_game_root_pa')
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
      setStatusMessage(ctf('creator_failed_to_list_folders_error', { error: String(error) }))
    } finally {
      setMountBrowserLoading(false)
    }
  }

  const openMountSourceBrowser = async () => {
    const root = gameRoot().trim()
    if (!root) {
      setStatusMessage(ct('creator_select_an_executable_first_to_define_the_game_folder'))
      return
    }
    if (!isLikelyAbsolutePath(root)) {
      setStatusMessage(
        ct('creator_in_browser_lan_mode_the_mini_folder_browser_cannot_acces')
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

  const sidebarLocaleLabel = createMemo(() => `${ct('creator_language')}: ${locale()}`)

  const sidebarThemeLabel = createMemo(() => {
    const current = theme()
    const label =
      current === 'dark'
        ? ct('creator_dark')
        : current === 'light'
          ? ct('creator_light')
          : ct('creator_system')
    return `${ct('creator_theme')}: ${label}`
  })

  const formControlsI18n = createMemo(() => ({
    enabled: ct('creator_label_enabled'),
    disabled: ct('creator_label_disabled'),
    mandatory: ct('creator_label_mandatory'),
    wineDefault: ct('creator_use_wine_default'),
    actions: ct('creator_label_actions'),
    action: ct('creator_label_action'),
    add: ct('creator_label_add'),
    addItem: ct('creator_add_item'),
    addListDialogDescription: ct('creator_enter_a_value_and_confirm_to_add_it_to_the_list'),
    addKeyValueDialogDescription: ct('creator_fill_in_key_and_value_to_add_a_new_row'),
    pickFile: ct('creator_choose_file'),
    pickFileHint: ct('creator_select_a_file_to_fill_this_field_automatically'),
    cancel: ct('creator_label_cancel'),
    confirm: ct('creator_label_confirm'),
    remove: ct('creator_label_remove'),
    noItemAdded: ct('creator_no_item_added'),
    keyPlaceholder: ct('creator_key'),
    valuePlaceholder: ct('creator_value')
  }))

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
    <FormControlsI18nProvider value={formControlsI18n()}>
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

        <Card class="flex min-h-[calc(100vh-2rem)] flex-col">
          <CardContent class="flex flex-1 flex-col pt-5">
        <div class="relative mb-4 flex min-h-10 items-center justify-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              class="absolute left-0 h-10 w-10 lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label={ct('creator_open_menu')}
              title={ct('creator_open_menu')}
            >
              <IconMenu2 class="size-4" />
            </Button>
            <div class="min-w-0 px-12 text-center lg:px-0">
              <p class="truncate text-sm font-semibold">{tabLabel(activeTab(), controller)}</p>
              <p class="text-xs text-muted-foreground">
                {ct('creator_step')} {Math.max(tabIndex(), 0) + 1}/{tabs.length}
              </p>
            </div>
        </div>
        <div class="flex-1">
        <Show when={activeTab() === 'game'}>
          <section class="stack">
            <TextInputField
              label={ct('creator_game_name')}
              help={ct('creator_name_shown_in_splash_and_local_database')}
              value={config().game_name}
              onInput={(value) => patchConfig((prev) => ({ ...prev, game_name: value }))}
            />

            <FieldShell
              label={ct('creator_main_executable_exe')}
              help={ct('creator_use_picker_to_select_the_real_game_executable')}
            >
              <div class="picker-row">
                <Input value={exePath()} placeholder="/home/user/Games/MyGame/game.exe" onInput={(e) => setExePath(e.currentTarget.value)} />
                <Button type="button" variant="outline" onClick={pickExecutable}>
                  {ct('creator_select_file')}
                </Button>
              </div>
            </FieldShell>

            <FieldShell
              label={ct('creator_game_root_folder')}
              help={ct('creator_defaults_to_the_main_executable_folder_but_can_be_change')}
              hint={
                !exeInsideGameRoot()
                  ? ct('creator_game_root_hint_invalid_exe_outside_root')
                  : gameRootManualOverride()
                    ? ct('creator_game_root_hint_manual_override')
                    : ct('creator_game_root_hint_auto')
              }
            >
              <div class="picker-row">
                <Input value={gameRootRelativeDisplay()} placeholder="./" readOnly class="readonly" />
                <Button type="button" variant="outline" onClick={openGameRootChooser} disabled={!canChooseGameRoot()}>
                  {ct('creator_choose_another')}
                </Button>
              </div>
            </FieldShell>

            <Dialog open={gameRootChooserOpen()} onOpenChange={setGameRootChooserOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{ct('creator_choose_game_root_folder')}</DialogTitle>
                  <DialogDescription>
                    {ct('creator_the_game_root_must_be_an_ancestor_of_the_folder_that_con')}
                  </DialogDescription>
                </DialogHeader>

                <Show
                  when={gameRootAncestorCandidates().length > 0}
                  fallback={
                    <div class="grid gap-3">
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {ct('creator_this_guided_flow_requires_an_absolute_executable_path_lo')}
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
                          {ct('creator_use_system_picker')}
                        </Button>
                      </div>
                    </div>
                  }
                >
                  <div class="grid gap-3">
                    <div class="rounded-md border border-border/60 bg-muted/25 p-3">
                      <p class="mb-2 text-xs font-medium text-muted-foreground">
                        {ct('creator_executable_folder_breadcrumb')}
                      </p>
                      <nav class="overflow-x-auto" aria-label={ct('creator_executable_path')}>
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
                        {ct('creator_select_which_ancestor_level_should_be_the_game_root')}
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
                                    ? ct('creator_same_directory_as_executable_automatic')
                                    : ctf('creator_executable_lives_in_relative_path', {
                                        path: relativeToExe ?? ''
                                      })}
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
                    {ct('creator_close')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <FieldShell
              label={ct('creator_sha_256_hash')}
              help={ct('creator_main_identifier_for_profile_and_per_game_prefix')}
            >
              <div class="picker-row">
                <Input
                  value={config().exe_hash}
                  readOnly
                  class="readonly"
                />
                <Button type="button" variant="outline" onClick={runHash} disabled={!canCalculateHash()}>
                  {t('hashButton')}
                </Button>
              </div>
            </FieldShell>

            <FieldShell
              label={ct('creator_final_prefix_path')}
              help={ct('creator_automatically_calculated_from_executable_hash')}
            >
              <div class="picker-row">
                <Input value={prefixPathPreview()} readOnly class="readonly" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(prefixPathPreview())
                      setStatusMessage(ct('creator_prefix_path_copied'))
                    } catch {
                      setStatusMessage(ct('creator_failed_to_copy_to_clipboard'))
                    }
                  }}
                >
                  {ct('creator_copy')}
                </Button>
              </div>
            </FieldShell>

            <FieldShell
              label={ct('creator_extracted_icon')}
              help={ct('creator_game_icon_preview_for_easier_visual_identification')}
              hint={ct('creator_visual_is_ready_real_extraction_will_be_wired_to_backend')}
            >
              <div class="icon-preview">
                <div class="icon-box">
                  <Show when={iconPreviewPath()} fallback={<span>{ct('creator_no_extracted_icon')}</span>}>
                    <img src={iconPreviewPath()} alt="icon preview" />
                  </Show>
                </div>
                <Button type="button" variant="outline" onClick={applyIconExtractionPlaceholder}>
                  {ct('creator_extract_icon')}
                </Button>
              </div>
            </FieldShell>

            <StringListField
              label={ct('creator_launch_arguments')}
              help={ct('creator_extra_arguments_passed_to_game_executable')}
              items={config().launch_args}
              onChange={(items) => patchConfig((prev) => ({ ...prev, launch_args: items }))}
              placeholder={ct('creator_windowed')}
              addLabel={ct('creator_add_argument')}
              emptyMessage={ct('creator_no_launch_argument_added')}
              tableValueHeader={ct('creator_argument')}
            />

            <StringListField
              label={ct('creator_required_files')}
              help={ct('creator_if_any_listed_file_is_missing_from_the_game_folder_start')}
              items={config().integrity_files}
              onChange={(items) => patchConfig((prev) => ({ ...prev, integrity_files: items }))}
              placeholder={ct('creator_data_core_dll')}
              addLabel={ct('creator_add_file')}
              pickerLabel={ct('creator_pick_file_from_game_folder')}
              onPickValue={pickIntegrityFileRelative}
              pickerDisabled={!canPickIntegrityFromGameRoot()}
              emptyMessage={ct('creator_no_file_added')}
              tableValueHeader={ct('creator_relative_file')}
            />

            <FieldShell
              label={ct('creator_mounted_folders')}
              help={ct('creator_maps_a_folder_inside_the_game_to_a_windows_target_inside')}
              controlClass="flex justify-end"
              footer={
                <Show
                  when={config().folder_mounts.length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('creator_no_mount_added')}
                    </div>
                  }
                >
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{ct('creator_relative_source')}</TableHead>
                          <TableHead>{ct('creator_windows_target')}</TableHead>
                          <TableHead>{ct('creator_create_source')}</TableHead>
                          <TableHead class="w-[120px] text-right">{ct('creator_label_actions')}</TableHead>
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
                                {item.create_source_if_missing ? ct('creator_yes') : ct('creator_no')}
                              </TableCell>
                              <TableCell class="text-right">
                                <div class="flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    class="h-8 px-2 text-xs"
                                    onClick={() => void pickMountFolder(index())}
                                  >
                                    {ct('creator_folder')}
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
                                    title={ct('creator_remove_mount')}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="inline-flex items-center gap-1.5"
                  onClick={() => setMountDialogOpen(true)}
                  disabled={!canAddMount()}
                >
                  <IconPlus class="size-4" />
                  {ct('creator_add_mount')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_mount')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_set_relative_source_and_windows_target_to_create_the_mou')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <div class="picker-row">
                      <Input
                        value={mountDraft().source_relative_path}
                        placeholder={ct('creator_relative_source_e_g_save')}
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
                        disabled={!canBrowseMountFolders()}
                        onClick={() => void openMountSourceBrowser()}
                      >
                        {ct('creator_browse_folders')}
                      </Button>
                    </div>

                    <Input
                      value={mountDraft().target_windows_path}
                      placeholder={ct('creator_windows_target_c_users')}
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
                      {ct('creator_create_source_if_missing')}
                    </label>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setMountDialogOpen(false)}>
                      {ct('creator_label_cancel')}
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
                      {ct('creator_label_confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={mountSourceBrowserOpen()} onOpenChange={setMountSourceBrowserOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_select_folder_inside_game')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_mini_browser_restricted_to_the_game_root_to_prevent_moun')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-3">
                    <div class="rounded-md border border-border/60 bg-muted/25 p-3">
                      <p class="mb-2 text-xs font-medium text-muted-foreground">
                        {ct('creator_current_path')}
                      </p>
                      <nav class="overflow-x-auto" aria-label={ct('creator_folder_breadcrumb')}>
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
                            {ct('creator_loading_folders')}
                          </div>
                        }
                      >
                        <Show
                          when={mountBrowserDirs().length > 0}
                          fallback={
                            <div class="px-3 py-2 text-xs text-muted-foreground">
                              {ct('creator_no_subfolder_found')}
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
                        <p class="text-xs font-medium text-muted-foreground">{ct('creator_select_this_folder')}</p>
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
                        {ct('creator_use_this_folder')}
                      </Button>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setMountSourceBrowserOpen(false)}>
                      {ct('creator_close')}
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
              label={ct('creator_general_runtime_preference')}
              help={ct('creator_macro_priority_among_auto_proton_and_wine')}
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
                    title={ct('creator_required_version')}
                    description={ct('creator_when_enabled_requires_the_configured_runtime_version_to')}
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
                    title={ct('creator_auto_update')}
                    description={ct('creator_updates_runtime_metadata_when_applicable_before_launchin')}
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
                  description={ct('creator_enables_synchronization_optimizations_in_runtime')}
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
                  description={ct('creator_enables_fsync_optimizations_when_supported')}
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
              help={ct('creator_controls_umu_run_usage_according_to_enforcement_policy')}
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
              label={ct('creator_steam_runtime')}
              help={ct('creator_defines_whether_steam_runtime_is_mandatory_optional_or_b')}
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
              help={ct('creator_policy_for_local_easy_anticheat_runtime')}
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
              help={ct('creator_policy_for_local_battleeye_runtime')}
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
              help={ct('creator_defines_gamescope_policy_and_syncs_with_requirements_gam')}
              value={config().environment.gamescope.state}
              onChange={setGamescopeState}
              footer={
                <Show
                  when={gamescopeEnabled()}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('creator_gamescope_is_disabled_enable_it_to_configure_resolution')}
                    </div>
                  }
                >
                  <div class="grid gap-3">
                    <div class="grid gap-3 md:grid-cols-2">
                      <div class="rounded-md border border-border/60 bg-muted/30 p-3">
                        <div class="space-y-1.5">
                          <p class="text-sm font-medium">{ct('creator_upscale_method')}</p>
                          <p class="text-xs text-muted-foreground">
                            {ct('creator_method_used_by_gamescope_for_upscaling')}
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
                          <p class="text-sm font-medium">{ct('creator_window_type')}</p>
                          <p class="text-xs text-muted-foreground">
                            {ct('creator_defines_gamescope_window_behavior')}
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
                          <p class="text-sm font-medium">{ct('creator_game_resolution')}</p>
                          <p class="text-xs text-muted-foreground">
                            {ct('creator_game_render_resolution_width_x_height')}
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
                          <p class="text-sm font-medium">{ct('creator_display_resolution')}</p>
                          <p class="text-xs text-muted-foreground">
                            {ct('creator_final_gamescope_output_resolution_width_x_height')}
                          </p>
                        </div>

                        <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                          <Input
                            value={config().environment.gamescope.output_width}
                            placeholder={gamescopeUsesMonitorResolution() ? ct('creator_auto') : '1920'}
                            disabled={gamescopeUsesMonitorResolution()}
                            onInput={(e) => setGamescopeOutputWidth(e.currentTarget.value)}
                          />
                          <span class="text-sm font-semibold text-muted-foreground">x</span>
                          <Input
                            value={config().environment.gamescope.output_height}
                            placeholder={gamescopeUsesMonitorResolution() ? ct('creator_auto') : '1080'}
                            disabled={gamescopeUsesMonitorResolution()}
                            onInput={(e) => setGamescopeOutputHeight(e.currentTarget.value)}
                          />
                        </div>

                        <div class="mt-3">
                          <SwitchChoiceCard
                            title={ct('creator_use_monitor_resolution')}
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
                        title={ct('creator_enable_fps_limiter')}
                        description={ct('creator_enables_gamescope_fps_limiter')}
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
                        title={ct('creator_force_grab_cursor')}
                        description={ct('creator_forces_relative_mouse_mode_to_avoid_focus_loss')}
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
                          label={ct('creator_fps_limit')}
                          help={ct('creator_fps_limit_when_game_is_focused')}
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
                          label={ct('creator_fps_limit_without_focus')}
                          help={ct('creator_fps_limit_when_game_loses_focus')}
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
                      label={ct('creator_gamescope_additional_options')}
                      help={ct('creator_add_extra_flags_that_will_be_appended_to_the_gamescope_c')}
                      items={gamescopeAdditionalOptionsList()}
                      onChange={setGamescopeAdditionalOptionsList}
                      placeholder={ct('creator_prefer_vk_device_1002_73bf')}
                      addLabel={ct('creator_add_option')}
                    />
                  </div>
                </Show>
              }
            />

            <FeatureStateField
              label="Gamemode"
              help={ct('creator_defines_gamemode_policy')}
              value={config().environment.gamemode}
              onChange={setGamemodeState}
            />

            <FeatureStateField
              label="MangoHud"
              help={ct('creator_defines_mangohud_policy')}
              value={config().environment.mangohud}
              onChange={setMangohudState}
            />

            <FeatureStateField
              label="Wine-Wayland"
              help={ct('creator_policy_for_enabling_wine_wayland')}
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
                    help={ct('creator_policy_for_hdr_depends_on_wine_wayland')}
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
              help={ct('creator_controls_automatic_dxvk_nvapi_setup')}
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
              help={ct('creator_controls_mandatory_usage_of_wine_staging_runtime')}
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
              label={ct('creator_use_dedicated_gpu')}
              help={ct('creator_exports_prime_render_offload_variables_to_try_using_the')}
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
              help={ct('creator_enabled_automatically_when_at_least_one_verb_is_configur')}
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
                              aria-label={ct('creator_remove_verb')}
                              title={ct('creator_remove_verb')}
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
                            ? ct('creator_failed_to_load_winetricks_catalog')
                            : ct('creator_search_and_add_verbs_e_g_vcrun_corefonts')
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
                      <AlertTitle>{ct('creator_failed_to_load_winetricks_catalog')}</AlertTitle>
                      <AlertDescription>
                        {ct('creator_the_local_remote_catalog_could_not_be_loaded_you_can_sti')}
                      </AlertDescription>
                    </Alert>
                  </Show>

                  <Show
                    when={!winetricksCatalogError() && normalizedWinetricksSearch().length >= 2}
                    fallback={
                      <Show when={!winetricksCatalogError()}>
                        <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                          {ct('creator_type_at_least_2_characters_to_search_verbs_in_the_catalo')}
                        </div>
                      </Show>
                    }
                  >
                    <div class="max-h-52 overflow-auto rounded-md border border-border/60 bg-muted/25 p-1">
                      <Show
                        when={winetricksCandidates().length > 0}
                        fallback={
                          <div class="px-2 py-2 text-xs text-muted-foreground">
                            {ct('creator_no_items_found')}
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
                                <span class="text-xs text-muted-foreground">{ct('creator_label_add')}</span>
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
                    <span>{ct('creator_loading_catalog_in_background')}</span>
                  </div>
                </Show>
                <Button type="button" variant="outline" onClick={loadWinetricksCatalog} disabled={winetricksLoading()}>
                  {winetricksLoading() ? ct('creator_loading') : ct('creator_refresh_catalog')}
                </Button>
                <p class="text-xs text-muted-foreground">
                  {ct('creator_source')} <strong>{winetricksSource()}</strong> ·{' '}
                  {ct('creator_catalog')} <strong>{winetricksAvailable().length}</strong>
                </p>
              </div>
            </FieldShell>

            <FieldShell
              label={ct('creator_registry_keys')}
              help={ct('creator_table_of_keys_applied_to_prefix_after_bootstrap')}
              controlClass="flex flex-wrap justify-end gap-2"
              footer={
                <Show
                  when={config().registry_keys.length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('creator_no_key_added')}
                    </div>
                  }
                >
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{ct('creator_path')}</TableHead>
                          <TableHead>{ct('creator_name')}</TableHead>
                          <TableHead>{ct('creator_type')}</TableHead>
                          <TableHead>{ct('creator_value')}</TableHead>
                          <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
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
                                  title={ct('creator_remove_key')}
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
                  {ct('creator_add_key')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_registry_key')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_fill_fields_and_confirm_to_add_row')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <Input
                      value={registryDraft().path}
                      placeholder={ct('creator_path_hkcu')}
                      onInput={(e) =>
                        setRegistryDraft((prev) => ({
                          ...prev,
                          path: e.currentTarget.value
                        }))
                      }
                    />
                    <Input
                      value={registryDraft().name}
                      placeholder={ct('creator_key_name')}
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
                        placeholder={ct('creator_type_reg_sz')}
                        onInput={(e) =>
                          setRegistryDraft((prev) => ({
                            ...prev,
                            value_type: e.currentTarget.value
                          }))
                        }
                      />
                      <Input
                        value={registryDraft().value}
                        placeholder={ct('creator_value')}
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
                      {ct('creator_label_cancel')}
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
                      {ct('creator_label_confirm')}
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
                disabled={!canImportRegistryFromFile()}
              >
                <IconPlus class="size-4" />
                {ct('creator_add_from_file_reg')}
              </Button>

              <Dialog open={registryImportWarningsOpen()} onOpenChange={setRegistryImportWarningsOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_reg_import_warnings')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_some_lines_were_ignored_or_imported_with_fallback_review')}
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
                      {ct('creator_close')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>

            <FieldShell
              label={ct('creator_extra_system_dependencies')}
              help={ct('creator_additional_dependencies_validated_in_doctor_by_command_e')}
              controlClass="flex justify-end"
              footer={
                config().extra_system_dependencies.length > 0 ? (
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{ct('creator_name')}</TableHead>
                          <TableHead>{ct('creator_command')}</TableHead>
                          <TableHead>{ct('creator_env_vars')}</TableHead>
                          <TableHead>{ct('creator_default_paths')}</TableHead>
                          <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={config().extra_system_dependencies}>
                          {(item, index) => (
                            <TableRow>
                              <TableCell class="max-w-[220px] truncate font-medium">
                                {item.name || ct('creator_unnamed')}
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
                                  title={ct('creator_remove_dependency')}
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
                    {ct('creator_no_extra_dependency_added')}
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
                  {ct('creator_add_dependency')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_extra_system_dependency')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_define_how_doctor_can_detect_this_dependency_command_env')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <Input
                      value={extraDependencyDraft().name}
                      placeholder={ct('creator_dependency_name')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          name: e.currentTarget.value
                        }))
                      }
                    />

                    <Input
                      value={extraDependencyDraft().command}
                      placeholder={ct('creator_terminal_command_e_g_mangohud')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          command: e.currentTarget.value
                        }))
                      }
                    />

                    <Input
                      value={extraDependencyDraft().env_vars}
                      placeholder={ct('creator_environment_vars_comma_separated')}
                      onInput={(e) =>
                        setExtraDependencyDraft((prev) => ({
                          ...prev,
                          env_vars: e.currentTarget.value
                        }))
                      }
                    />

                    <Input
                      value={extraDependencyDraft().paths}
                      placeholder={ct('creator_default_paths_comma_separated')}
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
                      {ct('creator_label_cancel')}
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
                      {ct('creator_label_confirm')}
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
              <AlertTitle>{ct('creator_winecfg_overrides_do_not_replace_everything')}</AlertTitle>
              <AlertDescription>
                {ct('creator_settings_in_this_tab_are_additive_overrides_on_top_of_wi')}
              </AlertDescription>
            </Alert>

            <FieldShell
              label={ct('creator_dll_overrides')}
              help={ct('creator_configures_per_dll_overrides_such_as_native_builtin')}
              controlClass="flex justify-end"
              footer={
                <Show
                  when={config().winecfg.dll_overrides.length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('creator_no_override_added')}
                    </div>
                  }
                >
                  <div class="rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{ct('creator_dll')}</TableHead>
                          <TableHead>{ct('creator_mode')}</TableHead>
                          <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
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
                                  title={ct('creator_label_remove')}
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
                  {ct('creator_add_dll_override')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_dll_override')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_set_the_dll_name_and_override_mode')}
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
                      {ct('creator_label_cancel')}
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
                      {ct('creator_label_confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>

            <FieldShell
              label={ct('creator_windows_version_winecfg')}
              help={ct('creator_optional_override_for_the_windows_version_reported_by_th')}
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
                title={ct('creator_graphics')}
                description={ct('creator_equivalent_to_the_graphics_tab_in_winecfg_everything_her')}
              >
                <div class="grid gap-3">
                  <Alert>
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_graphics_incremental_overrides')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_these_items_do_not_recreate_the_prefix_they_only_add_win')}
                    </AlertDescription>
                  </Alert>

                  <WinecfgFeatureStateField
                    label={ct('creator_automatically_capture_mouse_in_fullscreen_windows')}
                    help={ct('creator_equivalent_to_winecfg_auto_capture_mouse_option')}
                    value={config().winecfg.auto_capture_mouse}
                    onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, auto_capture_mouse: value } }))}
                  />

                  <WinecfgFeatureStateField
                    label={ct('creator_allow_the_window_manager_to_decorate_windows')}
                    help={ct('creator_controls_window_decorations_managed_by_the_wm')}
                    value={config().winecfg.window_decorations}
                    onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, window_decorations: value } }))}
                  />

                  <WinecfgFeatureStateField
                    label={ct('creator_allow_the_window_manager_to_control_windows')}
                    help={ct('creator_lets_the_wm_control_window_position_focus_state')}
                    value={config().winecfg.window_manager_control}
                    onChange={(value) => patchConfig((prev) => ({ ...prev, winecfg: { ...prev.winecfg, window_manager_control: value } }))}
                  />

                  <WinecfgFeatureStateField
                    label={ct('creator_emulate_a_virtual_desktop')}
                    help={ct('creator_when_enabled_the_game_runs_inside_a_wine_virtual_desktop')}
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
                        <p class="text-sm font-medium">{ct('creator_virtual_desktop_size')}</p>
                        <p class="text-xs text-muted-foreground">
                          {ct('creator_set_width_x_height_e_g_1280_x_720')}
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
                        <p class="text-sm font-medium">{ct('creator_screen_resolution_dpi')}</p>
                        <p class="text-xs text-muted-foreground">
                          {ct('creator_slider_from_96_dpi_to_480_dpi_if_unset_wine_default_is_u')}
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
                        {ct('creator_use_default')}
                      </Button>
                    </div>
                    <div class="mt-3 grid gap-2">
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-muted-foreground">96 ppp</span>
                        <span class="font-medium">
                          {(config().winecfg.screen_dpi ?? 96).toString()} ppp
                          <Show when={config().winecfg.screen_dpi == null}>
                            <span class="text-muted-foreground"> ({ct('creator_default')})</span>
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
                title={ct('creator_desktop_integration')}
                description={ct('creator_file_protocol_associations_and_wine_special_desktop_fold')}
              >
                <div class="grid gap-3">
                  <Alert>
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_integration_can_affect_user_system_behavior')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_mime_protocol_associations_and_special_folders_can_chang')}
                    </AlertDescription>
                  </Alert>

                  <WinecfgFeatureStateField
                    label={ct('creator_desktop_integration_general')}
                    help={ct('creator_controls_wine_integration_with_the_linux_shell_desktop')}
                    value={config().winecfg.desktop_integration}
                    onChange={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        winecfg: { ...prev.winecfg, desktop_integration: value }
                      }))
                    }
                  />

                  <WinecfgFeatureStateField
                    label={ct('creator_mime_types_file_protocol_associations')}
                    help={ct('creator_equivalent_to_manage_file_and_protocol_associations')}
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
                        <p class="text-sm font-semibold">{ct('creator_special_folders')}</p>
                        <p class="text-xs text-muted-foreground">
                          {ct('creator_add_folder_shortcut_mappings_for_wine_optional_override')}
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
                          {ct('creator_add_folder')}
                        </Button>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{ct('creator_add_wine_special_folder')}</DialogTitle>
                            <DialogDescription>
                              {ct('creator_set_folder_type_shortcut_name_and_linux_path')}
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
                              placeholder={ct('creator_shortcut_name_in_wine')}
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
                              {ct('creator_prefer_generic_paths_without_a_fixed_username_when_possi')}
                            </p>
                          </div>

                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setWineDesktopFolderDialogOpen(false)}>
                              {ct('creator_label_cancel')}
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
                              {ct('creator_label_confirm')}
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
                            {ct('creator_no_special_folder_added')}
                          </div>
                        }
                      >
                        <div class="rounded-md border border-border/60 bg-background/40">
                          <Table>
                            <TableHeader>
                              <TableRow class="hover:bg-transparent">
                                <TableHead>{ct('creator_type')}</TableHead>
                                <TableHead>{ct('creator_shortcut')}</TableHead>
                                <TableHead>{ct('creator_linux_path')}</TableHead>
                                <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
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
                title={ct('creator_drives')}
                description={ct('creator_additional_wine_drives_as_overrides_c_and_z_usually_alre')}
              >
                <div class="grid gap-3">
                  <Alert variant="warning">
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_wine_drives_require_care')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_c_and_z_usually_already_exist_in_the_default_prefix_add')}
                    </AlertDescription>
                  </Alert>

                  <div class="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <div class="grid gap-1">
                      <p>
                        <strong class="text-foreground">C:</strong>{' '}
                        {ct('creator_usually_points_to_drive_c_internal_prefix_path')}
                      </p>
                      <p>
                        <strong class="text-foreground">Z:</strong>{' '}
                        {ct('creator_usually_exposes_the_linux_filesystem_root_for_compatibil')}
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
                        {ct('creator_restore_shown_default_z')}
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
                        {ct('creator_add_drive')}
                      </Button>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{ct('creator_add_wine_drive')}</DialogTitle>
                          <DialogDescription>
                            {ct('creator_choose_an_available_letter_and_configure_drive_metadata')}
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
                              placeholder={ct('creator_label_optional')}
                              onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, label: e.currentTarget.value }))}
                            />
                            <Input
                              value={wineDriveDraft().serial}
                              placeholder={ct('creator_serial_optional')}
                              onInput={(e) => setWineDriveDraft((prev) => ({ ...prev, serial: e.currentTarget.value }))}
                            />
                          </div>

                          <p class="text-xs text-muted-foreground">
                            {ct('creator_use_a_generic_linux_directory_when_possible_avoid_user_s')}
                          </p>
                        </div>

                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setWineDriveDialogOpen(false)}>
                            {ct('creator_label_cancel')}
                          </Button>
                          <Button
                            type="button"
                            disabled={!wineDriveDraft().letter.trim() || !wineDriveDraft().host_path.trim()}
                            onClick={() => {
                              const draft = wineDriveDraft()
                              const letter = draft.letter.trim().toUpperCase()
                              if (!letter || !draft.host_path.trim()) return
                              if (config().winecfg.drives.some((item) => item.letter.trim().toUpperCase() === letter)) {
                                setStatusMessage(ct('creator_that_drive_letter_is_already_in_use'))
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
                            {ct('creator_label_confirm')}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Show
                    when={config().winecfg.drives.length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {ct('creator_no_additional_drive_configured')}
                      </div>
                    }
                  >
                    <div class="rounded-md border border-border/60 bg-background/40">
                      <Table>
                        <TableHeader>
                          <TableRow class="hover:bg-transparent">
                            <TableHead>{ct('creator_letter')}</TableHead>
                            <TableHead>{ct('creator_linux_path')}</TableHead>
                            <TableHead>{ct('creator_type')}</TableHead>
                            <TableHead>{ct('creator_label')}</TableHead>
                            <TableHead>{ct('creator_serial')}</TableHead>
                            <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
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
                title={ct('creator_audio')}
                description={ct('creator_additional_audio_settings_from_winecfg_runtime_defaults')}
              >
                <div class="grid gap-3">
                  <Alert>
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_audio_change_only_if_needed')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_forcing_an_audio_backend_can_fix_compatibility_but_may_w')}
                    </AlertDescription>
                  </Alert>

                  <div class="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div class="space-y-1.5">
                      <p class="text-sm font-medium">{ct('creator_audio_driver')}</p>
                      <p class="text-xs text-muted-foreground">
                        {ct('creator_select_the_preferred_backend_runtime_default_keeps_wine')}
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
              label={ct('creator_wrapper_commands')}
              help={ct('creator_commands_executed_before_the_main_runtime_e_g_gamescope')}
              controlClass="flex justify-end"
              footer={
                <div class="grid gap-2">
                  <Show
                    when={config().compatibility.wrapper_commands.length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('creator_no_wrapper_command_added')}
                      </div>
                    }
                  >
                    <div class="rounded-md border border-border/60 bg-background/40">
                      <Table>
                        <TableHeader>
                          <TableRow class="hover:bg-transparent">
                            <TableHead>{ct('creator_label_enabled')}</TableHead>
                            <TableHead>{ct('creator_label_mandatory')}</TableHead>
                            <TableHead>{ct('creator_executable')}</TableHead>
                            <TableHead>{ct('creator_arguments')}</TableHead>
                            <TableHead class="w-14 text-right">{ct('creator_label_action')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <For each={config().compatibility.wrapper_commands}>
                            {(item, index) => (
                              <TableRow>
                                <TableCell>{featureStateEnabled(item.state) ? ct('creator_yes') : ct('creator_no')}</TableCell>
                                <TableCell>{featureStateMandatory(item.state) ? ct('creator_yes') : ct('creator_no')}</TableCell>
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
                                    title={ct('creator_remove_wrapper')}
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
                  {ct('creator_add_wrapper')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_wrapper')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_set_policy_executable_and_wrapper_arguments')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-3">
                    <div class="grid gap-2 md:grid-cols-2">
                      <SwitchChoiceCard
                        title={ct('creator_label_enabled')}
                        checked={featureStateEnabled(wrapperDraft().state)}
                        onChange={(checked) =>
                          setWrapperDraft((prev) => ({
                            ...prev,
                            state: buildFeatureState(checked, featureStateMandatory(prev.state))
                          }))
                        }
                      />
                      <SwitchChoiceCard
                        title={ct('creator_label_mandatory')}
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
                      placeholder={ct('creator_executable_e_g_gamescope')}
                      onInput={(e) =>
                        setWrapperDraft((prev) => ({
                          ...prev,
                          executable: e.currentTarget.value
                        }))
                      }
                    />
                    <Input
                      value={wrapperDraft().args}
                      placeholder={ct('creator_args_e_g_w_1920_h_1080')}
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
                      {ct('creator_label_cancel')}
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
                      {ct('creator_label_confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>

            <KeyValueListField
              label={ct('creator_environment_variables')}
              help={ct('creator_applied_at_launch_protected_keys_are_ignored_by_runtime')}
              items={environmentVarsAsList()}
              onChange={updateCustomVars}
              keyPlaceholder="WINE_FULLSCREEN_FSR"
              valuePlaceholder="1"
              addLabel={ct('creator_add_variable')}
              removeLabel={ct('creator_label_remove')}
              emptyMessage={ct('creator_no_environment_variable_added')}
              tableHeaders={{
                key: ct('creator_variable'),
                value: ct('creator_value')
              }}
            />

            <Alert variant="warning">
              <IconAlertCircle />
              <AlertTitle>{ct('creator_runtime_protected_keys')}</AlertTitle>
              <AlertDescription>
                <span class="block">
                  {ct('creator_the_keys_below_are_reserved_if_added_above_they_will_be')}
                </span>
                <span class="mt-1 block font-mono text-[11px]">WINEPREFIX · PROTON_VERB</span>
              </AlertDescription>
            </Alert>

            <FieldShell
              label={ct('creator_pre_launch_script_bash')}
              help={ct('creator_executed_before_starting_the_game')}
              controlClass="hidden"
              footer={
                <Textarea
                  rows={8}
                  value={config().scripts.pre_launch}
                  placeholder="#!/usr/bin/env bash\necho Preparando..."
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
              label={ct('creator_post_launch_script_bash')}
              help={ct('creator_executed_after_the_game_exits')}
              controlClass="hidden"
              footer={
                <Textarea
                  rows={8}
                  value={config().scripts.post_launch}
                  placeholder="#!/usr/bin/env bash\necho Finalizado..."
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
              <AlertTitle>{ct('creator_local_scripts_mvp')}</AlertTitle>
              <AlertDescription>
                <span class="block">
                  {ct('creator_scripts_accept_bash_only_and_local_execution_in_the_mvp')}
                </span>
                <span class="mt-1 block">
                  {ct('creator_scripts_are_not_sent_to_the_community_api_use_trusted_co')}
                </span>
              </AlertDescription>
            </Alert>
          </section>
        </Show>

        <Show when={activeTab() === 'review'}>
          <section class="stack">
            <FieldShell
              label={ct('creator_configuration_summary')}
              help={ct('creator_quick_view_of_how_many_items_were_configured_in_each_sec')}
              controlClass="hidden"
              footer={
                <div class="summary-grid">
                  <div>
                    <strong>{payloadSummary().launchArgs}</strong>
                    <span>{ct('creator_launch_arguments_2')}</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().integrityFiles}</strong>
                    <span>{ct('creator_required_files')}</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().winetricks}</strong>
                    <span>Winetricks</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().registry}</strong>
                    <span>{ct('creator_windows_registry')}</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().mounts}</strong>
                    <span>{ct('creator_mounts')}</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().wrappers}</strong>
                    <span>{ct('creator_wrappers')}</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().envVars}</strong>
                    <span>{ct('creator_environment_variables')}</span>
                  </div>
                </div>
              }
            >
              <span />
            </FieldShell>

            <section class="preview">
              <h3>{ct('creator_configuration_preview_json')}</h3>
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
              <h3>{ct('creator_last_action_result')}</h3>
              <pre>{resultJson() || t('noResult')}</pre>
            </section>
          </section>
        </Show>

        </div>

        <div class="mt-auto grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
          <div class="flex justify-start">
            <Show when={canGoPrevTab()}>
              <Button type="button" variant="outline" class="h-10" onClick={goPrevTab}>
                {ct('creator_back')}
              </Button>
            </Show>
          </div>
          <div class="flex justify-end">
            <Show when={canGoNextTab()}>
              <Button type="button" class="h-10" onClick={goNextTab}>
                {ct('creator_next')}
              </Button>
            </Show>
          </div>
        </div>
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
    </FormControlsI18nProvider>
  )
}
