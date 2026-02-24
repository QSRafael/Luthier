import type { ComponentProps, ValidComponent } from 'solid-js'
import { splitProps } from 'solid-js'
import { Dialog as DialogPrimitive } from '@kobalte/core/dialog'

import { cn } from '../../lib/cva'

export type DialogProps<T extends ValidComponent = 'div'> = ComponentProps<typeof DialogPrimitive<T>>
export const Dialog = <T extends ValidComponent = 'div'>(props: DialogProps<T>) => {
  return <DialogPrimitive {...props} />
}

export type DialogTriggerProps<T extends ValidComponent = 'button'> = ComponentProps<
  typeof DialogPrimitive.Trigger<T>
>
export const DialogTrigger = <T extends ValidComponent = 'button'>(props: DialogTriggerProps<T>) => {
  return <DialogPrimitive.Trigger {...props} />
}

export type DialogPortalProps = ComponentProps<typeof DialogPrimitive.Portal>
export const DialogPortal = (props: DialogPortalProps) => {
  return <DialogPrimitive.Portal {...props} />
}

export type DialogOverlayProps<T extends ValidComponent = 'div'> = ComponentProps<
  typeof DialogPrimitive.Overlay<T>
>
export const DialogOverlay = <T extends ValidComponent = 'div'>(props: DialogOverlayProps<T>) => {
  const [, rest] = splitProps(props as DialogOverlayProps, ['class'])
  return (
    <DialogPrimitive.Overlay
      class={cn('fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px]', props.class)}
      {...rest}
    />
  )
}

export type DialogContentProps<T extends ValidComponent = 'div'> = ComponentProps<
  typeof DialogPrimitive.Content<T>
> & {
  showCloseButton?: boolean
}

export const DialogContent = <T extends ValidComponent = 'div'>(props: DialogContentProps<T>) => {
  const [, rest] = splitProps(props as DialogContentProps, ['class', 'children'])
  return (
    <DialogPortal>
      <DialogOverlay />
      <div class="fixed inset-0 z-50 grid place-items-center p-4">
        <DialogPrimitive.Content
          class={cn(
            'w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl',
            'max-h-[88vh] overflow-auto',
            props.class
          )}
          {...rest}
        >
          {props.children}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  )
}

export type DialogHeaderProps = ComponentProps<'div'>
export const DialogHeader = (props: DialogHeaderProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('mb-4 space-y-1', props.class)} {...rest} />
}

export type DialogTitleProps<T extends ValidComponent = 'h2'> = ComponentProps<typeof DialogPrimitive.Title<T>>
export const DialogTitle = <T extends ValidComponent = 'h2'>(props: DialogTitleProps<T>) => {
  const [, rest] = splitProps(props as DialogTitleProps, ['class'])
  return <DialogPrimitive.Title class={cn('text-base font-semibold', props.class)} {...rest} />
}

export type DialogDescriptionProps<T extends ValidComponent = 'p'> = ComponentProps<
  typeof DialogPrimitive.Description<T>
>
export const DialogDescription = <T extends ValidComponent = 'p'>(props: DialogDescriptionProps<T>) => {
  const [, rest] = splitProps(props as DialogDescriptionProps, ['class'])
  return <DialogPrimitive.Description class={cn('text-sm text-muted-foreground', props.class)} {...rest} />
}

export type DialogFooterProps = ComponentProps<'div'>
export const DialogFooter = (props: DialogFooterProps) => {
  const [, rest] = splitProps(props, ['class'])
  return <div class={cn('mt-4 flex flex-wrap justify-end gap-2', props.class)} {...rest} />
}

export type DialogCloseProps<T extends ValidComponent = 'button'> = ComponentProps<typeof DialogPrimitive.CloseButton<T>>
export const DialogClose = <T extends ValidComponent = 'button'>(props: DialogCloseProps<T>) => {
  return <DialogPrimitive.CloseButton {...props} />
}
