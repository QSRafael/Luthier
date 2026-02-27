/**
 * luthier-page-effects-navigation.ts
 *
 * Encapsulates navigation, sidebar, locale, and theme handlers/memos used by
 * LuthierPage presentation effects.
 */

import { createMemo } from 'solid-js'

import { LuthierTab } from '../../models/config'
import { useTheme } from '../../components/theme-provider'
import type { useLuthierController } from './useLuthierController'
import type { createLuthierPageDialogState } from './page-dialog-state'

export function createLuthierPageNavigationEffects(
  controller: ReturnType<typeof useLuthierController>,
  dialogState: ReturnType<typeof createLuthierPageDialogState>
) {
  const { theme, setTheme } = useTheme()
  const { activeTab, setActiveTab, tabs, ct } = controller
  const { setMobileSidebarOpen } = dialogState

  const cycleLocale = () => {
    controller.setLocale(controller.locale() === 'pt-BR' ? 'en-US' : 'pt-BR')
  }

  const cycleTheme = () => {
    const current = theme()
    if (current === 'dark') {
      setTheme('light')
      return
    }
    if (current === 'light') {
      setTheme('system')
      return
    }
    setTheme('dark')
  }

  const sidebarLocaleLabel = createMemo(() => `${ct('luthier_language')}: ${controller.locale()}`)

  const sidebarThemeLabel = createMemo(() => {
    const current = theme()
    const label =
      current === 'dark'
        ? ct('luthier_dark')
        : current === 'light'
          ? ct('luthier_light')
          : ct('luthier_system')
    return `${ct('luthier_theme')}: ${label}`
  })

  const tabIndex = createMemo(() => tabs.indexOf(activeTab()))
  const canGoPrevTab = createMemo(() => tabIndex() > 0)
  const canGoNextTab = createMemo(() => tabIndex() >= 0 && tabIndex() < tabs.length - 1)

  const goPrevTab = () => {
    const index = tabIndex()
    if (index <= 0) return
    setActiveTab(tabs[index - 1])
  }

  const goNextTab = () => {
    const index = tabIndex()
    if (index < 0 || index >= tabs.length - 1) return
    setActiveTab(tabs[index + 1])
  }

  const handleSidebarTabChange = (tab: LuthierTab) => {
    setActiveTab(tab)
    setMobileSidebarOpen(false)
  }

  return {
    theme,
    setTheme,
    cycleLocale,
    cycleTheme,
    sidebarLocaleLabel,
    sidebarThemeLabel,
    tabIndex,
    canGoPrevTab,
    canGoNextTab,
    goPrevTab,
    goNextTab,
    handleSidebarTabChange,
  }
}
