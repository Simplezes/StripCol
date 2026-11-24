import { useEffect, useState } from 'react'
import appIcon from '../../assets/app-icon.png'
import { useConnectionStore } from '../../stores/connectionStore'
import { usePanelStore } from '../../stores/panelStore'
import type { Settings } from '../../types'
import { Toggle } from '../ui/Toggle'

interface Props {
  s: Settings
  update: (p: Partial<Settings>) => void
}

const FACILITY_ABBREVIATIONS: Record<string, string> = {
  del: 'DEL',
  ground: 'GND',
  tower: 'TWR',
  approach: 'APP',
  center: 'CTR',
}

function useElapsed(): string {
  const [seconds, setSeconds] = useState(() => Math.floor(performance.now() / 1000))

  useEffect(() => {
    const id = setInterval(() => setSeconds(Math.floor(performance.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = String(seconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`
}

function DiscordCard({ details, state, active }: { details: string; state: string; active: boolean }) {
  const elapsed = useElapsed()

  return (
    <div className={`dcard${active ? '' : ' off'}`}>
      <div className="dhead">
        <b>Playing</b>
        <span aria-hidden="true">···</span>
      </div>
      <div className="dbody">
        <img src={appIcon} alt="" />
        <div className="dtx">
          <b>StripCol</b>
          <span>{details}</span>
          <span>{state}</span>
          <span className="dtime">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9h12a3 3 0 0 1 3 3.2l-.6 4.3a2.3 2.3 0 0 1-4 1.2L15 16.5H9l-1.4 1.2a2.3 2.3 0 0 1-4-1.2L3 12.2A3 3 0 0 1 6 9zM8 11.5v3M6.5 13h3M16 12.2v.01M18 13.8v.01" />
            </svg>
            {elapsed}
          </span>
        </div>
      </div>
    </div>
  )
}

const RECEIVES = ['Flight plans', 'Cleared flag', 'Handovers', 'Assume']

function Tick() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  )
}

export function IntegrationsTab({ s, update }: Props) {
  const isPaired = useConnectionStore((st) => st.isPaired)
  const isPluginLinked = useConnectionStore((st) => st.isPluginLinked)
  const callsign = useConnectionStore((st) => st.controllerCallsign)
  const stripCount = usePanelStore((st) => st.panels.reduce((n, p) => n + p.strips.length, 0))
  const facilityType = useConnectionStore((st) => st.facilityType)
  const trafficCounts = usePanelStore((st) => {
    const counts = { departure: 0, arrival: 0, overfly: 0 }
    st.panels.forEach((panel) =>
      panel.strips.forEach((strip) => {
        if (strip.type !== 'transfer') counts[strip.type] += 1
      }),
    )
    return `${counts.departure} Dep / ${counts.arrival} Arr / ${counts.overfly} Ovr`
  })

  const linked = isPaired && isPluginLinked

  return (
    <>
      <div className="ph">
        <h2>Integrations</h2>
        <span>Services StripCol talks to</span>
      </div>

      <div className="int">
        <article className="itg">
          <div className="t">
            <span className="lg">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 12l18-8-6 16-3-7z" />
              </svg>
            </span>
            <div className="nm">
              <b>EuroScope</b>
              <small>Flight plans and clearances</small>
            </div>
            <span className={`pill${linked ? '' : ' off'}`}>
              <i />
              {linked ? 'Connected' : 'Not linked'}
            </span>
          </div>
          <div className="sec">
            <h4>Receives from the plugin</h4>
            <ul className="ul">
              {RECEIVES.map((item) => (
                <li key={item}>
                  <Tick />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <dl className="set-kv">
            <div>
              <dt>Link code</dt>
              <dd>{s.linkCode || '-----'}</dd>
            </div>
            <div>
              <dt>Gateway</dt>
              <dd>{s.serverIp}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={isPaired ? 'okc' : ''}>{isPaired ? 'Plugin linked' : 'Waiting for plugin'}</dd>
            </div>
          </dl>
        </article>

        <article className="itg">
          <div className="t">
            <span className="lg">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 6c3-1.5 7-1.5 10 0l2 9c-2 1.5-4 2-7 2s-5-.5-7-2zM9.5 12v.01M14.5 12v.01" />
              </svg>
            </span>
            <div className="nm">
              <b>Discord Rich Presence</b>
              <small>Show what you control</small>
            </div>
            <Toggle label="Discord Rich Presence" checked={s.discordRpcEnabled} onChange={(v) => update({ discordRpcEnabled: v })} />
          </div>
          <div className="sec">
            <h4>Preview of your status</h4>
            <DiscordCard
              active={s.discordRpcEnabled}
              details={callsign ? `Controlling ${FACILITY_ABBREVIATIONS[facilityType] ?? 'ATC'} (${callsign})` : 'Awaiting Connection'}
              state={callsign ? trafficCounts : 'Ready for traffic'}
            />
          </div>
          <dl className="set-kv">
            <div>
              <dt>Position</dt>
              <dd>{callsign ? callsign.split('_').join(' ') : '—'}</dd>
            </div>
            <div>
              <dt>Strips</dt>
              <dd>{stripCount}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={s.discordRpcEnabled ? 'okc' : ''}>{s.discordRpcEnabled ? 'Showing' : 'Off'}</dd>
            </div>
          </dl>
        </article>
      </div>
    </>
  )
}
