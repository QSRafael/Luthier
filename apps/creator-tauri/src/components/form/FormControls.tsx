import { createMemo, createSignal, For, JSX, Show } from 'solid-js'
import { IconPlus, IconTrash } from '@tabler/icons-solidjs'

import type { FeatureState } from '../../models/config'
import { cn } from '../../lib/cva'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../ui/dialog'
import { Input } from '../ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMain,
  ItemTitle
} from '../ui/item'
import { Select } from '../ui/select'
import { Switch, SwitchControl, SwitchInput, SwitchThumb } from '../ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
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
  footer?: JSX.Element
}

export function FieldShell(props: FieldShellProps) {
  return (
    <Item>
      <ItemMain>
        <ItemContent>
          <div class="flex items-center gap-2">
            <ItemTitle>{props.label}</ItemTitle>
            <span
              class="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-medium text-muted-foreground"
              title={props.help}
            >
              ?
            </span>
          </div>
          <ItemDescription>{props.help}</ItemDescription>
          <Show when={props.hint}>
            <p class="text-xs text-muted-foreground/85">{props.hint}</p>
          </Show>
        </ItemContent>

        <ItemActions class={props.controlClass ?? (props.compact ? 'max-w-[260px] justify-self-end' : 'w-full')}>
          {props.children}
        </ItemActions>
      </ItemMain>

      <ItemFooter showDivider={!!props.footer}>{props.footer}</ItemFooter>
    </Item>
  )
}

type TextInputFieldProps = {
  label: string
  help: string
  value: string
  onInput: (value: string) => void
  placeholder?: string
  readonly?: boolean
  compact?: boolean
}

export function TextInputField(props: TextInputFieldProps) {
  return (
    <FieldShell label={props.label} help={props.help} compact={props.compact ?? false}>
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

type SegmentedFieldProps<T extends string> = {
  label: string
  help: string
  value: T
  options: Array<SelectOption<T>>
  onChange: (value: T) => void
}

export function SegmentedField<T extends string>(props: SegmentedFieldProps<T>) {
  return (
    <FieldShell label={props.label} help={props.help} controlClass="flex justify-end">
      <Tabs value={props.value} onChange={(value) => props.onChange(value as T)} class="items-end">
        <TabsList class="w-full justify-start md:w-auto">
          <For each={props.options}>
            {(option) => (
              <TabsTrigger value={option.value} class="min-w-[72px]">
                {option.label}
              </TabsTrigger>
            )}
          </For>
        </TabsList>
      </Tabs>
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
        'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors',
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
      <p class="text-sm font-medium">{props.title}</p>
      <Switch
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onChange}
        onClick={(e) => e.stopPropagation()}
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
  const state = createMemo(() => decodeFeatureState(props.value))

  return (
    <FieldShell label={props.label} help={props.help} controlClass="grid gap-2 md:grid-cols-2" footer={props.footer}>
      <>
        <FeatureToggleCard
          title="Ativado"
          checked={state().enabled}
          onChange={(enabled) => props.onChange(encodeFeatureState(enabled, state().mandatory))}
        />
        <FeatureToggleCard
          title="Obrigatório"
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
  const decoded = createMemo(() => decodeFeatureState(props.value.state))

  return (
    <FieldShell
      label={props.label}
      help={props.help}
      controlClass="grid gap-2 md:grid-cols-3"
      footer={props.footer}
    >
      <>
        <FeatureToggleCard
          title="Padrão do Wine"
          checked={props.value.use_wine_default}
          onChange={(use_wine_default) => props.onChange({ ...props.value, use_wine_default })}
        />
        <FeatureToggleCard
          title="Ativado"
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
          title="Obrigatório"
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
}

export function StringListField(props: StringListFieldProps) {
  const [open, setOpen] = createSignal(false)
  const [draft, setDraft] = createSignal('')

  const cleanDraft = createMemo(() => draft().trim())

  const addItem = () => {
    const value = cleanDraft()
    if (!value) return
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
            <div class="rounded-md border border-border/60 bg-background/40">
              <Table>
                <TableHeader>
                  <TableRow class="hover:bg-transparent">
                    <TableHead>{props.tableValueHeader}</TableHead>
                    <TableHead class="w-[72px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={props.items}>
                    {(item, index) => (
                      <TableRow>
                        <TableCell class="max-w-0 truncate">{item}</TableCell>
                        <TableCell class="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(index())}
                            title="Remover"
                          >
                            <IconTrash class="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
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
                        title="Remover"
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
        <DialogTrigger
          as={Button}
          type="button"
          variant="outline"
          size="sm"
          class="inline-flex items-center gap-1.5"
        >
          <IconPlus class="size-4" />
          {props.addLabel ?? 'Adicionar'}
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>{props.addLabel ?? 'Adicionar item'}</DialogTitle>
            <DialogDescription>Insira um novo valor para esta lista.</DialogDescription>
          </DialogHeader>

          <Show
            when={props.onPickValue}
            fallback={
              <Input
                value={draft()}
                placeholder={props.placeholder}
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
                  onClick={async () => {
                    const picked = await props.onPickValue?.()
                    if (!picked) return
                    setDraft(picked)
                  }}
                >
                  {props.pickerLabel ?? 'Escolher arquivo'}
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                Selecione um arquivo para preencher este campo automaticamente.
              </p>
            </div>
          </Show>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={addItem} disabled={!cleanDraft()}>
              Confirmar
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
}

export function KeyValueListField(props: KeyValueListFieldProps) {
  const [open, setOpen] = createSignal(false)
  const [draftKey, setDraftKey] = createSignal('')
  const [draftValue, setDraftValue] = createSignal('')

  const canAdd = createMemo(() => draftKey().trim().length > 0)

  const addItem = () => {
    const key = draftKey().trim()
    if (!key) return

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
              {props.emptyMessage ?? 'Nenhum item adicionado.'}
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
                        title={props.removeLabel ?? 'Remover'}
                      >
                        <IconTrash class="size-4" />
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            }
          >
            <div class="rounded-md border border-border/60 bg-background/40">
              <Table>
                <TableHeader>
                  <TableRow class="hover:bg-transparent">
                    <TableHead>{props.tableHeaders?.key}</TableHead>
                    <TableHead>{props.tableHeaders?.value}</TableHead>
                    <TableHead class="w-14 text-right">{props.removeLabel ?? 'Ação'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={props.items}>
                    {(item, index) => (
                      <TableRow>
                        <TableCell class="font-medium">{item.key}</TableCell>
                        <TableCell class="text-muted-foreground">{item.value || '—'}</TableCell>
                        <TableCell class="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(index())}
                            title={props.removeLabel ?? 'Remover'}
                          >
                            <IconTrash class="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </div>
          </Show>
        </Show>
      }
    >
      <Dialog open={open()} onOpenChange={setOpen}>
        <DialogTrigger
          as={Button}
          type="button"
          variant="outline"
          size="sm"
          class="inline-flex items-center gap-1.5"
        >
          <IconPlus class="size-4" />
          {props.addLabel ?? 'Adicionar'}
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>{props.addLabel ?? 'Adicionar item'}</DialogTitle>
            <DialogDescription>Defina chave e valor para adicionar uma nova linha.</DialogDescription>
          </DialogHeader>

          <div class="grid gap-2">
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={addItem} disabled={!canAdd()}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FieldShell>
  )
}
