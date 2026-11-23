import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useContextMenuStore } from '../../stores/contextMenuStore'
import { usePanelStore } from '../../stores/panelStore'
import { FlightInfoView } from './FlightInfoView'
import { MainView } from './MainView'
import { ProcedurePicker } from './ProcedurePicker'
import { RouteView } from './RouteView'
import { TransferView } from './TransferView'
import { TypeView } from './TypeView'
import { positionSafely, type MenuView } from './menuHelpers'

export function ContextMenu() {
  const { visible, x, y, stripId, panelName, hide } = useContextMenuStore()
  const stackRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<MenuView>({ type: 'none' })

  useEffect(() => {
    if (visible) setView({ type: 'none' })
  }, [visible, stripId])

  useEffect(() => {
    if (visible && stackRef.current) positionSafely(stackRef.current, x, y)
  }, [visible, x, y, view])

  useEffect(() => {
    if (!visible) return
    const onDown = (e: MouseEvent) => {
      if (!stackRef.current?.contains(e.target as Node)) hide()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [visible, hide])

  if (!visible || !stripId || !panelName) return null

  const strip = usePanelStore.getState().getStrip(stripId)
  if (!strip) return null

  const flight = strip.flightPlan

  const renderFlyout = () => {
    switch (view.type) {
      case 'route':
        return flight ? <RouteView flight={flight} type={strip.type} /> : null
      case 'flightinfo':
        return flight ? <FlightInfoView flight={flight} type={strip.type} /> : null
      case 'typemenu':
        return <TypeView stripId={stripId} panelName={panelName} currentType={strip.type} flight={flight} onClose={hide} />
      case 'transfer':
        return flight ? <TransferView flight={flight} onClose={hide} /> : null
      case 'procedure':
        return (
          <ProcedurePicker
            airport={view.airport}
            procType={view.procType}
            stripId={stripId}
            panelName={panelName}
            onClose={hide}
          />
        )
      default:
        return null
    }
  }

  return createPortal(
    <div
      ref={stackRef}
      className="cm-stack"
      style={{ left: x, top: y, visibility: 'hidden' }}
      onWheel={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MainView stripId={stripId} panelName={panelName} view={view} setView={setView} onClose={hide} />
      {renderFlyout()}
    </div>,
    document.body,
  )
}
