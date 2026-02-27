/**
 * controller-build-actions.ts
 *
 * Actions for hashing, testing, and creating the final executable wrapper.
 */

import { isLikelyAbsolutePath } from './controller-utils'
import type { createLuthierState } from './controller-state'
import type { createLuthierComputed } from './controller-computed'
import type { BackendCommandPort } from './application/ports'

export function createLuthierBuildActions(
    state: ReturnType<typeof createLuthierState>,
    computed: ReturnType<typeof createLuthierComputed>,
    backend: BackendCommandPort,
    ORCHESTRATOR_BASE_PATH: string,
    t: (key: string) => string,
    setStatusMessage: (msg: string) => void
) {
    async function hashExecutablePath(absoluteExePath: string) {
        if (!absoluteExePath.trim()) {
            return
        }

        if (!isLikelyAbsolutePath(absoluteExePath)) {
            return
        }

        try {
            state.setHashingExePath(absoluteExePath)
            state.setLastHashedExePath(absoluteExePath)
            const result = await backend.hashExecutable(absoluteExePath)
            if (state.exePath().trim() === absoluteExePath) {
                state.patchConfig((prev) => ({ ...prev, exe_hash: result.sha256_hex }))
            }
        } catch (error) {
            setStatusMessage(`${t('msgHashFail')} ${String(error)}`)
        } finally {
            if (state.hashingExePath() === absoluteExePath) {
                state.setHashingExePath('')
            }
        }
    }

    const runHash = async () => {
        await hashExecutablePath(state.exePath().trim())
    }

    const runTest = async () => {
        try {
            state.setTestingConfiguration(true)
            const result = await backend.testConfiguration(computed.configPreview(), state.gameRoot())
            state.setResultJson(JSON.stringify(result, null, 2))
            setStatusMessage(t('msgTestOk'))
        } catch (error) {
            setStatusMessage(`${t('msgTestFail')} ${String(error)}`)
        } finally {
            state.setTestingConfiguration(false)
        }
    }

    const runCreate = async () => {
        const blockedReason = computed.createExecutableBlockedReason()
        if (blockedReason) {
            setStatusMessage(blockedReason)
            return
        }

        try {
            state.setCreatingExecutable(true)
            const result = await backend.createExecutable({
                baseBinaryPath: ORCHESTRATOR_BASE_PATH,
                outputPath: state.outputPath(),
                configJson: computed.configPreview(),
                backupExisting: true,
                makeExecutable: true,
                iconPngDataUrl: state.iconPreviewPath().trim() || null
            })
            state.setResultJson(JSON.stringify(result, null, 2))
            setStatusMessage(t('msgCreateOk'))
        } catch (error) {
            setStatusMessage(`${t('msgCreateFail')} ${String(error)}`)
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
