import { useEffect, useState } from 'react'
import { useConnectionStore } from '../../stores/connectionStore'
import { useUIStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { getAppVersion } from '../../platform/desktop'
import { Modal } from '../ui/Modal'
import { GeneralTab } from './GeneralTab'
import { AppearanceTab } from './AppearanceTab'
import { ConnectionTab } from './ConnectionTab'
import { IntegrationsTab } from './IntegrationsTab'
import { AboutTab } from './AboutTab'

type TabId = 'general' | 'appearance' | 'connection' | 'integrations' | 'about'

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'general', label: 'General', icon: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z' },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.4-2-.7-1.2 0-2.5 1.6-2.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z',
  },
  { id: 'connection', label: 'Connection', icon: 'M5 9a10 10 0 0 1 14 0M8 12.5a6 6 0 0 1 8 0M11 16a2 2 0 0 1 2 0M12 19.5v.01' },
  { id: 'integrations', label: 'Integrations', icon: 'M9 4v4M15 4v4M7 8h10v4a5 5 0 0 1-10 0V8zM12 17v3' },
  { id: 'about', label: 'About', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8v.01' },
]

export function SettingsModal() {
  const isOpen = useUIStore((s) => s.isSettingsOpen)
  const close = useUIStore((s) => s.closeSettings)
  const hasUpdate = useUIStore((s) => s.hasUpdate)
  const isPaired = useConnectionStore((s) => s.isPaired)
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (isOpen) getAppVersion().then(setVersion).catch(() => {})
  }, [isOpen])

  const renderPane = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab s={settings} update={update} />
      case 'appearance':
        return <AppearanceTab s={settings} update={update} />
      case 'connection':
        return <ConnectionTab s={settings} update={update} />
      case 'integrations':
        return <IntegrationsTab s={settings} update={update} />
      case 'about':
        return <AboutTab />
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close}>
      <div className="settings" role="dialog" aria-label="Settings">
        <header className="hd">
          <span className="mk">
            <i />
          </span>
          <div className="ttl">
            <span className="crumb">StripCol</span>
            <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
              <path d="M1.5 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1>Settings</h1>
          </div>
          <span className="sp1" />
          {version && <span className="ver">v{version}</span>}
          <button className="x" aria-label="Close" onClick={close}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="main">
          <nav className="nav" role="tablist" aria-label="Settings sections">
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                className={`tab${activeTab === id ? ' on' : ''}`}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={icon} />
                </svg>
                <span className="tl">{label}</span>
                {id === 'connection' && <i className={`dot${isPaired ? '' : ' w'}`} />}
                {id === 'about' && hasUpdate && <i className="dot w" />}
              </button>
            ))}
            <p className="navfoot">Changes apply instantly and are saved on this computer.</p>
          </nav>
          <div className="pane">{renderPane()}</div>
        </div>
      </div>
    </Modal>
  )
}
