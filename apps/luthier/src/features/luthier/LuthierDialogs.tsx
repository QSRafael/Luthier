import { For } from 'solid-js'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { type LuthierPageSectionProps } from './page-shared'
import type { FeatureState } from '../../models/config'

export function LuthierDialogs(props: LuthierPageSectionProps) {
    const { view } = props
    const {
        ct,
        config,
        patchConfig,
        registryDraft,
        setRegistryDraft,
        registryDialogOpen,
        setRegistryDialogOpen,
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
        registryImportWarningsOpen,
        setRegistryImportWarningsOpen,
        registryImportWarnings,
        wineDesktopFolderKeyOptions,
        wineDriveTypeOptions,
        availableWineDriveLetters,
        formControlsI18n,
        dllModeOptions,
        featureStateOptions
    } = view

    const tForm = () => formControlsI18n()

    return (
        <>
            {/* ─── Registry Key Dialog ─── */}
            <Dialog open={registryDialogOpen()} onOpenChange={setRegistryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_add_registry_key')}</DialogTitle>
                        <DialogDescription>{tForm().addKeyValueDialogDescription}</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-4 py-4">
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_registry_path')}</label>
                            <Input
                                value={registryDraft().path}
                                onInput={(e) =>
                                    setRegistryDraft({ ...registryDraft(), path: e.currentTarget.value })
                                }
                                placeholder="HKEY_CURRENT_USER\Software\Wine"
                            />
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{tForm().keyPlaceholder}</label>
                            <Input
                                value={registryDraft().name}
                                onInput={(e) =>
                                    setRegistryDraft({ ...registryDraft(), name: e.currentTarget.value })
                                }
                                placeholder="Version"
                            />
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_windows_registry_value_type')}</label>
                            <Select
                                value={registryDraft().value_type}
                                onInput={(e) =>
                                    setRegistryDraft({ ...registryDraft(), value_type: e.currentTarget.value })
                                }
                            >
                                <option value="REG_SZ">REG_SZ (String)</option>
                                <option value="REG_DWORD">REG_DWORD (Integer)</option>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{tForm().valuePlaceholder}</label>
                            <Input
                                value={registryDraft().value}
                                onInput={(e) =>
                                    setRegistryDraft({ ...registryDraft(), value: e.currentTarget.value })
                                }
                                placeholder="win10"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setRegistryDialogOpen(false)}
                        >
                            {tForm().cancel}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                const draft = registryDraft()
                                if (draft.path && draft.name) {
                                    patchConfig((prev) => ({
                                        ...prev,
                                        registry_keys: [...prev.registry_keys, { ...draft }]
                                    }))
                                    setRegistryDraft({ path: '', name: '', value_type: 'REG_SZ', value: '' })
                                    setRegistryDialogOpen(false)
                                }
                            }}
                            disabled={!registryDraft().path.trim() || !registryDraft().name.trim()}
                        >
                            {tForm().add}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Registry Import Warnings Dialog ─── */}
            <Dialog open={registryImportWarningsOpen()} onOpenChange={setRegistryImportWarningsOpen}>
                <DialogContent class="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_registry_import_warnings')}</DialogTitle>
                        <DialogDescription>
                            {ct('luthier_some_warnings_were_found_during_import_please_check')}
                        </DialogDescription>
                    </DialogHeader>
                    <div class="max-h-[60vh] overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-4">
                        <ul class="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                            <For each={registryImportWarnings()}>
                                {(warning) => <li>{warning}</li>}
                            </For>
                        </ul>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={() => setRegistryImportWarningsOpen(false)}>
                            {ct('luthier_close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Folder Mount Dialog ─── */}
            <Dialog open={mountDialogOpen()} onOpenChange={setMountDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_add_folder_mount')}</DialogTitle>
                        <DialogDescription>{ct('luthier_add_folder_mount_description')}</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-4 py-4">
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_source_path_relative_to_game_root')}</label>
                            <div class="flex gap-2">
                                <Input
                                    class="flex-1"
                                    value={mountDraft().source_relative_path}
                                    onInput={(e) =>
                                        setMountDraft({ ...mountDraft(), source_relative_path: e.currentTarget.value })
                                    }
                                    placeholder="mods"
                                />
                            </div>
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_target_windows_path')}</label>
                            <Input
                                value={mountDraft().target_windows_path}
                                onInput={(e) =>
                                    setMountDraft({ ...mountDraft(), target_windows_path: e.currentTarget.value })
                                }
                                placeholder="C:\mods"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setMountDialogOpen(false)}>
                            {tForm().cancel}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                const draft = mountDraft()
                                if (draft.source_relative_path && draft.target_windows_path) {
                                    patchConfig((prev) => ({
                                        ...prev,
                                        folder_mounts: [...prev.folder_mounts, { ...draft }]
                                    }))
                                    setMountDraft({
                                        source_relative_path: '',
                                        target_windows_path: '',
                                        create_source_if_missing: true
                                    })
                                    setMountDialogOpen(false)
                                }
                            }}
                            disabled={!mountDraft().source_relative_path.trim() || !mountDraft().target_windows_path.trim()}
                        >
                            {tForm().add}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── DLL Override Dialog ─── */}
            <Dialog open={dllDialogOpen()} onOpenChange={setDllDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_add_dll_override')}</DialogTitle>
                        <DialogDescription>{tForm().addKeyValueDialogDescription}</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-4 py-4">
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">DLL</label>
                            <Input
                                value={dllDraft().dll}
                                onInput={(e) => setDllDraft({ ...dllDraft(), dll: e.currentTarget.value })}
                                placeholder="d3d11"
                            />
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_behavior')}</label>
                            <Select
                                value={dllDraft().mode}
                                onInput={(e) => setDllDraft({ ...dllDraft(), mode: e.currentTarget.value })}
                            >
                                <For each={dllModeOptions()}>
                                    {(option) => <option value={option.value}>{option.label}</option>}
                                </For>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDllDialogOpen(false)}>
                            {tForm().cancel}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (dllDraft().dll) {
                                    patchConfig((prev) => ({
                                        ...prev,
                                        winecfg: {
                                            ...prev.winecfg,
                                            dll_overrides: [
                                                ...prev.winecfg.dll_overrides.filter((o) => o.dll !== dllDraft().dll.trim()),
                                                { dll: dllDraft().dll.trim(), mode: dllDraft().mode }
                                            ]
                                        }
                                    }))
                                    setDllDraft({ dll: '', mode: 'builtin' })
                                    setDllDialogOpen(false)
                                }
                            }}
                            disabled={!dllDraft().dll.trim()}
                        >
                            {tForm().add}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Wrapper Command Dialog ─── */}
            <Dialog open={wrapperDialogOpen()} onOpenChange={setWrapperDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_add_wrapper_command')}</DialogTitle>
                        <DialogDescription>{tForm().addListDialogDescription}</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-4 py-4">
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_wrapper_executable')}</label>
                            <Input
                                value={wrapperDraft().executable}
                                onInput={(e) =>
                                    setWrapperDraft({ ...wrapperDraft(), executable: e.currentTarget.value })
                                }
                                placeholder="strace"
                            />
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_arguments_optional')}</label>
                            <Input
                                value={wrapperDraft().args}
                                onInput={(e) => setWrapperDraft({ ...wrapperDraft(), args: e.currentTarget.value })}
                                placeholder="-f -e trace=file"
                            />
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_feature_state')}</label>
                            <Select
                                value={wrapperDraft().state}
                                onInput={(e) => setWrapperDraft({ ...wrapperDraft(), state: e.currentTarget.value as FeatureState })}
                            >
                                <For each={featureStateOptions()}>
                                    {(option) => <option value={option.value}>{option.label}</option>}
                                </For>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setWrapperDialogOpen(false)}>
                            {tForm().cancel}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (wrapperDraft().executable) {
                                    patchConfig((prev) => {
                                        const existing = prev.compatibility.wrapper_commands.map((w) => w.executable)
                                        if (existing.includes(wrapperDraft().executable.trim())) return prev
                                        return {
                                            ...prev,
                                            compatibility: {
                                                ...prev.compatibility,
                                                wrapper_commands: [
                                                    ...prev.compatibility.wrapper_commands,
                                                    {
                                                        state: wrapperDraft().state as FeatureState,
                                                        executable: wrapperDraft().executable.trim(),
                                                        args: wrapperDraft().args.trim()
                                                    }
                                                ]
                                            }
                                        }
                                    })
                                    setWrapperDraft({ state: 'OptionalOff' as FeatureState, executable: '', args: '' })
                                    setWrapperDialogOpen(false)
                                }
                            }}
                            disabled={!wrapperDraft().executable.trim()}
                        >
                            {tForm().add}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Extra System Dependency Dialog ─── */}
            <Dialog open={extraDependencyDialogOpen()} onOpenChange={setExtraDependencyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_add_extra_system_dependency')}</DialogTitle>
                        <DialogDescription>{tForm().addKeyValueDialogDescription}</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-4 py-4">
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_dependency_name')}</label>
                            <Input
                                value={extraDependencyDraft().name}
                                onInput={(e) =>
                                    setExtraDependencyDraft({ ...extraDependencyDraft(), name: e.currentTarget.value })
                                }
                                placeholder="libgl1-mesa-glx"
                            />
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_test_command_optional')}</label>
                            <Input
                                value={extraDependencyDraft().command}
                                onInput={(e) =>
                                    setExtraDependencyDraft({
                                        ...extraDependencyDraft(),
                                        command: e.currentTarget.value
                                    })
                                }
                                placeholder="glxinfo"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setExtraDependencyDialogOpen(false)}
                        >
                            {tForm().cancel}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (extraDependencyDraft().name) {
                                    patchConfig((prev) => ({
                                        ...prev,
                                        extra_system_dependencies: [
                                            ...prev.extra_system_dependencies,
                                            {
                                                name: extraDependencyDraft().name.trim(),
                                                check_commands: extraDependencyDraft().command.trim() ? [extraDependencyDraft().command.trim()] : [],
                                                check_env_vars: [] as string[],
                                                check_paths: [] as string[],
                                                state: 'Enabled' as FeatureState
                                            }
                                        ]
                                    }))
                                    setExtraDependencyDraft({ name: '', command: '', env_vars: '', paths: '' })
                                    setExtraDependencyDialogOpen(false)
                                }
                            }}
                            disabled={!extraDependencyDraft().name.trim()}
                        >
                            {tForm().add}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Wine Desktop Folder Dialog ─── */}
            <Dialog open={wineDesktopFolderDialogOpen()} onOpenChange={setWineDesktopFolderDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_add_wine_special_folder')}</DialogTitle>
                        <DialogDescription>{tForm().addKeyValueDialogDescription}</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-4 py-4">
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_folder_type')}</label>
                            <Select
                                value={wineDesktopFolderDraft().folder_key}
                                onInput={(e) => setWineDesktopFolderDraft({ ...wineDesktopFolderDraft(), folder_key: e.currentTarget.value })}
                            >
                                <For each={wineDesktopFolderKeyOptions}>
                                    {(option) => <option value={option.value}>{option.label}</option>}
                                </For>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_shortcut_name_optional')}</label>
                            <Input
                                value={wineDesktopFolderDraft().shortcut_name}
                                onInput={(e) =>
                                    setWineDesktopFolderDraft({
                                        ...wineDesktopFolderDraft(),
                                        shortcut_name: e.currentTarget.value
                                    })
                                }
                                placeholder="My Custom Desktop"
                            />
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_target_relative_linux_path')}</label>
                            <Input
                                value={wineDesktopFolderDraft().linux_path}
                                onInput={(e) =>
                                    setWineDesktopFolderDraft({
                                        ...wineDesktopFolderDraft(),
                                        linux_path: e.currentTarget.value
                                    })
                                }
                                placeholder="../drive_c/users/Public/Desktop"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setWineDesktopFolderDialogOpen(false)}
                        >
                            {tForm().cancel}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                const draft = wineDesktopFolderDraft()
                                if (draft.linux_path) {
                                    patchConfig((prev) => ({
                                        ...prev,
                                        winecfg: {
                                            ...prev.winecfg,
                                            desktop_folders: [
                                                ...prev.winecfg.desktop_folders.filter((f) => f.folder_key !== draft.folder_key),
                                                {
                                                    folder_key: draft.folder_key,
                                                    shortcut_name: (draft.shortcut_name.trim() || null) as any,
                                                    linux_path: draft.linux_path.trim()
                                                }
                                            ]
                                        }
                                    }))
                                    setWineDesktopFolderDraft({
                                        folder_key: 'desktop',
                                        shortcut_name: '',
                                        linux_path: ''
                                    })
                                    setWineDesktopFolderDialogOpen(false)
                                }
                            }}
                            disabled={!wineDesktopFolderDraft().linux_path.trim()}
                        >
                            {tForm().add}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Wine Drive Dialog ─── */}
            <Dialog open={wineDriveDialogOpen()} onOpenChange={setWineDriveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_add_wine_drive')}</DialogTitle>
                        <DialogDescription>{tForm().addKeyValueDialogDescription}</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-4 py-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="grid gap-2">
                                <label class="text-sm font-medium">{ct('luthier_drive_letter')}</label>
                                <Select
                                    value={wineDriveDraft().letter}
                                    onInput={(e) => setWineDriveDraft({ ...wineDriveDraft(), letter: e.currentTarget.value })}
                                >
                                    <For each={availableWineDriveLetters()}>
                                        {(l) => <option value={l}>{l}:</option>}
                                    </For>
                                </Select>
                            </div>
                            <div class="grid gap-2">
                                <label class="text-sm font-medium">{ct('luthier_drive_type')}</label>
                                <Select
                                    value={wineDriveDraft().drive_type}
                                    onInput={(e) => setWineDriveDraft({ ...wineDriveDraft(), drive_type: e.currentTarget.value })}
                                >
                                    <For each={wineDriveTypeOptions}>
                                        {(option) => <option value={option.value}>{option.label}</option>}
                                    </For>
                                </Select>
                            </div>
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_host_path')}</label>
                            <Input
                                value={wineDriveDraft().host_path}
                                onInput={(e) =>
                                    setWineDriveDraft({ ...wineDriveDraft(), host_path: e.currentTarget.value })
                                }
                                placeholder="/run/media/user/Disk"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setWineDriveDialogOpen(false)}>
                            {tForm().cancel}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                const draft = wineDriveDraft()
                                if (draft.letter && draft.host_path) {
                                    patchConfig((prev) => ({
                                        ...prev,
                                        winecfg: {
                                            ...prev.winecfg,
                                            drives: [
                                                ...prev.winecfg.drives.filter(
                                                    (d) => d.letter.toUpperCase() !== draft.letter.toUpperCase()
                                                ),
                                                {
                                                    letter: draft.letter,
                                                    source_relative_path: '',
                                                    state: 'Enabled' as FeatureState,
                                                    host_path: draft.host_path.trim(),
                                                    drive_type: (draft.drive_type !== 'auto' ? draft.drive_type : null) as any,
                                                    label: null,
                                                    serial: null
                                                }
                                            ]
                                        }
                                    }))
                                    setWineDriveDraft({
                                        letter: availableWineDriveLetters()[0] || 'D',
                                        host_path: '',
                                        drive_type: 'auto',
                                        label: '',
                                        serial: ''
                                    })
                                    setWineDriveDialogOpen(false)
                                }
                            }}
                            disabled={!wineDriveDraft().letter || !wineDriveDraft().host_path.trim()}
                        >
                            {tForm().add}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
