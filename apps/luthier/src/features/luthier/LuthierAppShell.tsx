import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { Toaster } from 'solid-sonner'

import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { useTheme } from '../../components/theme-provider'
import { detectLocale, type Locale } from '../../i18n'
import type { LuthierTab } from '../../models/config'
import { luthierFormat, luthierTranslate, type LuthierCopyKey } from './copy'
import LuthierPage from './LuthierPage'
import { LuthierHomeRoute } from './home/LuthierHomeRoute'
import { pathnameForRoute, routeFromPathname, type AppRoute } from './home/app-route'
import type { ImportedPayloadRequest } from './home/imported-payload-request'
import type { InitialTabRequest } from './home/initial-tab-request'
import { PayloadFileDialog } from './home/PayloadFileDialog'
import type { ResetCreatorRequest } from './home/reset-creator-request'
import type { StartActionId } from './home/start-actions'
import { sonnerNotifier } from './infrastructure/sonner-notifier'

function isConfirmableStartAction(actionId: StartActionId): boolean {
  return (
    actionId === 'create_new' || actionId === 'import_payload' || actionId === 'extract_payload'
  )
}

export function LuthierAppShell() {
  const [route, setRoute] = createSignal<AppRoute>(readCurrentRoute())
  const [locale, setLocale] = createSignal<Locale>(detectLocale())
  const [creatorHasInProgressData, setCreatorHasInProgressData] = createSignal(false)

  const [resetAppliedRequestId, setResetAppliedRequestId] = createSignal<number | null>(null)
  const [queuedResetRequestId, setQueuedResetRequestId] = createSignal<number | null>(null)
  const [queuedStartAction, setQueuedStartAction] = createSignal<StartActionId | null>(null)

  const [importPayloadDialogOpen, setImportPayloadDialogOpen] = createSignal(false)
  const [extractPayloadDialogOpen, setExtractPayloadDialogOpen] = createSignal(false)
  const [discardChangesDialogOpen, setDiscardChangesDialogOpen] = createSignal(false)
  const [pendingDiscardAction, setPendingDiscardAction] = createSignal<StartActionId | null>(null)

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

  createEffect(() => {
    const actionId = queuedStartAction()
    const targetResetId = queuedResetRequestId()
    const appliedResetId = resetAppliedRequestId()
    if (!actionId || targetResetId === null || appliedResetId === null) return
    if (appliedResetId !== targetResetId) return

    setQueuedStartAction(null)
    setQueuedResetRequestId(null)

    if (actionId === 'create_new') {
      navigate('creator')
      return
    }

    if (actionId === 'import_payload') {
      navigate('home')
      setImportPayloadDialogOpen(true)
      return
    }

    if (actionId === 'extract_payload') {
      navigate('home')
      setExtractPayloadDialogOpen(true)
      return
    }
  })

  const handleResetApplied = (requestId: number) => {
    setResetAppliedRequestId(requestId)
    setCreatorHasInProgressData(false)
  }

  let nextImportRequestId = 0
  const applyImportedConfig = (payload: {
    source: 'json' | 'orchestrator'
    fileName: string
    sourcePath?: string
    config: ImportedPayloadRequest['config']
  }) => {
    nextImportRequestId += 1
    setImportRequest({
      id: nextImportRequestId,
      source: payload.source,
      fileName: payload.fileName,
      sourcePath: payload.sourcePath,
      config: payload.config,
    })

    setInitialTabRequest(null)
    setResetRequest(null)
    setImportPayloadDialogOpen(false)
    setExtractPayloadDialogOpen(false)
    setCreatorHasInProgressData(true)
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
  const requestCreatorReset = (): number => {
    nextResetRequestId += 1
    const requestId = nextResetRequestId
    setResetRequest({ id: requestId })
    setImportRequest(null)
    setInitialTabRequest(null)
    return requestId
  }

  const queueActionAfterReset = (actionId: StartActionId) => {
    const requestId = requestCreatorReset()
    setImportPayloadDialogOpen(false)
    setExtractPayloadDialogOpen(false)
    setQueuedStartAction(actionId)
    setQueuedResetRequestId(requestId)
  }

  const runStartAction = (actionId: StartActionId) => {
    if (actionId === 'create_new') {
      queueActionAfterReset(actionId)
      return
    }

    if (actionId === 'import_payload') {
      queueActionAfterReset(actionId)
      return
    }

    if (actionId === 'extract_payload') {
      queueActionAfterReset(actionId)
      return
    }

    sonnerNotifier.notify(ct('luthier_coming_soon'), {
      tone: 'info',
      description: ct('luthier_home_future_action_description'),
    })
  }

  const requestStartAction = (actionId: StartActionId) => {
    const shouldConfirm = isConfirmableStartAction(actionId) && creatorHasInProgressData()
    if (shouldConfirm) {
      setPendingDiscardAction(actionId)
      setDiscardChangesDialogOpen(true)
      return
    }

    runStartAction(actionId)
  }

  const confirmDiscardAndRunAction = () => {
    const actionId = pendingDiscardAction()
    setDiscardChangesDialogOpen(false)
    setPendingDiscardAction(null)
    if (!actionId) return
    runStartAction(actionId)
  }

  const cancelDiscardAction = () => {
    setDiscardChangesDialogOpen(false)
    setPendingDiscardAction(null)
  }

  const pendingActionLabel = createMemo(() => {
    const actionId = pendingDiscardAction()
    if (actionId === 'create_new') return ct('luthier_home_create_new_title')
    if (actionId === 'import_payload') return ct('luthier_home_import_payload_title')
    if (actionId === 'extract_payload') return ct('luthier_home_extract_payload_title')
    return ''
  })

  const discardDescription = createMemo(() => {
    const actionLabel = pendingActionLabel()
    if (!actionLabel) {
      return ct('luthier_home_create_new_confirm_reset')
    }
    return ctf('luthier_home_discard_changes_for_action', {
      action: actionLabel,
    })
  })

  const isHomeRoute = createMemo(() => route() === 'home')

  return (
    <>
      <div classList={{ hidden: !isHomeRoute() }}>
        <LuthierHomeRoute
          ct={ct}
          appName="Luthier"
          localeLabel={sidebarLocaleLabel()}
          themeLabel={sidebarThemeLabel()}
          onCycleLocale={cycleLocale}
          onCycleTheme={cycleTheme}
          onActionSelected={requestStartAction}
          onOpenCreatorTab={openCreatorAtTab}
        />
      </div>

      <div classList={{ hidden: isHomeRoute() }}>
        <LuthierPage
          importRequest={importRequest()}
          initialTabRequest={initialTabRequest()}
          resetRequest={resetRequest()}
          onResetApplied={handleResetApplied}
          onNavigateHome={() => navigate('home')}
          onDirtyStateChange={setCreatorHasInProgressData}
        />
      </div>

      <Dialog open={discardChangesDialogOpen()} onOpenChange={setDiscardChangesDialogOpen}>
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>{ct('luthier_home_discard_changes_title')}</DialogTitle>
            <DialogDescription>{discardDescription()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelDiscardAction}>
              {ct('luthier_label_cancel')}
            </Button>
            <Button type="button" onClick={confirmDiscardAndRunAction}>
              {ct('luthier_label_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Show when={importPayloadDialogOpen()}>
        <PayloadFileDialog
          open={importPayloadDialogOpen()}
          mode="payload_json"
          ct={ct}
          onOpenChange={setImportPayloadDialogOpen}
          onConfigImported={applyImportedConfig}
        />
      </Show>

      <Show when={extractPayloadDialogOpen()}>
        <PayloadFileDialog
          open={extractPayloadDialogOpen()}
          mode="orchestrator_executable"
          ct={ct}
          onOpenChange={setExtractPayloadDialogOpen}
          onConfigImported={applyImportedConfig}
        />
      </Show>

      <Toaster position="bottom-center" theme={theme()} richColors closeButton visibleToasts={5} />
    </>
  )
}

function readCurrentRoute(): AppRoute {
  if (typeof window === 'undefined') return 'home'
  return routeFromPathname(window.location.pathname)
}
