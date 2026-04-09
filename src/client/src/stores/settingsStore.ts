import { create } from 'zustand'
import type { Settings } from '../types'

const STORAGE_KEY = 'stripcol_settings'

// Named preset themes (applied as body classes when theme value is not a .css file)
const THEME_CLASSES = ['theme-dark-modern', 'theme-light']

function clearThemeClasses(): void {
  // Remove previous theme-* classes but keep behavior modifiers.
  document.body.classList.forEach((cls) => {
    if (cls.startsWith('theme-') && cls !== 'theme-dark-strips' && cls !== 'theme-autohide-header') {
      document.body.classList.remove(cls)
    }
  })
}

function applyThemeStylesheet(themeFile: string, existingLink: HTMLLinkElement | null): void {
  const candidates = [`./css/styles/${themeFile}`, `./styles/${themeFile}`]

  const link = existingLink ?? document.createElement('link')
  link.id = 'custom-theme-link'
  link.rel = 'stylesheet'

  let index = 0
  link.onerror = () => {
    index += 1
    if (index < candidates.length) {
      link.href = candidates[index]
    }
  }

  link.href = candidates[index]
  if (!existingLink) document.head.appendChild(link)
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  // ── Custom .css file theme ────────────────────────────────────────────────
  const { theme } = settings
  const existingLink = document.getElementById('custom-theme-link') as HTMLLinkElement | null

  if (theme.endsWith('.css')) {
    applyThemeStylesheet(theme, existingLink)
    // Apply named class based on filename (e.g. dark-modern.css → theme-dark-modern)
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

  // ── Strip / header modifier classes ──────────────────────────────────────
  document.body.classList.toggle('theme-dark-strips', settings.darkStrips)
  document.body.classList.toggle('theme-autohide-header', settings.autohideHeader)
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface SettingsState {
  settings: Settings

  /** Update one or more keys and persist */
  update: (patch: Partial<Settings>) => void

  /** Apply current settings to the DOM (theme classes + CSS vars) */
  applyTheme: () => void

  /** Load from localStorage and apply to DOM */
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

      if (window.electronAPI?.saveSettings) {
        window.electronAPI.saveSettings({
          serverIp: settings.serverIp,
          discordRpcEnabled: settings.discordRpcEnabled,
        })
      }

      applyThemeToDom(settings)
      return { settings }
    })
  },
}))
