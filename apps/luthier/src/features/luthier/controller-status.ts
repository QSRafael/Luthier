/**
 * controller-status.ts
 *
 * Status and health checks (createEffect) for the Luthier controller.
 * Enforces configuration validness and automatically derives readiness states.
 */

import { createEffect, onCleanup, onMount } from 'solid-js'
import { basename, dirname, hasWindowsLauncherExtension, isLikelyAbsolutePath, relativeFromRoot, stripLauncherExtension } from './controller-utils'
import type { FeatureState } from '../../models/config'
import type { createLuthierState } from './controller-state'
import type { createLuthierComputed } from './controller-computed'

export function createLuthierStatus(
    state: ReturnType<typeof createLuthierState>,
    computed: ReturnType<typeof createLuthierComputed>,
    actions: {
        hashExecutablePath: (path: string) => Promise<void>
        loadWinetricksCatalog: () => Promise<void>
    }
) {
    // Sync locale
    createEffect(() => {
        localStorage.setItem('luthier.locale', state.locale())
    })

    // Clear hero search cache if game name changes
    createEffect(() => {
        const currentNormalizedName = computed.normalizedHeroSearchGameName()
        const cachedName = state.heroImageSearchCacheGameName()
        if (!cachedName) return
        if (currentNormalizedName === cachedName) return

        state.setHeroImageSearchCacheGameName('')
        state.setHeroImageSearchCacheGameId(null)
        state.setHeroImageSearchCandidates([])
        state.setHeroImageSearchIndex(0)
    })

    // Runtime UX simplification: default to Proton-GE and enforce UMU in the authoring UI.
    createEffect(() => {
        const current = state.config()
        let next = current
        let changed = false

        if (current.runner.runtime_preference === 'Auto') {
            next = {
                ...next,
                runner: {
                    ...next.runner,
                    runtime_preference: 'Proton'
                }
            }
            changed = true
        }

        if (!current.runner.proton_version.trim()) {
            next = {
                ...next,
                runner: {
                    ...next.runner,
                    proton_version: 'GE-Proton-latest'
                }
            }
            changed = true
        }

        if (current.requirements.umu !== 'MandatoryOn') {
            next = {
                ...next,
                requirements: {
                    ...next.requirements,
                    umu: 'MandatoryOn'
                }
            }
            changed = true
        }

        if (changed) {
            state.setConfig(next)
        }
    })

    // Auto-detect game root
    createEffect(() => {
        const currentExePath = state.exePath().trim()
        if (!currentExePath) return

        const detectedRoot = dirname(currentExePath)
        if (!detectedRoot || detectedRoot === currentExePath) return

        if (!state.gameRootManualOverride() && state.gameRoot() !== detectedRoot) {
            state.setGameRoot(detectedRoot)
        }
    })

    // Auto-derive relative exe path
    createEffect(() => {
        const currentExePath = state.exePath().trim()
        if (!currentExePath) return

        const baseRoot = state.gameRoot().trim() || dirname(currentExePath)
        const relative = relativeFromRoot(baseRoot, currentExePath)
        const nextRelativePath = relative ? `./${relative}` : `./${basename(currentExePath)}`
        if (state.config().relative_exe_path !== nextRelativePath) {
            state.patchConfig((prev) => ({ ...prev, relative_exe_path: nextRelativePath }))
        }
    })

    // Auto-derive output path
    createEffect(() => {
        const currentExePath = state.exePath().trim()
        if (!currentExePath) return

        const dir = dirname(currentExePath)
        const file = basename(currentExePath)
        const stem = stripLauncherExtension(file) || file
        const derivedOutput = dir && dir !== file ? `${dir}/${stem}` : stem

        if (derivedOutput && state.outputPath() !== derivedOutput) {
            state.setOutputPath(derivedOutput)
        }
    })

    // Auto-toggle winetricks requirement
    createEffect(() => {
        const hasVerbs = state.config().dependencies.length > 0
        const expected: FeatureState = hasVerbs ? 'OptionalOn' : 'OptionalOff'

        if (state.config().requirements.winetricks !== expected) {
            state.patchConfig((prev) => ({
                ...prev,
                requirements: {
                    ...prev.requirements,
                    winetricks: expected
                }
            }))
        }
    })

    // Winetricks catalog trigger
    onMount(() => {
        if (state.winetricksLoaded() || state.winetricksLoading()) return
        const timer = window.setTimeout(() => {
            if (!state.winetricksLoaded() && !state.winetricksLoading()) {
                void actions.loadWinetricksCatalog()
            }
        }, 250)
        onCleanup(() => window.clearTimeout(timer))
    })

    // Hash executable trigger
    createEffect(() => {
        const currentPath = state.exePath().trim()
        if (!currentPath) return
        if (!isLikelyAbsolutePath(currentPath)) return
        if (!hasWindowsLauncherExtension(currentPath)) return
        if (currentPath === state.hashingExePath() || currentPath === state.lastHashedExePath()) return

        const timer = window.setTimeout(() => {
            void actions.hashExecutablePath(currentPath)
        }, 200)
        onCleanup(() => window.clearTimeout(timer))
    })
}
