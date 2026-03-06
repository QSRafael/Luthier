import { ThemeProvider } from './components/theme-provider'
import { LuthierAppShell } from './features/luthier/LuthierAppShell'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="luthier-ui-theme">
      <LuthierAppShell />
    </ThemeProvider>
  )
}

export default App
