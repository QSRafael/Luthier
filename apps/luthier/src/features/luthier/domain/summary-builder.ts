/**
 * domain/summary-builder.ts
 *
 * Pure domain logic for building the configuration summary used in the Review tab.
 *
 * Rules:
 *   - Pure TypeScript, no `solid-js` imports.
 *   - No JSX / UI component imports.
 *   - Returns agnostic data structures (arrays of labels and values).
 */

import type { GameConfig } from '../../../models/config'
import type { LuthierCopyKey } from '../copy'

// Minimal subset of feature state needed for summary
function featureStateEnabled(state: string): boolean {
  return state === 'MandatoryOn' || state === 'OptionalOn'
}

// Minimal path basename helper
function basenamePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(idx + 1) : normalized
}

function compactList(values: string[], max: number = 3): string[] {
  const filtered = values.map((value) => value.trim()).filter(Boolean)
  if (filtered.length <= max) return filtered
  return [...filtered.slice(0, max), `+${filtered.length - max}`]
}

export type SummaryRow = {
  label: string
  items: string[]
}

export type SummaryBuilderContext = {
  config: GameConfig
  exePath: string
  gameRootManualOverride: boolean
  gameRootRelativeDisplay: string
  /**
   * Translate function mapping a LuthierCopyKey to a localized string.
   */
  ct: (key: LuthierCopyKey) => string
}

/**
 * Builds the compact rows of summary items for the Review tab.
 * Extracts the inline logic from `review-tab.tsx` into a testable pure function.
 */
export function buildConfigurationSummary(ctx: SummaryBuilderContext): SummaryRow[] {
  const cfg = ctx.config
  const ct = ctx.ct
  const rows: SummaryRow[] = []

  const pushRow = (label: string, items: Array<string | null | undefined>) => {
    const normalized = items.map((item) => (item ?? '').trim()).filter(Boolean)
    if (normalized.length > 0) rows.push({ label, items: normalized })
  }

  const exeName = (() => {
    const absolute = ctx.exePath.trim()
    if (absolute) return basenamePath(absolute)
    const relative = cfg.relative_exe_path.trim()
    return relative ? basenamePath(relative) : ''
  })()

  const runtimeItems = [
    cfg.runner.runtime_preference === 'Proton'
      ? `Proton (${cfg.runner.proton_version || 'GE-Proton-latest'})`
      : cfg.runner.runtime_preference,
    cfg.requirements.runtime.strict
      ? `${ct('luthier_summary_strict_proton_version')}: ${cfg.runner.proton_version || 'GE-Proton-latest'}`
      : '',
    cfg.runner.esync ? 'ESYNC' : '',
    cfg.runner.fsync ? 'FSYNC' : '',
    cfg.runner.auto_update ? ct('luthier_auto_update') : '',
    featureStateEnabled(cfg.compatibility.easy_anti_cheat_runtime) ? 'EAC Runtime' : '',
    featureStateEnabled(cfg.compatibility.battleye_runtime) ? 'BattlEye Runtime' : '',
  ]

  const fileLaunchItems = [
    ctx.gameRootManualOverride
      ? `${ct('luthier_summary_game_root')}: ${ctx.gameRootRelativeDisplay}`
      : '',
    cfg.launch_args.length > 0 ? `Args: ${cfg.launch_args.length}` : '',
    cfg.integrity_files.length > 0
      ? `${ct('luthier_required_files')}: ${cfg.integrity_files.length}`
      : '',
    cfg.folder_mounts.length > 0 ? `${ct('luthier_mounts')}: ${cfg.folder_mounts.length}` : '',
  ]

  const dependencyItems = [
    cfg.dependencies.length > 0 ? `Winetricks: ${compactList(cfg.dependencies, 4).join(', ')}` : '',
    cfg.registry_keys.length > 0
      ? `${ct('luthier_windows_registry')}: ${cfg.registry_keys.length}`
      : '',
    cfg.extra_system_dependencies.length > 0
      ? `${ct('luthier_extra_system_dependencies')}: ${cfg.extra_system_dependencies.length}`
      : '',
  ]

  const scriptEnvItems = [
    cfg.scripts.pre_launch.trim() ? 'pre-launch' : '',
    cfg.scripts.post_launch.trim() ? 'post-launch' : '',
    cfg.compatibility.wrapper_commands.length > 0
      ? `${ct('luthier_wrappers')}: ${cfg.compatibility.wrapper_commands.length}`
      : '',
    Object.keys(cfg.environment.custom_vars).length > 0
      ? `Env: ${Object.keys(cfg.environment.custom_vars).length}`
      : '',
  ]

  const enhancementItems = [
    featureStateEnabled(cfg.environment.gamescope.state) ? 'Gamescope' : '',
    featureStateEnabled(cfg.environment.mangohud) ? 'MangoHud' : '',
    featureStateEnabled(cfg.environment.gamemode) ? 'GameMode' : '',
    featureStateEnabled(cfg.environment.prime_offload) ? ct('luthier_use_dedicated_gpu') : '',
    featureStateEnabled(cfg.compatibility.wine_wayland) ? 'Wine-Wayland' : '',
    featureStateEnabled(cfg.compatibility.hdr) ? 'HDR' : '',
    featureStateEnabled(cfg.compatibility.auto_dxvk_nvapi) ? 'DXVK-NVAPI' : '',
  ]

  if (featureStateEnabled(cfg.environment.gamescope.state)) {
    if (
      cfg.environment.gamescope.game_width.trim() &&
      cfg.environment.gamescope.game_height.trim()
    ) {
      enhancementItems.push(
        `${cfg.environment.gamescope.game_width.trim()}x${cfg.environment.gamescope.game_height.trim()}`
      )
    }
    if (cfg.environment.gamescope.window_type !== 'windowed') {
      enhancementItems.push(
        cfg.environment.gamescope.window_type === 'fullscreen'
          ? ct('luthier_fullscreen')
          : ct('luthier_borderless')
      )
    }
    if (cfg.environment.gamescope.enable_limiter) {
      enhancementItems.push(
        `FPS ${cfg.environment.gamescope.fps_limiter || '?'} / ${cfg.environment.gamescope.fps_limiter_no_focus || '?'}`
      )
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
        featureStateEnabled(cfg.winecfg.virtual_desktop.state.state)
          ? ct('luthier_label_enabled')
          : ct('luthier_label_disabled')
      }`
    )
  }
  if (cfg.winecfg.virtual_desktop.resolution) {
    winecfgItems.push(`${ct('luthier_desktop')} ${cfg.winecfg.virtual_desktop.resolution}`)
  }
  if (cfg.winecfg.audio_driver)
    winecfgItems.push(`${ct('luthier_audio')}: ${cfg.winecfg.audio_driver}`)
  if (cfg.winecfg.drives.length > 0)
    winecfgItems.push(`${ct('luthier_drives')}: ${cfg.winecfg.drives.length}`)
  if (cfg.winecfg.desktop_folders.length > 0) {
    winecfgItems.push(`${ct('luthier_special_folders')}: ${cfg.winecfg.desktop_folders.length}`)
  }
  if (!cfg.winecfg.desktop_integration.use_wine_default) {
    winecfgItems.push(ct('luthier_desktop_integration'))
  }
  if (!cfg.winecfg.mime_associations.use_wine_default) {
    winecfgItems.push(ct('luthier_summary_mime_protocols'))
  }

  pushRow(ct('luthier_label_game'), [cfg.game_name || null, exeName ? `EXE: ${exeName}` : null])
  pushRow(ct('luthier_label_game_files_and_launch'), fileLaunchItems)
  pushRow(ct('luthier_label_runtime'), runtimeItems)
  pushRow(ct('luthier_enhancements'), enhancementItems)
  pushRow(ct('luthier_dependencies'), dependencyItems)
  pushRow('Winecfg', winecfgItems)
  pushRow(ct('luthier_launch_and_environment'), scriptEnvItems)

  return rows
}
