import { useState } from 'react'
import { useUIStore } from '../../stores/uiStore'
import type { FlightPlan } from '../../types'
import { useSelectedStrip } from './useSelectedStrip'

function routeWordClass(word: string): string {
  if (word === 'DCT') return 'p-dct'
  if (/^[A-Z]{1,2}\d{1,3}$/.test(word)) return 'p-awy'
  return 'p-fix'
}

function value(input: unknown): string {
  if (input === undefined || input === null || input === '') return '---'
  return String(input)
}

function FlightFacts({ fp, rwy }: { fp: FlightPlan; rwy: string }) {
  return (
    <div className="kv">
      <div>
        <small>SQUAWK</small>
        <b>{value(fp.squawk)}</b>
      </div>
      <div>
        <small>ALTITUDE</small>
        <b>{value(fp.altitude)}</b>
      </div>
      <div>
        <small>SPEED</small>
        <b>{value(fp.speed)}</b>
      </div>
      <div>
        <small>RUNWAY</small>
        <b>{value(rwy)}</b>
      </div>
      <div>
        <small>CLEARED</small>
        <b>{value(fp.clearedAltitude)}</b>
      </div>
      <div>
        <small>ETA</small>
        <b>{value(fp.estimatedArrival)}</b>
      </div>
    </div>
  )
}

function RouteBlock({ route }: { route: string }) {
  const [open, setOpen] = useState(false)
  const words = route.split(/\s+/).filter(Boolean)

  return (
    <div className="blk">
      <div className="bh">
        <h3 className="gt">Route</h3>
        {words.length > 12 && (
          <button className="lnk" onClick={() => setOpen(!open)}>
            {open ? 'Show less' : `Show all ${words.length}`}
          </button>
        )}
      </div>
      <div className={`card rwbox${open || words.length <= 12 ? ' open' : ''}`}>
        <div className="rw">
          {words.map((word, i) => (
            <span key={`${word}-${i}`} className={routeWordClass(word)}>
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Inspector() {
  const selected = useSelectedStrip()
  const toggleStatusPanel = useUIStore((s) => s.toggleStatusPanel)
  const fp = selected?.strip.flightPlan ?? null

  if (!selected || !fp) {
    return (
      <aside className="insp">
        <p className="empty">
          {selected ? 'This strip has no flight plan attached.' : 'Select a strip to see its flight plan, route and next points.'}
        </p>
      </aside>
    )
  }

  const type = selected.strip.type
  const isArrival = type === 'arrival'
  const procedure = isArrival ? fp.star : fp.sid
  const rwy = (isArrival ? fp.arrivalRwy : fp.departureRwy) ?? ''
  const points = (isArrival ? fp.arrivalPoints : fp.departurePoints) ?? []

  return (
    <aside className="insp" data-type={type}>
      <div className="ih">
        <div className="row1">
          <span className="tag">{type}</span>
        </div>
        <h2>{fp.callsign}</h2>
        <div className="sub">
          {fp.aircraftType || '---'} · {fp.departure || '----'} → {fp.arrival || '----'}
        </div>
      </div>

      <div className="next">
        <span className="lbl">Next step</span>
        <button className="prim" onClick={() => toggleStatusPanel('stations')}>
          Transfer aircraft
        </button>
      </div>

      <FlightFacts fp={fp} rwy={rwy} />

      {procedure && (
        <div className="blk">
          <div className="bh">
            <h3 className="gt">{isArrival ? 'Arrival procedure' : 'Departure procedure'}</h3>
          </div>
          <div className="card proc">
            <span className="sidtag">{isArrival ? 'STAR' : 'SID'}</span>
            <span className="pn">{procedure}</span>
            {rwy && <span className="rwy">RWY {rwy}</span>}
          </div>
        </div>
      )}

      {fp.route && <RouteBlock route={fp.route} />}

      {points.length > 0 && (
        <div className="blk">
          <div className="bh">
            <h3 className="gt">Next points</h3>
          </div>
          <div className="card legs">
            {points.map((point, i) => (
              <div key={`${point.name}-${i}`} className={`leg${i === 0 ? ' next' : ''}`}>
                <span className="via">{point.name}</span>
                <span className="eta">{point.eta ?? '--:--'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
