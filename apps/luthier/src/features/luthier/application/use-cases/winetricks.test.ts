import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackendCommandPort, NotifierPort } from '../ports'
import {
  createWinetricksUseCase,
  resetWinetricksCatalogCacheForTests,
  type WinetricksStatePort,
} from './winetricks'

type StateHarness = {
  state: WinetricksStatePort
  read: {
    available: string[]
    source: string
    loaded: boolean
    catalogError: boolean
    statusMessage: string
  }
}

function createStateHarness(): StateHarness {
  let winetricksLoading = false
  let dependencies: string[] = []
  let available: string[] = []
  let source = 'fallback'
  let loaded = false
  let catalogError = false
  let statusMessage = ''

  return {
    state: {
      readState: () => ({
        winetricksLoading,
        dependencies,
      }),
      setWinetricksLoading: (value) => {
        winetricksLoading = value
      },
      setWinetricksAvailable: (value) => {
        available = value
      },
      setWinetricksSource: (value) => {
        source = value
      },
      setWinetricksCatalogError: (value) => {
        catalogError = value
      },
      setWinetricksLoaded: (value) => {
        loaded = value
      },
      setStatusMessage: (value) => {
        statusMessage = value
      },
      setDependencies: (value) => {
        dependencies = value
      },
      getWinetricksExactMatch: () => null,
      setWinetricksSearch: () => {
        // no-op for these tests
      },
    },
    read: {
      get available() {
        return available
      },
      get source() {
        return source
      },
      get loaded() {
        return loaded
      },
      get catalogError() {
        return catalogError
      },
      get statusMessage() {
        return statusMessage
      },
    },
  }
}

function createBackendStub(
  winetricksAvailableImpl: BackendCommandPort['winetricksAvailable']
): BackendCommandPort {
  const notImplemented = async (): Promise<never> => {
    throw new Error('not implemented in test')
  }

  return {
    hashExecutable: notImplemented,
    extractExecutableIcon: notImplemented,
    searchHeroImage: notImplemented,
    prepareHeroImage: notImplemented,
    winetricksAvailable: winetricksAvailableImpl,
    testConfiguration: notImplemented,
    createExecutable: notImplemented,
    importRegistryFile: notImplemented,
    listChildDirectories: notImplemented,
    listDirectoryEntries: notImplemented,
    pickFile: async () => null,
    pickFolder: async () => null,
  }
}

function createNotifierStub(): NotifierPort {
  return {
    notify: vi.fn(),
  }
}

const messages = {
  catalogLoadedCount: ({ count }: { count: number }) => `loaded:${count}`,
  failedToLoadCatalogError: ({ error }: { error: string }) => `error:${error}`,
  winetricksVerbAdded: 'verb added',
  undo: 'undo',
}

describe('createWinetricksUseCase', () => {
  beforeEach(() => {
    resetWinetricksCatalogCacheForTests()
  })

  it('reuses cached catalog on subsequent loads in the same app session', async () => {
    const winetricksAvailable = vi
      .fn<BackendCommandPort['winetricksAvailable']>()
      .mockResolvedValue({
        source: 'path',
        components: ['corefonts', 'vcrun2022'],
      })

    const backend = createBackendStub(winetricksAvailable)
    const notifier = createNotifierStub()

    const firstHarness = createStateHarness()
    const firstUseCase = createWinetricksUseCase({
      backend,
      notifier,
      state: firstHarness.state,
      messages,
    })
    await firstUseCase.loadWinetricksCatalog()

    expect(winetricksAvailable).toHaveBeenCalledTimes(1)
    expect(firstHarness.read.available).toEqual(['corefonts', 'vcrun2022'])

    const secondHarness = createStateHarness()
    const secondUseCase = createWinetricksUseCase({
      backend,
      notifier,
      state: secondHarness.state,
      messages,
    })
    await secondUseCase.loadWinetricksCatalog()

    expect(winetricksAvailable).toHaveBeenCalledTimes(1)
    expect(secondHarness.read.available).toEqual(['corefonts', 'vcrun2022'])
    expect(secondHarness.read.source).toBe('path')
    expect(secondHarness.read.loaded).toBe(true)
    expect(secondHarness.read.catalogError).toBe(false)
    expect(secondHarness.read.statusMessage).toBe('loaded:2')
  })

  it('does not cache failed catalog fetches', async () => {
    const winetricksAvailable = vi
      .fn<BackendCommandPort['winetricksAvailable']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        source: 'path',
        components: ['corefonts'],
      })

    const backend = createBackendStub(winetricksAvailable)
    const notifier = createNotifierStub()

    const firstHarness = createStateHarness()
    const firstUseCase = createWinetricksUseCase({
      backend,
      notifier,
      state: firstHarness.state,
      messages,
    })
    await firstUseCase.loadWinetricksCatalog()

    expect(winetricksAvailable).toHaveBeenCalledTimes(1)
    expect(firstHarness.read.catalogError).toBe(true)

    const secondHarness = createStateHarness()
    const secondUseCase = createWinetricksUseCase({
      backend,
      notifier,
      state: secondHarness.state,
      messages,
    })
    await secondUseCase.loadWinetricksCatalog()

    expect(winetricksAvailable).toHaveBeenCalledTimes(2)
    expect(secondHarness.read.available).toEqual(['corefonts'])
    expect(secondHarness.read.catalogError).toBe(false)
  })
})
