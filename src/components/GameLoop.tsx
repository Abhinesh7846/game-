import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { rt } from '../game/runtime'
import { COLORS, P } from '../game/constants'
import { input, releaseLock } from '../game/input'
import { sfx } from '../game/audio'
import { useGame } from '../game/store'
import { computeResult } from '../game/scoring'
import { phys } from '../systems/physics'
import { updateCamera, updatePlayer } from '../systems/player'
import { checkPortal, updateHazards, updateInteractables, updateLasers, updateMovers, updateTimed } from '../systems/world'
import { updateEnemies, updateProjectiles } from '../systems/enemies'
import { updateBoss } from '../systems/boss'
import { buildHud, updateScreenMarkers } from '../systems/hud'
import { burst, shockwave } from '../systems/fx'

/**
 * The single ordered simulation step. Runs before the physics step each frame (child useFrames subscribe
 * before the <Physics> parent), so kinematic targets set here are consumed by this frame's step.
 */
export function GameLoop() {
  const { world, rapier } = useRapier()
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera

  const ctrl = useMemo(() => {
    const c = world.createCharacterController(0.03)
    c.setUp({ x: 0, y: 1, z: 0 })
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180)
    c.setMinSlopeSlideAngle((35 * Math.PI) / 180)
    c.enableAutostep(0.45, 0.25, false)
    c.enableSnapToGround(0.25)
    c.setSlideEnabled(true)
    c.setApplyImpulsesToDynamicBodies(false)
    return c
  }, [world])

  useEffect(() => {
    phys.world = world
    phys.rapier = rapier
    return () => {
      world.removeCharacterController(ctrl)
      if (phys.world === world) {
        phys.world = null
      }
    }
  }, [world, rapier, ctrl])

  useFrame((_, delta) => {
    const st = useGame.getState()
    rt.running = st.screen === 'playing'
    if (!rt.running || !rt.refs.collider) {
      input.takeMouse()
      return
    }
    const dt = Math.min(delta, 1 / 30)
    const p = rt.player

    rt.worldScale = p.slowT > 0 ? P.slowScale : 1
    const wdt = dt * rt.worldScale
    rt.worldTime += wdt
    if (!rt.completed) rt.time += dt

    updateMovers(wdt)
    updateTimed()
    updatePlayer(dt, ctrl, camera)
    if (!rt.completed) {
      updateInteractables(dt)
      updateHazards(dt, wdt)
      updateLasers(dt)
      updateEnemies(dt, wdt)
      updateProjectiles(wdt)
      updateBoss(dt, wdt)
    }

    rt.combo.timer -= dt
    if (rt.combo.timer <= 0) rt.combo.count = 0

    updateCamera(camera, dt, st.settings.fov)
    rt.ui.hitMarker = Math.max(0, rt.ui.hitMarker - dt * 5)
    rt.ui.damageFlash = Math.max(0, rt.ui.damageFlash - dt * 2.2)
    updateScreenMarkers(camera)

    // extraction
    if (!rt.completed && checkPortal()) {
      rt.completed = true
      rt.completeT = 1.1
      sfx.portal()
      burst(p.pos, COLORS.safe, { count: 120, speed: 10, life: 1.2, size: 0.5 })
      shockwave(p.pos, COLORS.safe, 8, 0.8)
      p.vel.set(0, 0, 0)
    }
    if (rt.completed && rt.completeT > 0) {
      rt.completeT -= dt
      if (rt.completeT <= 0) {
        releaseLock()
        st.finishLevel(computeResult(rt))
      }
    }
    // challenge mode clock
    if (rt.challenge && !rt.completed && !rt.failed && rt.time > rt.level!.parTime * 1.6) {
      rt.failed = true
      releaseLock()
      st.failLevel('Time limit exceeded')
    }

    rt.hudTimer -= dt
    if (rt.hudTimer <= 0) {
      rt.hudTimer = 1 / 12
      st.setHud(buildHud())
    }
  })
  return null
}
