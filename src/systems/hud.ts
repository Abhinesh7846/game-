import * as THREE from 'three'
import { rt } from '../game/runtime'
import { ABILITY_INFO, COLORS, P } from '../game/constants'
import type { HudAbility, HudState } from '../game/store'
import { useGame } from '../game/store'
import { comboMultiplier } from './combat'
import { PHASE_LABEL } from './boss'
import { portalOpen } from './world'

const target = new THREE.Vector3()
const camSpace = new THREE.Vector3()

function objective(): { text: string; color: string; pos: THREE.Vector3 | null } {
  const L = rt.level!
  const b = rt.boss
  if (b) {
    if (b.phase === 0) return { text: 'Enter the arena and face the Sentinel', color: COLORS.danger, pos: target.copy(b.pos) }
    if (b.phase >= 1 && b.phase <= 4) {
      const text =
        b.phase === 1
          ? 'Get close and PULSE the Sentinel — dodge its barrages'
          : b.phase === 2
            ? b.shield
              ? 'Destroy the drone swarm to break the shield'
              : 'Shield down — hit the Sentinel!'
            : b.phase === 3
              ? 'Jump the laser walls · use pillars as cover · keep hitting it'
              : 'GRAPPLE to the floating anchors and blast the exposed core'
      return { text, color: b.phase === 4 ? COLORS.objective : COLORS.danger, pos: target.copy(b.pos) }
    }
    if (b.active) return { text: 'The Sentinel is collapsing…', color: COLORS.objective, pos: null }
  }
  if (rt.stats.cores < L.coresRequired) {
    let best = Infinity
    let found = false
    L.cores.forEach((c, i) => {
      if (rt.coresTaken[i]) return
      const d = rt.player.pos.distanceToSquared(camSpace.set(c[0], c[1], c[2]))
      if (d < best) {
        best = d
        target.set(c[0], c[1], c[2])
        found = true
      }
    })
    return {
      text: `Collect energy cores  ${rt.stats.cores} / ${L.coresRequired}`,
      color: COLORS.objective,
      pos: found ? target : null,
    }
  }
  const p = L.portal
  return {
    text: portalOpen() ? 'Reach the extraction portal' : 'Unlock the exit',
    color: COLORS.safe,
    pos: target.set(p[0], p[1] + 1.8, p[2]),
  }
}

let objCache: { text: string; color: string } = { text: '', color: COLORS.objective }

/** Per-frame: project objective + grapple target to screen space for the DOM overlay. */
export function updateScreenMarkers(camera: THREE.Camera) {
  const o = objective()
  objCache = { text: o.text, color: o.color }
  const m = rt.ui.marker
  if (!o.pos || rt.player.dead) {
    m.visible = false
  } else {
    m.dist = o.pos.distanceTo(rt.player.pos)
    camSpace.copy(o.pos).applyMatrix4(camera.matrixWorldInverse)
    const behind = camSpace.z > 0
    target.copy(o.pos).project(camera)
    let x = target.x
    let y = target.y
    if (behind) {
      x = -x
      y = -y
    }
    let edge = false
    const lim = 0.88
    const mx = Math.max(Math.abs(x), Math.abs(y))
    // off-screen (or behind the camera): pin to the screen edge in the target's direction
    if (behind || mx > lim) {
      if (mx < 1e-3) y = -1
      const k = lim / Math.max(Math.abs(x), Math.abs(y))
      x *= k
      y *= k
      edge = true
    }
    m.x = x
    m.y = y
    m.edge = edge
    m.visible = true
    m.color = o.color
  }
  const g = rt.ui.grapple
  const idx = rt.player.grappleCandidate
  if (idx >= 0 && !rt.player.grappling) {
    target.copy(rt.anchors[idx].pos).project(camera)
    g.x = target.x
    g.y = target.y
    g.visible = target.z < 1
  } else g.visible = false
}

export function buildHud(): HudState {
  const p = rt.player
  const L = rt.level!
  const ab = useGame.getState().progress.abilities
  const b = rt.boss
  const abilities: HudAbility[] = [
    { id: 'dash', label: ABILITY_INFO.dash.name, key: 'SHIFT', ready: 1 - p.dashCd / P.dashCooldown, locked: false, active: p.dashT > 0, cost: 0 },
    { id: 'pulse', label: ABILITY_INFO.pulse.name, key: 'LMB', ready: 1 - p.pulseCd / P.pulseCooldown, locked: false, active: p.pulseAnim > 0, cost: P.pulseCost },
    { id: 'grapple', label: ABILITY_INFO.grapple.name, key: 'E', ready: 1 - p.grappleCd / P.grappleCooldown, locked: !ab.grapple, active: p.grappling, cost: P.grappleCost },
    { id: 'shield', label: ABILITY_INFO.shield.name, key: 'Q', ready: 1 - p.shieldCd / P.shieldCooldown, locked: !ab.shield, active: p.shieldT > 0, cost: P.shieldCost },
    { id: 'slowField', label: ABILITY_INFO.slowField.name, key: 'F', ready: 1 - p.slowCd / P.slowCooldown, locked: !ab.slowField, active: p.slowT > 0, cost: P.slowCost },
  ]
  return {
    health: Math.max(0, p.health),
    energy: p.energy,
    cores: rt.stats.cores,
    coresRequired: L.coresRequired,
    coresTotal: L.cores.length,
    time: rt.time,
    timeLimit: rt.challenge ? L.parTime * 1.6 : 0,
    objective: objCache.text,
    abilities,
    combo: rt.combo.count,
    multiplier: comboMultiplier(),
    comboTimer: rt.combo.timer / 3.5,
    score: Math.round(rt.stats.comboScore + rt.stats.cores * 250 + rt.stats.kills * 150 + rt.stats.secrets * 1500),
    boss:
      b && b.active && b.phase >= 1 && b.phase <= 4
        ? { hp: Math.max(0, b.hp / b.maxHp), phase: b.phase, label: PHASE_LABEL[b.phase], shielded: b.shield }
        : null,
    hint: rt.ui.hint,
    prompt: rt.ui.prompt || (p.grappleCandidate >= 0 && !p.grappling ? '[E] GRAPPLE' : ''),
    dead: p.dead,
    deathReason: rt.ui.deathReason,
    slowActive: p.slowT > 0,
    shieldActive: p.shieldT > 0,
    secrets: rt.stats.secrets,
    secretsTotal: L.secrets.length,
  }
}
