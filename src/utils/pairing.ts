import { triggerReconnect } from '../stores/connectionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { apiFetch } from './api'
import { showToast } from './toast'

export async function pairWithCode(code: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/pair/${code}`)
    const result = await res.json()
    if (!result.success) {
      showToast(`Pairing failed: ${result.message}`, 'error')
      return false
    }
    useSettingsStore.getState().update({ linkCode: code })
    triggerReconnect()
    showToast('Linked successfully!', 'success')
    return true
  } catch {
    showToast('Connection failed', 'error')
    return false
  }
}
