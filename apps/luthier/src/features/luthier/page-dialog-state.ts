/**
 * luthier-page-dialog-state.ts
 *
 * Encapsulates the local UI state (dialogs, drafts, sidebars, active tabs)
 * for the LuthierPage component.
 */

import { createSignal } from 'solid-js'
import { FeatureState } from '../../models/config'

export function createLuthierPageDialogState() {
    const [registryDialogOpen, setRegistryDialogOpen] = createSignal(false)
    const [registryDraft, setRegistryDraft] = createSignal({
        path: '',
        name: '',
        value_type: 'REG_SZ',
        value: ''
    })
    const [registryImportWarningsOpen, setRegistryImportWarningsOpen] = createSignal(false)
    const [registryImportWarnings, setRegistryImportWarnings] = createSignal<string[]>([])
    const [gameRootChooserOpen, setGameRootChooserOpen] = createSignal(false)
    const [mountSourceBrowserOpen, setMountSourceBrowserOpen] = createSignal(false)
    const [mountBrowserPath, setMountBrowserPath] = createSignal('')
    const [mountBrowserDirs, setMountBrowserDirs] = createSignal<string[]>([])
    const [mountBrowserLoading, setMountBrowserLoading] = createSignal(false)
    const [integrityFileBrowserOpen, setIntegrityFileBrowserOpen] = createSignal(false)
    const [integrityBrowserPath, setIntegrityBrowserPath] = createSignal('')
    const [integrityBrowserDirs, setIntegrityBrowserDirs] = createSignal<string[]>([])
    const [integrityBrowserFiles, setIntegrityBrowserFiles] = createSignal<string[]>([])
    const [integrityBrowserLoading, setIntegrityBrowserLoading] = createSignal(false)
    const [integrityFileBrowserResolve, setIntegrityFileBrowserResolve] =
        createSignal<((value: string | null) => void) | null>(null)

    const [mountDialogOpen, setMountDialogOpen] = createSignal(false)
    const [mountDraft, setMountDraft] = createSignal({
        source_relative_path: '',
        target_windows_path: '',
        create_source_if_missing: true
    })

    const [dllDialogOpen, setDllDialogOpen] = createSignal(false)
    const [dllDraft, setDllDraft] = createSignal({
        dll: '',
        mode: 'builtin'
    })

    const [wrapperDialogOpen, setWrapperDialogOpen] = createSignal(false)
    const [wrapperDraft, setWrapperDraft] = createSignal({
        state: 'OptionalOff' as FeatureState,
        executable: '',
        args: ''
    })
    const [launchScriptsAccordionOpen, setLaunchScriptsAccordionOpen] = createSignal(false)

    const [extraDependencyDialogOpen, setExtraDependencyDialogOpen] = createSignal(false)
    const [extraDependencyDraft, setExtraDependencyDraft] = createSignal({
        name: '',
        command: '',
        env_vars: '',
        paths: ''
    })
    const [wineDesktopFolderDialogOpen, setWineDesktopFolderDialogOpen] = createSignal(false)
    const [wineDesktopFolderDraft, setWineDesktopFolderDraft] = createSignal({
        folder_key: 'desktop',
        shortcut_name: '',
        linux_path: ''
    })
    const [wineDriveDialogOpen, setWineDriveDialogOpen] = createSignal(false)
    const [wineDriveDraft, setWineDriveDraft] = createSignal({
        letter: 'D',
        host_path: '',
        drive_type: 'auto',
        label: '',
        serial: ''
    })
    const [winecfgAccordionOpen, setWinecfgAccordionOpen] = createSignal<
        'graphics' | 'desktop' | 'drives' | 'audio' | null
    >(null)
    const [lastStatusToastMessage, setLastStatusToastMessage] = createSignal('')
    const [mobileSidebarOpen, setMobileSidebarOpen] = createSignal(false)

    return {
        registryDialogOpen,
        setRegistryDialogOpen,
        registryDraft,
        setRegistryDraft,
        registryImportWarningsOpen,
        setRegistryImportWarningsOpen,
        registryImportWarnings,
        setRegistryImportWarnings,
        gameRootChooserOpen,
        setGameRootChooserOpen,
        mountSourceBrowserOpen,
        setMountSourceBrowserOpen,
        mountBrowserPath,
        setMountBrowserPath,
        mountBrowserDirs,
        setMountBrowserDirs,
        mountBrowserLoading,
        setMountBrowserLoading,
        integrityFileBrowserOpen,
        setIntegrityFileBrowserOpen,
        integrityBrowserPath,
        setIntegrityBrowserPath,
        integrityBrowserDirs,
        setIntegrityBrowserDirs,
        integrityBrowserFiles,
        setIntegrityBrowserFiles,
        integrityBrowserLoading,
        setIntegrityBrowserLoading,
        integrityFileBrowserResolve,
        setIntegrityFileBrowserResolve,
        mountDialogOpen,
        setMountDialogOpen,
        mountDraft,
        setMountDraft,
        dllDialogOpen,
        setDllDialogOpen,
        dllDraft,
        setDllDraft,
        wrapperDialogOpen,
        setWrapperDialogOpen,
        wrapperDraft,
        setWrapperDraft,
        launchScriptsAccordionOpen,
        setLaunchScriptsAccordionOpen,
        extraDependencyDialogOpen,
        setExtraDependencyDialogOpen,
        extraDependencyDraft,
        setExtraDependencyDraft,
        wineDesktopFolderDialogOpen,
        setWineDesktopFolderDialogOpen,
        wineDesktopFolderDraft,
        setWineDesktopFolderDraft,
        wineDriveDialogOpen,
        setWineDriveDialogOpen,
        wineDriveDraft,
        setWineDriveDraft,
        winecfgAccordionOpen,
        setWinecfgAccordionOpen,
        lastStatusToastMessage,
        setLastStatusToastMessage,
        mobileSidebarOpen,
        setMobileSidebarOpen
    }
}
