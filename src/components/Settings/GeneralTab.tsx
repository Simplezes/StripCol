import type { Settings } from '../../types'
import { playNotificationSound } from '../../utils/sound'
import { applyClearanceAutoMoveToBoard } from '../../utils/stripActions'
import { Toggle } from '../ui/Toggle'
import { SettingRow } from '../ui/SettingRow'

interface Props {
  s: Settings
  update: (p: Partial<Settings>) => void
}

function Stage({ label, active = false }: { label: string; active?: boolean }) {
  return <span className={`fs${active ? ' go' : ''}`}>{label}</span>
}

function Arrow({ label, back = false, on }: { label: string; back?: boolean; on: boolean }) {
  return (
    <span className={`fa${back ? ' back' : ''}${on ? '' : ' off'}`}>
      <span>{label}</span>
      <svg viewBox="0 0 24 24">
        <path d="M8 4l8 8-8 8" />
      </svg>
    </span>
  )
}

export function GeneralTab({ s, update }: Props) {
  const stepMinutes = (delta: number) =>
    update({ cleanupMinutes: Math.min(60, Math.max(1, s.cleanupMinutes + delta)) })

  const updateAutoMove = (patch: Partial<Settings>) => {
    update(patch)
    applyClearanceAutoMoveToBoard()
  }

  return (
    <>
      <div className="ph">
        <h2>General</h2>
        <span>Alerts, automation and housekeeping</span>
      </div>

      <section className="grp">
        <h3>Alerts</h3>
        <div className="card">
          <SettingRow title="Audio notifications" description="Play a chime when a new aircraft arrives or a handover is offered.">
            <button className="btn" onClick={playNotificationSound}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 4l14 8-14 8z" />
              </svg>
              Test sound
            </button>
            <Toggle label="Audio notifications" checked={s.audioEnabled} onChange={(v) => update({ audioEnabled: v })} />
          </SettingRow>
        </div>
      </section>

      <section className="grp">
        <h3>Strip automation</h3>
        <div className="card">
          <div className="flow" aria-hidden="true">
            <Stage label="Pending" />
            <span className="fl">
              <Arrow label="flightplan cleared" on={s.autoMoveClearance} />
              <Arrow label="clearance removed" back on={s.autoMoveClearance && s.autoMoveRevert} />
            </span>
            <Stage label="Clearance" active />
          </div>
          <SettingRow title="Auto-move to Clearance" description="Move a strip as soon as its flightplan is cleared.">
            <Toggle label="Auto-move to Clearance" checked={s.autoMoveClearance} onChange={(v) => updateAutoMove({ autoMoveClearance: v })} />
          </SettingRow>
          <SettingRow title="Revert to Pending" description="Send the strip back when the cleared flag is removed." disabled={!s.autoMoveClearance}>
            <Toggle label="Revert to Pending" checked={s.autoMoveRevert} onChange={(v) => updateAutoMove({ autoMoveRevert: v })} />
          </SettingRow>
        </div>
      </section>

      <section className="grp">
        <h3>Maintenance</h3>
        <div className="card">
          <SettingRow title="Auto-cleanup" description="Remove strips of aircraft that have been inactive.">
            <Toggle label="Auto-cleanup" checked={s.cleanupEnabled} onChange={(v) => update({ cleanupEnabled: v })} />
          </SettingRow>
          <SettingRow title="Cleanup timeout" description="Minutes of inactivity before a strip is removed (1–60)." disabled={!s.cleanupEnabled}>
            <div className="step">
              <button aria-label="Less" onClick={() => stepMinutes(-1)}>
                −
              </button>
              <output>{s.cleanupMinutes} min</output>
              <button aria-label="More" onClick={() => stepMinutes(1)}>
                +
              </button>
            </div>
          </SettingRow>
        </div>
      </section>
    </>
  )
}
