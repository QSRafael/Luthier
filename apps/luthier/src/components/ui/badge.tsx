import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/cva'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>

export const Badge = (props: BadgeProps) => {
  const [, rest] = splitProps(props, ['class', 'variant'])

  return <span class={cn(badgeVariants({ variant: props.variant }), props.class)} {...rest} />
}
