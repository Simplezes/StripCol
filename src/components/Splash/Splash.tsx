import { useEffect, useState } from 'react'
import appIcon from '../../assets/app-icon.png'
import { useAssetsStore } from '../../stores/assetsStore'

const MIN_VISIBLE_MS = 900
const MAX_VISIBLE_MS = 8000
const FADE_MS = 350

export function Splash() {
  const assetsLoaded = useAssetsStore((s) => s.loaded)
  const [minElapsed, setMinElapsed] = useState(false)
  const [forced, setForced] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const min = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS)
    const max = setTimeout(() => setForced(true), MAX_VISIBLE_MS)
    return () => {
      clearTimeout(min)
      clearTimeout(max)
    }
  }, [])

  const ready = forced || (assetsLoaded && minElapsed)

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => setGone(true), FADE_MS)
    return () => clearTimeout(timer)
  }, [ready])

  if (gone) return null

  return (
    <div className={`splash${ready ? ' out' : ''}`} role="status" aria-live="polite">
      <img className="splash-icon" src={appIcon} alt="" />
      <h1>StripCol</h1>
      <div className="splash-bar" aria-hidden="true">
        <i />
      </div>
      <p>{assetsLoaded ? 'Starting up' : 'Loading procedures and sectors'}</p>
    </div>
  )
}
