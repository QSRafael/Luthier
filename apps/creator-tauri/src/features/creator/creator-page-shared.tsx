import { JSX, Show } from 'solid-js'
import { IconChevronDown } from '@tabler/icons-solidjs'

import { Switch, SwitchControl, SwitchInput, SwitchThumb } from '../../components/ui/switch'
import { CreatorTab, FeatureState } from '../../models/config'
import type { CreatorController } from './useCreatorController'
import type { CreatorCopyKey } from './creator-copy'

export type ImportRegistryFileOutput = {
  entries: Array<{ path: string; name: string; value_type: string; value: string }>
  warnings: string[]
}

export type ListChildDirectoriesOutput = {
  path: string
  directories: string[]
}

export type CreatorPageSectionView = CreatorController & Record<string, any>

export type CreatorPageSectionProps = {
  view: CreatorPageSectionView
}

export function tabLabel(tab: CreatorTab, controller: CreatorController) {
  const ct = controller.ct as (key: CreatorCopyKey) => string
  if (tab === 'game') return ct('creator_label_game')
  if (tab === 'gameFiles') return ct('creator_label_game_files_and_launch')
  if (tab === 'runtime') return ct('creator_label_runtime')
  if (tab === 'performance') return ct('creator_enhancements')
  if (tab === 'prefix') return ct('creator_dependencies')
  if (tab === 'winecfg') return 'Winecfg'
  if (tab === 'wrappers') return ct('creator_launch_and_environment')
  if (tab === 'scripts') return ct('creator_label_scripts')
  return ct('creator_review_and_generate')
}

type AccordionSectionProps = {
  title: string
  description?: string
  open: boolean
  onToggle: () => void
  children: JSX.Element
}

export function AccordionSection(props: AccordionSectionProps) {
  return (
    <section class="rounded-xl border border-border/70 bg-card/80">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={props.onToggle}
      >
        <div class="min-w-0">
          <p class="text-sm font-semibold">{props.title}</p>
          <Show when={props.description}>
            <p class="text-xs text-muted-foreground">{props.description}</p>
          </Show>
        </div>
        <IconChevronDown
          class={
            'size-4 shrink-0 text-muted-foreground transition-transform ' +
            (props.open ? 'rotate-180' : '')
          }
        />
      </button>
      <Show when={props.open}>
        <div class="border-t border-border/60 px-4 py-3">{props.children}</div>
      </Show>
    </section>
  )
}

type SwitchChoiceCardProps = {
  title: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function SwitchChoiceCard(props: SwitchChoiceCardProps) {
  const toggle = () => props.onChange(!props.checked)

  return (
    <div
      role="button"
      tabIndex={0}
      class={
        'flex items-center justify-between gap-3 rounded-md border px-3 py-3 transition-colors ' +
        (props.checked
          ? 'border-primary/40 bg-accent/30'
          : 'border-border/60 bg-background/70 hover:border-border hover:bg-accent/20')
      }
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      }}
    >
      <div class="min-w-0">
        <p class="text-sm font-medium">{props.title}</p>
        <Show when={props.description}>
          <p class="text-xs text-muted-foreground">{props.description}</p>
        </Show>
      </div>
      <Switch checked={props.checked} onChange={props.onChange} onClick={(e) => e.stopPropagation()}>
        <SwitchInput />
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
      </Switch>
    </div>
  )
}

export function isLikelyAbsolutePath(path: string) {
  const trimmed = path.trim()
  return trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)
}

export function isTauriLocalRuntime() {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return typeof w.__TAURI_IPC__ !== 'undefined' || typeof w.__TAURI__ !== 'undefined'
}

export function posixDirname(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalized || normalized === '/') return '/'
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return '/'
  return normalized.slice(0, idx)
}

export function buildAncestorPathsFromExe(exePath: string): string[] {
  if (!isLikelyAbsolutePath(exePath)) return []
  const dir = posixDirname(exePath)
  const normalized = dir.replace(/\\/g, '/')
  if (!normalized.startsWith('/')) return [dir]
  const parts = normalized.split('/').filter(Boolean)
  const out: string[] = []
  let current = ''
  for (const part of parts) {
    current += `/${part}`
    out.push(current)
  }
  return out
}

export function relativeInsideBase(base: string, target: string): string | null {
  const b = base.replace(/\\/g, '/').replace(/\/+$/, '')
  const t = target.replace(/\\/g, '/').replace(/\/+$/, '')
  if (t === b) return '.'
  if (!t.startsWith(`${b}/`)) return null
  return t.slice(b.length + 1) || '.'
}

export function basenamePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(idx + 1) : normalized
}

export function parseWxH(raw: string | null): { width: string; height: string } {
  if (!raw) return { width: '', height: '' }
  const [width, height] = raw.split('x')
  return { width: width ?? '', height: height ?? '' }
}

export function buildWxH(width: string, height: string): string | null {
  const w = width.trim()
  const h = height.trim()
  if (!w || !h) return null
  return `${w}x${h}`
}

export function featureStateEnabled(value: FeatureState): boolean {
  return value === 'MandatoryOn' || value === 'OptionalOn'
}

export function featureStateMandatory(value: FeatureState): boolean {
  return value === 'MandatoryOn' || value === 'MandatoryOff'
}

export function buildFeatureState(enabled: boolean, mandatory: boolean): FeatureState {
  if (enabled) return mandatory ? 'MandatoryOn' : 'OptionalOn'
  return mandatory ? 'MandatoryOff' : 'OptionalOff'
}
