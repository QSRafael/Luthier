/**
 * controller-winetricks-actions.ts
 *
 * Thin presentation adapter for Winetricks actions.
 */

import type { createLuthierState } from './controller-state'
import type { createLuthierComputed } from './controller-computed'
import type { BackendCommandPort, NotifierPort } from './application/ports'
import { createWinetricksUseCase } from './application/use-cases/winetricks'

export function createLuthierWinetricksActions(
  state: ReturnType<typeof createLuthierState>,
  computed: ReturnType<typeof createLuthierComputed>,
  backend: BackendCommandPort,
  notifier: NotifierPort,
  ct: (key: any) => string,
  ctf: (key: any, params: any) => string,
  setStatusMessage: (msg: string) => void
) {
  const useCase = createWinetricksUseCase({
    backend,
    notifier,
    state: {
      readState: () => ({
        winetricksLoading: state.winetricksLoading(),
        dependencies: state.config().dependencies,
      }),
      setWinetricksLoading: state.setWinetricksLoading,
      setWinetricksAvailable: state.setWinetricksAvailable,
      setWinetricksSource: state.setWinetricksSource,
      setWinetricksCatalogError: state.setWinetricksCatalogError,
      setWinetricksLoaded: state.setWinetricksLoaded,
      setStatusMessage,
      setDependencies: (value) => {
        state.patchConfig((prev) => ({
          ...prev,
          dependencies: value,
        }))
      },
      getWinetricksExactMatch: computed.winetricksExactMatch,
      setWinetricksSearch: state.setWinetricksSearch,
    },
    messages: {
      catalogLoadedCount: ({ count }) => ctf('luthier_winetricks_catalog_loaded_count', { count }),
      failedToLoadCatalogError: ({ error }) =>
        ctf('luthier_failed_to_load_winetricks_catalog_error', { error }),
      winetricksVerbAdded: ct('luthier_winetricks_verb_added'),
      undo: ct('luthier_undo'),
    },
  })

  return useCase
}
