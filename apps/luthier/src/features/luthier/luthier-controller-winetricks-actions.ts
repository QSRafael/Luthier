/**
 * luthier-controller-winetricks-actions.ts
 *
 * Actions for handling Winetricks (loading catalog, adding/removing verbs, searching).
 */

import { toast } from 'solid-sonner'
import type { createLuthierState } from './luthier-controller-state'
import type { createLuthierComputed } from './luthier-controller-computed'

type WinetricksAvailableOutput = {
    source: string
    components: string[]
}

export function createLuthierWinetricksActions(
    state: ReturnType<typeof createLuthierState>,
    computed: ReturnType<typeof createLuthierComputed>,
    invokeCommand: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>,
    ct: (key: any) => string,
    ctf: (key: any, params: any) => string,
    setStatusMessage: (msg: string) => void
) {
    const loadWinetricksCatalog = async () => {
        if (state.winetricksLoading()) return
        try {
            state.setWinetricksLoading(true)
            const result = await invokeCommand<WinetricksAvailableOutput>('cmd_winetricks_available')
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
        toast(ct('luthier_winetricks_verb_added'), {
            description: verb,
            action: {
                label: ct('luthier_undo'),
                onClick: () => removeWinetricksVerb(verb)
            }
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
