import type { LuthierPageSectionProps } from '../page-shared'
import { ReviewSummaryPanel } from './review-summary-panel'
import { ReviewActionsPanel } from './review-actions-panel'

export function ReviewTabSection(props: LuthierPageSectionProps) {
  return (
    <section class="stack">
      <ReviewSummaryPanel view={props.view} />
      <ReviewActionsPanel view={props.view} />
    </section>
  )
}
