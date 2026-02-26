import { For, Show } from 'solid-js'
import { IconPlus, IconTrash } from '@tabler/icons-solidjs'

import { FieldShell } from '../../../../components/form/FormControls'
import { Button } from '../../../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog'
import { Input } from '../../../../components/ui/input'
import { Select } from '../../../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table'
import type { WinecfgSectionViewProps } from './shared'

export function WinecfgDllOverridesItem(props: WinecfgSectionViewProps) {
  const { config, patchConfig, ct, dllModeOptions, replaceAt, removeAt, dllDialogOpen, setDllDialogOpen, dllDraft, setDllDraft } = props.view

  return (
            <FieldShell
              label={ct('creator_dll_overrides')}
              help={ct('creator_configures_per_dll_overrides_such_as_native_builtin')}
              controlClass="flex justify-end"
              footer={
                <Show
                  when={config().winecfg.dll_overrides.length > 0}
                  fallback={
                    <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                      {ct('creator_no_override_added')}
                    </div>
                  }
                >
                  <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
                    <Table>
                      <TableHeader>
                        <TableRow class="hover:bg-transparent">
                          <TableHead>{ct('creator_dll')}</TableHead>
                          <TableHead>{ct('creator_mode')}</TableHead>
                          <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={config().winecfg.dll_overrides}>
                          {(item, index) => (
                            <TableRow>
                              <TableCell class="max-w-[260px] truncate font-medium">{item.dll}</TableCell>
                              <TableCell class="w-[220px]">
                                <Select
                                  value={item.mode}
                                  onInput={(e) =>
                                    patchConfig((prev) => ({
                                      ...prev,
                                      winecfg: {
                                        ...prev.winecfg,
                                        dll_overrides: replaceAt(prev.winecfg.dll_overrides, index(), {
                                          ...prev.winecfg.dll_overrides[index()],
                                          mode: e.currentTarget.value
                                        })
                                      }
                                    }))
                                  }
                                >
                                  <For each={dllModeOptions()}>
                                    {(option) => <option value={option.value}>{option.label}</option>}
                                  </For>
                                </Select>
                              </TableCell>
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
                                        dll_overrides: removeAt(prev.winecfg.dll_overrides, index())
                                      }
                                    }))
                                  }
                                  title={ct('creator_label_remove')}
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
              <Dialog open={dllDialogOpen()} onOpenChange={setDllDialogOpen}>
                <Button type="button" variant="outline" size="sm" class="inline-flex items-center gap-1.5" onClick={() => setDllDialogOpen(true)}>
                  <IconPlus class="size-4" />
                  {ct('creator_add_dll_override')}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{ct('creator_add_dll_override')}</DialogTitle>
                    <DialogDescription>
                      {ct('creator_set_the_dll_name_and_override_mode')}
                    </DialogDescription>
                  </DialogHeader>

                  <div class="grid gap-2">
                    <Input
                      value={dllDraft().dll}
                      placeholder="d3dcompiler_47"
                      onInput={(e) =>
                        setDllDraft((prev: any) => ({
                          ...prev,
                          dll: e.currentTarget.value
                        }))
                      }
                    />
                    <Select
                      value={dllDraft().mode}
                      onInput={(e) =>
                        setDllDraft((prev: any) => ({
                          ...prev,
                          mode: e.currentTarget.value
                        }))
                      }
                    >
                      <For each={dllModeOptions()}>{(option) => <option value={option.value}>{option.label}</option>}</For>
                    </Select>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDllDialogOpen(false)}>
                      {ct('creator_label_cancel')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!dllDraft().dll.trim()}
                      onClick={() => {
                        const draft = dllDraft()
                        if (!draft.dll.trim()) return
                        patchConfig((prev) => ({
                          ...prev,
                          winecfg: {
                            ...prev.winecfg,
                            dll_overrides: [...prev.winecfg.dll_overrides, draft]
                          }
                        }))
                        setDllDraft({ dll: '', mode: 'builtin' })
                        setDllDialogOpen(false)
                      }}
                    >
                      {ct('creator_label_confirm')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </FieldShell>
  )
}
