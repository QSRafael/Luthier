import { describe, expect, it, vi } from 'vitest'

import type { BackendCommandPort } from '../ports'
import { createBuildActionsUseCase } from './build-actions'

describe('createBuildActionsUseCase', () => {
  it('sends hero/icon binary assets to backend create command', async () => {
    const createExecutable = vi.fn().mockResolvedValue({ ok: true })
    const backend = {
      hashExecutable: vi.fn(),
      extractExecutableIcon: vi.fn(),
      searchHeroImage: vi.fn(),
      prepareHeroImage: vi.fn(),
      winetricksAvailable: vi.fn(),
      testConfiguration: vi.fn(),
      createExecutable,
      importRegistryFile: vi.fn(),
      listChildDirectories: vi.fn(),
      listDirectoryEntries: vi.fn(),
      pickFile: vi.fn(),
      pickFolder: vi.fn(),
    } as unknown as BackendCommandPort

    const useCase = createBuildActionsUseCase({
      backend,
      orchestratorBasePath: '/tmp/luthier-orchestrator-base',
      state: {
        readState: () => ({
          exePath: '/games/demo/game.exe',
          gameRoot: '/games/demo',
          configPreview: '{"game_name":"Demo"}',
          outputPath: '/games/demo/luthier',
          iconPngBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
          heroImageAssetBytes: new Uint8Array([1, 2, 3, 4]),
          createExecutableBlockedReason: '',
          hashingExePath: '',
        }),
        setHashingExePath: vi.fn(),
        setLastHashedExePath: vi.fn(),
        setExeHash: vi.fn(),
        setTestingConfiguration: vi.fn(),
        setCreatingExecutable: vi.fn(),
        setResultJson: vi.fn(),
        setStatusMessage: vi.fn(),
      },
      messages: {
        hashFail: 'hash fail',
        testOk: 'test ok',
        testFail: 'test fail',
        createOk: 'create ok',
        createFail: 'create fail',
      },
    })

    await useCase.runCreate()

    expect(createExecutable).toHaveBeenCalledTimes(1)
    expect(createExecutable).toHaveBeenCalledWith(
      expect.objectContaining({
        heroImageBytes: [1, 2, 3, 4],
        iconPngBytes: [0x89, 0x50, 0x4e, 0x47],
      })
    )
  })
})
