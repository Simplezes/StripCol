import { useEffect, useRef, useState } from 'react'

export interface DropdownOption {
  value: string
  label: string
  icon?: string
}

interface DropdownProps {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
}

export function Dropdown({ value, options, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = options.find((o) => o.value === value)

  return (
    <div className={`custom-dropdown${open ? ' active' : ''}`} ref={ref} style={{ position: 'relative' }}>
      <button
        className="custom-dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <div className="dropdown-trigger-content">
          {current?.icon && <span className="material-icons">{current.icon}</span>}
          <span>{current?.label ?? value}</span>
        </div>
        <span className="material-icons arrow">unfold_more</span>
      </button>
      {open && (
        <div className="custom-dropdown-menu" style={{ display: 'block' }}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`custom-dropdown-item${value === opt.value ? ' active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              <div className="item-content">
                {opt.icon && <span className="material-icons">{opt.icon}</span>}
                <span>{opt.label}</span>
              </div>
              {value === opt.value && <span className="material-icons check">check</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
