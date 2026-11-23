import { useRef, useState } from 'react'
import { triggerReconnect } from '../../stores/connectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { apiFetch } from '../../utils/api'
import { showToast } from '../../utils/toast'

export function LinkCodePill() {
  const linkCode = useSettingsStore((s) => s.settings.linkCode)
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setInputVal(linkCode || '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const saveCode = async () => {
    const code = inputVal.trim().toUpperCase()
    setEditing(false)
    if (code.length !== 5) return
    try {
      const res = await apiFetch(`/api/pair/${code}`)
      const result = await res.json()
      if (result.success) {
        useSettingsStore.getState().update({ linkCode: code })
        triggerReconnect()
        showToast('Linked successfully!', 'success')
      } else {
        showToast(`Pairing failed: ${result.message}`, 'error')
      }
    } catch {
      showToast('Connection failed', 'error')
    }
  }

  return (
    <span
      className="sbi sbs link opt2"
      id="linkCodeStatus"
      onDoubleClick={startEdit}
      title="Double-click to enter a link code"
    >
      LINK
      {editing ? (
        <input
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          ref={inputRef}
          className="linkedit"
          type="text"
          maxLength={5}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value.toUpperCase())}
          onBlur={saveCode}
          onKeyDown={(e) => {
            if (e.key === 'Enter') inputRef.current?.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <b>{linkCode || '-----'}</b>
      )}
    </span>
  )
}
