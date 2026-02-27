import {
  ParentProps,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from 'solid-js'

export type Theme = 'dark' | 'light' | 'system'

type ThemeContextValue = {
  theme: () => Theme
  resolvedTheme: () => 'dark' | 'light'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>()

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider(
  props: ParentProps<{
    defaultTheme?: Theme
    storageKey?: string
  }>
) {
  const storageKey = props.storageKey ?? 'vite-ui-theme'
  const defaultTheme = props.defaultTheme ?? 'system'

  const [theme, setThemeSignal] = createSignal<Theme>(defaultTheme)
  const resolvedTheme = createMemo<'dark' | 'light'>(() =>
    theme() === 'system' ? getSystemTheme() : (theme() as 'dark' | 'light')
  )

  const setTheme = (next: Theme) => {
    setThemeSignal(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, next)
    }
  }

  onMount(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      setThemeSignal(saved)
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme() === 'system') {
        const root = window.document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(getSystemTheme())
      }
    }

    media.addEventListener('change', onChange)
    onCleanup(() => media.removeEventListener('change', onChange))
  })

  createEffect(() => {
    if (typeof window === 'undefined') return
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme())
  })

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
      }}
    >
      {props.children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}
