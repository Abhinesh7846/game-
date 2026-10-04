/** Global keyboard / mouse state. Edge-triggered presses are consumed once per frame by the game loop. */

const down = new Set<string>()
const pressed = new Set<string>()
let mouseDX = 0
let mouseDY = 0

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
  },
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
