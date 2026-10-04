import type { LevelDef, PlatformDef, SurfaceKind } from '../game/types'

/** Box whose TOP surface sits at `top`. */
export const plat = (x: number, top: number, z: number, w: number, d: number, h = 1, kind: SurfaceKind = 'metal'): PlatformDef => ({
  pos: [x, top - h / 2, z],
  size: [w, h, d],
  kind,
})

/** Tall floating spire (top at `top`, extends 40m down). */
export const tower = (x: number, top: number, z: number, w: number, d: number, kind: SurfaceKind = 'neon'): PlatformDef =>
  plat(x, top, z, w, d, 40, kind)

const WALL_T = 0.6

/** Wall running along Z at fixed x, from z1 to z2. */
export const wallX = (x: number, z1: number, z2: number, h = 7, bottom = 0, kind: SurfaceKind = 'dark'): PlatformDef => ({
  pos: [x, bottom + h / 2, (z1 + z2) / 2],
  size: [WALL_T, h, Math.abs(z2 - z1)],
  kind,
})

/** Wall running along X at fixed z, from x1 to x2. */
export const wallZ = (z: number, x1: number, x2: number, h = 7, bottom = 0, kind: SurfaceKind = 'dark'): PlatformDef => ({
  pos: [(x1 + x2) / 2, bottom + h / 2, z],
  size: [Math.abs(x2 - x1), h, WALL_T],
  kind,
})

export function level(partial: Partial<LevelDef> & Pick<LevelDef, 'id' | 'name' | 'subtitle' | 'spawn' | 'portal' | 'theme'>): LevelDef {
  return {
    blurb: '',
    introduces: [],
    parTime: 90,
    killY: -20,
    spawnYaw: 0,
    coresRequired: 0,
    platforms: [],
    movers: [],
    timed: [],
    gates: [],
    switches: [],
    plates: [],
    cubes: [],
    lasers: [],
    hazards: [],
    surges: [],
    enemies: [],
    cores: [],
    secrets: [],
    checkpoints: [],
    anchors: [],
    healthPads: [],
    jumpPads: [],
    crystals: [],
    pickups: [],
    hints: [],
    unlocks: [],
    ...partial,
  }
}
