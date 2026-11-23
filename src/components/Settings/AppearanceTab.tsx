import type { Settings } from '../../types'
import { Toggle } from '../ui/Toggle'
import { SettingRow } from '../ui/SettingRow'
import { useUIStore } from '../../stores/uiStore'

interface Props {
  s: Settings
  update: (p: Partial<Settings>) => void
}

type ColorKey = 'departureColor' | 'arrivalColor' | 'overflyColor'

const COLORS: Array<{ key: ColorKey; label: string; token: string }> = [
  { key: 'departureColor', label: 'DEPARTURE', token: '--dep' },
  { key: 'arrivalColor', label: 'ARRIVAL', token: '--arr' },
  { key: 'overflyColor', label: 'OVERFLY', token: '--ovf' },
]

const PREVIEW_CELLS = ['TUMA2A', '4521', '350', 'A320', '13R', '250', '1435', 'H', 'RWY', 'SKCL']

function themeColor(token: string): string {
  return getComputedStyle(document.body).getPropertyValue(token).trim()
}

function PreviewStrip({ callsign, color }: { callsign: string; color: string }) {
  return (
    <div className="ps" style={{ ['--tc' as string]: color }} aria-hidden="true">
      <div className="cs">{callsign}</div>
      {PREVIEW_CELLS.map((cell, i) => (
        <div key={i}>{cell}</div>
      ))}
      {Array.from({ length: 26 }, (_, i) => (
        <div key={`e${i}`} />
      ))}
    </div>
  )
}

export function AppearanceTab({ s, update }: Props) {
  const isLight = s.theme.includes('light')
  const statusHidden = useUIStore((st) => st.statusHidden)
  const setStatusHidden = useUIStore((st) => st.setStatusHidden)

  const colorOf = (key: ColorKey, token: string) => s[key] || themeColor(token)

  return (
    <>
      <div className="ph">
        <h2>Appearance</h2>
        <span>Everything below updates the board live</span>
      </div>

      <div className="pv">
        <h3>Live preview</h3>
        {COLORS.map(({ key, token }, i) => (
          <PreviewStrip key={key} callsign={['AVA9021', 'LAN2564', 'CMP318'][i]} color={`var(--user-${key.replace('Color', '')}-color, var(${token}))`} />
        ))}
      </div>

      <section className="grp">
        <h3>Theme</h3>
        <div className="themes">
          <button className={`th d${isLight ? ' on' : ''}`} onClick={() => update({ theme: 'light' })}>
            <div className="sw2">
              <i style={{ borderColor: '#1b45a8' }} />
              <i style={{ borderColor: '#7d3f12' }} />
            </div>
            Day — light, for lit towers
          </button>
          <button className={`th n${isLight ? '' : ' on'}`} onClick={() => update({ theme: 'dark' })}>
            <div className="sw2">
              <i style={{ borderColor: '#7fb0ff' }} />
              <i style={{ borderColor: '#f0a367' }} />
            </div>
            Night — dark, for dim rooms
          </button>
        </div>
      </section>

      <section className="grp">
        <h3>Strips</h3>
        <div className="card">
          <SettingRow title="Dark strips" description="Keep strips dark even when the Day theme is on.">
            <Toggle label="Dark strips" checked={s.darkStrips} onChange={(v) => update({ darkStrips: v })} />
          </SettingRow>
          <div className="cols">
            {COLORS.map(({ key, label, token }) => (
              <div className="col" key={key}>
                <label>
                  <i style={{ background: colorOf(key, token) }} />
                  {label}
                </label>
                <div className="pk">
                  <input
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    type="color"
                    value={colorOf(key, token)}
                    aria-label={`${label.toLowerCase()} colour`}
                    onChange={(e) => update({ [key]: e.target.value })}
                  />
                  <code>{colorOf(key, token).toUpperCase()}</code>
                </div>
              </div>
            ))}
          </div>
          <div className="row">
            <div className="tx">
              <b>Traffic colours</b>
              <small>Return all three colours to the theme defaults.</small>
            </div>
            <button className="btn" onClick={() => update({ departureColor: '', arrivalColor: '', overflyColor: '' })}>
              Reset colours
            </button>
          </div>
        </div>
      </section>

      <section className="grp">
        <h3>Title bar</h3>
        <div className="card">
          <SettingRow title="Seconds on the Zulu clock" description="Shows 14:32:07 instead of 14:32.">
            <Toggle label="Show seconds" checked={s.showSeconds} onChange={(v) => update({ showSeconds: v })} />
          </SettingRow>
          <SettingRow title="Status bar" description="Show the bottom bar with the tools, link code and version. Right-click it to choose what it shows.">
            <Toggle label="Status bar" checked={!statusHidden} onChange={(v) => setStatusHidden(!v)} />
          </SettingRow>
          <SettingRow title="Auto-hide title bar" description="Hide the title bar until the pointer reaches the top edge.">
            <Toggle label="Auto-hide title bar" checked={s.autohideHeader} onChange={(v) => update({ autohideHeader: v })} />
          </SettingRow>
        </div>
      </section>
    </>
  )
}
