import { For, Show } from 'solid-js'
import { IconAlertCircle, IconPlus, IconTrash, IconX } from '@tabler/icons-solidjs'

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
} from '../../../components/form/FormControls'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Spinner } from '../../../components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { Textarea } from '../../../components/ui/textarea'
import type { RuntimePreference } from '../../../models/config'
import type { AudioDriverOption, GamescopeWindowType, UpscaleMethod } from '../useLuthierController'
import {
  AccordionSection,
  basenamePath,
  buildFeatureState,
  featureStateEnabled,
  featureStateMandatory,
  posixDirname,
  relativeInsideBase,
  SwitchChoiceCard,
  type LuthierPageSectionProps
} from '../luthier-page-shared'

export function ReviewTabSection(props: LuthierPageSectionProps) {
  const {
    resultJson,
    config,
    exePath,
    gameRootManualOverride,
    gameRootRelativeDisplay,
    configPreview,
    t,
    ct,
    runTest,
    runCreate,
    testingConfiguration,
    creatingExecutable,
    createExecutableValidationErrors,
    createExecutableBlockedReason,
  } = props.view

  const compactList = (values: string[], max = 3) => {
    const filtered = values.map((value) => value.trim()).filter(Boolean)
    if (filtered.length <= max) return filtered
    return [...filtered.slice(0, max), `+${filtered.length - max}`]
  }

  const summaryRows = () => {
    const cfg = config()
    const rows: Array<{ label: string; items: string[] }> = []
    const pushRow = (label: string, items: Array<string | null | undefined>) => {
      const normalized = items
        .map((item) => (item ?? '').trim())
        .filter(Boolean)
      if (normalized.length > 0) rows.push({ label, items: normalized })
    }
    const exeName = (() => {
      const absolute = exePath().trim()
      if (absolute) return basenamePath(absolute)
      const relative = cfg.relative_exe_path.trim()
      return relative ? basenamePath(relative) : ''
    })()
    const runtimeItems = [
      cfg.runner.runtime_preference === 'Proton' ? `Proton (${cfg.runner.proton_version || 'GE-Proton-latest'})` : cfg.runner.runtime_preference,
      cfg.requirements.runtime.strict
        ? `${ct('luthier_summary_strict_proton_version')}: ${cfg.runner.proton_version || 'GE-Proton-latest'}`
        : '',
      cfg.runner.esync ? 'ESYNC' : '',
      cfg.runner.fsync ? 'FSYNC' : '',
      cfg.runner.auto_update ? ct('luthier_auto_update') : '',
      featureStateEnabled(cfg.compatibility.easy_anti_cheat_runtime) ? 'EAC Runtime' : '',
      featureStateEnabled(cfg.compatibility.battleye_runtime) ? 'BattlEye Runtime' : ''
    ]
    const fileLaunchItems = [
      gameRootManualOverride() ? `${ct('luthier_summary_game_root')}: ${gameRootRelativeDisplay()}` : '',
      cfg.launch_args.length > 0 ? `Args: ${cfg.launch_args.length}` : '',
      cfg.integrity_files.length > 0 ? `${ct('luthier_required_files')}: ${cfg.integrity_files.length}` : '',
      cfg.folder_mounts.length > 0 ? `${ct('luthier_mounts')}: ${cfg.folder_mounts.length}` : ''
    ]
    const dependencyItems = [
      cfg.dependencies.length > 0 ? `Winetricks: ${compactList(cfg.dependencies, 4).join(', ')}` : '',
      cfg.registry_keys.length > 0 ? `${ct('luthier_windows_registry')}: ${cfg.registry_keys.length}` : '',
      cfg.extra_system_dependencies.length > 0 ? `${ct('luthier_extra_system_dependencies')}: ${cfg.extra_system_dependencies.length}` : ''
    ]
    const scriptEnvItems = [
      cfg.scripts.pre_launch.trim() ? 'pre-launch' : '',
      cfg.scripts.post_launch.trim() ? 'post-launch' : '',
      cfg.compatibility.wrapper_commands.length > 0 ? `${ct('luthier_wrappers')}: ${cfg.compatibility.wrapper_commands.length}` : '',
      Object.keys(cfg.environment.custom_vars).length > 0 ? `Env: ${Object.keys(cfg.environment.custom_vars).length}` : ''
    ]
    const enhancementItems = [
      featureStateEnabled(cfg.environment.gamescope.state) ? 'Gamescope' : '',
      featureStateEnabled(cfg.environment.mangohud) ? 'MangoHud' : '',
      featureStateEnabled(cfg.environment.gamemode) ? 'GameMode' : '',
      featureStateEnabled(cfg.environment.prime_offload) ? ct('luthier_use_dedicated_gpu') : '',
      featureStateEnabled(cfg.compatibility.wine_wayland) ? 'Wine-Wayland' : '',
      featureStateEnabled(cfg.compatibility.hdr) ? 'HDR' : '',
      featureStateEnabled(cfg.compatibility.auto_dxvk_nvapi) ? 'DXVK-NVAPI' : ''
    ]
    if (featureStateEnabled(cfg.environment.gamescope.state)) {
      if (cfg.environment.gamescope.game_width.trim() && cfg.environment.gamescope.game_height.trim()) {
        enhancementItems.push(
          `${cfg.environment.gamescope.game_width.trim()}x${cfg.environment.gamescope.game_height.trim()}`
        )
      }
      if (cfg.environment.gamescope.window_type !== 'windowed') {
        enhancementItems.push(
          cfg.environment.gamescope.window_type === 'fullscreen' ? ct('luthier_fullscreen') : ct('luthier_borderless')
        )
      }
      if (cfg.environment.gamescope.enable_limiter) {
        enhancementItems.push(`FPS ${cfg.environment.gamescope.fps_limiter || '?'} / ${cfg.environment.gamescope.fps_limiter_no_focus || '?'}`)
      }
    }

    const winecfgItems: string[] = []
    if (cfg.winecfg.windows_version) {
      winecfgItems.push(`${ct('luthier_summary_windows_version')}: ${cfg.winecfg.windows_version}`)
    }
    if (cfg.winecfg.dll_overrides.length > 0) {
      winecfgItems.push(`${ct('luthier_dll_overrides')}: ${cfg.winecfg.dll_overrides.length}`)
    }
    if (cfg.winecfg.screen_dpi != null) winecfgItems.push(`DPI ${cfg.winecfg.screen_dpi}`)
    if (!cfg.winecfg.virtual_desktop.state.use_wine_default) {
      winecfgItems.push(
        `${ct('luthier_summary_virtual_desktop')}: ${
          featureStateEnabled(cfg.winecfg.virtual_desktop.state.state) ? ct('luthier_label_enabled') : ct('luthier_label_disabled')
        }`
      )
    }
    if (cfg.winecfg.virtual_desktop.resolution) {
      winecfgItems.push(`${ct('luthier_desktop')} ${cfg.winecfg.virtual_desktop.resolution}`)
    }
    if (cfg.winecfg.audio_driver) winecfgItems.push(`${ct('luthier_audio')}: ${cfg.winecfg.audio_driver}`)
    if (cfg.winecfg.drives.length > 0) winecfgItems.push(`${ct('luthier_drives')}: ${cfg.winecfg.drives.length}`)
    if (cfg.winecfg.desktop_folders.length > 0) winecfgItems.push(`${ct('luthier_special_folders')}: ${cfg.winecfg.desktop_folders.length}`)
    if (!cfg.winecfg.desktop_integration.use_wine_default) winecfgItems.push(ct('luthier_desktop_integration'))
    if (!cfg.winecfg.mime_associations.use_wine_default) winecfgItems.push(ct('luthier_summary_mime_protocols'))

    // Keep the same order as the navigation tabs.
    pushRow(ct('luthier_label_game'), [cfg.game_name || null, exeName ? `EXE: ${exeName}` : null])
    pushRow(ct('luthier_label_game_files_and_launch'), fileLaunchItems)
    pushRow(ct('luthier_label_runtime'), runtimeItems)
    pushRow(ct('luthier_enhancements'), enhancementItems)
    pushRow(ct('luthier_dependencies'), dependencyItems)
    pushRow('Winecfg', winecfgItems)
    pushRow(ct('luthier_launch_and_environment'), scriptEnvItems)
    return rows
  }

  return (
          <section class="stack">
            <FieldShell
              label={ct('luthier_configuration_summary')}
              help={ct('luthier_quick_view_of_how_many_items_were_configured_in_each_sec')}
              controlClass="hidden"
              footer={
                <Show
                  when={summaryRows().length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('luthier_no_items_found')}
                    </div>
                  }
                >
                  <div class="grid gap-2">
                    <For each={summaryRows()}>
                      {(row) => (
                        <div class="grid gap-1 rounded-md border border-border/60 bg-background/30 px-3 py-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
                          <div class="text-xs font-medium text-muted-foreground">{row.label}</div>
                          <div class="flex flex-wrap gap-1">
                            <For each={row.items}>
                              {(item) => (
                                <span class="inline-flex items-center rounded-md border border-border/60 bg-muted/25 px-2 py-0.5 text-xs leading-5">
                                  {item}
                                </span>
                              )}
                            </For>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              }
            >
              <span />
            </FieldShell>

            <section class="preview">
              <h3>{ct('luthier_configuration_preview_json')}</h3>
              <pre>{configPreview()}</pre>
            </section>

            <Show when={createExecutableValidationErrors().length > 0}>
              <Alert variant="warning">
                <IconAlertCircle />
                <AlertDescription>
                  <ul class="list-disc space-y-1 pl-4 text-sm">
                    <For each={createExecutableValidationErrors()}>
                      {(message) => <li>{message}</li>}
                    </For>
                  </ul>
                </AlertDescription>
              </Alert>
            </Show>

            <div class="row-actions">
              <Button
                type="button"
                class="btn-test"
                onClick={runTest}
                disabled={testingConfiguration() || creatingExecutable()}
              >
                <Show
                  when={!testingConfiguration()}
                  fallback={
                    <span class="inline-flex items-center gap-2">
                      <Spinner class="size-4" />
                      {ct('luthier_loading')}
                    </span>
                  }
                >
                  {t('testButton')}
                </Show>
              </Button>
              <Button
                type="button"
                class="btn-primary"
                onClick={runCreate}
                disabled={
                  creatingExecutable() ||
                  testingConfiguration() ||
                  createExecutableValidationErrors().length > 0
                }
                title={createExecutableBlockedReason() || undefined}
              >
                <Show
                  when={!creatingExecutable()}
                  fallback={
                    <span class="inline-flex items-center gap-2">
                      <Spinner class="size-4" />
                      {ct('luthier_loading')}
                    </span>
                  }
                >
                  {t('createButton')}
                </Show>
              </Button>
            </div>

            <section class="preview">
              <h3>{ct('luthier_last_action_result')}</h3>
              <pre>{resultJson() || t('noResult')}</pre>
            </section>
          </section>
  )
}
