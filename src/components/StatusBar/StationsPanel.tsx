import { useEffect, useState } from 'react'
import { apiFetch } from '../../utils/api'
import { deleteStripByCallsign } from '../../utils/stripActions'
import { useSettingsStore } from '../../stores/settingsStore'
import { useSelectedStrip } from '../Inspector/useSelectedStrip'
import { StationSkeleton } from '../ui/Skeleton'
import { RoleIcon, isAtcPosition, roleOf } from './RoleIcon'

interface Station {
  callsign: string
  label: string
  role: string
  frequency: string
}

const ROLE_ORDER = ['Centre', 'Approach', 'Tower', 'Ground', 'Delivery']

const UNICOM: Station = { callsign: 'UNICOM', label: 'UNICOM', role: 'Information', frequency: '122.800' }

function linkCode(): string {
  return useSettingsStore.getState().settings.linkCode
}

export function StationsPanel({ onDone }: { onDone: () => void }) {
  const selected = useSelectedStrip()
  const [stations, setStations] = useState<Station[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    apiFetch(`/api/ATC-list?code=${linkCode()}`)
      .then((r) => r.json())
      .then((data: Array<{ callsign: string; frequency: string }>) => {
        if (!Array.isArray(data)) throw new Error('no session')
        const list = data
          .filter((atc) => atc.frequency && atc.frequency !== 'N/A' && isAtcPosition(atc.callsign))
          .map((atc) => ({
            callsign: atc.callsign,
            label: atc.callsign.split('_').join(' '),
            role: roleOf(atc.callsign),
            frequency: !isNaN(Number(atc.frequency)) ? parseFloat(atc.frequency).toFixed(3) : atc.frequency,
          }))
          .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
        setStations([...list, UNICOM])
      })
      .catch(() => setFailed(true))
  }, [])

  const flight = selected?.strip.flightPlan ?? null
  const target = stations?.find((s) => s.callsign === picked) ?? null

  const transfer = async () => {
    if (!flight || !target) return
    try {
      if (target.callsign === 'UNICOM') {
        const res = await apiFetch('/api/end-tracking', {
          method: 'POST',
          body: JSON.stringify({ code: linkCode(), callsign: flight.callsign }),
        })
        if (res.ok) deleteStripByCallsign(flight.callsign)
      } else {
        await apiFetch('/api/ATC-transfer', {
          method: 'POST',
          body: JSON.stringify({ code: linkCode(), callsign: flight.callsign, targetATC: target.callsign }),
        })
      }
    } catch (err) {
      console.error('Transfer failed:', err)
    }
    onDone()
  }

  return (
    <div className="pop" role="dialog" aria-label="Transfer aircraft">
      <div className="rph">
        <h2>Transfer aircraft</h2>
        {stations && <span className="rpc">{stations.length - 1} online</span>}
      </div>
      <p className="rsub">Hand an aircraft to another controller.</p>

      {flight ? (
        <div className="xcard">
          <div>
            <em>Selected aircraft</em>
            <b>{flight.callsign}</b>
            <span>
              {flight.aircraftType || '---'} · {flight.departure || '----'} → {flight.arrival || '----'}
            </span>
          </div>
        </div>
      ) : (
        <p className="pnote">Select a strip on the board first.</p>
      )}

      <div className="rlab">Choose who takes it</div>
      {failed && <p className="pnote">Could not load the station list.</p>}
      {!stations && !failed && (
        <div className="ladder" aria-busy="true" aria-label="Loading stations">
          <StationSkeleton />
          <StationSkeleton />
          <StationSkeleton />
        </div>
      )}
      {stations && (
        <div className="ladder" role="listbox" aria-label="Online stations">
          {stations.map((s) => (
            <button
              key={s.callsign}
              className={`stn2${picked === s.callsign ? ' on' : ''}`}
              role="option"
              aria-selected={picked === s.callsign}
              onClick={() => setPicked(s.callsign)}
            >
              <span className="ic">
                <RoleIcon role={s.role} className="ro" />
              </span>
              <span className="nm">
                <b>{s.label}</b>
                <small>{s.role}</small>
              </span>
              <i>{s.frequency}</i>
            </button>
          ))}
        </div>
      )}

      <div className="cta">
        <button className={`go2${flight && target ? '' : ' dis'}`} disabled={!flight || !target} onClick={transfer}>
          {target ? `Transfer to ${target.label}` : 'Select a station'}
        </button>
        <small>{flight && target ? `${flight.callsign} will appear in their Handover.` : 'Tap a station above.'}</small>
      </div>
    </div>
  )
}
