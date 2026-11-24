import { useState } from 'react'
import { useDiscoveredSession } from '../../hooks/useDiscoveredSession'
import { pairWithCode } from '../../utils/pairing'

const CODE_LENGTH = 5

export function LinkPanel({ onDone }: { onDone: () => void }) {
  const found = useDiscoveredSession()
  const [inputVal, setInputVal] = useState('')

  const link = async (code: string) => {
    if (code.length === CODE_LENGTH && (await pairWithCode(code))) onDone()
  }

  return (
    <div className="pop sug" role="dialog" aria-label="Link session">
      <div className="rph">
        <h2>Link session</h2>
      </div>
      {found && (
        <>
          <div className="rlab">Found session</div>
          <div className="fgrid">
            <button className="fch d on" onClick={() => link(found.code)}>
              <u />
              {found.code}
              <i>{found.controller.callsign}</i>
            </button>
          </div>
        </>
      )}
      <div className="rlab">Enter code</div>
      <form
        className="fgrid"
        onSubmit={(e) => {
          e.preventDefault()
          link(inputVal.trim().toUpperCase())
        }}
      >
        <input
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="linkedit"
          maxLength={CODE_LENGTH}
          placeholder="XXXXX"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value.toUpperCase())}
        />
        <button className="rclr" type="submit" disabled={inputVal.trim().length !== CODE_LENGTH}>
          Link
        </button>
      </form>
    </div>
  )
}
