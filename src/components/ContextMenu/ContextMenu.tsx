import { useContextMenuStore } from '../../stores/contextMenuStore'
import { usePanelStore } from '../../stores/panelStore'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FlightInfoView } from './FlightInfoView'
import { MainView } from './MainView'
import { ProcedurePicker } from './ProcedurePicker'
import { RouteView } from './RouteView'
import { TransferView } from './TransferView'
import { TypeView } from './TypeView'
import { positionSafely } from './menuHelpers'
import type { MenuView } from './menuTypes'

export function ContextMenu() {
  const { visible, x, y, stripId, panelName, hide } = useContextMenuStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<MenuView>({ type: 'main' })

  useEffect(() => {
    if (visible) setView({ type: 'main' })
  }, [visible, stripId])

  useEffect(() => {
    if (visible && menuRef.current) {
      positionSafely(menuRef.current, x, y)
    }
  }, [visible, x, y, view])

  useEffect(() => {
    if (!visible) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) hide()
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [visible, hide])

  if (!visible || !stripId || !panelName) return null

  const strip = usePanelStore.getState().getStrip(stripId)
  if (!strip) return null

  const renderView = () => {
    switch (view.type) {
      case 'route':
        return strip.flightPlan ? (
          <RouteView flight={strip.flightPlan} onBack={() => setView({ type: 'main' })} />
        ) : null

      case 'flightinfo':
        return strip.flightPlan ? (
          <FlightInfoView flight={strip.flightPlan} onBack={() => setView({ type: 'main' })} />
        ) : null

      case 'typemenu':
        return (
          <TypeView
            stripId={stripId}
            panelName={panelName}
            currentType={strip.type}
            flight={strip.flightPlan}
            onBack={() => setView({ type: 'main' })}
            onClose={hide}
          />
        )

      case 'transfer':
        return strip.flightPlan ? (
          <TransferView
            flight={strip.flightPlan}
            onBack={() => setView({ type: 'main' })}
            onClose={hide}
          />
        ) : null

      case 'procedure':
        return (
          <ProcedurePicker
            airport={view.airport}
            procType={view.procType}
            stripId={stripId}
            panelName={panelName}
            onBack={() => setView({ type: 'main' })}
            onClose={hide}
          />
        )

      default:
        return (
          <MainView
            stripId={stripId}
            panelName={panelName}
            setView={setView}
            onClose={hide}
          />
        )
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      className="strip-context-menu"
      style={{ position: 'fixed', left: x, top: y, visibility: 'hidden' }}
      onWheel={(e) => e.stopPropagation()}
    >
      {renderView()}
    </div>,
    document.body,
  )
}
