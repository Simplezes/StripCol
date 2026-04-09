import type { ReactNode } from 'react'

interface AppShellProps {
  header: ReactNode
  content: ReactNode
}

export function AppShell({ header, content }: AppShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--sys-bg-0)' }}>
      {header}
      {content}
    </div>
  )
}
