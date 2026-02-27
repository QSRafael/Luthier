/**
 * infrastructure/sonner-notifier.ts
 *
 * Infrastructure adapter implementing `NotifierPort` using `solid-sonner`.
 *
 * Rules:
 *   - May import `toast` from `solid-sonner`.
 *   - Must satisfy the `NotifierPort` interface from `application/ports.ts`.
 *   - Must not export any UI components or Solid state signals directly.
 */

import { toast } from 'solid-sonner'
import type { NotifierPort, NotifyOptions } from '../application/ports'

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

/**
 * Concrete implementation of `NotifierPort` backed by `solid-sonner`.
 *
 * Usage:
 * ```ts
 * import { sonnerNotifier } from './infrastructure/sonner-notifier'
 * // Pass as a port to use-cases or the controller.
 * ```
 */
export const sonnerNotifier: NotifierPort = {
    notify(message: string, options?: NotifyOptions): void {
        const tone = options?.tone ?? 'info'
        const emit =
            tone === 'error'
                ? toast.error
                : tone === 'success'
                  ? toast.success
                  : toast.info

        if (!options) {
            emit(message)
            return
        }

        const toastOptions: Parameters<typeof toast>[1] = {}

        if (options.description) {
            toastOptions.description = options.description
        }

        if (options.action) {
            toastOptions.action = {
                label: options.action.label,
                onClick: options.action.onClick
            }
        }

        emit(message, toastOptions)
    }
}
