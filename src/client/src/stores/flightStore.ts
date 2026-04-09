import { create } from 'zustand'
import type { FlightPlan } from '../types'

// ─── Store ────────────────────────────────────────────────────────────────────
// Runtime-only: not persisted to localStorage.

interface FlightState {
  aircraftMap: Record<string, FlightPlan>
  nearbyCallsigns: string[]

  addAircraft: (callsign: string, plan: FlightPlan) => void
  updateAircraft: (callsign: string, updates: Partial<FlightPlan>) => void
  removeAircraft: (callsign: string) => void
  clearAll: () => void
  setNearbyCallsigns: (callsigns: string[]) => void
}

export const useFlightStore = create<FlightState>((set) => ({
  aircraftMap: {},
  nearbyCallsigns: [],

  addAircraft: (callsign, plan) =>
    set((state) => ({
      aircraftMap: { ...state.aircraftMap, [callsign]: plan },
    })),

  updateAircraft: (callsign, updates) =>
    set((state) => {
      const existing = state.aircraftMap[callsign]
      if (!existing) return state
      return {
        aircraftMap: {
          ...state.aircraftMap,
          [callsign]: { ...existing, ...updates },
        },
      }
    }),

  removeAircraft: (callsign) =>
    set((state) => {
      const { [callsign]: _, ...rest } = state.aircraftMap
      return { aircraftMap: rest }
    }),

  clearAll: () => set({ aircraftMap: {}, nearbyCallsigns: [] }),

  setNearbyCallsigns: (callsigns) => set({ nearbyCallsigns: callsigns }),
}))
