import { For, JSX } from 'solid-js'
import {
  IconChecklist,
  IconCpu,
  IconDeviceGamepad2,
  IconFlask,
  IconInnerShadowTop,
  IconScript,
  IconSettings,
  IconTool,
  IconGauge
} from '@tabler/icons-solidjs'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '../../components/ui/sidebar'
import { CreatorTab } from '../../models/config'

type AppSidebarProps = {
  activeTab: CreatorTab
  onTabChange: (tab: CreatorTab) => void
  tabLabel: (tab: CreatorTab) => string
  appName: string
}

type NavEntry = {
  tab: CreatorTab
  icon: (props: { class?: string }) => JSX.Element
}

const navMain: NavEntry[] = [
  { tab: 'game', icon: IconDeviceGamepad2 },
  { tab: 'runtime', icon: IconCpu },
  { tab: 'performance', icon: IconGauge },
  { tab: 'prefix', icon: IconTool },
  { tab: 'winecfg', icon: IconSettings },
  { tab: 'wrappers', icon: IconFlask },
  { tab: 'scripts', icon: IconScript },
  { tab: 'review', icon: IconChecklist }
]

export function AppSidebar(props: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton active class="cursor-default bg-sidebar-accent text-sidebar-accent-foreground">
              <IconInnerShadowTop class="size-5" />
              <span class="text-left text-sm font-semibold tracking-tight">{props.appName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          <For each={navMain}>
            {(item) => (
              <SidebarMenuItem>
                <SidebarMenuButton
                  active={props.activeTab === item.tab}
                  class="items-start"
                  onClick={() => props.onTabChange(item.tab)}
                >
                  <item.icon class="mt-0.5 size-4 shrink-0" />
                  <span class="text-left leading-tight">{props.tabLabel(item.tab)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </For>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div class="rounded-md border border-dashed px-2.5 py-2 text-xs text-muted-foreground">
          Creator UI · shadcn pattern
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
