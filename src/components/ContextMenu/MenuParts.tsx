import type { ReactNode } from 'react'
import type { FlightPlan } from '../../types'
import { RoleIcon } from '../StatusBar/RoleIcon'
import { Arrow, Icon } from './Icon'

interface ItemProps {
  label: string
  icon?: string
  role?: string
  value?: string
  frequency?: string
  tone?: 'ok' | 'no'
  chevron?: boolean
  current?: boolean
  swatch?: string
  hot?: boolean
  onClick?: () => void
}

export function Item({ label, icon, role, value, frequency, tone, chevron, current, swatch, hot, onClick }: ItemProps) {
  const classes = ['mi']
  if (tone) classes.push(tone)
  if (current) classes.push('cur')
  if (hot) classes.push('hot')
  if (swatch) classes.push(swatch)

  return (
    <div className={classes.join(' ')} role="menuitem" onClick={onClick}>
      {icon && <Icon name={icon} />}
      {role && <RoleIcon role={role} />}
      {swatch && <span className="sw" />}
      <span className="l">{label}</span>
      {value && <span className="v">{value}</span>}
      {frequency && <span className="fq">{frequency}</span>}
      {current && <Icon name="check" className="c acc" />}
      {chevron && <Icon name="chev" className="c" />}
    </div>
  )
}

export function Group({ label }: { label: string }) {
  return <div className="grp">{label}</div>
}

export function Sep() {
  return <div className="sep" />
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="field">{children}</div>
}

interface HeaderProps {
  flight: FlightPlan
  pill: string
  pillClass?: string
  chips?: string[]
}

export function MenuHeader({ flight, pill, pillClass = '', chips = [] }: HeaderProps) {
  return (
    <div className="mh">
      <div className="row">
        <span className="cs">{flight.callsign}</span>
        <span className={`pill ${pillClass}`}>{pill}</span>
      </div>
      <div className="rt">
        {flight.departure || '????'}
        <Arrow />
        {flight.arrival || '????'}
        {flight.aircraftType ? ` · ${flight.aircraftType}` : ''}
      </div>
      {chips.length > 0 && (
        <div className="chips">
          {chips.map((chip) => (
            <span className="cchip" key={chip}>
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
