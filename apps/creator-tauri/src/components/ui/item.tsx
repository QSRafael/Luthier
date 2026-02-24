import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/cva'

const itemVariants = cva('rounded-xl border bg-card/95 p-4', {
  variants: {
    variant: {
      default: 'border-border',
      outline: 'border-dashed border-border',
      muted: 'border-border bg-muted/20'
    },
    size: {
      default: 'p-4',
      sm: 'p-3',
      xs: 'p-2.5'
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'default'
  }
})

export type ItemProps = ComponentProps<'section'> & VariantProps<typeof itemVariants>

export const Item = (props: ItemProps) => {
  const [, rest] = splitProps(props, ['class', 'variant', 'size'])
  return <section class={cn(itemVariants({ variant: props.variant, size: props.size }), props.class)} {...rest} />
}

export type ItemGroupProps = ComponentProps<'div'>
export const ItemGroup = (props: ItemGroupProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('grid gap-3', props.class)} {...rest} />
}

export type ItemSeparatorProps = ComponentProps<'hr'>
export const ItemSeparator = (props: ItemSeparatorProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <hr class={cn('border-border', props.class)} {...rest} />
}

export type ItemMainProps = ComponentProps<'div'>
export const ItemMain = (props: ItemMainProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] md:items-start', props.class)} {...rest} />
}

export type ItemMediaProps = ComponentProps<'div'> & {
  variant?: 'default' | 'icon' | 'image'
}

export const ItemMedia = (props: ItemMediaProps) => {
  const [, rest] = splitProps(props, ['class', 'variant'])
  const variant = props.variant ?? 'default'
  return (
    <div
      class={cn(
        'shrink-0',
        variant === 'icon' && 'inline-flex size-8 items-center justify-center rounded-md border bg-muted/40',
        variant === 'image' && 'overflow-hidden rounded-md border',
        props.class
      )}
      {...rest}
    />
  )
}

export type ItemContentProps = ComponentProps<'div'>
export const ItemContent = (props: ItemContentProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('space-y-1.5', props.class)} {...rest} />
}

export type ItemTitleProps = ComponentProps<'p'>
export const ItemTitle = (props: ItemTitleProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <p class={cn('text-sm font-semibold leading-tight text-foreground', props.class)} {...rest} />
}

export type ItemDescriptionProps = ComponentProps<'p'>
export const ItemDescription = (props: ItemDescriptionProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <p class={cn('text-xs text-muted-foreground', props.class)} {...rest} />
}

export type ItemActionsProps = ComponentProps<'div'>
export const ItemActions = (props: ItemActionsProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('w-full', props.class)} {...rest} />
}

export type ItemFooterProps = ComponentProps<'div'> & {
  showDivider?: boolean
}

export const ItemFooter = (props: ItemFooterProps) => {
  const [, rest] = splitProps(props, ['class', 'showDivider'])
  return (
    <Show when={props.children}>
      <div class={cn('mt-3 pt-3', props.showDivider !== false && 'border-t', props.class)} {...rest} />
    </Show>
  )
}
