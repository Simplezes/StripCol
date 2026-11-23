import { createPortal } from 'react-dom'
import { useConnectionStore } from '../../stores/connectionStore'
import type { FacilityType } from '../../types'
import { Group, Item, Sep } from '../ContextMenu/MenuParts'

export const BOARD_TITLES: Record<FacilityType, string> = {
  del: 'Delivery board',
  ground: 'Ground board',
  tower: 'Tower board',
  approach: 'Approach board',
  center: 'Centre board',
}

const BOARD_ORDER: FacilityType[] = ['del', 'ground', 'tower', 'approach', 'center']

export function BoardMenu({ anchor, onClose }: { anchor: DOMRect; onClose: () => void }) {
  const override = useConnectionStore((s) => s.boardOverride)
  const detected = useConnectionStore((s) => s.detectedFacility)
  const setOverride = useConnectionStore((s) => s.setBoardOverride)

  const choose = (board: FacilityType | null) => {
    setOverride(board)
    onClose()
  }

  return createPortal(
    <>
      <div className="cm-backdrop" onMouseDown={onClose} />
      <div className="cm-stack" style={{ left: Math.max(8, anchor.left), top: anchor.bottom + 6 }}>
        <div className="cm w200" role="menu">
          <Item label="Automatic" value={BOARD_TITLES[detected].replace(' board', '')} current={override === null} onClick={() => choose(null)} />
          <Sep />
          <Group label="Board layout" />
          {BOARD_ORDER.map((board) => (
            <Item key={board} label={BOARD_TITLES[board]} current={override === board} onClick={() => choose(board)} />
          ))}
        </div>
      </div>
    </>,
    document.body,
  )
}
