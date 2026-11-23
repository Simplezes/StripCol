import { useUIStore } from '../../stores/uiStore'
import type { FlightPlan } from '../../types'
import { Arrow } from '../ContextMenu/Icon'
import { buildLegs, routeWordClass } from '../ContextMenu/routeLegs'
import { useSelectedStrip } from './useSelectedStrip'

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

function RouteBlock({ flight }: { flight: FlightPlan }) {
  const legs = buildLegs(flight)

  return (
    <div className="blk">
      <div className="bh">
        <h3 className="gt">
          Route<span className="cnt2">{legs.length} {legs.length === 1 ? 'leg' : 'legs'}</span>
        </h3>
      </div>
      <div className="card legs">
        {legs.map((leg, i) => (
          <div key={`${leg.to}-${i}`} className={`leg${i === 0 ? ' next' : ''}`}>
            <span className={`via ${routeWordClass(leg.via)}`} title={leg.via}>{leg.via}</span>
            <span className="pts">
              <em>{leg.from}</em>
              <i>
                <Arrow />
              </i>
              <b>{leg.to}</b>
            </span>
            <span className="eta">{leg.eta}</span>
          </div>
        ))}
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
            <span className="pn" title={procedure}>{procedure}</span>
            {rwy && <span className="rwy">RWY {rwy}</span>}
          </div>
        </div>
      )}

      {fp.route && <RouteBlock flight={fp} />}

    </aside>
  )
}
