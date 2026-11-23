type ToastType = 'info' | 'success' | 'error' | 'warning'

const ICONS: Record<ToastType, string> = {
  info: 'info',
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
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

export function showToast(message: string, type: ToastType = 'info'): void {
  const container = getOrCreateContainer()

  const toast = document.createElement('div')
  toast.className = `atm-toast ${type}`

  const icon = document.createElement('span')
  icon.className = 'material-icons toast-icon'
  icon.textContent = ICONS[type]

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
