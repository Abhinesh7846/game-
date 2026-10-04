import type { Rank, RunResult } from './types'
import type { Runtime } from './runtime'

export function formatTime(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.floor((t * 100) % 100)
  return `${m}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
}

/**
 * Rating (0-100) drives the rank so levels of different length compare fairly.
 * S+ additionally demands a flawless run: no deaths, every secret, at/under par, barely scratched.
 */
export function computeResult(r: Runtime): RunResult {
  const L = r.level!
  const time = r.time
  const par = L.parTime
  const { deaths, damageTaken, kills, cores, secrets, maxCombo, comboScore } = r.stats
  const coresTotal = L.cores.length
  const secretsTotal = L.secrets.length
  const enemiesTotal = Math.max(r.enemiesTotal, 1)

  const timeFrac = time <= par ? 1 : Math.max(0, 1 - (time - par) / (par * 1.5))
  const timeScore = Math.round(4000 * timeFrac)
  const coreScore = cores * 250
  const killScore = kills * 150
  const secretScore = secrets * 1500
  const damagePenalty = -Math.round(damageTaken * 8)
  const deathPenalty = -deaths * 1000
  const base = 5000

  const breakdown = [
    { label: 'Rift cleared', value: base, detail: L.name },
    { label: 'Time bonus', value: timeScore, detail: `${formatTime(time)} / par ${formatTime(par)}` },
    { label: 'Energy cores', value: coreScore, detail: `${cores} / ${coresTotal}` },
    { label: 'Enemies defeated', value: killScore, detail: `${kills}` },
    { label: 'Secrets found', value: secretScore, detail: `${secrets} / ${secretsTotal}` },
    { label: 'Combo score', value: Math.round(comboScore), detail: `best chain x${maxCombo}` },
    { label: 'Damage taken', value: damagePenalty, detail: `${Math.round(damageTaken)} HP` },
    { label: 'Deaths', value: deathPenalty, detail: `${deaths}` },
  ]
  const score = Math.max(0, breakdown.reduce((a, b) => a + b.value, 0))

  const rating =
    35 * timeFrac +
    Math.max(0, 20 - damageTaken / 10) +
    Math.max(0, 20 - deaths * 8) +
    10 * (coresTotal ? cores / coresTotal : 1) +
    5 * Math.min(1, kills / enemiesTotal) +
    Math.min(10, maxCombo)

  let rank: Rank = 'C'
  if (rating >= 50) rank = 'B'
  if (rating >= 70) rank = 'A'
  if (rating >= 84) rank = 'S'
  if (rank === 'S' && deaths === 0 && secrets === secretsTotal && time <= par && damageTaken <= 35) rank = 'S+'

  return {
    levelId: L.id,
    challenge: r.challenge,
    time,
    parTime: par,
    cores,
    coresTotal,
    kills,
    enemiesTotal: r.enemiesTotal,
    secrets,
    secretsTotal,
    damageTaken,
    deaths,
    maxCombo,
    comboScore,
    breakdown,
    score,
    rank,
    rating,
    newBest: false,
    unlockedAbilities: L.unlocks,
    unlockedTrails: [],
    gameComplete: false,
  }
}
