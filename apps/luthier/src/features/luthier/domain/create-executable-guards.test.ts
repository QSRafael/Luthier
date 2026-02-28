import { describe, expect, it } from 'vitest'

import type { Locale } from '../../../i18n'
import { defaultGameConfig, type GameConfig } from '../../../models/config'
import { luthierFormat, luthierTranslate } from '../copy'
import {
  getCreateExecutableValidationErrors,
  type CreateExecutableGuardsContext,
  validateCreateExecutableGuards,
} from './create-executable-guards'

const VALID_SHA256 = 'a'.repeat(64)

type RuntimePaths = {
  exePath: string
  gameRoot: string
}

function buildContext(
  locale: Locale = 'en-US',
  mutate?: (config: GameConfig, runtimePaths: RuntimePaths) => void
): CreateExecutableGuardsContext {
  const config = defaultGameConfig()
  config.game_name = 'Demo Game'
  config.exe_hash = VALID_SHA256
  config.relative_exe_path = './game.exe'
  config.runner.proton_version = 'GE-Proton9-1'

  const runtimePaths: RuntimePaths = {
    exePath: '/games/demo/game.exe',
    gameRoot: '/games/demo',
  }

  mutate?.(config, runtimePaths)

  return {
    config,
    locale,
    exePath: runtimePaths.exePath,
    gameRoot: runtimePaths.gameRoot,
    ct: (key) => luthierTranslate(locale, key),
  }
}

describe('create executable guards', () => {
  it('exposes a stable alias for the main validator', () => {
    const ctx = buildContext('en-US')
    expect(validateCreateExecutableGuards(ctx)).toEqual(getCreateExecutableValidationErrors(ctx))
  })

  it('returns no blocking errors for a valid baseline configuration', () => {
    expect(validateCreateExecutableGuards(buildContext('en-US'))).toEqual([])
  })

  it('blocks creation when gamescope is enabled without game resolution (pt-BR)', () => {
    const errors = validateCreateExecutableGuards(
      buildContext('pt-BR', (config) => {
        config.environment.gamescope.state = 'MandatoryOn'
      })
    )

    expect(errors).toContain(
      luthierTranslate('pt-BR', 'luthier_fill_gamescope_game_resolution_before_creating')
    )
  })

  it('blocks creation when gamescope output resolution is partially filled', () => {
    const errors = validateCreateExecutableGuards(
      buildContext('en-US', (config) => {
        config.environment.gamescope.state = 'OptionalOn'
        config.environment.gamescope.game_width = '1280'
        config.environment.gamescope.game_height = '720'
        config.environment.gamescope.output_width = '1920'
        config.environment.gamescope.output_height = ''
      })
    )

    expect(errors).toContain(
      luthierTranslate(
        'en-US',
        'luthier_fill_gamescope_output_resolution_or_enable_monitor_auto_befo'
      )
    )
  })

  it('blocks creation when gamescope FPS limiter is enabled with missing required values', () => {
    const errors = validateCreateExecutableGuards(
      buildContext('en-US', (config) => {
        config.environment.gamescope.state = 'OptionalOn'
        config.environment.gamescope.game_width = '1280'
        config.environment.gamescope.game_height = '720'
        config.environment.gamescope.enable_limiter = true
        config.environment.gamescope.fps_limiter = '60'
        config.environment.gamescope.fps_limiter_no_focus = ''
      })
    )

    expect(errors).toContain(
      luthierTranslate('en-US', 'luthier_fill_gamescope_fps_limits_before_creating')
    )
  })

  it('returns actionable gamescope numeric validation message for invalid values', () => {
    const errors = validateCreateExecutableGuards(
      buildContext('en-US', (config) => {
        config.environment.gamescope.state = 'OptionalOn'
        config.environment.gamescope.game_width = 'abc'
        config.environment.gamescope.game_height = '720'
      })
    )

    expect(errors).toContain(
      `Gamescope: ${luthierFormat('en-US', 'luthier_validation_positive_integer_digits', {
        label: 'Game resolution width',
      })}`
    )
  })

  it('blocks wrapper command entries with missing executable', () => {
    const errors = validateCreateExecutableGuards(
      buildContext('en-US', (config) => {
        config.compatibility.wrapper_commands = [
          {
            state: 'OptionalOn',
            executable: '',
            args: '--verbose',
          },
        ]
      })
    )

    expect(errors).toContain('Wrapper #1: Provide the wrapper executable/command.')
  })

  it('blocks winecfg desktop folder when Linux path is invalid', () => {
    const errors = validateCreateExecutableGuards(
      buildContext('en-US', (config) => {
        config.winecfg.desktop_folders = [
          {
            folder_key: 'desktop',
            shortcut_name: 'Desktop',
            linux_path: 'C:\\Users\\Rafael\\Desktop',
          },
        ]
      })
    )

    expect(errors).toContain(
      `Special folder #1 (Linux path): ${luthierTranslate(
        'en-US',
        'luthier_validation_linux_path_expected'
      )}`
    )
  })

  it('blocks folder mounts with invalid Windows target path', () => {
    const errors = validateCreateExecutableGuards(
      buildContext('en-US', (config) => {
        config.folder_mounts = [
          {
            source_relative_path: './mods',
            target_windows_path: 'mods-target',
            create_source_if_missing: true,
          },
        ]
      })
    )

    expect(errors).toContain(
      `Mount #1 (target): ${luthierTranslate('en-US', 'luthier_validation_windows_path_invalid_format')}`
    )
  })

  it('blocks creation when game root does not contain the selected executable', () => {
    const errors = validateCreateExecutableGuards(
      buildContext('en-US', (_, runtimePaths) => {
        runtimePaths.exePath = '/other/location/game.exe'
      })
    )

    expect(errors).toContain('The game root folder must contain the main executable.')
  })

  it('blocks winecfg drive host path when a Windows path is provided', () => {
    const errors = validateCreateExecutableGuards(
      buildContext('en-US', (config) => {
        config.winecfg.drives[0].host_path = 'C:\\games\\prefix'
      })
    )

    expect(errors).toContain(
      `Drive #1 (path): ${luthierTranslate('en-US', 'luthier_validation_linux_path_expected')}`
    )
  })
})
