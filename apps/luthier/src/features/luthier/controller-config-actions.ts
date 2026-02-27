/**
 * controller-config-actions.ts
 *
 * Actions for modifying the main game configuration (environment, requirements, runtimes)
 * and UI tabs.
 */

import type { LuthierTab, FeatureState, RuntimePrimary } from '../../models/config'
import type { createLuthierState } from './controller-state'

export function createLuthierConfigActions(
    state: ReturnType<typeof createLuthierState>,
    tabs: readonly LuthierTab[]
) {
    const setGamescopeState = (newState: FeatureState) => {
        const normalizedState: FeatureState = newState === 'OptionalOff' ? 'MandatoryOff' : newState
        state.patchConfig((prev) => ({
            ...prev,
            environment: {
                ...prev.environment,
                gamescope: {
                    ...prev.environment.gamescope,
                    state: normalizedState
                }
            },
            requirements: {
                ...prev.requirements,
                gamescope: normalizedState
            }
        }))
    }

    const setGamemodeState = (newState: FeatureState) => {
        state.patchConfig((prev) => ({
            ...prev,
            environment: {
                ...prev.environment,
                gamemode: newState
            },
            requirements: {
                ...prev.requirements,
                gamemode: newState
            }
        }))
    }

    const setMangohudState = (newState: FeatureState) => {
        state.patchConfig((prev) => ({
            ...prev,
            environment: {
                ...prev.environment,
                mangohud: newState
            },
            requirements: {
                ...prev.requirements,
                mangohud: newState
            }
        }))
    }

    const setRuntimePrimary = (primary: RuntimePrimary) => {
        state.patchConfig((prev) => ({
            ...prev,
            requirements: {
                ...prev.requirements,
                runtime: {
                    ...prev.requirements.runtime,
                    primary,
                    fallback_order: prev.requirements.runtime.fallback_order.filter((item) => item !== primary)
                }
            }
        }))
    }

    const addFallbackCandidate = (candidate: RuntimePrimary) => {
        state.patchConfig((prev) => {
            if (prev.requirements.runtime.fallback_order.includes(candidate)) return prev
            return {
                ...prev,
                requirements: {
                    ...prev.requirements,
                    runtime: {
                        ...prev.requirements.runtime,
                        fallback_order: [...prev.requirements.runtime.fallback_order, candidate]
                    }
                }
            }
        })
    }

    const removeFallbackCandidate = (candidate: RuntimePrimary) => {
        state.patchConfig((prev) => ({
            ...prev,
            requirements: {
                ...prev.requirements,
                runtime: {
                    ...prev.requirements.runtime,
                    fallback_order: prev.requirements.runtime.fallback_order.filter((item) => item !== candidate)
                }
            }
        }))
    }

    const moveFallbackCandidate = (index: number, direction: -1 | 1) => {
        state.patchConfig((prev) => {
            const current = [...prev.requirements.runtime.fallback_order]
            const target = index + direction
            if (target < 0 || target >= current.length) return prev
            const [item] = current.splice(index, 1)
            current.splice(target, 0, item)
            return {
                ...prev,
                requirements: {
                    ...prev.requirements,
                    runtime: {
                        ...prev.requirements.runtime,
                        fallback_order: current
                    }
                }
            }
        })
    }

    const updateCustomVars = (items: Array<{ key: string; value: string }>) => {
        const nextVars: Record<string, string> = {}
        for (const item of items) {
            const key = item.key.trim()
            if (!key) continue
            nextVars[key] = item.value
        }

        state.patchConfig((prev) => ({
            ...prev,
            environment: {
                ...prev.environment,
                custom_vars: nextVars
            }
        }))
    }

    const setTab = (next: string) => {
        if (tabs.includes(next as LuthierTab)) {
            state.setActiveTab(next as LuthierTab)
        }
    }

    return {
        setGamescopeState,
        setGamemodeState,
        setMangohudState,
        setRuntimePrimary,
        addFallbackCandidate,
        removeFallbackCandidate,
        moveFallbackCandidate,
        updateCustomVars,
        setTab
    }
}
