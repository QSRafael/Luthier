import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/cva'

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground border-border',
        warning:
          'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100',
        destructive: 'border-destructive/40 bg-destructive/10 text-destructive'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export type AlertProps = ComponentProps<'div'> & VariantProps<typeof alertVariants>

export const Alert = (props: AlertProps) => {
  const [, rest] = splitProps(props, ['class', 'variant'])
  return <div role="alert" class={cn(alertVariants({ variant: props.variant }), props.class)} {...rest} />
}

export type AlertTitleProps = ComponentProps<'h5'>

export const AlertTitle = (props: AlertTitleProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <h5 class={cn('mb-1 font-medium leading-none tracking-tight', props.class)} {...rest} />
}

export type AlertDescriptionProps = ComponentProps<'div'>

export const AlertDescription = (props: AlertDescriptionProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('text-xs leading-relaxed opacity-95', props.class)} {...rest} />
}
