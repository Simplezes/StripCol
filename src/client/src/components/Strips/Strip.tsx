import { useCallback, useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePanelStore, markFieldCleared } from '../../stores/panelStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useContextMenuStore } from '../../stores/contextMenuStore'
import { useUIStore } from '../../stores/uiStore'
import { apiFetch } from '../../utils/api'
import { autoMoveOnC12 } from '../../utils/stripActions'
import { CUSTOM_BOX_KEYS } from '../../utils/stripValues'
import { useAssetsStore } from '../../stores/assetsStore'
import { computeProcedurePoints, fetchPointETAs } from '../../utils/procedurePoints'
import { showToast } from '../../utils/toast'

const CELL_CLASSES: string[] = [
  'c1 al_ot',
  'c2 le_ot ri_ot bt_ot',
  'c3 ri_ot bt_ot',
  'c4 le_ot ri_ot bt_ot',
  'c5 ri_ot bt_ot',
  'c6 ri_ot tp_ot bt_ot',
  'c7 ri_ot tp_ot bt_ot',
  'c8',
  'c9 ri_ot',
  'c10 bt_ot',
  'c11 bt_ot',
  'c12 ri_ot bt_ot',
  'c13 tp_ot ri_ot',
  'c14 ri_ot',
  'c15 bt_ot ri_ot',
  'c16 tp_ot ri_ot',
  'c17 ri_ot',
  'c18 bt_ot ri_ot',
  'c19 ri_ot tp_ot bt_ot',
  'c20 ri_ot tp_ot bt_ot',
  'c21 ri_ot tp_ot bt_ot',
  'c22 ri_ot tp_ot bt_ot',
  'c23 ri_ot tp_ot',
  'c24 ri_ot bt_ot',
  'c25 ri_ot bt_ot',
  'c26 ri_ot bt_ot',
  'c27 ri_ot bt_ot',
  'c28 ri_ot',
  'c29 ri_ot bt_ot',
  'c30 ri_ot bt_ot',
  'c31 ri_ot bt_ot',
  'c32 ri_ot bt_ot',
];

const CELL_KEYS = CELL_CLASSES.map((cls) => cls.split(' ')[0])

function formatC33(ts: number): { date: string; time: string } {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${String(d.getUTCFullYear()).slice(-2)}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
  }
}

interface StripProps {
  stripId: string
  panelName: string
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D+/g, '')
}

async function syncFieldToGateway(key: string, rawValue: string, callsign: string): Promise<void> {
  const code = useSettingsStore.getState().settings.linkCode
  if (!code) return

  const value = rawValue.trim().toUpperCase()

  switch (key) {
    case 'c6': {
      const squawk = digitsOnly(value) || '2000'
      await apiFetch('/api/set-squawk', {
        method: 'POST',
        body: JSON.stringify({ code, callsign, squawk }),
      })
      return
    }
    case 'c7': {
      const Dtime = digitsOnly(value).padStart(4, '0').slice(0, 4) || '0000'
      await apiFetch('/api/set-departureTime', {
        method: 'POST',
        body: JSON.stringify({ code, callsign, Dtime }),
      })
      return
    }
    case 'c9': {
      if (value.includes('.')) {
        const assignedMach = Number.parseFloat(value)
        await apiFetch('/api/set-assigned-mach', {
          method: 'POST',
          body: JSON.stringify({
            code,
            callsign,
            assignedMach: Number.isFinite(assignedMach) ? assignedMach.toString() : '0',
          }),
        })
      } else {
        const assignedSpeed = Number.parseInt(digitsOnly(value), 10)
        await apiFetch('/api/set-assigned-speed', {
          method: 'POST',
          body: JSON.stringify({
            code,
            callsign,
            assignedSpeed: Number.isFinite(assignedSpeed) ? assignedSpeed.toString() : '0',
          }),
        })
      }
      return
    }
    case 'c12': {
      await apiFetch('/api/set-direct-point', {
        method: 'POST',
        body: JSON.stringify({ code, callsign, pointName: value || '' }),
      })
      return
    }
    case 'c13': {
      const fl = Number.parseInt(digitsOnly(value), 10)
      const finalAltitude = Number.isFinite(fl) ? String(fl * 100) : '0'
      await apiFetch('/api/set-final-alt', {
        method: 'POST',
        body: JSON.stringify({ code, callsign, finalAltitude }),
      })
      return
    }
    case 'c14': {
      let clearedAltitude: string
      if (value === 'CA') {
        clearedAltitude = '1'
      } else if (value === 'VA') {
        clearedAltitude = '2'
      } else {
        const fl = Number.parseInt(digitsOnly(value), 10)
        clearedAltitude = Number.isFinite(fl) ? String(fl * 100) : '0'
      }
      await apiFetch('/api/set-cleared-alt', {
        method: 'POST',
        body: JSON.stringify({ code, callsign, clearedAltitude }),
      })
      return
    }
    case 'c16': {
      const assignedHeading = Number.parseInt(digitsOnly(value), 10)
      await apiFetch('/api/set-assigned-heading', {
        method: 'POST',
        body: JSON.stringify({
          code,
          callsign,
          assignedHeading: Number.isFinite(assignedHeading) ? assignedHeading.toString() : '0',
        }),
      })
      return
    }
    default:
      return
  }
}

export function Strip({ stripId, panelName }: StripProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stripId })

  const strip = usePanelStore((s) =>
    s.panels.find((p) => p.name === panelName)?.strips.find((st) => st.id === stripId),
  )

  const [localValues, setLocalValues] = useState<Record<string, string>>(
    () => strip?.values ?? {},
  )

  const prevFlightPlan = useRef(strip?.flightPlan)
  const phase4Cells = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!strip) return
    if (prevFlightPlan.current !== strip.flightPlan) {
      const next = { ...strip.values }
      CUSTOM_BOX_KEYS.forEach((k) => {
        if (localValues[k] && strip.values[k] !== '') next[k] = localValues[k]
      })
      setLocalValues(next)
    }
    prevFlightPlan.current = strip.flightPlan
  }, [strip?.flightPlan])

  useEffect(() => {
    if (!strip?.euroscope || !strip.flightPlan) return
    const flight = strip.flightPlan
    const { controllerMode } = useConnectionStore.getState()
    const procedures = useAssetsStore.getState().procedures
    const needsPoints =
      controllerMode === 'approach' ||
      controllerMode === 'center' ||
      (controllerMode === 'aerodrome' && strip.type === 'arrival')
    if (!needsPoints) return

    const guardValues = Object.fromEntries(
      Object.entries(strip.values).filter(([k]) => !phase4Cells.current.has(k)),
    )

    let cancelled = false
    computeProcedurePoints(flight, strip.type, controllerMode, procedures, guardValues).then(
      (extra) => {
        if (cancelled || !Object.keys(extra).length) return
        phase4Cells.current = new Set(Object.keys(extra))
        setLocalValues((prev) => {
          const merged = { ...prev }
          Object.entries(extra).forEach(([k, v]) => {
            if (!(prev[k] || '').trim() || phase4Cells.current.has(k)) merged[k] = v
          })
          return merged
        })
        usePanelStore.getState().updateStrip(panelName, stripId, {
          values: { ...strip.values, ...extra },
        })
      },
    )
    return () => { cancelled = true }
  }, [strip?.flightPlan])

  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  const syncToStore = useCallback(
    (values: Record<string, string>) => {
      usePanelStore.getState().updateStrip(panelName, stripId, { values })
    },
    [panelName, stripId],
  )

  const handleChange = (key: string, rawValue: string) => {
    const value = rawValue.toUpperCase()
    const updated = { ...localValues, [key]: value }
    setLocalValues(updated)
    phase4Cells.current.delete(key)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => syncToStore(updated), 200)
  }

  const handleBlur = async (key: string, domValue?: string) => {
    clearTimeout(saveTimer.current)
    syncToStore(localValues)

    const effectiveValue = domValue !== undefined ? domValue.trim().toUpperCase() : (localValues[key] ?? '')

    if (strip?.euroscope && strip.flightPlan?.callsign) {
      if (key === 'c12' && effectiveValue === '') {
        markFieldCleared(stripId, 'c12')
        syncFieldToGateway('c16', '0', strip.flightPlan.callsign).catch((err) => {
          console.error('Failed resetting heading on c12 clear:', err)
        })
      }
      syncFieldToGateway(key, effectiveValue, strip.flightPlan.callsign).catch((err) => {
        console.error(`Failed syncing ${key} to gateway:`, err)
      })
    }

    if (key === 'c12') {
      autoMoveOnC12(stripId, panelName, effectiveValue)
    }

    if (key === 'c18' && strip?.euroscope && strip.flightPlan) {
      const { controllerMode } = useConnectionStore.getState()
      const procedures = useAssetsStore.getState().procedures as Record<string, Record<string, Record<string, Record<string, unknown>>>>
      const fp = strip.flightPlan
      const isArrival = strip.type === 'arrival'
      const airport = (isArrival ? fp.arrival : fp.departure) as string | undefined
      const procType = isArrival ? 'STAR' : 'SID'
      const newRunway = (localValues['c18'] ?? '').trim().toUpperCase()
      const oldRunway = ((isArrival ? fp.arrivalRwy : fp.departureRwy) as string | undefined ?? '').trim().toUpperCase()

      if (newRunway && newRunway !== oldRunway && airport) {
        const runwaysObj = procedures?.[airport]?.[procType] ?? procedures?.[airport.toUpperCase()]?.[procType] ?? procedures?.[airport.toLowerCase()]?.[procType]
        if (!runwaysObj || !runwaysObj[newRunway]) {
          showToast(`Runway ${newRunway} not available at ${airport}`, 'warning')
          const reverted = { ...localValues, c18: oldRunway }
          setLocalValues(reverted)
          syncToStore(reverted)
        } else {
          const currentProcRaw = (localValues['c8'] ?? '').trim().toUpperCase()
          const baseProcName = currentProcRaw.split('/')[0]
          const runwayProcs = runwaysObj[newRunway] as Record<string, unknown>
          const matchedKey = Object.keys(runwayProcs).find((k) => {
            const ku = k.toUpperCase()
            return ku === baseProcName || ku.startsWith(baseProcName) || baseProcName.startsWith(ku)
          })

          if (!matchedKey && baseProcName) {
            showToast(`${baseProcName} not available on runway ${newRunway} at ${airport}`, 'warning')
            const reverted = { ...localValues, c18: oldRunway }
            setLocalValues(reverted)
            syncToStore(reverted)
          } else if (matchedKey) {
            const code = useSettingsStore.getState().settings.linkCode
            const callsign = fp.callsign
            const fieldName = isArrival ? 'star' : 'sid'
            const endpoint = isArrival ? '/api/set-star' : '/api/set-sid'
            try {
              const res = await apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({ code, callsign, runway: newRunway, [fieldName]: matchedKey }),
              })
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
            } catch (err) {
              console.error(`Failed to set ${procType}:`, err)
              const reverted = { ...localValues, c18: oldRunway }
              setLocalValues(reverted)
              syncToStore(reverted)
              return
            }

            const clearedPoints: Record<string, string> = {}
            for (let i = 19; i <= 27; i++) clearedPoints[`c${i}`] = ''

            const updated = { ...localValues, c18: newRunway, c8: matchedKey, ...clearedPoints }
            setLocalValues(updated)
            syncToStore(updated)
            phase4Cells.current.clear()

            usePanelStore.getState().updateStrip(panelName, stripId, {
              values: { ...strip.values, c18: newRunway, c8: matchedKey, ...clearedPoints },
              flightPlan: {
                ...fp,
                ...(isArrival
                  ? { star: matchedKey, arrivalRwy: newRunway }
                  : { sid: matchedKey, departureRwy: newRunway }),
              },
            })
          }
        }
      }
    }

    const notifPointMap: Record<string, string> = { c19: 'c24', c20: 'c25', c21: 'c26', c22: 'c27' }
    if (key in notifPointMap && strip?.flightPlan?.callsign) {
      const pointName = (localValues[key] ?? '').trim().toUpperCase()
      const etaKey = notifPointMap[key]
      if (!pointName) {
        const cleared = { ...localValues, [etaKey]: '' }
        setLocalValues(cleared)
        syncToStore(cleared)
      } else {
        fetchPointETAs(strip.flightPlan.callsign, [{ name: pointName }]).then(([pt]) => {
          const withEta = { ...localValues, [etaKey]: pt.eta ?? '' }
          setLocalValues(withEta)
          syncToStore(withEta)
        })
      }
    }
  }

  const showMenu = useContextMenuStore((s) => s.show)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    showMenu(e.clientX, e.clientY, stripId, panelName)
  }

  useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current)
    }
  }, [])

  if (!strip) return null

  const c33 = formatC33(strip.lastUpdate)
  const autohideHeader = useSettingsStore.getState().settings.autohideHeader
  const searchQuery = useUIStore((s) => s.searchQuery)

  const isHidden = searchQuery.length > 0 && (() => {
    const q = searchQuery.toLowerCase()
    const valuesMatch = Object.values(localValues).some((v) => v.toLowerCase().includes(q))
    const fpMatch = strip.flightPlan?.callsign?.toLowerCase().includes(q) ||
                    strip.type.toLowerCase().includes(q)
    return !valuesMatch && !fpMatch
  })()

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : undefined,
    ...(isHidden ? { display: 'none' } : {}),
  }

  return (
    <div
      ref={setNodeRef}
      className={`strip draggable${autohideHeader ? ' theme-autohide-header' : ''}`}
      data-strip-id={stripId}
      data-type={strip.type}
      data-euroscope={strip.euroscope ? 'true' : 'false'}
      data-panel={panelName}
      onContextMenu={handleContextMenu}
      style={dragStyle}
      {...attributes}
      {...listeners}
    >
      {CELL_KEYS.map((key, i) => (
        <input
          key={key}
          className={`box ${CELL_CLASSES[i]}`}
          value={localValues[key] ?? ''}
          onChange={(e) => handleChange(key, e.target.value)}
          onBlur={(e) => handleBlur(key, e.currentTarget.value)}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ fontSize: 'clamp(8px, 1cqw, 16px)' }}
          data-cell={key}
          spellCheck={false}
          autoComplete="off"
        />
      ))}

      <div
        className="box c33 ri_ot bt_ot"
        style={{
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center',
          fontSize: '60%',
          color: 'var(--sys-text)',
        }}
      >
        <span>{c33.date}</span>
        <span>{c33.time}</span>
      </div>
    </div>
  )
}
