import type { FlightPlan } from '../../types'
import { apiFetch } from '../../utils/api'
import { deleteStripByCallsign } from '../../utils/stripActions'
import { useEffect, useState } from 'react'
import { BackButton, MenuSection } from './MenuParts'
import { getLinkCode } from './menuHelpers'

export interface ATCEntry {
  callsign: string
  frequency: string
  expandedCallsign: string
}

export const SUFFIX_ORDER = ['_CTR', '_APP', '_TWR', '_GND', '_DEL']
export const SUFFIX_LABELS: Record<string, { label: string; icon: string }> = {
  _CTR: { label: 'Center', icon: 'public' },
  _APP: { label: 'Approach', icon: 'flight_land' },
  _TWR: { label: 'Tower', icon: 'flight_takeoff' },
  _GND: { label: 'Ground', icon: 'directions_car' },
  _DEL: { label: 'Delivery', icon: 'call' },
}

export function TransferView({
  flight,
  onBack,
  onClose,
}: {
  flight: FlightPlan
  onBack: () => void
  onClose: () => void
}) {
  const [atcList, setAtcList] = useState<ATCEntry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiFetch(`/api/ATC-list?code=${getLinkCode()}`)
      .then((r) => r.json())
      .then((data: ATCEntry[]) => {
        const cleaned = data
          .filter((atc) => atc.frequency && atc.frequency !== 'N/A')
          .map((atc) => ({
            ...atc,
            frequency: !isNaN(Number(atc.frequency))
              ? parseFloat(atc.frequency).toFixed(3)
              : atc.frequency,
            expandedCallsign: atc.callsign.split('_').join(' '),
          }))
          .sort((a, b) => {
            const ai = SUFFIX_ORDER.findIndex((s) => a.callsign.endsWith(s))
            const bi = SUFFIX_ORDER.findIndex((s) => b.callsign.endsWith(s))
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
          })
        setAtcList(cleaned)
      })
      .catch(() => setError(true))
  }, [])

  const handleTransfer = async (targetCallsign: string) => {
    try {
      await apiFetch('/api/ATC-transfer', {
        method: 'POST',
        body: JSON.stringify({
          code: getLinkCode(),
          callsign: flight.callsign,
          targetATC: targetCallsign,
        }),
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
    <div>
      <div className="proc-context-bar">
        <span className="material-icons">compare_arrows</span>
        Transfer — {flight.callsign}
      </div>
      <BackButton onBack={onBack} />
      <div className="menu-scroll-container transfer-list">
        {error && (
          <div className="transfer-status transfer-error">
            <span className="material-icons">error_outline</span>
            Failed to load ATC stations
          </div>
        )}
        {!atcList && !error && (
          <div className="transfer-status">Loading…</div>
        )}
        {atcList && (
          <>
            {SUFFIX_ORDER.map((suffix) => {
              const group = atcList.filter((a) => a.callsign.endsWith(suffix))
              if (!group.length) return null
              const { label, icon } = SUFFIX_LABELS[suffix]
              return (
                <div key={suffix}>
                  <MenuSection label={label} />
                  {group.map((atc) => (
                    <div
                      key={atc.callsign}
                      className="atc-btn"
                      onClick={() => handleTransfer(atc.callsign)}
                    >
                      <span className="material-icons atc-icon">{icon}</span>
                      <span className="atc-callsign">{atc.expandedCallsign}</span>
                      <span className="atc-frequency">{atc.frequency}</span>
                    </div>
                  ))}
                </div>
              )
            })}
            <MenuSection label="UNICOM" />
            <div className="atc-btn" onClick={handleUnicom}>
              <span className="material-icons atc-icon">radio</span>
              <span className="atc-callsign">UNICOM</span>
              <span className="atc-frequency">122.800</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
