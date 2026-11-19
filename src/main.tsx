import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support, only in the built app (it would get in the way while developing).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // Hand the service worker every file this page loaded, so they're saved for offline.
        const urls = performance.getEntriesByType('resource').map((entry) => entry.name)
        registration.active?.postMessage({ type: 'cache-urls', urls: [location.href, ...urls] })
      })
      .catch(() => {
        /* offline support is a bonus; the app works without it */
      })
  })
}
