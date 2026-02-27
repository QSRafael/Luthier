import { createMemo, For, Show } from 'solid-js'
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
import { LaunchWrapperCommandsPanel } from './launch-wrapper-commands-panel'

export function LaunchEnvironmentTabSection(props: LuthierPageSectionProps) {
  const {
    config,
    patchConfig,
    ct,
    locale,
    environmentVarsAsList,
    removeAt,
    updateCustomVars,
    wrapperDialogOpen,
    setWrapperDialogOpen,
    wrapperDraft,
    setWrapperDraft,
    launchScriptsAccordionOpen,
    setLaunchScriptsAccordionOpen,
  } = props.view


  return (
    <section class="stack">
      <LaunchWrapperCommandsPanel view={props.view} />

      <AccordionSection
        open={launchScriptsAccordionOpen()}
        onToggle={() => setLaunchScriptsAccordionOpen((prev: boolean) => !prev)}
        title={ct('luthier_label_scripts')}
        description={ct('luthier_local_scripts_mvp')}
      >
        <div class="grid gap-3">
          <FieldShell
            label={ct('luthier_pre_launch_script_bash')}
            help={ct('luthier_executed_before_starting_the_game')}
            controlClass="hidden"
            footer={
              <Textarea
                rows={8}
                value={config().scripts.pre_launch}
                placeholder="#!/usr/bin/env bash\necho Preparando..."
                onInput={(e) =>
                  patchConfig((prev) => ({
                    ...prev,
                    scripts: { ...prev.scripts, pre_launch: e.currentTarget.value }
                  }))
                }
              />
            }
          >
            <span />
          </FieldShell>

          <FieldShell
            label={ct('luthier_post_launch_script_bash')}
            help={ct('luthier_executed_after_the_game_exits')}
            controlClass="hidden"
            footer={
              <Textarea
                rows={8}
                value={config().scripts.post_launch}
                placeholder="#!/usr/bin/env bash\necho Finalizado..."
                onInput={(e) =>
                  patchConfig((prev) => ({
                    ...prev,
                    scripts: { ...prev.scripts, post_launch: e.currentTarget.value }
                  }))
                }
              />
            }
          >
            <span />
          </FieldShell>

          <Alert variant="warning">
            <IconAlertCircle />
            <AlertTitle>{ct('luthier_local_scripts_mvp')}</AlertTitle>
            <AlertDescription>
              <span class="block">
                {ct('luthier_scripts_accept_bash_only_and_local_execution_in_the_mvp')}
              </span>
              <span class="mt-1 block">
                {ct('luthier_scripts_are_not_sent_to_the_community_api_use_trusted_co')}
              </span>
            </AlertDescription>
          </Alert>
        </div>
      </AccordionSection>
    </section>
  )
}
