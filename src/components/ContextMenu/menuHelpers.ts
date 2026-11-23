import { useSettingsStore } from '../../stores/settingsStore'

export function getLinkCode() {
  return useSettingsStore.getState().settings.linkCode
}

export function positionSafely(el: HTMLElement, x: number, y: number) {
  requestAnimationFrame(() => {
    const { innerWidth, innerHeight } = window
    const rect = el.getBoundingClientRect()
    let left = x
    let top = y
    if (x + rect.width > innerWidth) left = innerWidth - rect.width - 8
    if (y + rect.height > innerHeight) top = innerHeight - rect.height - 8
    el.style.left = `${Math.max(8, left)}px`
    el.style.top = `${Math.max(8, top)}px`
    el.style.visibility = 'visible'
  })
}
