/* Dev-only automation helpers for scripted playtests (never shipped in production builds). */
type W = Record<string, any>
const w = window as unknown as W

w.__step = async (n: number, ms = 16) => {
  for (let i = 0; i < n; i++) {
    w.__r3f().advance(performance.now())
    await new Promise((r) => setTimeout(r, ms))
  }
}
w.__key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }))
w.__tap = async (code: string) => {
  w.__key(code, true)
  await w.__step(1)
  w.__key(code, false)
}
/** Simulated pulse: synthetic clicks are ignored without pointer lock, so feed the key directly. */
w.__click = async () => {
  w.__key('Mouse0', true)
  await w.__step(1)
  w.__key('Mouse0', false)
}
w.__tp = (x: number, y: number, z: number, yaw = 0) => {
  const rt = w.__rift
  rt.player.pos.set(x, y, z)
  rt.player.vel.set(0, 0, 0)
  rt.refs.body.setTranslation({ x, y, z }, true)
  rt.refs.body.setNextKinematicTranslation({ x, y, z })
  rt.player.yaw = yaw
}
/** Walk toward (tx,tz), firing each trigger's key once when its condition first holds. */
w.__go = async (tx: number, tz: number, triggers: { when: (rt: W) => boolean; key: string }[] = [], max = 400) => {
  const rt = w.__rift
  const trig = triggers.map((t) => ({ ...t, done: false }))
  w.__key('KeyW', true)
  let i = 0
  for (; i < max; i++) {
    const p = rt.player.pos
    const dx = tx - p.x
    const dz = tz - p.z
    if (Math.hypot(dx, dz) < 0.7 || rt.player.dead || rt.completed) break
    rt.player.yaw = Math.atan2(-dx, -dz)
    for (const t of trig)
      if (!t.done && t.when(rt)) {
        t.done = true
        await w.__tap(t.key)
      }
    await w.__step(1)
  }
  w.__key('KeyW', false)
  await w.__step(3)
  const p = rt.player.pos
  return { pos: [p.x, p.y, p.z].map((v: number) => +v.toFixed(2)), dead: rt.player.dead, steps: i, cores: rt.stats.cores }
}
export {}
