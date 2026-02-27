/**
 * luthier-page-effects.ts
 *
 * Encapsulates UI side-effects, mapped options, derivative properties,
 * and high-level handlers for the LuthierPage presentation.
 */

import { createEffect, createMemo } from 'solid-js'

import type { useLuthierController } from './useLuthierController'
import type { createLuthierPageDialogState } from './page-dialog-state'
import { sonnerNotifier } from './infrastructure/sonner-notifier'
import { createLuthierPageRegistryBrowserEffects } from './page-effects-registry-browser'
import { createLuthierPageRuntimeControlsEffects } from './page-effects-runtime-controls'
import { createLuthierPageNavigationEffects } from './page-effects-navigation'

import {
    buildAncestorPathsFromExe,
    isLikelyAbsolutePath,
    isTauriLocalRuntime,
    relativeInsideBase
} from './page-shared'

export function createLuthierPageEffects(
    controller: ReturnType<typeof useLuthierController>,
    dialogState: ReturnType<typeof createLuthierPageDialogState>
) {
    const {
        config,
        exePath,
        gameRoot,
        ct,
        statusMessage,
        statusTone,
        pickGameRootOverride,
        pickIntegrityFileRelative
    } = controller

    const {
        setLastStatusToastMessage,
        lastStatusToastMessage,
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

    const {
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
    } = createLuthierPageRuntimeControlsEffects(controller)

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
    const {
        theme,
        setTheme,
        cycleLocale,
        cycleTheme,
        sidebarLocaleLabel,
        sidebarThemeLabel,
        tabIndex,
        canGoPrevTab,
        canGoNextTab,
        goPrevTab,
        goNextTab,
        handleSidebarTabChange
    } = createLuthierPageNavigationEffects(controller, dialogState)

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
