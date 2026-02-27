import { createContext, For, JSX, Show, useContext, type ComponentProps } from 'solid-js'

import { Select } from '../ui/select'
import { Switch, SwitchControl, SwitchInput, SwitchThumb } from '../ui/switch'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { Textarea } from '../ui/textarea'
import { Input } from '../ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMain,
  ItemTitle,
} from '../ui/item'
export type FormControlsI18n = {
  enabled: string
  disabled: string
  mandatory: string
  wineDefault: string
  actions: string
  action: string
  add: string
  addItem: string
  addListDialogDescription: string
  addKeyValueDialogDescription: string
  pickFile: string
  pickFileHint: string
  cancel: string
  confirm: string
  remove: string
  noItemAdded: string
  keyPlaceholder: string
  valuePlaceholder: string
}

const defaultFormControlsI18n: FormControlsI18n = {
  enabled: 'Ativado',
  disabled: 'Desativado',
  mandatory: 'Obrigatório',
  wineDefault: 'Padrão',
  actions: 'Ações',
  action: 'Ação',
  add: 'Adicionar',
  addItem: 'Adicionar item',
  addListDialogDescription: 'Insira um novo valor para esta lista.',
  addKeyValueDialogDescription: 'Defina chave e valor para adicionar uma nova linha.',
  pickFile: 'Escolher arquivo',
  pickFileHint: 'Selecione um arquivo para preencher este campo automaticamente.',
  cancel: 'Cancelar',
  confirm: 'Confirmar',
  remove: 'Remover',
  noItemAdded: 'Nenhum item adicionado.',
  keyPlaceholder: 'Chave',
  valuePlaceholder: 'Valor',
}

const FormControlsI18nContext = createContext<FormControlsI18n>(defaultFormControlsI18n)

export function FormControlsI18nProvider(props: {
  value: FormControlsI18n
  children: JSX.Element
}) {
  return (
    <FormControlsI18nContext.Provider value={props.value}>
      {props.children}
    </FormControlsI18nContext.Provider>
  )
}

export function useFormControlsI18n() {
  return useContext(FormControlsI18nContext) ?? defaultFormControlsI18n
}

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

        <ItemActions
          class={
            props.controlClass ?? (props.compact ? 'max-w-[260px] justify-self-end' : 'w-full')
          }
        >
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
  inputMode?: ComponentProps<'input'>['inputMode']
  type?: string
  error?: string
}

export function TextInputField(props: TextInputFieldProps) {
  return (
    <FieldShell
      label={props.label}
      help={props.help}
      compact={props.compact ?? false}
      footer={props.error ? <p class="text-xs text-destructive">{props.error}</p> : undefined}
    >
      <Input
        value={props.value}
        type={props.type}
        inputMode={props.inputMode}
        readOnly={props.readonly}
        placeholder={props.placeholder}
        class={
          (props.readonly ? 'bg-muted/50 text-muted-foreground ' : '') +
          (props.error ? 'border-destructive focus-visible:ring-destructive' : '')
        }
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
        <For each={props.options}>
          {(option) => <option value={option.value}>{option.label}</option>}
        </For>
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
  const i18n = useFormControlsI18n()
  return (
    <FieldShell label={props.label} help={props.help} compact>
      <div class="flex items-center justify-end gap-3">
        <span class="text-xs font-medium text-muted-foreground">
          {props.checked ? (props.yesLabel ?? i18n.enabled) : (props.noLabel ?? i18n.disabled)}
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
