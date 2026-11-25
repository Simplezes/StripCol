export type ToastKind =
  | 'handover-offered'
  | 'handover-accepted'
  | 'assume-failed'
  | 'runway-unavailable'
  | 'procedure-unavailable'
  | 'pairing-failed'
  | 'linked'
  | 'connection-failed'
  | 'server-restarting'
  | 'update-available'
  | 'update-ready'
  | 'dev-mode'
  | 'plugin-installed'
  | 'plugin-install-failed'

const ICONS: Record<ToastKind, string> = {
  'handover-offered': 'call_received',
  'handover-accepted': 'done_all',
  'assume-failed': 'block',
  'runway-unavailable': 'flight_takeoff',
  'procedure-unavailable': 'alt_route',
  'pairing-failed': 'link_off',
  linked: 'link',
  'connection-failed': 'cloud_off',
  'server-restarting': 'restart_alt',
  'update-available': 'system_update_alt',
  'update-ready': 'download_done',
  'dev-mode': 'code',
  'plugin-installed': 'extension',
  'plugin-install-failed': 'extension_off',
}

function getOrCreateContainer(): HTMLElement {
  let container = document.getElementById('toastContainer')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toastContainer'
    document.body.appendChild(container)
  }
  return container
}

export function showToast(message: string, kind: ToastKind): void {
  const container = getOrCreateContainer()

  const toast = document.createElement('div')
  toast.className = `atm-toast toast-${kind}`

  const icon = document.createElement('span')
  icon.className = 'material-icons toast-icon'
  icon.textContent = ICONS[kind]

  const msg = document.createElement('span')
  msg.className = 'toast-message'
  msg.textContent = message

  toast.appendChild(icon)
  toast.appendChild(msg)

  container.appendChild(toast)

  setTimeout(() => {
    toast.classList.add('hiding')
    toast.addEventListener('animationend', () => {
      toast.remove()
      if (!container.hasChildNodes()) container.remove()
    })
  }, 4000)
}
