/**
 * luthier-page-effects-registry-browser.ts
 *
 * Encapsulates registry import handlers and mini file/folder browser handlers
 * used by LuthierPage presentation effects.
 */

import type { useLuthierController } from './useLuthierController'
import type { createLuthierPageDialogState } from './page-dialog-state'
import { luthierBackendApi } from './infrastructure/luthier-backend-api'
import { sonnerNotifier } from './infrastructure/sonner-notifier'
import type {
    ImportRegistryFileOutput,
    ListChildDirectoriesOutput,
    ListDirectoryEntriesOutput
} from './application/types'
import { isLikelyAbsolutePath } from './page-shared'

export function createLuthierPageRegistryBrowserEffects(
    controller: ReturnType<typeof useLuthierController>,
    dialogState: ReturnType<typeof createLuthierPageDialogState>
) {
    const { config, patchConfig, gameRoot, ct, ctf } = controller
    const {
        setRegistryImportWarnings,
        setRegistryImportWarningsOpen,
        setMountBrowserLoading,
        setMountBrowserPath,
        setMountBrowserDirs,
        setIntegrityBrowserLoading,
        setIntegrityBrowserPath,
        setIntegrityBrowserDirs,
        setIntegrityBrowserFiles,
        integrityFileBrowserResolve,
        setIntegrityFileBrowserResolve,
        setIntegrityFileBrowserOpen,
        setMountSourceBrowserOpen
    } = dialogState

    const importRegistryKeysFromRegFile = async () => {
        try {
            const selected = await controller.pickRegistryFile()
            if (!selected) return

            if (!isLikelyAbsolutePath(selected)) {
                controller.setStatusMessage(
                    ct('luthier_importing_reg_requires_an_absolute_path_in_browser_lan_m')
                )
                return
            }

            const result: ImportRegistryFileOutput = await luthierBackendApi.importRegistryFile(selected)

            const existingKeys = new Set(
                config().registry_keys.map((item) =>
                    [item.path, item.name, item.value_type, item.value].join('\u0000')
                )
            )

            const deduped = result.entries.filter((item) => {
                const signature = [item.path, item.name, item.value_type, item.value].join('\u0000')
                if (existingKeys.has(signature)) return false
                existingKeys.add(signature)
                return true
            })

            if (deduped.length > 0) {
                patchConfig((prev) => ({
                    ...prev,
                    registry_keys: [...prev.registry_keys, ...deduped]
                }))
            }

            const warningSuffix =
                result.warnings.length > 0
                    ? ctf('luthier_registry_import_warning_suffix_count', { count: result.warnings.length })
                    : ''

            const successMessage = ctf('luthier_imported_registry_keys_from_reg_file', {
                count: deduped.length,
                warningSuffix
            })

            if (deduped.length > 0) {
                const importedSignatures = new Set(
                    deduped.map((item) => [item.path, item.name, item.value_type, item.value].join('\u0000'))
                )
                sonnerNotifier.notify(successMessage, {
                    description: selected,
                    action: {
                        label: ct('luthier_undo'),
                        onClick: () => {
                            patchConfig((prev) => ({
                                ...prev,
                                registry_keys: prev.registry_keys.filter((item) => {
                                    const signature = [item.path, item.name, item.value_type, item.value].join('\u0000')
                                    return !importedSignatures.has(signature)
                                })
                            }))
                            sonnerNotifier.notify(ct('luthier_registry_import_undone'))
                        }
                    }
                })
            } else {
                sonnerNotifier.notify(successMessage, { description: selected })
            }

            setRegistryImportWarnings(result.warnings)
            setRegistryImportWarningsOpen(result.warnings.length > 0)
        } catch (error) {
            controller.setStatusMessage(ctf('luthier_failed_to_import_reg_file_error', { error: String(error) }))
        }
    }

    const loadMountBrowserDirs = async (absolutePath: string) => {
        if (!isLikelyAbsolutePath(absolutePath)) {
            controller.setStatusMessage(
                ct('luthier_mounted_folder_browser_requires_an_absolute_game_root_pa')
            )
            return
        }
        setMountBrowserLoading(true)
        try {
            const result: ListChildDirectoriesOutput = await luthierBackendApi.listChildDirectories(absolutePath)
            setMountBrowserPath(result.path)
            setMountBrowserDirs(result.directories)
        } catch (error) {
            controller.setStatusMessage(ctf('luthier_failed_to_list_folders_error', { error: String(error) }))
        } finally {
            setMountBrowserLoading(false)
        }
    }

    const loadIntegrityBrowserEntries = async (absolutePath: string) => {
        if (!isLikelyAbsolutePath(absolutePath)) {
            controller.setStatusMessage(
                ct('luthier_required_file_browser_requires_an_absolute_game_root_pat')
            )
            return
        }
        setIntegrityBrowserLoading(true)
        try {
            const result: ListDirectoryEntriesOutput = await luthierBackendApi.listDirectoryEntries(absolutePath)
            setIntegrityBrowserPath(result.path)
            setIntegrityBrowserDirs(result.directories)
            setIntegrityBrowserFiles(result.files)
        } catch (error) {
            controller.setStatusMessage(ctf('luthier_failed_to_list_files_error', { error: String(error) }))
        } finally {
            setIntegrityBrowserLoading(false)
        }
    }

    const resolveIntegrityFileBrowser = (value: string | null) => {
        const resolver = integrityFileBrowserResolve()
        setIntegrityFileBrowserResolve(null)
        if (resolver) resolver(value)
    }

    const openIntegrityFileBrowser = async () => {
        const root = gameRoot().trim()
        if (!root) {
            controller.setStatusMessage(ct('luthier_select_an_executable_first_to_define_the_game_folder'))
            return null
        }
        if (!isLikelyAbsolutePath(root)) {
            controller.setStatusMessage(
                ct('luthier_in_browser_lan_mode_the_mini_file_browser_cannot_access_')
            )
            return null
        }

        await loadIntegrityBrowserEntries(root)
        setIntegrityFileBrowserOpen(true)

        return new Promise<string | null>((resolve) => {
            setIntegrityFileBrowserResolve(() => resolve)
        })
    }

    const openMountSourceBrowser = async () => {
        const root = gameRoot().trim()
        if (!root) {
            controller.setStatusMessage(ct('luthier_select_an_executable_first_to_define_the_game_folder'))
            return
        }
        if (!isLikelyAbsolutePath(root)) {
            controller.setStatusMessage(
                ct('luthier_in_browser_lan_mode_the_mini_folder_browser_cannot_acces')
            )
            return
        }
        await loadMountBrowserDirs(root)
        setMountSourceBrowserOpen(true)
    }

    return {
        importRegistryKeysFromRegFile,
        loadMountBrowserDirs,
        loadIntegrityBrowserEntries,
        resolveIntegrityFileBrowser,
        openIntegrityFileBrowser,
        openMountSourceBrowser
    }
}
