export function MenuItem({
  icon,
  label,
  sublabel,
  onClick,
  variant = 'default',
  chevron = false,
}: {
  icon: string
  label: string
  sublabel?: string
  onClick: () => void
  variant?: 'default' | 'success' | 'danger'
  chevron?: boolean
}) {
  return (
    <div className={`menu-item menu-item-${variant}`} onClick={onClick}>
      <span className="material-icons menu-item-icon">{icon}</span>
      <span className="menu-item-content">
        <span className="menu-item-label">{label}</span>
        {sublabel && <span className="menu-item-sublabel">{sublabel}</span>}
      </span>
      {chevron && <span className="material-icons menu-item-arrow">chevron_right</span>}
    </div>
  )
}

export function MenuSection({ label, icon }: { label: string; icon?: string }) {
  return (
    <div className="menu-section">
      {icon && <span className="material-icons">{icon}</span>}
      {label}
    </div>
  )
}

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <div className="menu-back-btn" onClick={onBack}>
      <span className="material-icons">arrow_back</span>
      Back
    </div>
  )
}
