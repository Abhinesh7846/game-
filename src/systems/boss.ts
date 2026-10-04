import * as THREE from 'three'
import { rt, spawnEnemy } from '../game/runtime'
import { sfx, setMusic } from '../game/audio'
import { useGame } from '../game/store'
import { COLORS } from '../game/constants'
import { addCombo, damagePlayer } from './combat'
import { fireProjectile } from './enemies'
import { addShake, burst, explosion, shockwave } from './fx'

/** HP per phase. Phase 4's pool is the exposed weak point. */
export const PHASE_HP = [0, 260, 200, 240, 200]
export const PHASE_LABEL = ['', 'BARRAGE', 'DRONE SWARM', 'LASER WALLS', 'CORE EXPOSED']

const toP = new THREE.Vector3()
const tmp = new THREE.Vector3()
const vel = new THREE.Vector3()

function volley(count: number, spread: number, speed: number, dmg: number) {
  const b = rt.boss!
  const p = rt.player
  toP.subVectors(p.pos, b.pos).normalize()
  const baseYaw = Math.atan2(toP.x, toP.z)
  const pitch = Math.asin(THREE.MathUtils.clamp(toP.y, -1, 1))
  for (let i = 0; i < count; i++) {
    const yaw = baseYaw + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread)
    vel.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(speed)
    tmp.copy(b.pos).addScaledVector(vel, 2.6 / speed)
    fireProjectile(tmp, vel, dmg, { boss: true, radius: 0.42 })
  }
  sfx.enemyShoot()
}

function ring(count: number, speed: number, dmg: number) {
  const b = rt.boss!
  const off = Math.random() * Math.PI
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + off
    vel.set(Math.cos(a) * speed, 0, Math.sin(a) * speed)
    tmp.set(b.pos.x + Math.cos(a) * 2.5, 1.1, b.pos.z + Math.sin(a) * 2.5)
    fireProjectile(tmp, vel, dmg, { boss: true, radius: 0.5, life: 4 })
  }
  shockwave(new THREE.Vector3(b.pos.x, 1.1, b.pos.z), '#ff9a2e', 5)
  sfx.charge()
}

function enterPhase(n: number) {
  const b = rt.boss!
  const store = useGame.getState()
  b.phase = n
  b.hp = PHASE_HP[n] ?? 1
  b.maxHp = b.hp
  b.attackT = 2.2
  b.ringT = 5
  addShake(0.5)
  sfx.boss()
  explosion(b.pos, '#ff9a2e', 1.2)
  rt.lasers.forEach((l) => {
    if (l.boss) l.enabled = n === 3 || (n === 4 && l === rt.lasers.find((x) => x.boss))
  })
  rt.anchors.forEach((a) => {
    if (a.boss) a.active = n === 4
  })
  if (n === 2) {
    b.shield = true
    b.waveSpawned = true
    const kinds = ['scout', 'scout', 'scout', 'blaster', 'blaster'] as const
    kinds.forEach((k, i) => {
      const a = (i / kinds.length) * Math.PI * 2
      const pos = new THREE.Vector3(b.pos.x + Math.cos(a) * 9, 4.5, b.pos.z + Math.sin(a) * 9)
      const e = spawnEnemy(k, pos, undefined, true)
      e.aggro = true
      rt.enemiesTotal++
      burst(pos, COLORS.danger, { count: 20, speed: 5, life: 0.5 })
    })
    store.toast('PHASE 2 — DRONE SWARM', COLORS.danger, 'Destroy the drones to break its shield')
  } else if (n === 3) {
    store.toast('PHASE 3 — LASER WALLS', COLORS.danger, 'Jump the low beams. Pillars block lasers.')
  } else if (n === 4) {
    store.toast('PHASE 4 — CORE EXPOSED', COLORS.objective, 'Grapple to the floating anchors and blast the core!')
  }
}

export function updateBoss(dt: number, worldDt: number) {
  const b = rt.boss
  if (!b) return
  const p = rt.player
  const store = useGame.getState()
  b.hitFlash = Math.max(0, b.hitFlash - dt)

  if (b.phase === 0) {
    const hd = Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z)
    if (hd < 24 && !p.dead) {
      b.active = true
      b.intro = 2.2
      rt.enemiesTotal++
      enterPhase(1)
      setMusic('boss')
      store.toast('THE SENTINEL AWAKENS', COLORS.danger, 'Phase 1 — Barrage')
    }
    return
  }

  if (b.phase === 5) {
    if (b.deathT > 0) {
      b.deathT -= dt
      if (Math.random() < 0.35) {
        tmp.set(b.pos.x + (Math.random() - 0.5) * 5, b.pos.y + (Math.random() - 0.5) * 5, b.pos.z + (Math.random() - 0.5) * 5)
        explosion(tmp, Math.random() < 0.5 ? '#ff9a2e' : COLORS.danger, 0.8)
        sfx.explode()
        addShake(0.15)
      }
      if (b.deathT <= 0) {
        explosion(b.pos, '#ffffff', 3)
        explosion(b.pos, COLORS.objective, 2.5)
        sfx.bigExplode()
        addShake(1)
        b.active = false
        store.toast('SENTINEL DESTROYED', COLORS.objective, 'Extraction portal is open')
        setMusic('level')
      }
    }
    return
  }

  // ---- movement
  b.orbit += worldDt * 0.35
  const c = rt.level!.boss!.pos
  switch (b.phase) {
    case 1:
      b.target.set(c[0] + Math.cos(b.orbit) * 5, 4.5 + Math.sin(b.orbit * 2) * 0.6, c[2] + Math.sin(b.orbit) * 5)
      break
    case 2:
      b.target.set(c[0], b.shield ? 9 : 5, c[2])
      break
    case 3:
      b.target.set(c[0] + Math.cos(b.orbit) * 2, 5.2, c[2] + Math.sin(b.orbit) * 2)
      break
    case 4:
      b.target.set(c[0], 12 + Math.sin(b.orbit * 3) * 0.4, c[2])
      break
  }
  b.pos.lerp(b.target, 1 - Math.exp(-1.6 * worldDt))
  b.open += ((b.phase === 4 ? 1 : 0) - b.open) * (1 - Math.exp(-2 * dt))

  if (b.intro > 0) {
    b.intro -= dt
    return
  }

  // ---- attacks
  b.attackT -= worldDt
  b.ringT -= worldDt
  if (!p.dead) {
    if (b.phase === 1) {
      if (b.attackT <= 0) {
        volley(5, 0.7, 14, 12)
        b.attackT = 2.1
      }
      if (b.ringT <= 0) {
        ring(16, 9, 14)
        b.ringT = 6
      }
    } else if (b.phase === 2) {
      if (b.attackT <= 0) {
        volley(3, 0.4, 12, 10)
        b.attackT = 3.4
      }
      if (b.shield && !rt.enemies.some((e) => e.fromBoss && e.alive)) {
        b.shield = false
        sfx.gate()
        shockwave(b.pos, COLORS.safe, 8)
        store.toast('SHIELD DOWN', COLORS.safe, 'Hit it now!')
      }
    } else if (b.phase === 3) {
      if (b.attackT <= 0) {
        volley(3, 0.5, 13, 11)
        b.attackT = 2.8
      }
    } else if (b.phase === 4) {
      if (b.attackT <= 0) {
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2
          vel.set(Math.cos(a) * 6, 3, Math.sin(a) * 6)
          tmp.copy(b.pos).addScaledVector(vel, 0.4)
          fireProjectile(tmp, vel, 14, { boss: true, homing: 1.3, radius: 0.5, life: 6 })
        }
        sfx.enemyShoot()
        b.attackT = 2.4
      }
      if (b.ringT <= 0) {
        ring(12, 8, 12)
        b.ringT = 7
      }
    }
  }

  // ---- contact damage (it's a big spiky thing)
  if (!p.dead && p.pos.distanceTo(b.pos) < 3.3) damagePlayer(16, b.pos, 14)

  // ---- phase transitions
  if (b.hp <= 0) {
    if (b.phase < 4) enterPhase(b.phase + 1)
    else {
      b.phase = 5
      b.deathT = 2.4
      rt.lasers.forEach((l) => l.boss && (l.enabled = false))
      for (const e of rt.enemies) if (e.alive && e.fromBoss) e.alive = false
      rt.projectiles.forEach((pr) => (pr.alive = false))
      addCombo(1000)
      rt.stats.kills++
      sfx.bigExplode()
    }
  }
}
