import { BackButton } from './MenuParts'
import type { ProcGroup } from './procedureHelpers'
import { applyProcedure } from './procedureHelpers'

export function TransitionsView({
  group,
  runway,
  procType,
  stripId,
  panelName,
  onBack,
  onClose,
}: {
  group: ProcGroup
  runway: string
  procType: 'SID' | 'STAR'
  stripId: string
  panelName: string
  onBack: () => void
  onClose: () => void
}) {
  return (
    <div className="proc-picker">
      <BackButton onBack={onBack} />
      <div className="proc-context-bar">
        <span className="material-icons">rule</span>
        <span>{group.baseName}</span>
        <span className="proc-context-rwy">RWY {runway}</span>
      </div>
      <div className="proc-picker-list">
        {group.base && (
          <div
            className="proc-trans-item proc-trans-base"
            onClick={() => applyProcedure(stripId, panelName, procType, runway, group.base!, onClose)}
          >
            <div className="proc-trans-name">
              <span className="material-icons proc-trans-dot">radio_button_checked</span>
              {group.base}
            </div>
            <span className="proc-item-tag proc-item-tag-default">Direct</span>
          </div>
        )}
        {[...group.transitions].sort().map((key) => {
          const via = key.slice(key.indexOf('x') + 1)
          return (
            <div
              key={key}
              className="proc-trans-item"
              onClick={() => applyProcedure(stripId, panelName, procType, runway, key, onClose)}
            >
              <div className="proc-trans-name">
                <span className="material-icons proc-trans-dot">radio_button_unchecked</span>
                {group.baseName}
              </div>
              <span className="proc-trans-via">via <strong>{via}</strong></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
