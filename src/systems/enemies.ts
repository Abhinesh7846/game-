import * as THREE from 'three'
import { rt, type Enemy } from '../game/runtime'
import type { EnemyType } from '../game/types'
import { sfx } from '../game/audio'
import { damagePlayer } from './combat'
import { lineOfSight, rayDist } from './physics'
import { burst } from './fx'

const AGGRO: Record<EnemyType, number> = { scout: 15, blaster: 24, shield: 20, hunter: 32, target: 0 }
const CONTACT: Record<EnemyType, number> = { scout: 9, blaster: 6, shield: 6, hunter: 16, target: 0 }
const STEER: Record<EnemyType, number> = { scout: 4.5, blaster: 2.5, shield: 2, hunter: 3.2, target: 3 }

const toP = new THREE.Vector3()
const desired = new THREE.Vector3()
const tmp = new THREE.Vector3()
const aimPos = new THREE.Vector3()
const fromV = new THREE.Vector3()

// ---------------- projectiles ----------------
export function fireProjectile(
  from: THREE.Vector3,
  vel: THREE.Vector3,
  damage: number,
  opts: { boss?: boolean; homing?: number; radius?: number; life?: number } = {},
) {
  const pr = rt.projectiles.find((x) => !x.alive)
  if (!pr) return
  pr.alive = true
  pr.pos.copy(from)
  pr.vel.copy(vel)
  pr.damage = damage
  pr.boss = !!opts.boss
  pr.homing = opts.homing ?? 0
  pr.radius = opts.radius ?? 0.3
  pr.life = opts.life ?? 5
}

const step = new THREE.Vector3()
export function updateProjectiles(worldDt: number) {
  const p = rt.player
  for (const pr of rt.projectiles) {
    if (!pr.alive) continue
    pr.life -= worldDt
    if (pr.life <= 0) {
      pr.alive = false
      continue
    }
    if (pr.homing > 0 && !p.dead) {
      const sp = pr.vel.length()
      desired.subVectors(p.pos, pr.pos).normalize().multiplyScalar(sp)
      pr.vel.lerp(desired, Math.min(1, pr.homing * worldDt)).setLength(sp)
    }
    step.copy(pr.vel).multiplyScalar(worldDt)
    const len = step.length()
    if (len > 0) {
      tmp.copy(step).divideScalar(len)
      const hit = rayDist(pr.pos, tmp, len + pr.radius * 0.5)
      if (hit != null) {
        pr.alive = false
        burst(pr.pos, pr.boss ? '#ff9a2e' : '#ff3355', { count: 8, speed: 4, life: 0.3 })
        continue
      }
    }
    pr.pos.add(step)
    if (p.dead) continue
    const d = pr.pos.distanceTo(p.pos)
    if (p.shieldT > 0 && d < 1.9) {
      pr.alive = false
      burst(pr.pos, '#36c8ff', { count: 10, speed: 5, life: 0.3 })
      continue
    }
    // capsule test: vertical segment of the player body
    const dy = THREE.MathUtils.clamp(pr.pos.y - p.pos.y, -0.5, 0.5)
    tmp.set(p.pos.x, p.pos.y + dy, p.pos.z)
    if (pr.pos.distanceTo(tmp) < pr.radius + 0.42) {
      pr.alive = false
      damagePlayer(pr.damage, pr.pos, 5)
    }
  }
}

// ---------------- drones ----------------
function shoot(e: Enemy, speed: number, damage: number, spread = 0) {
  const p = rt.player
  aimPos.copy(p.pos).addScaledVector(p.vel, 0.18)
  tmp.subVectors(aimPos, e.pos).normalize()
  if (spread) {
    tmp.x += (Math.random() - 0.5) * spread
    tmp.z += (Math.random() - 0.5) * spread
    tmp.normalize()
  }
  fromV.copy(e.pos).addScaledVector(tmp, 0.8)
  fireProjectile(fromV, tmp.multiplyScalar(speed), damage)
  sfx.enemyShoot()
}

export function updateEnemies(dt: number, worldDt: number) {
  const p = rt.player
  const shieldDrones = rt.enemies.filter((e) => e.alive && e.type === 'shield')

  for (const e of rt.enemies) {
    if (!e.alive) {
      e.deadTime += dt
      continue
    }
    e.hitFlash = Math.max(0, e.hitFlash - dt)
    e.contactCd -= worldDt
    e.phase += worldDt
    toP.subVectors(p.pos, e.pos)
    const dist = toP.length()

    // shield links
    e.shielded = e.type !== 'shield' && shieldDrones.some((s) => s.pos.distanceTo(e.pos) < 9)

    if (e.type !== 'target') {
      if (!e.aggro && !p.dead && dist < AGGRO[e.type] && lineOfSight(e.pos, p.pos)) {
        e.aggro = true
        if (e.type === 'blaster') e.fireCd = Math.max(e.fireCd, 0.9)
      } else if (e.aggro && !e.fromBoss && (dist > AGGRO[e.type] * 1.9 || p.dead)) e.aggro = false
    }

    desired.set(0, 0, 0)
    const bob = Math.sin(e.phase * 2) * 0.5
    switch (e.type) {
      case 'target':
        desired.subVectors(e.home, e.pos).multiplyScalar(3)
        desired.y += Math.cos(e.phase * 1.6) * 0.6
        break
      case 'scout': {
        if (e.aggro) {
          const cycle = e.phase % 3.2
          if (cycle > 2.5) {
            // dive attack
            desired.copy(toP).normalize().multiplyScalar(12)
          } else {
            const a = e.phase * 1.4 + e.id
            tmp.set(p.pos.x + Math.cos(a) * 5, p.pos.y + 2.2, p.pos.z + Math.sin(a) * 5)
            desired.subVectors(tmp, e.pos).multiplyScalar(1.8).clampLength(0, 9)
          }
        } else if (e.patrol.length) {
          const tgt = e.patrol[e.patrolIdx]
          desired.subVectors(tgt, e.pos)
          if (desired.length() < 0.8) e.patrolIdx = (e.patrolIdx + 1) % e.patrol.length
          desired.setLength(4)
          desired.y += bob
        } else desired.subVectors(e.home, e.pos).multiplyScalar(1.5)
        break
      }
      case 'blaster':
      case 'shield': {
        const keep = e.type === 'blaster' ? 10 : 7
        if (e.aggro) {
          tmp.copy(toP).setY(0)
          const hd = tmp.length() || 1
          tmp.divideScalar(hd)
          const radial = (hd - keep) * 1.2
          desired.copy(tmp).multiplyScalar(radial)
          // strafe
          desired.x += -tmp.z * Math.sin(e.phase * 0.9 + e.id) * 3
          desired.z += tmp.x * Math.sin(e.phase * 0.9 + e.id) * 3
          desired.y = (p.pos.y + 3.2 - e.pos.y) * 1.5 + bob
          // stay near home so they don't chase across the map
          tmp.subVectors(e.home, e.pos).setY(0)
          if (tmp.length() > 12) desired.addScaledVector(tmp, 0.6)
          desired.clampLength(0, 6)
          e.fireCd -= worldDt
          const charging = e.fireCd < 0.6
          if (charging && e.charge === 0) sfx.charge()
          e.charge = charging ? 1 - Math.max(0, e.fireCd) / 0.6 : 0
          if (e.fireCd <= 0) {
            if (lineOfSight(e.pos, p.pos) && !p.dead) {
              if (e.type === 'blaster') shoot(e, 14, 13)
              else shoot(e, 9, 8)
              e.fireCd = (e.type === 'blaster' ? 1.9 : 3.2) + Math.random() * 0.6
            } else e.fireCd = 0.8
            e.charge = 0
          }
        } else {
          desired.subVectors(e.home, e.pos).multiplyScalar(1.2)
          desired.y += bob
          e.charge = 0
        }
        break
      }
      case 'hunter': {
        if (e.aggro && !p.dead) {
          desired.copy(toP)
          desired.y += 0.4
          desired.setLength(e.contactCd > 0.4 ? -3 : 8)
        } else {
          desired.subVectors(e.home, e.pos).multiplyScalar(1.2)
          desired.y += bob
        }
        break
      }
    }

    e.vel.lerp(desired, 1 - Math.exp(-STEER[e.type] * worldDt))

    // avoid flying into walls
    const sp = e.vel.length()
    if (sp > 0.5) {
      tmp.copy(e.vel).divideScalar(sp)
      const hit = rayDist(e.pos, tmp, 1.4)
      if (hit != null) {
        e.vel.addScaledVector(tmp, -sp * 1.1)
        e.vel.y += 2
      }
    }
    // separation
    for (const o of rt.enemies) {
      if (o === e || !o.alive) continue
      tmp.subVectors(e.pos, o.pos)
      const d = tmp.length()
      if (d < 1.8 && d > 0.001) e.vel.addScaledVector(tmp.divideScalar(d), (1.8 - d) * 6 * worldDt)
    }
    e.pos.addScaledVector(e.vel, worldDt)
    e.facing = Math.atan2(toP.x, toP.z)

    // contact damage
    if (CONTACT[e.type] > 0 && dist < 1.35 && e.contactCd <= 0 && !p.dead) {
      damagePlayer(CONTACT[e.type], e.pos, e.type === 'hunter' ? 10 : 6)
      e.contactCd = 1.1
      e.vel.addScaledVector(toP.normalize(), -8)
    }
  }
}
