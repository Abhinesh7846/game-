import type { CSSProperties } from 'react'
import { useGame } from '../game/store'
import { getLevel } from '../levels'
import { formatTime } from '../game/scoring'
import { ABILITY_INFO, COLORS, TRAILS } from '../game/constants'
import { sfx, unlockAudio } from '../game/audio'
import { requestLock } from '../game/input'

function resume() {
  unlockAudio()
  sfx.ui()
  useGame.getState().setScreen('playing')
  requestLock()
}

export function PauseMenu() {
  const levelId = useGame((s) => s.levelId)
  const hud = useGame((s) => s.hud)
  const st = useGame.getState()
  const level = getLevel(levelId)
  return (
    <div className="screen dim">
      <div className="panel" style={{ width: 'min(520px, 100%)', textAlign: 'center' }}>
        <h2>PAUSED</h2>
        <p className="sub">
          Rift {level.id} · {level.name} — {formatTime(hud.time)} · cores {hud.cores}/{hud.coresRequired}
        </p>
        <div className="pause-list">
          <button className="btn primary" onClick={resume}>
            ▶ Resume
          </button>
          <button
            className="btn"
            onClick={() => {
              sfx.uiConfirm()
              st.restartLevel()
              requestLock()
            }}
          >
            ↻ Restart Rift
          </button>
          <button className="btn ghost" onClick={() => st.openSub('settings')}>
            Settings
          </button>
          <button className="btn ghost" onClick={() => st.openSub('controls')}>
            Controls
          </button>
          <button
            className="btn danger"
            onClick={() => {
              sfx.ui()
              st.quitToMenu()
            }}
          >
            Quit to Menu
          </button>
        </div>
      </div>
    </div>
  )
}

export function LevelComplete() {
  const r = useGame((s) => s.result)
  const st = useGame.getState()
  if (!r) return null
  const level = getLevel(r.levelId)
  const next = r.levelId < 5 ? getLevel(r.levelId + 1) : null
  return (
    <div className="screen dim">
      {r.gameComplete && <div className="victory-banner">RIFT CONQUERED</div>}
      <div className="panel" style={{ width: 'min(940px, 100%)' }}>
        <h2>{r.gameComplete ? 'THE SENTINEL HAS FALLEN' : 'EXTRACTION COMPLETE'}</h2>
        <p className="sub">
          Rift {level.id} · {level.name} {r.challenge && <span style={{ color: COLORS.secret }}>· CHALLENGE MODE</span>}
        </p>
        <div className="results">
          <div className="breakdown">
            {r.breakdown.map((b, i) => (
              <div key={b.label} className="line" style={{ animationDelay: `${0.08 * i}s` }}>
                <span>{b.label}</span>
                <span>{b.detail}</span>
                <b className={b.value < 0 ? 'neg' : ''}>
                  {b.value > 0 ? '+' : ''}
                  {b.value.toLocaleString()}
                </b>
              </div>
            ))}
            <div className="total">
              <span>TOTAL SCORE</span>
              <b>{r.score.toLocaleString()}</b>
            </div>
          </div>
          <div className="rankbox">
            <div className="rl">RANK</div>
            <div className={`rank-letter rank-${r.rank}`}>{r.rank}</div>
            <div className="rl" style={{ marginTop: 4 }}>
              RATING {Math.round(r.rating)}
            </div>
            {r.newBest && <span className="badge">{r.challenge ? 'NEW BEST TIME' : 'NEW HIGH SCORE'}</span>}
            {r.rank !== 'S+' && (
              <p style={{ color: 'var(--dim)', fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>
                S+ needs: par time, no deaths, all secrets, ≤35 damage.
              </p>
            )}
            <div className="unlocks">
              {r.unlockedAbilities.map((a) => (
                <div key={a} className="unlock">
                  <b>NEW ABILITY · {ABILITY_INFO[a].name.toUpperCase()}</b>
                  <span>
                    [{ABILITY_INFO[a].key}] {ABILITY_INFO[a].desc}
                  </span>
                </div>
              ))}
              {r.unlockedTrails.map((t) => {
                const td = TRAILS.find((x) => x.id === t)!
                return (
                  <div key={t} className="unlock" style={{ '--uc': td.color } as CSSProperties}>
                    <b>TRAIL UNLOCKED · {td.name.toUpperCase()}</b>
                    <span>Equip it in the Locker</span>
                  </div>
                )
              })}
              {r.gameComplete && (
                <div className="unlock" style={{ '--uc': COLORS.secret } as CSSProperties}>
                  <b>CHALLENGE MODE UNLOCKED</b>
                  <span>Replay any rift with brutal modifiers from Level Select</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 24 }}>
          {next && !r.challenge && (
            <button
              className="btn primary"
              onClick={() => {
                unlockAudio()
                sfx.uiConfirm()
                st.startLevel(next.id)
                requestLock()
              }}
            >
              Next Rift ▶ {next.name}
            </button>
          )}
          <button
            className="btn"
            onClick={() => {
              sfx.uiConfirm()
              st.restartLevel()
              requestLock()
            }}
          >
            ↻ Retry
          </button>
          <button className="btn ghost" onClick={() => st.setScreen('levelSelect')}>
            Level Select
          </button>
          <button className="btn ghost" onClick={() => st.quitToMenu()}>
            Main Menu
          </button>
        </div>
        <p style={{ color: 'var(--dim)', fontSize: 12, marginTop: 14 }}>
          Time {formatTime(r.time)} · par {formatTime(r.parTime)} · kills {r.kills} · deaths {r.deaths} · best combo ×{r.maxCombo}
        </p>
      </div>
    </div>
  )
}

export function FailedScreen() {
  const reason = useGame((s) => s.failReason)
  const st = useGame.getState()
  return (
    <div className="screen dim">
      <div className="panel" style={{ width: 'min(520px, 100%)', textAlign: 'center' }}>
        <h2 style={{ color: COLORS.danger }}>TRIAL FAILED</h2>
        <p className="sub">{reason}</p>
        <div className="pause-list">
          <button
            className="btn primary"
            onClick={() => {
              sfx.uiConfirm()
              st.restartLevel()
              requestLock()
            }}
          >
            ↻ Try Again
          </button>
          <button className="btn ghost" onClick={() => st.setScreen('levelSelect')}>
            Level Select
          </button>
          <button className="btn danger" onClick={() => st.quitToMenu()}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  )
}
