import { For, Show } from 'solid-js'
import { IconAlertCircle } from '@tabler/icons-solidjs'

import { Alert, AlertDescription } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { Spinner } from '../../../components/ui/spinner'
import type { LuthierPageSectionProps } from '../page-shared'

export function ReviewActionsPanel(props: LuthierPageSectionProps) {
  const {
    resultJson,
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
    <>
      <section class="preview">
        <h3>{ct('luthier_configuration_preview_json')}</h3>
        <pre>{configPreview()}</pre>
      </section>

      <Show when={createExecutableValidationErrors().length > 0}>
        <Alert variant="warning">
          <IconAlertCircle />
          <AlertDescription>
            <ul class="list-disc space-y-1 pl-4 text-sm">
              <For each={createExecutableValidationErrors()}>{(message) => <li>{message}</li>}</For>
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
    </>
  )
}
