import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { rt } from '../game/runtime'
import { P, COLORS, TRAILS } from '../game/constants'
import { input } from '../game/input'
import { sfx } from '../game/audio'
import { useGame } from '../game/store'
import { addCombo, fireShield, firePulse, fireSlow, killPlayer, respawn, toggleSwitch } from './combat'
import { addShake, burst } from './fx'
import { lineOfSight, phys, rayHit } from './physics'

const fwd = new THREE.Vector3()
const right = new THREE.Vector3()
const wish = new THREE.Vector3()
const aim = new THREE.Vector3()
const tmp = new THREE.Vector3()
const carry = new THREE.Vector3()
const down = new THREE.Vector3(0, -1, 0)
const probe = new THREE.Vector3()

export function trailColor() {
  const id = useGame.getState().progress.trail
  return TRAILS.find((t) => t.id === id)?.color ?? COLORS.safe
}

/** Camera-space aim direction (what the crosshair points at). */
export function getAim(out: THREE.Vector3) {
  const p = rt.player
  return out.set(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)).normalize()
}

function nearSwitch(): string | null {
  const p = rt.player
  for (const s of rt.level!.switches) {
    if (rt.switches[s.id]) continue
    const dx = p.pos.x - s.pos[0]
    const dz = p.pos.z - s.pos[2]
    const dy = p.pos.y - (s.pos[1] + 0.9)
    if (dx * dx + dz * dz < 2.8 * 2.8 && Math.abs(dy) < 2) return s.id
  }
  return null
}

function findGrappleTarget(camPos: THREE.Vector3) {
  const p = rt.player
  getAim(aim)
  let best = -1
  let bestScore = 0.42
  rt.anchors.forEach((a, i) => {
    if (!a.active) return
    const d = a.pos.distanceTo(p.pos)
    if (d > P.grappleRange || d < 2.5) return
    tmp.subVectors(a.pos, camPos).normalize()
    const ang = Math.acos(THREE.MathUtils.clamp(tmp.dot(aim), -1, 1))
    if (ang < bestScore && lineOfSight(p.pos, a.pos)) {
      bestScore = ang
      best = i
    }
  })
  return best
}

export function updatePlayer(dt: number, ctrl: RAPIER.KinematicCharacterController, camera: THREE.PerspectiveCamera) {
  const p = rt.player
  const st = useGame.getState()
  const ab = st.progress.abilities
  const collider = rt.refs.collider
  const body = rt.refs.body
  if (!collider || !body) return

  p.dashCd = Math.max(0, p.dashCd - dt)
  p.grappleCd = Math.max(0, p.grappleCd - dt)
  p.pulseCd = Math.max(0, p.pulseCd - dt)
  p.shieldCd = Math.max(0, p.shieldCd - dt)
  p.slowCd = Math.max(0, p.slowCd - dt)
  p.shieldT = Math.max(0, p.shieldT - dt)
  p.slowT = Math.max(0, p.slowT - dt)
  p.invuln = Math.max(0, p.invuln - dt)
  p.pulseAnim = Math.max(0, p.pulseAnim - dt)
  p.landT = Math.max(0, p.landT - dt)
  p.wallRunLock = Math.max(0, p.wallRunLock - dt)

  // ---------------- look ----------------
  const { dx, dy } = input.takeMouse()
  const sens = 0.0022 * st.settings.sensitivity
  p.yaw -= dx * sens
  p.pitch -= dy * sens * (st.settings.invertY ? -1 : 1)
  p.pitch = THREE.MathUtils.clamp(p.pitch, -1.25, 0.95)

  if (p.dead) {
    p.deathT -= dt
    if (p.deathT <= 0) respawn()
    input.consume('Space')
    return
  }
  if (rt.completed) return
  if (input.consume('KeyR')) {
    killPlayer('Manual reset')
    return
  }

  // ---------------- intent ----------------
  fwd.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw))
  right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw))
  wish.set(0, 0, 0)
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) wish.add(fwd)
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) wish.sub(fwd)
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) wish.add(right)
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) wish.sub(right)
  if (wish.lengthSq() > 0) wish.normalize()

  if (input.consume('Space')) p.jumpBuffer = P.jumpBuffer
  else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt)
  p.coyote = Math.max(0, p.coyote - dt)

  // ---------------- abilities ----------------
  if (input.consume('Mouse0')) firePulse(getAim(aim))
  if (input.consume('KeyQ')) fireShield()
  if (input.consume('KeyF')) fireSlow()

  p.grappleCandidate = ab.grapple ? findGrappleTarget(camera.position) : -1
  const sw = nearSwitch()
  const wantInteract = input.consume('KeyE') || input.consume('Mouse2')
  if (wantInteract) {
    if (sw) toggleSwitch(sw)
    else if (p.grappling) p.grappling = false
    else if (p.grappleCandidate >= 0 && p.grappleCd <= 0) {
      if (p.energy >= P.grappleCost) {
        p.energy -= P.grappleCost
        p.grappling = true
        p.grappleT = 0
        p.dashT = 0
        p.grappleTarget.copy(rt.anchors[p.grappleCandidate].pos)
        p.wallRunning = false
        sfx.grapple()
      } else sfx.denied()
    }
  }
  rt.ui.prompt = sw ? '[E] ACTIVATE SWITCH' : ''

  const dashPressed = input.consume('ShiftLeft') || input.consume('ShiftRight')
  if (dashPressed && p.dashCd <= 0 && (p.grounded || !p.airDashUsed) && !p.grappling) {
    p.dashDir.copy(wish.lengthSq() > 0 ? wish : fwd)
    p.dashT = P.dashTime
    p.dashCd = P.dashCooldown
    if (!p.grounded) p.airDashUsed = true
    p.wallRunning = false
    sfx.dash()
    addShake(0.06)
    burst(p.pos, trailColor(), { count: 18, speed: 4, life: 0.4, dir: tmp.copy(p.dashDir).negate(), spread: 0.8 })
  }

  // ---------------- velocity ----------------
  const v = p.vel
  if (p.grappling) {
    p.grappleT += dt
    tmp.subVectors(p.grappleTarget, p.pos)
    const dist = tmp.length()
    const jumpRelease = p.jumpBuffer > 0
    if (dist < 2.2 || p.grappleT > P.grappleMaxTime || jumpRelease) {
      p.grappling = false
      p.grappleCd = P.grappleCooldown
      const sp = Math.min(17, v.length())
      v.setLength(sp)
      v.y = Math.max(v.y, 0) + 5
      if (jumpRelease) {
        v.y = Math.max(v.y, P.jumpVel)
        p.jumpBuffer = 0
      }
      p.jumpsUsed = 1
      p.airDashUsed = false
      addCombo(30)
    } else {
      tmp.divideScalar(dist).multiplyScalar(P.grappleSpeed)
      v.lerp(tmp, 1 - Math.exp(-7 * dt))
    }
  } else if (p.dashT > 0) {
    p.dashT -= dt
    v.set(p.dashDir.x * P.dashSpeed, 0, p.dashDir.z * P.dashSpeed)
    if (Math.random() < 0.8) burst(p.pos, trailColor(), { count: 2, speed: 1, life: 0.35, size: 0.4 })
    if (p.dashT <= 0) {
      const keep = P.runSpeed * 1.25
      v.x = p.dashDir.x * keep
      v.z = p.dashDir.z * keep
    }
  } else {
    // horizontal
    const hSpeed = Math.hypot(v.x, v.z)
    if (p.grounded) {
      const tx = wish.x * P.runSpeed
      const tz = wish.z * P.runSpeed
      const accel = wish.lengthSq() > 0 ? P.groundAccel : P.groundFriction * Math.max(hSpeed, 2)
      const ddx = tx - v.x
      const ddz = tz - v.z
      const dl = Math.hypot(ddx, ddz)
      const step = Math.min(dl, accel * dt)
      if (dl > 0) {
        v.x += (ddx / dl) * step
        v.z += (ddz / dl) * step
      }
    } else if (wish.lengthSq() > 0) {
      v.x += wish.x * P.airAccel * dt
      v.z += wish.z * P.airAccel * dt
      const cap = Math.max(P.runSpeed, hSpeed)
      const ns = Math.hypot(v.x, v.z)
      if (ns > cap) {
        v.x *= cap / ns
        v.z *= cap / ns
      }
    } else {
      // gentle air drag back toward run speed
      const ns = Math.hypot(v.x, v.z)
      if (ns > P.runSpeed) {
        const k = Math.max(P.runSpeed / ns, 1 - 1.5 * dt)
        v.x *= k
        v.z *= k
      }
    }

    // wall-run detection
    if (!p.grounded && p.wallRunLock <= 0) {
      const hs = Math.hypot(v.x, v.z)
      let wallN: { x: number; y: number; z: number } | null = null
      if (hs > P.wallRunMinSpeed) {
        tmp.set(v.x, 0, v.z).normalize()
        const side = new THREE.Vector3(-tmp.z, 0, tmp.x)
        for (const s of [1, -1]) {
          probe.copy(side).multiplyScalar(s)
          const h = rayHit(p.pos, probe, P.radius + 0.45)
          if (h && Math.abs(h.normal.y) < 0.25) {
            wallN = h.normal
            break
          }
        }
      }
      if (wallN && (input.isDown('KeyW') || p.wallRunning)) {
        if (!p.wallRunning) {
          p.wallRunning = true
          p.wallRunT = 0
          p.jumpsUsed = 1
          p.airDashUsed = false
          v.y = THREE.MathUtils.clamp(v.y, 2, 4) // a wall-run is a level glide, not a climb
          sfx.wallRun()
          addCombo(25)
        }
        p.wallNormal.set(wallN.x, 0, wallN.z).normalize()
        p.wallRunT += dt
        if (p.wallRunT > P.wallRunTime) {
          p.wallRunning = false
          p.wallRunLock = 0.4
        }
      } else if (p.wallRunning) {
        p.wallRunning = false
        p.wallRunLock = 0.2
      }
    } else p.wallRunning = false

    // vertical
    if (p.wallRunning) {
      v.y = Math.max(v.y - P.gravity * (v.y > 0 ? 0.35 : 0.2) * dt, -P.wallRunFall)
      v.addScaledVector(p.wallNormal, -2 * dt) // hug the wall
      if (Math.random() < 0.5) burst(p.pos, trailColor(), { count: 1, speed: 1, life: 0.3, size: 0.3 })
    } else {
      v.y = Math.max(v.y - P.gravity * dt, -P.maxFall)
    }

    // jumping
    if (p.jumpBuffer > 0) {
      if (p.wallRunning) {
        v.addScaledVector(p.wallNormal, P.wallJumpOut)
        v.y = P.wallJumpUp
        p.wallRunning = false
        p.wallRunLock = 0.35
        p.jumpBuffer = 0
        p.jumpsUsed = 1
        sfx.jump()
        addCombo(25)
      } else if (p.grounded || p.coyote > 0) {
        v.y = P.jumpVel
        p.jumpsUsed = 1
        p.coyote = 0
        p.grounded = false
        p.jumpBuffer = 0
        sfx.jump()
      } else if (ab.doubleJump && p.jumpsUsed < 2) {
        v.y = P.doubleJumpVel
        p.jumpsUsed = 2
        p.jumpBuffer = 0
        sfx.doubleJump()
        burst(tmp.copy(p.pos).setY(p.pos.y - 0.8), trailColor(), { count: 16, speed: 4, life: 0.4, dir: down, spread: 1.2 })
      }
    }
  }

  // ---------------- move through the world ----------------
  carry.set(0, 0, 0)
  if (p.grounded && p.groundCollider >= 0) {
    const m = rt.moverByCollider.get(p.groundCollider)
    if (m) carry.copy(m.delta)
  }
  // platform carry is applied outside the query: the mover hasn't stepped yet, so querying with it
  // would make a descending lift block the rider.
  const desired = { x: v.x * dt, y: v.y * dt, z: v.z * dt }
  ctrl.computeColliderMovement(collider, desired, phys.rapier!.QueryFilterFlags.EXCLUDE_SENSORS)
  const mv = ctrl.computedMovement()
  const wasGrounded = p.grounded
  const fallSpeed = v.y
  let grounded = ctrl.computedGrounded() && v.y <= 0.5

  for (let i = 0; i < ctrl.numComputedCollisions(); i++) {
    const c = ctrl.computedCollision(i)
    if (!c) continue
    const n = c.normal1
    if (n.y < -0.6 && v.y > 0) v.y = 0 // bonk
    if (Math.abs(n.y) < 0.35) {
      const into = v.x * n.x + v.z * n.z
      if (into < 0 && !p.grappling) {
        v.x -= n.x * into
        v.z -= n.z * into
      }
      // shove push-cubes
      const parent = c.collider?.parent()
      if (parent && parent.isDynamic()) {
        // cubes can't rotate, so push straight along the face axis we're touching
        const lv = parent.linvel()
        const push = Math.min(7.5, Math.max(2.5, -into))
        const alongX = Math.abs(n.x) > Math.abs(n.z)
        parent.setLinvel({ x: alongX ? -Math.sign(n.x) * push : 0, y: lv.y, z: alongX ? 0 : -Math.sign(n.z) * push }, true)
      }
    }
  }

  p.pos.set(p.pos.x + mv.x + carry.x, p.pos.y + mv.y + carry.y, p.pos.z + mv.z + carry.z)

  // Movers already hold this frame's target position. A rising platform can overlap the feet before the
  // controller sees it (and penetrating shapes are ignored), so land on movers explicitly.
  let moverLanding: number | null = null
  if (v.y <= 0.5 && !p.grappling) {
    rt.level!.movers.forEach((def, i) => {
      const m = rt.movers[i]
      const top = m.pos.y + def.size[1] / 2
      const feet = p.pos.y - P.feet
      if (
        Math.abs(p.pos.x - m.pos.x) < def.size[0] / 2 + 0.15 &&
        Math.abs(p.pos.z - m.pos.z) < def.size[2] / 2 + 0.15 &&
        feet > top - 0.6 &&
        feet < top + 0.06
      ) {
        p.pos.y = top + P.feet + 0.01
        moverLanding = i
      }
    })
  }
  body.setNextKinematicTranslation({ x: p.pos.x, y: p.pos.y, z: p.pos.z })

  // ground probe (which collider are we standing on?)
  const gh = rayHit(p.pos, down, P.feet + 0.25)
  if (!grounded && gh && v.y <= 0 && gh.dist < P.feet + 0.08) grounded = true
  p.groundCollider = grounded && gh ? gh.collider.handle : -1
  if (moverLanding !== null) {
    grounded = true
    const ms = rt.movers[moverLanding]
    for (const [handle, st] of rt.moverByCollider) if (st === ms) p.groundCollider = handle
  }

  if (grounded) {
    if (!wasGrounded) {
      p.landT = 0.18
      if (fallSpeed < -14) {
        addShake(0.08)
        sfx.land()
        burst(tmp.copy(p.pos).setY(p.pos.y - 0.85), '#9fb8ff', { count: 10, speed: 3, life: 0.35, size: 0.3 })
      }
    }
    v.y = Math.max(v.y, -1)
    p.jumpsUsed = 0
    p.airDashUsed = false
    p.coyote = P.coyote
    p.wallRunning = false
  }
  p.grounded = grounded

  const hs = Math.hypot(v.x, v.z)
  p.speed = hs
  if (grounded && hs > 3) sfx.step()

  // facing
  let targetFacing = p.facing
  if (p.pulseAnim > 0 || p.grappling) targetFacing = p.yaw
  else if (hs > 0.8) targetFacing = Math.atan2(-v.x, -v.z)
  let diff = targetFacing - p.facing
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  p.facing += diff * (1 - Math.exp(-14 * dt))

  // energy
  p.energy = Math.min(P.maxEnergy, p.energy + P.energyRegen * dt * (rt.challenge ? 0.6 : 1))

  if (p.pos.y < rt.level!.killY) killPlayer('Lost in the Rift')
}

// ---------------- camera ----------------
const pivot = new THREE.Vector3()
const camDir = new THREE.Vector3()
const desiredPos = new THREE.Vector3()
const shoulder = new THREE.Vector3()
let camDist = 5.5
let fovKick = 0

export function updateCamera(camera: THREE.PerspectiveCamera, dt: number, baseFov: number) {
  const p = rt.player
  pivot.set(p.pos.x, p.pos.y + 0.75, p.pos.z)
  getAim(camDir)
  shoulder.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw)).multiplyScalar(0.6)
  pivot.add(shoulder)
  const want = 5.5
  tmp.copy(camDir).negate()
  const hit = rayHit(pivot, tmp, want + 0.3)
  const allowed = hit ? Math.max(0.6, hit.dist - 0.35) : want
  camDist = allowed < camDist ? allowed : camDist + (allowed - camDist) * (1 - Math.exp(-6 * dt))
  desiredPos.copy(pivot).addScaledVector(camDir, -camDist)

  if (rt.shake > 0) {
    const s = rt.shake * rt.shake * 0.45
    desiredPos.x += (Math.random() - 0.5) * s
    desiredPos.y += (Math.random() - 0.5) * s
    desiredPos.z += (Math.random() - 0.5) * s
    rt.shake = Math.max(0, rt.shake - dt * 2.2)
  }
  camera.position.copy(desiredPos)
  tmp.copy(desiredPos).add(camDir)
  camera.lookAt(tmp)

  const kick = (p.dashT > 0 ? 12 : 0) + (p.grappling ? 8 : 0) + Math.max(0, Math.min(8, (p.speed - 10) * 1.2))
  fovKick += (kick - fovKick) * (1 - Math.exp(-8 * dt))
  const fov = baseFov + fovKick
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
}

export function resetCamera() {
  camDist = 5.5
  fovKick = 0
}
