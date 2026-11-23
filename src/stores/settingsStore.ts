import { create } from 'zustand'
import type { Settings } from '../types'
import { saveDesktopSettings } from '../platform/desktop'
import { getThemeUrl } from '../utils/themes'

const STORAGE_KEY = 'stripcol_settings'

const THEME_CLASSES = ['theme-dark-modern', 'theme-light']

function clearThemeClasses(): void {

  document.body.classList.forEach((cls) => {
    if (cls.startsWith('theme-') && cls !== 'theme-dark-strips' && cls !== 'theme-autohide-header') {
      document.body.classList.remove(cls)
    }
  })
}

function applyThemeStylesheet(themeFile: string, existingLink: HTMLLinkElement | null): void {
  const url = getThemeUrl(themeFile)
  if (!url) return

  const link = existingLink ?? document.createElement('link')
  link.id = 'custom-theme-link'
  link.rel = 'stylesheet'
  link.href = url
  if (!existingLink) document.head.appendChild(link)
}

const DEFAULT_SETTINGS: Settings = {
  audioEnabled: true,
  cleanupEnabled: false,
  cleanupMinutes: 15,
  showSeconds: true,
  departureColor: '#6ee7b7',
  arrivalColor: '#f87171',
  overflyColor: '#fde68a',
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

function applyThemeToDom(settings: Settings): void {
  const root = document.documentElement

  root.style.setProperty('--custom-departure-color', settings.departureColor)
  root.style.setProperty('--custom-arrival-color', settings.arrivalColor)
  root.style.setProperty('--custom-overfly-color', settings.overflyColor)

  const { theme } = settings
  const existingLink = document.getElementById('custom-theme-link') as HTMLLinkElement | null

  if (theme.endsWith('.css')) {
    applyThemeStylesheet(theme, existingLink)

    clearThemeClasses()
    const nameClass = `theme-${theme.replace('.css', '')}`
    document.body.classList.add(nameClass)
  } else {
    existingLink?.remove()
    clearThemeClasses()
    if (theme !== 'dark') {
      document.body.classList.add(`theme-${theme}`)
    }
  }

  document.body.classList.toggle('theme-dark-strips', settings.darkStrips)
  document.body.classList.toggle('theme-autohide-header', settings.autohideHeader)
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
