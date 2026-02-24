import type { Locale } from '../../i18n'
import { creatorMessagesEnUS } from './creator-copy.en-US'
import { creatorMessagesPtBR } from './creator-copy.pt-BR'

export const creatorMessages = {
  'pt-BR': creatorMessagesPtBR,
  'en-US': creatorMessagesEnUS,
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
