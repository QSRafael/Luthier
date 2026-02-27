import { For, JSX } from 'solid-js'
import {
  IconBrandGithub,
  IconBrandPatreon,
  IconCoffee,
  IconChecklist,
  IconCpu,
  IconDeviceGamepad2,
  IconFlask,
  IconInnerShadowTop,
  IconLanguage,
  IconSunMoon,
  IconSettings,
  IconTool,
  IconGauge,
  IconFolder,
} from '@tabler/icons-solidjs'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '../../components/ui/sidebar'
import { LuthierTab } from '../../models/config'

type AppSidebarProps = {
  activeTab: LuthierTab
  onTabChange: (tab: LuthierTab) => void
  tabLabel: (tab: LuthierTab) => string
  appName: string
  localeLabel: string
  themeLabel: string
  onCycleLocale: () => void
  onCycleTheme: () => void
  class?: string
}

type NavEntry = {
  tab: LuthierTab
  icon: (props: { class?: string }) => JSX.Element
}

const navMain: NavEntry[] = [
  { tab: 'game', icon: IconDeviceGamepad2 },
  { tab: 'gameFiles', icon: IconFolder },
  { tab: 'runtime', icon: IconCpu },
  { tab: 'performance', icon: IconGauge },
  { tab: 'prefix', icon: IconTool },
  { tab: 'winecfg', icon: IconSettings },
  { tab: 'wrappers', icon: IconFlask },
  { tab: 'review', icon: IconChecklist },
]

export function AppSidebar(props: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" class={props.class}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              active
              class="cursor-default bg-sidebar-accent text-sidebar-accent-foreground"
            >
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
        <div class="grid gap-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={props.onCycleLocale}>
                <IconLanguage class="size-4 shrink-0" />
                <span class="truncate">{props.localeLabel}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={props.onCycleTheme}>
                <IconSunMoon class="size-4 shrink-0" />
                <span class="truncate">{props.themeLabel}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <div class="rounded-md border border-dashed border-sidebar-border/80 px-2.5 py-2">
            <div class="flex items-center justify-center gap-2">
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="GitHub"
                aria-label="GitHub"
              >
                <IconBrandGithub class="size-4" />
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="Patreon"
                aria-label="Patreon"
              >
                <IconBrandPatreon class="size-4" />
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="Ko-fi"
                aria-label="Ko-fi"
              >
                <IconCoffee class="size-4" />
              </button>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
