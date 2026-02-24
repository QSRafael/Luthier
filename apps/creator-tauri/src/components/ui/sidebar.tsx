import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'

import { cn } from '../../lib/cva'

export type SidebarProps = ComponentProps<'aside'> & {
  collapsible?: 'offcanvas' | 'none'
}

export const Sidebar = (props: SidebarProps) => {
  const [, rest] = splitProps(props, ['class'])
  return (
    <aside
      class={cn(
        'flex h-full min-h-[calc(100vh-2rem)] w-full max-w-[280px] flex-col rounded-xl border bg-card/90 backdrop-blur',
        props.class
      )}
      {...rest}
    />
  )
}

export type SidebarHeaderProps = ComponentProps<'div'>
export const SidebarHeader = (props: SidebarHeaderProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('border-b px-3 py-3', props.class)} {...rest} />
}

export type SidebarContentProps = ComponentProps<'div'>
export const SidebarContent = (props: SidebarContentProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('flex flex-1 flex-col gap-3 overflow-auto px-2 py-3', props.class)} {...rest} />
}

export type SidebarFooterProps = ComponentProps<'div'>
export const SidebarFooter = (props: SidebarFooterProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('border-t px-3 py-3', props.class)} {...rest} />
}

export type SidebarMenuProps = ComponentProps<'ul'>
export const SidebarMenu = (props: SidebarMenuProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <ul class={cn('grid gap-1', props.class)} {...rest} />
}

export type SidebarMenuItemProps = ComponentProps<'li'>
export const SidebarMenuItem = (props: SidebarMenuItemProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <li class={cn('list-none', props.class)} {...rest} />
}

export type SidebarMenuButtonProps = ComponentProps<'button'> & {
  active?: boolean
  asChild?: boolean
  children: JSX.Element
}

export const SidebarMenuButton = (props: SidebarMenuButtonProps) => {
  const [, rest] = splitProps(props, ['class', 'active', 'children'])
  return (
    <button
      type={props.type ?? 'button'}
      data-active={props.active ? '' : undefined}
      class={cn(
        'group flex w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-medium text-muted-foreground transition',
        'hover:bg-accent hover:text-accent-foreground',
        'data-[active]:border-border data-[active]:bg-accent data-[active]:text-accent-foreground',
        props.class
      )}
      {...rest}
    >
      {props.children}
    </button>
  )
}
