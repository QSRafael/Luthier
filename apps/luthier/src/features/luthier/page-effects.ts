/**
 * luthier-page-effects.ts
 *
 * Encapsulates UI side-effects, mapped options, derivative properties,
 * and high-level handlers for the LuthierPage presentation.
 */

import { createEffect, createMemo } from 'solid-js'

import { LuthierTab } from '../../models/config'
import type { useLuthierController } from './useLuthierController'
import type { createLuthierPageDialogState } from './page-dialog-state'
import { sonnerNotifier } from './infrastructure/sonner-notifier'
import { createLuthierPageRegistryBrowserEffects } from './page-effects-registry-browser'

import {
    buildAncestorPathsFromExe,
    buildWxH,
    featureStateEnabled,
    isLikelyAbsolutePath,
    isTauriLocalRuntime,
    parseWxH,
    relativeInsideBase
} from './page-shared'
import { useTheme } from '../../components/theme-provider'

export function createLuthierPageEffects(
    controller: ReturnType<typeof useLuthierController>,
    dialogState: ReturnType<typeof createLuthierPageDialogState>
) {
    const { theme, setTheme } = useTheme()

    const {
        config,
        patchConfig,
        exePath,
        gameRoot,
        activeTab,
        setActiveTab,
        tabs,
        ct,
        statusMessage,
        statusTone,
        pickGameRootOverride,
        pickIntegrityFileRelative
    } = controller

    const {
        setLastStatusToastMessage,
        lastStatusToastMessage,
        setMobileSidebarOpen,
        setGameRootChooserOpen,
        mountBrowserPath,
        integrityBrowserPath
    } = dialogState

    const wineWindowsVersionOptions = [
        { value: '__default__', label: ct('luthier_runtime_default_do_not_override') },
        { value: 'win11', label: 'Windows 11' },
        { value: 'win10', label: 'Windows 10' },
        { value: 'win81', label: 'Windows 8.1' },
        { value: 'win8', label: 'Windows 8' },
        { value: 'win7', label: 'Windows 7' },
        { value: 'vista', label: 'Windows Vista' },
        { value: 'winxp', label: 'Windows XP' }
    ] as const

    const wineDesktopFolderKeyOptions = [
        { value: 'desktop', label: ct('luthier_desktop') },
        { value: 'documents', label: ct('luthier_documents') },
        { value: 'downloads', label: ct('luthier_downloads') },
        { value: 'music', label: ct('luthier_music') },
        { value: 'pictures', label: ct('luthier_pictures') },
        { value: 'videos', label: ct('luthier_videos') }
    ] as const

    const wineDriveTypeOptions = [
        { value: 'auto', label: ct('luthier_auto_detect') },
        { value: 'local_disk', label: ct('luthier_local_hard_disk') },
        { value: 'network_share', label: ct('luthier_network_share') },
        { value: 'floppy', label: ct('luthier_floppy_disk') },
        { value: 'cdrom', label: ct('luthier_cd_rom') }
    ] as const

    const allWineDriveLetters = 'DEFGHIJKLMNOPQRSTUVWXY'.split('')
    const availableWineDriveLetters = createMemo(() => {
        const used = new Set(
            config()
                .winecfg.drives.map((item) => item.letter.trim().toUpperCase())
                .filter(Boolean)
        )
        return allWineDriveLetters.filter((letter) => !used.has(letter))
    })

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

    const canCalculateHash = createMemo(() => isTauriLocalRuntime() && isLikelyAbsolutePath(exePath()))
    const canChooseGameRoot = createMemo(() => exePath().trim().length > 0)
    const canPickIntegrityFromGameRoot = createMemo(() => isLikelyAbsolutePath(gameRoot().trim()))
    const canAddMount = createMemo(() => gameRoot().trim().length > 0)
    const canBrowseMountFolders = createMemo(() => isTauriLocalRuntime() && isLikelyAbsolutePath(gameRoot().trim()))
    const canImportRegistryFromFile = createMemo(() => isTauriLocalRuntime())
    const {
        importRegistryKeysFromRegFile,
        loadMountBrowserDirs,
        loadIntegrityBrowserEntries,
        resolveIntegrityFileBrowser,
        openIntegrityFileBrowser,
        openMountSourceBrowser
    } = createLuthierPageRegistryBrowserEffects(controller, dialogState)

    const gameRootAncestorCandidates = createMemo(() => buildAncestorPathsFromExe(exePath()))

    const openGameRootChooser = () => {
        if (!isLikelyAbsolutePath(exePath())) {
            void pickGameRootOverride()
            return
        }
        setGameRootChooserOpen(true)
    }

    const mountSourceBrowserSegments = createMemo(() => {
        const root = gameRoot().trim()
        const current = mountBrowserPath().trim()
        const relative = root && current ? relativeInsideBase(root, current) : null
        if (!relative || relative === '.') return [] as Array<{ label: string; path: string }>

        let acc = root
        return relative
            .split('/')
            .filter(Boolean)
            .map((segment) => {
                acc = `${acc.replace(/\/+$/, '')}/${segment}`
                return { label: segment, path: acc }
            })
    })

    const mountSourceBrowserCurrentRelative = createMemo(() => {
        const relative = relativeInsideBase(gameRoot().trim(), mountBrowserPath().trim())
        return relative ?? ''
    })

    const integrityFileBrowserSegments = createMemo(() => {
        const root = gameRoot().trim()
        const current = integrityBrowserPath().trim()
        const relative = root && current ? relativeInsideBase(root, current) : null
        if (!relative || relative === '.') return [] as Array<{ label: string; path: string }>

        let acc = root
        return relative
            .split('/')
            .filter(Boolean)
            .map((segment) => {
                acc = `${acc.replace(/\/+$/, '')}/${segment}`
                return { label: segment, path: acc }
            })
    })

    const integrityFileBrowserCurrentRelative = createMemo(() => {
        const relative = relativeInsideBase(gameRoot().trim(), integrityBrowserPath().trim())
        return relative ?? ''
    })

    const pickIntegrityFileRelativeWithBrowser = async () => {
        if (isTauriLocalRuntime() && isLikelyAbsolutePath(gameRoot().trim())) {
            return await openIntegrityFileBrowser()
        }
        return await pickIntegrityFileRelative()
    }

    const cycleLocale = () => {
        controller.setLocale(controller.locale() === 'pt-BR' ? 'en-US' : 'pt-BR')
    }

    const cycleTheme = () => {
        const current = theme()
        if (current === 'dark') {
            setTheme('light')
            return
        }
        if (current === 'light') {
            setTheme('system')
            return
        }
        setTheme('dark')
    }

    const sidebarLocaleLabel = createMemo(() => `${ct('luthier_language')}: ${controller.locale()}`)

    const sidebarThemeLabel = createMemo(() => {
        const current = theme()
        const label =
            current === 'dark'
                ? ct('luthier_dark')
                : current === 'light'
                    ? ct('luthier_light')
                    : ct('luthier_system')
        return `${ct('luthier_theme')}: ${label}`
    })

    const formControlsI18n = createMemo(() => ({
        enabled: ct('luthier_label_enabled'),
        disabled: ct('luthier_label_disabled'),
        mandatory: ct('luthier_label_mandatory'),
        wineDefault: ct('luthier_use_wine_default'),
        actions: ct('luthier_label_actions'),
        action: ct('luthier_label_action'),
        add: ct('luthier_label_add'),
        addItem: ct('luthier_add_item'),
        addListDialogDescription: ct('luthier_enter_a_value_and_confirm_to_add_it_to_the_list'),
        addKeyValueDialogDescription: ct('luthier_fill_in_key_and_value_to_add_a_new_row'),
        pickFile: ct('luthier_choose_file'),
        pickFileHint: ct('luthier_select_a_file_to_fill_this_field_automatically'),
        cancel: ct('luthier_label_cancel'),
        confirm: ct('luthier_label_confirm'),
        remove: ct('luthier_label_remove'),
        noItemAdded: ct('luthier_no_item_added'),
        keyPlaceholder: ct('luthier_key'),
        valuePlaceholder: ct('luthier_value')
    }))

    const tabIndex = createMemo(() => tabs.indexOf(activeTab()))
    const canGoPrevTab = createMemo(() => tabIndex() > 0)
    const canGoNextTab = createMemo(() => tabIndex() >= 0 && tabIndex() < tabs.length - 1)

    const goPrevTab = () => {
        const index = tabIndex()
        if (index <= 0) return
        setActiveTab(tabs[index - 1])
    }

    const goNextTab = () => {
        const index = tabIndex()
        if (index < 0 || index >= tabs.length - 1) return
        setActiveTab(tabs[index + 1])
    }

    const handleSidebarTabChange = (tab: LuthierTab) => {
        setActiveTab(tab)
        setMobileSidebarOpen(false)
    }

    createEffect(() => {
        const message = statusMessage().trim()
        if (!message) return
        if (message === lastStatusToastMessage()) return
        setLastStatusToastMessage(message)

        const readyPt = 'Pronto.'
        const readyEn = 'Ready.'
        if (message === readyPt || message === readyEn) return

        sonnerNotifier.notify(message, { tone: statusTone() })
    })

    return {
        theme,
        setTheme,
        wineWindowsVersionOptions,
        wineDesktopFolderKeyOptions,
        wineDriveTypeOptions,
        allWineDriveLetters,
        availableWineDriveLetters,
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
        setGamescopeOutputHeight,
        canCalculateHash,
        canChooseGameRoot,
        canPickIntegrityFromGameRoot,
        canAddMount,
        canBrowseMountFolders,
        canImportRegistryFromFile,
        importRegistryKeysFromRegFile,
        gameRootAncestorCandidates,
        openGameRootChooser,
        loadMountBrowserDirs,
        loadIntegrityBrowserEntries,
        resolveIntegrityFileBrowser,
        openIntegrityFileBrowser,
        openMountSourceBrowser,
        mountSourceBrowserSegments,
        mountSourceBrowserCurrentRelative,
        integrityFileBrowserSegments,
        integrityFileBrowserCurrentRelative,
        pickIntegrityFileRelativeWithBrowser,
        cycleLocale,
        cycleTheme,
        sidebarLocaleLabel,
        sidebarThemeLabel,
        formControlsI18n,
        tabIndex,
        canGoPrevTab,
        canGoNextTab,
        goPrevTab,
        goNextTab,
        handleSidebarTabChange
    }
}
