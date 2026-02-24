import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'

import { cn } from '../../lib/cva'

export type SelectProps = ComponentProps<'select'>

export const Select = (props: SelectProps) => {
  const [, rest] = splitProps(props, ['class'])

  return (
    <select
      class={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        props.class
      )}
      {...rest}
    />
  )
}
