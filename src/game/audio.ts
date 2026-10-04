/** Fully synthesized audio: no asset files. SFX are short oscillator/noise envelopes; music is a tiny step sequencer. */

type MusicMood = 'menu' | 'level' | 'boss' | 'off'

let ctx: AudioContext | null = null
let master: GainNode
let sfxBus: GainNode
let musicBus: GainNode
let noiseBuf: AudioBuffer
let vols = { master: 0.8, music: 0.45, sfx: 0.8 }

function ensure(): AudioContext | null {
  if (ctx) return ctx
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
  } catch {
    return null
  }
  master = ctx.createGain()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  master.connect(comp).connect(ctx.destination)
  sfxBus = ctx.createGain()
  musicBus = ctx.createGain()
  sfxBus.connect(master)
  musicBus.connect(master)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  applyVolumes()
  return ctx
}

function applyVolumes() {
  if (!ctx) return
  master.gain.value = vols.master
  sfxBus.gain.value = vols.sfx * 0.55
  musicBus.gain.value = vols.music * 0.35
}

export function setVolumes(master: number, music: number, sfx: number) {
  vols = { master, music, sfx }
  applyVolumes()
}

/** Must be called from a user gesture at least once. */
export function unlockAudio() {
  const c = ensure()
  if (c && c.state === 'suspended') c.resume()
}

function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; to?: number; vol?: number; delay?: number; attack?: number; bus?: GainNode; filter?: number } = {},
) {
  const c = ensure()
  if (!c) return
  const t = c.currentTime + (opts.delay ?? 0)
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = opts.type ?? 'sine'
  o.frequency.setValueAtTime(freq, t)
  if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur)
  const vol = opts.vol ?? 0.3
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack ?? 0.005))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  let node: AudioNode = o
  if (opts.filter) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = opts.filter
    o.connect(f)
    node = f
  }
  node.connect(g).connect(opts.bus ?? sfxBus)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function noise(dur: number, opts: { vol?: number; freq?: number; to?: number; q?: number; delay?: number; type?: BiquadFilterType; bus?: GainNode } = {}) {
  const c = ensure()
  if (!c) return
  const t = c.currentTime + (opts.delay ?? 0)
  const s = c.createBufferSource()
  s.buffer = noiseBuf
  const f = c.createBiquadFilter()
  f.type = opts.type ?? 'bandpass'
  f.Q.value = opts.q ?? 1
  f.frequency.setValueAtTime(opts.freq ?? 1200, t)
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(opts.vol ?? 0.3, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f).connect(g).connect(opts.bus ?? sfxBus)
  s.start(t, Math.random() * 0.5)
  s.stop(t + dur + 0.05)
}

let lastStep = 0
export const sfx = {
  jump: () => tone(320, 0.14, { type: 'square', to: 640, vol: 0.12, filter: 2200 }),
  doubleJump: () => {
    tone(420, 0.16, { type: 'square', to: 900, vol: 0.12, filter: 2600 })
    noise(0.18, { freq: 3000, to: 6000, vol: 0.08 })
  },
  land: () => noise(0.08, { freq: 400, vol: 0.12, type: 'lowpass' }),
  step: () => {
    const now = performance.now()
    if (now - lastStep < 60) return
    lastStep = now
    noise(0.04, { freq: 900, vol: 0.04 })
  },
  dash: () => {
    noise(0.28, { freq: 800, to: 4000, vol: 0.35, q: 0.7 })
    tone(180, 0.2, { type: 'sawtooth', to: 90, vol: 0.08, filter: 900 })
  },
  wallRun: () => noise(0.2, { freq: 2000, to: 1200, vol: 0.08 }),
  grapple: () => {
    tone(1400, 0.12, { type: 'square', to: 500, vol: 0.08, filter: 3000 })
    noise(0.35, { freq: 1500, to: 300, vol: 0.18 })
  },
  pulse: () => {
    tone(140, 0.28, { type: 'sine', to: 50, vol: 0.5 })
    noise(0.22, { freq: 2400, to: 400, vol: 0.3 })
    tone(900, 0.12, { type: 'sawtooth', to: 200, vol: 0.06, filter: 2400 })
  },
  shield: () => {
    tone(300, 0.6, { type: 'triangle', to: 900, vol: 0.18 })
    tone(450, 0.6, { type: 'sine', to: 1350, vol: 0.12, delay: 0.03 })
  },
  slow: () => {
    tone(600, 1.0, { type: 'sine', to: 120, vol: 0.25 })
    noise(1.0, { freq: 2000, to: 200, vol: 0.12 })
  },
  core: () => {
    ;[880, 1108, 1318, 1760].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.14, delay: i * 0.05 }))
  },
  secret: () => {
    ;[523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, { type: 'sine', vol: 0.14, delay: i * 0.08 }))
  },
  checkpoint: () => {
    ;[392, 494, 587].forEach((f) => tone(f, 0.6, { type: 'triangle', vol: 0.12 }))
    tone(784, 0.5, { type: 'sine', vol: 0.1, delay: 0.12 })
  },
  heal: () => tone(500, 0.35, { type: 'sine', to: 1000, vol: 0.15 }),
  gate: () => {
    tone(200, 0.5, { type: 'sawtooth', to: 600, vol: 0.12, filter: 1500 })
    noise(0.5, { freq: 600, to: 3000, vol: 0.12 })
  },
  switch: () => {
    tone(700, 0.08, { type: 'square', vol: 0.12, filter: 3000 })
    tone(1050, 0.12, { type: 'square', vol: 0.1, delay: 0.07, filter: 3000 })
  },
  plate: () => tone(260, 0.15, { type: 'square', vol: 0.08, filter: 1200 }),
  jumpPad: () => tone(200, 0.35, { type: 'sine', to: 1200, vol: 0.25 }),
  hurt: () => {
    noise(0.2, { freq: 600, vol: 0.35, q: 0.6 })
    tone(220, 0.2, { type: 'sawtooth', to: 110, vol: 0.12, filter: 1000 })
  },
  enemyHit: () => tone(1200, 0.07, { type: 'square', to: 600, vol: 0.08, filter: 4000 }),
  shielded: () => tone(2000, 0.1, { type: 'triangle', to: 1500, vol: 0.08 }),
  enemyShoot: () => tone(900, 0.16, { type: 'sawtooth', to: 300, vol: 0.06, filter: 2500 }),
  charge: () => tone(300, 0.4, { type: 'sine', to: 900, vol: 0.05 }),
  explode: () => {
    noise(0.6, { freq: 900, to: 80, vol: 0.55, type: 'lowpass' })
    tone(90, 0.5, { type: 'sine', to: 30, vol: 0.5 })
  },
  bigExplode: () => {
    noise(1.8, { freq: 1500, to: 40, vol: 0.7, type: 'lowpass' })
    tone(70, 1.5, { type: 'sine', to: 20, vol: 0.6 })
    tone(55, 1.8, { type: 'sawtooth', to: 25, vol: 0.2, filter: 300 })
  },
  laser: () => noise(0.12, { freq: 3500, vol: 0.1 }),
  death: () => {
    tone(600, 0.9, { type: 'sawtooth', to: 60, vol: 0.18, filter: 1600 })
    noise(0.8, { freq: 1200, to: 100, vol: 0.25 })
  },
  portal: () => {
    ;[523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.12, delay: i * 0.06 }))
    noise(1.2, { freq: 400, to: 5000, vol: 0.15 })
  },
  boss: () => {
    tone(55, 1.6, { type: 'sawtooth', vol: 0.3, filter: 400 })
    tone(82, 1.6, { type: 'sawtooth', vol: 0.2, filter: 400, delay: 0.2 })
  },
  ui: () => tone(1200, 0.05, { type: 'square', vol: 0.05, filter: 4000 }),
  uiConfirm: () => {
    tone(880, 0.08, { type: 'square', vol: 0.06, filter: 4000 })
    tone(1320, 0.1, { type: 'square', vol: 0.06, filter: 4000, delay: 0.06 })
  },
  denied: () => tone(180, 0.18, { type: 'square', vol: 0.08, filter: 800 }),
  combo: (n: number) => tone(600 + Math.min(n, 12) * 60, 0.08, { type: 'triangle', vol: 0.08 }),
}

// ---------------- music ----------------
let mood: MusicMood = 'off'
let timer: number | null = null
let step = 0
let nextTime = 0

const ROOTS = [45, 45, 41, 43] // A, A, F, G (midi)
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

function scheduleStep(t: number, s: number) {
  if (!ctx) return
  const bar = Math.floor(s / 16) % 4
  const i = s % 16
  const root = ROOTS[bar] + (mood === 'boss' ? -2 : 0)
  const bus = musicBus
  const play = (m: number, dur: number, type: OscillatorType, vol: number, filter: number) => {
    const o = ctx!.createOscillator()
    const g = ctx!.createGain()
    const f = ctx!.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = filter
    o.type = type
    o.frequency.value = mtof(m)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(f).connect(g).connect(bus)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
  if (mood === 'menu') {
    if (i % 4 === 0) play(root, 0.9, 'sawtooth', 0.12, 500)
    const arp = [0, 7, 12, 15, 19, 15, 12, 7]
    if (i % 2 === 0) play(root + 24 + arp[(i / 2) % 8], 0.3, 'triangle', 0.05, 3000)
    if (i === 0) [0, 3, 7, 10].forEach((n) => play(root + 12 + n, 3.5, 'sine', 0.03, 1200))
    return
  }
  // driving level / boss groove
  const kick = mood === 'boss' ? i % 4 === 0 || i === 14 : i % 4 === 0
  if (kick) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15)
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    o.connect(g).connect(bus)
    o.start(t)
    o.stop(t + 0.25)
  }
  if (i % 2 === 1) {
    const s2 = ctx.createBufferSource()
    s2.buffer = noiseBuf
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 7000
    const g = ctx.createGain()
    g.gain.setValueAtTime(i % 4 === 3 ? 0.12 : 0.05, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    s2.connect(f).connect(g).connect(bus)
    s2.start(t, Math.random() * 0.5)
    s2.stop(t + 0.08)
  }
  const bassPat = [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 7, 0, 12, 10]
  play(root + bassPat[i] - 12, 0.18, 'sawtooth', 0.14, mood === 'boss' ? 900 : 650)
  if (i % 4 === 2) {
    const lead = [12, 15, 19, 22]
    play(root + 24 + lead[(s / 4) % 4 | 0], 0.25, 'square', 0.035, 2400)
  }
}

export function setMusic(m: MusicMood) {
  if (m === mood) return
  mood = m
  if (timer != null) {
    clearInterval(timer)
    timer = null
  }
  if (m === 'off') return
  const c = ensure()
  if (!c) return
  step = 0
  nextTime = c.currentTime + 0.1
  const bpm = m === 'boss' ? 138 : m === 'level' ? 122 : 96
  const stepDur = 60 / bpm / 4
  timer = window.setInterval(() => {
    if (!ctx) return
    while (nextTime < ctx.currentTime + 0.2) {
      scheduleStep(nextTime, step++)
      nextTime += stepDur
    }
  }, 50)
}
