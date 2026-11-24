let ctx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
  }
  return ctx
}

export type NotificationSound = 'assumed' | 'handover' | 'released' | 'cleared' | 'flightplan'

interface Tone {
  freq: number
  start: number
  duration: number
  wave?: OscillatorType
  volume?: number
}

const TONES: Record<NotificationSound, Tone[]> = {
  assumed: [
    { freq: 880, start: 0, duration: 0.08 },
    { freq: 1100, start: 0.1, duration: 0.08 },
  ],
  handover: [
    { freq: 660, start: 0, duration: 0.1, wave: 'triangle' },
    { freq: 880, start: 0.13, duration: 0.1, wave: 'triangle' },
    { freq: 1320, start: 0.26, duration: 0.16, wave: 'triangle' },
  ],
  released: [
    { freq: 990, start: 0, duration: 0.1, volume: 0.2 },
    { freq: 660, start: 0.12, duration: 0.18, volume: 0.2 },
  ],
  cleared: [
    { freq: 1568, start: 0, duration: 0.06, wave: 'triangle' },
    { freq: 1568, start: 0.09, duration: 0.12, wave: 'triangle' },
  ],
  flightplan: [{ freq: 587, start: 0, duration: 0.18, wave: 'triangle', volume: 0.25 }],
}

export const SOUND_LABELS: Record<NotificationSound, { title: string; description: string }> = {
  assumed: { title: 'Aircraft assumed', description: 'A strip comes under your control.' },
  handover: { title: 'Handover offered', description: 'Another controller offers you an aircraft.' },
  released: { title: 'Aircraft handed off', description: 'A strip leaves your control.' },
  cleared: { title: 'Clearance received', description: 'A strip gets its clearance flag.' },
  flightplan: { title: 'New flight plan', description: 'A strip is created from a filed flight plan.' },
}

let busyUntil = 0

export function playNotificationSound(kind: NotificationSound = 'assumed'): void {
  try {
    const ac = getAudioContext()
    if (ac.currentTime < busyUntil) return

    const tones = TONES[kind]
    const last = tones[tones.length - 1]
    busyUntil = ac.currentTime + last.start + last.duration + 0.15

    tones.forEach(({ freq, start, duration, wave = 'sine', volume = 0.3 }) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const at = ac.currentTime + start

      osc.type = wave
      osc.frequency.setValueAtTime(freq, at)

      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(volume, at + 0.01)
      gain.gain.linearRampToValueAtTime(0, at + duration)

      osc.connect(gain)
      gain.connect(ac.destination)

      osc.start(at)
      osc.stop(at + duration + 0.01)
    })
  } catch (err) {
    console.warn('Could not play notification sound:', err)
  }
}
