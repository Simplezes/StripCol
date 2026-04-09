let ctx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
  }
  return ctx
}

export function playNotificationSound(): void {
  try {
    const ac = getAudioContext()

    const tones = [
      { freq: 880, start: 0, duration: 0.08 },
      { freq: 1100, start: 0.1, duration: 0.08 },
    ]

    tones.forEach(({ freq, start, duration }) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ac.currentTime + start)

      gain.gain.setValueAtTime(0, ac.currentTime + start)
      gain.gain.linearRampToValueAtTime(0.3, ac.currentTime + start + 0.01)
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + start + duration)

      osc.connect(gain)
      gain.connect(ac.destination)

      osc.start(ac.currentTime + start)
      osc.stop(ac.currentTime + start + duration + 0.01)
    })
  } catch (err) {
    console.warn('Could not play notification sound:', err)
  }
}
