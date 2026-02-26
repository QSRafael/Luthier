import type { Locale } from '../../i18n'

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

function t(locale: Locale, pt: string, en: string) {
  return isPt(locale) ? pt : en
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
      error: t(
        locale,
        `${options.labelPt} deve conter apenas números positivos.`,
        `${options.labelEn} must contain only positive numbers.`
      )
    }
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < options.min || parsed > options.max) {
    return {
      error: t(
        locale,
        `${options.labelPt} deve ficar entre ${options.min} e ${options.max}.`,
        `${options.labelEn} must be between ${options.min} and ${options.max}.`
      )
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
      error: t(
        locale,
        `Informe um ${options.kind === 'file' ? 'arquivo' : 'caminho'} relativo.`,
        `Provide a relative ${options.kind === 'file' ? 'file' : 'path'}.`
      )
    }
  }

  if (looksLikeLinuxPath(value) || looksLikeWindowsPath(value)) {
    return {
      error: t(
        locale,
        `Use um caminho relativo dentro da pasta do jogo, não um caminho absoluto.`,
        `Use a relative path inside the game folder, not an absolute path.`
      )
    }
  }

  const normalized = normalizeRelativeSlashes(value)
  if (value.includes('\\')) {
    return {
      error: t(
        locale,
        'Use "/" nesse caminho relativo (não use "\\").',
        'Use "/" in this relative path (do not use "\\").'
      ),
      hint: normalized
    }
  }
  if (options.requireDotPrefix && !normalized.startsWith('./')) {
    return {
      error: t(locale, 'Use o formato relativo começando com "./".', 'Use the relative format starting with "./".')
    }
  }

  if (normalized.includes('//')) {
    return {
      error: t(locale, 'O caminho relativo contém "//".', 'Relative path contains "//".')
    }
  }

  if (hasControlChars(normalized)) {
    return {
      error: t(locale, 'O caminho contém caracteres inválidos.', 'Path contains invalid characters.')
    }
  }

  const stripped = normalized.replace(/^\.\//, '')
  if (stripped === '.') {
    if (options.allowDot) return {}
    return {
      error: t(locale, 'Use uma subpasta ou arquivo específico.', 'Use a specific subfolder or file.')
    }
  }

  const segments = stripped.split('/').filter(Boolean)
  if (segments.length === 0 && !options.allowDot) {
    return {
      error: t(locale, 'O caminho relativo está vazio.', 'Relative path is empty.')
    }
  }

  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      return {
        error: t(
          locale,
          'Não use "." ou ".." nesse campo; selecione algo dentro da pasta do jogo.',
          'Do not use "." or ".." in this field; select something inside the game folder.'
        )
      }
    }
    if (/[<>:"|?*\u0000]/.test(segment)) {
      return {
        error: t(locale, 'O caminho contém caracteres inválidos.', 'Path contains invalid characters.')
      }
    }
  }

  if (options.kind === 'file' && stripped.endsWith('/')) {
    return {
      error: t(locale, 'Esse campo espera um arquivo, não uma pasta.', 'This field expects a file, not a folder.')
    }
  }

  return {}
}

export function validateWindowsPath(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: t(locale, 'Informe um caminho Windows.', 'Provide a Windows path.') }
  }
  if (hasControlChars(value)) {
    return { error: t(locale, 'O caminho contém caracteres inválidos.', 'Path contains invalid characters.') }
  }
  if (looksLikeLinuxPath(value)) {
    const suggestion = linuxToWineZPathSuggestion(value)
    return {
      error: t(locale, 'Esse campo espera um caminho Windows (ex.: C:\\... ou Z:\\...).', 'This field expects a Windows path (e.g. C:\\... or Z:\\...).'),
      hint: suggestion
        ? t(locale, `Sugestão: ${suggestion}`, `Suggestion: ${suggestion}`)
        : undefined
    }
  }

  const normalized = value.replace(/\//g, '\\')
  if (!/^[A-Za-z]:\\/.test(normalized) && !/^\\\\[^\\]+\\[^\\]+/.test(normalized)) {
    return {
      error: t(
        locale,
        'Caminho Windows inválido. Use uma letra de drive (ex.: C:\\...) ou UNC (\\\\servidor\\pasta).',
        'Invalid Windows path. Use a drive letter path (e.g. C:\\...) or UNC (\\\\server\\share).'
      )
    }
  }

  const withoutRoot = normalized.replace(/^[A-Za-z]:\\/, '').replace(/^\\\\[^\\]+\\[^\\]+\\?/, '')
  if (/[<>:"|?*]/.test(withoutRoot)) {
    return {
      error: t(locale, 'O caminho Windows contém caracteres inválidos.', 'Windows path contains invalid characters.')
    }
  }

  if (normalized !== value) {
    return {
      hint: t(locale, `Sugestão: use barras invertidas: ${normalized}`, `Suggestion: use backslashes: ${normalized}`)
    }
  }

  return {}
}

export function validateLinuxPath(raw: string, locale: Locale, required = true): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return required ? { error: t(locale, 'Informe um caminho Linux.', 'Provide a Linux path.') } : {}
  }
  if (hasControlChars(value)) {
    return { error: t(locale, 'O caminho contém caracteres inválidos.', 'Path contains invalid characters.') }
  }
  if (looksLikeWindowsPath(value)) {
    return {
      error: t(locale, 'Esse campo espera um caminho Linux (ex.: /home/... ).', 'This field expects a Linux path (e.g. /home/... ).'),
      hint: t(locale, 'Use um path do host Linux, não um path Windows do Wine.', 'Use a Linux host path, not a Wine Windows path.')
    }
  }
  if (!value.startsWith('/')) {
    return {
      error: t(locale, 'Use um caminho Linux absoluto começando com "/".', 'Use an absolute Linux path starting with "/".')
    }
  }
  return {}
}

export function validateRegistryPath(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: t(locale, 'Informe o path do registro.', 'Provide the registry path.') }
  }
  if (looksLikeLinuxPath(value) || looksLikeWindowsPath(value)) {
    return {
      error: t(locale, 'Esse campo espera um path de registro (ex.: HKCU\\Software\\...).', 'This field expects a registry path (e.g. HKCU\\Software\\...).')
    }
  }
  if (hasControlChars(value)) {
    return { error: t(locale, 'O path do registro contém caracteres inválidos.', 'Registry path contains invalid characters.') }
  }
  const normalized = value.replace(/\//g, '\\')
  const hiveRegex =
    /^(HKCU|HKLM|HKCR|HKU|HKCC|HKEY_CURRENT_USER|HKEY_LOCAL_MACHINE|HKEY_CLASSES_ROOT|HKEY_USERS|HKEY_CURRENT_CONFIG)(\\|$)/i
  if (!hiveRegex.test(normalized)) {
    return {
      error: t(locale, 'Use um hive válido (HKCU, HKLM, HKCR, HKU, HKCC...).', 'Use a valid hive (HKCU, HKLM, HKCR, HKU, HKCC...).')
    }
  }
  return normalized !== value
    ? { hint: t(locale, `Sugestão: use "\\\\": ${normalized}`, `Suggestion: use "\\\\": ${normalized}`) }
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
      error: t(locale, 'Tipo de registro inválido. Ex.: REG_SZ, REG_DWORD, REG_BINARY.', 'Invalid registry type. E.g. REG_SZ, REG_DWORD, REG_BINARY.')
    }
  }
  return normalized !== value
    ? {
        hint: t(locale, `Sugestão: ${normalized}`, `Suggestion: ${normalized}`)
      }
    : {}
}

export function validateEnvVarName(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: t(locale, 'Informe o nome da variável.', 'Provide the variable name.') }
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    return {
      error: t(locale, 'Nome de variável inválido. Use letras, números e underscore, sem espaços.', 'Invalid variable name. Use letters, numbers and underscore, no spaces.')
    }
  }
  return {}
}

export function validateDllName(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: t(locale, 'Informe o nome da DLL.', 'Provide the DLL name.') }
  }
  if (/[\\/]/.test(value)) {
    return { error: t(locale, 'Informe apenas o nome da DLL, sem path.', 'Provide only the DLL name, without a path.') }
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
    return {
      error: t(locale, 'Nome de DLL inválido.', 'Invalid DLL name.')
    }
  }
  return {}
}

export function validateWrapperExecutable(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: t(locale, 'Informe o executável/comando do wrapper.', 'Provide the wrapper executable/command.') }
  }
  if (looksLikeWindowsPath(value)) {
    return {
      error: t(locale, 'Wrapper deve ser comando/path Linux, não path Windows.', 'Wrapper must be a Linux command/path, not a Windows path.')
    }
  }
  if (/\s/.test(value) && !value.startsWith('/')) {
    return {
      error: t(locale, 'Informe só o executável neste campo. Use o campo de argumentos para os parâmetros.', 'Put only the executable in this field. Use the arguments field for parameters.')
    }
  }
  return {}
}

export function validateCommandToken(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) return {}
  if (looksLikeWindowsPath(value)) {
    return {
      error: t(locale, 'Esse campo espera comando/path Linux.', 'This field expects a Linux command/path.')
    }
  }
  return {}
}

export function validateWindowsFriendlyName(raw: string, locale: Locale, labelPt: string, labelEn: string): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: t(locale, `Informe ${labelPt}.`, `Provide ${labelEn}.`) }
  }
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(value)) {
    return { error: t(locale, `${labelPt} contém caracteres inválidos.`, `${labelEn} contains invalid characters.`) }
  }
  if (/[. ]$/.test(value)) {
    return { error: t(locale, `${labelPt} não deve terminar com espaço ou ponto.`, `${labelEn} must not end with a space or dot.`) }
  }
  return {}
}

export function validateWindowsDriveSerial(raw: string, locale: Locale): ValidationResult {
  const value = raw.trim()
  if (!value) return {}
  if (!/^(0x)?[A-Fa-f0-9]{1,16}$/.test(value)) {
    return {
      error: t(locale, 'Serial inválido. Use hexadecimal (ex.: 1A2B3C4D).', 'Invalid serial. Use hexadecimal (e.g. 1A2B3C4D).')
    }
  }
  return {}
}

export function validateFileOrFolderName(raw: string, locale: Locale, kind: 'file' | 'folder'): ValidationResult {
  const value = raw.trim()
  if (!value) {
    return { error: t(locale, `Informe um ${kind === 'file' ? 'arquivo' : 'nome de pasta'}.`, `Provide a ${kind === 'file' ? 'file' : 'folder name'}.`) }
  }
  if (value === '.' || value === '..') {
    return { error: t(locale, 'Nome inválido.', 'Invalid name.') }
  }
  if (/[\\/]/.test(value)) {
    return { error: t(locale, 'Informe apenas o nome, sem path.', 'Provide only the name, without a path.') }
  }
  if (/[<>:"|?*\u0000-\u001f]/.test(value)) {
    return { error: t(locale, 'Nome contém caracteres inválidos.', 'Name contains invalid characters.') }
  }
  return {}
}
