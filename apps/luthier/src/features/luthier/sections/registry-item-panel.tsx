import { For, Show } from 'solid-js'
import { IconPlus, IconTrash } from '@tabler/icons-solidjs'

import { FieldShell } from '../../../components/form/FormControls'
import { Button } from '../../../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import type { LuthierPageSectionProps } from '../page-shared'

export function RegistryItemPanel(props: LuthierPageSectionProps) {
    const {
        config,
        patchConfig,
        ct,
        removeAt,
        setRegistryDialogOpen,
        canImportRegistryFromFile,
        importRegistryKeysFromRegFile,
    } = props.view

    return (
        <FieldShell
            label={ct('luthier_registry_keys')}
            help={ct('luthier_table_of_keys_applied_to_prefix_after_bootstrap')}
            controlClass="flex flex-wrap justify-end gap-2"
            footer={
                <Show
                    when={config().registry_keys.length > 0}
                    fallback={
                        <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                            {ct('luthier_no_key_added')}
                        </div>
                    }
                >
                    <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
                        <Table>
                            <TableHeader>
                                <TableRow class="hover:bg-transparent">
                                    <TableHead>{ct('luthier_path')}</TableHead>
                                    <TableHead>{ct('luthier_name')}</TableHead>
                                    <TableHead>{ct('luthier_type')}</TableHead>
                                    <TableHead>{ct('luthier_value')}</TableHead>
                                    <TableHead class="w-[72px] text-right">{ct('luthier_label_actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <For each={config().registry_keys}>
                                    {(item, index) => (
                                        <TableRow>
                                            <TableCell class="max-w-[260px] truncate font-medium">{item.path}</TableCell>
                                            <TableCell class="max-w-[180px] truncate">{item.name}</TableCell>
                                            <TableCell class="max-w-[120px] truncate text-xs text-muted-foreground">
                                                {item.value_type}
                                            </TableCell>
                                            <TableCell class="max-w-[260px] truncate text-muted-foreground">{item.value}</TableCell>
                                            <TableCell class="text-right">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() =>
                                                        patchConfig((prev) => ({
                                                            ...prev,
                                                            registry_keys: removeAt(prev.registry_keys, index())
                                                        }))
                                                    }
                                                    title={ct('luthier_remove_key')}
                                                >
                                                    <IconTrash class="size-4" />
                                                </Button>
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
            <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setRegistryDialogOpen(true)}>
                <IconPlus class="size-4" />
                {ct('luthier_add_key')}
            </Button>

            <Button
                type="button"
                variant="outline"
                size="sm"
                class="inline-flex items-center gap-1.5"
                onClick={importRegistryKeysFromRegFile}
                disabled={!canImportRegistryFromFile()}
            >
                <IconPlus class="size-4" />
                {ct('luthier_add_from_file_reg')}
            </Button>
        </FieldShell>
    )
}
