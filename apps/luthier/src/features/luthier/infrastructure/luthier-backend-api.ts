/**
 * infrastructure/luthier-backend-api.ts
 *
 * Infrastructure adapter implementing `BackendCommandPort`.
 *
 * Delegates to `invokeCommand`, `pickFile`, and `pickFolder` from
 * `apps/luthier/src/api/tauri.ts`.  That module already handles the
 * Tauri-vs-browser runtime split, so this adapter has no conditional logic of
 * its own.
 *
 * Rules:
 *   - No `solid-js` imports.
 *   - No UI component imports.
 *   - May import from `../../api/tauri` (infrastructure-layer privilege).
 *   - Must satisfy the `BackendCommandPort` type from `application/ports.ts`.
 */

import { invokeCommand, pickFile as tauriPickFile, pickFolder as tauriPickFolder } from '../../../api/tauri'
import type {
    BackendCommandPort,
    CreateExecutableParams,
    ImportRegistryOutput,
    PickFileOptions,
    PickFolderOptions
} from '../application/ports'
import type {
    ExtractExecutableIconOutput,
    HashExecutableOutput,
    PrepareHeroImageOutput,
    SearchHeroImageOutput,
    WinetricksAvailableOutput
} from '../application/types'

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

/**
 * Concrete implementation of `BackendCommandPort` backed by the Tauri IPC
 * layer (with browser-safe fallback provided by `api/tauri.ts`).
 *
 * Usage:
 * ```ts
 * import { luthierBackendApi } from './infrastructure/luthier-backend-api'
 * // Pass as a port to use-cases or the controller.
 * ```
 */
export const luthierBackendApi: BackendCommandPort = {
    // -------------------------------------------------------------------------
    // Executable hashing
    // -------------------------------------------------------------------------

    async hashExecutable(executablePath: string): Promise<HashExecutableOutput> {
        return invokeCommand<HashExecutableOutput>('cmd_hash_executable', {
            executable_path: executablePath
        })
    },

    // -------------------------------------------------------------------------
    // Icon extraction
    // -------------------------------------------------------------------------

    async extractExecutableIcon(executablePath: string): Promise<ExtractExecutableIconOutput> {
        return invokeCommand<ExtractExecutableIconOutput>('cmd_extract_executable_icon', {
            executable_path: executablePath
        })
    },

    // -------------------------------------------------------------------------
    // Hero image search & prepare
    // -------------------------------------------------------------------------

    async searchHeroImage(gameName: string): Promise<SearchHeroImageOutput> {
        return invokeCommand<SearchHeroImageOutput>('cmd_search_hero_image', {
            game_name: gameName
        })
    },

    async prepareHeroImage(imageUrl: string): Promise<PrepareHeroImageOutput> {
        return invokeCommand<PrepareHeroImageOutput>('cmd_prepare_hero_image', {
            image_url: imageUrl
        })
    },

    // -------------------------------------------------------------------------
    // Winetricks
    // -------------------------------------------------------------------------

    async winetricksAvailable(): Promise<WinetricksAvailableOutput> {
        return invokeCommand<WinetricksAvailableOutput>('cmd_winetricks_available')
    },

    // -------------------------------------------------------------------------
    // Build / test
    // -------------------------------------------------------------------------

    async testConfiguration(configJson: string, gameRoot: string): Promise<unknown> {
        return invokeCommand<unknown>('cmd_test_configuration', {
            config_json: configJson,
            game_root: gameRoot
        })
    },

    async createExecutable(params: CreateExecutableParams): Promise<unknown> {
        return invokeCommand<unknown>('cmd_create_executable', {
            base_binary_path: params.baseBinaryPath,
            output_path: params.outputPath,
            config_json: params.configJson,
            backup_existing: params.backupExisting,
            make_executable: params.makeExecutable,
            icon_png_data_url: params.iconPngDataUrl
        })
    },

    // -------------------------------------------------------------------------
    // Registry import
    // -------------------------------------------------------------------------

    async importRegistry(registryFilePath: string): Promise<ImportRegistryOutput> {
        return invokeCommand<ImportRegistryOutput>('cmd_import_registry', {
            registry_file_path: registryFilePath
        })
    },

    // -------------------------------------------------------------------------
    // File / folder pickers
    // -------------------------------------------------------------------------

    async pickFile(options?: PickFileOptions): Promise<string | null> {
        return tauriPickFile({
            title: options?.title,
            defaultPath: options?.defaultPath,
            filters: options?.filters?.map((f) => ({
                name: f.name,
                extensions: f.extensions
            }))
        })
    },

    async pickFolder(options?: PickFolderOptions): Promise<string | null> {
        return tauriPickFolder({
            title: options?.title,
            defaultPath: options?.defaultPath
        })
    }
}
