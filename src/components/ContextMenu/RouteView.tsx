import type { FlightPlan, StripType } from '../../types'
import { Arrow } from './Icon'
import { MenuHeader } from './MenuParts'
import { buildLegs, routeWordClass } from './routeLegs'

export function RouteView({ flight, type }: { flight: FlightPlan; type: StripType }) {
  const legs = buildLegs(flight)

  return (
    <div className="cm w360" role="menu" data-type={type}>
      <MenuHeader flight={flight} pill="Route" />
      {legs.length === 0 && <div className="grp">No route filed</div>}
      <div className="cm-legs">
        {legs.map((leg, i) => (
          <div key={`${leg.to}-${i}`} className={`cm-leg${i === 0 ? ' next' : ''}`}>
            <span className={`via ${routeWordClass(leg.via)}`}>{leg.via}</span>
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
