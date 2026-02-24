import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'

import { cn } from '../../lib/cva'

export type TextareaProps = ComponentProps<'textarea'>

export const Textarea = (props: TextareaProps) => {
  const [, rest] = splitProps(props, ['class'])

  return (
    <textarea
      class={cn(
        'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        props.class
      )}
      {...rest}
    />
  )
}
