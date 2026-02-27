/**
 * controller-build-actions.ts
 *
 * Thin presentation adapter for build/hash/test/create actions.
 */

import type { createLuthierState } from './controller-state'
import type { createLuthierComputed } from './controller-computed'
import type { BackendCommandPort } from './application/ports'
import { createBuildActionsUseCase } from './application/use-cases/build-actions'

export function createLuthierBuildActions(
  state: ReturnType<typeof createLuthierState>,
  computed: ReturnType<typeof createLuthierComputed>,
  backend: BackendCommandPort,
  ORCHESTRATOR_BASE_PATH: string,
  t: (key: string) => string,
  setStatusMessage: (msg: string) => void
) {
  const useCase = createBuildActionsUseCase({
    backend,
    orchestratorBasePath: ORCHESTRATOR_BASE_PATH,
    state: {
      readState: () => ({
        exePath: state.exePath(),
        gameRoot: state.gameRoot(),
        configPreview: computed.configPreview(),
        outputPath: state.outputPath(),
        iconPreviewPath: state.iconPreviewPath(),
        createExecutableBlockedReason: computed.createExecutableBlockedReason(),
        hashingExePath: state.hashingExePath(),
      }),
      setHashingExePath: state.setHashingExePath,
      setLastHashedExePath: state.setLastHashedExePath,
      setExeHash: (value: string) => {
        state.patchConfig((prev) => ({ ...prev, exe_hash: value }))
      },
      setTestingConfiguration: state.setTestingConfiguration,
      setCreatingExecutable: state.setCreatingExecutable,
      setResultJson: state.setResultJson,
      setStatusMessage,
    },
    messages: {
      hashFail: t('msgHashFail'),
      testOk: t('msgTestOk'),
      testFail: t('msgTestFail'),
      createOk: t('msgCreateOk'),
      createFail: t('msgCreateFail'),
    },
  })

  return useCase
}
