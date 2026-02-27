import { For, Show } from 'solid-js'
import { IconAlertCircle, IconX } from '@tabler/icons-solidjs'

import { FieldShell } from '../../../components/form/FormControls'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Skeleton } from '../../../components/ui/skeleton'
import { Spinner } from '../../../components/ui/spinner'
import type { LuthierPageSectionProps } from '../page-shared'

export function WinetricksItemPanel(props: LuthierPageSectionProps) {
    const {
        winetricksAvailable,
        winetricksLoading,
        winetricksSource,
        winetricksSearch,
        setWinetricksSearch,
        winetricksCatalogError,
        config,
        ct,
        normalizedWinetricksSearch,
        winetricksCandidates,
        loadWinetricksCatalog,
        addWinetricksVerb,
        removeWinetricksVerb,
        addWinetricksFromSearch,
    } = props.view

    return (
        <FieldShell
            label="Winetricks"
            help={ct('luthier_enabled_automatically_when_at_least_one_verb_is_configur')}
            controlClass="flex flex-col items-end gap-2"
            footer={
                <div class="grid gap-2">
                    <div class="rounded-md border border-input bg-background px-2 py-2">
                        <div class="flex min-h-9 flex-wrap items-center gap-1.5">
                            <For each={config().dependencies}>
                                {(verb) => (
                                    <span class="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/35 px-2 py-1 text-xs">
                                        <span class="truncate">{verb}</span>
                                        <button
                                            type="button"
                                            class="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                                            onClick={() => removeWinetricksVerb(verb)}
                                            aria-label={ct('luthier_remove_verb')}
                                            title={ct('luthier_remove_verb')}
                                        >
                                            <IconX class="size-3" />
                                        </button>
                                    </span>
                                )}
                            </For>

                            <Input
                                value={winetricksSearch()}
                                disabled={winetricksCatalogError() || winetricksLoading()}
                                placeholder={
                                    winetricksCatalogError()
                                        ? ct('luthier_failed_to_load_winetricks_catalog')
                                        : ct('luthier_search_and_add_verbs_e_g_vcrun_corefonts')
                                }
                                class="h-7 min-w-[220px] flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                onInput={(e) => setWinetricksSearch(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        if (winetricksCatalogError()) return
                                        const exact = winetricksCandidates().find(
                                            (item) => item.toLowerCase() === winetricksSearch().trim().toLowerCase()
                                        )
                                        if (exact) {
                                            addWinetricksVerb(exact)
                                            setWinetricksSearch('')
                                            return
                                        }
                                        const first = winetricksCandidates()[0]
                                        if (first) {
                                            addWinetricksVerb(first)
                                            setWinetricksSearch('')
                                            return
                                        }
                                        addWinetricksFromSearch()
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <Show when={winetricksCatalogError()}>
                        <Alert variant="destructive">
                            <IconAlertCircle />
                            <AlertTitle>{ct('luthier_failed_to_load_winetricks_catalog')}</AlertTitle>
                            <AlertDescription>
                                {ct('luthier_the_local_remote_catalog_could_not_be_loaded_you_can_sti')}
                            </AlertDescription>
                        </Alert>
                    </Show>

                    <Show
                        when={!winetricksCatalogError() && normalizedWinetricksSearch().length >= 2}
                        fallback={
                            <Show when={!winetricksCatalogError()}>
                                <div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                                    <Show
                                        when={!winetricksLoading() || winetricksAvailable().length > 0}
                                        fallback={
                                            <div class="grid gap-2 py-1">
                                                <Skeleton class="h-7 w-full" />
                                                <Skeleton class="h-7 w-full" />
                                                <Skeleton class="h-7 w-4/5" />
                                            </div>
                                        }
                                    >
                                        {ct('luthier_type_at_least_2_characters_to_search_verbs_in_the_catalo')}
                                    </Show>
                                </div>
                            </Show>
                        }
                    >
                        <div class="max-h-52 overflow-auto rounded-md border border-border/60 bg-muted/25 p-1">
                            <Show
                                when={winetricksCandidates().length > 0}
                                fallback={
                                    <div class="px-2 py-2 text-xs text-muted-foreground">
                                        {ct('luthier_no_items_found')}
                                    </div>
                                }
                            >
                                <div class="grid gap-1">
                                    <For each={winetricksCandidates()}>
                                        {(verb) => (
                                            <button
                                                type="button"
                                                class="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-accent/40"
                                                onClick={() => {
                                                    addWinetricksVerb(verb)
                                                    setWinetricksSearch('')
                                                }}
                                            >
                                                <span class="truncate">{verb}</span>
                                                <span class="text-xs text-muted-foreground">{ct('luthier_label_add')}</span>
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </div>
            }
        >
            <div class="flex flex-col items-end gap-1.5">
                <Show when={winetricksLoading()}>
                    <div class="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Spinner class="size-3" />
                        <span>{ct('luthier_loading_catalog_in_background')}</span>
                    </div>
                </Show>
                <Button type="button" variant="outline" onClick={loadWinetricksCatalog} disabled={winetricksLoading()}>
                    <Show
                        when={!winetricksLoading()}
                        fallback={
                            <span class="inline-flex items-center gap-2">
                                <Spinner class="size-3" />
                                {ct('luthier_loading')}
                            </span>
                        }
                    >
                        {ct('luthier_refresh_catalog')}
                    </Show>
                </Button>
                <p class="text-xs text-muted-foreground">
                    {ct('luthier_source')} <strong>{winetricksSource()}</strong> ·{' '}
                    {ct('luthier_catalog')} <strong>{winetricksAvailable().length}</strong>
                </p>
            </div>
        </FieldShell>
    )
}
