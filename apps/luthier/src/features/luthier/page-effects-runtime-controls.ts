/**
 * luthier-page-effects-runtime-controls.ts
 *
 * Encapsulates runtime/performance derived controls used by LuthierPage.
 */

import { createMemo } from 'solid-js'

import type { useLuthierController } from './useLuthierController'
import {
    buildWxH,
    featureStateEnabled,
    parseWxH
} from './page-shared'

export function createLuthierPageRuntimeControlsEffects(
    controller: ReturnType<typeof useLuthierController>
) {
    const { config, patchConfig, ct } = controller

    const winecfgVirtualDesktopEnabled = createMemo(() =>
        featureStateEnabled(config().winecfg.virtual_desktop.state.state)
    )

    const winecfgVirtualDesktopResolution = createMemo(() =>
        parseWxH(config().winecfg.virtual_desktop.resolution)
    )

    const setWinecfgVirtualDesktopResolutionPart = (part: 'width' | 'height', value: string) => {
        patchConfig((prev) => {
            const current = parseWxH(prev.winecfg.virtual_desktop.resolution)
            const next = {
                width: part === 'width' ? value : current.width,
                height: part === 'height' ? value : current.height
            }

            return {
                ...prev,
                winecfg: {
                    ...prev.winecfg,
                    virtual_desktop: {
                        ...prev.winecfg.virtual_desktop,
                        resolution: buildWxH(next.width, next.height)
                    }
                }
            }
        })
    }

    const runtimeVersionFieldLabel = () => {
        const preference = config().runner.runtime_preference
        if (preference === 'Proton') return ct('luthier_proton_version')
        if (preference === 'Wine') return ct('luthier_wine_version')
        return ct('luthier_preferred_runtime_version')
    }

    const runtimeVersionFieldHelp = () => {
        const preference = config().runner.runtime_preference
        if (preference === 'Proton') {
            return ct('luthier_target_proton_version_used_by_the_orchestrator_when_pref')
        }
        if (preference === 'Wine') {
            return ct('luthier_expected_wine_version_identifier_when_preference_is_wine')
        }
        return ct('luthier_preferred_runtime_version_when_auto_mode_picks_proton_wi')
    }

    const gamescopeAdditionalOptionsList = createMemo(() => {
        const raw = config().environment.gamescope.additional_options.trim()
        if (!raw) return [] as string[]
        if (raw.includes('\n')) {
            return raw
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
        }
        return [raw]
    })

    const setGamescopeAdditionalOptionsList = (items: string[]) => {
        patchConfig((prev) => ({
            ...prev,
            environment: {
                ...prev.environment,
                gamescope: {
                    ...prev.environment.gamescope,
                    additional_options: items.join(' ').trim()
                }
            }
        }))
    }

    const gamescopeUsesMonitorResolution = createMemo(
        () =>
            !config().environment.gamescope.output_width.trim() &&
            !config().environment.gamescope.output_height.trim()
    )

    const wineWaylandEnabled = createMemo(() => {
        const state = config().compatibility.wine_wayland
        return state === 'MandatoryOn' || state === 'OptionalOn'
    })

    const setGamescopeOutputWidth = (value: string) => {
        patchConfig((prev) => {
            const nextHeight = prev.environment.gamescope.output_height
            return {
                ...prev,
                environment: {
                    ...prev.environment,
                    gamescope: {
                        ...prev.environment.gamescope,
                        output_width: value,
                        resolution: value && nextHeight ? `${value}x${nextHeight}` : null
                    }
                }
            }
        })
    }

    const setGamescopeOutputHeight = (value: string) => {
        patchConfig((prev) => {
            const nextWidth = prev.environment.gamescope.output_width
            return {
                ...prev,
                environment: {
                    ...prev.environment,
                    gamescope: {
                        ...prev.environment.gamescope,
                        output_height: value,
                        resolution: nextWidth && value ? `${nextWidth}x${value}` : null
                    }
                }
            }
        })
    }

    return {
        winecfgVirtualDesktopEnabled,
        winecfgVirtualDesktopResolution,
        setWinecfgVirtualDesktopResolutionPart,
        runtimeVersionFieldLabel,
        runtimeVersionFieldHelp,
        gamescopeAdditionalOptionsList,
        setGamescopeAdditionalOptionsList,
        gamescopeUsesMonitorResolution,
        wineWaylandEnabled,
        setGamescopeOutputWidth,
        setGamescopeOutputHeight
    }
}
