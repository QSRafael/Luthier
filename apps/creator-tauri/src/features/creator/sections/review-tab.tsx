import { For, Show } from 'solid-js'
import { IconAlertCircle, IconPlus, IconTrash, IconX } from '@tabler/icons-solidjs'

import {
  FeatureStateField,
  FieldShell,
  KeyValueListField,
  SegmentedField,
  SelectField,
  StringListField,
  TextInputField,
  ToggleField,
  WinecfgFeatureStateField
} from '../../../components/form/FormControls'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Spinner } from '../../../components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { Textarea } from '../../../components/ui/textarea'
import type { RuntimePreference } from '../../../models/config'
import type { AudioDriverOption, GamescopeWindowType, UpscaleMethod } from '../useCreatorController'
import {
  AccordionSection,
  basenamePath,
  buildFeatureState,
  featureStateEnabled,
  featureStateMandatory,
  posixDirname,
  relativeInsideBase,
  SwitchChoiceCard,
  type CreatorPageSectionProps
} from '../creator-page-shared'

export function ReviewTabSection(props: CreatorPageSectionProps) {
    const {
    resultJson,
    config,
    configPreview,
    t,
    ct,
    payloadSummary,
    runTest,
    runCreate,
  } = props.view

  return (
          <section class="stack">
            <FieldShell
              label={ct('creator_configuration_summary')}
              help={ct('creator_quick_view_of_how_many_items_were_configured_in_each_sec')}
              controlClass="hidden"
              footer={
                <div class="summary-grid">
                  <div>
                    <strong>{payloadSummary().launchArgs}</strong>
                    <span>{ct('creator_launch_arguments_2')}</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().integrityFiles}</strong>
                    <span>{ct('creator_required_files')}</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().winetricks}</strong>
                    <span>Winetricks</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().registry}</strong>
                    <span>{ct('creator_windows_registry')}</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().mounts}</strong>
                    <span>{ct('creator_mounts')}</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().wrappers}</strong>
                    <span>{ct('creator_wrappers')}</span>
                  </div>
                  <div>
                    <strong>{payloadSummary().envVars}</strong>
                    <span>{ct('creator_environment_variables')}</span>
                  </div>
                </div>
              }
            >
              <span />
            </FieldShell>

            <section class="preview">
              <h3>{ct('creator_configuration_preview_json')}</h3>
              <pre>{configPreview()}</pre>
            </section>

            <div class="row-actions">
              <Button type="button" class="btn-test" onClick={runTest}>
                {t('testButton')}
              </Button>
              <Button type="button" class="btn-primary" onClick={runCreate}>
                {t('createButton')}
              </Button>
            </div>

            <section class="preview">
              <h3>{ct('creator_last_action_result')}</h3>
              <pre>{resultJson() || t('noResult')}</pre>
            </section>
          </section>
  )
}
