import type { ReactNode } from 'react'

interface SettingRowProps {
  title: string
  description: string
  disabled?: boolean
  children: ReactNode
}

export function SettingRow({ title, description, disabled = false, children }: SettingRowProps) {
  return (
    <div className={`row${disabled ? ' off' : ''}`}>
      <div className="tx">
        <b>{title}</b>
        <small>{description}</small>
      </div>
      {children}
    </div>
  )
}
