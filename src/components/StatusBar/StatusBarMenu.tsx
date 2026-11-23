import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore, type StatusItemKey } from '../../stores/uiStore'
import { Icon } from '../ContextMenu/Icon'
import { Group, Sep } from '../ContextMenu/MenuParts'
import { positionSafely } from '../ContextMenu/menuHelpers'

const TOOLS: Array<{ key: StatusItemKey; label: string }> = [
  { key: 'stations', label: 'Stations' },
  { key: 'nearby', label: 'Nearby' },
  { key: 'add', label: 'Add strip' },
  { key: 'filters', label: 'Filters' },
]

const READOUTS: Array<{ key: StatusItemKey; label: string }> = [
  { key: 'position', label: 'Position' },
  { key: 'link', label: 'Link code' },
  { key: 'version', label: 'Version' },
]

interface StatusBarMenuProps {
  x: number
  y: number
  onClose: () => void
}

export function StatusBarMenu({ x, y, onClose }: StatusBarMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const items = useUIStore((s) => s.statusItems)
  const toggle = useUIStore((s) => s.toggleStatusItem)
  const setHidden = useUIStore((s) => s.setStatusHidden)

  useEffect(() => {
    if (ref.current) positionSafely(ref.current, x, y)
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const row = (key: StatusItemKey, label: string) => (
    <div className="mi" role="menuitemcheckbox" aria-checked={items[key]} key={key} onClick={() => toggle(key)}>
      <Icon name="check" className={items[key] ? '' : 'off'} />
      <span className="l">{label}</span>
    </div>
  )

  return createPortal(
    <div ref={ref} className="cm-stack" style={{ left: x, top: y, visibility: 'hidden' }} onContextMenu={(e) => e.preventDefault()}>
      <div className="cm w300" role="menu">
        <Group label="Tools" />
        {TOOLS.map((t) => row(t.key, t.label))}
        <Sep />
        <Group label="Readouts" />
        {READOUTS.map((r) => row(r.key, r.label))}
        <Sep />
        <div
          className="mi"
          role="menuitem"
          onClick={() => {
            setHidden(true)
            onClose()
          }}
        >
          <Icon name="x" />
          <span className="l">Hide status bar</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
