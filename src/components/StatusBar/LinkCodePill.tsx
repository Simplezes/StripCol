import { useEffect, useRef } from 'react'
import { useDiscoveredSession } from '../../hooks/useDiscoveredSession'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUIStore } from '../../stores/uiStore'

export function LinkCodePill() {
  const linkCode = useSettingsStore((s) => s.settings.linkCode)
  const isOpen = useUIStore((s) => s.statusPanel === 'link')
  const toggle = useUIStore((s) => s.toggleStatusPanel)
  const found = useDiscoveredSession()
  const announced = useRef<string | null>(null)

  const foundCode = found?.code ?? null

  useEffect(() => {
    if (!foundCode || foundCode === announced.current) return
    announced.current = foundCode
    useUIStore.setState({ statusPanel: 'link' })
  }, [foundCode])

  return (
    <button
      className={`sbi sbs link opt2${isOpen ? ' on' : ''}`}
      id="linkCodeStatus"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onClick={() => toggle('link')}
      title="Link to EuroScope"
    >
      LINK
      <b>{linkCode || '-----'}</b>
    </button>
  )
}
