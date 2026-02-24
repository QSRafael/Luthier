import { For, Show } from 'solid-js'
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-solidjs'

import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Button } from '../../../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog'
import { Input } from '../../../../components/ui/input'
import { Select } from '../../../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table'
import { AccordionSection } from '../../creator-page-shared'
import type { WinecfgAccordionSectionProps } from './shared'

export function WinecfgDrivesAccordionSection(props: WinecfgAccordionSectionProps) {
  const { setStatusMessage, config, patchConfig, ct, removeAt, wineDriveDialogOpen, setWineDriveDialogOpen, wineDriveDraft, setWineDriveDraft, wineDriveTypeOptions, availableWineDriveLetters } = props.view

  return (
              <AccordionSection
                open={props.open}
                onToggle={props.onToggle}
                title={ct('creator_drives')}
                description={ct('creator_additional_wine_drives_as_overrides_c_and_z_usually_alre')}
              >
                <div class="grid gap-3">
                  <Alert variant="warning">
                    <IconAlertCircle />
                    <AlertTitle>{ct('creator_wine_drives_require_care')}</AlertTitle>
                    <AlertDescription>
                      {ct('creator_c_and_z_usually_already_exist_in_the_default_prefix_add')}
                    </AlertDescription>
                  </Alert>

                  <div class="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <div class="grid gap-1">
                      <p>
                        <strong class="text-foreground">C:</strong>{' '}
                        {ct('creator_usually_points_to_drive_c_internal_prefix_path')}
                      </p>
                      <p>
                        <strong class="text-foreground">Z:</strong>{' '}
                        {ct('creator_usually_exposes_the_linux_filesystem_root_for_compatibil')}
                      </p>
                    </div>
                    <div class="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          patchConfig((prev) => ({
                            ...prev,
                            winecfg: {
                              ...prev.winecfg,
                              drives: [
                                {
                                  letter: 'Z',
                                  source_relative_path: '.',
                                  state: 'OptionalOn',
                                  host_path: null,
                                  drive_type: 'auto',
                                  label: null,
                                  serial: null
                                }
                              ]
                            }
                          }))
                        }
                      >
                        {ct('creator_restore_shown_default_z')}
                      </Button>
                    </div>
                  </div>

                  <div class="flex justify-end">
                    <Dialog open={wineDriveDialogOpen()} onOpenChange={setWineDriveDialogOpen}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="inline-flex items-center gap-1.5"
                        onClick={() => {
                          const nextLetter = availableWineDriveLetters()[0] ?? 'D'
                          setWineDriveDraft({
                            letter: nextLetter,
                            host_path: '',
                            drive_type: 'auto',
                            label: '',
                            serial: ''
                          })
                          setWineDriveDialogOpen(true)
                        }}
                      >
                        <IconPlus class="size-4" />
                        {ct('creator_add_drive')}
                      </Button>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{ct('creator_add_wine_drive')}</DialogTitle>
                          <DialogDescription>
                            {ct('creator_choose_an_available_letter_and_configure_drive_metadata')}
                          </DialogDescription>
                        </DialogHeader>

                        <div class="grid gap-2">
                          <Select
                            value={wineDriveDraft().letter}
                            onInput={(e) => setWineDriveDraft((prev: any) => ({ ...prev, letter: e.currentTarget.value }))}
                          >
                            <For each={availableWineDriveLetters().length > 0 ? availableWineDriveLetters() : [wineDriveDraft().letter]}>
                              {(letter) => <option value={letter}>{letter}:</option>}
                            </For>
                          </Select>

                          <Input
                            value={wineDriveDraft().host_path}
                            placeholder="/mnt/storage/shared"
                            onInput={(e) => setWineDriveDraft((prev: any) => ({ ...prev, host_path: e.currentTarget.value }))}
                          />

                          <Select
                            value={wineDriveDraft().drive_type}
                            onInput={(e) => setWineDriveDraft((prev: any) => ({ ...prev, drive_type: e.currentTarget.value }))}
                          >
                            <For each={wineDriveTypeOptions}>
                              {(option) => <option value={option.value}>{option.label}</option>}
                            </For>
                          </Select>

                          <div class="grid gap-2 md:grid-cols-2">
                            <Input
                              value={wineDriveDraft().label}
                              placeholder={ct('creator_label_optional')}
                              onInput={(e) => setWineDriveDraft((prev: any) => ({ ...prev, label: e.currentTarget.value }))}
                            />
                            <Input
                              value={wineDriveDraft().serial}
                              placeholder={ct('creator_serial_optional')}
                              onInput={(e) => setWineDriveDraft((prev: any) => ({ ...prev, serial: e.currentTarget.value }))}
                            />
                          </div>

                          <p class="text-xs text-muted-foreground">
                            {ct('creator_use_a_generic_linux_directory_when_possible_avoid_user_s')}
                          </p>
                        </div>

                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setWineDriveDialogOpen(false)}>
                            {ct('creator_label_cancel')}
                          </Button>
                          <Button
                            type="button"
                            disabled={!wineDriveDraft().letter.trim() || !wineDriveDraft().host_path.trim()}
                            onClick={() => {
                              const draft = wineDriveDraft()
                              const letter = draft.letter.trim().toUpperCase()
                              if (!letter || !draft.host_path.trim()) return
                              if (config().winecfg.drives.some((item) => item.letter.trim().toUpperCase() === letter)) {
                                setStatusMessage(ct('creator_that_drive_letter_is_already_in_use'))
                                return
                              }
                              patchConfig((prev) => ({
                                ...prev,
                                winecfg: {
                                  ...prev.winecfg,
                                  drives: [
                                    ...prev.winecfg.drives,
                                    {
                                      letter,
                                      source_relative_path: '',
                                      state: 'OptionalOn',
                                      host_path: draft.host_path.trim(),
                                      drive_type: draft.drive_type as 'auto' | 'local_disk' | 'network_share' | 'floppy' | 'cdrom',
                                      label: draft.label.trim() ? draft.label.trim() : null,
                                      serial: draft.serial.trim() ? draft.serial.trim() : null
                                    }
                                  ]
                                }
                              }))
                              setWineDriveDialogOpen(false)
                            }}
                          >
                            {ct('creator_label_confirm')}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Show
                    when={config().winecfg.drives.length > 0}
                    fallback={
                      <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        {ct('creator_no_additional_drive_configured')}
                      </div>
                    }
                  >
                    <div class="rounded-md border border-border/60 bg-background/40">
                      <Table>
                        <TableHeader>
                          <TableRow class="hover:bg-transparent">
                            <TableHead>{ct('creator_letter')}</TableHead>
                            <TableHead>{ct('creator_linux_path')}</TableHead>
                            <TableHead>{ct('creator_type')}</TableHead>
                            <TableHead>{ct('creator_label')}</TableHead>
                            <TableHead>{ct('creator_serial')}</TableHead>
                            <TableHead class="w-[72px] text-right">{ct('creator_label_actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <For each={config().winecfg.drives}>
                            {(item, index) => (
                              <TableRow>
                                <TableCell class="font-medium">{item.letter}:</TableCell>
                                <TableCell class="max-w-[260px] truncate text-muted-foreground">
                                  {(item.host_path ?? item.source_relative_path) || '—'}
                                </TableCell>
                                <TableCell class="max-w-[160px] truncate text-muted-foreground">
                                  {item.drive_type ?? 'auto'}
                                </TableCell>
                                <TableCell class="max-w-[160px] truncate text-muted-foreground">
                                  {item.label ?? '—'}
                                </TableCell>
                                <TableCell class="max-w-[140px] truncate text-muted-foreground">
                                  {item.serial ?? '—'}
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
                                          drives: removeAt(prev.winecfg.drives, index())
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
              </AccordionSection>
  )
}
