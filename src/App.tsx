import { Suspense, useEffect, type CSSProperties } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { useGame } from './game/store'
import { input, installInput, releaseLock } from './game/input'
import { setMusic, setVolumes } from './game/audio'
import { rt } from './game/runtime'
import { HUD } from './ui/HUD'
import { ControlsScreen, LevelSelect, LockerScreen, MainMenu, SettingsScreen } from './ui/Menus'
import { FailedScreen, LevelComplete, PauseMenu } from './ui/Screens'

export default function App() {
  const screen = useGame((s) => s.screen)
  const returnTo = useGame((s) => s.returnTo)
  const settings = useGame((s) => s.settings)
  const toasts = useGame((s) => s.toasts)

  useEffect(() => {
    installInput()
    // losing pointer lock mid-run (ESC) pauses the game
    const onLock = () => {
      const st = useGame.getState()
      if (!document.pointerLockElement && st.screen === 'playing' && !rt.completed && hadLock) st.setScreen('paused')
      hadLock = !!document.pointerLockElement
    }
    let hadLock = false
    const onKey = (e: KeyboardEvent) => {
      const st = useGame.getState()
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (st.screen === 'playing' && !rt.completed) {
          st.setScreen('paused')
          releaseLock()
        } else if (st.screen === 'paused' && e.code === 'KeyP') {
          st.setScreen('playing')
        } else if (['settings', 'controls', 'locker'].includes(st.screen)) st.closeSub()
        else if (st.screen === 'levelSelect') st.setScreen('menu')
      }
    }
    document.addEventListener('pointerlockchange', onLock)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerlockchange', onLock)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    setVolumes(settings.masterVolume, settings.musicVolume, settings.sfxVolume)
  }, [settings.masterVolume, settings.musicVolume, settings.sfxVolume])

  useEffect(() => {
    input.clear() // never carry a press from a menu into gameplay (or back)
    const inRun = ['playing', 'paused', 'complete', 'failed'].includes(screen) || (['settings', 'controls'].includes(screen) && returnTo === 'paused')
    if (inRun) {
      if (!rt.boss?.active) setMusic('level')
    } else setMusic('menu')
  }, [screen, returnTo])

  const sub = screen === 'settings' || screen === 'controls'
  const hudVisible = screen === 'playing' || screen === 'paused' || (sub && returnTo === 'paused')
  return (
    <div className="app">
      <Suspense fallback={<div className="loading">INITIALISING RIFT…</div>}>
        <GameCanvas />
      </Suspense>
      <div className="overlay">
        {hudVisible ? (
          <HUD />
        ) : (
          <div className="toasts" style={{ zIndex: 5, pointerEvents: 'none' }}>
            {toasts.map((t) => (
              <div key={t.id} className="toast" style={{ '--tc': t.color } as CSSProperties}>
                <b>{t.text}</b>
                {t.sub && <span>{t.sub}</span>}
              </div>
            ))}
          </div>
        )}
        {screen === 'menu' && <MainMenu />}
        {screen === 'levelSelect' && <LevelSelect />}
        {screen === 'settings' && <SettingsScreen />}
        {screen === 'controls' && <ControlsScreen />}
        {screen === 'locker' && <LockerScreen />}
        {screen === 'paused' && <PauseMenu />}
        {screen === 'complete' && <LevelComplete />}
        {screen === 'failed' && <FailedScreen />}
      </div>
    </div>
  )
}
