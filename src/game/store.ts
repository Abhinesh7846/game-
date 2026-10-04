import { create } from 'zustand'
import type { AbilityId, Rank, RunResult } from './types'
import { TRAILS } from './constants'

export type Screen =
  | 'menu'
  | 'levelSelect'
  | 'settings'
  | 'controls'
  | 'locker'
  | 'playing'
  | 'paused'
  | 'complete'
  | 'failed'

export type Quality = 'low' | 'medium' | 'high'

export interface Settings {
  sensitivity: number
  invertY: boolean
  fov: number
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  quality: Quality
  screenShake: number
  showFps: boolean
}

export interface LevelRecord {
  bestScore: number
  bestTime: number
  bestRank: Rank
  secrets: number
  challengeBestTime?: number
  challengeBestRank?: Rank
}

export interface Progress {
  unlockedLevel: number
  records: Record<number, LevelRecord>
  abilities: Record<AbilityId, boolean>
  trails: string[]
  trail: string
  gameComplete: boolean
}

export interface HudAbility {
  id: string
  label: string
  key: string
  ready: number // 0..1 cooldown progress
  locked: boolean
  active: boolean
  cost: number
}

export interface HudState {
  health: number
  energy: number
  cores: number
  coresRequired: number
  coresTotal: number
  time: number
  timeLimit: number
  objective: string
  abilities: HudAbility[]
  combo: number
  multiplier: number
  comboTimer: number
  score: number
  boss: { hp: number; phase: number; label: string; shielded: boolean } | null
  hint: string
  prompt: string
  dead: boolean
  deathReason: string
  slowActive: boolean
  shieldActive: boolean
  secrets: number
  secretsTotal: number
}

export interface Toast {
  id: number
  text: string
  sub?: string
  color: string
}

const SETTINGS_KEY = 'rift-runners.settings.v1'
const PROGRESS_KEY = 'rift-runners.progress.v1'

/** First-run graphics pick: phones and weak machines start lower so the first impression isn't a slideshow. */
function autoQuality(): Quality {
  if (typeof window === 'undefined') return 'high'
  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency ?? 8
  const mem = nav.deviceMemory ?? 8
  const touch = window.matchMedia?.('(pointer: coarse)').matches
  if (cores <= 2 || mem <= 2) return 'low'
  if (touch || cores <= 4 || mem <= 4) return 'medium'
  return 'high'
}

const defaultSettings: Settings = {
  sensitivity: 1,
  invertY: false,
  fov: 75,
  masterVolume: 0.8,
  musicVolume: 0.45,
  sfxVolume: 0.8,
  quality: autoQuality(),
  screenShake: 1,
  showFps: false,
}

export const defaultProgress = (): Progress => ({
  unlockedLevel: 1,
  records: {},
  abilities: { doubleJump: false, grapple: false, shield: false, slowField: false },
  trails: ['cyan'],
  trail: 'cyan',
  gameComplete: false,
})

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (typeof fallback === 'object' && fallback && !Array.isArray(fallback)) {
      return { ...fallback, ...parsed }
    }
    return parsed as T
  } catch {
    return fallback
  }
}

/** Set when the page was opened with `?level=N`; practice visits never write progress to storage. */
export let practiceLevel = 0

function save(key: string, value: unknown) {
  if (key === PROGRESS_KEY && practiceLevel) return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — progress lives for this session only */
  }
}

const RANK_ORDER: Rank[] = ['C', 'B', 'A', 'S', 'S+']
export const rankValue = (r?: Rank) => (r ? RANK_ORDER.indexOf(r) : -1)

export const emptyHud = (): HudState => ({
  health: 100,
  energy: 100,
  cores: 0,
  coresRequired: 0,
  coresTotal: 0,
  time: 0,
  timeLimit: 0,
  objective: '',
  abilities: [],
  combo: 0,
  multiplier: 1,
  comboTimer: 0,
  score: 0,
  boss: null,
  hint: '',
  prompt: '',
  dead: false,
  deathReason: '',
  slowActive: false,
  shieldActive: false,
  secrets: 0,
  secretsTotal: 0,
})

interface GameStore {
  screen: Screen
  /** screen to return to from settings/controls */
  returnTo: Screen
  levelId: number
  challenge: boolean
  runKey: number
  settings: Settings
  progress: Progress
  hud: HudState
  toasts: Toast[]
  result: RunResult | null
  failReason: string

  setScreen: (s: Screen) => void
  openSub: (s: Screen) => void
  closeSub: () => void
  startLevel: (id: number, challenge?: boolean) => void
  restartLevel: () => void
  quitToMenu: () => void
  setSettings: (patch: Partial<Settings>) => void
  setHud: (h: HudState) => void
  toast: (text: string, color?: string, sub?: string) => void
  unlockAbility: (a: AbilityId) => void
  finishLevel: (r: RunResult) => void
  failLevel: (reason: string) => void
  setTrail: (id: string) => void
  resetProgress: () => void
}

let toastId = 1

export const useGame = create<GameStore>((set, get) => ({
  screen: 'menu',
  returnTo: 'menu',
  levelId: 1,
  challenge: false,
  runKey: 0,
  settings: load(SETTINGS_KEY, defaultSettings),
  progress: (() => {
    const p = load(PROGRESS_KEY, defaultProgress())
    p.abilities = { ...defaultProgress().abilities, ...p.abilities }
    // Practice link: `?level=N` opens rift N with every earlier unlock, for this visit only (nothing is saved).
    const jump = Number(new URLSearchParams(window.location.search).get('level'))
    if (jump >= 1 && jump <= 5) {
      p.unlockedLevel = Math.max(p.unlockedLevel, jump)
      if (jump >= 2) p.abilities = { ...p.abilities, doubleJump: true, grapple: true }
      if (jump >= 3) p.abilities.shield = true
      if (jump >= 4) p.abilities.slowField = true
      practiceLevel = jump
    }
    return p
  })(),
  hud: emptyHud(),
  toasts: [],
  result: null,
  failReason: '',

  setScreen: (screen) => set({ screen }),
  openSub: (s) => set({ returnTo: get().screen, screen: s }),
  closeSub: () => set({ screen: get().returnTo }),
  startLevel: (id, challenge = false) =>
    set((st) => ({
      levelId: id,
      challenge,
      runKey: st.runKey + 1,
      screen: 'playing',
      result: null,
      hud: emptyHud(),
      toasts: [],
    })),
  restartLevel: () =>
    set((st) => ({ runKey: st.runKey + 1, screen: 'playing', result: null, hud: emptyHud(), toasts: [] })),
  quitToMenu: () => set({ screen: 'menu', result: null, toasts: [] }),
  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    save(SETTINGS_KEY, settings)
    set({ settings })
  },
  setHud: (hud) => set({ hud }),
  toast: (text, color = '#36c8ff', sub) => {
    const t: Toast = { id: toastId++, text, color, sub }
    set((st) => ({ toasts: [...st.toasts.slice(-3), t] }))
    setTimeout(() => set((st) => ({ toasts: st.toasts.filter((x) => x.id !== t.id) })), 3200)
  },
  unlockAbility: (a) => {
    const progress = { ...get().progress, abilities: { ...get().progress.abilities, [a]: true } }
    save(PROGRESS_KEY, progress)
    set({ progress })
  },
  finishLevel: (r) => {
    const prev = get().progress
    const rec = prev.records[r.levelId]
    const records = { ...prev.records }
    let newBest = false
    if (r.challenge) {
      const base: LevelRecord = rec ?? { bestScore: 0, bestTime: 0, bestRank: 'C', secrets: 0 }
      const better = !base.challengeBestTime || r.time < base.challengeBestTime
      newBest = better
      records[r.levelId] = {
        ...base,
        challengeBestTime: better ? r.time : base.challengeBestTime,
        challengeBestRank:
          rankValue(r.rank) > rankValue(base.challengeBestRank) ? r.rank : base.challengeBestRank,
      }
    } else {
      newBest = !rec || r.score > rec.bestScore
      records[r.levelId] = {
        bestScore: Math.max(rec?.bestScore ?? 0, r.score),
        bestTime: rec?.bestTime ? Math.min(rec.bestTime, r.time) : r.time,
        bestRank: rankValue(r.rank) > rankValue(rec?.bestRank) ? r.rank : rec!.bestRank,
        secrets: Math.max(rec?.secrets ?? 0, r.secrets),
        challengeBestTime: rec?.challengeBestTime,
        challengeBestRank: rec?.challengeBestRank,
      }
    }
    const abilities = { ...prev.abilities }
    const unlockedAbilities = r.unlockedAbilities.filter((a) => !abilities[a])
    unlockedAbilities.forEach((a) => (abilities[a] = true))
    const trails = new Set(prev.trails)
    const before = new Set(prev.trails)
    if (r.levelId >= 1) trails.add('solar')
    if (r.levelId >= 3) trails.add('volt')
    if (rankValue(r.rank) >= rankValue('S')) trails.add('void')
    if (r.rank === 'S+') trails.add('crimson')
    if (r.levelId === 5) trails.add('prism')
    const unlockedTrails = [...trails].filter((t) => !before.has(t))
    const progress: Progress = {
      ...prev,
      records,
      abilities,
      trails: [...trails],
      unlockedLevel: Math.max(prev.unlockedLevel, Math.min(5, r.levelId + 1)),
      gameComplete: prev.gameComplete || r.levelId === 5,
    }
    save(PROGRESS_KEY, progress)
    set({
      progress,
      screen: 'complete',
      result: { ...r, newBest, unlockedAbilities, unlockedTrails, gameComplete: r.levelId === 5 },
    })
  },
  failLevel: (reason) => set({ screen: 'failed', failReason: reason }),
  setTrail: (id) => {
    const progress = { ...get().progress, trail: id }
    save(PROGRESS_KEY, progress)
    set({ progress })
  },
  resetProgress: () => {
    const progress = defaultProgress()
    save(PROGRESS_KEY, progress)
    set({ progress, levelId: 1 })
  },
}))

// ---------------- owner unlock ----------------
// `?owner=<key>` grants every rift, ability, trail and Challenge Mode, saved to this browser.
// Only the key's SHA-256 lives here (the repo is public), so the link itself stays private.
const OWNER_HASH = '070a3f45b483ebcdbc7c8fc9c98a58d45bec27881348de7890f66b278d0a46d2'

async function checkOwnerLink() {
  const params = new URLSearchParams(window.location.search)
  const key = params.get('owner')
  if (!key || !crypto?.subtle) return
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  if (hex !== OWNER_HASH) return
  const st = useGame.getState()
  const progress: Progress = {
    ...st.progress,
    unlockedLevel: 5,
    abilities: { doubleJump: true, grapple: true, shield: true, slowField: true },
    trails: TRAILS.map((t) => t.id),
    gameComplete: true,
  }
  practiceLevel = 0
  save(PROGRESS_KEY, progress)
  useGame.setState({ progress })
  // drop the key from the address bar so it isn't shared by accident
  params.delete('owner')
  const qs = params.toString()
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
  st.toast('OWNER ACCESS UNLOCKED', '#ffd23f', 'All rifts, abilities, trails and Challenge Mode')
}
checkOwnerLink()
