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
  WinecfgFeatureStateField,
} from '../../../components/form/FormControls'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Spinner } from '../../../components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs'
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
  type LuthierPageSectionProps,
} from '../page-shared'
import { GamescopePanel } from './gamescope-panel'

export function PerformanceTabSection(props: LuthierPageSectionProps) {
  const {
    config,
    patchConfig,
    ct,
    locale,
    upscaleMethodOptions,
    windowTypeOptions,
    gamescopeEnabled,
    setGamescopeState,
    setGamemodeState,
    setMangohudState,
    gamescopeAdditionalOptionsList,
    setGamescopeAdditionalOptionsList,
    gamescopeUsesMonitorResolution,
    wineWaylandEnabled,
    setGamescopeOutputWidth,
    setGamescopeOutputHeight,
  } = props.view

  return (
    <section class="stack">
      <GamescopePanel view={props.view} />

      <FeatureStateField
        label="Gamemode"
        help={ct('luthier_defines_gamemode_policy')}
        value={config().environment.gamemode}
        onChange={setGamemodeState}
      />

      <FeatureStateField
        label="MangoHud"
        help={ct('luthier_defines_mangohud_policy')}
        value={config().environment.mangohud}
        onChange={setMangohudState}
      />

      <FeatureStateField
        label="Wine-Wayland"
        help={ct('luthier_policy_for_enabling_wine_wayland')}
        value={config().compatibility.wine_wayland}
        onChange={(value) =>
          patchConfig((prev) => ({
            ...prev,
            compatibility: {
              ...prev.compatibility,
              wine_wayland: value,
            },
          }))
        }
        footer={
          wineWaylandEnabled() ? (
            <FeatureStateField
              label="HDR"
              help={ct('luthier_policy_for_hdr_depends_on_wine_wayland')}
              value={config().compatibility.hdr}
              onChange={(value) =>
                patchConfig((prev) => ({
                  ...prev,
                  compatibility: {
                    ...prev.compatibility,
                    hdr: value,
                  },
                }))
              }
            />
          ) : undefined
        }
      />

      <FeatureStateField
        label="Auto DXVK-NVAPI"
        help={ct('luthier_controls_automatic_dxvk_nvapi_setup')}
        value={config().compatibility.auto_dxvk_nvapi}
        onChange={(value) =>
          patchConfig((prev) => ({
            ...prev,
            compatibility: {
              ...prev.compatibility,
              auto_dxvk_nvapi: value,
            },
          }))
        }
      />

      <FeatureStateField
        label={ct('luthier_use_dedicated_gpu')}
        help={ct('luthier_exports_prime_render_offload_variables_to_try_using_the')}
        value={config().environment.prime_offload}
        onChange={(value) =>
          patchConfig((prev) => ({
            ...prev,
            environment: {
              ...prev.environment,
              prime_offload: value,
            },
          }))
        }
      />
    </section>
  )
}
