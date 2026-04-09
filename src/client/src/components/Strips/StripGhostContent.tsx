import { useSettingsStore } from '../../stores/settingsStore'
import type { StripData } from '../../types'

function formatC33(ts: number): { date: string; time: string } {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${String(d.getUTCFullYear()).slice(-2)}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
  }
}

const CELL_CLASSES: string[] = [
  'c1 al_ot', 'c2 le_ot ri_ot bt_ot', 'c3 ri_ot bt_ot', 'c4 le_ot ri_ot bt_ot',
  'c5 ri_ot bt_ot', 'c6 ri_ot tp_ot bt_ot', 'c7 ri_ot tp_ot bt_ot', 'c8',
  'c9 ri_ot', 'c10 bt_ot', 'c11 bt_ot', 'c12 ri_ot bt_ot',
  'c13 tp_ot ri_ot', 'c14 ri_ot', 'c15 bt_ot ri_ot', 'c16 tp_ot ri_ot',
  'c17 ri_ot', 'c18 bt_ot ri_ot', 'c19 ri_ot tp_ot bt_ot', 'c20 ri_ot tp_ot bt_ot',
  'c21 ri_ot tp_ot bt_ot', 'c22 ri_ot tp_ot bt_ot', 'c23 ri_ot tp_ot',
  'c24 ri_ot bt_ot', 'c25 ri_ot bt_ot', 'c26 ri_ot bt_ot', 'c27 ri_ot bt_ot',
  'c28 ri_ot', 'c29 ri_ot bt_ot', 'c30 ri_ot bt_ot', 'c31 ri_ot bt_ot', 'c32 ri_ot bt_ot',
]
const CELL_KEYS = CELL_CLASSES.map((cls) => cls.split(' ')[0])

interface StripGhostContentProps {
  strip: StripData
  panelName: string
}

export function StripGhostContent({ strip }: StripGhostContentProps) {
  const autohideHeader = useSettingsStore.getState().settings.autohideHeader
  const c33 = formatC33(strip.lastUpdate)

  return (
    <div
      className={`strip draggable strip-drag-overlay${autohideHeader ? ' theme-autohide-header' : ''}`}
      data-strip-id={strip.id}
      data-type={strip.type}
      data-euroscope={strip.euroscope ? 'true' : 'false'}
    >
      {CELL_KEYS.map((key, i) => (
        <input
          key={key}
          className={`box ${CELL_CLASSES[i]}`}
          value={strip.values[key] ?? ''}
          readOnly
          tabIndex={-1}
          style={{ fontSize: 'clamp(8px, 1cqw, 16px)', pointerEvents: 'none' }}
          data-cell={key}
          spellCheck={false}
          autoComplete="off"
        />
      ))}

      <div
        className="box c33 ri_ot bt_ot"
        style={{
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center',
          fontSize: '60%',
          color: 'var(--sys-text)',
          pointerEvents: 'none',
        }}
      >
        <span>{c33.date}</span>
        <span>{c33.time}</span>
      </div>
    </div>
  )
}
