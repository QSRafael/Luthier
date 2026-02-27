import { Show } from 'solid-js'

import { FieldShell } from '../../../components/form/FormControls'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Spinner } from '../../../components/ui/spinner'
import type { LuthierPageSectionProps } from '../page-shared'

export function GameHeroImagePanel(props: LuthierPageSectionProps) {
  const {
    config,
    ct,
    heroImageProcessing,
    heroImageAutoSearching,
    canSearchAnotherHeroImage,
    setHeroImageUrl,
    prepareHeroImageFromUrl,
    searchHeroImageAutomatically,
  } = props.view

  return (
    <FieldShell
      label={ct('luthier_splash_hero_image')}
      help={ct('luthier_hero_image_used_as_splash_background_downloaded_and_emb')}
      hint={ct('luthier_hero_image_ratio_96_31_and_converted_to_webp')}
      footer={
        config().splash.hero_image_data_url.trim() || heroImageProcessing() ? (
          <div class="rounded-md border border-border/60 bg-muted/15 p-3">
            <div class="relative overflow-hidden rounded-md border border-border/60 bg-black">
              <div class="aspect-[96/31] w-full" />
              <Show
                when={config().splash.hero_image_data_url.trim()}
                fallback={
                  <div class="absolute inset-0 grid place-items-center">
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                      <Spinner class="size-3" />
                      <span>{ct('luthier_processing')}</span>
                    </div>
                  </div>
                }
              >
                <img
                  src={config().splash.hero_image_data_url}
                  alt={ct('luthier_splash_hero_image_preview')}
                  class="absolute inset-0 h-full w-full object-contain"
                />
                <Show when={heroImageProcessing()}>
                  <div class="absolute inset-0 bg-background/35 backdrop-blur-[1px]" />
                  <div class="absolute inset-0 grid place-items-center">
                    <div class="flex items-center gap-2 rounded-md bg-background/70 px-2 py-1 text-xs">
                      <Spinner class="size-3" />
                      <span>{ct('luthier_processing')}</span>
                    </div>
                  </div>
                </Show>
              </Show>
            </div>
          </div>
        ) : undefined
      }
    >
      <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          value={config().splash.hero_image_url}
          placeholder="https://..."
          onInput={(e) => {
            setHeroImageUrl(e.currentTarget.value)
          }}
          onBlur={() => {
            void prepareHeroImageFromUrl()
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={searchHeroImageAutomatically}
          disabled={heroImageAutoSearching() || heroImageProcessing()}
        >
          <Show
            when={heroImageAutoSearching() || heroImageProcessing()}
            fallback={
              canSearchAnotherHeroImage()
                ? ct('luthier_search_another')
                : ct('luthier_search_automatically')
            }
          >
            <span class="inline-flex items-center gap-2">
              <Spinner class="size-3" />
              {heroImageAutoSearching() ? ct('luthier_searching') : ct('luthier_processing')}
            </span>
          </Show>
        </Button>
      </div>
    </FieldShell>
  )
}
