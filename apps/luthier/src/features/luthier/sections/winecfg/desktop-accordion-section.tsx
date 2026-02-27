import { createMemo, For, Show } from 'solid-js'
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-solidjs'

import { WinecfgFeatureStateField } from '../../../../components/form/FormControls'
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Select } from '../../../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/ui/table'
import { AccordionSection } from '../../page-shared'
import type { WinecfgAccordionSectionProps } from './shared'
import { validateLinuxPath, validateWindowsFriendlyName } from '../../field-validation'

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
      ? validateWindowsFriendlyName(
          wineDesktopFolderDraft().shortcut_name,
          locale(),
          'o nome do atalho',
          'the shortcut name'
        )
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

  return (
    <AccordionSection
      open={props.open}
      onToggle={props.onToggle}
      title={ct('luthier_desktop_integration')}
      description={ct('luthier_file_protocol_associations_and_wine_special_desktop_fold')}
    >
      <div class="grid gap-3">
        <Alert variant="warning">
          <IconAlertCircle />
          <AlertTitle>{ct('luthier_integration_can_affect_user_system_behavior')}</AlertTitle>
          <AlertDescription>
            {ct('luthier_mime_protocol_associations_and_special_folders_can_chang')}
          </AlertDescription>
        </Alert>

        <WinecfgFeatureStateField
          label={ct('luthier_desktop_integration_general')}
          help={ct('luthier_controls_wine_integration_with_the_linux_shell_desktop')}
          value={config().winecfg.desktop_integration}
          onChange={(value) =>
            patchConfig((prev) => ({
              ...prev,
              winecfg: { ...prev.winecfg, desktop_integration: value },
            }))
          }
        />

        <WinecfgFeatureStateField
          label={ct('luthier_mime_types_file_protocol_associations')}
          help={ct('luthier_equivalent_to_manage_file_and_protocol_associations')}
          value={config().winecfg.mime_associations}
          onChange={(value) =>
            patchConfig((prev) => ({
              ...prev,
              winecfg: { ...prev.winecfg, mime_associations: value },
            }))
          }
        />

        <div class="rounded-xl border border-border/70 bg-card/70 p-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">{ct('luthier_special_folders')}</p>
              <p class="text-xs text-muted-foreground">
                {ct('luthier_add_folder_shortcut_mappings_for_wine_optional_override')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="inline-flex items-center gap-1.5"
              onClick={() => setWineDesktopFolderDialogOpen(true)}
            >
              <IconPlus class="size-4" />
              {ct('luthier_add_folder')}
            </Button>
          </div>

          <div class="mt-3">
            <Show
              when={config().winecfg.desktop_folders.length > 0}
              fallback={
                <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {ct('luthier_no_special_folder_added')}
                </div>
              }
            >
              <div class="max-h-[20rem] overflow-auto rounded-md border border-border/60 bg-background/40">
                <Table>
                  <TableHeader>
                    <TableRow class="hover:bg-transparent">
                      <TableHead>{ct('luthier_type')}</TableHead>
                      <TableHead>{ct('luthier_shortcut')}</TableHead>
                      <TableHead>{ct('luthier_linux_path')}</TableHead>
                      <TableHead class="w-[72px] text-right">
                        {ct('luthier_label_actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <For each={config().winecfg.desktop_folders}>
                      {(item, index) => (
                        <TableRow>
                          <TableCell class="max-w-[120px] truncate font-medium">
                            {item.folder_key}
                          </TableCell>
                          <TableCell class="max-w-[180px] truncate">{item.shortcut_name}</TableCell>
                          <TableCell class="max-w-[320px] truncate text-muted-foreground">
                            {item.linux_path}
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
                                    desktop_folders: removeAt(
                                      prev.winecfg.desktop_folders,
                                      index()
                                    ),
                                  },
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
