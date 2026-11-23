import { useEffect, useState } from 'react'
import { apiFetch } from '../../utils/api'
import { useFlightStore } from '../../stores/flightStore'
import { usePanelStore } from '../../stores/panelStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { StationSkeleton } from '../ui/Skeleton'
import { useSelectedStrip } from '../Inspector/useSelectedStrip'

function linkCode(): string {
  return useSettingsStore.getState().settings.linkCode
}

export function NearbyPanel({ onDone }: { onDone: () => void }) {
  const callsigns = useFlightStore((s) => s.nearbyCallsigns)
  const firstPanel = usePanelStore((s) => s.panels[0]?.name ?? '')
  const selected = useSelectedStrip()
  const [search, setSearch] = useState('')
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    useFlightStore.getState().setNearbyCallsigns([])
    apiFetch('/api/get-nearby-aircraft', {
      method: 'POST',
      body: JSON.stringify({ code: linkCode() }),
    }).catch(console.error)
    setRequested(true)
  }, [])

  const filtered = callsigns
    .filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.localeCompare(b))

  const assume = async (callsign: string) => {
    const panel = selected?.panelName ?? firstPanel
    try {
      const res = await apiFetch('/api/assume-aircraft', {
        method: 'POST',
        body: JSON.stringify({ code: linkCode(), callsign, panel }),
      })
      if (res.ok) onDone()
    } catch (err) {
      console.error('Assume aircraft failed:', err)
    }
  }

  return (
    <div className="pop" role="dialog" aria-label="Nearby aircraft">
      <div className="rph">
        <h2>Nearby aircraft</h2>
        {callsigns.length > 0 && <span className="rpc">{callsigns.length} found</span>}
      </div>
      <p className="rsub">Aircraft in your area that are not on your board yet.</p>
      <label className="rsearch">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          type="text"
          placeholder="Search callsign"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </label>
      {requested && callsigns.length === 0 && (
        <div className="ladder" aria-busy="true" aria-label="Searching for nearby aircraft">
          <StationSkeleton />
          <StationSkeleton />
        </div>
      )}
      {callsigns.length > 0 && filtered.length === 0 && <p className="pnote">No matches.</p>}
      {filtered.map((callsign) => (
        <div key={callsign} className="ncard">
          <div className="nt">
            <b>{callsign}</b>
            <button className="as" onClick={() => assume(callsign)}>
              Assume
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
