export type Vec3 = [number, number, number]

export type AbilityId = 'doubleJump' | 'grapple' | 'shield' | 'slowField'

export type SurfaceKind = 'metal' | 'glass' | 'neon' | 'runwall' | 'dark' | 'arena'

export type KeyColor = 'cyan' | 'orange' | 'magenta'

export type EnemyType = 'scout' | 'blaster' | 'shield' | 'hunter' | 'target'

export type Rank = 'C' | 'B' | 'A' | 'S' | 'S+'

/** Static solid block. `pos` is the CENTER of the box. */
export interface PlatformDef {
  pos: Vec3
  size: Vec3
  kind?: SurfaceKind
  shape?: 'box' | 'cylinder'
}

/** Kinematic platform that travels along a waypoint loop (ping-pong). */
export interface MoverDef {
  id: string
  size: Vec3
  path: Vec3[]
  speed: number
  /** pause at each waypoint, seconds */
  wait?: number
  /** only moves while this plate is pressed */
  activatedBy?: string
}

/** Platform that phases in and out on a timer. */
export interface TimedDef {
  pos: Vec3
  size: Vec3
  period: number
  onTime: number
  offset: number
}

export interface GateRequirement {
  cores?: number
  switch?: string
  plate?: string
}

export interface GateDef {
  id: string
  pos: Vec3
  size: Vec3
  color: KeyColor | 'core'
  requires: GateRequirement
}

export interface SwitchDef {
  id: string
  pos: Vec3
  color: KeyColor
}

export interface PlateDef {
  id: string
  pos: Vec3
  size?: [number, number]
}

export interface CubeDef {
  pos: Vec3
}

export interface LaserDef {
  pos: Vec3
  dir: Vec3
  length: number
  /** radians / second around Y */
  rotSpeed?: number
  damage?: number
  /** draw a support post under the emitter (visual only) */
  post?: boolean
}

export interface HazardDef {
  pos: Vec3
  size: Vec3
  dps: number
  /** upward launch velocity when touched (lava) */
  bounce?: number
  kind: 'lava' | 'energy'
}

/** A wall of energy that advances once triggered (chase sections). */
export interface SurgeDef {
  trigger: { pos: Vec3; size: Vec3 }
  from: Vec3
  to: Vec3
  size: Vec3
  speed: number
  dps: number
}

export interface EnemyDef {
  type: EnemyType
  pos: Vec3
  patrol?: Vec3[]
}

export interface HintDef {
  pos: Vec3
  radius: number
  text: string
}

export interface PickupDef {
  pos: Vec3
  ability: AbilityId
}

export interface JumpPadDef {
  pos: Vec3
  power: number
}

export interface CrystalDef {
  pos: Vec3
  size: Vec3
}

export interface LevelTheme {
  skyTop: string
  skyBottom: string
  fog: string
  accent: string
  sun: string
  nebula: string
  hazard?: string
}

export interface LevelDef {
  id: number
  name: string
  subtitle: string
  blurb: string
  introduces: string[]
  parTime: number
  killY: number
  spawn: Vec3
  spawnYaw: number
  theme: LevelTheme
  coresRequired: number
  platforms: PlatformDef[]
  movers: MoverDef[]
  timed: TimedDef[]
  gates: GateDef[]
  switches: SwitchDef[]
  plates: PlateDef[]
  cubes: CubeDef[]
  lasers: LaserDef[]
  hazards: HazardDef[]
  surges: SurgeDef[]
  enemies: EnemyDef[]
  cores: Vec3[]
  secrets: Vec3[]
  checkpoints: Vec3[]
  anchors: Vec3[]
  healthPads: Vec3[]
  jumpPads: JumpPadDef[]
  crystals: CrystalDef[]
  pickups: PickupDef[]
  hints: HintDef[]
  portal: Vec3
  boss?: { pos: Vec3 }
  /** abilities granted on completion */
  unlocks: AbilityId[]
}

export interface RunResult {
  levelId: number
  challenge: boolean
  time: number
  parTime: number
  cores: number
  coresTotal: number
  kills: number
  enemiesTotal: number
  secrets: number
  secretsTotal: number
  damageTaken: number
  deaths: number
  maxCombo: number
  comboScore: number
  breakdown: { label: string; value: number; detail: string }[]
  score: number
  rank: Rank
  rating: number
  newBest: boolean
  unlockedAbilities: AbilityId[]
  unlockedTrails: string[]
  gameComplete: boolean
}
