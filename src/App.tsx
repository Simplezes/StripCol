import { useSSE } from './hooks/useSSE'
import { useStripCleanup } from './hooks/useStripCleanup'
import { AppShell } from './components/Layout/AppShell'
import { MainLayout } from './components/Layout/MainLayout'
import { SystemBar } from './components/SystemBar/SystemBar'
import { Inspector } from './components/Inspector/Inspector'
import { StatusBar } from './components/StatusBar/StatusBar'
import { SettingsModal } from './components/Settings/SettingsModal'
import { ContextMenu } from './components/ContextMenu/ContextMenu'
import { CellHintLayer } from './components/Strips/CellHintLayer'
import { CellPickerLayer } from './components/Strips/pickers/CellPickerLayer'
import { Splash } from './components/Splash/Splash'
import { StripDndProvider } from './components/Strips/StripDndProvider'

export default function App() {
  useSSE()
  useStripCleanup()

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
      <CellHintLayer />
      <CellPickerLayer />
      <Splash />
    </StripDndProvider>
  )
}
