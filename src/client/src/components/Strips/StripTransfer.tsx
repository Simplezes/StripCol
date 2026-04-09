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
      className="strip draggable transfer-request"
      data-strip-id={stripId}
      data-type="transfer"
      data-euroscope={strip.euroscope ? 'true' : 'false'}
      data-panel={panelName}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : undefined,
      }}
      {...attributes}
      {...listeners}
    >
      <div className="transfer-info">
        <div className="transfer-label">HANDOFF REQUEST</div>
        <div className="transfer-callsign">{fp.callsign}</div>
        <div className="transfer-details">
          {fp.departure} &rarr; {fp.arrival} | {fp.aircraftType || '---'}
        </div>
      </div>
      <div className="transfer-actions">
        <button
          className="transfer-btn accept"
          title="Accept Handoff"
          onClick={handleAccept}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="material-icons">check_circle</span>
          ACCEPT
        </button>
        <button
          className="transfer-btn refuse"
          title="Refuse Handoff"
          onClick={handleRefuse}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="material-icons">cancel</span>
          REFUSE
        </button>
      </div>
    </div>
  )
}
