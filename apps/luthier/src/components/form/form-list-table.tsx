import type { Accessor, JSX } from 'solid-js'
import { For } from 'solid-js'

import { Table, TableBody, TableHead, TableHeader, TableRow } from '../ui/table'

export type FormListTableColumn = {
  label: JSX.Element
  class?: string
}

type FormListTableProps<TRow> = {
  columns: FormListTableColumn[]
  rows: readonly TRow[]
  renderRow: (row: TRow, index: Accessor<number>) => JSX.Element
}

export function FormListTable<TRow>(props: FormListTableProps<TRow>) {
  return (
    <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <For each={props.columns}>
              {(column) => <TableHead class={column.class}>{column.label}</TableHead>}
            </For>
          </TableRow>
        </TableHeader>
        <TableBody>
          <For each={props.rows}>{(row, index) => props.renderRow(row, index)}</For>
        </TableBody>
      </Table>
    </div>
  )
}
