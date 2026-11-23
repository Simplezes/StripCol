import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePanelStore } from '../../stores/panelStore'
import { useFlightStore } from '../../stores/flightStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { apiFetch } from '../../utils/api'
import { deleteStripByCallsign, renderAircraftAsStrip } from '../../utils/stripActions'

interface StripTransferProps {
  stripId: string
  panelName: string
}

export function StripTransfer({ stripId, panelName }: StripTransferProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stripId })

  const strip = usePanelStore((s) =>
    s.panels.find((p) => p.name === panelName)?.strips.find((st) => st.id === stripId),
  )

  if (!strip?.flightPlan) return null

  const { flightPlan: fp } = strip

  const getLinkCode = () => useSettingsStore.getState().settings.linkCode

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await apiFetch('/api/accept-handoff', {
        method: 'POST',
        body: JSON.stringify({ code: getLinkCode(), callsign: fp.callsign }),
      })
      if (res.ok) {
        deleteStripByCallsign(fp.callsign)
        useFlightStore.getState().removeAircraft(fp.callsign)
        const accepted = { ...fp, transfer: false }
        useFlightStore.getState().addAircraft(fp.callsign, accepted)
        renderAircraftAsStrip(accepted)
      } else {
        usePanelStore.getState().removeStrip(panelName, stripId)
      }
    } catch (err) {
      console.error('Accept handoff failed:', err)
    }
  }

  const handleRefuse = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await apiFetch('/api/refuse-handoff', {
        method: 'POST',
        body: JSON.stringify({ code: getLinkCode(), callsign: fp.callsign }),
      })
      if (res.ok) {
        deleteStripByCallsign(fp.callsign)
        useFlightStore.getState().removeAircraft(fp.callsign)
      } else {
        usePanelStore.getState().removeStrip(panelName, stripId)
      }
    } catch (err) {
      console.error('Refuse handoff failed:', err)
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`srow${isDragging ? ' drag-src' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      <div
        className="strip incoming"
        data-strip-id={stripId}
        data-type="transfer"
        data-euroscope={strip.euroscope ? 'true' : 'false'}
        data-panel={panelName}
      >
        <span className="tag">Handover</span>
        <h3>{fp.callsign}</h3>
        <span>
          {fp.departure} → {fp.arrival} · {fp.aircraftType || '---'}
        </span>
      </div>
      <div className="sact">
        <button
          className="ok"
          title="Accept handoff"
          onClick={handleAccept}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12l5 5 9-10" />
          </svg>
          Accept
        </button>
        <button
          className="no"
          title="Refuse handoff"
          onClick={handleRefuse}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          Refuse
        </button>
      </div>
    </div>
  )
}
