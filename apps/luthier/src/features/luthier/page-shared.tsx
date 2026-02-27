import { LuthierTab } from '../../models/config'
import type { LuthierController } from './useLuthierController'
import type { createLuthierPageDialogState } from './page-dialog-state'
import type { createLuthierPageEffects } from './page-effects'
import type { LuthierCopyKey } from './copy'

export type LuthierPageSectionView = LuthierController &
  ReturnType<typeof createLuthierPageDialogState> &
  ReturnType<typeof createLuthierPageEffects>

export type LuthierPageSectionProps = {
  view: LuthierPageSectionView
}

export function tabLabel(tab: LuthierTab, controller: LuthierController) {
  const ct = controller.ct as (key: LuthierCopyKey) => string
  if (tab === 'game') return ct('luthier_label_game')
  if (tab === 'gameFiles') return ct('luthier_label_game_files_and_launch')
  if (tab === 'runtime') return ct('luthier_label_runtime')
  if (tab === 'performance') return ct('luthier_enhancements')
  if (tab === 'prefix') return ct('luthier_dependencies')
  if (tab === 'winecfg') return 'Winecfg'
  if (tab === 'wrappers') return ct('luthier_launch_and_environment')
  return ct('luthier_review_and_generate')
}

export { AccordionSection, SwitchChoiceCard } from './luthier-page-widgets'

export {
  isLikelyAbsolutePath,
  isTauriLocalRuntime,
  posixDirname,
  buildAncestorPathsFromExe,
  relativeInsideBase,
  basenamePath,
  parseWxH,
  buildWxH,
  featureStateEnabled,
  featureStateMandatory,
  buildFeatureState,
} from './domain/page-shared-helpers'
