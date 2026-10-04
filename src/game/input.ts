/** Global keyboard / mouse state. Edge-triggered presses are consumed once per frame by the game loop. */

const down = new Set<string>()
const pressed = new Set<string>()
let mouseDX = 0
let mouseDY = 0
/** analog move from the touch joystick: x = strafe right, y = forward, length <= 1 */
let moveX = 0
let moveY = 0

/** Phones/tablets: coarse primary pointer (touchscreen laptops keep mouse + keyboard). */
export const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export const input = {
  isDown: (code: string) => down.has(code),
  /** true once per physical press */
  consume: (code: string) => {
    if (pressed.has(code)) {
      pressed.delete(code)
      return true
    }
    return false
  },
  takeMouse: () => {
    const r = { dx: mouseDX, dy: mouseDY }
    mouseDX = 0
    mouseDY = 0
    return r
  },
  clear: () => {
    down.clear()
    pressed.clear()
    mouseDX = 0
    mouseDY = 0
    moveX = 0
    moveY = 0
  },
  /** analog stick state (touch) */
  move: () => ({ x: moveX, y: moveY }),
  setMove: (x: number, y: number) => {
    moveX = x
    moveY = y
  },
  /** look delta in mouse-pixel units (touch drag) */
  addLook: (dx: number, dy: number) => {
    mouseDX += dx
    mouseDY += dy
  },
  /** virtual button press/release (touch) */
  press: (code: string) => {
    if (!down.has(code)) pressed.add(code)
    down.add(code)
  },
  release: (code: string) => {
    down.delete(code)
  },
  forwardHeld: () => down.has('KeyW') || down.has('ArrowUp') || moveY > 0.5,
  locked: () => document.pointerLockElement != null,
}

const GAME_KEYS = new Set(['Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD'])

let installed = false
export function installInput() {
  if (installed) return
  installed = true
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code) && document.pointerLockElement) e.preventDefault()
    if (!down.has(e.code)) pressed.add(e.code)
    down.add(e.code)
  })
  window.addEventListener('keyup', (e) => down.delete(e.code))
  window.addEventListener('blur', () => down.clear())
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) {
      // clamp spikes some browsers emit on lock
      mouseDX += Math.max(-200, Math.min(200, e.movementX))
      mouseDY += Math.max(-200, Math.min(200, e.movementY))
    }
  })
  window.addEventListener('mousedown', (e) => {
    // clicks on menus or the click that captures the mouse must not fire abilities
    if (!document.pointerLockElement) return
    const code = e.button === 0 ? 'Mouse0' : e.button === 2 ? 'Mouse2' : 'Mouse1'
    if (!down.has(code)) pressed.add(code)
    down.add(code)
  })
  window.addEventListener('mouseup', (e) => {
    down.delete(e.button === 0 ? 'Mouse0' : e.button === 2 ? 'Mouse2' : 'Mouse1')
  })
  window.addEventListener('contextmenu', (e) => {
    if (document.pointerLockElement) e.preventDefault()
  })
}

export function requestLock() {
  if (isTouchDevice()) return
  const canvas = document.querySelector('canvas')
  if (!canvas || document.pointerLockElement) return
  try {
    const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined
    if (r && typeof r.catch === 'function') r.catch(() => {})
  } catch {
    /* lock can be refused right after an exit; the click-to-capture banner covers that */
  }
}

export function releaseLock() {
  if (document.pointerLockElement) document.exitPointerLock()
}
