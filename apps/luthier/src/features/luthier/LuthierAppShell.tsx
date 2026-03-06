import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { Toaster } from 'solid-sonner'

import { useTheme } from '../../components/theme-provider'
import { detectLocale, type Locale } from '../../i18n'
import type { LuthierTab } from '../../models/config'
import { luthierFormat, luthierTranslate, type LuthierCopyKey } from './copy'
import { LuthierHomeRoute } from './home/LuthierHomeRoute'
import { PayloadFileDialog } from './home/PayloadFileDialog'
import { pathnameForRoute, routeFromPathname, type AppRoute } from './home/app-route'
import type { ImportedPayloadRequest } from './home/imported-payload-request'
import type { InitialTabRequest } from './home/initial-tab-request'
import type { ResetCreatorRequest } from './home/reset-creator-request'
import type { StartActionId } from './home/start-actions'
import { sonnerNotifier } from './infrastructure/sonner-notifier'
import LuthierPage from './LuthierPage'

export function LuthierAppShell() {
  const [route, setRoute] = createSignal<AppRoute>(readCurrentRoute())
  const [locale, setLocale] = createSignal<Locale>(detectLocale())

  const [importPayloadDialogOpen, setImportPayloadDialogOpen] = createSignal(false)
  const [extractPayloadDialogOpen, setExtractPayloadDialogOpen] = createSignal(false)

  const [importRequest, setImportRequest] = createSignal<ImportedPayloadRequest | null>(null)
  const [initialTabRequest, setInitialTabRequest] = createSignal<InitialTabRequest | null>(null)
  const [resetRequest, setResetRequest] = createSignal<ResetCreatorRequest | null>(null)

  const { theme, setTheme } = useTheme()

  const ct = (key: LuthierCopyKey): string => luthierTranslate(locale(), key)
  const ctf = (key: LuthierCopyKey, params: Record<string, string | number>): string =>
    luthierFormat(locale(), key, params)

  const navigate = (nextRoute: AppRoute) => {
    const nextPath = pathnameForRoute(nextRoute)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setRoute(nextRoute)
  }

  const cycleLocale = () => {
    const nextLocale: Locale = locale() === 'pt-BR' ? 'en-US' : 'pt-BR'
    localStorage.setItem('luthier.locale', nextLocale)
    setLocale(nextLocale)
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

  const sidebarLocaleLabel = createMemo(() => `${ct('luthier_language')}: ${locale()}`)
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

  const handlePopState = () => {
    setRoute(readCurrentRoute())
  }

  onMount(() => {
    window.addEventListener('popstate', handlePopState)

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'luthier.locale') return
      setLocale(detectLocale())
    }

    window.addEventListener('storage', handleStorage)

    onCleanup(() => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('storage', handleStorage)
    })
  })

  createEffect(() => {
    if (route() === 'home') {
      setLocale(detectLocale())
    }
  })

  let nextImportRequestId = 0
  const applyImportedConfig = (payload: {
    source: 'json' | 'orchestrator'
    fileName: string
    config: ImportedPayloadRequest['config']
  }) => {
    nextImportRequestId += 1
    setImportRequest({
      id: nextImportRequestId,
      source: payload.source,
      fileName: payload.fileName,
      config: payload.config,
    })

    setInitialTabRequest(null)
    setResetRequest(null)
    setImportPayloadDialogOpen(false)
    setExtractPayloadDialogOpen(false)
    navigate('creator')
  }

  let nextInitialTabRequestId = 0
  const openCreatorAtTab = (tab: LuthierTab) => {
    nextInitialTabRequestId += 1
    setInitialTabRequest({ id: nextInitialTabRequestId, tab })
    setImportRequest(null)
    setResetRequest(null)
    navigate('creator')
  }

  let nextResetRequestId = 0
  const resetCreator = () => {
    nextResetRequestId += 1
    setResetRequest({ id: nextResetRequestId })
    setImportRequest(null)
    setInitialTabRequest(null)
    navigate('creator')
  }

  const handleStartAction = (actionId: StartActionId) => {
    if (actionId === 'create_new') {
      if (route() === 'creator') {
        const confirmed = window.confirm(ct('luthier_home_create_new_confirm_reset'))
        if (!confirmed) return
      }
      resetCreator()
      return
    }

    if (actionId === 'import_payload') {
      setImportPayloadDialogOpen(true)
      return
    }

    if (actionId === 'extract_payload') {
      setExtractPayloadDialogOpen(true)
      return
    }

    sonnerNotifier.notify(ct('luthier_coming_soon'), {
      tone: 'info',
      description: ct('luthier_home_future_action_description'),
    })
  }

  const isHomeRoute = createMemo(() => route() === 'home')

  return (
    <>
      <Show
        when={isHomeRoute()}
        fallback={
          <LuthierPage
            importRequest={importRequest()}
            initialTabRequest={initialTabRequest()}
            resetRequest={resetRequest()}
            onNavigateHome={() => navigate('home')}
          />
        }
      >
        <LuthierHomeRoute
          ct={ct}
          appName="Luthier"
          localeLabel={sidebarLocaleLabel()}
          themeLabel={sidebarThemeLabel()}
          onCycleLocale={cycleLocale}
          onCycleTheme={cycleTheme}
          onActionSelected={handleStartAction}
          onOpenCreatorTab={openCreatorAtTab}
        />
      </Show>

      <PayloadFileDialog
        open={importPayloadDialogOpen()}
        mode="payload_json"
        ct={ct}
        ctf={ctf}
        onOpenChange={setImportPayloadDialogOpen}
        onConfigImported={applyImportedConfig}
      />

      <PayloadFileDialog
        open={extractPayloadDialogOpen()}
        mode="orchestrator_executable"
        ct={ct}
        ctf={ctf}
        onOpenChange={setExtractPayloadDialogOpen}
        onConfigImported={applyImportedConfig}
      />

      <Toaster position="bottom-center" theme={theme()} richColors closeButton visibleToasts={5} />
    </>
  )
}

function readCurrentRoute(): AppRoute {
  if (typeof window === 'undefined') return 'home'
  return routeFromPathname(window.location.pathname)
}
