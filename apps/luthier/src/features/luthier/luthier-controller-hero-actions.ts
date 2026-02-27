/**
 * luthier-controller-hero-actions.ts
 *
 * Actions for handling Hero Image (fetching, preparing, searching, cache).
 */

import { toast } from 'solid-sonner'
import { dedupeUrls } from './luthier-controller-utils'
import type { createLuthierState } from './luthier-controller-state'
import type { createLuthierComputed } from './luthier-controller-computed'
import type { PrepareHeroImageOutput, SearchHeroImageOutput } from '../../api/tauri'

export function createLuthierHeroActions(
    state: ReturnType<typeof createLuthierState>,
    computed: ReturnType<typeof createLuthierComputed>,
    invokeCommand: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>,
    ct: (key: any) => string,
    ctf: (key: any, params: any) => string,
    setStatusMessage: (msg: string) => void
) {
    const clearHeroImageSearchCache = () => {
        state.setHeroImageSearchCacheGameName('')
        state.setHeroImageSearchCacheGameId(null)
        state.setHeroImageSearchCandidates([])
        state.setHeroImageSearchIndex(0)
    }

    const setHeroImageUrl = (value: string) => {
        const normalized = value.trim()
        const index = state.heroImageSearchCandidates().findIndex((candidate) => candidate === normalized)
        if (index >= 0) {
            state.setHeroImageSearchIndex(index)
        }
        state.patchConfig((prev) => ({
            ...prev,
            splash: {
                ...prev.splash,
                hero_image_url: value
            }
        }))
    }

    const prepareHeroImageFromUrl = async (rawUrl?: string) => {
        const imageUrl = (rawUrl ?? state.config().splash.hero_image_url).trim()

        if (!imageUrl) {
            state.patchConfig((prev) => ({
                ...prev,
                splash: {
                    ...prev.splash,
                    hero_image_data_url: ''
                }
            }))
            state.setLastPreparedHeroImageUrl('')
            return
        }

        if (imageUrl === state.lastPreparedHeroImageUrl() && state.config().splash.hero_image_data_url.trim()) {
            return
        }

        try {
            state.setHeroImageProcessing(true)
            setStatusMessage(ct('luthier_processing_hero_image'))
            const result = await invokeCommand<PrepareHeroImageOutput>('cmd_prepare_hero_image', {
                image_url: imageUrl
            })
            state.patchConfig((prev) => ({
                ...prev,
                splash: {
                    ...prev.splash,
                    hero_image_url: result.source_url,
                    hero_image_data_url: result.data_url
                }
            }))
            state.setLastPreparedHeroImageUrl(result.source_url)
            setStatusMessage(
                ctf('luthier_hero_image_ready_size', {
                    width: result.width,
                    height: result.height
                })
            )
        } catch (error) {
            state.patchConfig((prev) => ({
                ...prev,
                splash: {
                    ...prev.splash,
                    hero_image_data_url: ''
                }
            }))
            setStatusMessage(ctf('luthier_failed_to_prepare_hero_image_error', { error: String(error) }))
        } finally {
            state.setHeroImageProcessing(false)
        }
    }

    const searchHeroImageAutomatically = async () => {
        const gameName = state.config().game_name.trim()
        if (!gameName) {
            setStatusMessage(ct('luthier_type_game_name_before_searching_hero_image'))
            return
        }

        const normalizedGameName = gameName.toLowerCase()
        const cachedCandidates = state.heroImageSearchCandidates()
        const previousHeroSnapshot = {
            hero_image_url: state.config().splash.hero_image_url,
            hero_image_data_url: state.config().splash.hero_image_data_url,
            lastPreparedHeroImageUrl: state.lastPreparedHeroImageUrl(),
            searchIndex: state.heroImageSearchIndex()
        }

        if (computed.canSearchAnotherHeroImage() && state.heroImageSearchCacheGameName() === normalizedGameName) {
            const currentUrl = state.config().splash.hero_image_url.trim()
            const currentIndex = cachedCandidates.findIndex((candidate) => candidate === currentUrl)
            const baseIndex = currentIndex >= 0 ? currentIndex : state.heroImageSearchIndex()
            const nextIndex = (baseIndex + 1) % cachedCandidates.length
            const nextUrl = cachedCandidates[nextIndex]
            state.setHeroImageSearchIndex(nextIndex)
            setHeroImageUrl(nextUrl)
            setStatusMessage(ct('luthier_hero_image_found_processing_preview'))
            await prepareHeroImageFromUrl(nextUrl)
            toast(ct('luthier_hero_image_updated'), {
                action: {
                    label: ct('luthier_undo'),
                    onClick: () => {
                        state.patchConfig((prev) => ({
                            ...prev,
                            splash: {
                                ...prev.splash,
                                hero_image_url: previousHeroSnapshot.hero_image_url,
                                hero_image_data_url: previousHeroSnapshot.hero_image_data_url
                            }
                        }))
                        state.setLastPreparedHeroImageUrl(previousHeroSnapshot.lastPreparedHeroImageUrl)
                        state.setHeroImageSearchIndex(previousHeroSnapshot.searchIndex)
                    }
                }
            })
            return
        }

        try {
            state.setHeroImageAutoSearching(true)
            setStatusMessage(ct('luthier_searching_hero_image'))
            const search = await invokeCommand<SearchHeroImageOutput>('cmd_search_hero_image', {
                game_name: gameName
            })
            const candidates = dedupeUrls([
                ...(search.candidate_image_urls ?? []),
                search.image_url
            ])
            const selectedIndex = Math.max(0, candidates.findIndex((candidate) => candidate === search.image_url))
            state.setHeroImageSearchCacheGameName(normalizedGameName)
            state.setHeroImageSearchCacheGameId(search.game_id ?? null)
            state.setHeroImageSearchCandidates(candidates)
            state.setHeroImageSearchIndex(selectedIndex)
            setHeroImageUrl(search.image_url)
            setStatusMessage(ct('luthier_hero_image_found_processing_preview'))
            await prepareHeroImageFromUrl(search.image_url)
            toast(ct('luthier_hero_image_updated'), {
                action: {
                    label: ct('luthier_undo'),
                    onClick: () => {
                        state.patchConfig((prev) => ({
                            ...prev,
                            splash: {
                                ...prev.splash,
                                hero_image_url: previousHeroSnapshot.hero_image_url,
                                hero_image_data_url: previousHeroSnapshot.hero_image_data_url
                            }
                        }))
                        state.setLastPreparedHeroImageUrl(previousHeroSnapshot.lastPreparedHeroImageUrl)
                        state.setHeroImageSearchIndex(previousHeroSnapshot.searchIndex)
                    }
                }
            })
        } catch (error) {
            setStatusMessage(ctf('luthier_failed_to_search_hero_image_error', { error: String(error) }))
        } finally {
            state.setHeroImageAutoSearching(false)
        }
    }

    return {
        clearHeroImageSearchCache,
        setHeroImageUrl,
        prepareHeroImageFromUrl,
        searchHeroImageAutomatically
    }
}
