/**
 * controller-file-actions.ts
 *
 * Actions for handling file system picking (executables, folders, registry, icons).
 */

import { pickFile, pickFolder } from '../../api/tauri'
import {
    basename,
    dirname,
    hasWindowsLauncherExtension,
    isLikelyAbsolutePath,
    relativeFromRoot,
    replaceAt
} from './controller-utils'
import type { createLuthierState } from './controller-state'
import type { createLuthierComputed } from './controller-computed'
import type { ExtractExecutableIconOutput } from '../../api/tauri'

export function createLuthierFileActions(
    state: ReturnType<typeof createLuthierState>,
    computed: ReturnType<typeof createLuthierComputed>,
    invokeCommand: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>,
    ct: (key: any) => string,
    ctf: (key: any, params: any) => string,
    setStatusMessage: (msg: string) => void
) {
    const pickExecutable = async () => {
        const defaultPathCandidate = (() => {
            const exe = state.exePath().trim()
            if (isLikelyAbsolutePath(exe)) return dirname(exe)
            const root = state.gameRoot().trim()
            if (isLikelyAbsolutePath(root)) return root
            return undefined
        })()

        const selected = await pickFile({
            title: ct('luthier_select_game_executable'),
            filters: [{ name: 'Windows Launchers', extensions: ['exe', 'bat', 'cmd', 'com'] }],
            defaultPath: defaultPathCandidate
        })
        if (!selected) return

        if (!hasWindowsLauncherExtension(selected)) {
            return
        }

        state.setExePath(selected)
        state.setLastHashedExePath('')
        state.setIconPreviewPath('')
        state.patchConfig((prev) => ({ ...prev, exe_hash: '' }))

        const detectedRoot = dirname(selected)
        state.setGameRootManualOverride(false)
        state.setGameRoot(detectedRoot)

        const relative = relativeFromRoot(detectedRoot, selected)

        state.patchConfig((prev) => ({
            ...prev,
            relative_exe_path: relative ? `./${relative}` : `./${basename(selected)}`
        }))
    }

    const pickRegistryFile = async () => {
        const selected = await pickFile({
            title: ct('luthier_select_reg_file'),
            filters: [{ name: 'Registry file', extensions: ['reg'] }]
        })
        if (!selected) return null
        state.setRegistryImportPath(selected)
        return selected
    }

    const pickGameRootOverride = async () => {
        const selected = await pickFolder({
            title: ct('luthier_select_game_root_folder'),
            defaultPath: (isLikelyAbsolutePath(computed.exeDirectory()) ? computed.exeDirectory() : undefined) ?? undefined
        })
        if (!selected) return

        const currentExe = state.exePath().trim()
        if (currentExe && relativeFromRoot(selected, currentExe) === null) {
            return
        }

        state.setGameRootManualOverride(true)
        state.setGameRoot(selected)
    }

    const pickIntegrityFileRelative = async () => {
        const selected = await pickFile({
            title: ct('luthier_select_required_file'),
            defaultPath: state.gameRoot() || undefined
        })
        if (!selected) return null

        // Browser fallback may return only a file name; accept as relative input.
        if (!selected.includes('/') && !selected.includes('\\')) {
            return `./${basename(selected)}`
        }

        const relative = relativeFromRoot(state.gameRoot(), selected)
        if (!relative) {
            return null
        }

        return `./${relative}`
    }

    const pickMountFolder = async (index: number) => {
        const selected = await pickFolder({
            title: ct('luthier_select_folder_to_mount')
        })
        if (!selected) return

        const relative = relativeFromRoot(state.gameRoot(), selected)
        if (!relative) {
            return
        }

        state.patchConfig((prev) => ({
            ...prev,
            folder_mounts: replaceAt(prev.folder_mounts, index, {
                ...prev.folder_mounts[index],
                source_relative_path: relative
            })
        }))
    }

    const pickMountSourceRelative = async () => {
        const selected = await pickFolder({
            title: ct('luthier_select_folder_to_mount')
        })
        if (!selected) return null

        const relative = relativeFromRoot(state.gameRoot(), selected)
        if (!relative) {
            return null
        }

        return relative
    }

    const extractExecutableIcon = async () => {
        const currentExe = state.exePath().trim()
        if (!currentExe) {
            setStatusMessage(ct('luthier_select_an_executable_before_extracting_icon'))
            return
        }

        if (!isLikelyAbsolutePath(currentExe)) {
            setStatusMessage(
                ct('luthier_icon_extraction_requires_an_absolute_path_in_browser_lan_m')
            )
            return
        }

        try {
            state.setExtractingExecutableIcon(true)
            setStatusMessage(ct('luthier_extracting_icon_from_executable'))
            const result = await invokeCommand<ExtractExecutableIconOutput>('cmd_extract_executable_icon', {
                executable_path: currentExe
            })
            state.setIconPreviewPath(result.data_url)
            setStatusMessage(
                ctf('luthier_executable_icon_extracted_size', {
                    width: result.width,
                    height: result.height
                })
            )
        } catch (error) {
            setStatusMessage(ctf('luthier_failed_to_extract_executable_icon_error', { error: String(error) }))
        } finally {
            state.setExtractingExecutableIcon(false)
        }
    }

    return {
        pickExecutable,
        pickRegistryFile,
        pickGameRootOverride,
        pickIntegrityFileRelative,
        pickMountFolder,
        pickMountSourceRelative,
        extractExecutableIcon
    }
}
