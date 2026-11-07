import { createRoot } from 'react-dom/client'
import { App } from './App'
import { EnterpriseLook } from './enterpriseLook'
import { ChartLook } from './ui/look'
import './compact-in-room.css'

// held inside another app's page: it lies flat in that page rather than as a page of its own (only while compact)
if (window.parent !== window.top) document.documentElement.setAttribute('data-held-in-room', '')
// The enterprise look is the look everywhere now, on the desktop as on Pure Server.
document.documentElement.setAttribute('data-pure-look', 'enterprise')

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('PureChart root element #root not found')
}

createRoot(rootElement).render(
  <>
    <ChartLook />
    <EnterpriseLook />
    <App />
  </>,
)
