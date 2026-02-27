/**
 * application/types.ts
 *
 * Internal type contracts for the `luthier` application layer.
 *
 * Contains:
 *   - Response/output shapes for each Tauri command consumed by the feature.
 *   - Shared UI-state value types used across controller and application code.
 *
 * Rules (FRONTEND_ARCHITECTURE.md §Application layer):
 *   - No `solid-js` imports.
 *   - No JSX.
 *   - No `solid-sonner` imports.
 *   - No direct import from `api/tauri` (infrastructure layer concern).
 *   - No UI component imports.
 *
 * These types are currently defined inline inside `useLuthierController.ts`.
 * They are extracted here so application-layer modules (use-cases, ports) can
 * reference them without coupling to the controller or presentation layer.
 */

// ---------------------------------------------------------------------------
// Tauri command output shapes
// ---------------------------------------------------------------------------

/**
 * Output of the `cmd_winetricks_available` Tauri command.
 *
 * `source`     — where the catalog was loaded from (e.g. `"bundled"`,
 *                `"fallback"`, `"remote"`).
 * `components` — flat list of available Winetricks verbs.
 */
export type WinetricksAvailableOutput = {
  source: string
  components: string[]
}

/**
 * Output of the `cmd_extract_executable_icon` Tauri command.
 *
 * `data_url` — base-64 data URL of the extracted icon image.
 * `width`    — icon width in pixels.
 * `height`   — icon height in pixels.
 */
export type ExtractExecutableIconOutput = {
  data_url: string
  width: number
  height: number
}

/**
 * Output of the `cmd_search_hero_image` Tauri command.
 *
 * `source`               — origin of the result (API name / identifier).
 * `image_url`            — primary image URL selected by the backend.
 * `game_id`              — numeric game identifier when available; null
 *                          otherwise.
 * `candidate_image_urls` — additional alternative image URLs for cycling;
 *                          may be absent when only one candidate was found.
 */
export type SearchHeroImageOutput = {
  source: string
  image_url: string
  game_id?: number | null
  candidate_image_urls?: string[]
}

/**
 * Output of the `cmd_prepare_hero_image` Tauri command.
 *
 * `source_url`      — the URL that was fetched/processed (canonical form).
 * `data_url`        — base-64 data URL of the processed hero image.
 * `width`           — output image width in pixels (may differ from original
 *                     after backend resizing).
 * `height`          — output image height in pixels.
 * `original_width`  — width of the source image before processing.
 * `original_height` — height of the source image before processing.
 */
export type PrepareHeroImageOutput = {
  source_url: string
  data_url: string
  width: number
  height: number
  original_width: number
  original_height: number
}

/**
 * Output of the `cmd_hash_executable` Tauri command.
 *
 * `sha256_hex` — lowercase hex-encoded SHA-256 digest of the executable file.
 */
export type HashExecutableOutput = {
  sha256_hex: string
}

/**
 * A single registry entry decoded from a `.reg` file.
 */
export type RegistryImportEntry = {
  path: string
  name: string
  value_type: string
  value: string
}

/**
 * Output of the `cmd_import_registry_file` Tauri command.
 */
export type ImportRegistryFileOutput = {
  entries: RegistryImportEntry[]
  warnings: string[]
}

/**
 * Output of the `cmd_list_child_directories` Tauri command.
 */
export type ListChildDirectoriesOutput = {
  path: string
  directories: string[]
}

/**
 * Output of the `cmd_list_directory_entries` Tauri command.
 */
export type ListDirectoryEntriesOutput = {
  path: string
  directories: string[]
  files: string[]
}

// ---------------------------------------------------------------------------
// Shared UI-state value types
// ---------------------------------------------------------------------------

/**
 * Tone classification for the status-bar message used in the controller.
 *
 * `"info"`    — neutral informational state (default / ready).
 * `"success"` — a completed operation succeeded.
 * `"error"`   — a failed operation or a blocking validation error.
 */
export type StatusTone = 'info' | 'success' | 'error'

/**
 * Snapshot of the hero-image search state, used when the controller needs to
 * restore the previous image selection after an undo action.
 */
export type HeroImageSnapshot = {
  hero_image_url: string
  hero_image_data_url: string
  lastPreparedHeroImageUrl: string
  searchIndex: number
}
