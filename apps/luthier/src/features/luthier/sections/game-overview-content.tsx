import { Show } from 'solid-js'

import {
    FieldShell,
    TextInputField,
} from '../../../components/form/FormControls'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Skeleton } from '../../../components/ui/skeleton'
import { Spinner } from '../../../components/ui/spinner'
import { GameHeroImagePanel } from './game-hero-image-panel'
import type { LuthierPageSectionProps } from '../page-shared'

export function GameOverviewContent(props: LuthierPageSectionProps) {
    const {
        exePath,
        setExePath,
        iconPreviewPath,
        config,
        patchConfig,
        ct,
        pickExecutable,
        extractExecutableIcon,
        hashingExecutable,
        extractingExecutableIcon,
    } = props.view

    return (
        <>
            <TextInputField
                label={ct('luthier_game_name')}
                help={ct('luthier_name_shown_in_splash_and_local_database')}
                value={config().game_name}
                onInput={(value) => patchConfig((prev) => ({ ...prev, game_name: value }))}
            />

            <GameHeroImagePanel view={props.view} />

            <FieldShell
                label={ct('luthier_main_executable_exe')}
                help={ct('luthier_use_picker_to_select_the_real_game_executable')}
            >
                <div class="grid gap-2">
                    <div class="picker-row">
                        <Input value={exePath()} placeholder="/home/user/Games/MyGame/game.exe" onInput={(e) => setExePath(e.currentTarget.value)} />
                        <Button type="button" variant="outline" onClick={pickExecutable}>
                            {ct('luthier_select_file')}
                        </Button>
                    </div>

                    <div class="px-0.5 text-xs">
                        <span class="font-medium text-muted-foreground">{ct('luthier_sha_256_hash')}:</span>{' '}
                        <Show
                            when={!hashingExecutable()}
                            fallback={
                                <span class="inline-flex items-center gap-2 align-middle">
                                    <Spinner class="size-3" />
                                    <Skeleton class="h-3 w-36 rounded-sm" />
                                </span>
                            }
                        >
                            <span class="break-all font-mono text-foreground">
                                {config().exe_hash.trim() || '—'}
                            </span>
                        </Show>
                    </div>
                </div>
            </FieldShell>

            <FieldShell
                label={ct('luthier_extracted_icon')}
                help={ct('luthier_game_icon_preview_for_easier_visual_identification')}
                hint={ct('luthier_visual_is_ready_real_extraction_will_be_wired_to_backend')}
            >
                <div class="icon-preview">
                    <div class="icon-box">
                        <Show when={iconPreviewPath()} fallback={<span>{ct('luthier_no_extracted_icon')}</span>}>
                            <img src={iconPreviewPath()} alt="icon preview" />
                        </Show>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={extractExecutableIcon}
                        disabled={extractingExecutableIcon()}
                    >
                        <Show when={!extractingExecutableIcon()} fallback={<span class="inline-flex items-center gap-2"><Spinner class="size-3" />{ct('luthier_processing')}</span>}>
                            {ct('luthier_extract_icon')}
                        </Show>
                    </Button>
                </div>
            </FieldShell>
        </>
    )
}
