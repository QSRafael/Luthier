import { createMemo, For, Show } from 'solid-js'
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-solidjs'

import { WinecfgFeatureStateField } from '../../../../components/form/FormControls'
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Button } from '../../../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog'
import { Input } from '../../../../components/ui/input'
import { Select } from '../../../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table'
import { AccordionSection } from '../../creator-page-shared'
import type { WinecfgAccordionSectionProps } from './shared'
import { validateLinuxPath, validateWindowsFriendlyName } from '../../creator-field-validation'

export function WinecfgDesktopAccordionSection(props: WinecfgAccordionSectionProps) {
  const {
    config,
    patchConfig,
    ct,
    locale,
    removeAt,
    wineDesktopFolderDialogOpen,
    setWineDesktopFolderDialogOpen,
    wineDesktopFolderDraft,
    setWineDesktopFolderDraft,
    wineDesktopFolderKeyOptions,
  } = props.view
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

  return (
              <AccordionSection
                open={props.open}
                onToggle={props.onToggle}
                title={ct('creator_desktop_integration')}
                description={ct('creator_file_protocol_associations_and_wine_special_desktop_fold')}
              >
                <div class="grid gap-3">
                  <Alert variant="warning">
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_integration_can_affect_user_system_behavior')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_mime_protocol_associations_and_special_folders_can_chang')}
                    </AlertDescription>
                  </Alert>

                  <WinecfgFeatureStateField
                    label={ct('creator_desktop_integration_general')}
                    help={ct('creator_controls_wine_integration_with_the_linux_shell_desktop')}
                    value={config().winecfg.desktop_integration}
                    onChange={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        winecfg: { ...prev.winecfg, desktop_integration: value }
                      }))
                    }
                  />

                  <WinecfgFeatureStateField
                    label={ct('creator_mime_types_file_protocol_associations')}
                    help={ct('creator_equivalent_to_manage_file_and_protocol_associations')}
                    value={config().winecfg.mime_associations}
                    onChange={(value) =>
                      patchConfig((prev) => ({
                        ...prev,
                        winecfg: { ...prev.winecfg, mime_associations: value }
                      }))
                    }
                  />

                  <div class="rounded-xl border border-border/70 bg-card/70 p-3">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold">{ct('creator_special_folders')}</p>
                        <p class="text-xs text-muted-foreground">
                          {ct('creator_add_folder_shortcut_mappings_for_wine_optional_override')}
                        </p>
                      </div>
                      <Dialog open={wineDesktopFolderDialogOpen()} onOpenChange={setWineDesktopFolderDialogOpen}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          class="inline-flex items-center gap-1.5"
                          onClick={() => setWineDesktopFolderDialogOpen(true)}
                        >
                          <IconPlus class="size-4" />
                          {ct('creator_add_folder')}
                        </Button>

                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{ct('creator_add_wine_special_folder')}</DialogTitle>
                            <DialogDescription>
                              {ct('creator_set_folder_type_shortcut_name_and_linux_path')}
                            </DialogDescription>
                          </DialogHeader>

                          <div class="grid gap-2">
                            <Select
                              value={wineDesktopFolderDraft().folder_key}
                              onInput={(e) =>
                                setWineDesktopFolderDraft((prev: any) => ({ ...prev, folder_key: e.currentTarget.value }))
                              }
                            >
                              <For each={wineDesktopFolderKeyOptions}>
                                {(option) => <option value={option.value}>{option.label}</option>}
                              </For>
                            </Select>
                            <Input
                              value={wineDesktopFolderDraft().shortcut_name}
                              placeholder={ct('creator_shortcut_name_in_wine')}
                              class={shortcutNameValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                              onInput={(e) =>
                                setWineDesktopFolderDraft((prev: any) => ({ ...prev, shortcut_name: e.currentTarget.value }))
                              }
                            />
                            <Show when={shortcutNameValidation().error || shortcutNameValidation().hint}>
                              <p class={shortcutNameValidation().error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                {shortcutNameValidation().error ?? shortcutNameValidation().hint}
                              </p>
                            </Show>
                            <Input
                              value={wineDesktopFolderDraft().linux_path}
                              placeholder="/mnt/games/shared"
                              class={desktopFolderLinuxPathValidation().error ? 'border-destructive focus-visible:ring-destructive' : ''}
                              onInput={(e) =>
                                setWineDesktopFolderDraft((prev: any) => ({ ...prev, linux_path: e.currentTarget.value }))
                              }
                            />
                            <Show when={desktopFolderLinuxPathValidation().error || desktopFolderLinuxPathValidation().hint}>
                              <p class={desktopFolderLinuxPathValidation().error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                {desktopFolderLinuxPathValidation().error ?? desktopFolderLinuxPathValidation().hint}
                              </p>
                            </Show>
                            <p class="text-xs text-muted-foreground">
                              {ct('creator_prefer_generic_paths_without_a_fixed_username_when_possi')}
                            </p>
                          </div>

                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setWineDesktopFolderDialogOpen(false)}>
                              {ct('creator_label_cancel')}
                            </Button>
                            <Button
                              type="button"
                              disabled={
                                !wineDesktopFolderDraft().shortcut_name.trim() ||
                                !wineDesktopFolderDraft().linux_path.trim() ||
                                !!shortcutNameValidation().error ||
                                !!desktopFolderLinuxPathValidation().error
                              }
                              onClick={() => {
                                const draft = wineDesktopFolderDraft()
                                if (
                                  !draft.shortcut_name.trim() ||
                                  !draft.linux_path.trim() ||
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
                                      ...prev.winecfg.desktop_folders,
                                      {
                                        folder_key: draft.folder_key,
                                        shortcut_name: draft.shortcut_name.trim(),
                                        linux_path: draft.linux_path.trim()
                                      }
                                    ]
                                  }
                                }))
                                setWineDesktopFolderDraft({ folder_key: 'desktop', shortcut_name: '', linux_path: '' })
                                setWineDesktopFolderDialogOpen(false)
                              }}
                            >
                              {ct('creator_label_confirm')}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div class="mt-3">
                      <Show
                        when={config().winecfg.desktop_folders.length > 0}
                        fallback={
                          <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                            {ct('creator_no_special_folder_added')}
                          </div>
                        }
                      >
                        <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
                          <Table>
                            <TableHeader>
                              <TableRow class="hover:bg-transparent">
                                <TableHead>{ct('creator_type')}</TableHead>
                                <TableHead>{ct('creator_shortcut')}</TableHead>
                                <TableHead>{ct('creator_linux_path')}</TableHead>
                                <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <For each={config().winecfg.desktop_folders}>
                                {(item, index) => (
                                  <TableRow>
                                    <TableCell class="max-w-[120px] truncate font-medium">{item.folder_key}</TableCell>
                                    <TableCell class="max-w-[180px] truncate">{item.shortcut_name}</TableCell>
                                    <TableCell class="max-w-[320px] truncate text-muted-foreground">{item.linux_path}</TableCell>
                                    <TableCell class="text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() =>
                                          patchConfig((prev) => ({
                                            ...prev,
                                            winecfg: {
                                              ...prev.winecfg,
                                              desktop_folders: removeAt(prev.winecfg.desktop_folders, index())
                                            }
                                          }))
                                        }
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
                    </div>
                  </div>
                </div>
              </AccordionSection>
  )
}
