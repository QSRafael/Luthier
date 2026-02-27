import type { LuthierPageSectionProps } from './page-shared'
import { RegistryMountDialogs } from './dialogs/registry-mount-dialogs'
import { RuntimeAndBrowserDialogs } from './dialogs/runtime-and-browser-dialogs'
import { WinecfgDialogs } from './dialogs/winecfg-dialogs'

export function LuthierDialogs(props: LuthierPageSectionProps) {
    const { view } = props

    return (
        <>
            <RegistryMountDialogs view={view} />
            <WinecfgDialogs view={view} />
            <RuntimeAndBrowserDialogs view={view} />
        </>
    )
}
