import type { Settings } from '../../types'
import { Toggle } from '../ui/Toggle'
import { SettingRow } from '../ui/SettingRow'
import { Divider } from '../ui/Divider'

interface Props {
  s: Settings
  update: (p: Partial<Settings>) => void
}

export function GeneralTab({ s, update }: Props) {
  return (
    <>
      <div className="pane-header">
        <h3>General</h3>
        <p>System and automation preferences</p>
      </div>

      <div className="settings-card">
        <SettingRow
          label="Audio Notifications"
          description="Play a sound on new aircraft arrival."
          control={<Toggle checked={s.audioEnabled} onChange={(v) => update({ audioEnabled: v })} />}
        />
        <Divider />
        <SettingRow
          label="Discord Rich Presence"
          description="Show your current status on Discord."
          control={<Toggle checked={s.discordRpcEnabled} onChange={(v) => update({ discordRpcEnabled: v })} />}
        />
      </div>

      <h6 className="settings-section-title" style={{ marginTop: 16 }}>Strip Automation</h6>
      <div className="settings-card">
        <SettingRow
          label="Auto-move to Clearance"
          description="Automatically move a strip when flightplan is cleared."
          control={<Toggle checked={s.autoMoveClearance} onChange={(v) => update({ autoMoveClearance: v })} />}
        />
        <Divider />
        <SettingRow
          label="Revert to Pending on clear"
          description="Move strip back to Pending if cleared flag is removed."
          control={<Toggle checked={s.autoMoveRevert} onChange={(v) => update({ autoMoveRevert: v })} />}
          style={{ opacity: s.autoMoveClearance ? 1 : 0.4 }}
        />
      </div>

      <h6 className="settings-section-title" style={{ marginTop: 16 }}>Maintenance</h6>
      <div className="settings-card">
        <SettingRow
          label="Auto-Cleanup"
          description="Remove inactive strips automatically."
          control={<Toggle checked={s.cleanupEnabled} onChange={(v) => update({ cleanupEnabled: v })} />}
        />
        <Divider />
        <SettingRow
          label="Cleanup Timeout"
          description="Minutes before removal."
          style={{ display: s.cleanupEnabled ? undefined : 'none' }}
          control={
            <input
              type="number"
              className="sys-input-text"
              min={1}
              max={60}
              value={s.cleanupMinutes}
              onChange={(e) => update({ cleanupMinutes: parseInt(e.target.value) || 15 })}
              onMouseDown={(e) => e.stopPropagation()}
            />
          }
        />
      </div>
    </>
  )
}
