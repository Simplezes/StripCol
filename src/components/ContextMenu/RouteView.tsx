import type { FlightPlan } from '../../types'
import { BackButton } from './MenuParts'

export function getRouteWordClass(word: string): string {
  const w = word.toUpperCase().split('/')[0]
  if (w === 'DCT') return 'point-dct'
  if (/^(RWY|RW|R)\d+[LR]?$/i.test(w) || /^\d+[LR]$/i.test(w)) return 'point-rwy'
  if (/^[A-Z]{3}$/i.test(w)) return 'point-vor'
  if (/^[A-Z]{5}$/i.test(w)) return 'point-fix'
  if (/^[A-Z]+\d+$/i.test(w) && w.length <= 6) return 'point-awy'
  if (/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{3,}$/i.test(w)) return 'point-proc'
  return 'point-unk'
}

export function RouteView({ flight, onBack }: { flight: FlightPlan; onBack: () => void }) {
  const words = (flight.route ?? '').trim().split(/\s+/).filter(Boolean)
  return (
    <div>
      <div className="menu-header">
        <div className="menu-header-top">
          <span className="menu-callsign">{flight.callsign}</span>
          <span className="menu-type-pill menu-type-pill-route">Route</span>
        </div>
        <div className="menu-header-route">
          <span>{flight.departure || '???'}</span>
          <span className="material-icons">arrow_forward</span>
          <span>{flight.arrival || '???'}</span>
          {flight.aircraftType && <span className="menu-actype">· {flight.aircraftType}</span>}
        </div>
      </div>
      <BackButton onBack={onBack} />
      <div className="menu-scroll-container">
        <div className="route-text-flow">
          {words.length === 0 && (
            <span className="route-empty">No route filed</span>
          )}
          {words.map((word, i) => {
            const parts = word.includes('/') ? word.split('/', 2) : null
            return parts ? (
              <span key={i} className="route-word">
                <span className={getRouteWordClass(parts[0])}>{parts[0]}</span>
                <span className="word-extra">/{parts[1]}</span>
              </span>
            ) : (
              <span key={i} className={`route-word ${getRouteWordClass(word)}`}>
                {word}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
