import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'
import { resetRuntime, rt } from '../game/runtime'
import { useGame } from '../game/store'
import { getLevel } from '../levels'
import { resetCamera } from '../systems/player'
import { GameLoop } from './GameLoop'
import { PlayerBody, PlayerVisual } from './Player'
import { Crystals, Cubes, Gates, Movers, StaticGeometry, TimedPlatforms } from './world/Geometry'
import { Anchors, Checkpoints, Cores, Hazards, Lasers, Pads, Pickups, Plates, Portal, Secrets, Surges, Switches } from './world/Props'
import { Enemies, Projectiles } from './enemies/Enemies'
import { Boss } from './enemies/Boss'
import { Particles, Shockwaves } from './fx/Particles'
import { Debris, Sky } from './fx/Sky'

/** One playable run. Keyed by runKey, so restarting remounts physics + runtime from scratch. */
export function GameWorld({ levelId, challenge }: { levelId: number; challenge: boolean }) {
  const level = getLevel(levelId)
  // runtime must exist before any child reads it during render
  useMemo(() => {
    resetRuntime(level, challenge)
    resetCamera()
  }, [level, challenge])
  const playing = useGame((s) => s.screen === 'playing')
  const quality = useGame((s) => s.settings.quality)
  const center = useMemo(() => {
    const p = level.portal
    return [p[0] / 2, 0, p[2] / 2] as [number, number, number]
  }, [level])

  return (
    <>
      <color attach="background" args={[level.theme.fog]} />
      <fog attach="fog" args={[level.theme.fog, 45, 300]} />
      <Sky theme={level.theme} />
      <Debris accent={level.theme.accent} center={center} />
      <hemisphereLight args={[level.theme.sun, '#0a0a14', 0.9]} />
      <ambientLight intensity={0.25} />
      <SunLight color={level.theme.sun} shadows={quality === 'high'} />
      <PlayerLight color={level.theme.accent} />

      <Suspense fallback={null}>
        <Physics timeStep="vary" paused={!playing} gravity={[0, -24, 0]}>
          <GameLoop />
          <StaticGeometry level={level} />
          <Movers level={level} />
          <TimedPlatforms level={level} />
          <Gates level={level} />
          <Crystals level={level} />
          <Cubes level={level} />
          <PlayerBody />
        </Physics>
      </Suspense>

      <Cores level={level} />
      <Secrets level={level} />
      <Pickups level={level} />
      <Checkpoints level={level} />
      <Pads level={level} />
      <Switches level={level} />
      <Plates level={level} />
      <Anchors />
      <Portal level={level} />
      <Hazards level={level} />
      <Surges level={level} />
      <Lasers level={level} />
      <Enemies />
      <Projectiles />
      {level.boss && <Boss />}
      <PlayerVisual />
      <Particles />
      <Shockwaves />
    </>
  )
}

function SunLight({ color, shadows }: { color: string; shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const tgt = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const l = light.current
    if (!l) return
    const p = rt.player.pos
    l.position.set(p.x - 25, p.y + 45, p.z + 18)
    tgt.position.copy(p)
    tgt.updateMatrixWorld()
  })
  return (
    <>
      <primitive object={tgt} />
      <directionalLight
        ref={light}
        target={tgt}
        color={color}
        intensity={1.6}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0005}
      />
    </>
  )
}

function PlayerLight({ color }: { color: string }) {
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const p = rt.player.pos
    light.current?.position.set(p.x, p.y + 2.2, p.z)
  })
  return <pointLight ref={light} color={color} intensity={18} distance={14} decay={2} />
}
