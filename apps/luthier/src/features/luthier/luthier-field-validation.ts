import type { Locale } from '../../i18n'
import { luthierFormat, luthierTranslate } from './luthier-copy'

export type ValidationResult = {
  error?: string
  hint?: string
}

type NumberRangeOptions = {
  min: number
  max: number
  labelPt: string
  labelEn: string
}

function isPt(locale: Locale) {
  return locale === 'pt-BR'
}

function ct(locale: Locale, key: Parameters<typeof luthierTranslate>[1]) {
  return luthierTranslate(locale, key)
}

function ctf(
  locale: Locale,
  key: Parameters<typeof luthierFormat>[1],
  params: Record<string, string | number>
) {
  return luthierFormat(locale, key, params)
}

function hasControlChars(raw: string) {
  return /[\u0000-\u001f]/.test(raw)
}

export function detectPathStyle(raw: string): 'empty' | 'linux' | 'windows' | 'relative' | 'unknown' {
  const value = raw.trim()
  if (!value) return 'empty'
  if (value.startsWith('/')) return 'linux'
  if (/^[A-Za-z]:[\\/]/.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value)) return 'windows'
  if (value.startsWith('./') || value.startsWith('../') || !/[\\/]/.test(value)) return 'relative'
  if (value.includes('/')) return 'relative'
  return 'unknown'
}

function normalizeRelativeSlashes(raw: string) {
  return raw.replace(/\\/g, '/')
}

function looksLikeLinuxPath(raw: string) {
  return raw.trim().startsWith('/')
}

function looksLikeWindowsPath(raw: string) {
  const value = raw.trim()
  return /^[A-Za-z]:[\\/]/.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value)
}

function linuxToWineZPathSuggestion(raw: string) {
  const value = raw.trim().replace(/\\/g, '/')
  if (!value.startsWith('/')) return null
  return `Z:${value.replace(/\//g, '\\')}`
}

export function sanitizeDigits(raw: string): string {
  return raw.replace(/[^\d]/g, '')
}

export function parsePositiveIntStrict(raw: string): number | null {
  const value = raw.trim()
  if (!/^\d+$/.test(value)) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export function validatePositiveIntegerString(
  raw: string,
  locale: Locale,
  options: NumberRangeOptions
): ValidationResult {
  const value = raw.trim()
  if (!value) return {}
  if (!/^\d+$/.test(value)) {
    return {
      error: ctf(locale, 'creator_validation_positive_integer_digits', {
        label: isPt(locale) ? options.labelPt : options.labelEn
      })
    }
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < options.min || parsed > options.max) {
    return {
      error: ctf(locale, 'creator_validation_positive_integer_range', {
        label: isPt(locale) ? options.labelPt : options.labelEn,
        min: options.min,
        max: options.max
      })
    }
  }
  return {}
}

export function validateRelativeGamePath(
  raw: string,
  locale: Locale,
  options: {
    kind: 'file' | 'folder'
    allowDot?: boolean
    requireDotPrefix?: boolean
  }
): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return {
      error: ct(
        locale,
        options.kind === 'file'
          ? 'creator_validation_relative_path_required_file'
          : 'creator_validation_relative_path_required_folder'
      )
    }
  }

  if (looksLikeLinuxPath(value) || looksLikeWindowsPath(value)) {
    return {
      error: ct(locale, 'creator_validation_relative_path_no_absolute')
    }
  }

  const normalized = normalizeRelativeSlashes(value)
  if (value.includes('\\')) {
    return {
      error: ct(locale, 'creator_validation_relative_path_use_forward_slashes'),
      hint: normalized
    }
  }
  if (options.requireDotPrefix && !normalized.startsWith('./')) {
    return {
      error: ct(locale, 'creator_validation_relative_path_dot_prefix')
    }
  }

  if (normalized.includes('//')) {
    return {
      error: ct(locale, 'creator_validation_relative_path_double_slash')
    }
  }

  if (hasControlChars(normalized)) {
    return {
      error: ct(locale, 'creator_validation_path_invalid_chars')
    }
  }

  const stripped = normalized.replace(/^\.\//, '')
  if (stripped === '.') {
    if (options.allowDot) return {}
    return {
      error: ct(locale, 'creator_validation_relative_path_specific_target')
    }
  }

  const segments = stripped.split('/').filter(Boolean)
  if (segments.length === 0 && !options.allowDot) {
    return {
      error: ct(locale, 'creator_validation_relative_path_empty')
    }
  }

  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      return {
        error: ct(locale, 'creator_validation_relative_path_no_dotdot')
      }
    }
    if (/[<>:"|?*\u0000]/.test(segment)) {
      return {
        error: ct(locale, 'creator_validation_path_invalid_chars')
      }
    }
  }

  if (options.kind === 'file' && stripped.endsWith('/')) {
    return {
      error: ct(locale, 'creator_validation_relative_path_file_expected')
    }
  }

  return {}
}

export function validateWindowsPath(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: ct(locale, 'creator_validation_windows_path_required') }
  }
  if (hasControlChars(value)) {
    return { error: ct(locale, 'creator_validation_path_invalid_chars') }
  }
  if (looksLikeLinuxPath(value)) {
    const suggestion = linuxToWineZPathSuggestion(value)
    return {
      error: ct(locale, 'creator_validation_windows_path_expected'),
      hint: suggestion
        ? ctf(locale, 'creator_validation_suggestion', { value: suggestion })
        : undefined
    }
  }

  const normalized = value.replace(/\//g, '\\')
  if (!/^[A-Za-z]:\\/.test(normalized) && !/^\\\\[^\\]+\\[^\\]+/.test(normalized)) {
    return {
      error: ct(locale, 'creator_validation_windows_path_invalid_format')
    }
  }

  const withoutRoot = normalized.replace(/^[A-Za-z]:\\/, '').replace(/^\\\\[^\\]+\\[^\\]+\\?/, '')
  if (/[<>:"|?*]/.test(withoutRoot)) {
    return {
      error: ct(locale, 'creator_validation_windows_path_invalid_chars')
    }
  }

  if (normalized !== value) {
    return {
      hint: ctf(locale, 'creator_validation_windows_path_backslash_hint', { path: normalized })
    }
  }

  return {}
}

export function validateLinuxPath(raw: string, locale: Locale, required = true): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return required ? { error: ct(locale, 'creator_validation_linux_path_required') } : {}
  }
  if (hasControlChars(value)) {
    return { error: ct(locale, 'creator_validation_path_invalid_chars') }
  }
  if (looksLikeWindowsPath(value)) {
    return {
      error: ct(locale, 'creator_validation_linux_path_expected'),
      hint: ct(locale, 'creator_validation_linux_path_host_hint')
    }
  }
  if (!value.startsWith('/')) {
    return {
      error: ct(locale, 'creator_validation_linux_path_absolute')
    }
  }
  return {}
}

export function validateRegistryPath(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: ct(locale, 'creator_validation_registry_path_required') }
  }
  if (looksLikeLinuxPath(value) || looksLikeWindowsPath(value)) {
    return {
      error: ct(locale, 'creator_validation_registry_path_expected')
    }
  }
  if (hasControlChars(value)) {
    return { error: ct(locale, 'creator_validation_registry_path_invalid_chars') }
  }
  const normalized = value.replace(/\//g, '\\')
  const hiveRegex =
    /^(HKCU|HKLM|HKCR|HKU|HKCC|HKEY_CURRENT_USER|HKEY_LOCAL_MACHINE|HKEY_CLASSES_ROOT|HKEY_USERS|HKEY_CURRENT_CONFIG)(\\|$)/i
  if (!hiveRegex.test(normalized)) {
    return {
      error: ct(locale, 'creator_validation_registry_hive_invalid')
    }
  }
  return normalized !== value
    ? { hint: ctf(locale, 'creator_validation_registry_backslash_hint', { path: normalized }) }
    : {}
}

export function validateRegistryValueType(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) return {}
  const normalized = value.toUpperCase()
  const supported = new Set([
    'REG_SZ',
    'REG_EXPAND_SZ',
    'REG_MULTI_SZ',
    'REG_DWORD',
    'REG_QWORD',
    'REG_BINARY',
    'REG_NONE'
  ])
  if (!supported.has(normalized)) {
    return {
      error: ct(locale, 'creator_validation_registry_type_invalid')
    }
  }
  return normalized !== value
    ? {
        hint: ctf(locale, 'creator_validation_suggestion', { value: normalized })
      }
    : {}
}

export function validateEnvVarName(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: ct(locale, 'creator_validation_env_var_name_required') }
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    return {
      error: ct(locale, 'creator_validation_env_var_name_invalid')
    }
  }
  return {}
}

export function validateDllName(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: ct(locale, 'creator_validation_dll_name_required') }
  }
  if (/[\\/]/.test(value)) {
    return { error: ct(locale, 'creator_validation_dll_name_no_path') }
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
    return {
      error: ct(locale, 'creator_validation_dll_name_invalid')
    }
  }
  return {}
}

export function validateWrapperExecutable(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: ct(locale, 'creator_validation_wrapper_executable_required') }
  }
  if (looksLikeWindowsPath(value)) {
    return {
      error: ct(locale, 'creator_validation_wrapper_executable_windows_path')
    }
  }
  if (/\s/.test(value) && !value.startsWith('/')) {
    return {
      error: ct(locale, 'creator_validation_wrapper_executable_args_separate')
    }
  }
  return {}
}

export function validateCommandToken(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) return {}
  if (looksLikeWindowsPath(value)) {
    return {
      error: ct(locale, 'creator_validation_command_linux_expected')
    }
  }
  return {}
}

export function validateWindowsFriendlyName(raw: string, locale: Locale, labelPt: string, labelEn: string): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: ctf(locale, 'creator_validation_windows_name_required', { label: isPt(locale) ? labelPt : labelEn }) }
  }
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(value)) {
    return { error: ctf(locale, 'creator_validation_windows_name_invalid_chars', { label: isPt(locale) ? labelPt : labelEn }) }
  }
  if (/[. ]$/.test(value)) {
    return { error: ctf(locale, 'creator_validation_windows_name_trailing', { label: isPt(locale) ? labelPt : labelEn }) }
  }
  return {}
}

export function validateWindowsDriveSerial(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) return {}
  if (!/^(0x)?[A-Fa-f0-9]{1,16}$/.test(value)) {
    return {
      error: ct(locale, 'creator_validation_drive_serial_invalid')
    }
  }
  return {}
}

export function validateFileOrFolderName(raw: string, locale: Locale, kind: 'file' | 'folder'): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return {
      error: ct(
        locale,
        kind === 'file'
          ? 'creator_validation_file_name_required'
          : 'creator_validation_folder_name_required'
      )
    }
  }
  if (value === '.' || value === '..') {
    return { error: ct(locale, 'creator_validation_name_invalid') }
  }
  if (/[\\/]/.test(value)) {
    return { error: ct(locale, 'creator_validation_name_no_path') }
  }
  if (/[<>:"|?*\u0000-\u001f]/.test(value)) {
    return { error: ct(locale, 'creator_validation_name_invalid_chars') }
  }
  return {}
}
