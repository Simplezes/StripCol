import type { CSSProperties, ReactNode } from 'react'

interface SettingRowProps {
  label: string
  description?: string
  control: ReactNode
  style?: CSSProperties
}

export function SettingRow({ label, description, control, style }: SettingRowProps) {
  return (
    <div className="settings-item" style={style}>
      <div className="settings-info">
        <div className="settings-label">{label}</div>
        {description && <div className="settings-description">{description}</div>}
      </div>
      <div className="settings-control">{control}</div>
    </div>
  )
}
