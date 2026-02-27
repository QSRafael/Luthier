/**
 * application/use-cases/build-actions.ts
 *
 * Build/hash/test/create orchestration for the application layer.
 * This module owns operation flow and loading/status transitions.
 */

import type { BackendCommandPort } from '../ports'

type BuildActionsStateSnapshot = {
    exePath: string
    gameRoot: string
    configPreview: string
    outputPath: string
    iconPreviewPath: string
    createExecutableBlockedReason: string
    hashingExePath: string
}

export type BuildActionsStatePort = {
    readState: () => BuildActionsStateSnapshot
    setHashingExePath: (value: string) => void
    setLastHashedExePath: (value: string) => void
    setExeHash: (value: string) => void
    setTestingConfiguration: (value: boolean) => void
    setCreatingExecutable: (value: boolean) => void
    setResultJson: (value: string) => void
    setStatusMessage: (value: string) => void
}

export type BuildActionsMessages = {
    hashFail: string
    testOk: string
    testFail: string
    createOk: string
    createFail: string
}

export type BuildActionsUseCaseDeps = {
    backend: BackendCommandPort
    orchestratorBasePath: string
    state: BuildActionsStatePort
    messages: BuildActionsMessages
}

function isLikelyAbsolutePath(path: string): boolean {
    const trimmed = path.trim()
    return trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)
}

export function createBuildActionsUseCase({
    backend,
    orchestratorBasePath,
    state,
    messages
}: BuildActionsUseCaseDeps) {
    const hashExecutablePath = async (absoluteExePath: string) => {
        if (!absoluteExePath.trim()) return
        if (!isLikelyAbsolutePath(absoluteExePath)) return

        try {
            state.setHashingExePath(absoluteExePath)
            state.setLastHashedExePath(absoluteExePath)
            const result = await backend.hashExecutable(absoluteExePath)
            if (state.readState().exePath.trim() === absoluteExePath) {
                state.setExeHash(result.sha256_hex)
            }
        } catch (error) {
            state.setStatusMessage(`${messages.hashFail} ${String(error)}`)
        } finally {
            if (state.readState().hashingExePath === absoluteExePath) {
                state.setHashingExePath('')
            }
        }
    }

    const runHash = async () => {
        await hashExecutablePath(state.readState().exePath.trim())
    }

    const runTest = async () => {
        try {
            state.setTestingConfiguration(true)
            const snapshot = state.readState()
            const result = await backend.testConfiguration(snapshot.configPreview, snapshot.gameRoot)
            state.setResultJson(JSON.stringify(result, null, 2))
            state.setStatusMessage(messages.testOk)
        } catch (error) {
            state.setStatusMessage(`${messages.testFail} ${String(error)}`)
        } finally {
            state.setTestingConfiguration(false)
        }
    }

    const runCreate = async () => {
        const snapshot = state.readState()
        if (snapshot.createExecutableBlockedReason) {
            state.setStatusMessage(snapshot.createExecutableBlockedReason)
            return
        }

        try {
            state.setCreatingExecutable(true)
            const result = await backend.createExecutable({
                baseBinaryPath: orchestratorBasePath,
                outputPath: snapshot.outputPath,
                configJson: snapshot.configPreview,
                backupExisting: true,
                makeExecutable: true,
                iconPngDataUrl: snapshot.iconPreviewPath.trim() || null
            })
            state.setResultJson(JSON.stringify(result, null, 2))
            state.setStatusMessage(messages.createOk)
        } catch (error) {
            state.setStatusMessage(`${messages.createFail} ${String(error)}`)
        } finally {
            state.setCreatingExecutable(false)
        }
    }

    return {
        hashExecutablePath,
        runHash,
        runTest,
        runCreate
    }
}
