/**
 * domain/create-executable-guards.ts
 *
 * Pure domain rules for validating if a configuration can be packaged into
 * an executable.
 *
 * Rules:
 *   - Pure TypeScript, no `solid-js` imports.
 *   - No JSX / UI component imports.
 *   - No `toast` or `invokeCommand` side effects.
 *
 * Extracted from `useLuthierController.ts` to centralize business logic.
 */

import type { GameConfig } from '../../../models/config'
import {
  validateCommandToken,
  validateDllName,
  validateEnvVarName,
  validateLinuxPath,
  validatePositiveIntegerString,
  validateRegistryPath,
  validateRegistryValueType,
  validateRelativeGamePath,
  validateWindowsDriveSerial,
  validateWindowsFriendlyName,
  validateWindowsPath,
  validateWrapperExecutable,
} from '../field-validation'
import type { Locale } from '../../../i18n'
import type { LuthierCopyKey } from '../copy'

// Dependencies that were previously in controller utils
function isLikelyAbsolutePath(path: string): boolean {
  const trimmed = path.trim()
  return trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)
}

function hasWindowsLauncherExtension(path: string): boolean {
  const lower = path.trim().toLowerCase()
  return (
    lower.endsWith('.exe') ||
    lower.endsWith('.bat') ||
    lower.endsWith('.cmd') ||
    lower.endsWith('.com')
  )
}

function relativeInsideBase(base: string, target: string): string | null {
  const b = base.replace(/\\/g, '/').replace(/\/+$/, '')
  const t = target.replace(/\\/g, '/').replace(/\/+$/, '')
  if (t === b) return '.'
  if (!t.startsWith(`${b}/`)) return null
  return t.slice(b.length + 1) || '.'
}

function isFeatureEnabled(value: string): boolean {
  return value === 'MandatoryOn' || value === 'OptionalOn'
}

export type CreateExecutableGuardsContext = {
  config: GameConfig
  locale: Locale
  exePath: string
  gameRoot: string
  /**
   * Translate function mapping a LuthierCopyKey to a localized string.
   */
  ct: (key: LuthierCopyKey) => string
}

/**
 * Validates the current configuration state and returns a list of error strings
 * representing conditions that block the executable packaging.
 * An empty array means the configuration is valid and can be packaged.
 */
export function getCreateExecutableValidationErrors(ctx: CreateExecutableGuardsContext): string[] {
  const errors: string[] = []
  const cfg = ctx.config
  const gamescope = cfg.environment.gamescope
  const currentLocale = ctx.locale
  const ct = ctx.ct

  const prefixed = (prefixPt: string, prefixEn: string, message: string) =>
    currentLocale === 'pt-BR' ? `${prefixPt}: ${message}` : `${prefixEn}: ${message}`

  if (!cfg.game_name.trim()) {
    errors.push(
      currentLocale === 'pt-BR'
        ? 'Preencha o nome do jogo antes de criar o executável.'
        : 'Fill in the game name before creating the executable.'
    )
  }

  const currentExePath = ctx.exePath.trim()
  if (!currentExePath) {
    errors.push(
      currentLocale === 'pt-BR'
        ? 'Selecione o executável principal antes de criar o executável.'
        : 'Select the main executable before creating the executable.'
    )
  } else if (!hasWindowsLauncherExtension(currentExePath)) {
    errors.push(
      currentLocale === 'pt-BR'
        ? 'O executável principal precisa ser .exe, .bat, .cmd ou .com.'
        : 'The main executable must be .exe, .bat, .cmd or .com.'
    )
  }

  if (!cfg.exe_hash.trim() || !/^[0-9a-f]{64}$/i.test(cfg.exe_hash.trim())) {
    errors.push(
      currentLocale === 'pt-BR'
        ? 'Hash SHA-256 inválido ou ausente. Selecione um executável válido e aguarde o cálculo.'
        : 'SHA-256 hash is missing or invalid. Select a valid executable and wait for hashing.'
    )
  }

  const relativeExeValidation = validateRelativeGamePath(cfg.relative_exe_path, currentLocale, {
    kind: 'file',
    allowDot: false,
    requireDotPrefix: true,
  })
  if (relativeExeValidation.error) {
    errors.push(prefixed('Executável relativo', 'Relative executable', relativeExeValidation.error))
  }

  const rootTrimmed = ctx.gameRoot.trim()
  if (
    currentExePath &&
    rootTrimmed &&
    isLikelyAbsolutePath(currentExePath) &&
    isLikelyAbsolutePath(rootTrimmed)
  ) {
    if (relativeInsideBase(rootTrimmed, currentExePath) === null) {
      errors.push(
        currentLocale === 'pt-BR'
          ? 'A pasta raiz do jogo precisa conter o executável principal.'
          : 'The game root folder must contain the main executable.'
      )
    }
  }

  cfg.integrity_files.forEach((value: string, index: number) => {
    const validation = validateRelativeGamePath(value, currentLocale, {
      kind: 'file',
      allowDot: false,
      requireDotPrefix: true,
    })
    if (validation.error) {
      errors.push(
        prefixed(
          `Arquivos obrigatórios #${index + 1}`,
          `Required files #${index + 1}`,
          validation.error
        )
      )
    }
  })

  cfg.folder_mounts.forEach((item: (typeof cfg.folder_mounts)[0], index: number) => {
    const sourceValidation = validateRelativeGamePath(item.source_relative_path, currentLocale, {
      kind: 'folder',
      allowDot: true,
      requireDotPrefix: false,
    })
    if (sourceValidation.error) {
      errors.push(
        prefixed(
          `Montagem #${index + 1} (origem)`,
          `Mount #${index + 1} (source)`,
          sourceValidation.error
        )
      )
    }
    const targetValidation = validateWindowsPath(item.target_windows_path, currentLocale)
    if (targetValidation.error) {
      errors.push(
        prefixed(
          `Montagem #${index + 1} (destino)`,
          `Mount #${index + 1} (target)`,
          targetValidation.error
        )
      )
    }
  })

  Object.entries(cfg.environment.custom_vars).forEach(([key]) => {
    const validation = validateEnvVarName(key, currentLocale)
    if (validation.error) {
      errors.push(
        prefixed(`Variável de ambiente (${key})`, `Environment variable (${key})`, validation.error)
      )
    }
  })

  cfg.compatibility.wrapper_commands.forEach(
    (item: (typeof cfg.compatibility.wrapper_commands)[0], index: number) => {
      if (!item.executable.trim()) {
        errors.push(
          prefixed(
            `Wrapper #${index + 1}`,
            `Wrapper #${index + 1}`,
            currentLocale === 'pt-BR'
              ? 'Informe o executável/comando do wrapper.'
              : 'Provide the wrapper executable/command.'
          )
        )
        return
      }
      const validation = validateWrapperExecutable(item.executable, currentLocale)
      if (validation.error) {
        errors.push(prefixed(`Wrapper #${index + 1}`, `Wrapper #${index + 1}`, validation.error))
      }
    }
  )

  cfg.registry_keys.forEach((item: (typeof cfg.registry_keys)[0], index: number) => {
    if (!item.path.trim()) {
      errors.push(
        prefixed(
          `Registro #${index + 1} (path)`,
          `Registry #${index + 1} (path)`,
          currentLocale === 'pt-BR' ? 'Informe o path do registro.' : 'Provide the registry path.'
        )
      )
    }
    if (!item.name.trim()) {
      errors.push(
        prefixed(
          `Registro #${index + 1} (nome)`,
          `Registry #${index + 1} (name)`,
          currentLocale === 'pt-BR'
            ? 'Informe o nome da chave/valor.'
            : 'Provide the key/value name.'
        )
      )
    }
    const pathValidation = validateRegistryPath(item.path, currentLocale)
    if (pathValidation.error) {
      errors.push(
        prefixed(
          `Registro #${index + 1} (path)`,
          `Registry #${index + 1} (path)`,
          pathValidation.error
        )
      )
    }
    const typeValidation = validateRegistryValueType(item.value_type, currentLocale)
    if (typeValidation.error) {
      errors.push(
        prefixed(
          `Registro #${index + 1} (tipo)`,
          `Registry #${index + 1} (type)`,
          typeValidation.error
        )
      )
    }
  })

  cfg.extra_system_dependencies.forEach(
    (item: (typeof cfg.extra_system_dependencies)[0], index: number) => {
      if (!item.name.trim()) {
        errors.push(
          prefixed(
            `Dependência extra #${index + 1}`,
            `Extra dependency #${index + 1}`,
            currentLocale === 'pt-BR'
              ? 'Informe o nome da dependência.'
              : 'Provide the dependency name.'
          )
        )
      }
      item.check_commands.forEach((command: string, commandIndex: number) => {
        const validation = validateCommandToken(command, currentLocale)
        if (validation.error) {
          errors.push(
            prefixed(
              `Dependência extra #${index + 1} (comando ${commandIndex + 1})`,
              `Extra dependency #${index + 1} (command ${commandIndex + 1})`,
              validation.error
            )
          )
        }
      })
      item.check_env_vars.forEach((envVar: string, envIndex: number) => {
        const validation = validateEnvVarName(envVar, currentLocale)
        if (validation.error) {
          errors.push(
            prefixed(
              `Dependência extra #${index + 1} (env ${envIndex + 1})`,
              `Extra dependency #${index + 1} (env ${envIndex + 1})`,
              validation.error
            )
          )
        }
      })
      item.check_paths.forEach((path: string, pathIndex: number) => {
        const validation = validateLinuxPath(path, currentLocale, true)
        if (validation.error) {
          errors.push(
            prefixed(
              `Dependência extra #${index + 1} (path ${pathIndex + 1})`,
              `Extra dependency #${index + 1} (path ${pathIndex + 1})`,
              validation.error
            )
          )
        }
      })
    }
  )

  cfg.winecfg.dll_overrides.forEach(
    (item: (typeof cfg.winecfg.dll_overrides)[0], index: number) => {
      const validation = validateDllName(item.dll, currentLocale)
      if (validation.error) {
        errors.push(
          prefixed(`DLL override #${index + 1}`, `DLL override #${index + 1}`, validation.error)
        )
      }
    }
  )

  cfg.winecfg.desktop_folders.forEach(
    (item: (typeof cfg.winecfg.desktop_folders)[0], index: number) => {
      const shortcutValidation = validateWindowsFriendlyName(
        item.shortcut_name,
        currentLocale,
        'o nome do atalho',
        'the shortcut name'
      )
      if (shortcutValidation.error) {
        errors.push(
          prefixed(
            `Pasta especial #${index + 1} (atalho)`,
            `Special folder #${index + 1} (shortcut)`,
            shortcutValidation.error
          )
        )
      }
      const pathValidation = validateLinuxPath(item.linux_path, currentLocale, true)
      if (pathValidation.error) {
        errors.push(
          prefixed(
            `Pasta especial #${index + 1} (path Linux)`,
            `Special folder #${index + 1} (Linux path)`,
            pathValidation.error
          )
        )
      }
    }
  )

  cfg.winecfg.drives.forEach((item: (typeof cfg.winecfg.drives)[0], index: number) => {
    if (item.host_path) {
      const hostPathValidation = validateLinuxPath(item.host_path, currentLocale, true)
      if (hostPathValidation.error) {
        errors.push(
          prefixed(
            `Drive #${index + 1} (path)`,
            `Drive #${index + 1} (path)`,
            hostPathValidation.error
          )
        )
      }
    }
    if (item.label) {
      const labelValidation = validateWindowsFriendlyName(
        item.label,
        currentLocale,
        'o rótulo',
        'the label'
      )
      if (labelValidation.error) {
        errors.push(
          prefixed(
            `Drive #${index + 1} (rótulo)`,
            `Drive #${index + 1} (label)`,
            labelValidation.error
          )
        )
      }
    }
    if (item.serial) {
      const serialValidation = validateWindowsDriveSerial(item.serial, currentLocale)
      if (serialValidation.error) {
        errors.push(
          prefixed(
            `Drive #${index + 1} (serial)`,
            `Drive #${index + 1} (serial)`,
            serialValidation.error
          )
        )
      }
    }
  })

  if (!cfg.runner.proton_version.trim()) {
    errors.push(
      currentLocale === 'pt-BR'
        ? 'Preencha a versão do Proton/Wine antes de criar o executável.'
        : 'Fill the Proton/Wine version before creating the executable.'
    )
  }

  if (
    !cfg.winecfg.virtual_desktop.state.use_wine_default &&
    isFeatureEnabled(cfg.winecfg.virtual_desktop.state.state)
  ) {
    const [wRaw = '', hRaw = ''] = (cfg.winecfg.virtual_desktop.resolution ?? '').split('x')
    const widthValidation = validatePositiveIntegerString(wRaw, currentLocale, {
      min: 1,
      max: 16384,
      labelPt: 'Largura do desktop virtual',
      labelEn: 'Virtual desktop width',
    })
    const heightValidation = validatePositiveIntegerString(hRaw, currentLocale, {
      min: 1,
      max: 16384,
      labelPt: 'Altura do desktop virtual',
      labelEn: 'Virtual desktop height',
    })
    if (widthValidation.error || heightValidation.error) {
      errors.push(
        prefixed(
          'Winecfg (desktop virtual)',
          'Winecfg (virtual desktop)',
          widthValidation.error ?? heightValidation.error ?? ''
        )
      )
    }
  }

  if (isFeatureEnabled(gamescope.state)) {
    const gameWidthValidation = validatePositiveIntegerString(gamescope.game_width, currentLocale, {
      min: 1,
      max: 16384,
      labelPt: 'Largura da resolução do jogo',
      labelEn: 'Game resolution width',
    })
    const gameHeightValidation = validatePositiveIntegerString(
      gamescope.game_height,
      currentLocale,
      {
        min: 1,
        max: 16384,
        labelPt: 'Altura da resolução do jogo',
        labelEn: 'Game resolution height',
      }
    )
    if (!gamescope.game_width.trim() || !gamescope.game_height.trim()) {
      errors.push(ct('luthier_fill_gamescope_game_resolution_before_creating'))
    } else if (gameWidthValidation.error || gameHeightValidation.error) {
      errors.push(
        prefixed(
          'Gamescope',
          'Gamescope',
          gameWidthValidation.error ?? gameHeightValidation.error ?? ''
        )
      )
    }

    const usesMonitorResolution = !gamescope.output_width.trim() && !gamescope.output_height.trim()
    if (!usesMonitorResolution) {
      const outputWidthValidation = validatePositiveIntegerString(
        gamescope.output_width,
        currentLocale,
        {
          min: 1,
          max: 16384,
          labelPt: 'Largura da resolução de saída',
          labelEn: 'Output resolution width',
        }
      )
      const outputHeightValidation = validatePositiveIntegerString(
        gamescope.output_height,
        currentLocale,
        {
          min: 1,
          max: 16384,
          labelPt: 'Altura da resolução de saída',
          labelEn: 'Output resolution height',
        }
      )
      if (!gamescope.output_width.trim() || !gamescope.output_height.trim()) {
        errors.push(ct('luthier_fill_gamescope_output_resolution_or_enable_monitor_auto_befo'))
      } else if (outputWidthValidation.error || outputHeightValidation.error) {
        errors.push(
          prefixed(
            'Gamescope',
            'Gamescope',
            outputWidthValidation.error ?? outputHeightValidation.error ?? ''
          )
        )
      }
    }

    if (gamescope.enable_limiter) {
      const fpsFocusValidation = validatePositiveIntegerString(
        gamescope.fps_limiter,
        currentLocale,
        {
          min: 1,
          max: 1000,
          labelPt: 'Limite de FPS',
          labelEn: 'FPS limit',
        }
      )
      const fpsNoFocusValidation = validatePositiveIntegerString(
        gamescope.fps_limiter_no_focus,
        currentLocale,
        {
          min: 1,
          max: 1000,
          labelPt: 'Limite de FPS sem foco',
          labelEn: 'FPS limit without focus',
        }
      )
      if (!gamescope.fps_limiter.trim() || !gamescope.fps_limiter_no_focus.trim()) {
        errors.push(ct('luthier_fill_gamescope_fps_limits_before_creating'))
      } else if (fpsFocusValidation.error || fpsNoFocusValidation.error) {
        errors.push(
          prefixed(
            'Gamescope',
            'Gamescope',
            fpsFocusValidation.error ?? fpsNoFocusValidation.error ?? ''
          )
        )
      }
    }
  }

  return errors
}

/**
 * Stable alias for unit tests and external consumers that should not depend on
 * internal naming changes.
 */
export const validateCreateExecutableGuards = getCreateExecutableValidationErrors
