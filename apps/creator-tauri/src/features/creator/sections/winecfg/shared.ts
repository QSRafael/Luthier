import type { CreatorPageSectionView } from '../../creator-page-shared'

export type WinecfgSectionViewProps = {
  view: CreatorPageSectionView
}

export type WinecfgAccordionSectionProps = {
  view: CreatorPageSectionView
  open: boolean
  onToggle: () => void
}
