import * as THREE from 'three'
import { rt } from '../game/runtime'
import { useGame } from '../game/store'

/** CPU particle pool rendered as one additive Points cloud (see components/fx/Particles). */
export const MAX_PARTICLES = 2400

export const particles = {
  pos: new Float32Array(MAX_PARTICLES * 3),
  vel: new Float32Array(MAX_PARTICLES * 3),
  col: new Float32Array(MAX_PARTICLES * 3),
  life: new Float32Array(MAX_PARTICLES),
  maxLife: new Float32Array(MAX_PARTICLES),
  size: new Float32Array(MAX_PARTICLES),
  grav: new Float32Array(MAX_PARTICLES),
  cursor: 0,
}

const tmpColor = new THREE.Color()

export interface BurstOpts {
  count?: number
  speed?: number
  life?: number
  size?: number
  gravity?: number
  spread?: number
  dir?: THREE.Vector3
  jitter?: number
}

export function burst(pos: THREE.Vector3, color: THREE.ColorRepresentation, o: BurstOpts = {}) {
  const count = o.count ?? 20
  const speed = o.speed ?? 6
  const life = o.life ?? 0.7
  const size = o.size ?? 0.35
  tmpColor.set(color)
  for (let n = 0; n < count; n++) {
    const i = particles.cursor
    particles.cursor = (particles.cursor + 1) % MAX_PARTICLES
    const j = o.jitter ?? 0.2
    particles.pos[i * 3] = pos.x + (Math.random() - 0.5) * j
    particles.pos[i * 3 + 1] = pos.y + (Math.random() - 0.5) * j
    particles.pos[i * 3 + 2] = pos.z + (Math.random() - 0.5) * j
    // random direction on sphere, optionally biased
    let x = Math.random() * 2 - 1
    let y = Math.random() * 2 - 1
    let z = Math.random() * 2 - 1
    const l = Math.hypot(x, y, z) || 1
    x /= l
    y /= l
    z /= l
    if (o.dir) {
      const s = o.spread ?? 0.5
      x = o.dir.x + x * s
      y = o.dir.y + y * s
      z = o.dir.z + z * s
    }
    const sp = speed * (0.4 + Math.random() * 0.8)
    particles.vel[i * 3] = x * sp
    particles.vel[i * 3 + 1] = y * sp
    particles.vel[i * 3 + 2] = z * sp
    const k = 0.75 + Math.random() * 0.5
    particles.col[i * 3] = tmpColor.r * k
    particles.col[i * 3 + 1] = tmpColor.g * k
    particles.col[i * 3 + 2] = tmpColor.b * k
    particles.life[i] = life * (0.6 + Math.random() * 0.6)
    particles.maxLife[i] = particles.life[i]
    particles.size[i] = size * (0.6 + Math.random() * 0.8)
    particles.grav[i] = o.gravity ?? 0
  }
}

export function shockwave(pos: THREE.Vector3, color: THREE.ColorRepresentation, radius: number, life = 0.45) {
  const s = rt.shockwaves.find((w) => !w.alive) ?? rt.shockwaves[0]
  s.alive = true
  s.pos.copy(pos)
  s.t = 0
  s.life = life
  s.radius = radius
  s.color.set(color)
}

export function addShake(amount: number) {
  const k = useGame.getState().settings.screenShake
  rt.shake = Math.min(1.2, rt.shake + amount * k)
}

export function explosion(pos: THREE.Vector3, color: THREE.ColorRepresentation, scale = 1) {
  burst(pos, color, { count: Math.round(40 * scale), speed: 9 * scale, life: 0.8, size: 0.5 * scale, gravity: -6 })
  burst(pos, '#ffffff', { count: Math.round(14 * scale), speed: 4 * scale, life: 0.4, size: 0.7 * scale })
  shockwave(pos, color, 4 * scale, 0.5)
}
