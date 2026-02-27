import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'

import { cn } from '../../lib/cva'

export type TableProps = ComponentProps<'table'>

export const Table = (props: TableProps) => {
  const [, rest] = splitProps(props, ['class'])
  return (
    <div class="w-full overflow-x-auto">
      <table class={cn('w-full caption-bottom text-sm', props.class)} {...rest} />
    </div>
  )
}

export type TableHeaderProps = ComponentProps<'thead'>
export const TableHeader = (props: TableHeaderProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <thead class={cn('[&_tr]:border-b', props.class)} {...rest} />
}

export type TableBodyProps = ComponentProps<'tbody'>
export const TableBody = (props: TableBodyProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <tbody class={cn('[&_tr:last-child]:border-0', props.class)} {...rest} />
}

export type TableFooterProps = ComponentProps<'tfoot'>
export const TableFooter = (props: TableFooterProps) => {
  const [, rest] = splitProps(props, ['class'])
  return (
    <tfoot
      class={cn('bg-muted/40 border-t font-medium [&>tr]:last:border-b-0', props.class)}
      {...rest}
    />
  )
}

export type TableRowProps = ComponentProps<'tr'>
export const TableRow = (props: TableRowProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <tr class={cn('border-b transition-colors hover:bg-muted/25', props.class)} {...rest} />
}

export type TableHeadProps = ComponentProps<'th'>
export const TableHead = (props: TableHeadProps) => {
  const [, rest] = splitProps(props, ['class'])
  return (
    <th
      class={cn(
        'text-muted-foreground h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap',
        props.class
      )}
      {...rest}
    />
  )
}

export type TableCellProps = ComponentProps<'td'>
export const TableCell = (props: TableCellProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <td class={cn('align-middle px-3 py-2', props.class)} {...rest} />
}

export type TableCaptionProps = ComponentProps<'caption'>
export const TableCaption = (props: TableCaptionProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <caption class={cn('text-muted-foreground mt-3 text-xs', props.class)} {...rest} />
}
