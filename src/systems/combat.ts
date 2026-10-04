import * as THREE from 'three'
import { rt, type Enemy } from '../game/runtime'
import { P, COLORS } from '../game/constants'
import { sfx } from '../game/audio'
import { useGame } from '../game/store'
import { addShake, burst, explosion, shockwave } from './fx'
import { lineOfSight } from './physics'

const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()

export function comboMultiplier() {
  return 1 + Math.min(4, Math.floor(rt.combo.count / 3) * 0.5)
}

/** Style/combat events feed the combo chain; points are scaled by the current multiplier. */
export function addCombo(points: number) {
  rt.combo.count++
  rt.combo.timer = 3.5
  rt.stats.maxCombo = Math.max(rt.stats.maxCombo, rt.combo.count)
  rt.stats.comboScore += points * comboMultiplier()
  if (rt.combo.count >= 3) sfx.combo(rt.combo.count)
}

export function breakCombo() {
  rt.combo.count = 0
  rt.combo.timer = 0
}

export function damagePlayer(amount: number, source?: THREE.Vector3, knock = 6, ignoreInvuln = false) {
  const p = rt.player
  if (p.dead || rt.completed) return
  if (!ignoreInvuln && p.invuln > 0) return
  if (p.shieldT > 0) {
    burst(p.pos, COLORS.safe, { count: 8, speed: 5, life: 0.3 })
    sfx.shielded()
    return
  }
  const dmg = amount * (rt.challenge ? 1.5 : 1)
  p.health -= dmg
  rt.stats.damageTaken += dmg
  p.invuln = P.hitInvuln
  rt.ui.damageFlash = 1
  breakCombo()
  addShake(0.35)
  sfx.hurt()
  burst(p.pos, COLORS.danger, { count: 12, speed: 6, life: 0.4 })
  if (source) {
    tmp.subVectors(p.pos, source).setY(0)
    if (tmp.lengthSq() > 0.0001) {
      tmp.normalize()
      p.vel.x += tmp.x * knock
      p.vel.z += tmp.z * knock
      p.vel.y = Math.max(p.vel.y, knock * 0.5)
    }
  }
  if (p.health <= 0) killPlayer('Core integrity failed')
}

export function killPlayer(reason: string) {
  const p = rt.player
  if (p.dead || rt.completed) return
  p.dead = true
  p.deathT = 1.5
  p.health = 0
  p.grappling = false
  rt.stats.deaths++
  rt.ui.deathReason = reason
  breakCombo()
  addShake(0.6)
  sfx.death()
  explosion(p.pos, useGame.getState().progress.trail === 'prism' ? '#ffffff' : COLORS.safe, 0.8)
}

export function respawn() {
  const p = rt.player
  p.dead = false
  p.pos.copy(rt.checkpoint)
  p.vel.set(0, 0, 0)
  p.health = p.maxHealth
  p.energy = Math.max(p.energy, 60)
  p.invuln = 1.5
  p.grappling = false
  p.dashT = 0
  p.wallRunning = false
  p.jumpsUsed = 0
  const body = rt.refs.body
  if (body) {
    body.setTranslation({ x: p.pos.x, y: p.pos.y, z: p.pos.z }, true)
    body.setNextKinematicTranslation({ x: p.pos.x, y: p.pos.y, z: p.pos.z })
  }
  // reset chase hazards + chasers so a retry is fair
  rt.level!.surges.forEach((s, i) => {
    rt.surges[i].triggered = false
    rt.surges[i].pos.set(s.from[0], s.from[1], s.from[2])
  })
  for (const e of rt.enemies) {
    if (e.alive && e.type === 'hunter') {
      e.pos.copy(e.home)
      e.vel.set(0, 0, 0)
      e.aggro = false
    }
  }
  for (const pr of rt.projectiles) pr.alive = false
  burst(p.pos, COLORS.checkpoint, { count: 30, speed: 5, life: 0.8 })
  shockwave(p.pos, COLORS.checkpoint, 3)
}

export function damageEnemy(e: Enemy, amount: number, from?: THREE.Vector3) {
  if (!e.alive) return
  if (e.shielded) {
    burst(e.pos, COLORS.safe, { count: 6, speed: 4, life: 0.25 })
    sfx.shielded()
    e.hitFlash = 0.15
    return
  }
  e.hp -= amount
  e.hitFlash = 0.18
  rt.ui.hitMarker = 1
  sfx.enemyHit()
  if (from) {
    tmp.subVectors(e.pos, from).normalize()
    e.vel.addScaledVector(tmp, e.type === 'shield' ? 4 : 9)
  }
  burst(e.pos, '#ffffff', { count: 6, speed: 6, life: 0.25, size: 0.25 })
  if (e.hp <= 0) killEnemy(e)
}

export function killEnemy(e: Enemy) {
  e.alive = false
  e.deadTime = 0
  rt.stats.kills++
  addCombo(250)
  explosion(e.pos, e.type === 'shield' ? '#7fd8ff' : COLORS.danger, e.type === 'scout' || e.type === 'target' ? 0.7 : 1)
  addShake(0.2)
  sfx.explode()
  rt.player.energy = Math.min(P.maxEnergy, rt.player.energy + 8)
}

const switchCd: Record<string, number> = {}

/** Switches latch on — a stray pulse mid-fight should never re-lock a door. */
export function toggleSwitch(id: string) {
  const now = performance.now()
  if (rt.switches[id] || (switchCd[id] && now - switchCd[id] < 500)) return
  switchCd[id] = now
  rt.switches[id] = true
  addCombo(40)
  sfx.switch()
  const def = rt.level!.switches.find((s) => s.id === id)
  if (def) burst(new THREE.Vector3(def.pos[0], def.pos[1] + 1.2, def.pos[2]), '#ffffff', { count: 16, speed: 4, life: 0.4 })
}

/** Closest point on an AABB to p. */
function closestOnBox(p: THREE.Vector3, c: number[], s: number[], out: THREE.Vector3) {
  out.set(
    THREE.MathUtils.clamp(p.x, c[0] - s[0] / 2, c[0] + s[0] / 2),
    THREE.MathUtils.clamp(p.y, c[1] - s[1] / 2, c[1] + s[1] / 2),
    THREE.MathUtils.clamp(p.z, c[2] - s[2] / 2, c[2] + s[2] / 2),
  )
  return out
}

export function damageBoss(amount: number) {
  const b = rt.boss
  if (!b || !b.active || b.phase < 1 || b.phase > 4) return false
  if (b.shield) {
    sfx.shielded()
    burst(b.pos, COLORS.safe, { count: 10, speed: 6, life: 0.3 })
    return false
  }
  b.hp -= amount
  b.hitFlash = 0.2
  rt.ui.hitMarker = 1
  sfx.enemyHit()
  addCombo(60)
  burst(b.pos, '#ffd23f', { count: 14, speed: 9, life: 0.4 })
  return true
}

export function firePulse(aim: THREE.Vector3) {
  const p = rt.player
  if (p.pulseCd > 0 || p.dead) return
  if (p.energy < P.pulseCost) {
    sfx.denied()
    return
  }
  p.energy -= P.pulseCost
  p.pulseCd = P.pulseCooldown
  p.pulseAnim = 0.3
  sfx.pulse()
  addShake(0.1)
  const origin = tmp2.copy(p.pos).addScaledVector(aim, 0.8)
  shockwave(origin, COLORS.safe, P.pulseRange * 0.8, 0.35)
  burst(origin, COLORS.safe, { count: 26, speed: 14, life: 0.3, dir: aim, spread: 0.55, size: 0.3 })

  const inCone = (target: THREE.Vector3, range: number) => {
    tmp.subVectors(target, p.pos)
    const d = tmp.length()
    if (d > range) return false
    if (d < 2.8) return true
    return tmp.divideScalar(d).dot(aim) > 0.3
  }

  for (const e of rt.enemies) {
    if (!e.alive) continue
    if (inCone(e.pos, P.pulseRange + 0.6) && lineOfSight(p.pos, e.pos)) damageEnemy(e, P.pulseDamage, p.pos)
  }
  const b = rt.boss
  if (b && b.active && b.phase >= 1 && b.phase <= 4 && p.pos.distanceTo(b.pos) < 10.5) damageBoss(26)

  const L = rt.level!
  L.crystals.forEach((c, i) => {
    const st = rt.crystals[i]
    if (st.broken) return
    const cp = closestOnBox(p.pos, c.pos, c.size, new THREE.Vector3())
    if (inCone(cp, P.pulseRange)) {
      st.broken = true
      st.collider?.setEnabled(false)
      const center = new THREE.Vector3(...c.pos)
      burst(center, '#bfefff', { count: 60, speed: 8, life: 1, size: 0.45, gravity: -14, jitter: 2 })
      shockwave(center, '#bfefff', 3)
      sfx.explode()
      addCombo(50)
    }
  })
  for (const s of L.switches) {
    const sp = new THREE.Vector3(s.pos[0], s.pos[1] + 1.45, s.pos[2]) // the crystal above the pillar collider
    if (inCone(sp, P.pulseRange) && lineOfSight(p.pos, sp)) toggleSwitch(s.id)
  }
  for (const pr of rt.projectiles) {
    if (pr.alive && inCone(pr.pos, 5.5)) {
      pr.alive = false
      burst(pr.pos, COLORS.safe, { count: 8, speed: 5, life: 0.3 })
      addCombo(20)
    }
  }
}

export function fireShield() {
  const p = rt.player
  if (!useGame.getState().progress.abilities.shield || p.shieldCd > 0 || p.dead) return
  if (p.energy < P.shieldCost) return sfx.denied()
  p.energy -= P.shieldCost
  p.shieldT = P.shieldTime
  p.shieldCd = P.shieldCooldown
  sfx.shield()
  shockwave(p.pos, COLORS.safe, 6, 0.5)
  for (const e of rt.enemies) {
    if (!e.alive) continue
    tmp.subVectors(e.pos, p.pos)
    const d = tmp.length()
    if (d < 6) {
      e.vel.addScaledVector(tmp.normalize(), 16)
      damageEnemy(e, 10)
    }
  }
}

export function fireSlow() {
  const p = rt.player
  if (!useGame.getState().progress.abilities.slowField || p.slowCd > 0 || p.dead) return
  if (p.energy < P.slowCost) return sfx.denied()
  p.energy -= P.slowCost
  p.slowT = P.slowTime
  p.slowCd = P.slowCooldown
  sfx.slow()
  shockwave(p.pos, COLORS.secret, 14, 0.8)
}
