import { createMemo, For, Show } from 'solid-js'
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-solidjs'

import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Select } from '../../../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table'
import { AccordionSection } from '../../page-shared'
import type { WinecfgAccordionSectionProps } from './shared'
import {
  validateLinuxPath,
  validateWindowsDriveSerial,
  validateWindowsFriendlyName,
} from '../../field-validation'

export function WinecfgDrivesAccordionSection(props: WinecfgAccordionSectionProps) {
  const {
    setStatusMessage,
    config,
    patchConfig,
    ct,
    locale,
    removeAt,
    wineDriveDialogOpen,
    setWineDriveDialogOpen,
    wineDriveDraft,
    setWineDriveDraft,
    wineDriveTypeOptions,
    availableWineDriveLetters,
  } = props.view
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
    <AccordionSection
      open={props.open}
      onToggle={props.onToggle}
      title={ct('luthier_drives')}
      description={ct('luthier_additional_wine_drives_as_overrides_c_and_z_usually_alre')}
    >
      <div class="grid gap-3">
        <Alert variant="warning">
          <IconAlertCircle />
          <AlertTitle>{ct('luthier_wine_drives_require_care')}</AlertTitle>
          <AlertDescription>
            {ct('luthier_c_and_z_usually_already_exist_in_the_default_prefix_add')}
          </AlertDescription>
        </Alert>

        <div class="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <div class="grid gap-1">
            <p>
              <strong class="text-foreground">C:</strong>{' '}
              {ct('luthier_usually_points_to_drive_c_internal_prefix_path')}
            </p>
            <p>
              <strong class="text-foreground">Z:</strong>{' '}
              {ct('luthier_usually_exposes_the_linux_filesystem_root_for_compatibil')}
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
              {ct('luthier_restore_shown_default_z')}
            </Button>
          </div>
        </div>

        <div class="flex justify-end">
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
            {ct('luthier_add_drive')}
          </Button>
        </div>

        <Show
          when={config().winecfg.drives.length > 0}
          fallback={
            <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {ct('luthier_no_additional_drive_configured')}
            </div>
          }
        >
          <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
            <Table>
              <TableHeader>
                <TableRow class="hover:bg-transparent">
                  <TableHead>{ct('luthier_letter')}</TableHead>
                  <TableHead>{ct('luthier_linux_path')}</TableHead>
                  <TableHead>{ct('luthier_type')}</TableHead>
                  <TableHead>{ct('luthier_label')}</TableHead>
                  <TableHead>{ct('luthier_serial')}</TableHead>
                  <TableHead class="w-[72px] text-right">{ct('luthier_label_actions')}</TableHead>
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
