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
import type { AudioDriverOption, GamescopeWindowType, UpscaleMethod } from '../useLuthierController'
import {
  AccordionSection,
  basenamePath,
  buildFeatureState,
  featureStateEnabled,
  featureStateMandatory,
  posixDirname,
  relativeInsideBase,
  SwitchChoiceCard,
  type LuthierPageSectionProps
} from '../page-shared'
import { ReviewSummaryPanel } from './review-summary-panel'

export function ReviewTabSection(props: LuthierPageSectionProps) {
  const {
    resultJson,
    config,
    exePath,
    gameRootManualOverride,
    gameRootRelativeDisplay,
    configPreview,
    t,
    ct,
    runTest,
    runCreate,
    testingConfiguration,
    creatingExecutable,
    createExecutableValidationErrors,
    createExecutableBlockedReason,
  } = props.view

  return (
    <section class="stack">
      <ReviewSummaryPanel view={props.view} />

      <section class="preview">
        <h3>{ct('luthier_configuration_preview_json')}</h3>
        <pre>{configPreview()}</pre>
      </section>

      <Show when={createExecutableValidationErrors().length > 0}>
        <Alert variant="warning">
          <IconAlertCircle />
          <AlertDescription>
            <ul class="list-disc space-y-1 pl-4 text-sm">
              <For each={createExecutableValidationErrors()}>
                {(message) => <li>{message}</li>}
              </For>
            </ul>
          </AlertDescription>
        </Alert>
      </Show>

      <div class="row-actions">
        <Button
          type="button"
          class="btn-test"
          onClick={runTest}
          disabled={testingConfiguration() || creatingExecutable()}
        >
          <Show
            when={!testingConfiguration()}
            fallback={
              <span class="inline-flex items-center gap-2">
                <Spinner class="size-4" />
                {ct('luthier_loading')}
              </span>
            }
          >
            {t('testButton')}
          </Show>
        </Button>
        <Button
          type="button"
          class="btn-primary"
          onClick={runCreate}
          disabled={
            creatingExecutable() ||
            testingConfiguration() ||
            createExecutableValidationErrors().length > 0
          }
          title={createExecutableBlockedReason() || undefined}
        >
          <Show
            when={!creatingExecutable()}
            fallback={
              <span class="inline-flex items-center gap-2">
                <Spinner class="size-4" />
                {ct('luthier_loading')}
              </span>
            }
          >
            {t('createButton')}
          </Show>
        </Button>
      </div>

      <section class="preview">
        <h3>{ct('luthier_last_action_result')}</h3>
        <pre>{resultJson() || t('noResult')}</pre>
      </section>
    </section>
  )
}
