/**
 * controller-winetricks-actions.ts
 *
 * Actions for handling Winetricks (loading catalog, adding/removing verbs, searching).
 */

import type { createLuthierState } from './controller-state'
import type { createLuthierComputed } from './controller-computed'
import type { BackendCommandPort, NotifierPort } from './application/ports'

export function createLuthierWinetricksActions(
    state: ReturnType<typeof createLuthierState>,
    computed: ReturnType<typeof createLuthierComputed>,
    backend: BackendCommandPort,
    notifier: NotifierPort,
    ct: (key: any) => string,
    ctf: (key: any, params: any) => string,
    setStatusMessage: (msg: string) => void
) {
    const loadWinetricksCatalog = async () => {
        if (state.winetricksLoading()) return
        try {
            state.setWinetricksLoading(true)
            const result = await backend.winetricksAvailable()
            state.setWinetricksAvailable(result.components)
            state.setWinetricksSource(result.source)
            state.setWinetricksCatalogError(false)
            state.setWinetricksLoaded(true)
            setStatusMessage(ctf('luthier_winetricks_catalog_loaded_count', { count: result.components.length }))
        } catch (error) {
            state.setWinetricksAvailable([])
            state.setWinetricksSource('fallback')
            state.setWinetricksCatalogError(true)
            state.setWinetricksLoaded(true)
            setStatusMessage(ctf('luthier_failed_to_load_winetricks_catalog_error', { error: String(error) }))
        } finally {
            state.setWinetricksLoading(false)
        }
    }

    const removeWinetricksVerb = (verb: string) => {
        state.patchConfig((prev) => ({
            ...prev,
            dependencies: prev.dependencies.filter((item) => item !== verb)
        }))
    }

    const addWinetricksVerb = (verb: string) => {
        let added = false
        state.patchConfig((prev) => {
            if (prev.dependencies.includes(verb)) return prev
            added = true
            return { ...prev, dependencies: [...prev.dependencies, verb] }
        })
        if (!added) return
        notifier.notify(ct('luthier_winetricks_verb_added'), {
            description: verb,
            action: { label: ct('luthier_undo'), onClick: () => removeWinetricksVerb(verb) },
        })
    }

    const addWinetricksFromSearch = () => {
        const exact = computed.winetricksExactMatch()
        if (!exact) {
            return
        }

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
