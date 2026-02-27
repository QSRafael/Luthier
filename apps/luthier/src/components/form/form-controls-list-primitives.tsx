import { IconTrash } from '@tabler/icons-solidjs'
import { For, type JSX } from 'solid-js'

import { Button } from '../ui/button'
import { TableCell, TableRow } from '../ui/table'
import { FormListTable } from './form-list-table'

type ListRemoveButtonProps = {
  title: string
  onClick: () => void
}

export function ListRemoveButton(props: ListRemoveButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      onClick={props.onClick}
      title={props.title}
    >
      <IconTrash class="size-4" />
    </Button>
  )
}

type ListEmptyStateProps = {
  message: JSX.Element
}

export function ListEmptyState(props: ListEmptyStateProps) {
  return (
    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      {props.message}
    </div>
  )
}

type StringListItemsTableProps = {
  items: string[]
  valueHeader: JSX.Element
  actionHeader: JSX.Element
  removeLabel: string
  onRemove: (index: number) => void
}

export function StringListItemsTable(props: StringListItemsTableProps) {
  return (
    <FormListTable
      columns={[
        { label: props.valueHeader },
        { label: props.actionHeader, class: 'w-[72px] text-right' }
      ]}
      rows={props.items}
      renderRow={(item, index) => (
        <TableRow>
          <TableCell class="max-w-0 truncate">{item}</TableCell>
          <TableCell class="text-right">
            <ListRemoveButton title={props.removeLabel} onClick={() => props.onRemove(index())} />
          </TableCell>
        </TableRow>
      )}
    />
  )
}

type StringListItemsCardsProps = {
  items: string[]
  removeLabel: string
  onRemove: (index: number) => void
}

export function StringListItemsCards(props: StringListItemsCardsProps) {
  return (
    <div class="grid gap-2">
      <For each={props.items}>
        {(item, index) => (
          <div class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span class="truncate">{item}</span>
            <div class="ml-auto">
              <ListRemoveButton title={props.removeLabel} onClick={() => props.onRemove(index())} />
            </div>
          </div>
        )}
      </For>
    </div>
  )
}

type KeyValueDisplayItem = {
  key: string
  value: string
}

type KeyValueItemsCardsProps = {
  items: KeyValueDisplayItem[]
  removeLabel: string
  onRemove: (index: number) => void
}

export function KeyValueItemsCards(props: KeyValueItemsCardsProps) {
  return (
    <div class="grid gap-2">
      <For each={props.items}>
        {(item, index) => (
          <div class="grid items-center gap-2 rounded-md border px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <span class="truncate text-sm font-medium">{item.key}</span>
            <span class="truncate text-sm text-muted-foreground">{item.value}</span>
            <ListRemoveButton title={props.removeLabel} onClick={() => props.onRemove(index())} />
          </div>
        )}
      </For>
    </div>
  )
}

type KeyValueItemsTableProps = {
  items: KeyValueDisplayItem[]
  headers: {
    key: JSX.Element
    value: JSX.Element
  }
  actionHeader: JSX.Element
  removeLabel: string
  onRemove: (index: number) => void
}

export function KeyValueItemsTable(props: KeyValueItemsTableProps) {
  return (
    <FormListTable
      columns={[
        { label: props.headers.key },
        { label: props.headers.value },
        { label: props.actionHeader, class: 'w-14 text-right' }
      ]}
      rows={props.items}
      renderRow={(item, index) => (
        <TableRow>
          <TableCell class="font-medium">{item.key}</TableCell>
          <TableCell class="text-muted-foreground">{item.value || '—'}</TableCell>
          <TableCell class="text-right">
            <ListRemoveButton title={props.removeLabel} onClick={() => props.onRemove(index())} />
          </TableCell>
        </TableRow>
      )}
    />
  )
}
