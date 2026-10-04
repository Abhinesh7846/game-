import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { useGame } from '../game/store'
import { GameWorld } from './GameWorld'
import { MenuScene } from './MenuScene'
import { PostFX } from './fx/PostFX'
import { requestLock } from '../game/input'

const IN_GAME = new Set(['playing', 'paused', 'complete', 'failed'])

export function GameCanvas() {
  const screen = useGame((s) => s.screen)
  const quality = useGame((s) => s.settings.quality)
  const fov = useGame((s) => s.settings.fov)
  const levelId = useGame((s) => s.levelId)
  const challenge = useGame((s) => s.challenge)
  const runKey = useGame((s) => s.runKey)
  const inGame = IN_GAME.has(screen)
  const dpr: [number, number] = quality === 'high' ? [1, 2] : quality === 'medium' ? [1, 1.25] : [0.75, 1]

  return (
    <Canvas
      shadows
      dpr={dpr}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', stencil: false }}
      camera={{ fov, near: 0.1, far: 700, position: [0, 3, 10] }}
      onPointerDown={() => {
        if (useGame.getState().screen === 'playing') requestLock()
      }}
    >
      {inGame ? <GameWorld key={runKey} levelId={levelId} challenge={challenge} /> : <MenuScene />}
      <PostFX />
      {import.meta.env.DEV && <DevHooks />}
    </Canvas>
  )
}

/** Dev only: lets automated tests step frames while the tab is backgrounded (rAF throttled). */
function DevHooks() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    ;(window as unknown as { __r3f: unknown; __game: unknown }).__r3f = get
    ;(window as unknown as { __game: unknown }).__game = useGame
  }, [get])
  return null
}
