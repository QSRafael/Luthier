import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'

import { cn } from '../../lib/cva'

export type SkeletonProps = ComponentProps<'div'>

export const Skeleton = (props: SkeletonProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('animate-pulse rounded-md bg-muted/40', props.class)} {...rest} />
}

