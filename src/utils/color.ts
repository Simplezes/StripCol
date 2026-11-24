export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Hsv {
  h: number
  s: number
  v: number
}

const HEX_PATTERN = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i

export function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value) || 0))
}

export function parseHex(input: string): Rgb | null {
  const match = HEX_PATTERN.exec(input.trim())
  if (!match) return null
  const digits = match[1].length === 3 ? match[1].replace(/./g, '$&$&') : match[1]
  const n = parseInt(digits, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (c: number) => clampChannel(c).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const delta = max - Math.min(rn, gn, bn)
  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6
    return clampChannel((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
  }
  return { r: channel(5), g: channel(3), b: channel(1) }
}
