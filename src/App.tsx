import { useSSE } from './hooks/useSSE'
import { AppShell } from './components/Layout/AppShell'
import { MainLayout } from './components/Layout/MainLayout'
import { SystemBar } from './components/SystemBar/SystemBar'
import { Inspector } from './components/Inspector/Inspector'
import { StatusBar } from './components/StatusBar/StatusBar'
import { SettingsModal } from './components/Settings/SettingsModal'
import { ContextMenu } from './components/ContextMenu/ContextMenu'
import { StripDndProvider } from './components/Strips/StripDndProvider'

export default function App() {
  useSSE()

  return (
    <StripDndProvider>
      <AppShell
        header={<SystemBar />}
        board={<MainLayout />}
        inspector={<Inspector />}
        footer={<StatusBar />}
      />
      <ContextMenu />
      <SettingsModal />
    </StripDndProvider>
  )
}
