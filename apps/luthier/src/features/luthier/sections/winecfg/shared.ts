import type { LuthierPageSectionView } from '../../luthier-page-shared'

export type WinecfgSectionViewProps = {
  view: LuthierPageSectionView
}

export type WinecfgAccordionSectionProps = {
  view: LuthierPageSectionView
  open: boolean
  onToggle: () => void
}
