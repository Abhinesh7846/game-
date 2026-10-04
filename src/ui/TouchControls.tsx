import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { input } from '../game/input'
import { useGame } from '../game/store'
import { unlockAudio } from '../game/audio'

const STICK_R = 56
/** touch drag pixels → mouse-pixel units (phones need a much faster turn than a mouse) */
const LOOK_GAIN = 2.6

interface Btn {
  id: string
  code: string
  label: string
  ability?: string
  big?: boolean
}

const BUTTONS: Btn[] = [
  { id: 'jump', code: 'Space', label: 'JUMP', big: true },
  { id: 'pulse', code: 'Mouse0', label: 'BLAST', ability: 'pulse', big: true },
  { id: 'dash', code: 'ShiftLeft', label: 'DASH', ability: 'dash' },
  { id: 'grapple', code: 'KeyE', label: 'HOOK', ability: 'grapple' },
  { id: 'shield', code: 'KeyQ', label: 'SHIELD', ability: 'shield' },
  { id: 'slow', code: 'KeyF', label: 'SLOW', ability: 'slowField' },
]

/**
 * Mobile controls. Left half: a floating joystick that appears where the thumb lands.
 * Right half: drag to look. Buttons sit bottom-right and feed the same input queue as the keyboard.
 */
export function TouchControls() {
  const abilities = useGame((s) => s.hud.abilities)
  const setScreen = useGame((s) => s.setScreen)
  const stick = useRef<{ id: number; ox: number; oy: number } | null>(null)
  const look = useRef<{ id: number; x: number; y: number } | null>(null)
  const [knob, setKnob] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null)

  useEffect(() => () => input.setMove(0, 0), [])

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    unlockAudio()
    const half = window.innerWidth / 2
    if (e.clientX < half && !stick.current) {
      stick.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY }
      setKnob({ ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 })
    } else if (!look.current) {
      look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety; synthetic/expired pointers can't be captured */
    }
  }
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const s = stick.current
    if (s && s.id === e.pointerId) {
      let dx = e.clientX - s.ox
      let dy = e.clientY - s.oy
      const len = Math.hypot(dx, dy)
      if (len > STICK_R) {
        dx = (dx / len) * STICK_R
        dy = (dy / len) * STICK_R
      }
      input.setMove(dx / STICK_R, -dy / STICK_R)
      setKnob({ ox: s.ox, oy: s.oy, dx, dy })
    }
    const l = look.current
    if (l && l.id === e.pointerId) {
      input.addLook((e.clientX - l.x) * LOOK_GAIN, (e.clientY - l.y) * LOOK_GAIN)
      l.x = e.clientX
      l.y = e.clientY
    }
  }
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (stick.current?.id === e.pointerId) {
      stick.current = null
      input.setMove(0, 0)
      setKnob(null)
    }
    if (look.current?.id === e.pointerId) look.current = null
  }

  return (
    <div className="touch-layer">
      <div className="touch-pad" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      {knob ? (
        <div className="stick" style={{ left: knob.ox, top: knob.oy }}>
          <div className="knob" style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} />
        </div>
      ) : (
        <div className="stick-hint">MOVE</div>
      )}
      <div className="touch-buttons">
        {BUTTONS.map((b) => {
          const a = abilities.find((x) => x.id === b.ability)
          if (a?.locked) return null
          const cd = a && a.ready < 1 ? 1 - Math.max(0, a.ready) : 0
          return (
            <button
              key={b.id}
              className={`tbtn tbtn-${b.id} ${b.big ? 'big' : ''} ${a?.active ? 'active' : ''}`}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                input.press(b.code)
              }}
              onPointerUp={() => input.release(b.code)}
              onPointerCancel={() => input.release(b.code)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {b.label}
              {cd > 0 && <span className="tcd" style={{ transform: `scaleY(${cd})` }} />}
            </button>
          )
        })}
      </div>
      <button className="tpause" onPointerDown={() => setScreen('paused')} aria-label="Pause">
        ❚❚
      </button>
    </div>
  )
}

/** Shown while playing in portrait: the game needs a wide view. */
export function RotateHint() {
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth)
  useEffect(() => {
    const on = () => setPortrait(window.innerHeight > window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  if (!portrait) return null
  return (
    <div className="rotate-hint">
      <div className="phone" />
      <b>ROTATE YOUR DEVICE</b>
      <span>Rift Runners plays best in landscape</span>
    </div>
  )
}

/** Rewrites keyboard wording in tutorial hints for touch players. */
export function touchHint(text: string) {
  return text
    .replace('WASD to move · MOUSE to look around', 'LEFT THUMB to move · drag RIGHT side to look')
    .replace(/LEFT CLICK/g, 'BLAST')
    .replace(/press E or RIGHT CLICK/g, 'tap HOOK')
    .replace(/E or Right-click|E \/ RMB/g, 'HOOK')
    .replace(/press E/g, 'tap the button')
    .replace(/SPACE/g, 'JUMP')
    .replace(/SHIFT/g, 'DASH')
    .replace(/\(F\)/g, '(SLOW button)')
    .replace(/holding W/g, 'pushing forward')
}
