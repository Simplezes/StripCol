import type { FlightPlan } from '../../types'

export interface RouteLeg {
  via: string
  from: string
  to: string
  eta: string
}

export function routeWordClass(word: string): string {
  const w = word.toUpperCase().split('/')[0]
  if (w === 'DCT') return 'p-dct'
  if (/^(RWY|RW|R)\d+[LR]?$/i.test(w) || /^\d+[LR]$/i.test(w)) return 'p-rwy'
  if (/^[A-Z]{3}$/i.test(w)) return 'p-vor'
  if (/^[A-Z]{5}$/i.test(w)) return 'p-fix'
  if (/^[A-Z]+\d+$/i.test(w) && w.length <= 6) return 'p-awy'
  if (/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{3,}$/i.test(w)) return 'p-proc'
  return 'p-fix'
}

function isViaWord(word: string): boolean {
  const cls = routeWordClass(word)
  return cls === 'p-dct' || cls === 'p-awy' || cls === 'p-proc'
}

function etaLookup(flight: FlightPlan): Record<string, string> {
  const points = [...(flight.departurePoints ?? []), ...(flight.arrivalPoints ?? [])]
  const lookup: Record<string, string> = {}
  points.forEach((point) => {
    if (point.eta) lookup[point.name.toUpperCase()] = point.eta
  })
  return lookup
}

export function buildLegs(flight: FlightPlan): RouteLeg[] {
  const words = (flight.route ?? '').trim().split(/\s+/).filter(Boolean).map((w) => w.split('/')[0].toUpperCase())
  const etas = etaLookup(flight)
  const legs: RouteLeg[] = []
  let from = flight.departure || '????'
  let pendingVia: string | null = null

  words.forEach((word) => {
    if (isViaWord(word)) {
      pendingVia = word
      return
    }
    legs.push({ via: pendingVia ?? 'DCT', from, to: word, eta: etas[word] ?? '' })
    from = word
    pendingVia = null
  })

  if (words.length > 0 && from !== flight.arrival && flight.arrival) {
    legs.push({ via: pendingVia ?? 'DCT', from, to: flight.arrival, eta: '' })
  }
  return legs
}
