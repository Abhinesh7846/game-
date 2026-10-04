import type { PlatformDef, Vec3 } from '../game/types'
import { level, plat } from './builders'

const ring = (n: number, r: number, y: number, offset = 0): Vec3[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + offset
    return [Math.round(Math.cos(a) * r * 100) / 100, y, Math.round(Math.sin(a) * r * 100) / 100] as Vec3
  })

// offset 0 keeps the entry axis (x = 0) clear
const pillars: PlatformDef[] = ring(6, 20, 0, 0).map(([x, , z]) => plat(x, 8, z, 3, 3, 8, 'neon'))

/**
 * Sentinel Arena — a circular stage ringed by pillars (cover from the laser walls, perches for anchors).
 * Phases: 1 projectile barrages · 2 shield + drone wave · 3 rotating laser walls · 4 armour opens, grapple up to the weak point.
 */
export const level5 = level({
  id: 5,
  name: 'Sentinel Arena',
  subtitle: 'Final Trial',
  blurb: 'The Rift’s guardian awakens. Survive four escalating phases and shatter the Sentinel’s core.',
  introduces: ['Boss: The Sentinel', 'Multi-phase fight', 'Everything you’ve learned'],
  parTime: 200,
  killY: -25,
  spawn: [0, 0, 52],
  spawnYaw: 0,
  theme: {
    skyTop: '#000004',
    skyBottom: '#2a0820',
    fog: '#12040e',
    accent: '#ff3355',
    sun: '#ff9ab0',
    nebula: '#ff2a6d',
  },
  coresRequired: 0,
  platforms: [
    plat(0, 0, 40, 6, 30),
    { pos: [0, -1.5, 0], size: [52, 3, 52], kind: 'arena', shape: 'cylinder' },
    ...pillars,
    plat(0, 4, -40, 4, 4, 1, 'glass'), // secret perch behind the arena
  ],
  anchors: [...ring(6, 20, 10.5, 0), [0, 10, -33]],
  jumpPads: ring(4, 13, 0).map((p) => ({ pos: p, power: 21 })),
  healthPads: ring(2, 17, 0, Math.PI / 2),
  cores: [
    [20, 9.3, 0],
    [-20, 9.3, 0],
  ],
  secrets: [[0, 5.2, -40]],
  checkpoints: [[0, 0, 34]],
  hints: [
    { pos: [0, 0, 50], radius: 4, text: 'The Sentinel guards the final portal. Step into the arena when ready.' },
    { pos: [0, 0, 34], radius: 3, text: 'Pillars block laser walls. Jump pads and anchors get you airborne.' },
  ],
  boss: { pos: [0, 4.5, 0] },
  portal: [0, 0, 0],
  unlocks: [],
})
