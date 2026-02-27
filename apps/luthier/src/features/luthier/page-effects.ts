/**
 * luthier-page-effects.ts
 *
 * Encapsulates UI side-effects, mapped options, derivative properties,
 * and high-level handlers for the LuthierPage presentation.
 */

import { createEffect, createMemo } from 'solid-js'
import { Toaster, toast } from 'solid-sonner'

import { invokeCommand } from '../../api/tauri'
import { LuthierTab } from '../../models/config'
import type { useLuthierController } from './useLuthierController'
import type { createLuthierPageDialogState } from './page-dialog-state'

import {
    buildAncestorPathsFromExe,
    buildWxH,
    featureStateEnabled,
    ImportRegistryFileOutput,
    isLikelyAbsolutePath,
    isTauriLocalRuntime,
    ListChildDirectoriesOutput,
    ListDirectoryEntriesOutput,
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
        ctf,
        statusMessage,
        statusTone,
        pickGameRootOverride,
        pickIntegrityFileRelative
    } = controller

    const {
        setLastStatusToastMessage,
        lastStatusToastMessage,
        setMobileSidebarOpen,
        setRegistryImportWarnings,
        setRegistryImportWarningsOpen,
        setGameRootChooserOpen,
        setMountBrowserLoading,
        setMountBrowserPath,
        setMountBrowserDirs,
        setIntegrityBrowserLoading,
        setIntegrityBrowserPath,
        setIntegrityBrowserDirs,
        setIntegrityBrowserFiles,
        integrityFileBrowserResolve,
        setIntegrityFileBrowserResolve,
        setIntegrityFileBrowserOpen,
        setMountSourceBrowserOpen,
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

    const importRegistryKeysFromRegFile = async () => {
        try {
            const selected = await controller.pickRegistryFile()
            if (!selected) return

            if (!isLikelyAbsolutePath(selected)) {
                controller.setStatusMessage(
                    ct('luthier_importing_reg_requires_an_absolute_path_in_browser_lan_m')
                )
                return
            }

            const result = await invokeCommand<ImportRegistryFileOutput>('cmd_import_registry_file', {
                path: selected
            })

            const existingKeys = new Set(
                config().registry_keys.map((item) =>
                    [item.path, item.name, item.value_type, item.value].join('\u0000')
                )
            )

            const deduped = result.entries.filter((item) => {
                const signature = [item.path, item.name, item.value_type, item.value].join('\u0000')
                if (existingKeys.has(signature)) return false
                existingKeys.add(signature)
                return true
            })

            if (deduped.length > 0) {
                patchConfig((prev) => ({
                    ...prev,
                    registry_keys: [...prev.registry_keys, ...deduped]
                }))
            }

            const warningSuffix =
                result.warnings.length > 0
                    ? ctf('luthier_registry_import_warning_suffix_count', { count: result.warnings.length })
                    : ''

            const successMessage = ctf('luthier_imported_registry_keys_from_reg_file', {
                count: deduped.length,
                warningSuffix
            })

            if (deduped.length > 0) {
                const importedSignatures = new Set(
                    deduped.map((item) => [item.path, item.name, item.value_type, item.value].join('\u0000'))
                )
                toast.success(successMessage, {
                    description: selected,
                    action: {
                        label: ct('luthier_undo'),
                        onClick: () => {
                            patchConfig((prev) => ({
                                ...prev,
                                registry_keys: prev.registry_keys.filter((item) => {
                                    const signature = [item.path, item.name, item.value_type, item.value].join('\u0000')
                                    return !importedSignatures.has(signature)
                                })
                            }))
                            toast.info(ct('luthier_registry_import_undone'))
                        }
                    }
                })
            } else {
                toast.info(successMessage, { description: selected })
            }

            setRegistryImportWarnings(result.warnings)
            setRegistryImportWarningsOpen(result.warnings.length > 0)
        } catch (error) {
            controller.setStatusMessage(ctf('luthier_failed_to_import_reg_file_error', { error: String(error) }))
        }
    }

    const gameRootAncestorCandidates = createMemo(() => buildAncestorPathsFromExe(exePath()))

    const openGameRootChooser = () => {
        if (!isLikelyAbsolutePath(exePath())) {
            void pickGameRootOverride()
            return
        }
        setGameRootChooserOpen(true)
    }

    const loadMountBrowserDirs = async (absolutePath: string) => {
        if (!isLikelyAbsolutePath(absolutePath)) {
            controller.setStatusMessage(
                ct('luthier_mounted_folder_browser_requires_an_absolute_game_root_pa')
            )
            return
        }
        setMountBrowserLoading(true)
        try {
            const result = await invokeCommand<ListChildDirectoriesOutput>('cmd_list_child_directories', {
                path: absolutePath
            })
            setMountBrowserPath(result.path)
            setMountBrowserDirs(result.directories)
        } catch (error) {
            controller.setStatusMessage(ctf('luthier_failed_to_list_folders_error', { error: String(error) }))
        } finally {
            setMountBrowserLoading(false)
        }
    }

    const loadIntegrityBrowserEntries = async (absolutePath: string) => {
        if (!isLikelyAbsolutePath(absolutePath)) {
            controller.setStatusMessage(
                ct('luthier_required_file_browser_requires_an_absolute_game_root_pat')
            )
            return
        }
        setIntegrityBrowserLoading(true)
        try {
            const result = await invokeCommand<ListDirectoryEntriesOutput>('cmd_list_directory_entries', {
                path: absolutePath
            })
            setIntegrityBrowserPath(result.path)
            setIntegrityBrowserDirs(result.directories)
            setIntegrityBrowserFiles(result.files)
        } catch (error) {
            controller.setStatusMessage(ctf('luthier_failed_to_list_files_error', { error: String(error) }))
        } finally {
            setIntegrityBrowserLoading(false)
        }
    }

    const resolveIntegrityFileBrowser = (value: string | null) => {
        const resolver = integrityFileBrowserResolve()
        setIntegrityFileBrowserResolve(null)
        if (resolver) resolver(value)
    }

    const openIntegrityFileBrowser = async () => {
        const root = gameRoot().trim()
        if (!root) {
            controller.setStatusMessage(ct('luthier_select_an_executable_first_to_define_the_game_folder'))
            return null
        }
        if (!isLikelyAbsolutePath(root)) {
            controller.setStatusMessage(
                ct('luthier_in_browser_lan_mode_the_mini_file_browser_cannot_access_')
            )
            return null
        }

        await loadIntegrityBrowserEntries(root)
        setIntegrityFileBrowserOpen(true)

        return new Promise<string | null>((resolve) => {
            setIntegrityFileBrowserResolve(() => resolve)
        })
    }

    const openMountSourceBrowser = async () => {
        const root = gameRoot().trim()
        if (!root) {
            controller.setStatusMessage(ct('luthier_select_an_executable_first_to_define_the_game_folder'))
            return
        }
        if (!isLikelyAbsolutePath(root)) {
            controller.setStatusMessage(
                ct('luthier_in_browser_lan_mode_the_mini_folder_browser_cannot_acces')
            )
            return
        }
        await loadMountBrowserDirs(root)
        setMountSourceBrowserOpen(true)
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

        if (statusTone() === 'error') {
            toast.error(message)
            return
        }
        if (statusTone() === 'success') {
            toast.success(message)
            return
        }
        toast.info(message)
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
