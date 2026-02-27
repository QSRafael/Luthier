import { render } from 'solid-js/web'

import App from './App'
import './styles/app.css'

function bootstrap() {
  const root = document.getElementById('root')

  if (!root) {
    throw new Error('Root element #root was not found')
  }

  render(() => <App />, root)
}

bootstrap()
