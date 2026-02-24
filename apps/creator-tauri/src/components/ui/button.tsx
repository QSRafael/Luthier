import type { ComponentProps, ValidComponent } from 'solid-js'
import { splitProps } from 'solid-js'
import { Root as ButtonPrimitive } from '@kobalte/core/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/cva'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-[invalid]:ring-destructive/20 aria-[invalid]:border-destructive',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3',
        lg: 'h-10 rounded-md px-6'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export type ButtonProps<T extends ValidComponent = 'button'> = ComponentProps<
  typeof ButtonPrimitive<T>
> &
  VariantProps<typeof buttonVariants>

export const Button = <T extends ValidComponent = 'button'>(props: ButtonProps<T>) => {
  const [, rest] = splitProps(props as ButtonProps, ['class', 'variant', 'size'])

  return (
    <ButtonPrimitive
      class={cn(
        buttonVariants({
          variant: props.variant,
          size: props.size
        }),
        props.class
      )}
      {...rest}
    />
  )
}
