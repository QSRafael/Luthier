import { createMemo, JSX } from 'solid-js'

import type { FeatureState } from '../../models/config'
import { cn } from '../../lib/cva'
import { FieldShell, useFormControlsI18n } from './form-controls-core'
import { Switch, SwitchControl, SwitchInput, SwitchThumb } from '../ui/switch'
function decodeFeatureState(value: FeatureState) {
  if (value === 'MandatoryOn') return { enabled: true, mandatory: true }
  if (value === 'MandatoryOff') return { enabled: false, mandatory: true }
  if (value === 'OptionalOn') return { enabled: true, mandatory: false }
  return { enabled: false, mandatory: false }
}

function encodeFeatureState(enabled: boolean, mandatory: boolean): FeatureState {
  if (enabled && mandatory) return 'MandatoryOn'
  if (!enabled && mandatory) return 'MandatoryOff'
  if (enabled && !mandatory) return 'OptionalOn'
  return 'OptionalOff'
}

type FeatureStateFieldProps = {
  label: string
  help: string
  value: FeatureState
  onChange: (value: FeatureState) => void
  footer?: JSX.Element
}

type FeatureToggleCardProps = {
  title: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function FeatureToggleCard(props: FeatureToggleCardProps) {
  const toggle = () => {
    if (props.disabled) return
    props.onChange(!props.checked)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      class={cn(
        'flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors',
        props.disabled
          ? 'cursor-not-allowed border-border/50 bg-muted/20 opacity-65'
          : props.checked
            ? 'border-primary/40 bg-accent/30'
            : 'border-border/60 bg-background/70 hover:border-border hover:bg-accent/20'
      )}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      }}
    >
      <div class="min-w-0">
        <p class="text-sm font-medium leading-tight">{props.title}</p>
      </div>
      <Switch
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onChange}
        onClick={(e) => e.stopPropagation()}
        class="shrink-0"
      >
        <SwitchInput />
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
      </Switch>
    </div>
  )
}

export function FeatureStateField(props: FeatureStateFieldProps) {
  const i18n = useFormControlsI18n()
  const state = createMemo(() => decodeFeatureState(props.value))

  return (
    <FieldShell label={props.label} help={props.help} controlClass="grid gap-2 md:grid-cols-2" footer={props.footer}>
      <>
        <FeatureToggleCard
          title={i18n.enabled}
          checked={state().enabled}
          onChange={(enabled) => props.onChange(encodeFeatureState(enabled, state().mandatory))}
        />
        <FeatureToggleCard
          title={i18n.mandatory}
          checked={state().mandatory}
          onChange={(mandatory) => props.onChange(encodeFeatureState(state().enabled, mandatory))}
        />
      </>
    </FieldShell>
  )
}

type WinecfgFeatureStatePolicy = {
  state: FeatureState
  use_wine_default: boolean
}

type WinecfgFeatureStateFieldProps = {
  label: string
  help: string
  value: WinecfgFeatureStatePolicy
  onChange: (value: WinecfgFeatureStatePolicy) => void
  footer?: JSX.Element
}

export function WinecfgFeatureStateField(props: WinecfgFeatureStateFieldProps) {
  const i18n = useFormControlsI18n()
  const decoded = createMemo(() => decodeFeatureState(props.value.state))

  return (
    <FieldShell
      label={props.label}
      help={props.help}
      controlClass="grid gap-2 md:grid-cols-2 lg:grid-cols-3"
      footer={props.footer}
    >
      <>
        <FeatureToggleCard
          title={i18n.wineDefault}
          checked={props.value.use_wine_default}
          onChange={(use_wine_default) => props.onChange({ ...props.value, use_wine_default })}
        />
        <FeatureToggleCard
          title={i18n.enabled}
          checked={decoded().enabled}
          disabled={props.value.use_wine_default}
          onChange={(enabled) =>
            props.onChange({
              ...props.value,
              state: encodeFeatureState(enabled, decoded().mandatory)
            })
          }
        />
        <FeatureToggleCard
          title={i18n.mandatory}
          checked={decoded().mandatory}
          onChange={(mandatory) =>
            props.onChange({
              ...props.value,
              state: encodeFeatureState(decoded().enabled, mandatory)
            })
          }
        />
      </>
    </FieldShell>
  )
}
