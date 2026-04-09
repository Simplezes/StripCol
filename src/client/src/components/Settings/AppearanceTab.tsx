import { useEffect, useState } from 'react'
import type { Settings } from '../../types'
import { Toggle } from '../ui/Toggle'
import { SettingRow } from '../ui/SettingRow'
import { Divider } from '../ui/Divider'
import { Dropdown, type DropdownOption } from '../ui/Dropdown'

interface Props {
  s: Settings
  update: (p: Partial<Settings>) => void
}

const DEFAULT_COLORS = {
  departureColor: '#6ee7b7',
  arrivalColor: '#f87171',
  overflyColor: '#fde68a',
}

function getThemeIcon(val: string): string {
  if (val === 'dark') return 'dark_mode'
  if (val.includes('light')) return 'light_mode'
  if (val.includes('windows')) return 'desktop_windows'
  if (val.includes('radar')) return 'radar'
  if (val.includes('modern')) return 'auto_awesome'
  return 'palette'
}

function toThemeLabel(filename: string): string {
  return filename
    .replace('.css', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

export function AppearanceTab({ s, update }: Props) {
  const [userThemes, setUserThemes] = useState<string[]>([])

  useEffect(() => {
    window.electronAPI?.listUserThemes?.()
      .then((themes) => setUserThemes(themes))
      .catch(() => {})
  }, [])

  const themeOptions: DropdownOption[] = [
    { value: 'dark', label: 'Dark', icon: getThemeIcon('dark') },
    ...userThemes.map((t) => ({ value: t, label: toThemeLabel(t), icon: getThemeIcon(t) })),
  ]

  return (
    <>
      <div className="pane-header">
        <h3>Appearance</h3>
        <p>Customize the look and feel of your layout</p>
      </div>

      <div className="settings-card">
        <SettingRow
          label="Interface Theme"
          description="Choose the overall workspace theme."
          control={
            <Dropdown
              value={s.theme}
              options={themeOptions}
              onChange={(val) => update({ theme: val })}
            />
          }
        />
        <Divider />
        <SettingRow
          label="Dark Strips"
          description="Force flight strips to have a dark background."
          control={<Toggle checked={s.darkStrips} onChange={(v) => update({ darkStrips: v })} />}
        />
        <Divider />
        <SettingRow
          label="Show Seconds"
          description="Toggle seconds on the Zulu clock."
          control={<Toggle checked={s.showSeconds} onChange={(v) => update({ showSeconds: v })} />}
        />
        <Divider />
        <SettingRow
          label="Autohide Header"
          description="Hide the system bar when not in use."
          control={<Toggle checked={s.autohideHeader} onChange={(v) => update({ autohideHeader: v })} />}
        />
      </div>

      <h6 className="settings-section-title" style={{ marginTop: 16 }}>Strip Colors</h6>
      <div className="settings-card">
        <div className="color-grid">
          {(['departureColor', 'arrivalColor', 'overflyColor'] as const).map((key) => (
            <div key={key} className="color-picker-group">
              <div className="color-label">{key.replace('Color', '')}</div>
              <div className="color-input-wrapper">
                <input
                  type="color"
                  value={s[key]}
                  onChange={(e) => update({ [key]: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            className="custom-btn secondary"
            style={{ width: '100%' }}
            onClick={() => update({ ...DEFAULT_COLORS })}
          >
            <span className="material-icons">restart_alt</span> Reset Defaults
          </button>
        </div>
      </div>
    </>
  )
}
