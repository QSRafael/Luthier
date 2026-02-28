import { describe, expect, it } from 'vitest'

import { defaultGameConfig, type GameConfig } from '../../../models/config'
import { luthierTranslate } from '../copy'
import {
  buildConfigurationSummary,
  type SummaryBuilderContext,
  type SummaryRow,
} from './summary-builder'

function buildContext(
  mutate?: (config: GameConfig) => void,
  overrides?: Partial<
    Pick<SummaryBuilderContext, 'exePath' | 'gameRootManualOverride' | 'gameRootRelativeDisplay'>
  >
): SummaryBuilderContext {
  const config = defaultGameConfig()
  config.game_name = 'Demo Game'

  mutate?.(config)

  return {
    config,
    exePath: overrides?.exePath ?? '',
    gameRootManualOverride: overrides?.gameRootManualOverride ?? false,
    gameRootRelativeDisplay: overrides?.gameRootRelativeDisplay ?? './',
    ct: (key) => luthierTranslate('en-US', key),
  }
}

function rowByLabel(rows: SummaryRow[], label: string): SummaryRow {
  const row = rows.find((candidate) => candidate.label === label)
  expect(row).toBeDefined()
  return row as SummaryRow
}

describe('summary builder', () => {
  it('keeps only relevant rows and filters out empty/noisy items', () => {
    const rows = buildConfigurationSummary(buildContext())

    expect(rows.every((row) => row.items.length > 0)).toBe(true)
    expect(rows.every((row) => row.items.every((item) => item.trim().length > 0))).toBe(true)

    expect(
      rows.some(
        (row) => row.label === luthierTranslate('en-US', 'luthier_label_game_files_and_launch')
      )
    ).toBe(false)
    expect(
      rows.some((row) => row.label === luthierTranslate('en-US', 'luthier_enhancements'))
    ).toBe(false)
    expect(
      rows.some((row) => row.label === luthierTranslate('en-US', 'luthier_dependencies'))
    ).toBe(false)
    expect(
      rows.some((row) => row.label === luthierTranslate('en-US', 'luthier_launch_and_environment'))
    ).toBe(false)
  })

  it('compacts winetricks dependencies and keeps critical dependency counters', () => {
    const rows = buildConfigurationSummary(
      buildContext((config) => {
        config.dependencies = ['vcrun2022', 'corefonts', 'dxvk', 'mangohud', 'gamemode']
        config.registry_keys = [
          { path: 'HKCU\\Software\\Demo', name: 'A', value_type: 'REG_SZ', value: '1' },
          { path: 'HKCU\\Software\\Demo', name: 'B', value_type: 'REG_SZ', value: '2' },
        ]
        config.extra_system_dependencies = [
          {
            name: 'gamescope',
            state: 'OptionalOn',
            check_commands: ['gamescope'],
            check_env_vars: [],
            check_paths: [],
          },
        ]
      })
    )

    const depsRow = rowByLabel(rows, luthierTranslate('en-US', 'luthier_dependencies'))
    expect(depsRow.items).toContain('Winetricks: vcrun2022, corefonts, dxvk, mangohud, +1')
    expect(depsRow.items).toContain(`${luthierTranslate('en-US', 'luthier_windows_registry')}: 2`)
    expect(depsRow.items).toContain(
      `${luthierTranslate('en-US', 'luthier_extra_system_dependencies')}: 1`
    )
  })

  it('keeps stable section order and includes critical runtime/winecfg/scripts/deps items', () => {
    const rows = buildConfigurationSummary(
      buildContext(
        (config) => {
          config.runner.proton_version = 'GE-Proton9-1'
          config.runner.auto_update = true
          config.requirements.runtime.strict = true
          config.compatibility.easy_anti_cheat_runtime = 'OptionalOn'
          config.compatibility.battleye_runtime = 'MandatoryOn'

          config.launch_args = ['-dx11']
          config.integrity_files = ['./bin/game.exe']
          config.folder_mounts = [
            {
              source_relative_path: './mods',
              target_windows_path: 'Z:\\mods',
              create_source_if_missing: true,
            },
          ]

          config.environment.gamescope.state = 'OptionalOn'
          config.environment.gamescope.game_width = '1280'
          config.environment.gamescope.game_height = '720'
          config.environment.gamescope.enable_limiter = true
          config.environment.gamescope.fps_limiter = '60'
          config.environment.gamescope.fps_limiter_no_focus = '30'
          config.environment.mangohud = 'OptionalOn'
          config.environment.gamemode = 'OptionalOn'
          config.environment.prime_offload = 'OptionalOn'
          config.compatibility.wine_wayland = 'OptionalOn'
          config.compatibility.hdr = 'OptionalOn'
          config.compatibility.auto_dxvk_nvapi = 'OptionalOn'

          config.dependencies = ['vcrun2022']
          config.registry_keys = [
            { path: 'HKCU\\Software\\Demo', name: 'A', value_type: 'REG_SZ', value: '1' },
          ]

          config.winecfg.windows_version = 'win10'
          config.winecfg.dll_overrides = [{ dll: 'd3d11', mode: 'native,builtin' }]
          config.winecfg.screen_dpi = 120
          config.winecfg.virtual_desktop.state = { state: 'OptionalOn', use_wine_default: false }
          config.winecfg.virtual_desktop.resolution = '1280x720'
          config.winecfg.audio_driver = 'alsa'
          config.winecfg.desktop_folders = [
            {
              folder_key: 'desktop',
              shortcut_name: 'Desktop',
              linux_path: '/home/user/Desktop',
            },
          ]
          config.winecfg.desktop_integration = { state: 'OptionalOn', use_wine_default: false }
          config.winecfg.mime_associations = { state: 'OptionalOn', use_wine_default: false }

          config.scripts.pre_launch = 'echo pre'
          config.scripts.post_launch = 'echo post'
          config.compatibility.wrapper_commands = [
            {
              state: 'OptionalOn',
              executable: '/usr/bin/gamescope',
              args: '--fps 60',
            },
          ]
          config.environment.custom_vars = { DXVK_HUD: '1' }
        },
        { gameRootManualOverride: true, gameRootRelativeDisplay: './demo' }
      )
    )

    expect(rows.map((row) => row.label)).toEqual([
      luthierTranslate('en-US', 'luthier_label_game'),
      luthierTranslate('en-US', 'luthier_label_game_files_and_launch'),
      luthierTranslate('en-US', 'luthier_label_runtime'),
      luthierTranslate('en-US', 'luthier_enhancements'),
      luthierTranslate('en-US', 'luthier_dependencies'),
      'Winecfg',
      luthierTranslate('en-US', 'luthier_launch_and_environment'),
    ])

    const runtimeRow = rowByLabel(rows, luthierTranslate('en-US', 'luthier_label_runtime'))
    expect(runtimeRow.items).toContain('Proton (GE-Proton9-1)')
    expect(runtimeRow.items).toContain('EAC Runtime')
    expect(runtimeRow.items).toContain('BattlEye Runtime')

    const winecfgRow = rowByLabel(rows, 'Winecfg')
    expect(winecfgRow.items).toContain(
      `${luthierTranslate('en-US', 'luthier_summary_windows_version')}: win10`
    )
    expect(winecfgRow.items).toContain(`${luthierTranslate('en-US', 'luthier_dll_overrides')}: 1`)
    expect(winecfgRow.items).toContain('DPI 120')
    expect(winecfgRow.items).toContain(`${luthierTranslate('en-US', 'luthier_special_folders')}: 1`)

    const scriptsRow = rowByLabel(rows, luthierTranslate('en-US', 'luthier_launch_and_environment'))
    expect(scriptsRow.items).toContain('pre-launch')
    expect(scriptsRow.items).toContain('post-launch')
    expect(scriptsRow.items).toContain(`${luthierTranslate('en-US', 'luthier_wrappers')}: 1`)
    expect(scriptsRow.items).toContain('Env: 1')

    const depsRow = rowByLabel(rows, luthierTranslate('en-US', 'luthier_dependencies'))
    expect(depsRow.items).toContain('Winetricks: vcrun2022')
    expect(depsRow.items).toContain(`${luthierTranslate('en-US', 'luthier_windows_registry')}: 1`)
  })

  it('prefers executable basename from absolute exePath over relative path fallback', () => {
    const rows = buildConfigurationSummary(
      buildContext(undefined, {
        exePath: 'C:\\Games\\Demo\\Launcher.EXE',
      })
    )

    const gameRow = rowByLabel(rows, luthierTranslate('en-US', 'luthier_label_game'))
    expect(gameRow.items).toContain('EXE: Launcher.EXE')
    expect(gameRow.items).not.toContain('EXE: game.exe')
  })
})
