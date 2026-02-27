import type { LuthierPageSectionView } from '../../page-shared'

export type WinecfgSectionViewProps = {
  view: LuthierPageSectionView
}

export type WinecfgAccordionSectionProps = {
  view: LuthierPageSectionView
  open: boolean
  onToggle: () => void
}
