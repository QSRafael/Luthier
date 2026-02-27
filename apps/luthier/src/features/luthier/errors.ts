/**
 * errors.ts
 *
 * Centralized error types and normalization helpers for the `luthier` feature.
 *
 * Rules (enforced by architecture — FRONTEND_ARCHITECTURE.md Phase F1):
 *   - No `solid-js` imports.
 *   - No `solid-sonner` imports.
 *   - No UI component imports.
 *   - No imports from `../../api/tauri`.
 *   - Pure TypeScript only — safe to use in domain or application layers.
 */

// ---------------------------------------------------------------------------
// Error kind taxonomy
// ---------------------------------------------------------------------------

/**
 * Discriminated union of the known error kinds that can originate from the
 * luthier feature's backend operations.
 *
 * `"tauri_invoke"` — an error thrown by a Tauri IPC command invocation.
 * `"validation"`   — a frontend validation check that blocked an action.
 * `"picker"`       — a file/folder picker operation failed or was cancelled.
 * `"unknown"`      — any other caught value that does not match above.
 */
export type LuthierErrorKind =
    | 'tauri_invoke'
    | 'validation'
    | 'picker'
    | 'unknown'

// ---------------------------------------------------------------------------
// Structured error envelope
// ---------------------------------------------------------------------------

/**
 * Normalized, UI-ready error value produced by `normalizeLuthierError`.
 * All fields are plain strings so they can be stored in signals or passed
 * to any notification layer without coupling to a specific UI library.
 */
export type LuthierError = {
    /** Discriminant — identifies the origin/classification of the error. */
    readonly kind: LuthierErrorKind

    /**
     * Short human-readable message suitable for a status bar or toast title.
     * Always non-empty after normalization.
     */
    readonly message: string

    /**
     * Optional extended detail, e.g. the raw Tauri error string or stack trace
     * fragment. May be empty when not available.
     */
    readonly detail: string

    /**
     * The raw caught value preserved as-is for logging or debugging.
     * Typed as `unknown` to reflect that `catch (e)` carries unknown values.
     */
    readonly raw: unknown
}

// ---------------------------------------------------------------------------
// Operation result type
// ---------------------------------------------------------------------------

/**
 * Discriminated result type for async operations in the luthier application
 * layer.  Controllers and use-cases should return this instead of throwing,
 * keeping error handling uniform and explicit.
 *
 * ```ts
 * const result = await someOperation()
 * if (!result.ok) {
 *   setStatusMessage(result.error.message)
 *   return
 * }
 * doSomethingWith(result.value)
 * ```
 */
export type LuthierResult<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: LuthierError }

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/**
 * Converts any caught `unknown` value into a `LuthierError` with a
 * `"tauri_invoke"` kind.
 *
 * Tauri serializes backend errors as strings inside the rejection, so
 * `String(error)` reliably captures the full error description.
 *
 * @param error - The value caught in a `catch` block.
 * @returns A normalized `LuthierError`.
 */
export function normalizeTauriError(error: unknown): LuthierError {
    return {
        kind: 'tauri_invoke',
        message: extractMessage(error),
        detail: String(error),
        raw: error
    }
}

/**
 * Wraps a frontend validation failure into a `LuthierError`.
 *
 * @param message - The validation message to surface (already localized by
 *   the caller — this layer does not own i18n).
 * @returns A normalized `LuthierError` with kind `"validation"`.
 */
export function makeValidationError(message: string): LuthierError {
    return {
        kind: 'validation',
        message,
        detail: '',
        raw: null
    }
}

/**
 * Wraps any unknown caught value into a generic `LuthierError`.
 *
 * Use this as the catch-all when the operation kind is not precisely known.
 *
 * @param error - The value caught in a `catch` block.
 * @returns A normalized `LuthierError` with kind `"unknown"`.
 */
export function normalizeLuthierError(error: unknown): LuthierError {
    return {
        kind: 'unknown',
        message: extractMessage(error),
        detail: String(error),
        raw: error
    }
}

// ---------------------------------------------------------------------------
// Result constructors
// ---------------------------------------------------------------------------

/**
 * Creates a successful `LuthierResult<T>`.
 *
 * @param value - The successful operation output.
 */
export function ok<T>(value: T): LuthierResult<T> {
    return { ok: true, value }
}

/**
 * Creates a failed `LuthierResult<T>` from a pre-built `LuthierError`.
 *
 * @param error - The normalized error.
 */
export function err<T>(error: LuthierError): LuthierResult<T> {
    return { ok: false, error }
}

/**
 * Creates a failed `LuthierResult<T>` from any caught unknown value,
 * normalizing it with kind `"tauri_invoke"`.
 *
 * Convenience shorthand for the common pattern:
 * ```ts
 * } catch (e) {
 *   return errFromTauri(e)
 * }
 * ```
 */
export function errFromTauri<T>(error: unknown): LuthierResult<T> {
    return { ok: false, error: normalizeTauriError(error) }
}

// ---------------------------------------------------------------------------
// Status-message formatting helpers
// ---------------------------------------------------------------------------

/**
 * Returns the `message` from a `LuthierError`, optionally prefixed by a
 * context label.
 *
 * This is the primary helper for converting an error into a status-bar string
 * without importing any UI primitives.
 *
 * @param error   - The normalized error.
 * @param prefix  - Optional label to prepend (e.g. `"Hash:"`, `"Ícone:"`).
 * @returns A plain string ready for use as `statusMessage`.
 */
export function errorToStatusMessage(error: LuthierError, prefix?: string): string {
    const base = error.message
    return prefix ? `${prefix} ${base}` : base
}

// ---------------------------------------------------------------------------
// Internal utility
// ---------------------------------------------------------------------------

/**
 * Extracts a human-readable message from any caught value.
 *
 * Priority:
 *   1. `error.message` (string) if the value is an Error-like object.
 *   2. `String(error)` otherwise.
 *
 * Tauri errors are typically plain strings, so `String(error)` handles them
 * correctly.  JS `Error` objects have a `message` property that is preferred
 * because `String(error)` would produce `"Error: ..."` with the prefix.
 */
function extractMessage(error: unknown): string {
    if (
        error !== null &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
    ) {
        return (error as { message: string }).message
    }
    return String(error)
}
