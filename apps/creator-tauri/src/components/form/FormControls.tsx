import { createSignal, For, JSX, Show } from 'solid-js'

export type SelectOption<T extends string> = {
  value: T
  label: string
}

type FieldShellProps = {
  label: string
  help: string
  children: JSX.Element
  hint?: string
}

export function FieldShell(props: FieldShellProps) {
  return (
    <div class="field">
      <div class="label-row">
        <span>{props.label}</span>
        <span class="help" title={props.help}>
          ?
        </span>
      </div>
      <Show when={props.hint}>
        <p class="hint">{props.hint}</p>
      </Show>
      {props.children}
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
    <FieldShell label={props.label} help={props.help}>
      <input
        value={props.value}
        readOnly={props.readonly}
        placeholder={props.placeholder}
        classList={{ readonly: !!props.readonly }}
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
    <FieldShell label={props.label} help={props.help}>
      <textarea
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
    <FieldShell label={props.label} help={props.help}>
      <select value={props.value} onInput={(e) => props.onChange(e.currentTarget.value as T)}>
        <For each={props.options}>
          {(option) => <option value={option.value}>{option.label}</option>}
        </For>
      </select>
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
    <FieldShell label={props.label} help={props.help}>
      <div class="toggle-buttons">
        <button
          type="button"
          classList={{ active: !props.checked }}
          onClick={() => props.onChange(false)}
        >
          {props.noLabel ?? 'Não'}
        </button>
        <button
          type="button"
          classList={{ active: props.checked }}
          onClick={() => props.onChange(true)}
        >
          {props.yesLabel ?? 'Sim'}
        </button>
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
    <FieldShell label={props.label} help={props.help}>
      <div class="table-list">
        <For each={props.items}>
          {(item, index) => (
            <div class="table-row table-row-single">
              <input
                value={item}
                placeholder={props.placeholder}
                onInput={(e) => updateItem(index(), e.currentTarget.value)}
              />
              <button type="button" class="btn-danger" onClick={() => removeItem(index())}>
                Remover
              </button>
            </div>
          )}
        </For>

        <div class="table-row table-row-single">
          <input
            value={draft()}
            placeholder={props.placeholder}
            onInput={(e) => setDraft(e.currentTarget.value)}
          />
          <button type="button" class="btn-secondary" onClick={pushDraft}>
            {props.addLabel ?? 'Adicionar'}
          </button>
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
    <FieldShell label={props.label} help={props.help}>
      <div class="table-list">
        <For each={props.items}>
          {(item, index) => (
            <div class="table-row table-row-two">
              <input
                value={item.key}
                placeholder={props.keyPlaceholder ?? 'KEY'}
                onInput={(e) => updateItem(index(), { key: e.currentTarget.value })}
              />
              <input
                value={item.value}
                placeholder={props.valuePlaceholder ?? 'VALUE'}
                onInput={(e) => updateItem(index(), { value: e.currentTarget.value })}
              />
              <button type="button" class="btn-danger" onClick={() => removeItem(index())}>
                {props.removeLabel ?? 'Remover'}
              </button>
            </div>
          )}
        </For>

        <div class="table-row table-row-two">
          <input
            value={draftKey()}
            placeholder={props.keyPlaceholder ?? 'KEY'}
            onInput={(e) => setDraftKey(e.currentTarget.value)}
          />
          <input
            value={draftValue()}
            placeholder={props.valuePlaceholder ?? 'VALUE'}
            onInput={(e) => setDraftValue(e.currentTarget.value)}
          />
          <button type="button" class="btn-secondary" onClick={addItem}>
            {props.addLabel ?? 'Adicionar'}
          </button>
        </div>
      </div>
    </FieldShell>
  )
}
