import type { JSX } from 'solid-js'
import {
  IconBook,
  IconFileImport,
  IconFileSearch,
  IconPlus,
  IconWorldSearch,
} from '@tabler/icons-solidjs'

import type { LuthierCopyKey } from '../copy'

export type StartActionId =
  | 'create_new'
  | 'import_payload'
  | 'extract_payload'
  | 'search_online'
  | 'help'

type StartActionIcon = (props: { class?: string }) => JSX.Element

export type StartAction = {
  id: StartActionId
  titleKey: LuthierCopyKey
  descriptionKey: LuthierCopyKey
  icon: StartActionIcon
  iconForegroundClass: string
  iconBackgroundClass: string
  ringClass: string
  disabled?: boolean
}

export const START_ACTIONS: readonly StartAction[] = [
  {
    id: 'create_new',
    titleKey: 'luthier_home_create_new_title',
    descriptionKey: 'luthier_home_create_new_description',
    icon: IconPlus,
    iconForegroundClass: 'text-emerald-700 dark:text-emerald-300',
    iconBackgroundClass: 'bg-emerald-100/70 dark:bg-emerald-950/45',
    ringClass: 'ring-emerald-700/25 dark:ring-emerald-400/35',
  },
  {
    id: 'import_payload',
    titleKey: 'luthier_home_import_payload_title',
    descriptionKey: 'luthier_home_import_payload_description',
    icon: IconFileImport,
    iconForegroundClass: 'text-blue-700 dark:text-blue-300',
    iconBackgroundClass: 'bg-blue-100/70 dark:bg-blue-950/45',
    ringClass: 'ring-blue-700/25 dark:ring-blue-400/35',
  },
  {
    id: 'extract_payload',
    titleKey: 'luthier_home_extract_payload_title',
    descriptionKey: 'luthier_home_extract_payload_description',
    icon: IconFileSearch,
    iconForegroundClass: 'text-orange-700 dark:text-orange-300',
    iconBackgroundClass: 'bg-orange-100/70 dark:bg-orange-950/45',
    ringClass: 'ring-orange-700/25 dark:ring-orange-400/35',
  },
  {
    id: 'search_online',
    titleKey: 'luthier_home_search_online_title',
    descriptionKey: 'luthier_home_search_online_description',
    icon: IconWorldSearch,
    iconForegroundClass: 'text-violet-700 dark:text-violet-300',
    iconBackgroundClass: 'bg-violet-100/70 dark:bg-violet-950/45',
    ringClass: 'ring-violet-700/25 dark:ring-violet-400/35',
    disabled: true,
  },
  {
    id: 'help',
    titleKey: 'luthier_home_help_title',
    descriptionKey: 'luthier_home_help_description',
    icon: IconBook,
    iconForegroundClass: 'text-zinc-700 dark:text-zinc-300',
    iconBackgroundClass: 'bg-zinc-100/70 dark:bg-zinc-900/55',
    ringClass: 'ring-zinc-600/20 dark:ring-zinc-400/30',
    disabled: true,
  },
]
