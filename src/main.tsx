import { createRoot } from 'react-dom/client'
import { App } from './App'
import { WhiteNeutral } from './whiteNeutral'
import { EnterpriseLook } from './enterpriseLook'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('PureChart root element #root not found')
}

createRoot(rootElement).render(
  <>
    <WhiteNeutral />
    <EnterpriseLook />
    <App />
  </>,
)
