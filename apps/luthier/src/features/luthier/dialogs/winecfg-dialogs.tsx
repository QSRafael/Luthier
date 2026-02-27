import { createMemo, For, Show } from 'solid-js'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import type { LuthierPageSectionView } from '../page-shared'
import {
    validateDllName,
    validateLinuxPath,
    validateWindowsDriveSerial,
    validateWindowsFriendlyName
} from '../field-validation'

type WinecfgDialogsProps = {
    view: LuthierPageSectionView
}

export function WinecfgDialogs(props: WinecfgDialogsProps) {
    const { view } = props
    const {
        ct,
        config,
        patchConfig,
        dllDialogOpen,
        setDllDialogOpen,
        dllDraft,
        setDllDraft,
        wineDesktopFolderDialogOpen,
        setWineDesktopFolderDialogOpen,
        wineDesktopFolderDraft,
        setWineDesktopFolderDraft,
        wineDriveDialogOpen,
        setWineDriveDialogOpen,
        wineDriveDraft,
        setWineDriveDraft,
        wineDesktopFolderKeyOptions,
        wineDriveTypeOptions,
        availableWineDriveLetters,
        formControlsI18n,
        dllModeOptions,
        locale,
        setStatusMessage,
    } = view

    const tForm = () => formControlsI18n()

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

        </>
    )
}
