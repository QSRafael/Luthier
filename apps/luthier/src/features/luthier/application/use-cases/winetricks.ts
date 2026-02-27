/**
 * application/use-cases/winetricks.ts
 *
 * Winetricks orchestration for the application layer.
 * This module owns catalog loading and dependency add/remove/undo flow.
 */

import type { BackendCommandPort, NotifierPort } from '../ports'

type WinetricksStateSnapshot = {
    winetricksLoading: boolean
    dependencies: string[]
}

export type WinetricksStatePort = {
    readState: () => WinetricksStateSnapshot
    setWinetricksLoading: (value: boolean) => void
    setWinetricksAvailable: (value: string[]) => void
    setWinetricksSource: (value: string) => void
    setWinetricksCatalogError: (value: boolean) => void
    setWinetricksLoaded: (value: boolean) => void
    setStatusMessage: (value: string) => void
    setDependencies: (value: string[]) => void
    getWinetricksExactMatch: () => string | null
    setWinetricksSearch: (value: string) => void
}

export type WinetricksMessages = {
    catalogLoadedCount: (params: { count: number }) => string
    failedToLoadCatalogError: (params: { error: string }) => string
    winetricksVerbAdded: string
    undo: string
}

export type WinetricksUseCaseDeps = {
    backend: BackendCommandPort
    notifier: NotifierPort
    state: WinetricksStatePort
    messages: WinetricksMessages
}

export function createWinetricksUseCase({ backend, notifier, state, messages }: WinetricksUseCaseDeps) {
    const loadWinetricksCatalog = async () => {
        if (state.readState().winetricksLoading) return

        try {
            state.setWinetricksLoading(true)
            const result = await backend.winetricksAvailable()
            state.setWinetricksAvailable(result.components)
            state.setWinetricksSource(result.source)
            state.setWinetricksCatalogError(false)
            state.setWinetricksLoaded(true)
            state.setStatusMessage(messages.catalogLoadedCount({ count: result.components.length }))
        } catch (error) {
            state.setWinetricksAvailable([])
            state.setWinetricksSource('fallback')
            state.setWinetricksCatalogError(true)
            state.setWinetricksLoaded(true)
            state.setStatusMessage(messages.failedToLoadCatalogError({ error: String(error) }))
        } finally {
            state.setWinetricksLoading(false)
        }
    }

    const removeWinetricksVerb = (verb: string) => {
        const current = state.readState()
        if (!current.dependencies.includes(verb)) return

        state.setDependencies(current.dependencies.filter((item) => item !== verb))
    }

    const addWinetricksVerb = (verb: string) => {
        const current = state.readState()
        if (current.dependencies.includes(verb)) return

        state.setDependencies([...current.dependencies, verb])
        notifier.notify(messages.winetricksVerbAdded, {
            description: verb,
            action: {
                label: messages.undo,
                onClick: () => {
                    removeWinetricksVerb(verb)
                }
            }
        })
    }

    const addWinetricksFromSearch = () => {
        const exact = state.getWinetricksExactMatch()
        if (!exact) return

        addWinetricksVerb(exact)
        state.setWinetricksSearch('')
    }

    return {
        loadWinetricksCatalog,
        addWinetricksVerb,
        removeWinetricksVerb,
        addWinetricksFromSearch
    }
}
