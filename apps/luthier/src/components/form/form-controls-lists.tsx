import { createMemo, createSignal, For, Show } from 'solid-js'
import { IconPlus, IconTrash } from '@tabler/icons-solidjs'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { TableCell, TableRow } from '../ui/table'
import { FieldShell, useFormControlsI18n } from './form-controls-core'
import { FormListTable } from './form-list-table'

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
  const [open, setOpen] = createSignal(false)
  const [draft, setDraft] = createSignal('')

  const cleanDraft = createMemo(() => draft().trim())
  const draftValidation = createMemo(() => props.validateDraft?.(cleanDraft(), props.items) ?? null)

  const addItem = () => {
    const value = cleanDraft()
    if (!value) return
    if (draftValidation()?.error) return
    props.onChange([...props.items, value])
    setDraft('')
    setOpen(false)
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
            <FormListTable
              columns={[
                { label: props.tableValueHeader },
                { label: i18n.actions, class: 'w-[72px] text-right' }
              ]}
              rows={props.items}
              renderRow={(item, index) => (
                <TableRow>
                  <TableCell class="max-w-0 truncate">{item}</TableCell>
                  <TableCell class="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(index())}
                      title={i18n.remove}
                    >
                      <IconTrash class="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            />
          ) : (
            <div class="grid gap-2">
              <For each={props.items}>
                {(item, index) => (
                  <div class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <span class="truncate">{item}</span>
                    <div class="ml-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(index())}
                        title={i18n.remove}
                      >
                        <IconTrash class="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          )
        ) : props.emptyMessage ? (
          <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">{props.emptyMessage}</div>
        ) : undefined
      }
    >
      <Dialog open={open()} onOpenChange={setOpen}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="inline-flex items-center gap-1.5"
          onClick={() => setOpen(true)}
          disabled={props.addDisabled}
        >
          <IconPlus class="size-4" />
          {props.addLabel ?? i18n.add}
        </Button>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>{props.addLabel ?? i18n.addItem}</DialogTitle>
            <DialogDescription>{i18n.addListDialogDescription}</DialogDescription>
          </DialogHeader>

          <Show
            when={props.onPickValue}
            fallback={
              <Input
                value={draft()}
                placeholder={props.placeholder}
                class={draftValidation()?.error ? 'border-destructive focus-visible:ring-destructive' : ''}
                onInput={(e) => setDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addItem()
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
                  class={draftValidation()?.error ? 'border-destructive focus-visible:ring-destructive' : ''}
                  onInput={(e) => setDraft(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addItem()
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
              <p class="text-xs text-muted-foreground">
                {i18n.pickFileHint}
              </p>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {i18n.cancel}
            </Button>
            <Button type="button" onClick={addItem} disabled={!cleanDraft() || !!draftValidation()?.error}>
              {i18n.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  ) => {
    keyError?: string
    keyHint?: string
    valueError?: string
    valueHint?: string
    formError?: string
  } | null | undefined
}

export function KeyValueListField(props: KeyValueListFieldProps) {
  const i18n = useFormControlsI18n()
  const [open, setOpen] = createSignal(false)
  const [draftKey, setDraftKey] = createSignal('')
  const [draftValue, setDraftValue] = createSignal('')

  const canAdd = createMemo(() => draftKey().trim().length > 0)
  const draftValidation = createMemo(
    () =>
      props.validateDraft?.(
        {
          key: draftKey().trim(),
          value: draftValue()
        },
        props.items
      ) ?? null
  )

  const addItem = () => {
    const key = draftKey().trim()
    if (!key) return
    if (draftValidation()?.keyError || draftValidation()?.valueError || draftValidation()?.formError) return

    props.onChange([...props.items, { key, value: draftValue() }])
    setDraftKey('')
    setDraftValue('')
    setOpen(false)
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
          fallback={
            <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {props.emptyMessage ?? i18n.noItemAdded}
            </div>
          }
        >
          <Show
            when={props.tableHeaders}
            fallback={
              <div class="grid gap-2">
                <For each={props.items}>
                  {(item, index) => (
                    <div class="grid items-center gap-2 rounded-md border px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <span class="truncate text-sm font-medium">{item.key}</span>
                      <span class="truncate text-sm text-muted-foreground">{item.value}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(index())}
                        title={props.removeLabel ?? i18n.remove}
                      >
                        <IconTrash class="size-4" />
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            }
          >
            <FormListTable
              columns={[
                { label: props.tableHeaders?.key },
                { label: props.tableHeaders?.value },
                { label: props.removeLabel ?? i18n.action, class: 'w-14 text-right' }
              ]}
              rows={props.items}
              renderRow={(item, index) => (
                <TableRow>
                  <TableCell class="font-medium">{item.key}</TableCell>
                  <TableCell class="text-muted-foreground">{item.value || '—'}</TableCell>
                  <TableCell class="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(index())}
                      title={props.removeLabel ?? i18n.remove}
                    >
                      <IconTrash class="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            />
          </Show>
        </Show>
      }
    >
      <Dialog open={open()} onOpenChange={setOpen}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="inline-flex items-center gap-1.5"
          onClick={() => setOpen(true)}
        >
          <IconPlus class="size-4" />
          {props.addLabel ?? i18n.add}
        </Button>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>{props.addLabel ?? i18n.addItem}</DialogTitle>
            <DialogDescription>{i18n.addKeyValueDialogDescription}</DialogDescription>
          </DialogHeader>

          <div class="grid gap-2">
            <Input
              value={draftKey()}
              placeholder={props.keyPlaceholder ?? i18n.keyPlaceholder}
              class={draftValidation()?.keyError ? 'border-destructive focus-visible:ring-destructive' : ''}
              onInput={(e) => setDraftKey(e.currentTarget.value)}
            />
            <Input
              value={draftValue()}
              placeholder={props.valuePlaceholder ?? i18n.valuePlaceholder}
              class={draftValidation()?.valueError ? 'border-destructive focus-visible:ring-destructive' : ''}
              onInput={(e) => setDraftValue(e.currentTarget.value)}
            />

            <Show when={draftValidation()?.keyError || draftValidation()?.keyHint}>
              <p class={draftValidation()?.keyError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {draftValidation()?.keyError ?? draftValidation()?.keyHint}
              </p>
            </Show>
            <Show when={draftValidation()?.valueError || draftValidation()?.valueHint}>
              <p class={draftValidation()?.valueError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {draftValidation()?.valueError ?? draftValidation()?.valueHint}
              </p>
            </Show>
            <Show when={draftValidation()?.formError}>
              <p class="text-xs text-destructive">{draftValidation()?.formError}</p>
            </Show>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {i18n.cancel}
            </Button>
            <Button
              type="button"
              onClick={addItem}
              disabled={!canAdd() || !!draftValidation()?.keyError || !!draftValidation()?.valueError || !!draftValidation()?.formError}
            >
              {i18n.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FieldShell>
  )
}
