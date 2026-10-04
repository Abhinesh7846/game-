import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { rt } from '../game/runtime'

/** Rapier world handle shared with the non-React systems. Set by GameLoop on mount. */
export const phys = {
  world: null as RAPIER.World | null,
  rapier: null as typeof RAPIER | null,
}

let ray: RAPIER.Ray | null = null

/** Distance to the first solid hit (ignoring the player), or null if nothing within maxDist. */
export function rayDist(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number | null {
  const { world, rapier } = phys
  if (!world || !rapier) return null
  if (!ray) ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
  ray.origin = { x: origin.x, y: origin.y, z: origin.z }
  ray.dir = { x: dir.x, y: dir.y, z: dir.z }
  const hit = world.castRay(ray, maxDist, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, rt.refs.collider ?? undefined)
  return hit ? hit.timeOfImpact : null
}

/** Like rayDist but also returns the surface normal. */
export function rayHit(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) {
  const { world, rapier } = phys
  if (!world || !rapier) return null
  if (!ray) ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
  ray.origin = { x: origin.x, y: origin.y, z: origin.z }
  ray.dir = { x: dir.x, y: dir.y, z: dir.z }
  const hit = world.castRayAndGetNormal(
    ray,
    maxDist,
    true,
    rapier.QueryFilterFlags.EXCLUDE_SENSORS,
    undefined,
    rt.refs.collider ?? undefined,
  )
  return hit ? { dist: hit.timeOfImpact, normal: hit.normal, collider: hit.collider } : null
}

const _d = new THREE.Vector3()
/** True when nothing solid sits between a and b. */
export function lineOfSight(a: THREE.Vector3, b: THREE.Vector3) {
  _d.subVectors(b, a)
  const len = _d.length()
  if (len < 0.01) return true
  _d.divideScalar(len)
  const d = rayDist(a, _d, len)
  return d == null || d >= len - 0.3
}

// ---------- geometry ----------
const d1 = new THREE.Vector3()
const d2 = new THREE.Vector3()
const r = new THREE.Vector3()
const c1 = new THREE.Vector3()
const c2 = new THREE.Vector3()

/** Shortest distance between segments p1-q1 and p2-q2. */
export function segSegDist(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3) {
  d1.subVectors(q1, p1)
  d2.subVectors(q2, p2)
  r.subVectors(p1, p2)
  const a = d1.dot(d1)
  const e = d2.dot(d2)
  const f = d2.dot(r)
  let s = 0
  let t = 0
  if (a <= 1e-6 && e <= 1e-6) return p1.distanceTo(p2)
  if (a <= 1e-6) {
    t = THREE.MathUtils.clamp(f / e, 0, 1)
  } else {
    const c = d1.dot(r)
    if (e <= 1e-6) {
      s = THREE.MathUtils.clamp(-c / a, 0, 1)
    } else {
      const b = d1.dot(d2)
      const denom = a * e - b * b
      s = denom !== 0 ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = THREE.MathUtils.clamp(-c / a, 0, 1)
      } else if (t > 1) {
        t = 1
        s = THREE.MathUtils.clamp((b - c) / a, 0, 1)
      }
    }
  }
  c1.copy(p1).addScaledVector(d1, s)
  c2.copy(p2).addScaledVector(d2, t)
  return c1.distanceTo(c2)
}

const top = new THREE.Vector3()
const bot = new THREE.Vector3()
/** Distance from a point to the player's capsule core segment. */
export function distToPlayer(p: THREE.Vector3) {
  const pp = rt.player.pos
  top.set(pp.x, pp.y + 0.5, pp.z)
  bot.set(pp.x, pp.y - 0.5, pp.z)
  return segSegDist(p, p, bot, top)
}

export function playerSegment(outBot: THREE.Vector3, outTop: THREE.Vector3) {
  const pp = rt.player.pos
  outTop.set(pp.x, pp.y + 0.5, pp.z)
  outBot.set(pp.x, pp.y - 0.5, pp.z)
}

/** AABB (center/size) vs player capsule bounds. */
export function playerInBox(center: THREE.Vector3 | number[], size: number[], pad = 0) {
  const p = rt.player.pos
  const cx = Array.isArray(center) ? center[0] : center.x
  const cy = Array.isArray(center) ? center[1] : center.y
  const cz = Array.isArray(center) ? center[2] : center.z
  return (
    Math.abs(p.x - cx) < size[0] / 2 + 0.4 + pad &&
    Math.abs(p.y - cy) < size[1] / 2 + 0.9 + pad &&
    Math.abs(p.z - cz) < size[2] / 2 + 0.4 + pad
  )
}
