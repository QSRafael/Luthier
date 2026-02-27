import type { ComponentProps, ValidComponent } from 'solid-js'
import { splitProps } from 'solid-js'
import { Tabs as TabsPrimitive } from '@kobalte/core/tabs'

import { cn } from '../../lib/cva'

export type TabsProps<T extends ValidComponent = 'div'> = ComponentProps<typeof TabsPrimitive<T>>

export const Tabs = <T extends ValidComponent = 'div'>(props: TabsProps<T>) => {
  const [, rest] = splitProps(props as TabsProps, ['class'])
  return <TabsPrimitive class={cn('flex flex-col gap-3', props.class)} {...rest} />
}

export type TabsListProps<T extends ValidComponent = 'div'> = ComponentProps<
  typeof TabsPrimitive.List<T>
>

export const TabsList = <T extends ValidComponent = 'div'>(props: TabsListProps<T>) => {
  const [, rest] = splitProps(props as TabsListProps, ['class'])
  return (
    <TabsPrimitive.List
      class={cn(
        'bg-muted text-muted-foreground inline-flex h-10 w-fit items-center rounded-lg p-1',
        props.class
      )}
      {...rest}
    />
  )
}

export type TabsTriggerProps<T extends ValidComponent = 'button'> = ComponentProps<
  typeof TabsPrimitive.Trigger<T>
>

export const TabsTrigger = <T extends ValidComponent = 'button'>(props: TabsTriggerProps<T>) => {
  const [, rest] = splitProps(props as TabsTriggerProps, ['class'])
  return (
    <TabsPrimitive.Trigger
      class={cn(
        'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium data-[selected]:bg-background data-[selected]:text-foreground',
        props.class
      )}
      {...rest}
    />
  )
}

export type TabsContentProps<T extends ValidComponent = 'div'> = ComponentProps<
  typeof TabsPrimitive.Content<T>
>

export const TabsContent = <T extends ValidComponent = 'div'>(props: TabsContentProps<T>) => {
  const [, rest] = splitProps(props as TabsContentProps, ['class'])
  return <TabsPrimitive.Content class={cn('outline-none', props.class)} {...rest} />
}
