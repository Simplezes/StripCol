import { usePanelStore } from '../../stores/panelStore'
import { apiFetch } from '../../utils/api'
import { deleteStripByCallsign, renderAircraftAsStrip } from '../../utils/stripActions'
import { PLAN_TYPE_LABELS } from './FlightInfoView'
import { MenuItem, MenuSection } from './MenuParts'
import { getLinkCode } from './menuHelpers'
import type { MenuView } from './menuTypes'

export function MainView({
  stripId,
  panelName,
  setView,
  onClose,
}: {
  stripId: string
  panelName: string
  setView: (v: MenuView) => void
  onClose: () => void
}) {
  const strip = usePanelStore.getState().getStrip(stripId)
  if (!strip) return null

  const { euroscope, flightPlan: fp, type } = strip
  const isTransfer = euroscope && fp?.transfer

  const handleDelete = () => {
    if (!euroscope || !fp) {
      usePanelStore.getState().removeStrip(panelName, stripId)
    } else {
      deleteStripByCallsign(fp.callsign)
    }
    onClose()
  }

  if (isTransfer && fp) {
    return (
      <div>
        <div className="menu-header menu-header-transfer">
          <div className="menu-header-top">
            <span className="menu-callsign">{fp.callsign}</span>
            <span className="menu-type-pill menu-type-pill-transfer">Handoff</span>
          </div>
          <div className="menu-header-route">
            <span>{fp.departure || '???'}</span>
            <span className="material-icons">arrow_forward</span>
            <span>{fp.arrival || '???'}</span>
            {fp.aircraftType && <span className="menu-actype">· {fp.aircraftType}</span>}
          </div>
        </div>
        <div className="menu-scroll-container">
          <div className="handoff-actions">
            <div
              className="handoff-btn handoff-accept"
              onClick={async () => {
                try {
                  const res = await apiFetch('/api/accept-handoff', {
                    method: 'POST',
                    body: JSON.stringify({ code: getLinkCode(), callsign: fp.callsign }),
                  })
                  if (res.ok) {
                    deleteStripByCallsign(fp.callsign)
                    renderAircraftAsStrip({ ...fp, transfer: false })
                  } else {
                    usePanelStore.getState().removeStrip(panelName, stripId)
                  }
                } catch (err) {
                  console.error('Accept handoff failed:', err)
                  usePanelStore.getState().removeStrip(panelName, stripId)
                }
                onClose()
              }}
            >
              <span className="material-icons">check_circle</span>
              Accept
            </div>
            <div
              className="handoff-btn handoff-refuse"
              onClick={async () => {
                try {
                  const res = await apiFetch('/api/refuse-handoff', {
                    method: 'POST',
                    body: JSON.stringify({ code: getLinkCode(), callsign: fp.callsign }),
                  })
                  if (res.ok) deleteStripByCallsign(fp.callsign)
                  else usePanelStore.getState().removeStrip(panelName, stripId)
                } catch (err) {
                  console.error('Refuse handoff failed:', err)
                  usePanelStore.getState().removeStrip(panelName, stripId)
                }
                onClose()
              }}
            >
              <span className="material-icons">cancel</span>
              Refuse
            </div>
          </div>
          <MenuSection label="Strip" icon="dashboard" />
          <MenuItem icon="delete" label="Remove Strip" variant="danger" onClick={handleDelete} />
        </div>
      </div>
    )
  }

  if (euroscope && fp) {
    const showProcedure = type === 'departure' || type === 'arrival'
    const depAirport = type === 'departure' ? fp.departure : fp.arrival
    const procType = type === 'departure' ? 'SID' : 'STAR'
    const currentProc = type === 'departure'
      ? (fp.sid as string | undefined)
      : (fp.star as string | undefined)
    const currentRwy = type === 'departure'
      ? (fp.departureRwy as string | undefined)
      : (fp.arrivalRwy as string | undefined)

    return (
      <div>
        <div className={`menu-header menu-header-${type}`}>
          <div className="menu-header-top">
            <span className="menu-callsign">{fp.callsign}</span>
            <span className={`menu-type-pill menu-type-pill-${type}`}>{type}</span>
          </div>
          <div className="menu-header-route">
            <span>{fp.departure || '???'}</span>
            <span className="material-icons">arrow_forward</span>
            <span>{fp.arrival || '???'}</span>
            {fp.aircraftType && <span className="menu-actype">· {fp.aircraftType}</span>}
          </div>
          {(currentProc || fp.squawk) && (
            <div className="menu-header-chips">
              {currentProc && (
                <span className={`menu-chip menu-chip-${procType.toLowerCase()}`}>
                  {currentProc}{currentRwy ? ` · RWY ${currentRwy}` : ''}
                </span>
              )}
              {fp.squawk && <span className="menu-chip">{fp.squawk as string}</span>}
            </div>
          )}
        </div>
        <div className="menu-scroll-container">
          <MenuSection label="Flight Data" icon="info" />
          <MenuItem
            icon="route"
            label="Show Route"
            sublabel={fp.route ? (fp.route as string).trim().split(/\s+/).slice(0, 4).join(' ') + '\u2026' : undefined}
            onClick={() => setView({ type: 'route' })}
            chevron
          />
          <MenuItem
            icon="info"
            label="Flight Details"
            sublabel={[fp.wtc, fp.planType ? (PLAN_TYPE_LABELS[fp.planType as string] ?? fp.planType as string) : null, fp.alternate ? `ALT ${fp.alternate as string}` : null].filter(Boolean).join(' · ') || undefined}
            onClick={() => setView({ type: 'flightinfo' })}
            chevron
          />
          {showProcedure && (
            <MenuItem
              icon={type === 'departure' ? 'flight_takeoff' : 'flight_land'}
              label={`Change ${procType}`}
              sublabel={currentProc ? `${currentProc}${currentRwy ? ` · RWY ${currentRwy}` : ''}` : 'Not assigned'}
              onClick={() => setView({ type: 'procedure', airport: depAirport, procType })}
              chevron
            />
          )}
          <MenuItem
            icon="swap_vert"
            label="Change Strip Type"
            sublabel={type.charAt(0).toUpperCase() + type.slice(1)}
            onClick={() => setView({ type: 'typemenu' })}
            chevron
          />

          <MenuSection label="ATC" icon="headset_mic" />
          <MenuItem
            icon="compare_arrows"
            label="Transfer"
            onClick={() => setView({ type: 'transfer' })}
            chevron
          />
          <MenuItem
            icon="logout"
            label="Free Aircraft"
            variant="success"
            onClick={async () => {
              try {
                const res = await apiFetch('/api/end-tracking', {
                  method: 'POST',
                  body: JSON.stringify({ code: getLinkCode(), callsign: fp.callsign }),
                })
                if (res.ok) deleteStripByCallsign(fp.callsign)
              } catch (err) {
                console.error('Free aircraft failed:', err)
              }
              onClose()
            }}
          />

          <MenuSection label="Strip" icon="dashboard" />
          <MenuItem icon="delete" label="Remove Strip" variant="danger" onClick={handleDelete} />
        </div>
      </div>
    )
  }

  return (
    <div className="menu-scroll-container">
      <MenuSection label="Strip" icon="dashboard" />
      <MenuItem icon="delete" label="Remove Strip" variant="danger" onClick={handleDelete} />
    </div>
  )
}
