import { useRef, useState } from 'react'
import { triggerReconnect, useConnectionStore } from '../../stores/connectionStore'
import { apiFetch } from '../../utils/api'
import { showToast } from '../../utils/toast'
import { restartGateway } from '../../platform/desktop'
import type { Settings } from '../../types'

interface Props {
  s: Settings
  update: (p: Partial<Settings>) => void
}

type Message = { tone: 'ok' | 'bad' | 'wait'; text: string } | null

const CODE_LENGTH = 5

function StatusMessage({ message }: { message: Message }) {
  if (!message) return <span className="msg" />
  return (
    <span className={`msg ${message.tone}`}>
      {message.tone === 'ok' && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12l5 5 9-10" />
        </svg>
      )}
      {message.text}
    </span>
  )
}

function CodeBoxes({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter: () => void }) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const chars = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '')

  const setChar = (index: number, char: string) => {
    const next = chars.slice()
    next[index] = char
    onChange(next.join('').slice(0, CODE_LENGTH))
    if (char && index < CODE_LENGTH - 1) refs.current[index + 1]?.focus()
  }

  return (
    <span className="code" role="group" aria-label="Link code">
      {chars.map((char, i) => (
        <input
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={char}
          maxLength={1}
          inputMode="text"
          aria-label={`Character ${i + 1}`}
          onChange={(e) => setChar(i, e.target.value.toUpperCase().slice(-1))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEnter()
            if (e.key === 'Backspace' && !char && i > 0) refs.current[i - 1]?.focus()
          }}
          onPaste={(e) => {
            e.preventDefault()
            onChange(e.clipboardData.getData('text').toUpperCase().replace(/\s/g, '').slice(0, CODE_LENGTH))
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ))}
    </span>
  )
}

export function ConnectionTab({ s, update }: Props) {
  const isConnected = useConnectionStore((st) => st.isConnected)
  const isPaired = useConnectionStore((st) => st.isPaired)
  const [serverIp, setServerIp] = useState(s.serverIp)
  const [linkCode, setLinkCode] = useState(s.linkCode)
  const [gatewayMessage, setGatewayMessage] = useState<Message>(
    isConnected ? { tone: 'ok', text: 'Gateway reachable' } : null,
  )
  const [pairMessage, setPairMessage] = useState<Message>(
    isPaired ? { tone: 'ok', text: 'Plugin linked' } : null,
  )

  const statusText = isPaired ? 'Plugin linked' : isConnected ? 'Waiting for plugin' : 'Gateway offline'
  const statusClass = isPaired ? '' : isConnected ? 'w' : 'bad'

  const handleRestart = () => {
    const trimmed = serverIp.trim() || '127.0.0.1'
    update({ serverIp: trimmed })
    restartGateway(trimmed).catch(() => {})
    triggerReconnect()
    setGatewayMessage({ tone: 'wait', text: 'Restarting…' })
    showToast('Server restarting…', 'info')
  }

  const handlePair = async () => {
    const code = linkCode.trim().toUpperCase()
    if (code.length !== CODE_LENGTH) {
      setPairMessage({ tone: 'bad', text: 'Code must be 5 characters' })
      return
    }
    setPairMessage({ tone: 'wait', text: 'Checking…' })
    try {
      const res = await apiFetch(`/api/pair/${code}`)
      const result = await res.json()
      if (result.success) {
        setPairMessage({ tone: 'ok', text: 'Code accepted' })
        update({ linkCode: code })
        triggerReconnect()
      } else {
        setPairMessage({ tone: 'bad', text: result.message })
      }
    } catch {
      setPairMessage({ tone: 'bad', text: 'Gateway not found' })
    }
  }

  return (
    <>
      <div className="ph">
        <h2>Connection</h2>
        <span>Gateway and EuroScope link</span>
      </div>

      <div className="stat">
        <div>
          <em>Status</em>
          <b>
            <i className={statusClass} />
            {statusText}
          </b>
        </div>
        <div>
          <em>Gateway</em>
          <b>{s.serverIp}</b>
        </div>
        <div>
          <em>Link code</em>
          <b>{s.linkCode || '-----'}</b>
        </div>
      </div>

      <div className="card steps">
        <div className={`sp${isConnected ? ' done' : ''}`}>
          <span className="n">1</span>
          <div className="bd">
            <b>Gateway address</b>
            <small>The IP your local StripCol gateway listens on.</small>
            <div className="ln">
              <input
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="inp"
                value={serverIp}
                placeholder="127.0.0.1"
                aria-label="Server IP"
                onChange={(e) => setServerIp(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <button className="btn" onClick={handleRestart}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" />
                </svg>
                Restart &amp; connect
              </button>
              <StatusMessage message={gatewayMessage} />
            </div>
          </div>
        </div>
        <div className={`sp${isPaired ? ' done' : ''}`}>
          <span className="n">2</span>
          <div className="bd">
            <b>Link code</b>
            <small>The 5-character code shown by the StripCol plugin in EuroScope.</small>
            <div className="ln">
              <CodeBoxes value={linkCode} onChange={setLinkCode} onEnter={handlePair} />
              <button className="btn pri" onClick={handlePair}>
                Pair
              </button>
              <StatusMessage message={pairMessage} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
