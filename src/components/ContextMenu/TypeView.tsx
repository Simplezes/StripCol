import { useConnectionStore } from '../../stores/connectionStore'
import { usePanelStore } from '../../stores/panelStore'
import type { FlightPlan, StripType } from '../../types'
import { buildInitialValues } from '../../utils/stripValues'
import { BackButton } from './MenuParts'

export const TYPE_OPTIONS: Array<{ value: StripType; label: string; icon: string; color: string }> = [
  { value: 'departure', label: 'Departure', icon: 'flight_takeoff', color: 'var(--strip-departure)' },
  { value: 'arrival', label: 'Arrival', icon: 'flight_land', color: 'var(--strip-arrival)' },
  { value: 'overfly', label: 'Overfly', icon: 'airplanemode_active', color: 'var(--strip-overfly)' },
]

export function TypeView({
  stripId,
  panelName,
  currentType,
  flight,
  onBack,
  onClose,
}: {
  stripId: string
  panelName: string
  currentType: StripType
  flight: FlightPlan | null
  onBack: () => void
  onClose: () => void
}) {
  const handleSelect = (newType: StripType) => {
    if (newType === currentType) return
    const { controllerMode } = useConnectionStore.getState()
    const values = flight
      ? buildInitialValues(flight, newType, controllerMode)
      : {}
    usePanelStore.getState().updateStrip(panelName, stripId, { type: newType, values })
    onClose()
  }

  return (
    <div className="proc-picker">
      <BackButton onBack={onBack} />
      <div className="proc-context-bar">
        <span className="material-icons">swap_vert</span>
        Change strip type
      </div>
      <div className="type-cards">
        {TYPE_OPTIONS.map((opt) => {
          const isActive = currentType === opt.value
          return (
            <div
              key={opt.value}
              className={`type-card type-card-${opt.value}${isActive ? ' type-card-active' : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              <span className="material-icons type-card-icon">{opt.icon}</span>
              <span className="type-card-label">{opt.label}</span>
              {isActive && <span className="material-icons type-card-check">check_circle</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
