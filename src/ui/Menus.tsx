import { useState, type CSSProperties } from 'react'
import { useGame, rankValue, practiceLevel, type Quality } from '../game/store'
import { LEVELS } from '../levels'
import { formatTime } from '../game/scoring'
import { COLORS, TRAILS } from '../game/constants'
import { sfx, unlockAudio } from '../game/audio'
import { requestLock } from '../game/input'

function launch(id: number, challenge = false) {
  unlockAudio()
  sfx.uiConfirm()
  useGame.getState().startLevel(id, challenge)
  requestLock()
}

export function MainMenu() {
  const progress = useGame((s) => s.progress)
  const openSub = useGame((s) => s.openSub)
  const setScreen = useGame((s) => s.setScreen)
  const next = practiceLevel || Math.min(progress.unlockedLevel, 5)
  const nextLevel = LEVELS[next - 1]
  const cleared = Object.keys(progress.records).length
  const sRanks = Object.values(progress.records).filter((r) => rankValue(r.bestRank) >= rankValue('S')).length
  const secrets = Object.values(progress.records).reduce((a, r) => a + r.secrets, 0)
  const totalSecrets = LEVELS.reduce((a, l) => a + l.secrets.length, 0)
  const click = (fn: () => void) => () => {
    unlockAudio()
    sfx.ui()
    fn()
  }
  return (
    <div className="screen menu">
      <div className="logo">
        <div className="kicker">A RIFT TRIAL SIMULATION</div>
        <h1>
          RIFT
          <br />
          RUNNERS
        </h1>
        <div className="tag">ZERO GRAVITY TRIALS</div>
        {practiceLevel > 0 && (
          <div style={{ marginTop: 14, color: COLORS.secret, fontFamily: 'var(--display)', fontSize: 12, letterSpacing: '0.2em' }}>
            PRACTICE LINK · RIFT {practiceLevel} UNLOCKED · PROGRESS NOT SAVED
          </div>
        )}
      </div>
      <div className="menu-buttons">
        <button className="btn primary" onClick={() => launch(next)}>
          ▶ {cleared === 0 ? 'Play' : 'Continue'}
          <span className="hint">
            Rift {next} · {nextLevel.name}
          </span>
        </button>
        <button className="btn" onClick={click(() => setScreen('levelSelect'))}>
          Level Select
        </button>
        <button className="btn" onClick={click(() => openSub('locker'))}>
          Locker
          <span className="hint">{progress.trails.length} / {TRAILS.length} trails</span>
        </button>
        <button className="btn ghost" onClick={click(() => openSub('settings'))}>
          Settings
        </button>
        <button className="btn ghost" onClick={click(() => openSub('controls'))}>
          Controls
        </button>
      </div>
      <div className="menu-stats">
        <div>
          <b>{cleared} / 5</b>RIFTS CLEARED
        </div>
        <div>
          <b>{sRanks}</b>S-RANKS
        </div>
        <div>
          <b>
            {secrets} / {totalSecrets}
          </b>
          SECRETS
        </div>
        {progress.gameComplete && (
          <div>
            <b style={{ color: COLORS.secret }}>UNLOCKED</b>CHALLENGE MODE
          </div>
        )}
      </div>
      <div className="version">v1.0 · WASD + MOUSE · best with headphones</div>
    </div>
  )
}

const LEVEL_ACCENT = ['#36c8ff', '#ff4fd8', '#2ee6ff', '#ff7a1a', '#ff3355']

export function LevelSelect() {
  const progress = useGame((s) => s.progress)
  const setScreen = useGame((s) => s.setScreen)
  const [challenge, setChallenge] = useState(false)
  return (
    <div className="screen dim" style={{ justifyContent: 'flex-start' }}>
      <div className="header-row">
        <div>
          <h2>SELECT RIFT</h2>
          <p className="sub">Clear a rift to unlock the next. Ranks: C · B · A · S · S+</p>
        </div>
        <div className="spacer" />
        <button
          className={`challenge-toggle ${challenge ? 'on' : ''}`}
          disabled={!progress.gameComplete}
          onClick={() => {
            sfx.ui()
            setChallenge(!challenge)
          }}
          title={progress.gameComplete ? '' : 'Defeat the Sentinel to unlock'}
        >
          <span className={`switch ${challenge ? 'on' : ''}`} />
          CHALLENGE MODE {progress.gameComplete ? '' : '🔒'}
        </button>
        <button className="btn small ghost" onClick={() => setScreen('menu')}>
          ◀ Back
        </button>
      </div>
      {challenge && (
        <p style={{ width: 'min(1220px,100%)', color: COLORS.secret, margin: '0 0 14px', letterSpacing: '0.04em' }}>
          Challenge: 60 max HP · enemies hit 50% harder · slower energy regen · beat 160% of par time or fail.
        </p>
      )}
      <div className="levels">
        {LEVELS.map((l, i) => {
          const locked = l.id > progress.unlockedLevel
          const rec = progress.records[l.id]
          const accent = LEVEL_ACCENT[i]
          const rank = challenge ? rec?.challengeBestRank : rec?.bestRank
          return (
            <button
              key={l.id}
              className={`lvl ${locked ? 'locked' : ''}`}
              style={{ '--accent': accent, animationDelay: `${i * 0.06}s` } as CSSProperties}
              onClick={() => (locked ? sfx.denied() : launch(l.id, challenge))}
            >
              <div className="num">{String(l.id).padStart(2, '0')}</div>
              <div className="name">{l.name.toUpperCase()}</div>
              <div className="subt">{l.subtitle}</div>
              <p>{l.blurb}</p>
              <div className="chips">
                {l.introduces.map((x) => (
                  <span key={x} className="chip">
                    {x}
                  </span>
                ))}
              </div>
              <div className="stats">
                <div>
                  <b>{challenge ? (rec?.challengeBestTime ? formatTime(rec.challengeBestTime) : '—') : rec ? formatTime(rec.bestTime) : '—'}</b>
                  best time
                </div>
                {!challenge && (
                  <div>
                    <b>{rec ? rec.bestScore.toLocaleString() : '—'}</b>
                    score
                  </div>
                )}
                <div>
                  <b>
                    {rec?.secrets ?? 0}/{l.secrets.length}
                  </b>
                  secrets
                </div>
                <div className={`rank rank-${rank ?? 'C'}`} style={{ opacity: rank ? 1 : 0.2 }}>
                  {rank ?? '–'}
                </div>
              </div>
              {locked && (
                <div className="lock">
                  <span style={{ fontSize: 26 }}>🔒</span>
                  CLEAR RIFT {l.id - 1}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div className="setting">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{fmt ? fmt(value) : value}</output>
    </div>
  )
}

export function SettingsScreen() {
  const s = useGame((st) => st.settings)
  const set = useGame((st) => st.setSettings)
  const close = useGame((st) => st.closeSub)
  const reset = useGame((st) => st.resetProgress)
  const returnTo = useGame((st) => st.returnTo)
  const [confirm, setConfirm] = useState(false)
  const pct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <div className="screen dim">
      <div className="panel">
        <h2>SETTINGS</h2>
        <p className="sub">Saved automatically.</p>
        <Slider label="Mouse sensitivity" value={s.sensitivity} min={0.2} max={3} step={0.05} onChange={(v) => set({ sensitivity: v })} fmt={(v) => v.toFixed(2)} />
        <div className="setting">
          <label>Invert Y axis</label>
          <div className="seg">
            <button className={!s.invertY ? 'active' : ''} onClick={() => set({ invertY: false })}>
              Off
            </button>
            <button className={s.invertY ? 'active' : ''} onClick={() => set({ invertY: true })}>
              On
            </button>
          </div>
          <span />
        </div>
        <Slider label="Field of view" value={s.fov} min={60} max={100} step={1} onChange={(v) => set({ fov: v })} fmt={(v) => `${v}°`} />
        <Slider label="Master volume" value={s.masterVolume} min={0} max={1} step={0.05} onChange={(v) => set({ masterVolume: v })} fmt={pct} />
        <Slider label="Music volume" value={s.musicVolume} min={0} max={1} step={0.05} onChange={(v) => set({ musicVolume: v })} fmt={pct} />
        <Slider label="Effects volume" value={s.sfxVolume} min={0} max={1} step={0.05} onChange={(v) => set({ sfxVolume: v })} fmt={pct} />
        <Slider label="Screen shake" value={s.screenShake} min={0} max={1.5} step={0.05} onChange={(v) => set({ screenShake: v })} fmt={pct} />
        <div className="setting">
          <label>Graphics quality</label>
          <div className="seg">
            {(['low', 'medium', 'high'] as Quality[]).map((q) => (
              <button key={q} className={s.quality === q ? 'active' : ''} onClick={() => set({ quality: q })}>
                {q}
              </button>
            ))}
          </div>
          <span />
        </div>
        <div className="setting">
          <label>Show FPS</label>
          <div className="seg">
            <button className={!s.showFps ? 'active' : ''} onClick={() => set({ showFps: false })}>
              Off
            </button>
            <button className={s.showFps ? 'active' : ''} onClick={() => set({ showFps: true })}>
              On
            </button>
          </div>
          <span />
        </div>
        <div className="row" style={{ marginTop: 22 }}>
          <button className="btn" onClick={close}>
            ◀ Done
          </button>
          <div className="spacer" />
          {returnTo === 'menu' &&
            (confirm ? (
              <>
                <span style={{ color: COLORS.danger, fontSize: 13 }}>Erase all records & unlocks?</span>
                <button
                  className="btn small danger"
                  onClick={() => {
                    reset()
                    setConfirm(false)
                    sfx.denied()
                  }}
                >
                  Yes, reset
                </button>
                <button className="btn small ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="btn small danger" onClick={() => setConfirm(true)}>
                Reset progress
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

const KEYS: [string, string][] = [
  ['W A S D', 'Move'],
  ['MOUSE', 'Look / aim'],
  ['SPACE', 'Jump · double jump · wall-jump'],
  ['SHIFT', 'Dash (one per airtime)'],
  ['LEFT CLICK', 'Pulse blast'],
  ['E / RIGHT CLICK', 'Grapple · activate switch'],
  ['Q', 'Shield burst'],
  ['F', 'Slow field'],
  ['R', 'Respawn at checkpoint'],
  ['ESC / P', 'Pause'],
]

export function ControlsScreen() {
  const close = useGame((st) => st.closeSub)
  return (
    <div className="screen dim">
      <div className="panel">
        <h2>CONTROLS</h2>
        <p className="sub">Wall-run by sprinting along a wall while holding W. Grapple targets the anchor nearest your crosshair.</p>
        <div className="keys">
          {KEYS.map(([k, d]) => (
            <div key={k} className="key-row">
              <span className="kbd">{k}</span>
              <span>{d}</span>
            </div>
          ))}
        </div>
        <h2 style={{ fontSize: 15, marginTop: 24 }}>VISUAL LANGUAGE</h2>
        <div className="legend">
          {[
            [COLORS.safe, 'Blue — safe / interactable'],
            [COLORS.danger, 'Red — danger / enemy'],
            [COLORS.objective, 'Yellow — objective / core'],
            [COLORS.secret, 'Purple — secret / challenge'],
            [COLORS.checkpoint, 'Green — checkpoint / heal'],
          ].map(([c, t]) => (
            <div key={t}>
              <i style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
              {t}
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 22 }}>
          <button className="btn" onClick={close}>
            ◀ Done
          </button>
        </div>
      </div>
    </div>
  )
}

export function LockerScreen() {
  const progress = useGame((st) => st.progress)
  const setTrail = useGame((st) => st.setTrail)
  const close = useGame((st) => st.closeSub)
  return (
    <div className="screen dim">
      <div className="panel">
        <h2>LOCKER</h2>
        <p className="sub">Energy trails tint your visor, suit lights and dash streaks. Earn more by clearing rifts and chasing ranks.</p>
        <div className="trails">
          {TRAILS.map((t) => {
            const owned = progress.trails.includes(t.id)
            const sel = progress.trail === t.id
            return (
              <button
                key={t.id}
                className={`trail ${sel ? 'sel' : ''} ${owned ? '' : 'locked'}`}
                style={{ '--c': t.color } as CSSProperties}
                onClick={() => {
                  if (!owned) return sfx.denied()
                  sfx.uiConfirm()
                  setTrail(t.id)
                }}
              >
                <span className="sw" style={{ background: t.color, boxShadow: `0 0 14px ${t.color}` }} />
                <span>
                  <b style={{ fontFamily: 'var(--display)', letterSpacing: '0.08em', fontSize: 13 }}>{t.name}</b>
                  <small>{owned ? (sel ? 'Equipped' : 'Owned — click to equip') : `🔒 ${t.requirement}`}</small>
                </span>
              </button>
            )
          })}
        </div>
        <div className="row" style={{ marginTop: 22 }}>
          <button className="btn" onClick={close}>
            ◀ Done
          </button>
        </div>
      </div>
    </div>
  )
}
