/**
 * controller-build-actions.ts
 *
 * Actions for hashing, testing, and creating the final executable wrapper.
 */

import { isLikelyAbsolutePath } from './controller-utils'
import type { createLuthierState } from './controller-state'
import type { createLuthierComputed } from './controller-computed'

export function createLuthierBuildActions(
    state: ReturnType<typeof createLuthierState>,
    computed: ReturnType<typeof createLuthierComputed>,
    invokeCommand: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>,
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
            const result = await invokeCommand<{ sha256_hex: string }>('cmd_hash_executable', {
                executable_path: absoluteExePath
            })
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
            const result = await invokeCommand<unknown>('cmd_test_configuration', {
                config_json: computed.configPreview(),
                game_root: state.gameRoot()
            })
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
            const result = await invokeCommand<unknown>('cmd_create_executable', {
                base_binary_path: ORCHESTRATOR_BASE_PATH,
                output_path: state.outputPath(),
                config_json: computed.configPreview(),
                backup_existing: true,
                make_executable: true,
                icon_png_data_url: state.iconPreviewPath().trim() || null
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
