import * as THREE from 'three'
import { rt, type MoverState } from '../game/runtime'
import { COLORS, KEY_COLORS, P } from '../game/constants'
import { sfx } from '../game/audio'
import { useGame } from '../game/store'
import type { MoverDef } from '../game/types'
import { addCombo, damagePlayer } from './combat'
import { addShake, burst, shockwave } from './fx'
import { playerInBox, playerSegment, rayDist, segSegDist } from './physics'

const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const segA = new THREE.Vector3()
const segB = new THREE.Vector3()

// ---------------- movers ----------------
interface PathCache {
  pts: THREE.Vector3[]
  cum: number[]
  len: number
  marks: number[]
}
const pathCache = new WeakMap<MoverDef, PathCache>()

function getPath(def: MoverDef): PathCache {
  let c = pathCache.get(def)
  if (c) return c
  const pts = def.path.map((p) => new THREE.Vector3(...p))
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
  const len = cum[cum.length - 1]
  const marks = [...cum.slice(1), ...cum.slice(0, -1).reverse().map((x) => 2 * len - x)]
  c = { pts, cum, len, marks }
  pathCache.set(def, c)
  return c
}

function pointAt(c: PathCache, s: number, out: THREE.Vector3) {
  const d = s <= c.len ? s : 2 * c.len - s
  for (let i = 1; i < c.pts.length; i++) {
    if (d <= c.cum[i] || i === c.pts.length - 1) {
      const seg = c.cum[i] - c.cum[i - 1] || 1
      return out.lerpVectors(c.pts[i - 1], c.pts[i], THREE.MathUtils.clamp((d - c.cum[i - 1]) / seg, 0, 1))
    }
  }
  return out.copy(c.pts[0])
}

export function updateMovers(worldDt: number) {
  const L = rt.level!
  L.movers.forEach((def, i) => {
    const m: MoverState = rt.movers[i]
    const c = getPath(def)
    m.active = def.activatedBy ? !!rt.plates[def.activatedBy] : true
    let s = m.s
    if (m.active) {
      if (m.waitT > 0) m.waitT -= worldDt
      else {
        let ns = s + def.speed * worldDt
        for (const mark of c.marks) {
          if (s < mark && ns >= mark) {
            ns = mark
            m.waitT = def.wait ?? 0
            break
          }
        }
        if (ns >= 2 * c.len) ns -= 2 * c.len
        s = ns
      }
    }
    m.s = s
    pointAt(c, s, tmp)
    m.delta.subVectors(tmp, m.pos)
    m.pos.copy(tmp)
    m.body?.setNextKinematicTranslation({ x: tmp.x, y: tmp.y, z: tmp.z })
  })
}

export function timedPhase(i: number) {
  const d = rt.level!.timed[i]
  const t = (((rt.worldTime - d.offset) % d.period) + d.period) % d.period
  return { on: t < d.onTime, t, warn: t < d.onTime && t > d.onTime - 0.55 }
}

export function updateTimed() {
  rt.level!.timed.forEach((_, i) => {
    const { on } = timedPhase(i)
    if (on !== rt.timedOn[i]) {
      rt.timedOn[i] = on
      rt.timedColliders[i]?.setEnabled(on)
    }
  })
}

// ---------------- interactables ----------------
function horizDist(a: THREE.Vector3, x: number, z: number) {
  return Math.hypot(a.x - x, a.z - z)
}

export function updateInteractables(dt: number) {
  const L = rt.level!
  const p = rt.player
  const store = useGame.getState()
  if (p.dead) return
  const feetY = p.pos.y - P.feet

  // cores
  L.cores.forEach((c, i) => {
    if (rt.coresTaken[i]) return
    tmp.set(c[0], c[1], c[2])
    if (tmp.distanceTo(p.pos) < 1.4) {
      rt.coresTaken[i] = true
      rt.stats.cores++
      p.energy = Math.min(P.maxEnergy, p.energy + 20)
      sfx.core()
      burst(tmp, COLORS.objective, { count: 30, speed: 6, life: 0.6 })
      shockwave(tmp, COLORS.objective, 2)
      addCombo(100)
      const need = L.coresRequired
      if (need > 0 && rt.stats.cores === need) store.toast('CORE QUOTA MET', COLORS.objective, 'The exit is unlocking')
    }
  })
  // secrets
  L.secrets.forEach((c, i) => {
    if (rt.secretsTaken[i]) return
    tmp.set(c[0], c[1], c[2])
    if (tmp.distanceTo(p.pos) < 1.5) {
      rt.secretsTaken[i] = true
      rt.stats.secrets++
      sfx.secret()
      burst(tmp, COLORS.secret, { count: 50, speed: 7, life: 0.9 })
      shockwave(tmp, COLORS.secret, 3)
      addCombo(300)
      store.toast('SECRET RIFT SHARD', COLORS.secret, '+1500 bonus')
    }
  })
  // ability modules
  L.pickups.forEach((c, i) => {
    if (rt.pickupsTaken[i] || store.progress.abilities[c.ability]) return
    tmp.set(c.pos[0], c.pos[1], c.pos[2])
    if (tmp.distanceTo(p.pos) < 1.6) {
      rt.pickupsTaken[i] = true
      store.unlockAbility(c.ability)
      sfx.secret()
      burst(tmp, COLORS.safe, { count: 60, speed: 8, life: 1 })
      shockwave(tmp, COLORS.safe, 4)
      store.toast('ABILITY UNLOCKED: DOUBLE JUMP', COLORS.safe, 'Press SPACE again in mid-air')
    }
  })
  // checkpoints
  L.checkpoints.forEach((c, i) => {
    if (rt.checkpointsHit[i]) return
    if (horizDist(p.pos, c[0], c[2]) < 2.2 && Math.abs(feetY - c[1]) < 2.5) {
      rt.checkpointsHit[i] = true
      rt.checkpoint.set(c[0], c[1] + P.feet + 0.1, c[2])
      rt.checkpointIdx = i
      p.health = p.maxHealth
      sfx.checkpoint()
      tmp.set(c[0], c[1] + 1.5, c[2])
      burst(tmp, COLORS.checkpoint, { count: 40, speed: 5, life: 0.9 })
      shockwave(tmp, COLORS.checkpoint, 3.5)
      store.toast('CHECKPOINT', COLORS.checkpoint, 'Integrity restored')
    }
  })
  // health pads
  L.healthPads.forEach((c, i) => {
    rt.healthPadCd[i] = Math.max(0, rt.healthPadCd[i] - dt)
    if (rt.healthPadCd[i] > 0 || p.health >= p.maxHealth) return
    if (horizDist(p.pos, c[0], c[2]) < 1.4 && Math.abs(feetY - c[1]) < 1.2) {
      p.health = Math.min(p.maxHealth, p.health + 45)
      rt.healthPadCd[i] = 14
      sfx.heal()
      tmp.set(c[0], c[1] + 0.5, c[2])
      burst(tmp, COLORS.checkpoint, { count: 30, speed: 4, life: 0.8, dir: new THREE.Vector3(0, 1, 0), spread: 0.6 })
    }
  })
  // jump pads
  for (const j of L.jumpPads) {
    if (horizDist(p.pos, j.pos[0], j.pos[2]) < 1.4 && feetY - j.pos[1] < 0.5 && feetY - j.pos[1] > -0.3 && p.vel.y <= 1) {
      p.vel.y = j.power
      p.grounded = false
      p.jumpsUsed = 1
      p.airDashUsed = false
      p.grappling = false
      sfx.jumpPad()
      tmp.set(j.pos[0], j.pos[1] + 0.3, j.pos[2])
      burst(tmp, COLORS.safe, { count: 24, speed: 6, life: 0.5, dir: new THREE.Vector3(0, 1, 0), spread: 0.5 })
      addCombo(20)
    }
  }
  // pressure plates
  for (const pl of L.plates) {
    const [w, d] = pl.size ?? [2, 2]
    let pressed =
      Math.abs(p.pos.x - pl.pos[0]) < w / 2 + 0.2 &&
      Math.abs(p.pos.z - pl.pos[2]) < d / 2 + 0.2 &&
      feetY > pl.pos[1] - 0.3 &&
      feetY < pl.pos[1] + 0.5
    if (!pressed) {
      for (const c of rt.cubes) {
        if (!c.body) continue
        const t = c.body.translation()
        if (Math.abs(t.x - pl.pos[0]) < w / 2 + 0.5 && Math.abs(t.z - pl.pos[2]) < d / 2 + 0.5 && Math.abs(t.y - pl.pos[1] - 0.8) < 0.6) {
          pressed = true
          break
        }
      }
    }
    if (pressed !== rt.plates[pl.id]) {
      rt.plates[pl.id] = pressed
      sfx.plate()
    }
  }
  // gates
  for (const g of L.gates) {
    const r = g.requires
    const open =
      (r.cores == null || rt.stats.cores >= r.cores) &&
      (r.switch == null || !!rt.switches[r.switch]) &&
      (r.plate == null || !!rt.plates[r.plate])
    if (open !== rt.gates[g.id]) {
      rt.gates[g.id] = open
      rt.gateColliders[g.id]?.setEnabled(!open)
      tmp.set(...g.pos)
      if (open) {
        sfx.gate()
        burst(tmp, KEY_COLORS[g.color], { count: 50, speed: 5, life: 0.8, jitter: 3 })
        if (g.color !== 'core') store.toast(`${g.color.toUpperCase()} DOOR OPEN`, KEY_COLORS[g.color])
      }
    }
  }
  // cubes that fell off
  for (const c of rt.cubes) {
    if (!c.body) continue
    if (c.body.translation().y < L.killY) {
      c.body.setTranslation({ x: c.home.x, y: c.home.y + 0.5, z: c.home.z }, true)
      c.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
  }
  // hints
  let hint = ''
  let best = Infinity
  for (const h of L.hints) {
    const d = horizDist(p.pos, h.pos[0], h.pos[2])
    if (d < h.radius && Math.abs(feetY - h.pos[1]) < 4 && d < best) {
      best = d
      hint = h.text
    }
  }
  rt.ui.hint = hint
}

// ---------------- hazards ----------------
export function updateHazards(dt: number, worldDt: number) {
  const L = rt.level!
  const p = rt.player
  if (p.dead) return
  p.hazardTick = Math.max(0, p.hazardTick - dt)
  for (const h of L.hazards) {
    if (!playerInBox(h.pos, h.size, -0.05)) continue
    if (h.bounce) {
      if (p.vel.y < h.bounce * 0.6) {
        damagePlayer(h.dps * 0.45)
        p.vel.y = h.bounce
        p.grounded = false
        p.jumpsUsed = 1
        p.airDashUsed = false
        p.grappling = false
        addShake(0.25)
        tmp.set(p.pos.x, h.pos[1] + h.size[1] / 2, p.pos.z)
        burst(tmp, L.theme.hazard ?? '#ff5a1f', { count: 30, speed: 7, life: 0.7, dir: new THREE.Vector3(0, 1, 0), spread: 0.7, gravity: -12 })
      }
    } else if (p.hazardTick <= 0) {
      p.hazardTick = 0.25
      damagePlayer(h.dps * 0.25, undefined, 0, true)
    }
  }
  // surges (chase walls)
  L.surges.forEach((s, i) => {
    const st = rt.surges[i]
    if (!st.triggered) {
      if (st.t < 1 && playerInBox(s.trigger.pos, s.trigger.size)) {
        st.triggered = true
        sfx.boss()
        addShake(0.4)
        useGame.getState().toast('FURNACE SURGE', '#ff7a1a', 'RUN!')
      }
      return
    }
    tmp.set(...s.to)
    const remaining = tmp.distanceTo(st.pos)
    const step = s.speed * worldDt
    if (remaining <= step) {
      st.pos.copy(tmp)
      st.triggered = false
      st.t = 1 // spent
      return
    }
    tmp2.subVectors(tmp, st.pos).normalize()
    st.pos.addScaledVector(tmp2, step)
    if (playerInBox(st.pos, s.size) && p.hazardTick <= 0) {
      p.hazardTick = 0.25
      damagePlayer(s.dps * 0.25, undefined, 0, true)
      p.vel.addScaledVector(tmp2, 4)
    }
  })
}

// ---------------- lasers ----------------
const playerBot = new THREE.Vector3()
const playerTop = new THREE.Vector3()
let laserSfxT = 0
export function updateLasers(dt: number) {
  laserSfxT -= dt
  playerSegment(playerBot, playerTop)
  for (const l of rt.lasers) {
    if (!l.enabled) continue
    if (l.rotSpeed) {
      const a = rt.worldTime * l.rotSpeed
      const c = Math.cos(a)
      const s = Math.sin(a)
      l.dir.set(l.baseDir.x * c - l.baseDir.z * s, 0, l.baseDir.x * s + l.baseDir.z * c)
    }
    const hit = rayDist(l.origin, l.dir, l.baseLen)
    l.len = hit ?? l.baseLen
    if (rt.player.dead) continue
    segA.copy(l.origin)
    segB.copy(l.origin).addScaledVector(l.dir, l.len)
    if (segSegDist(segA, segB, playerBot, playerTop) < P.radius + 0.1) {
      // knock the player out of the beam, sideways
      const t = THREE.MathUtils.clamp(tmp.subVectors(rt.player.pos, segA).dot(l.dir), 0, l.len)
      tmp2.copy(segA).addScaledVector(l.dir, t)
      if (rt.player.invuln <= 0 && rt.player.shieldT <= 0 && laserSfxT <= 0) {
        sfx.laser()
        laserSfxT = 0.3
      }
      damagePlayer(l.damage, tmp2, 7)
    }
  }
}

// ---------------- portal ----------------
export function portalOpen() {
  const L = rt.level!
  return rt.stats.cores >= L.coresRequired && (!rt.boss || (rt.boss.phase === 5 && !rt.boss.active))
}

export function checkPortal() {
  if (rt.completed || rt.player.dead) return false
  if (!portalOpen()) return false
  const c = rt.level!.portal
  tmp.set(c[0], c[1] + 1.6, c[2])
  return tmp.distanceTo(rt.player.pos) < 2
}
