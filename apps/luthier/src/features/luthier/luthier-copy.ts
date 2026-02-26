import type { Locale } from '../../i18n'
import { luthierMessagesEnUS } from './luthier-copy.en-US'
import { luthierMessagesPtBR } from './luthier-copy.pt-BR'
import { luthierValidationMessagesEnUS } from './luthier-copy.validation.en-US'
import { luthierValidationMessagesPtBR } from './luthier-copy.validation.pt-BR'

export const luthierMessages = {
  'pt-BR': {
    ...luthierMessagesPtBR,
    ...luthierValidationMessagesPtBR
  },
  'en-US': {
    ...luthierMessagesEnUS,
    ...luthierValidationMessagesEnUS
  },
} as const

export type LuthierCopyKey = keyof typeof luthierMessages['pt-BR']

export function luthierTranslate(locale: Locale, key: LuthierCopyKey): string {
  return luthierMessages[locale][key] ?? luthierMessages['en-US'][key] ?? key
}

export function luthierFormat(
  locale: Locale,
  key: LuthierCopyKey,
  params: Record<string, string | number>
): string {
  const template = luthierTranslate(locale, key)
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}
