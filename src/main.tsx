import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { useSettingsStore } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { checkForUpdates } from './platform/updater'
import { showToast } from './utils/toast'

useSettingsStore.getState().load()
checkForUpdates({
  onAvailable: (version) => {
    useUIStore.getState().setHasUpdate(true)
    showToast(`Update available: V${version}`, 'info')
  },
})

document.addEventListener('keydown', (e) => {
  if (
    e.key === 'F5' ||
    ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))
  ) {
    e.preventDefault()
  }
  if (
    e.key === 'Backspace' &&
    (document.activeElement as HTMLElement)?.tagName !== 'INPUT' &&
    (document.activeElement as HTMLElement)?.tagName !== 'TEXTAREA'
  ) {
    e.preventDefault()
  }
})

document.addEventListener('contextmenu', (e) => e.preventDefault())
document.addEventListener('dragover', (e) => e.preventDefault())
document.addEventListener('drop', (e) => e.preventDefault())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
