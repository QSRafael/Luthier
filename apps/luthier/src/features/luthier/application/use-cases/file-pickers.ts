/**
 * application/use-cases/file-pickers.ts
 *
 * File-picker orchestration for the application layer.
 * This module owns selection normalization and relative-path rules.
 */

import type { BackendCommandPort } from '../ports'

type FilePickersStateSnapshot = {
    exePath: string
    gameRoot: string
}

export type FilePickersStatePort = {
    readState: () => FilePickersStateSnapshot
    setExePath: (value: string) => void
    setLastHashedExePath: (value: string) => void
    setIconPreviewPath: (value: string) => void
    setExeHash: (value: string) => void
    setGameRootManualOverride: (value: boolean) => void
    setGameRoot: (value: string) => void
    setRelativeExePath: (value: string) => void
    setRegistryImportPath: (value: string) => void
    setMountSourceRelativePath: (index: number, value: string) => void
}

export type FilePickersMessages = {
    selectGameExecutable: string
    selectRegFile: string
    selectGameRootFolder: string
    selectRequiredFile: string
    selectFolderToMount: string
}

export type FilePickersUseCaseDeps = {
    backend: BackendCommandPort
    state: FilePickersStatePort
    messages: FilePickersMessages
}

function normalizePath(raw: string): string {
    return raw.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

function dirname(raw: string): string {
    const normalized = normalizePath(raw)
    const index = normalized.lastIndexOf('/')
    if (index <= 0) return normalized
    return normalized.slice(0, index)
}

function basename(raw: string): string {
    const normalized = normalizePath(raw)
    const index = normalized.lastIndexOf('/')
    if (index < 0) return normalized
    return normalized.slice(index + 1)
}

function relativeFromRoot(root: string, path: string): string | null {
    const normalizedRoot = normalizePath(root)
    const normalizedPath = normalizePath(path)

    if (!normalizedRoot || !normalizedPath) return null
    if (normalizedPath === normalizedRoot) return '.'
    if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
        return normalizedPath.slice(normalizedRoot.length + 1)
    }

    return null
}

function isLikelyAbsolutePath(path: string): boolean {
    const trimmed = path.trim()
    return trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)
}

function hasWindowsLauncherExtension(path: string): boolean {
    const lower = basename(path).toLowerCase()
    return ['.exe', '.bat', '.cmd', '.com'].some((ext) => lower.endsWith(ext))
}

function resolveExecutablePickerDefaultPath(snapshot: FilePickersStateSnapshot): string | undefined {
    const exe = snapshot.exePath.trim()
    if (isLikelyAbsolutePath(exe)) return dirname(exe)

    const root = snapshot.gameRoot.trim()
    if (isLikelyAbsolutePath(root)) return root

    return undefined
}

export function createFilePickersUseCase({ backend, state, messages }: FilePickersUseCaseDeps) {
    const pickExecutable = async () => {
        const selected = await backend.pickFile({
            title: messages.selectGameExecutable,
            filters: [{ name: 'Windows Launchers', extensions: ['exe', 'bat', 'cmd', 'com'] }],
            defaultPath: resolveExecutablePickerDefaultPath(state.readState())
        })
        if (!selected) return

        if (!hasWindowsLauncherExtension(selected)) return

        state.setExePath(selected)
        state.setLastHashedExePath('')
        state.setIconPreviewPath('')
        state.setExeHash('')

        const detectedRoot = dirname(selected)
        state.setGameRootManualOverride(false)
        state.setGameRoot(detectedRoot)

        const relative = relativeFromRoot(detectedRoot, selected)
        state.setRelativeExePath(relative ? `./${relative}` : `./${basename(selected)}`)
    }

    const pickRegistryFile = async () => {
        const selected = await backend.pickFile({
            title: messages.selectRegFile,
            filters: [{ name: 'Registry file', extensions: ['reg'] }]
        })
        if (!selected) return null

        state.setRegistryImportPath(selected)
        return selected
    }

    const pickGameRootOverride = async () => {
        const currentBeforePick = state.readState()
        const exeDirectory = dirname(currentBeforePick.exePath.trim())
        const selected = await backend.pickFolder({
            title: messages.selectGameRootFolder,
            defaultPath: isLikelyAbsolutePath(exeDirectory) ? exeDirectory : undefined
        })
        if (!selected) return

        const currentExe = state.readState().exePath.trim()
        if (currentExe && relativeFromRoot(selected, currentExe) === null) return

        state.setGameRootManualOverride(true)
        state.setGameRoot(selected)
    }

    const pickIntegrityFileRelative = async () => {
        const selected = await backend.pickFile({
            title: messages.selectRequiredFile,
            defaultPath: state.readState().gameRoot || undefined
        })
        if (!selected) return null

        // Browser fallback may return only a file name; accept as relative input.
        if (!selected.includes('/') && !selected.includes('\\')) {
            return `./${basename(selected)}`
        }

        const relative = relativeFromRoot(state.readState().gameRoot, selected)
        if (!relative) return null

        return `./${relative}`
    }

    const pickMountFolder = async (index: number) => {
        const selected = await backend.pickFolder({
            title: messages.selectFolderToMount
        })
        if (!selected) return

        const relative = relativeFromRoot(state.readState().gameRoot, selected)
        if (!relative) return

        state.setMountSourceRelativePath(index, relative)
    }

    const pickMountSourceRelative = async () => {
        const selected = await backend.pickFolder({
            title: messages.selectFolderToMount
        })
        if (!selected) return null

        const relative = relativeFromRoot(state.readState().gameRoot, selected)
        if (!relative) return null

        return relative
    }

    return {
        pickExecutable,
        pickRegistryFile,
        pickGameRootOverride,
        pickIntegrityFileRelative,
        pickMountFolder,
        pickMountSourceRelative
    }
}
