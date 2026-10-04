import type { AbilityId, KeyColor } from './types'

/** Movement + ability tuning. Units are meters / seconds. */
export const P = {
  radius: 0.4,
  halfHeight: 0.5,
  /** distance from body center down to feet */
  feet: 0.9,
  gravity: 30,
  maxFall: 38,
  jumpVel: 11.5,
  doubleJumpVel: 10.5,
  runSpeed: 9.5,
  groundAccel: 75,
  airAccel: 24,
  groundFriction: 14,
  coyote: 0.12,
  jumpBuffer: 0.14,

  dashSpeed: 25,
  dashTime: 0.17,
  dashCooldown: 0.85,

  wallRunTime: 1.3,
  wallRunMinSpeed: 5.5,
  wallRunFall: 1.1,
  wallJumpUp: 10.5,
  wallJumpOut: 9,

  grappleRange: 34,
  grappleSpeed: 30,
  grappleCost: 10,
  grappleCooldown: 0.35,
  grappleMaxTime: 1.8,

  pulseCost: 9,
  pulseCooldown: 0.42,
  pulseRange: 7.5,
  pulseDamage: 34,

  shieldCost: 30,
  shieldTime: 2.6,
  shieldCooldown: 4,

  slowCost: 40,
  slowTime: 5,
  slowCooldown: 8,
  slowScale: 0.3,

  maxHealth: 100,
  maxEnergy: 100,
  energyRegen: 8,
  hitInvuln: 0.5,
} as const

export const COLORS = {
  safe: '#36c8ff',
  danger: '#ff3355',
  objective: '#ffd23f',
  secret: '#b45cff',
  checkpoint: '#3dff9a',
  white: '#e8f3ff',
} as const

export const KEY_COLORS: Record<KeyColor | 'core', string> = {
  cyan: '#2ee6ff',
  orange: '#ff9a2e',
  magenta: '#ff4fd8',
  core: COLORS.objective,
}

export const ABILITY_INFO: Record<AbilityId | 'dash' | 'pulse', { name: string; key: string; desc: string }> = {
  dash: { name: 'Dash', key: 'SHIFT', desc: 'Burst of speed. One air-dash per jump.' },
  pulse: { name: 'Pulse Blast', key: 'LMB', desc: 'Short-range shockwave. Breaks crystals, hits switches, deletes projectiles.' },
  doubleJump: { name: 'Double Jump', key: 'SPACE', desc: 'Jump again in mid-air.' },
  grapple: { name: 'Grapple', key: 'E / RMB', desc: 'Zip to glowing anchors.' },
  shield: { name: 'Shield Burst', key: 'Q', desc: 'Brief invulnerability that shoves enemies away.' },
  slowField: { name: 'Slow Field', key: 'F', desc: 'Slows traps, enemies and projectiles.' },
}

export interface TrailDef {
  id: string
  name: string
  color: string
  requirement: string
}

export const TRAILS: TrailDef[] = [
  { id: 'cyan', name: 'Cyan Pulse', color: '#36c8ff', requirement: 'Default' },
  { id: 'solar', name: 'Solar Flare', color: '#ffb02e', requirement: 'Clear Training Rift' },
  { id: 'volt', name: 'Toxic Volt', color: '#7dff3d', requirement: 'Clear Circuit Labyrinth' },
  { id: 'void', name: 'Void Bloom', color: '#b45cff', requirement: 'Earn an S rank' },
  { id: 'crimson', name: 'Crimson Ghost', color: '#ff3d6e', requirement: 'Earn an S+ rank' },
  { id: 'prism', name: 'Prism', color: '#ffffff', requirement: 'Defeat the Sentinel' },
]
