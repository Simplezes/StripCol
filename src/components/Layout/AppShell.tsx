import type { ReactNode } from 'react'
import { useUIStore } from '../../stores/uiStore'

interface AppShellProps {
  header: ReactNode
  board: ReactNode
  inspector: ReactNode
  footer: ReactNode
}

export function AppShell({ header, board, inspector, footer }: AppShellProps) {
  const inspectorOpen = useUIStore((s) => s.inspectorOpen)
  const statusHidden = useUIStore((s) => s.statusHidden)

  return (
    <div className={`app${inspectorOpen ? '' : ' no-insp'}${statusHidden ? ' no-sbar' : ''}`}>
      {header}
      {board}
      {inspector}
      {statusHidden ? null : footer}
    </div>
  )
}
