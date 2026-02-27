import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { IconPlus } from '@tabler/icons-solidjs'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

type FormListDialogProps = {
  triggerLabel: JSX.Element
  triggerDisabled?: boolean
  title: JSX.Element
  description: JSX.Element
  cancelLabel: JSX.Element
  confirmLabel: JSX.Element
  confirmDisabled?: boolean
  onConfirm: () => boolean
  children: (actions: { confirm: () => void }) => JSX.Element
}

export function FormListDialog(props: FormListDialogProps) {
  const [open, setOpen] = createSignal(false)

  const close = () => {
    setOpen(false)
  }

  const confirm = () => {
    if (props.onConfirm()) {
      close()
    }
  }

  return (
    <Dialog open={open()} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="inline-flex items-center gap-1.5"
        onClick={() => setOpen(true)}
        disabled={props.triggerDisabled}
      >
        <IconPlus class="size-4" />
        {props.triggerLabel}
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>

        {props.children({ confirm })}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {props.cancelLabel}
          </Button>
          <Button type="button" onClick={confirm} disabled={props.confirmDisabled}>
            {props.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
