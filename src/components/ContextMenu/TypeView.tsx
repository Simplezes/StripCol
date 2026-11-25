import { usePanelStore } from '../../stores/panelStore'
import type { FlightPlan, StripType } from '../../types'
import { freshStripValues } from '../../utils/stripActions'
import { Item } from './MenuParts'

export const TYPE_OPTIONS: Array<{ value: StripType; label: string; swatch: string }> = [
  { value: 'departure', label: 'Departure', swatch: 'dep' },
  { value: 'arrival', label: 'Arrival', swatch: 'arr' },
  { value: 'overfly', label: 'Overfly', swatch: 'ovf' },
]

interface TypeViewProps {
  stripId: string
  panelName: string
  currentType: StripType
  flight: FlightPlan | null
  onClose: () => void
}

export function TypeView({ stripId, panelName, currentType, flight, onClose }: TypeViewProps) {
  const handleSelect = (newType: StripType) => {
    if (newType === currentType) return
    const fill = flight ? freshStripValues(flight, newType) : { values: {}, autoCells: [] }
    usePanelStore.getState().updateStrip(panelName, stripId, { type: newType, ...fill })
    onClose()
  }

  return (
    <div className="cm" role="menu">
      {TYPE_OPTIONS.map((opt) => (
        <Item
          key={opt.value}
          label={opt.label}
          swatch={opt.swatch}
          current={currentType === opt.value}
          onClick={() => handleSelect(opt.value)}
        />
      ))}
    </div>
  )
}
