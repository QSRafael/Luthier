import { JSX, Show } from 'solid-js'
import { IconChevronDown } from '@tabler/icons-solidjs'

import { Switch, SwitchControl, SwitchInput, SwitchThumb } from '../../components/ui/switch'

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
