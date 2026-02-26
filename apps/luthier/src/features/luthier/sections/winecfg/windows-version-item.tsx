import { For } from 'solid-js'

import { FieldShell } from '../../../../components/form/FormControls'
import { Select } from '../../../../components/ui/select'
import type { WinecfgSectionViewProps } from './shared'

export function WinecfgWindowsVersionItem(props: WinecfgSectionViewProps) {
  const { config, patchConfig, ct, wineWindowsVersionOptions } = props.view

  return (
            <FieldShell
              label={ct('luthier_windows_version_winecfg')}
              help={ct('luthier_optional_override_for_the_windows_version_reported_by_th')}
              compact
            >
              <Select
                value={config().winecfg.windows_version ?? '__default__'}
                onInput={(e) =>
                  patchConfig((prev) => ({
                    ...prev,
                    winecfg: {
                      ...prev.winecfg,
                      windows_version: e.currentTarget.value === '__default__' ? null : e.currentTarget.value
                    }
                  }))
                }
              >
                <For each={wineWindowsVersionOptions}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </Select>
            </FieldShell>
  )
}
