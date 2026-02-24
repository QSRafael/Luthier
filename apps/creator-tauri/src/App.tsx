import { ThemeProvider } from './components/theme-provider'
import CreatorPage from './features/creator/CreatorPage'

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="creator-ui-theme">
      <CreatorPage />
    </ThemeProvider>
  )
}
