import { useState } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { Modal } from '../ui/Modal'
import { GeneralTab } from './GeneralTab'
import { AppearanceTab } from './AppearanceTab'
import { NetworkTab } from './NetworkTab'
import { AboutTab } from './AboutTab'

type TabId = 'general' | 'appearance' | 'network' | 'about'

const TABS: Array<{ id: TabId; icon: string; label: string }> = [
  { id: 'general',    icon: 'settings',  label: 'General'    },
  { id: 'appearance', icon: 'palette',   label: 'Appearance' },
  { id: 'network',    icon: 'sensors',   label: 'Network'    },
  { id: 'about',      icon: 'info',      label: 'About'      },
]

export function SettingsModal() {
  const isOpen = useUIStore((s) => s.isSettingsOpen)
  const close = useUIStore((s) => s.closeSettings)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)

  const renderPane = () => {
    switch (activeTab) {
      case 'general':    return <GeneralTab s={settings} update={update} />
      case 'appearance': return <AppearanceTab s={settings} update={update} />
      case 'network':    return <NetworkTab s={settings} update={update} />
      case 'about':      return <AboutTab />
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close}>
      <div
        className="modal-content custom-settings-modal"
        style={{ position: 'relative', maxHeight: '90vh', width: '60vw', minWidth: 480, maxWidth: 780 }}
      >
        <div className="settings-container">
          <div className="settings-sidebar">
            <div className="sidebar-header">
              <span className="material-icons">tune</span>
              <h2>Settings</h2>
            </div>
            <div className="sidebar-nav">
              {TABS.map(({ id, icon, label }) => (
                <button
                  key={id}
                  className={`settings-tab${activeTab === id ? ' active' : ''}`}
                  onClick={() => setActiveTab(id)}
                >
                  <span className="material-icons">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="settings-content">
            <button
              type="button"
              className="btn-close-custom"
              onClick={close}
              aria-label="Close"
            >
              <span className="material-icons">close</span>
            </button>
            <div className="settings-pane active">{renderPane()}</div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
