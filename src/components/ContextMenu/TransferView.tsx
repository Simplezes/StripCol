import { useEffect, useState } from 'react'
import type { FlightPlan } from '../../types'
import { apiFetch } from '../../utils/api'
import { deleteStripByCallsign } from '../../utils/stripActions'
import { StationSkeleton } from '../ui/Skeleton'
import { isAtcPosition, roleOf } from '../StatusBar/RoleIcon'
import { Group, Item, Sep } from './MenuParts'
import { getLinkCode } from './menuHelpers'

export interface ATCEntry {
  callsign: string
  frequency: string
  label: string
  role: string
}

const ROLE_ORDER = ['Centre', 'Approach', 'Tower', 'Ground', 'Delivery']

export function TransferView({ flight, onClose }: { flight: FlightPlan; onClose: () => void }) {
  const [stations, setStations] = useState<ATCEntry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiFetch(`/api/ATC-list?code=${getLinkCode()}`)
      .then((r) => r.json())
      .then((data: Array<{ callsign: string; frequency: string }>) => {
        if (!Array.isArray(data)) throw new Error('no session')
        const cleaned = data
          .filter((atc) => atc.frequency && atc.frequency !== 'N/A' && isAtcPosition(atc.callsign))
          .map((atc) => ({
            callsign: atc.callsign,
            label: atc.callsign.split('_').join(' '),
            role: roleOf(atc.callsign),
            frequency: !isNaN(Number(atc.frequency)) ? parseFloat(atc.frequency).toFixed(3) : atc.frequency,
          }))
        setStations(cleaned)
      })
      .catch(() => setError(true))
  }, [])

  const handleTransfer = async (targetCallsign: string) => {
    try {
      await apiFetch('/api/ATC-transfer', {
        method: 'POST',
        body: JSON.stringify({ code: getLinkCode(), callsign: flight.callsign, targetATC: targetCallsign }),
      })
    } catch (err) {
      console.error('ATC transfer failed:', err)
    }
    onClose()
  }

  const handleUnicom = async () => {
    try {
      const res = await apiFetch('/api/end-tracking', {
        method: 'POST',
        body: JSON.stringify({ code: getLinkCode(), callsign: flight.callsign }),
      })
      if (res.ok) deleteStripByCallsign(flight.callsign)
    } catch (err) {
      console.error('End tracking failed:', err)
    }
    onClose()
  }

  return (
    <div className="cm" role="menu">
      {error && <Group label="No EuroScope link, pair a link code first" />}
      {!stations && !error && (
        <div aria-busy="true" aria-label="Loading stations">
          <StationSkeleton />
          <StationSkeleton />
          <StationSkeleton />
        </div>
      )}
      {stations &&
        ROLE_ORDER.map((role) => {
          const group = stations.filter((s) => s.role === role)
          if (group.length === 0) return null
          return (
            <div key={role}>
              <Group label={role} />
              {group.map((s) => (
                <Item key={s.callsign} role={role} label={s.label} frequency={s.frequency} onClick={() => handleTransfer(s.callsign)} />
              ))}
            </div>
          )
        })}
      <Sep />
      <Item icon="radio" label="UNICOM" frequency="122.800" onClick={handleUnicom} />
    </div>
  )
}
