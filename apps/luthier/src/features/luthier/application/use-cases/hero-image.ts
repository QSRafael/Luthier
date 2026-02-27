/**
 * application/use-cases/hero-image.ts
 *
 * Hero image orchestration for the application layer.
 * This module owns search/prepare/cycle/undo flow and depends only on ports.
 */

import type { BackendCommandPort, NotifierPort } from '../ports'
import type { HeroImageSnapshot } from '../types'

type HeroImageStateSnapshot = {
  gameName: string
  heroImageUrl: string
  heroImageDataUrl: string
  lastPreparedHeroImageUrl: string
  searchCacheGameName: string
  searchCacheGameId: number | null
  searchCandidates: string[]
  searchIndex: number
}

export type HeroImageSearchCache = {
  gameName: string
  gameId: number | null
  candidates: string[]
  index: number
}

export type HeroImageStatePort = {
  readState: () => HeroImageStateSnapshot
  setHeroImageSearchCache: (value: HeroImageSearchCache) => void
  setHeroImageSearchIndex: (value: number) => void
  setHeroImageUrl: (value: string) => void
  setHeroImageDataUrl: (value: string) => void
  setLastPreparedHeroImageUrl: (value: string) => void
  setHeroImageProcessing: (value: boolean) => void
  setHeroImageAutoSearching: (value: boolean) => void
  setStatusMessage: (value: string) => void
  restoreHeroImageSnapshot: (snapshot: HeroImageSnapshot) => void
}

export type HeroImageMessages = {
  processingHeroImage: string
  heroImageReadySize: (params: { width: number; height: number }) => string
  failedToPrepareHeroImageError: (params: { error: string }) => string
  typeGameNameBeforeSearchingHeroImage: string
  searchingHeroImage: string
  heroImageFoundProcessingPreview: string
  heroImageUpdated: string
  undo: string
  failedToSearchHeroImageError: (params: { error: string }) => string
}

export type HeroImageUseCaseDeps = {
  backend: BackendCommandPort
  notifier: NotifierPort
  state: HeroImageStatePort
  messages: HeroImageMessages
}

function dedupeUrls(rawUrls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const value of rawUrls) {
    if (!value) continue
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }

  return out
}

function canSearchAnotherHeroImage(state: HeroImageStateSnapshot): boolean {
  const key = state.gameName.trim().toLowerCase()
  return (
    !!key &&
    state.searchCacheGameName === key &&
    state.searchCacheGameId !== null &&
    state.searchCandidates.length > 1
  )
}

function buildHeroImageSnapshot(state: HeroImageStateSnapshot): HeroImageSnapshot {
  return {
    hero_image_url: state.heroImageUrl,
    hero_image_data_url: state.heroImageDataUrl,
    lastPreparedHeroImageUrl: state.lastPreparedHeroImageUrl,
    searchIndex: state.searchIndex,
  }
}

export function createHeroImageUseCase({
  backend,
  notifier,
  state,
  messages,
}: HeroImageUseCaseDeps) {
  const applyHeroImageUrlFromInput = (value: string) => {
    const normalized = value.trim()
    const current = state.readState()
    const index = current.searchCandidates.findIndex((candidate) => candidate === normalized)
    if (index >= 0) {
      state.setHeroImageSearchIndex(index)
    }
    state.setHeroImageUrl(value)
  }

  const clearHeroImageSearchCache = () => {
    state.setHeroImageSearchCache({
      gameName: '',
      gameId: null,
      candidates: [],
      index: 0,
    })
  }

  const prepareHeroImageFromUrl = async (rawUrl?: string) => {
    const current = state.readState()
    const imageUrl = (rawUrl ?? current.heroImageUrl).trim()

    if (!imageUrl) {
      state.setHeroImageDataUrl('')
      state.setLastPreparedHeroImageUrl('')
      return
    }

    if (imageUrl === current.lastPreparedHeroImageUrl && current.heroImageDataUrl.trim()) {
      return
    }

    try {
      state.setHeroImageProcessing(true)
      state.setStatusMessage(messages.processingHeroImage)
      const result = await backend.prepareHeroImage(imageUrl)
      state.setHeroImageUrl(result.source_url)
      state.setHeroImageDataUrl(result.data_url)
      state.setLastPreparedHeroImageUrl(result.source_url)
      state.setStatusMessage(
        messages.heroImageReadySize({
          width: result.width,
          height: result.height,
        })
      )
    } catch (error) {
      state.setHeroImageDataUrl('')
      state.setStatusMessage(messages.failedToPrepareHeroImageError({ error: String(error) }))
    } finally {
      state.setHeroImageProcessing(false)
    }
  }

  const searchHeroImageAutomatically = async () => {
    const initialState = state.readState()
    const gameName = initialState.gameName.trim()

    if (!gameName) {
      state.setStatusMessage(messages.typeGameNameBeforeSearchingHeroImage)
      return
    }

    const normalizedGameName = gameName.toLowerCase()
    const previousHeroSnapshot = buildHeroImageSnapshot(initialState)

    if (
      canSearchAnotherHeroImage(initialState) &&
      initialState.searchCacheGameName === normalizedGameName
    ) {
      const currentUrl = initialState.heroImageUrl.trim()
      const currentIndex = initialState.searchCandidates.findIndex(
        (candidate) => candidate === currentUrl
      )
      const baseIndex = currentIndex >= 0 ? currentIndex : initialState.searchIndex
      const nextIndex = (baseIndex + 1) % initialState.searchCandidates.length
      const nextUrl = initialState.searchCandidates[nextIndex]

      state.setHeroImageSearchIndex(nextIndex)
      applyHeroImageUrlFromInput(nextUrl)
      state.setStatusMessage(messages.heroImageFoundProcessingPreview)
      await prepareHeroImageFromUrl(nextUrl)

      notifier.notify(messages.heroImageUpdated, {
        action: {
          label: messages.undo,
          onClick: () => {
            state.restoreHeroImageSnapshot(previousHeroSnapshot)
          },
        },
      })
      return
    }

    try {
      state.setHeroImageAutoSearching(true)
      state.setStatusMessage(messages.searchingHeroImage)

      const search = await backend.searchHeroImage(gameName)
      const candidates = dedupeUrls([...(search.candidate_image_urls ?? []), search.image_url])
      const selectedIndex = Math.max(
        0,
        candidates.findIndex((candidate) => candidate === search.image_url)
      )

      state.setHeroImageSearchCache({
        gameName: normalizedGameName,
        gameId: search.game_id ?? null,
        candidates,
        index: selectedIndex,
      })
      applyHeroImageUrlFromInput(search.image_url)
      state.setStatusMessage(messages.heroImageFoundProcessingPreview)
      await prepareHeroImageFromUrl(search.image_url)

      notifier.notify(messages.heroImageUpdated, {
        action: {
          label: messages.undo,
          onClick: () => {
            state.restoreHeroImageSnapshot(previousHeroSnapshot)
          },
        },
      })
    } catch (error) {
      state.setStatusMessage(messages.failedToSearchHeroImageError({ error: String(error) }))
    } finally {
      state.setHeroImageAutoSearching(false)
    }
  }

  return {
    clearHeroImageSearchCache,
    setHeroImageUrl: applyHeroImageUrlFromInput,
    prepareHeroImageFromUrl,
    searchHeroImageAutomatically,
  }
}
