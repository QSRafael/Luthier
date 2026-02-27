import { For, Show } from 'solid-js'

import { FieldShell } from '../../../components/form/FormControls'
import type { LuthierPageSectionProps } from '../page-shared'
import { buildConfigurationSummary } from '../domain/summary-builder'

export function ReviewSummaryPanel(props: LuthierPageSectionProps) {
    const { config, ct, gameRootManualOverride, gameRootRelativeDisplay, exePath } = props.view

    const summaryRows = () => buildConfigurationSummary({
        config: config(),
        exePath: exePath(),
        gameRootManualOverride: gameRootManualOverride(),
        gameRootRelativeDisplay: gameRootRelativeDisplay(),
        ct
    })

    return (
        <FieldShell
            label={ct('luthier_configuration_summary')}
            help={ct('luthier_quick_view_of_how_many_items_were_configured_in_each_sec')}
            controlClass="hidden"
            footer={
                <Show
                    when={summaryRows().length > 0}
                    fallback={
                        <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                            {ct('luthier_no_items_found')}
                        </div>
                    }
                >
                    <div class="grid gap-2">
                        <For each={summaryRows()}>
                            {(row) => (
                                <div class="grid gap-1 rounded-md border border-border/60 bg-background/30 px-3 py-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
                                    <div class="text-xs font-medium text-muted-foreground">{row.label}</div>
                                    <div class="flex flex-wrap gap-1">
                                        <For each={row.items}>
                                            {(item) => (
                                                <span class="inline-flex items-center rounded-md border border-border/60 bg-muted/25 px-2 py-0.5 text-xs leading-5">
                                                    {item}
                                                </span>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            }
        >
            <span />
        </FieldShell>
    )
}
