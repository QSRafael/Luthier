import { createMemo, createSignal, Show } from 'solid-js'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { FieldShell, useFormControlsI18n } from './form-controls-core'
import {
  KeyValueItemsCards,
  KeyValueItemsTable,
  ListEmptyState,
  StringListItemsCards,
  StringListItemsTable,
} from './form-controls-list-primitives'
import { FormListDialog } from './form-list-dialog'

type FieldValidation = {
  error?: string
  hint?: string
}

type StringListFieldProps = {
  label: string
  help: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
  addLabel?: string
  pickerLabel?: string
  onPickValue?: () => Promise<string | null>
  emptyMessage?: string
  tableValueHeader?: string
  addDisabled?: boolean
  pickerDisabled?: boolean
  validateDraft?: (value: string, items: string[]) => FieldValidation | null | undefined
}

export function StringListField(props: StringListFieldProps) {
  const i18n = useFormControlsI18n()
  const [draft, setDraft] = createSignal('')

  const cleanDraft = createMemo(() => draft().trim())
  const draftValidation = createMemo(() => props.validateDraft?.(cleanDraft(), props.items) ?? null)

  const addItem = () => {
    const value = cleanDraft()
    if (!value) return false
    if (draftValidation()?.error) return false
    props.onChange([...props.items, value])
    setDraft('')
    return true
  }

  const removeItem = (index: number) => {
    props.onChange(props.items.filter((_, current) => current !== index))
  }

  return (
    <FieldShell
      label={props.label}
      help={props.help}
      controlClass="flex justify-end"
      footer={
        props.items.length > 0 ? (
          props.tableValueHeader ? (
            <StringListItemsTable
              items={props.items}
              valueHeader={props.tableValueHeader}
              actionHeader={i18n.actions}
              removeLabel={i18n.remove}
              onRemove={removeItem}
            />
          ) : (
            <StringListItemsCards
              items={props.items}
              removeLabel={i18n.remove}
              onRemove={removeItem}
            />
          )
        ) : props.emptyMessage ? (
          <ListEmptyState message={props.emptyMessage} />
        ) : undefined
      }
    >
      <FormListDialog
        triggerLabel={props.addLabel ?? i18n.add}
        triggerDisabled={props.addDisabled}
        title={props.addLabel ?? i18n.addItem}
        description={i18n.addListDialogDescription}
        cancelLabel={i18n.cancel}
        confirmLabel={i18n.confirm}
        confirmDisabled={!cleanDraft() || !!draftValidation()?.error}
        onConfirm={addItem}
      >
        {({ confirm }) => (
          <>
            <Show
              when={props.onPickValue}
              fallback={
                <Input
                  value={draft()}
                  placeholder={props.placeholder}
                  class={
                    draftValidation()?.error
                      ? 'border-destructive focus-visible:ring-destructive'
                      : ''
                  }
                  onInput={(e) => setDraft(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      confirm()
                    }
                  }}
                />
              }
            >
              <div class="grid gap-1.5">
                <div class="picker-row">
                  <Input
                    value={draft()}
                    placeholder={props.placeholder}
                    class={
                      draftValidation()?.error
                        ? 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }
                    onInput={(e) => setDraft(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        confirm()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={props.pickerDisabled}
                    onClick={async () => {
                      const picked = await props.onPickValue?.()
                      if (!picked) return
                      setDraft(picked)
                    }}
                  >
                    {props.pickerLabel ?? i18n.pickFile}
                  </Button>
                </div>
                <p class="text-xs text-muted-foreground">{i18n.pickFileHint}</p>
              </div>
            </Show>

            <Show when={draftValidation()}>
              {(validation) => (
                <div class="space-y-1">
                  <Show when={validation().error}>
                    <p class="text-xs text-destructive">{validation().error}</p>
                  </Show>
                  <Show when={!validation().error && validation().hint}>
                    <p class="text-xs text-muted-foreground">{validation().hint}</p>
                  </Show>
                </div>
              )}
            </Show>
          </>
        )}
      </FormListDialog>
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
  emptyMessage?: string
  tableHeaders?: {
    key: string
    value: string
  }
  validateDraft?: (
    draft: { key: string; value: string },
    items: KeyValueItem[]
  ) =>
    | {
        keyError?: string
        keyHint?: string
        valueError?: string
        valueHint?: string
        formError?: string
      }
    | null
    | undefined
}

export function KeyValueListField(props: KeyValueListFieldProps) {
  const i18n = useFormControlsI18n()
  const [draftKey, setDraftKey] = createSignal('')
  const [draftValue, setDraftValue] = createSignal('')

  const canAdd = createMemo(() => draftKey().trim().length > 0)
  const draftValidation = createMemo(
    () =>
      props.validateDraft?.(
        {
          key: draftKey().trim(),
          value: draftValue(),
        },
        props.items
      ) ?? null
  )

  const addItem = () => {
    const key = draftKey().trim()
    if (!key) return false
    if (
      draftValidation()?.keyError ||
      draftValidation()?.valueError ||
      draftValidation()?.formError
    )
      return false

    props.onChange([...props.items, { key, value: draftValue() }])
    setDraftKey('')
    setDraftValue('')
    return true
  }

  const removeItem = (index: number) => {
    props.onChange(props.items.filter((_, current) => current !== index))
  }

  return (
    <FieldShell
      label={props.label}
      help={props.help}
      controlClass="flex justify-end"
      footer={
        <Show
          when={props.items.length > 0}
          fallback={<ListEmptyState message={props.emptyMessage ?? i18n.noItemAdded} />}
        >
          <Show
            when={props.tableHeaders}
            fallback={
              <KeyValueItemsCards
                items={props.items}
                removeLabel={props.removeLabel ?? i18n.remove}
                onRemove={removeItem}
              />
            }
          >
            {(tableHeaders) => (
              <KeyValueItemsTable
                items={props.items}
                headers={tableHeaders()}
                actionHeader={props.removeLabel ?? i18n.action}
                removeLabel={props.removeLabel ?? i18n.remove}
                onRemove={removeItem}
              />
            )}
          </Show>
        </Show>
      }
    >
      <FormListDialog
        triggerLabel={props.addLabel ?? i18n.add}
        title={props.addLabel ?? i18n.addItem}
        description={i18n.addKeyValueDialogDescription}
        cancelLabel={i18n.cancel}
        confirmLabel={i18n.confirm}
        confirmDisabled={
          !canAdd() ||
          !!draftValidation()?.keyError ||
          !!draftValidation()?.valueError ||
          !!draftValidation()?.formError
        }
        onConfirm={addItem}
      >
        {() => (
          <div class="grid gap-2">
            <Input
              value={draftKey()}
              placeholder={props.keyPlaceholder ?? i18n.keyPlaceholder}
              class={
                draftValidation()?.keyError
                  ? 'border-destructive focus-visible:ring-destructive'
                  : ''
              }
              onInput={(e) => setDraftKey(e.currentTarget.value)}
            />
            <Input
              value={draftValue()}
              placeholder={props.valuePlaceholder ?? i18n.valuePlaceholder}
              class={
                draftValidation()?.valueError
                  ? 'border-destructive focus-visible:ring-destructive'
                  : ''
              }
              onInput={(e) => setDraftValue(e.currentTarget.value)}
            />

            <Show when={draftValidation()?.keyError || draftValidation()?.keyHint}>
              <p
                class={
                  draftValidation()?.keyError
                    ? 'text-xs text-destructive'
                    : 'text-xs text-muted-foreground'
                }
              >
                {draftValidation()?.keyError ?? draftValidation()?.keyHint}
              </p>
            </Show>
            <Show when={draftValidation()?.valueError || draftValidation()?.valueHint}>
              <p
                class={
                  draftValidation()?.valueError
                    ? 'text-xs text-destructive'
                    : 'text-xs text-muted-foreground'
                }
              >
                {draftValidation()?.valueError ?? draftValidation()?.valueHint}
              </p>
            </Show>
            <Show when={draftValidation()?.formError}>
              <p class="text-xs text-destructive">{draftValidation()?.formError}</p>
            </Show>
          </div>
        )}
      </FormListDialog>
    </FieldShell>
  )
}
