import { ThemeProvider } from './components/theme-provider'
import LuthierPage from './features/luthier/LuthierPage'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="luthier-ui-theme">
      <LuthierPage />
    </ThemeProvider>
  )
}

export default App
