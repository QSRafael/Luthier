import { ThemeProvider } from './components/theme-provider'
import LuthierPage from './features/luthier/LuthierPage'

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="luthier-ui-theme">
      <LuthierPage />
    </ThemeProvider>
  )
}
