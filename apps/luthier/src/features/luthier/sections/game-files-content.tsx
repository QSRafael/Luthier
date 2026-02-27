import { For, Show } from 'solid-js'
import { IconPlus, IconTrash } from '@tabler/icons-solidjs'

import {
    FieldShell,
    StringListField,
} from '../../../components/form/FormControls'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import type { LuthierPageSectionProps } from '../page-shared'
import { validateRelativeGamePath } from '../field-validation'

export function GameFilesContent(props: LuthierPageSectionProps) {
    const {
        gameRootManualOverride,
        gameRootRelativeDisplay,
        exeInsideGameRoot,
        setStatusMessage,
        config,
        patchConfig,
        ct,
        locale,
        prefixPathPreview,
        removeAt,
        pickIntegrityFileRelative,
        pickIntegrityFileRelativeWithBrowser,
        pickMountFolder,
        setMountDialogOpen,
        canChooseGameRoot,
        canPickIntegrityFromGameRoot,
        canAddMount,
        openGameRootChooser,
    } = props.view

    return (
        <>
            <FieldShell
                label={ct('luthier_game_root_folder')}
                help={ct('luthier_defaults_to_the_main_executable_folder_but_can_be_change')}
                hint={
                    !exeInsideGameRoot()
                        ? ct('luthier_game_root_hint_invalid_exe_outside_root')
                        : gameRootManualOverride()
                            ? ct('luthier_game_root_hint_manual_override')
                            : ct('luthier_game_root_hint_auto')
                }
            >
                <div class="picker-row">
                    <Input value={gameRootRelativeDisplay()} placeholder="./" readOnly class="readonly" />
                    <Button type="button" variant="outline" onClick={openGameRootChooser} disabled={!canChooseGameRoot()}>
                        {ct('luthier_choose_another')}
                    </Button>
                </div>
            </FieldShell>

            <FieldShell
                label={ct('luthier_final_prefix_path')}
                help={ct('luthier_automatically_calculated_from_executable_hash')}
            >
                <div class="picker-row">
                    <Input value={prefixPathPreview()} readOnly class="readonly" />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(prefixPathPreview())
                                setStatusMessage(ct('luthier_prefix_path_copied'))
                            } catch {
                                setStatusMessage(ct('luthier_failed_to_copy_to_clipboard'))
                            }
                        }}
                    >
                        {ct('luthier_copy')}
                    </Button>
                </div>
            </FieldShell>

            <StringListField
                label={ct('luthier_launch_arguments')}
                help={ct('luthier_extra_arguments_passed_to_game_executable')}
                items={config().launch_args}
                onChange={(items) => patchConfig((prev) => ({ ...prev, launch_args: items }))}
                placeholder={ct('luthier_windowed')}
                addLabel={ct('luthier_add_argument')}
                emptyMessage={ct('luthier_no_launch_argument_added')}
                tableValueHeader={ct('luthier_argument')}
            />

            <StringListField
                label={ct('luthier_required_files')}
                help={ct('luthier_if_any_listed_file_is_missing_from_the_game_folder_start')}
                items={config().integrity_files}
                onChange={(items) => patchConfig((prev) => ({ ...prev, integrity_files: items }))}
                placeholder={ct('luthier_data_core_dll')}
                addLabel={ct('luthier_add_file')}
                pickerLabel={ct('luthier_pick_file_from_game_folder')}
                onPickValue={pickIntegrityFileRelativeWithBrowser ?? pickIntegrityFileRelative}
                pickerDisabled={!canPickIntegrityFromGameRoot()}
                emptyMessage={ct('luthier_no_file_added')}
                tableValueHeader={ct('luthier_relative_file')}
                validateDraft={(value, items) => {
                    if (!value.trim()) return undefined
                    const validation = validateRelativeGamePath(value, locale(), {
                        kind: 'file',
                        allowDot: false,
                        requireDotPrefix: true
                    })
                    if (validation.error) return validation
                    const duplicate = items.some((item) => item.trim() === value.trim())
                    if (duplicate) {
                        return { error: ct('luthier_validation_duplicate_required_file') }
                    }
                    return validation.hint ? validation : undefined
                }}
            />

            <FieldShell
                label={ct('luthier_mounted_folders')}
                help={ct('luthier_maps_a_folder_inside_the_game_to_a_windows_target_inside')}
                controlClass="flex justify-end"
                footer={
                    <Show
                        when={config().folder_mounts.length > 0}
                        fallback={
                            <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                                {ct('luthier_no_mount_added')}
                            </div>
                        }
                    >
                        <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
                            <Table>
                                <TableHeader>
                                    <TableRow class="hover:bg-transparent">
                                        <TableHead>{ct('luthier_relative_source')}</TableHead>
                                        <TableHead>{ct('luthier_windows_target')}</TableHead>
                                        <TableHead>{ct('luthier_create_source')}</TableHead>
                                        <TableHead class="w-[120px] text-right">{ct('luthier_label_actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <For each={config().folder_mounts}>
                                        {(item, index) => (
                                            <TableRow>
                                                <TableCell class="max-w-[220px] truncate font-medium">
                                                    {item.source_relative_path}
                                                </TableCell>
                                                <TableCell class="max-w-[280px] truncate text-muted-foreground">
                                                    {item.target_windows_path}
                                                </TableCell>
                                                <TableCell class="text-xs text-muted-foreground">
                                                    {item.create_source_if_missing ? ct('luthier_yes') : ct('luthier_no')}
                                                </TableCell>
                                                <TableCell class="text-right">
                                                    <div class="flex items-center justify-end gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            class="h-8 px-2 text-xs"
                                                            onClick={() => void pickMountFolder(index())}
                                                        >
                                                            {ct('luthier_folder')}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                            onClick={() =>
                                                                patchConfig((prev) => ({
                                                                    ...prev,
                                                                    folder_mounts: removeAt(prev.folder_mounts, index())
                                                                }))
                                                            }
                                                            title={ct('luthier_remove_mount')}
                                                        >
                                                            <IconTrash class="size-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </For>
                                </TableBody>
                            </Table>
                        </div>
                    </Show>
                }
            >
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    class="inline-flex items-center gap-1.5"
                    onClick={() => setMountDialogOpen(true)}
                    disabled={!canAddMount()}
                >
                    <IconPlus class="size-4" />
                    {ct('luthier_add_folder_mount')}
                </Button>
            </FieldShell>
        </>
    )
}
