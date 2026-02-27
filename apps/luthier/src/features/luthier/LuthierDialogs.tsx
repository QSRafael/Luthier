import { createMemo, For, Show } from 'solid-js'
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
import { Spinner } from '../../components/ui/spinner'
import { type LuthierPageSectionProps, basenamePath, relativeInsideBase } from './page-shared'
import type { FeatureState } from '../../models/config'
import {
    validateCommandToken,
    validateEnvVarName,
    validateLinuxPath,
    validateRegistryPath,
    validateRegistryValueType,
    validateDllName,
    validateWindowsFriendlyName,
    validateWindowsDriveSerial
} from './field-validation'

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
        featureStateOptions,
        // game root chooser
        gameRoot,
        exePath,
        setGameRoot,
        setGameRootManualOverride,
        setGameRootChooserOpen,
        gameRootChooserOpen,
        gameRootAncestorCandidates,
        pickGameRootOverride,
        ctf,
        // integrity file browser
        integrityFileBrowserOpen,
        setIntegrityFileBrowserOpen,
        integrityBrowserPath,
        integrityBrowserDirs,
        integrityBrowserFiles,
        integrityBrowserLoading,
        integrityFileBrowserSegments,
        loadIntegrityBrowserEntries,
        resolveIntegrityFileBrowser,
        // mount source browser
        mountSourceBrowserOpen,
        setMountSourceBrowserOpen,
        mountBrowserDirs,
        mountBrowserLoading,
        mountSourceBrowserSegments,
        mountSourceBrowserCurrentRelative,
        loadMountBrowserDirs,
        locale,
        splitCommaList,
        setStatusMessage,
    } = view

    const tForm = () => formControlsI18n()

    const registryPathValidationSafe = createMemo(() =>
        registryDraft().path.trim() ? validateRegistryPath(registryDraft().path, locale()) : {}
    )
    const registryTypeValidation = createMemo(() =>
        registryDraft().value_type.trim() ? validateRegistryValueType(registryDraft().value_type, locale()) : {}
    )
    const registryDuplicateValidation = createMemo(() => {
        const path = registryDraft().path.trim().toLowerCase()
        const name = registryDraft().name.trim().toLowerCase()
        if (!path || !name) return ''
        const duplicate = config().registry_keys.some(
            (item) => item.path.trim().toLowerCase() === path && item.name.trim().toLowerCase() === name
        )
        if (!duplicate) return ''
        return ct('luthier_validation_duplicate_registry_key')
    })

    const extraDependencyCommandValidation = createMemo(() => {
        for (const token of splitCommaList(extraDependencyDraft().command || '')) {
            const result = validateCommandToken(token, locale())
            if (result.error) return result.error
        }
        return ''
    })
    const extraDependencyEnvVarsValidation = createMemo(() => {
        for (const token of splitCommaList(extraDependencyDraft().env_vars || '')) {
            const result = validateEnvVarName(token, locale())
            if (result.error) return result.error
        }
        return ''
    })
    const extraDependencyPathsValidation = createMemo(() => {
        for (const token of splitCommaList(extraDependencyDraft().paths || '')) {
            const result = validateLinuxPath(token, locale(), true)
            if (result.error) return result.error
        }
        return ''
    })
    const extraDependencyDuplicateValidation = createMemo(() => {
        const name = extraDependencyDraft().name.trim().toLowerCase()
        if (!name) return ''
        const duplicate = config().extra_system_dependencies.some(
            (item) => item.name.trim().toLowerCase() === name
        )
        if (!duplicate) return ''
        return ct('luthier_validation_duplicate_extra_dependency')
    })

    const dllValidation = createMemo(() =>
        dllDraft().dll.trim() ? validateDllName(dllDraft().dll, locale()) : {}
    )
    const dllDuplicateValidation = createMemo(() => {
        const dll = dllDraft().dll.trim().toLowerCase()
        if (!dll) return ''
        const duplicate = config().winecfg.dll_overrides.some((item) => item.dll.trim().toLowerCase() === dll)
        if (!duplicate) return ''
        return ct('luthier_validation_duplicate_dll_override')
    })

    const shortcutNameValidation = createMemo(() =>
        wineDesktopFolderDraft().shortcut_name.trim()
            ? validateWindowsFriendlyName(wineDesktopFolderDraft().shortcut_name, locale(), 'o nome do atalho', 'the shortcut name')
            : {}
    )
    const desktopFolderLinuxPathValidation = createMemo(() =>
        wineDesktopFolderDraft().linux_path.trim()
            ? validateLinuxPath(wineDesktopFolderDraft().linux_path, locale(), true)
            : {}
    )
    const desktopFolderDuplicateValidation = createMemo(() => {
        const key = wineDesktopFolderDraft().folder_key.trim().toLowerCase()
        if (!key) return ''
        const duplicate = config().winecfg.desktop_folders.some(
            (item) => item.folder_key.trim().toLowerCase() === key
        )
        if (!duplicate) return ''
        return ct('luthier_validation_duplicate_desktop_folder_type')
    })

    const wineDriveHostPathValidation = createMemo(() =>
        wineDriveDraft().host_path.trim() ? validateLinuxPath(wineDriveDraft().host_path, locale(), true) : {}
    )
    const wineDriveLabelValidation = createMemo(() =>
        wineDriveDraft().label.trim()
            ? validateWindowsFriendlyName(wineDriveDraft().label, locale(), 'o rótulo', 'the label')
            : {}
    )
    const wineDriveSerialValidation = createMemo(() =>
        wineDriveDraft().serial.trim() ? validateWindowsDriveSerial(wineDriveDraft().serial, locale()) : {}
    )

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
                                class={registryPathValidationSafe().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                                onInput={(e) =>
                                    setRegistryDraft({ ...registryDraft(), path: e.currentTarget.value })
                                }
                                placeholder="HKEY_CURRENT_USER\Software\Wine"
                            />
                            <Show when={registryPathValidationSafe().error || registryPathValidationSafe().hint}>
                                <p class={registryPathValidationSafe().error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                    {registryPathValidationSafe().error ?? registryPathValidationSafe().hint}
                                </p>
                            </Show>
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
                        <Show when={registryTypeValidation().error || registryTypeValidation().hint}>
                            <p class={registryTypeValidation().error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                {registryTypeValidation().error ?? registryTypeValidation().hint}
                            </p>
                        </Show>
                        <Show when={registryDuplicateValidation()}>
                            <p class="text-xs text-destructive">{registryDuplicateValidation()}</p>
                        </Show>
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
                            disabled={
                                !registryDraft().path.trim() ||
                                !registryDraft().name.trim() ||
                                !!registryPathValidationSafe().error ||
                                !!registryTypeValidation().error ||
                                !!registryDuplicateValidation()
                            }
                            onClick={() => {
                                const draft = registryDraft()
                                if (
                                    !draft.path.trim() ||
                                    !draft.name.trim() ||
                                    registryPathValidationSafe().error ||
                                    registryTypeValidation().error ||
                                    registryDuplicateValidation()
                                ) {
                                    return
                                }
                                patchConfig((prev) => ({
                                    ...prev,
                                    registry_keys: [
                                        ...prev.registry_keys,
                                        {
                                            ...draft,
                                            path: draft.path.trim().replace(/\//g, '\\'),
                                            name: draft.name.trim(),
                                            value_type: draft.value_type.trim().toUpperCase() || 'REG_SZ'
                                        }
                                    ]
                                }))
                                setRegistryDraft({ path: '', name: '', value_type: 'REG_SZ', value: '' })
                                setRegistryDialogOpen(false)
                            }}
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
                                class={dllValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                                onInput={(e) => setDllDraft({ ...dllDraft(), dll: e.currentTarget.value })}
                                placeholder="d3d11"
                            />
                            <Show when={dllValidation().error || dllValidation().hint}>
                                <p class={dllValidation().error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                    {dllValidation().error ?? dllValidation().hint}
                                </p>
                            </Show>
                            <Show when={dllDuplicateValidation()}>
                                <p class="text-xs text-destructive">{dllDuplicateValidation()}</p>
                            </Show>
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
                            disabled={!dllDraft().dll.trim() || !!dllValidation().error || !!dllDuplicateValidation()}
                            onClick={() => {
                                const draft = dllDraft()
                                if (!draft.dll.trim() || dllValidation().error || dllDuplicateValidation()) return
                                patchConfig((prev) => ({
                                    ...prev,
                                    winecfg: {
                                        ...prev.winecfg,
                                        dll_overrides: [
                                            ...prev.winecfg.dll_overrides,
                                            {
                                                ...draft,
                                                dll: draft.dll.trim()
                                            }
                                        ]
                                    }
                                }))
                                setDllDraft({ dll: '', mode: 'builtin' })
                                setDllDialogOpen(false)
                            }}
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
                                class={extraDependencyDuplicateValidation() ? 'border-destructive focus-visible:ring-destructive' : ''}
                                onInput={(e) =>
                                    setExtraDependencyDraft({ ...extraDependencyDraft(), name: e.currentTarget.value })
                                }
                                placeholder="libgl1-mesa-glx"
                            />
                            <Show when={extraDependencyDuplicateValidation()}>
                                <p class="text-xs text-destructive">{extraDependencyDuplicateValidation()}</p>
                            </Show>
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_test_command_optional')}</label>
                            <Input
                                value={extraDependencyDraft().command}
                                class={extraDependencyCommandValidation() ? 'border-destructive focus-visible:ring-destructive' : ''}
                                onInput={(e) =>
                                    setExtraDependencyDraft({
                                        ...extraDependencyDraft(),
                                        command: e.currentTarget.value
                                    })
                                }
                                placeholder={ct('luthier_terminal_command_e_g_mangohud')}
                            />
                            <Show when={extraDependencyCommandValidation()}>
                                <p class="text-xs text-destructive">{extraDependencyCommandValidation()}</p>
                            </Show>
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_env_vars')}</label>
                            <Input
                                value={extraDependencyDraft().env_vars}
                                class={extraDependencyEnvVarsValidation() ? 'border-destructive focus-visible:ring-destructive' : ''}
                                onInput={(e) =>
                                    setExtraDependencyDraft({
                                        ...extraDependencyDraft(),
                                        env_vars: e.currentTarget.value
                                    })
                                }
                                placeholder={ct('luthier_environment_vars_comma_separated')}
                            />
                            <Show when={extraDependencyEnvVarsValidation()}>
                                <p class="text-xs text-destructive">{extraDependencyEnvVarsValidation()}</p>
                            </Show>
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_default_paths')}</label>
                            <Input
                                value={extraDependencyDraft().paths}
                                class={extraDependencyPathsValidation() ? 'border-destructive focus-visible:ring-destructive' : ''}
                                onInput={(e) =>
                                    setExtraDependencyDraft({
                                        ...extraDependencyDraft(),
                                        paths: e.currentTarget.value
                                    })
                                }
                                placeholder={ct('luthier_default_paths_comma_separated')}
                            />
                            <Show when={extraDependencyPathsValidation()}>
                                <p class="text-xs text-destructive">{extraDependencyPathsValidation()}</p>
                            </Show>

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
                            disabled={
                                !extraDependencyDraft().name.trim() ||
                                !!extraDependencyDuplicateValidation() ||
                                !!extraDependencyCommandValidation() ||
                                !!extraDependencyEnvVarsValidation() ||
                                !!extraDependencyPathsValidation()
                            }
                            onClick={() => {
                                const draft = extraDependencyDraft()
                                if (
                                    !draft.name.trim() ||
                                    extraDependencyDuplicateValidation() ||
                                    extraDependencyCommandValidation() ||
                                    extraDependencyEnvVarsValidation() ||
                                    extraDependencyPathsValidation()
                                ) {
                                    return
                                }
                                patchConfig((prev) => ({
                                    ...prev,
                                    extra_system_dependencies: [
                                        ...prev.extra_system_dependencies,
                                        {
                                            name: draft.name.trim(),
                                            check_commands: splitCommaList(draft.command),
                                            check_env_vars: splitCommaList(draft.env_vars),
                                            check_paths: splitCommaList(draft.paths),
                                            state: 'Enabled' as FeatureState
                                        }
                                    ]
                                }))
                                setExtraDependencyDraft({ name: '', command: '', env_vars: '', paths: '' })
                                setExtraDependencyDialogOpen(false)
                            }}
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
                                class={shortcutNameValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                                onInput={(e) =>
                                    setWineDesktopFolderDraft({
                                        ...wineDesktopFolderDraft(),
                                        shortcut_name: e.currentTarget.value
                                    })
                                }
                                placeholder="My Custom Desktop"
                            />
                            <Show when={shortcutNameValidation().error || shortcutNameValidation().hint}>
                                <p class={shortcutNameValidation().error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                    {shortcutNameValidation().error ?? shortcutNameValidation().hint}
                                </p>
                            </Show>
                        </div>
                        <div class="grid gap-2">
                            <label class="text-sm font-medium">{ct('luthier_target_relative_linux_path')}</label>
                            <Input
                                value={wineDesktopFolderDraft().linux_path}
                                class={desktopFolderLinuxPathValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                                onInput={(e) =>
                                    setWineDesktopFolderDraft({
                                        ...wineDesktopFolderDraft(),
                                        linux_path: e.currentTarget.value
                                    })
                                }
                                placeholder="/mnt/games/shared"
                            />
                            <Show when={desktopFolderLinuxPathValidation().error || desktopFolderLinuxPathValidation().hint}>
                                <p class={desktopFolderLinuxPathValidation().error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                    {desktopFolderLinuxPathValidation().error ?? desktopFolderLinuxPathValidation().hint}
                                </p>
                            </Show>
                            <Show when={desktopFolderDuplicateValidation()}>
                                <p class="text-xs text-destructive">{desktopFolderDuplicateValidation()}</p>
                            </Show>
                            <p class="text-xs text-muted-foreground">
                                {ct('luthier_prefer_generic_paths_without_a_fixed_username_when_possi')}
                            </p>
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
                            disabled={
                                !wineDesktopFolderDraft().shortcut_name.trim() ||
                                !wineDesktopFolderDraft().linux_path.trim() ||
                                !!desktopFolderDuplicateValidation() ||
                                !!shortcutNameValidation().error ||
                                !!desktopFolderLinuxPathValidation().error
                            }
                            onClick={() => {
                                const draft = wineDesktopFolderDraft()
                                if (
                                    !draft.shortcut_name.trim() ||
                                    !draft.linux_path.trim() ||
                                    desktopFolderDuplicateValidation() ||
                                    shortcutNameValidation().error ||
                                    desktopFolderLinuxPathValidation().error
                                ) {
                                    return
                                }
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
                            }}
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
                                class={wineDriveHostPathValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                                onInput={(e) =>
                                    setWineDriveDraft({ ...wineDriveDraft(), host_path: e.currentTarget.value })
                                }
                                placeholder="/run/media/user/Disk"
                            />
                            <Show when={wineDriveHostPathValidation().error || wineDriveHostPathValidation().hint}>
                                <p class={wineDriveHostPathValidation().error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                    {wineDriveHostPathValidation().error ?? wineDriveHostPathValidation().hint}
                                </p>
                            </Show>
                        </div>
                        <div class="grid gap-2 md:grid-cols-2 mt-2">
                            <div class="grid gap-2">
                                <label class="text-sm font-medium">{ct('luthier_label_optional')}</label>
                                <Input
                                    value={wineDriveDraft().label}
                                    class={wineDriveLabelValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                                    onInput={(e) => setWineDriveDraft((prev: any) => ({ ...prev, label: e.currentTarget.value }))}
                                />
                            </div>
                            <div class="grid gap-2">
                                <label class="text-sm font-medium">{ct('luthier_serial_optional')}</label>
                                <Input
                                    value={wineDriveDraft().serial}
                                    class={wineDriveSerialValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                                    onInput={(e) => setWineDriveDraft((prev: any) => ({ ...prev, serial: e.currentTarget.value }))}
                                />
                            </div>
                        </div>
                        <Show when={wineDriveLabelValidation().error || wineDriveLabelValidation().hint}>
                            <p class={wineDriveLabelValidation().error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                {wineDriveLabelValidation().error ?? wineDriveLabelValidation().hint}
                            </p>
                        </Show>
                        <Show when={wineDriveSerialValidation().error || wineDriveSerialValidation().hint}>
                            <p class={wineDriveSerialValidation().error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                {wineDriveSerialValidation().error ?? wineDriveSerialValidation().hint}
                            </p>
                        </Show>
                        <p class="text-xs text-muted-foreground mt-2">
                            {ct('luthier_use_a_generic_linux_directory_when_possible_avoid_user_s')}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setWineDriveDialogOpen(false)}>
                            {tForm().cancel}
                        </Button>
                        <Button
                            type="button"
                            disabled={
                                !wineDriveDraft().letter.trim() ||
                                !wineDriveDraft().host_path.trim() ||
                                !!wineDriveHostPathValidation().error ||
                                !!wineDriveLabelValidation().error ||
                                !!wineDriveSerialValidation().error
                            }
                            onClick={() => {
                                const draft = wineDriveDraft()
                                const letter = draft.letter.trim().toUpperCase()
                                if (
                                    !letter ||
                                    !draft.host_path.trim() ||
                                    wineDriveHostPathValidation().error ||
                                    wineDriveLabelValidation().error ||
                                    wineDriveSerialValidation().error
                                ) {
                                    return
                                }
                                if (config().winecfg.drives.some((item) => item.letter.trim().toUpperCase() === letter)) {
                                    setStatusMessage(ct('luthier_that_drive_letter_is_already_in_use'))
                                    return
                                }
                                patchConfig((prev) => ({
                                    ...prev,
                                    winecfg: {
                                        ...prev.winecfg,
                                        drives: [
                                            ...prev.winecfg.drives.filter(
                                                (d) => d.letter.toUpperCase() !== letter
                                            ),
                                            {
                                                letter,
                                                source_relative_path: '',
                                                state: 'OptionalOn',
                                                host_path: draft.host_path.trim(),
                                                drive_type: (draft.drive_type !== 'auto' ? draft.drive_type : null) as any,
                                                label: draft.label.trim() ? draft.label.trim() : null,
                                                serial: draft.serial.trim() ? draft.serial.trim() : null
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
                            }}
                        >
                            {tForm().add}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Game Root Chooser Dialog ─── */}
            <Dialog open={gameRootChooserOpen()} onOpenChange={setGameRootChooserOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_choose_game_root_folder')}</DialogTitle>
                        <DialogDescription>
                            {ct('luthier_the_game_root_must_be_an_ancestor_of_the_folder_that_con')}
                        </DialogDescription>
                    </DialogHeader>

                    <Show
                        when={gameRootAncestorCandidates().length > 0}
                        fallback={
                            <div class="grid gap-3">
                                <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                                    {ct('luthier_this_guided_flow_requires_an_absolute_executable_path_lo')}
                                </div>
                                <div class="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={async () => {
                                            setGameRootChooserOpen(false)
                                            await pickGameRootOverride()
                                        }}
                                    >
                                        {ct('luthier_use_system_picker')}
                                    </Button>
                                </div>
                            </div>
                        }
                    >
                        <div class="grid gap-3">
                            <div class="rounded-md border border-border/60 bg-muted/25 p-3">
                                <p class="mb-2 text-xs font-medium text-muted-foreground">
                                    {ct('luthier_executable_folder_breadcrumb')}
                                </p>
                                <nav class="overflow-x-auto" aria-label={ct('luthier_executable_path')}>
                                    <ol class="flex min-w-max items-center gap-1 text-xs">
                                        <For each={gameRootAncestorCandidates()}>
                                            {(candidate, index) => (
                                                <>
                                                    <Show when={index() > 0}>
                                                        <li class="text-muted-foreground">/</li>
                                                    </Show>
                                                    <li>
                                                        <Button
                                                            type="button"
                                                            variant={gameRoot() === candidate ? 'secondary' : 'ghost'}
                                                            size="sm"
                                                            class="h-7 px-2"
                                                            onClick={() => {
                                                                const exeDir = basenamePath(exePath())
                                                                setGameRootManualOverride(candidate !== exeDir)
                                                                setGameRoot(candidate)
                                                                setGameRootChooserOpen(false)
                                                            }}
                                                        >
                                                            {basenamePath(candidate) || '/'}
                                                        </Button>
                                                    </li>
                                                </>
                                            )}
                                        </For>
                                    </ol>
                                </nav>
                            </div>

                            <div class="grid gap-2">
                                <p class="text-xs font-medium text-muted-foreground">
                                    {ct('luthier_select_which_ancestor_level_should_be_the_game_root')}
                                </p>
                                <div class="grid gap-2">
                                    <For each={[...gameRootAncestorCandidates()].reverse()}>
                                        {(candidate) => {
                                            const isAutoRoot = candidate === basenamePath(exePath())
                                            const relativeToExe = relativeInsideBase(candidate, exePath())
                                            return (
                                                <button
                                                    type="button"
                                                    class={
                                                        'grid gap-1 rounded-md border px-3 py-2 text-left transition-colors ' +
                                                        (gameRoot() === candidate
                                                            ? 'border-primary/40 bg-muted/45'
                                                            : 'border-border/60 bg-muted/20 hover:bg-muted/35')
                                                    }
                                                    onClick={() => {
                                                        setGameRootManualOverride(!isAutoRoot)
                                                        setGameRoot(candidate)
                                                        setGameRootChooserOpen(false)
                                                    }}
                                                >
                                                    <span class="text-sm font-medium">{candidate}</span>
                                                    <span class="text-xs text-muted-foreground">
                                                        {isAutoRoot
                                                            ? ct('luthier_same_directory_as_executable_automatic')
                                                            : ctf('luthier_executable_lives_in_relative_path', { path: relativeToExe ?? '' })}
                                                    </span>
                                                </button>
                                            )
                                        }}
                                    </For>
                                </div>
                            </div>
                        </div>
                    </Show>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setGameRootChooserOpen(false)}>
                            {ct('luthier_close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Integrity File Browser Dialog ─── */}
            <Dialog
                open={integrityFileBrowserOpen?.() ?? false}
                onOpenChange={(open: boolean) => {
                    setIntegrityFileBrowserOpen?.(open)
                    if (!open) resolveIntegrityFileBrowser?.(null)
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_select_file_inside_game')}</DialogTitle>
                        <DialogDescription>
                            {ct('luthier_mini_file_browser_restricted_to_the_game_root_to_prevent')}
                        </DialogDescription>
                    </DialogHeader>

                    <div class="grid gap-3">
                        <div class="rounded-md border border-border/60 bg-muted/25 p-3">
                            <p class="mb-2 text-xs font-medium text-muted-foreground">
                                {ct('luthier_current_path')}
                            </p>
                            <nav class="overflow-x-auto" aria-label={ct('luthier_folder_breadcrumb')}>
                                <ol class="flex min-w-max items-center gap-1 text-xs">
                                    <Show when={gameRoot().trim()}>
                                        <li>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2"
                                                onClick={() => void loadIntegrityBrowserEntries?.(gameRoot())}
                                            >
                                                {basenamePath(gameRoot()) || '/'}
                                            </Button>
                                        </li>
                                    </Show>
                                    <For each={integrityFileBrowserSegments?.() ?? []}>
                                        {(segment) => (
                                            <>
                                                <li class="text-muted-foreground">/</li>
                                                <li>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        class="h-7 px-2"
                                                        onClick={() => void loadIntegrityBrowserEntries?.(segment.path)}
                                                    >
                                                        {segment.label}
                                                    </Button>
                                                </li>
                                            </>
                                        )}
                                    </For>
                                </ol>
                            </nav>
                        </div>

                        <div class="rounded-md border border-border/60 bg-background/40">
                            <Show
                                when={!(integrityBrowserLoading?.() ?? false)}
                                fallback={
                                    <div class="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                                        <Spinner class="size-3" />
                                        {ct('luthier_loading_files')}
                                    </div>
                                }
                            >
                                <div class="grid gap-2 p-2">
                                    <div class="grid gap-1">
                                        <p class="px-1 text-xs font-medium text-muted-foreground">{ct('luthier_folders')}</p>
                                        <Show
                                            when={(integrityBrowserDirs?.() ?? []).length > 0}
                                            fallback={
                                                <div class="px-2 py-1 text-xs text-muted-foreground">
                                                    {ct('luthier_no_subfolder_found')}
                                                </div>
                                            }
                                        >
                                            <For each={integrityBrowserDirs?.() ?? []}>
                                                {(dir) => (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        class="justify-start text-left"
                                                        onClick={() => void loadIntegrityBrowserEntries?.(dir)}
                                                    >
                                                        {basenamePath(dir)}
                                                    </Button>
                                                )}
                                            </For>
                                        </Show>
                                    </div>

                                    <div class="grid gap-1 border-t border-border/60 pt-2">
                                        <p class="px-1 text-xs font-medium text-muted-foreground">{ct('luthier_files')}</p>
                                        <Show
                                            when={(integrityBrowserFiles?.() ?? []).length > 0}
                                            fallback={
                                                <div class="px-2 py-1 text-xs text-muted-foreground">
                                                    {ct('luthier_no_file_found_in_current_folder')}
                                                </div>
                                            }
                                        >
                                            <For each={integrityBrowserFiles?.() ?? []}>
                                                {(file) => {
                                                    const relative = relativeInsideBase(gameRoot().trim(), file)
                                                    return (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            class="justify-start text-left"
                                                            onClick={() => {
                                                                if (!relative) return
                                                                resolveIntegrityFileBrowser?.(`./${relative}`)
                                                                setIntegrityFileBrowserOpen?.(false)
                                                            }}
                                                        >
                                                            {basenamePath(file)}
                                                        </Button>
                                                    )
                                                }}
                                            </For>
                                        </Show>
                                    </div>
                                </div>
                            </Show>
                        </div>

                        <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            {ct('luthier_select_a_file_to_fill_this_field_automatically')}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIntegrityFileBrowserOpen?.(false)
                                resolveIntegrityFileBrowser?.(null)
                            }}
                        >
                            {ct('luthier_close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Mount Source Browser Dialog ─── */}
            <Dialog open={mountSourceBrowserOpen()} onOpenChange={setMountSourceBrowserOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{ct('luthier_select_folder_inside_game')}</DialogTitle>
                        <DialogDescription>
                            {ct('luthier_mini_browser_restricted_to_the_game_root_to_prevent_moun')}
                        </DialogDescription>
                    </DialogHeader>

                    <div class="grid gap-3">
                        <div class="rounded-md border border-border/60 bg-muted/25 p-3">
                            <p class="mb-2 text-xs font-medium text-muted-foreground">
                                {ct('luthier_current_path')}
                            </p>
                            <nav class="overflow-x-auto" aria-label={ct('luthier_folder_breadcrumb')}>
                                <ol class="flex min-w-max items-center gap-1 text-xs">
                                    <Show when={gameRoot().trim()}>
                                        <li>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2"
                                                onClick={() => void loadMountBrowserDirs(gameRoot())}
                                            >
                                                {basenamePath(gameRoot()) || '/'}
                                            </Button>
                                        </li>
                                    </Show>
                                    <For each={mountSourceBrowserSegments()}>
                                        {(segment) => (
                                            <>
                                                <li class="text-muted-foreground">/</li>
                                                <li>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        class="h-7 px-2"
                                                        onClick={() => void loadMountBrowserDirs(segment.path)}
                                                    >
                                                        {segment.label}
                                                    </Button>
                                                </li>
                                            </>
                                        )}
                                    </For>
                                </ol>
                            </nav>
                        </div>

                        <div class="rounded-md border border-border/60 bg-background/40">
                            <Show
                                when={!mountBrowserLoading()}
                                fallback={
                                    <div class="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                                        <Spinner class="size-3" />
                                        {ct('luthier_loading_folders')}
                                    </div>
                                }
                            >
                                <Show
                                    when={mountBrowserDirs().length > 0}
                                    fallback={
                                        <div class="px-3 py-2 text-xs text-muted-foreground">
                                            {ct('luthier_no_subfolder_found')}
                                        </div>
                                    }
                                >
                                    <div class="grid gap-1 p-1">
                                        <For each={mountBrowserDirs()}>
                                            {(dir) => (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    class="justify-start text-left"
                                                    onClick={() => void loadMountBrowserDirs(dir)}
                                                >
                                                    {basenamePath(dir)}
                                                </Button>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </Show>
                        </div>

                        <div class="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                            <div class="min-w-0">
                                <p class="text-xs font-medium text-muted-foreground">{ct('luthier_select_this_folder')}</p>
                                <p class="truncate text-xs">{mountSourceBrowserCurrentRelative() || './'}</p>
                            </div>
                            <Button
                                type="button"
                                onClick={() => {
                                    setMountDraft((prev: any) => ({
                                        ...prev,
                                        source_relative_path: mountSourceBrowserCurrentRelative() || './'
                                    }))
                                    setMountSourceBrowserOpen(false)
                                }}
                            >
                                {ct('luthier_use_this_folder')}
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setMountSourceBrowserOpen(false)}>
                            {ct('luthier_close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
