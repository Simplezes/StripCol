import { create } from 'zustand'
import type { Settings } from '../types'
import { saveDesktopSettings } from '../platform/desktop'

const STORAGE_KEY = 'stripcol_settings'

const DEFAULT_SETTINGS: Settings = {
  audioEnabled: true,
  cleanupEnabled: false,
  cleanupMinutes: 15,
  showSeconds: true,
  departureColor: '',
  arrivalColor: '',
  overflyColor: '',
  linkCode: '',
  serverIp: '127.0.0.1',
  discordRpcEnabled: true,
  theme: 'dark',
  darkStrips: false,
  autohideHeader: false,
  autoMoveClearance: false,
  autoMoveRevert: false,
}

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

const LEGACY_COLORS = ['#6ee7b7', '#f87171', '#fde68a', '#7fb0ff', '#f0a367', '#62d08c']

function applyColor(name: string, value: string): void {
  const root = document.documentElement
  if (!value || LEGACY_COLORS.includes(value.toLowerCase())) root.style.removeProperty(name)
  else root.style.setProperty(name, value)
}

function applyThemeToDom(settings: Settings): void {
  applyColor('--user-departure-color', settings.departureColor)
  applyColor('--user-arrival-color', settings.arrivalColor)
  applyColor('--user-overfly-color', settings.overflyColor)

  document.body.classList.toggle('theme-light', settings.theme.includes('light'))
  document.body.classList.toggle('dark-strips', settings.darkStrips)
  document.body.classList.toggle('autohide-bar', settings.autohideHeader)
}

interface SettingsState {
  settings: Settings

  update: (patch: Partial<Settings>) => void

  applyTheme: () => void

  load: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: loadFromStorage(),

  load: () => {
    const settings = loadFromStorage()
    set({ settings })
    applyThemeToDom(settings)
  },

  applyTheme: () => {
    applyThemeToDom(get().settings)
  },

  update: (patch) => {
    set((state) => {
      const settings = { ...state.settings, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))

      saveDesktopSettings({
        serverIp: settings.serverIp,
        discordRpcEnabled: settings.discordRpcEnabled,
      }).catch(() => {})

      applyThemeToDom(settings)
      return { settings }
    })
  },
}))
