import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useGame, type HudAbility } from '../game/store'
import { rt } from '../game/runtime'
import { formatTime } from '../game/scoring'
import { getLevel } from '../levels'
import { COLORS } from '../game/constants'
import { isTouchDevice } from '../game/input'
import { touchHint } from './TouchControls'

const touch = isTouchDevice()

const ICONS: Record<string, ReactNode> = {
  dash: <path d="M3 12h11M10 6l6 6-6 6M17 6l4 6-4 6" />,
  pulse: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3a9 9 0 0 1 9 9M3 12a9 9 0 0 1 9-9M12 21a9 9 0 0 1-9-9M21 12a9 9 0 0 1-9 9" />
    </>
  ),
  grapple: <path d="M5 19L17 7M13 5h6v6M5 19l-2 2" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  slowField: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </>
  ),
}

function Ability({ a, energy }: { a: HudAbility; energy: number }) {
  const ready = a.ready >= 0.999 && !a.locked
  const affordable = energy >= a.cost
  return (
    <div className={`ab ${a.locked ? 'locked' : ''} ${ready && affordable ? 'ready' : ''} ${a.active ? 'active' : ''} ${affordable ? '' : 'nocost'}`}>
      <span className="key">{a.key}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke={a.locked ? '#667' : '#cfe9ff'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[a.id]}
      </svg>
      <span className="nm">{a.locked ? 'Locked' : a.label}</span>
      {!a.locked && a.cost > 0 && <span className="cost">{a.cost}</span>}
      {!a.locked && a.ready < 1 && <div className="cd" style={{ transform: `scaleY(${1 - Math.max(0, a.ready)})` }} />}
    </div>
  )
}

/** Fast-moving bits (markers, hit flash, vignette) are driven straight from rt.ui every animation frame. */
function LiveLayer() {
  const marker = useRef<HTMLDivElement>(null)
  const markerD = useRef<HTMLDivElement>(null)
  const gmark = useRef<HTMLDivElement>(null)
  const hit = useRef<HTMLDivElement>(null)
  const vig = useRef<HTMLDivElement>(null)
  const fps = useRef<HTMLDivElement>(null)
  const showFps = useGame((s) => s.settings.showFps)
  useEffect(() => {
    let raf = 0
    let frames = 0
    let last = performance.now()
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const w = window.innerWidth
      const h = window.innerHeight
      const m = rt.ui.marker
      if (marker.current) {
        marker.current.style.display = m.visible ? 'flex' : 'none'
        marker.current.style.transform = `translate(${((m.x + 1) / 2) * w}px, ${((1 - m.y) / 2) * h}px) translate(-50%, -50%)`
        marker.current.style.setProperty('--mc', m.color)
        if (markerD.current) markerD.current.textContent = `${Math.round(m.dist)}m`
      }
      const g = rt.ui.grapple
      if (gmark.current) {
        gmark.current.style.display = g.visible ? 'block' : 'none'
        gmark.current.style.left = `${((g.x + 1) / 2) * w}px`
        gmark.current.style.top = `${((1 - g.y) / 2) * h}px`
      }
      if (hit.current) hit.current.style.opacity = String(rt.ui.hitMarker)
      if (vig.current) {
        const p = rt.player
        const low = p.health / p.maxHealth < 0.3 && !p.dead ? 0.35 + Math.sin(performance.now() / 180) * 0.15 : 0
        vig.current.style.opacity = String(Math.max(rt.ui.damageFlash * 0.9, low))
      }
      frames++
      const now = performance.now()
      if (now - last > 500) {
        if (fps.current) fps.current.textContent = `${Math.round((frames * 1000) / (now - last))} FPS`
        frames = 0
        last = now
      }
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <>
      <div ref={vig} className="vignette" />
      <div ref={marker} className="marker" style={{ display: 'none' }}>
        <div className="gem" />
        <div ref={markerD} className="d" />
      </div>
      <div ref={gmark} className="gmark" style={{ display: 'none' }} />
      <div className="crosshair">
        <i className="dot" />
        <i className="t" />
        <i className="b" />
        <i className="l" />
        <i className="r" />
      </div>
      <div ref={hit} className="hitmark" />
      {showFps && <div ref={fps} className="fps" />}
    </>
  )
}

export function HUD() {
  const hud = useGame((s) => s.hud)
  const toasts = useGame((s) => s.toasts)
  const levelId = useGame((s) => s.levelId)
  const challenge = useGame((s) => s.challenge)
  const level = getLevel(levelId)
  const [locked, setLocked] = useState(!!document.pointerLockElement)
  useEffect(() => {
    const on = () => setLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', on)
    return () => document.removeEventListener('pointerlockchange', on)
  }, [])

  const hpLow = hud.health / (challenge ? 60 : 100) < 0.3
  const maxHp = challenge ? 60 : 100
  const remaining = hud.timeLimit ? hud.timeLimit - hud.time : 0
  return (
    <div className="hud">
      {hud.slowActive && <div className="slowtint" />}
      {hud.shieldActive && <div className="shieldtint" />}
      <LiveLayer />

      <div className="hud-tl">
        <div className="hud-level">
          RIFT {level.id} · {level.name.toUpperCase()} {challenge && <span style={{ color: COLORS.secret }}>· CHALLENGE</span>}
        </div>
        {hud.objective && (
          <div className="hud-obj" style={{ '--oc': hud.boss ? COLORS.danger : COLORS.objective } as CSSProperties}>
            {hud.objective}
          </div>
        )}
      </div>

      <div className="hud-tc">
        <div className="hud-time">{formatTime(hud.time)}</div>
        {hud.timeLimit > 0 && <div className={`hud-limit ${remaining < 15 ? 'warn' : ''}`}>LIMIT {formatTime(Math.max(0, remaining))}</div>}
        {hud.boss && (
          <div className={`boss-bar ${hud.boss.shielded ? 'shielded' : ''}`}>
            <div className="label">
              <span>THE SENTINEL</span>
              <span>{hud.boss.shielded ? 'SHIELDED' : `PHASE ${hud.boss.phase} · ${hud.boss.label}`}</span>
            </div>
            <div className="track">
              <div className="fill" style={{ transform: `scaleX(${hud.boss.hp})` }} />
            </div>
            <div className="pips">
              {[1, 2, 3, 4].map((n) => (
                <i key={n} className={n < hud.boss!.phase ? 'done' : n === hud.boss!.phase ? 'cur' : ''} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="hud-tr">
        {hud.coresTotal > 0 && (
          <div className="counter">
            <i style={{ background: COLORS.objective, boxShadow: `0 0 10px ${COLORS.objective}` }} />
            {hud.cores}
            <small>
              / {hud.coresRequired || hud.coresTotal}
              {hud.coresTotal > hud.coresRequired && hud.coresRequired > 0 ? ` (${hud.coresTotal})` : ''}
            </small>
          </div>
        )}
        {hud.secretsTotal > 0 && (
          <div className="counter" style={{ fontSize: 15 }}>
            <i style={{ background: COLORS.secret, boxShadow: `0 0 10px ${COLORS.secret}`, width: 10, height: 10 }} />
            {hud.secrets}
            <small>/ {hud.secretsTotal}</small>
          </div>
        )}
        <div className="score">{hud.score.toLocaleString()} PTS</div>
        {hud.combo >= 2 && (
          <div className="combo" key={hud.combo}>
            <div className="x">×{hud.multiplier.toFixed(1)}</div>
            <div className="lbl">COMBO {hud.combo}</div>
            <div className="bar">
              <div style={{ transform: `scaleX(${Math.max(0, hud.comboTimer)})` }} />
            </div>
          </div>
        )}
      </div>

      <div className="hud-bl">
        <div className={`meter health ${hpLow ? 'low' : ''}`}>
          <div className="top">
            <span>INTEGRITY</span>
            <b>{Math.ceil(hud.health)}</b>
          </div>
          <div className="track">
            <div className="fill" style={{ transform: `scaleX(${hud.health / maxHp})` }} />
            <div className="ticks" />
          </div>
        </div>
        <div className="meter energy">
          <div className="top">
            <span>ENERGY</span>
            <b>{Math.floor(hud.energy)}</b>
          </div>
          <div className="track">
            <div className="fill" style={{ transform: `scaleX(${hud.energy / 100})` }} />
            <div className="ticks" />
          </div>
        </div>
      </div>

      <div className="hud-bc">
        {hud.abilities.map((a) => (
          <Ability key={a.id} a={a} energy={hud.energy} />
        ))}
      </div>

      {hud.hint && !hud.dead && (
        <div className="hint" key={hud.hint}>
          {touch ? touchHint(hud.hint) : hud.hint}
        </div>
      )}
      {hud.prompt && !hud.dead && <div className="prompt">{hud.prompt}</div>}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast" style={{ '--tc': t.color } as CSSProperties}>
            <b>{t.text}</b>
            {t.sub && <span>{t.sub}</span>}
          </div>
        ))}
      </div>

      {hud.dead && (
        <div className="death">
          <h2>SIGNAL LOST</h2>
          <p>{hud.deathReason || 'Runner down'}</p>
          <p style={{ color: COLORS.checkpoint }}>Rebuilding at last checkpoint…</p>
        </div>
      )}
      {!locked && !hud.dead && <div className="lockhint">CLICK TO CAPTURE MOUSE</div>}
    </div>
  )
}
