import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { clampChannel, hsvToRgb, parseHex, rgbToHex, rgbToHsv } from '../../utils/color'
import type { Hsv, Rgb } from '../../utils/color'
import { pickScreenColor } from '../../platform/desktop'

interface Props {
  value: string
  label: string
  onChange: (hex: string) => void
}

const CHANNELS: Array<{ key: keyof Rgb; label: string }> = [
  { key: 'r', label: 'R' },
  { key: 'g', label: 'G' },
  { key: 'b', label: 'B' },
]

function pointerRatio(e: PointerEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  }
}

function dragHandlers(onMove: (e: PointerEvent<HTMLElement>) => void) {
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      onMove(e)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) onMove(e)
    },
  }
}

export function ColorPicker({ value, label, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(parseHex(value) ?? { r: 0, g: 0, b: 0 }))
  const [hexDraft, setHexDraft] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null)

  const rgb = hsvToRgb(hsv)
  const hex = rgbToHex(rgb)

  useEffect(() => {
    const incoming = parseHex(value)
    if (incoming && rgbToHex(incoming) !== hex) setHsv(rgbToHsv(incoming))
  }, [value])

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const commit = (next: Hsv) => {
    setHsv(next)
    onChange(rgbToHex(hsvToRgb(next)))
  }

  const commitRgb = (next: Rgb) => {
    const nextHsv = rgbToHsv(next)
    commit({ ...nextHsv, h: nextHsv.s === 0 || nextHsv.v === 0 ? hsv.h : nextHsv.h })
  }

  const pickFromScreen = async () => {
    try {
      const picked = parseHex((await pickScreenColor(setHover)) ?? '')
      if (picked) commitRgb(picked)
    } catch {
      return
    } finally {
      setHover(null)
    }
  }

  const areaHandlers = dragHandlers((e) => {
    const { x, y } = pointerRatio(e)
    commit({ h: hsv.h, s: x, v: 1 - y })
  })

  const hueHandlers = dragHandlers((e) => {
    commit({ ...hsv, h: pointerRatio(e).x * 360 })
  })

  return (
    <div className="cp" ref={rootRef}>
      <button type="button" className="cp-trigger" aria-label={`${label.toLowerCase()} colour`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <i style={{ background: value }} />
        <code>{value.toUpperCase()}</code>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="cp-pop" role="dialog" aria-label={`${label.toLowerCase()} colour picker`}>
          <div className="cp-area" style={{ ['--hue' as string]: `hsl(${hsv.h} 100% 50%)` }} {...areaHandlers}>
            <span className="cp-knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
          </div>

          <div className="cp-tools">
            <button type="button" className="cp-eye" aria-label="Pick colour from screen" title="Click anywhere on screen to pick (Esc cancels)" onClick={pickFromScreen}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m2 22 1-1h3l9-9M3 21v-3l9-9" />
                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3z" />
              </svg>
            </button>
            <span className="cp-preview" style={{ background: hover ?? hex }} />
            <div className="cp-hue" {...hueHandlers}>
              <span className="cp-knob" style={{ left: `${(hsv.h / 360) * 100}%` }} />
            </div>
          </div>

          {hover && <p className="cp-hint">Click anywhere to pick · Esc to cancel</p>}

          <div className="cp-fields">
            <label className="cp-hex">
              <input
                autoComplete="off"
                spellCheck={false}
                maxLength={7}
                value={hover?.toUpperCase() ?? hexDraft ?? hex.toUpperCase()}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  setHexDraft(e.target.value)
                  const parsed = parseHex(e.target.value)
                  if (parsed) commitRgb(parsed)
                }}
                onBlur={() => setHexDraft(null)}
              />
              <span>HEX</span>
            </label>
            {CHANNELS.map(({ key, label: channelLabel }) => (
              <label key={key}>
                <input
                  autoComplete="off"
                  inputMode="numeric"
                  value={rgb[key]}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => commitRgb({ ...rgb, [key]: clampChannel(Number(e.target.value.replace(/\D/g, ''))) })}
                />
                <span>{channelLabel}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
