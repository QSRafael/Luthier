import { splitProps, type ComponentProps, type ValidComponent } from 'solid-js'
import { Switch as SwitchPrimitive } from '@kobalte/core/switch'

import { cn } from '../../lib/cva'

export type SwitchProps<T extends ValidComponent = 'div'> = ComponentProps<typeof SwitchPrimitive<T>>

export const Switch = <T extends ValidComponent = 'div'>(props: SwitchProps<T>) => {
  return <SwitchPrimitive {...props} />
}

export type SwitchControlProps<T extends ValidComponent = 'div'> = ComponentProps<typeof SwitchPrimitive.Control<T>>

export const SwitchControl = <T extends ValidComponent = 'div'>(props: SwitchControlProps<T>) => {
  const [, rest] = splitProps(props as SwitchControlProps, ['class'])

  return (
    <SwitchPrimitive.Control
      class={cn(
        'bg-input inline-flex h-5 w-10 items-center rounded-full border border-transparent transition-all',
        'data-[checked]:bg-primary',
        'peer-focus-visible/switch-input:border-ring peer-focus-visible/switch-input:ring-ring/50 peer-focus-visible/switch-input:ring-[3px]',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        props.class
      )}
      {...rest}
    />
  )
}

export type SwitchThumbProps<T extends ValidComponent = 'div'> = ComponentProps<typeof SwitchPrimitive.Thumb<T>>

export const SwitchThumb = <T extends ValidComponent = 'div'>(props: SwitchThumbProps<T>) => {
  const [, rest] = splitProps(props as SwitchThumbProps, ['class'])
  return (
    <SwitchPrimitive.Thumb
      class={cn('bg-background pointer-events-none size-4 rounded-full transition-transform data-[checked]:translate-x-5', props.class)}
      {...rest}
    />
  )
}

export type SwitchInputProps<T extends ValidComponent = 'input'> = ComponentProps<typeof SwitchPrimitive.Input<T>>

export const SwitchInput = <T extends ValidComponent = 'input'>(props: SwitchInputProps<T>) => {
  const [, rest] = splitProps(props as SwitchInputProps, ['class'])
  return <SwitchPrimitive.Input class={cn('peer/switch-input', props.class)} {...rest} />
}
