import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'

import { cn } from '../../lib/cva'

export type SpinnerProps = ComponentProps<'span'>

export const Spinner = (props: SpinnerProps) => {
  const [, rest] = splitProps(props, ['class'])
  return (
    <span
      aria-hidden="true"
      class={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        props.class
      )}
      {...rest}
    />
  )
}
