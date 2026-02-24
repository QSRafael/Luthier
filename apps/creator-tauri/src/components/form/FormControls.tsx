import { createSignal, For, JSX, Show } from 'solid-js'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { Switch, SwitchControl, SwitchInput, SwitchThumb } from '../ui/switch'
import { Textarea } from '../ui/textarea'

export type SelectOption<T extends string> = {
  value: T
  label: string
}

type FieldShellProps = {
  label: string
  help: string
  children: JSX.Element
  hint?: string
  controlClass?: string
  compact?: boolean
}

export function FieldShell(props: FieldShellProps) {
  return (
    <div class="rounded-xl border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,360px)] md:items-start">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold leading-tight text-foreground">{props.label}</span>
            <span
              class="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-medium text-muted-foreground"
              title={props.help}
            >
              ?
            </span>
          </div>
          <p class="text-xs text-muted-foreground">{props.help}</p>
          <Show when={props.hint}>
            <p class="text-xs text-muted-foreground/85">{props.hint}</p>
          </Show>
        </div>
        <div class={props.controlClass ?? (props.compact ? 'max-w-[220px]' : 'w-full')}>{props.children}</div>
      </div>
    </div>
  )
}

type TextInputFieldProps = {
  label: string
  help: string
  value: string
  onInput: (value: string) => void
  placeholder?: string
  readonly?: boolean
}

export function TextInputField(props: TextInputFieldProps) {
  return (
    <FieldShell label={props.label} help={props.help} compact>
      <Input
        value={props.value}
        readOnly={props.readonly}
        placeholder={props.placeholder}
        class={props.readonly ? 'bg-muted/50 text-muted-foreground' : ''}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </FieldShell>
  )
}

type TextAreaFieldProps = {
  label: string
  help: string
  value: string
  onInput: (value: string) => void
  placeholder?: string
  rows?: number
}

export function TextAreaField(props: TextAreaFieldProps) {
  return (
    <FieldShell label={props.label} help={props.help} controlClass="w-full">
      <Textarea
        rows={props.rows ?? 6}
        value={props.value}
        placeholder={props.placeholder}
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </FieldShell>
  )
}

type SelectFieldProps<T extends string> = {
  label: string
  help: string
  value: T
  options: Array<SelectOption<T>>
  onChange: (value: T) => void
}

export function SelectField<T extends string>(props: SelectFieldProps<T>) {
  return (
    <FieldShell label={props.label} help={props.help} compact>
      <Select value={props.value} onInput={(e) => props.onChange(e.currentTarget.value as T)}>
        <For each={props.options}>{(option) => <option value={option.value}>{option.label}</option>}</For>
      </Select>
    </FieldShell>
  )
}

type ToggleFieldProps = {
  label: string
  help: string
  checked: boolean
  onChange: (checked: boolean) => void
  yesLabel?: string
  noLabel?: string
}

export function ToggleField(props: ToggleFieldProps) {
  return (
    <FieldShell label={props.label} help={props.help} compact>
      <div class="flex items-center justify-end gap-3">
        <span class="text-xs font-medium text-muted-foreground">
          {props.checked ? props.yesLabel ?? 'Ativado' : props.noLabel ?? 'Desativado'}
        </span>
        <Switch checked={props.checked} onChange={props.onChange}>
          <SwitchInput />
          <SwitchControl>
            <SwitchThumb />
          </SwitchControl>
        </Switch>
      </div>
    </FieldShell>
  )
}

type StringListFieldProps = {
  label: string
  help: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
  addLabel?: string
}

export function StringListField(props: StringListFieldProps) {
  const [draft, setDraft] = createSignal('')

  const pushDraft = () => {
    const value = draft().trim()
    if (!value) return
    props.onChange([...props.items, value])
    setDraft('')
  }

  const updateItem = (index: number, value: string) => {
    props.onChange(props.items.map((item, current) => (current === index ? value : item)))
  }

  const removeItem = (index: number) => {
    props.onChange(props.items.filter((_, current) => current !== index))
  }

  return (
    <FieldShell label={props.label} help={props.help} controlClass="w-full md:col-span-2">
      <div class="grid gap-2">
        <For each={props.items}>
          {(item, index) => (
            <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <Input value={item} placeholder={props.placeholder} onInput={(e) => updateItem(index(), e.currentTarget.value)} />
              <Button type="button" variant="destructive" size="sm" onClick={() => removeItem(index())}>
                Remover
              </Button>
            </div>
          )}
        </For>

        <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <Input value={draft()} placeholder={props.placeholder} onInput={(e) => setDraft(e.currentTarget.value)} />
          <Button type="button" variant="outline" size="sm" onClick={pushDraft}>
            {props.addLabel ?? 'Adicionar'}
          </Button>
        </div>
      </div>
    </FieldShell>
  )
}

export type KeyValueItem = {
  key: string
  value: string
}

type KeyValueListFieldProps = {
  label: string
  help: string
  items: KeyValueItem[]
  onChange: (items: KeyValueItem[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  addLabel?: string
  removeLabel?: string
}

export function KeyValueListField(props: KeyValueListFieldProps) {
  const [draftKey, setDraftKey] = createSignal('')
  const [draftValue, setDraftValue] = createSignal('')

  const updateItem = (index: number, patch: Partial<KeyValueItem>) => {
    props.onChange(
      props.items.map((item, current) =>
        current === index
          ? {
              key: patch.key ?? item.key,
              value: patch.value ?? item.value
            }
          : item
      )
    )
  }

  const removeItem = (index: number) => {
    props.onChange(props.items.filter((_, current) => current !== index))
  }

  const addItem = () => {
    const key = draftKey().trim()
    if (!key) return

    props.onChange([...props.items, { key, value: draftValue() }])
    setDraftKey('')
    setDraftValue('')
  }

  return (
    <FieldShell label={props.label} help={props.help} controlClass="w-full md:col-span-2">
      <div class="grid gap-2">
        <For each={props.items}>
          {(item, index) => (
            <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Input
                value={item.key}
                placeholder={props.keyPlaceholder ?? 'KEY'}
                onInput={(e) => updateItem(index(), { key: e.currentTarget.value })}
              />
              <Input
                value={item.value}
                placeholder={props.valuePlaceholder ?? 'VALUE'}
                onInput={(e) => updateItem(index(), { value: e.currentTarget.value })}
              />
              <Button type="button" variant="destructive" size="sm" onClick={() => removeItem(index())}>
                {props.removeLabel ?? 'Remover'}
              </Button>
            </div>
          )}
        </For>

        <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input
            value={draftKey()}
            placeholder={props.keyPlaceholder ?? 'KEY'}
            onInput={(e) => setDraftKey(e.currentTarget.value)}
          />
          <Input
            value={draftValue()}
            placeholder={props.valuePlaceholder ?? 'VALUE'}
            onInput={(e) => setDraftValue(e.currentTarget.value)}
          />
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            {props.addLabel ?? 'Adicionar'}
          </Button>
        </div>
      </div>
    </FieldShell>
  )
}
