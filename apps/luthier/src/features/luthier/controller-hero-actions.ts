/**
 * controller-hero-actions.ts
 *
 * Thin presentation adapter for Hero Image actions.
 */

import type { createLuthierState } from './controller-state'
import type { createLuthierComputed } from './controller-computed'
import type { BackendCommandPort, NotifierPort } from './application/ports'
import { createHeroImageUseCase } from './application/use-cases/hero-image'

export function createLuthierHeroActions(
  state: ReturnType<typeof createLuthierState>,
  _computed: ReturnType<typeof createLuthierComputed>,
  backend: BackendCommandPort,
  notifier: NotifierPort,
  ct: (key: any) => string,
  ctf: (key: any, params: any) => string,
  setStatusMessage: (msg: string) => void
) {
  const useCase = createHeroImageUseCase({
    backend,
    notifier,
    state: {
      readState: () => ({
        gameName: state.config().game_name,
        heroImageUrl: state.config().splash.hero_image_url,
        heroImageDataUrl: state.config().splash.hero_image_data_url,
        lastPreparedHeroImageUrl: state.lastPreparedHeroImageUrl(),
        searchCacheGameName: state.heroImageSearchCacheGameName(),
        searchCacheGameId: state.heroImageSearchCacheGameId(),
        searchCandidates: state.heroImageSearchCandidates(),
        searchIndex: state.heroImageSearchIndex(),
      }),
      setHeroImageSearchCache: ({ gameName, gameId, candidates, index }) => {
        state.setHeroImageSearchCacheGameName(gameName)
        state.setHeroImageSearchCacheGameId(gameId)
        state.setHeroImageSearchCandidates(candidates)
        state.setHeroImageSearchIndex(index)
      },
      setHeroImageSearchIndex: state.setHeroImageSearchIndex,
      setHeroImageUrl: (value: string) => {
        state.patchConfig((prev) => ({
          ...prev,
          splash: {
            ...prev.splash,
            hero_image_url: value,
          },
        }))
      },
      setHeroImageDataUrl: (value: string) => {
        state.patchConfig((prev) => ({
          ...prev,
          splash: {
            ...prev.splash,
            hero_image_data_url: value,
          },
        }))
      },
      setLastPreparedHeroImageUrl: state.setLastPreparedHeroImageUrl,
      setHeroImageProcessing: state.setHeroImageProcessing,
      setHeroImageAutoSearching: state.setHeroImageAutoSearching,
      setStatusMessage,
      restoreHeroImageSnapshot: (snapshot) => {
        state.patchConfig((prev) => ({
          ...prev,
          splash: {
            ...prev.splash,
            hero_image_url: snapshot.hero_image_url,
            hero_image_data_url: snapshot.hero_image_data_url,
          },
        }))
        state.setLastPreparedHeroImageUrl(snapshot.lastPreparedHeroImageUrl)
        state.setHeroImageSearchIndex(snapshot.searchIndex)
      },
    },
    messages: {
      processingHeroImage: ct('luthier_processing_hero_image'),
      heroImageReadySize: ({ width, height }) =>
        ctf('luthier_hero_image_ready_size', {
          width,
          height,
        }),
      failedToPrepareHeroImageError: ({ error }) =>
        ctf('luthier_failed_to_prepare_hero_image_error', { error }),
      typeGameNameBeforeSearchingHeroImage: ct(
        'luthier_type_game_name_before_searching_hero_image'
      ),
      searchingHeroImage: ct('luthier_searching_hero_image'),
      heroImageFoundProcessingPreview: ct('luthier_hero_image_found_processing_preview'),
      heroImageUpdated: ct('luthier_hero_image_updated'),
      undo: ct('luthier_undo'),
      failedToSearchHeroImageError: ({ error }) =>
        ctf('luthier_failed_to_search_hero_image_error', { error }),
    },
  })

  return useCase
}
