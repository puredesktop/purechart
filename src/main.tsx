import { createRoot } from 'react-dom/client'
import { App } from './App'
import { WhiteNeutral } from './whiteNeutral'
import { EnterpriseLook } from './enterpriseLook'
import './compact-in-room.css'

// held inside another app's page: it lies flat in that page rather than as a page of its own (only while compact)
if (window.parent !== window.top) document.documentElement.setAttribute('data-held-in-room', '')

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
