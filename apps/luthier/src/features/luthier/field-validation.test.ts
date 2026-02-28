import { describe, expect, it } from 'vitest'

import {
  validateLinuxPath,
  validatePositiveIntegerString,
  validateWindowsFriendlyName,
  validateWindowsPath,
} from './field-validation'
import { luthierValidationMessagesEnUS } from './copy.validation.en-US'
import { luthierValidationMessagesPtBR } from './copy.validation.pt-BR'

function formatMessage(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

describe('field validation: Linux and Windows paths', () => {
  it('accepts valid Linux and Windows absolute paths', () => {
    expect(validateLinuxPath('/home/rafael/game', 'pt-BR')).toEqual({})
    expect(validateWindowsPath('C:\\Games\\Game\\game.exe', 'en-US')).toEqual({})
  })

  it('returns localized Windows-path error and Z: hint when Linux path is provided', () => {
    const input = '/home/rafael/game/game.exe'

    const ptResult = validateWindowsPath(input, 'pt-BR')
    expect(ptResult.error).toBe(
      luthierValidationMessagesPtBR.luthier_validation_windows_path_expected
    )
    expect(ptResult.hint).toBe(
      formatMessage(luthierValidationMessagesPtBR.luthier_validation_suggestion, {
        value: 'Z:\\home\\rafael\\game\\game.exe',
      })
    )

    const enResult = validateWindowsPath(input, 'en-US')
    expect(enResult.error).toBe(
      luthierValidationMessagesEnUS.luthier_validation_windows_path_expected
    )
    expect(enResult.hint).toBe(
      formatMessage(luthierValidationMessagesEnUS.luthier_validation_suggestion, {
        value: 'Z:\\home\\rafael\\game\\game.exe',
      })
    )
  })

  it('returns Windows-path format error for malformed path', () => {
    expect(validateWindowsPath('Games\\game.exe', 'en-US').error).toBe(
      luthierValidationMessagesEnUS.luthier_validation_windows_path_invalid_format
    )
  })

  it('returns backslash hint when Windows path uses forward slashes', () => {
    const result = validateWindowsPath('C:/Games/Game/game.exe', 'en-US')
    expect(result.error).toBeUndefined()
    expect(result.hint).toBe(
      formatMessage(luthierValidationMessagesEnUS.luthier_validation_windows_path_backslash_hint, {
        path: 'C:\\Games\\Game\\game.exe',
      })
    )
  })

  it('returns localized Linux-path expected error and host hint for Windows input', () => {
    const windowsInput = 'C:\\Games\\Game'

    const ptResult = validateLinuxPath(windowsInput, 'pt-BR')
    expect(ptResult.error).toBe(
      luthierValidationMessagesPtBR.luthier_validation_linux_path_expected
    )
    expect(ptResult.hint).toBe(
      luthierValidationMessagesPtBR.luthier_validation_linux_path_host_hint
    )

    const enResult = validateLinuxPath(windowsInput, 'en-US')
    expect(enResult.error).toBe(
      luthierValidationMessagesEnUS.luthier_validation_linux_path_expected
    )
    expect(enResult.hint).toBe(
      luthierValidationMessagesEnUS.luthier_validation_linux_path_host_hint
    )
  })

  it('returns Linux absolute-path error for relative input', () => {
    expect(validateLinuxPath('games/game.exe', 'en-US').error).toBe(
      luthierValidationMessagesEnUS.luthier_validation_linux_path_absolute
    )
  })
})

describe('field validation: positive numbers (resolution and FPS)', () => {
  const resolutionOptions = {
    min: 640,
    max: 7680,
    labelPt: 'Largura',
    labelEn: 'Width',
  }

  const fpsOptions = {
    min: 30,
    max: 360,
    labelPt: 'FPS',
    labelEn: 'FPS',
  }

  it('accepts valid resolution and FPS values', () => {
    expect(validatePositiveIntegerString('1920', 'pt-BR', resolutionOptions)).toEqual({})
    expect(validatePositiveIntegerString('120', 'en-US', fpsOptions)).toEqual({})
  })

  it('rejects non-digit values with localized messages', () => {
    expect(validatePositiveIntegerString('60fps', 'pt-BR', fpsOptions).error).toBe(
      formatMessage(luthierValidationMessagesPtBR.luthier_validation_positive_integer_digits, {
        label: 'FPS',
      })
    )

    expect(validatePositiveIntegerString('1920p', 'en-US', resolutionOptions).error).toBe(
      formatMessage(luthierValidationMessagesEnUS.luthier_validation_positive_integer_digits, {
        label: 'Width',
      })
    )
  })

  it('rejects out-of-range values with localized messages', () => {
    expect(validatePositiveIntegerString('500', 'pt-BR', resolutionOptions).error).toBe(
      formatMessage(luthierValidationMessagesPtBR.luthier_validation_positive_integer_range, {
        label: 'Largura',
        min: 640,
        max: 7680,
      })
    )

    expect(validatePositiveIntegerString('500', 'en-US', fpsOptions).error).toBe(
      formatMessage(luthierValidationMessagesEnUS.luthier_validation_positive_integer_range, {
        label: 'FPS',
        min: 30,
        max: 360,
      })
    )
  })
})

describe('field validation: names', () => {
  const labelPt = 'Nome da pasta'
  const labelEn = 'Folder name'

  it('accepts valid names', () => {
    expect(validateWindowsFriendlyName('Meu Jogo', 'pt-BR', labelPt, labelEn)).toEqual({})
    expect(validateWindowsFriendlyName('Game Build 01', 'en-US', labelPt, labelEn)).toEqual({})
  })

  it('requires name and returns localized messages with labels', () => {
    expect(validateWindowsFriendlyName('   ', 'pt-BR', labelPt, labelEn).error).toBe(
      formatMessage(luthierValidationMessagesPtBR.luthier_validation_windows_name_required, {
        label: labelPt,
      })
    )

    expect(validateWindowsFriendlyName('', 'en-US', labelPt, labelEn).error).toBe(
      formatMessage(luthierValidationMessagesEnUS.luthier_validation_windows_name_required, {
        label: labelEn,
      })
    )
  })

  it('rejects invalid characters in names with localized messages', () => {
    expect(validateWindowsFriendlyName('Jogo:Demo', 'pt-BR', labelPt, labelEn).error).toBe(
      formatMessage(luthierValidationMessagesPtBR.luthier_validation_windows_name_invalid_chars, {
        label: labelPt,
      })
    )

    expect(validateWindowsFriendlyName('Build*1', 'en-US', labelPt, labelEn).error).toBe(
      formatMessage(luthierValidationMessagesEnUS.luthier_validation_windows_name_invalid_chars, {
        label: labelEn,
      })
    )
  })

  it('rejects trailing dot with localized messages', () => {
    expect(validateWindowsFriendlyName('Jogo.', 'pt-BR', labelPt, labelEn).error).toBe(
      formatMessage(luthierValidationMessagesPtBR.luthier_validation_windows_name_trailing, {
        label: labelPt,
      })
    )

    expect(validateWindowsFriendlyName('Game.', 'en-US', labelPt, labelEn).error).toBe(
      formatMessage(luthierValidationMessagesEnUS.luthier_validation_windows_name_trailing, {
        label: labelEn,
      })
    )
  })
})
