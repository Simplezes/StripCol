import { useEffect, useState } from 'react'
import { useConnectionStore } from '../stores/connectionStore'

const METAR_URL = 'https://metar.vatsim.net'
const REFRESH_MS = 60_000
const HPA_PER_INHG = 33.8639

export function parseHpa(text: string): number | null {
  const upper = text.toUpperCase()
  const hpa = upper.match(/\b(?:QNH|Q)\s*:?\s*(\d{3,4})\b/)
  if (hpa) return Number(hpa[1])
  const inHg = upper.match(/\b(?:ALTIMETER|A)\s*:?\s*(\d{4})\b/)
  return inHg ? Math.round((Number(inHg[1]) / 100) * HPA_PER_INHG) : null
}

export function hpaToInHg(hpa: number): string {
  return (hpa / HPA_PER_INHG).toFixed(2)
}

export function useQnh(icao: string): number | null {
  const [fetched, setFetched] = useState<number | null>(null)
  const metar = useConnectionStore((s) => s.metars[icao])

  useEffect(() => {
    setFetched(null)
    if (!icao) return
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`${METAR_URL}/${icao}`)
        const hpa = parseHpa(await res.text())
        if (!cancelled) setFetched(hpa)
      } catch {
        if (!cancelled) setFetched(null)
      }
    }

    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [icao])

  return (metar ? parseHpa(metar) : null) ?? fetched
}
