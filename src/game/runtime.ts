import * as THREE from 'three'
import type { Collider, RigidBody } from '@dimforge/rapier3d-compat'
import type { EnemyType, LevelDef, Vec3 } from './types'
import { P } from './constants'

export const v3 = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2])

export interface Enemy {
  id: number
  type: EnemyType
  pos: THREE.Vector3
  vel: THREE.Vector3
  home: THREE.Vector3
  patrol: THREE.Vector3[]
  patrolIdx: number
  hp: number
  maxHp: number
  alive: boolean
  aggro: boolean
  fireCd: number
  charge: number
  hitFlash: number
  shielded: boolean
  contactCd: number
  deadTime: number
  phase: number
  fromBoss: boolean
  facing: number
}

export interface Projectile {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
  damage: number
  radius: number
  homing: number
  boss: boolean
  alive: boolean
}

export interface MoverState {
  id: string
  body: RigidBody | null
  pos: THREE.Vector3
  delta: THREE.Vector3
  /** distance travelled along the path loop */
  s: number
  waitT: number
  active: boolean
}

export interface LaserState {
  origin: THREE.Vector3
  dir: THREE.Vector3
  len: number
  baseLen: number
  rotSpeed: number
  baseDir: THREE.Vector3
  damage: number
  enabled: boolean
  boss: boolean
}

export interface BossState {
  active: boolean
  phase: number // 0 dormant, 1-4 fight, 5 defeated
  hp: number
  maxHp: number
  pos: THREE.Vector3
  target: THREE.Vector3
  shield: boolean
  attackT: number
  ringT: number
  hitFlash: number
  orbit: number
  waveSpawned: boolean
  deathT: number
  intro: number
  open: number // armor open amount 0..1
}

export interface Shockwave {
  pos: THREE.Vector3
  t: number
  life: number
  radius: number
  color: THREE.Color
  alive: boolean
}

interface UiFrame {
  marker: { x: number; y: number; visible: boolean; dist: number; edge: boolean; color: string }
  grapple: { x: number; y: number; visible: boolean }
  hitMarker: number
  damageFlash: number
  hint: string
  prompt: string
  deathReason: string
}

function makeRuntime() {
  return {
    level: null as LevelDef | null,
    challenge: false,
    running: false,
    time: 0,
    worldTime: 0,
    worldScale: 1,
    completed: false,
    completeT: 0,
    failed: false,
    refs: {
      body: null as RigidBody | null,
      collider: null as Collider | null,
    },
    player: {
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: -0.15,
      facing: 0,
      grounded: false,
      groundCollider: -1,
      coyote: 0,
      jumpBuffer: 0,
      jumpsUsed: 0,
      airDashUsed: false,
      dashT: 0,
      dashCd: 0,
      dashDir: new THREE.Vector3(),
      wallRunT: 0,
      wallRunning: false,
      wallNormal: new THREE.Vector3(),
      wallRunLock: 0,
      grappling: false,
      grappleTarget: new THREE.Vector3(),
      grappleT: 0,
      grappleCd: 0,
      grappleCandidate: -1,
      pulseCd: 0,
      pulseAnim: 0,
      shieldT: 0,
      shieldCd: 0,
      slowT: 0,
      slowCd: 0,
      health: P.maxHealth as number,
      maxHealth: P.maxHealth as number,
      energy: P.maxEnergy as number,
      invuln: 0,
      dead: false,
      deathT: 0,
      landT: 0,
      speed: 0,
      hazardTick: 0,
    },
    checkpoint: new THREE.Vector3(),
    checkpointIdx: -1,
    stats: {
      deaths: 0,
      damageTaken: 0,
      kills: 0,
      cores: 0,
      secrets: 0,
      maxCombo: 0,
      comboScore: 0,
      score: 0,
    },
    combo: { count: 0, timer: 0 },
    coresTaken: [] as boolean[],
    secretsTaken: [] as boolean[],
    pickupsTaken: [] as boolean[],
    checkpointsHit: [] as boolean[],
    healthPadCd: [] as number[],
    switches: {} as Record<string, boolean>,
    plates: {} as Record<string, boolean>,
    gates: {} as Record<string, boolean>,
    gateColliders: {} as Record<string, Collider | null>,
    crystals: [] as { broken: boolean; collider: Collider | null }[],
    timedColliders: [] as (Collider | null)[],
    timedOn: [] as boolean[],
    movers: [] as MoverState[],
    moverByCollider: new Map<number, MoverState>(),
    cubes: [] as { body: RigidBody | null; home: THREE.Vector3 }[],
    lasers: [] as LaserState[],
    surges: [] as { triggered: boolean; t: number; pos: THREE.Vector3 }[],
    enemies: [] as Enemy[],
    enemiesTotal: 0,
    projectiles: [] as Projectile[],
    shockwaves: [] as Shockwave[],
    anchors: [] as { pos: THREE.Vector3; active: boolean; boss: boolean }[],
    boss: null as BossState | null,
    shake: 0,
    ui: {
      marker: { x: 0, y: 0, visible: false, dist: 0, edge: false, color: '#ffd23f' },
      grapple: { x: 0, y: 0, visible: false },
      hitMarker: 0,
      damageFlash: 0,
      hint: '',
      prompt: '',
      deathReason: '',
    } as UiFrame,
    hudTimer: 0,
    nextEnemyId: 1,
  }
}

export type Runtime = ReturnType<typeof makeRuntime>

/** Single mutable game-state object, rebuilt for every run. Read/written every frame without React. */
export let rt: Runtime = makeRuntime()

export function resetRuntime(level: LevelDef, challenge: boolean) {
  rt = makeRuntime()
  ;(globalThis as unknown as { __rift: unknown }).__rift = rt
  rt.level = level
  rt.challenge = challenge
  const feet = v3(level.spawn)
  rt.player.pos.set(feet.x, feet.y + P.feet + 0.05, feet.z)
  rt.player.yaw = level.spawnYaw
  rt.player.facing = level.spawnYaw
  rt.checkpoint.copy(rt.player.pos)
  if (challenge) {
    rt.player.maxHealth = 60
    rt.player.health = 60
  }
  rt.coresTaken = level.cores.map(() => false)
  rt.secretsTaken = level.secrets.map(() => false)
  rt.pickupsTaken = level.pickups.map(() => false)
  rt.checkpointsHit = level.checkpoints.map(() => false)
  rt.healthPadCd = level.healthPads.map(() => 0)
  level.switches.forEach((s) => (rt.switches[s.id] = false))
  level.plates.forEach((p) => (rt.plates[p.id] = false))
  level.gates.forEach((g) => (rt.gates[g.id] = false))
  rt.crystals = level.crystals.map(() => ({ broken: false, collider: null }))
  rt.timedColliders = level.timed.map(() => null)
  rt.timedOn = level.timed.map(() => true)
  rt.movers = level.movers.map((m) => ({
    id: m.id,
    body: null,
    pos: v3(m.path[0]),
    delta: new THREE.Vector3(),
    s: 0,
    waitT: 0,
    active: !m.activatedBy,
  }))
  rt.cubes = level.cubes.map((c) => ({ body: null, home: v3(c.pos) }))
  rt.lasers = level.lasers.map((l) => {
    const d = v3(l.dir).normalize()
    return {
      origin: v3(l.pos),
      dir: d.clone(),
      baseDir: d,
      len: l.length,
      baseLen: l.length,
      rotSpeed: l.rotSpeed ?? 0,
      damage: l.damage ?? 20,
      enabled: true,
      boss: false,
    }
  })
  rt.surges = level.surges.map((s) => ({ triggered: false, t: 0, pos: v3(s.from) }))
  rt.anchors = level.anchors.map((a) => ({ pos: v3(a), active: true, boss: false }))
  for (const e of level.enemies) spawnEnemy(e.type, v3(e.pos), e.patrol?.map(v3))
  rt.enemiesTotal = rt.enemies.length
  if (level.boss) {
    const bp = v3(level.boss.pos)
    rt.boss = {
      active: false,
      phase: 0,
      hp: 1,
      maxHp: 1,
      pos: bp.clone(),
      target: bp.clone(),
      shield: false,
      attackT: 2,
      ringT: 6,
      hitFlash: 0,
      orbit: 0,
      waveSpawned: false,
      deathT: 0,
      intro: 0,
      open: 0,
    }
    // phase-4 anchors that orbit the Sentinel, inactive until the weak point opens
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      rt.anchors.push({
        pos: new THREE.Vector3(bp.x + Math.cos(a) * 9, 13.5, bp.z + Math.sin(a) * 9),
        active: false,
        boss: true,
      })
    }
    // rotating laser walls (phase 3)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
      rt.lasers.push({
        origin: new THREE.Vector3(bp.x, 0.85, bp.z),
        dir: d.clone(),
        baseDir: d,
        len: 30,
        baseLen: 30,
        rotSpeed: 0.55,
        damage: 22,
        enabled: false,
        boss: true,
      })
    }
    const hd = new THREE.Vector3(1, 0, 0)
    rt.lasers.push({
      origin: new THREE.Vector3(bp.x, 2.9, bp.z),
      dir: hd.clone(),
      baseDir: hd,
      len: 30,
      baseLen: 30,
      rotSpeed: -0.32,
      damage: 22,
      enabled: false,
      boss: true,
    })
  }
  for (let i = 0; i < 160; i++) {
    rt.projectiles.push({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      damage: 0,
      radius: 0.3,
      homing: 0,
      boss: false,
      alive: false,
    })
  }
  for (let i = 0; i < 16; i++) {
    rt.shockwaves.push({ pos: new THREE.Vector3(), t: 0, life: 1, radius: 1, color: new THREE.Color(), alive: false })
  }
  return rt
}

const ENEMY_HP: Record<EnemyType, number> = { scout: 34, blaster: 68, shield: 90, hunter: 60, target: 34 }

export function spawnEnemy(type: EnemyType, pos: THREE.Vector3, patrol?: THREE.Vector3[], fromBoss = false) {
  const e: Enemy = {
    id: rt.nextEnemyId++,
    type,
    pos: pos.clone(),
    vel: new THREE.Vector3(),
    home: pos.clone(),
    patrol: patrol ?? [],
    patrolIdx: 0,
    hp: ENEMY_HP[type],
    maxHp: ENEMY_HP[type],
    alive: true,
    aggro: false,
    fireCd: 1 + Math.random() * 1.5,
    charge: 0,
    hitFlash: 0,
    shielded: false,
    contactCd: 0,
    deadTime: 0,
    phase: Math.random() * 10,
    fromBoss,
    facing: 0,
  }
  rt.enemies.push(e)
  return e
}
