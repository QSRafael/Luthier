/**
 * application/ports.ts
 *
 * Port/contract definitions for the `luthier` application layer.
 *
 * A "port" is an interface (or type of function) that the application layer
 * depends on but does not implement.  Infrastructure adapters in
 * `infrastructure/` implement these ports; presentation code wires them up.
 *
 * Rules (FRONTEND_ARCHITECTURE.md §Application layer):
 *   - No `solid-js` imports.
 *   - No JSX.
 *   - No `solid-sonner` imports.
 *   - No direct import from `../../api/tauri`.
 *   - No UI component imports.
 */

import type {
    ExtractExecutableIconOutput,
    HashExecutableOutput,
    ImportRegistryFileOutput,
    ListChildDirectoriesOutput,
    ListDirectoryEntriesOutput,
    PrepareHeroImageOutput,
    SearchHeroImageOutput,
    WinetricksAvailableOutput
} from './types'

// ---------------------------------------------------------------------------
// Backend command port
// ---------------------------------------------------------------------------

/**
 * Options accepted by file-picker commands.
 * Mirrors the subset of `OpenDialogOptions` that the feature actually uses so
 * the port remains decoupled from the Tauri dialog API.
 */
export type PickFileOptions = {
    /** Dialog window title. */
    title?: string
    /**
     * File-extension filters.  Each entry groups a label and a list of
     * extensions (without leading dot, e.g. `["exe", "bat"]`).
     */
    filters?: Array<{ name: string; extensions: string[] }>
    /** Initial directory opened by the picker. */
    defaultPath?: string
}

export type PickFolderOptions = {
    title?: string
    defaultPath?: string
}

/**
 * Port: backend command adapter.
 *
 * Every method corresponds to a Tauri command (or a browser-safe fallback).
 * The application layer never calls `invokeCommand` directly — it uses this
 * port, which the infrastructure adapter implements.
 */
export type BackendCommandPort = {
    /**
     * Compute the SHA-256 hash of the given executable file.
     * Maps to Tauri command `cmd_hash_executable`.
     */
    hashExecutable(executablePath: string): Promise<HashExecutableOutput>

    /**
     * Extract the icon embedded in a Windows PE executable.
     * Maps to Tauri command `cmd_extract_executable_icon`.
     */
    extractExecutableIcon(executablePath: string): Promise<ExtractExecutableIconOutput>

    /**
     * Search for a hero/cover image for a game by name.
     * Maps to Tauri command `cmd_search_hero_image`.
     */
    searchHeroImage(gameName: string): Promise<SearchHeroImageOutput>

    /**
     * Fetch and process a hero image URL into an inlineable data URL.
     * Maps to Tauri command `cmd_prepare_hero_image`.
     */
    prepareHeroImage(imageUrl: string): Promise<PrepareHeroImageOutput>

    /**
     * Retrieve the list of available Winetricks verbs.
     * Maps to Tauri command `cmd_winetricks_available`.
     */
    winetricksAvailable(): Promise<WinetricksAvailableOutput>

    /**
     * Validate a `GameConfig` JSON payload against the game root path.
     * Maps to Tauri command `cmd_test_configuration`.
     * Returns the raw backend result (caller serializes to JSON for display).
     */
    testConfiguration(configJson: string, gameRoot: string): Promise<unknown>

    /**
     * Create the self-contained launcher executable from a `GameConfig` payload.
     * Maps to Tauri command `cmd_create_executable`.
     * Returns the raw backend result (caller serializes to JSON for display).
     */
    createExecutable(params: CreateExecutableParams): Promise<unknown>

    /**
     * Parse a Windows registry `.reg` file and return decoded entries/warnings.
     * Maps to Tauri command `cmd_import_registry_file`.
     */
    importRegistryFile(path: string): Promise<ImportRegistryFileOutput>

    /**
     * List only child directories of the given absolute path.
     * Maps to Tauri command `cmd_list_child_directories`.
     */
    listChildDirectories(path: string): Promise<ListChildDirectoriesOutput>

    /**
     * List child directories and files of the given absolute path.
     * Maps to Tauri command `cmd_list_directory_entries`.
     */
    listDirectoryEntries(path: string): Promise<ListDirectoryEntriesOutput>

    /**
     * Open a native file-picker dialog and return the selected path, or `null`
     * if the user cancelled.
     */
    pickFile(options?: PickFileOptions): Promise<string | null>

    /**
     * Open a native folder-picker dialog and return the selected path, or
     * `null` if the user cancelled.
     */
    pickFolder(options?: PickFolderOptions): Promise<string | null>
}

/**
 * Parameters for `BackendCommandPort.createExecutable`.
 */
export type CreateExecutableParams = {
    /** Absolute path to the orchestrator base binary used as template. */
    baseBinaryPath: string
    /** Target output path (without extension) for the generated binary. */
    outputPath: string
    /** Serialized `GameConfig` JSON string. */
    configJson: string
    /** Whether to rename an existing file instead of overwriting it. */
    backupExisting: boolean
    /** Whether to set the executable bit on the output file. */
    makeExecutable: boolean
    /**
     * Base-64 PNG data URL for the application icon, or `null` to skip icon
     * embedding.
     */
    iconPngDataUrl: string | null
}

// ---------------------------------------------------------------------------
// Notifier port
// ---------------------------------------------------------------------------

/**
 * Options for a notification that includes a single action button.
 */
export type NotificationAction = {
    /** Label shown on the action button (e.g. `"Desfazer"` / `"Undo"`). */
    label: string
    /** Callback invoked when the user clicks the action button. */
    onClick: () => void
}

/**
 * Options for `NotifierPort.notify`.
 */
export type NotifyOptions = {
    /** Visual tone for the notification. Defaults to `"info"`. */
    tone?: 'info' | 'success' | 'error'
    /** Short secondary text shown below the main message. */
    description?: string
    /** Optional action button. */
    action?: NotificationAction
}

/**
 * Port: notification/toast adapter.
 *
 * The application layer calls this port to show transient notifications.
 * The infrastructure adapter (`sonner-notifier.ts`) implements it using
 * `solid-sonner`'s `toast` function; in tests it can be a no-op stub.
 */
export type NotifierPort = {
    /**
     * Display a transient notification message.
     *
     * @param message - The main notification text.
     * @param options - Optional description and/or action button.
     */
    notify(message: string, options?: NotifyOptions): void
}

// ---------------------------------------------------------------------------
// Local persistence port (lightweight KV store)
// ---------------------------------------------------------------------------

/**
 * Port: local key-value storage adapter.
 *
 * Used for persisting simple user preferences that survive page reloads.
 * The default infrastructure adapter wraps `localStorage`; tests can use an
 * in-memory map.
 */
export type LocalStoragePort = {
    /**
     * Retrieve a stored string value by key, or `null` if absent.
     */
    getItem(key: string): string | null

    /**
     * Persist a string value under the given key.
     */
    setItem(key: string, value: string): void

    /**
     * Remove the stored value for the given key.
     * A no-op if the key does not exist.
     */
    removeItem(key: string): void
}

// ---------------------------------------------------------------------------
// Clipboard port (optional, for future copy-to-clipboard actions)
// ---------------------------------------------------------------------------

/**
 * Port: clipboard adapter.
 *
 * Decouples the application layer from the browser clipboard API.
 * The infrastructure adapter calls `navigator.clipboard.writeText`; tests can
 * stub it without browser globals.
 */
export type ClipboardPort = {
    /**
     * Write a plain-text string to the system clipboard.
     * Returns a promise that resolves when the write completes.
     */
    writeText(text: string): Promise<void>
}
