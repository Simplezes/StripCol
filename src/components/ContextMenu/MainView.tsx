import { usePanelStore } from '../../stores/panelStore'
import { apiFetch } from '../../utils/api'
import { deleteStripByCallsign, renderAircraftAsStrip } from '../../utils/stripActions'
import { PLAN_TYPE_LABELS } from './FlightInfoView'
import { Icon } from './Icon'
import { Item, MenuHeader, Sep } from './MenuParts'
import { getLinkCode, type MenuView } from './menuHelpers'

interface MainViewProps {
  stripId: string
  panelName: string
  view: MenuView
  setView: (v: MenuView) => void
  onClose: () => void
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function MainView({ stripId, panelName, view, setView, onClose }: MainViewProps) {
  const strip = usePanelStore.getState().getStrip(stripId)
  if (!strip) return null

  const { euroscope, flightPlan: fp, type } = strip
  const isTransfer = euroscope && fp?.transfer
  const open = (next: MenuView) => setView(view.type === next.type ? { type: 'none' } : next)

  const handleDelete = () => {
    if (!euroscope || !fp) usePanelStore.getState().removeStrip(panelName, stripId)
    else deleteStripByCallsign(fp.callsign)
    onClose()
  }

  const removeItem = <Item icon="trash" label="Remove strip" tone="no" onClick={handleDelete} />

  if (isTransfer && fp) {
    const accept = async () => {
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
    }

    const refuse = async () => {
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
    }

    return (
      <div className="cm" role="menu" data-type="arrival">
        <MenuHeader flight={fp} pill="Handoff" pillClass="hand" />
        <div className="btns">
          <button className="btn ok" onClick={accept}>
            <Icon name="check" />
            Accept
          </button>
          <button className="btn no" onClick={refuse}>
            <Icon name="x" />
            Refuse
          </button>
        </div>
        <Sep />
        {removeItem}
      </div>
    )
  }

  if (!euroscope || !fp) {
    return (
      <div className="cm" role="menu">
        {removeItem}
      </div>
    )
  }

  const showProcedure = type === 'departure' || type === 'arrival'
  const airport = type === 'departure' ? fp.departure : fp.arrival
  const procType = type === 'departure' ? 'SID' : 'STAR'
  const currentProc = type === 'departure' ? (fp.sid as string | undefined) : (fp.star as string | undefined)
  const currentRwy = type === 'departure' ? (fp.departureRwy as string | undefined) : (fp.arrivalRwy as string | undefined)
  const procValue = currentProc ? `${currentProc}${currentRwy ? ` · ${currentRwy}` : ''}` : 'Not assigned'

  const chips = [
    currentProc ? `${currentProc}${currentRwy ? ` · RWY ${currentRwy}` : ''}` : '',
    fp.squawk ? String(fp.squawk) : '',
  ].filter(Boolean)

  const routeValue = fp.route ? `${(fp.route as string).trim().split(/\s+/).slice(0, 3).join(' ')}…` : undefined
  const detailsValue =
    [fp.wtc, fp.planType ? (PLAN_TYPE_LABELS[fp.planType as string] ?? (fp.planType as string)) : null, fp.alternate ? `ALT ${fp.alternate as string}` : null]
      .filter(Boolean)
      .join(' · ') || undefined

  const freeAircraft = async () => {
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
  }

  return (
    <div className="cm" role="menu" data-type={type}>
      <MenuHeader flight={fp} pill={type} chips={chips} />
      <Item icon="route" label="Show route" value={routeValue} chevron hot={view.type === 'route'} onClick={() => open({ type: 'route' })} />
      <Item icon="info" label="Flight details" value={detailsValue} chevron hot={view.type === 'flightinfo'} onClick={() => open({ type: 'flightinfo' })} />
      {showProcedure && (
        <Item
          icon="plane"
          label={`Change ${procType}`}
          value={procValue}
          chevron
          hot={view.type === 'procedure'}
          onClick={() => open({ type: 'procedure', airport, procType })}
        />
      )}
      <Item icon="swap" label="Change strip type" value={capitalise(type)} chevron hot={view.type === 'typemenu'} onClick={() => open({ type: 'typemenu' })} />
      <Sep />
      <Item icon="xfer" label="Transfer" chevron hot={view.type === 'transfer'} onClick={() => open({ type: 'transfer' })} />
      <Item icon="free" label="Free aircraft" tone="ok" onClick={freeAircraft} />
      <Sep />
      {removeItem}
    </div>
  )
}
