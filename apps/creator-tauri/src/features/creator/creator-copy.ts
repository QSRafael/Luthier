import type { Locale } from '../../i18n'
import { creatorMessagesEnUS } from './creator-copy.en-US'
import { creatorMessagesPtBR } from './creator-copy.pt-BR'
import { creatorValidationMessagesEnUS } from './creator-copy.validation.en-US'
import { creatorValidationMessagesPtBR } from './creator-copy.validation.pt-BR'

export const creatorMessages = {
  'pt-BR': {
    ...creatorMessagesPtBR,
    ...creatorValidationMessagesPtBR
  },
  'en-US': {
    ...creatorMessagesEnUS,
    ...creatorValidationMessagesEnUS
  },
} as const

export type CreatorCopyKey = keyof typeof creatorMessages['pt-BR']

export function creatorTranslate(locale: Locale, key: CreatorCopyKey): string {
  return creatorMessages[locale][key] ?? creatorMessages['en-US'][key] ?? key
}

export function creatorFormat(
  locale: Locale,
  key: CreatorCopyKey,
  params: Record<string, string | number>
): string {
  const template = creatorTranslate(locale, key)
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}
