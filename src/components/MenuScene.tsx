import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RunnerModel } from '../procedural-assets/RunnerModel'
import { surfaceMaterials, glow } from '../procedural-assets/materials'
import { COLORS, TRAILS } from '../game/constants'
import { useGame } from '../game/store'
import { Debris, Sky, mulberry } from './fx/Sky'
import { edgeMat, unitBox, unitEdges } from './world/Geometry'

const theme = {
  skyTop: '#03030f',
  skyBottom: '#28104a',
  fog: '#0d0820',
  accent: '#36c8ff',
  sun: '#c9a8ff',
  nebula: '#6a3cff',
}

/** Slowly orbiting diorama behind the menus: a runner on a floating platform beside a live portal. */
export function MenuScene() {
  const mats = surfaceMaterials(theme.accent)
  const trailId = useGame((s) => s.progress.trail)
  const color = TRAILS.find((t) => t.id === trailId)?.color ?? COLORS.safe
  const cores = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const floaters = useRef<THREE.Group>(null)
  const runner = useRef<THREE.Group>(null)
  const coreMat = useMemo(() => glow(COLORS.objective, 2.6), [])
  const ringMat = useMemo(() => glow(COLORS.safe, 3), [])
  // push the diorama into the right half — the menu column owns the left
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera
  const size = useThree((st) => st.size)
  useEffect(() => {
    if (size.width > 700) camera.setViewOffset(size.width, size.height, -size.width * 0.17, 0, size.width, size.height)
    else camera.clearViewOffset()
    camera.fov = 60
    camera.updateProjectionMatrix()
    return () => {
      camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
  }, [camera, size])
  const islands = useMemo(() => {
    const r = mulberry(3)
    return Array.from({ length: 14 }, () => ({
      p: [(r() - 0.5) * 60, -6 + r() * 16, -10 - r() * 50] as [number, number, number],
      s: [2 + r() * 5, 0.6 + r() * 1.5, 2 + r() * 5] as [number, number, number],
      ph: r() * 10,
    }))
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const a = t * 0.08
    camera.position.set(Math.sin(a) * 9.5, 3 + Math.sin(t * 0.3) * 0.4, Math.cos(a) * 9.5 - 2)
    camera.lookAt(0, 1.6, -2)
    if (cores.current) {
      cores.current.children.forEach((c, i) => {
        c.position.y = 2 + Math.sin(t * 2 + i) * 0.3
        c.rotation.y = t * 1.5 + i
      })
      cores.current.rotation.y = t * 0.3
    }
    if (ring.current) ring.current.rotation.z = t * 1.2
    if (floaters.current) floaters.current.children.forEach((c, i) => (c.position.y = islands[i].p[1] + Math.sin(t * 0.4 + islands[i].ph) * 0.6))
    if (runner.current) runner.current.rotation.y = Math.sin(t * 0.25) * 0.4 + 0.5
  })

  return (
    <>
      <color attach="background" args={[theme.fog]} />
      <fog attach="fog" args={[theme.fog, 30, 160]} />
      <Sky theme={theme} />
      <Debris accent={theme.accent} center={[0, 0, -20]} />
      <hemisphereLight args={[theme.sun, '#05050c', 1.0]} />
      <directionalLight position={[-6, 10, 6]} intensity={1.8} color="#d8c8ff" />
      <pointLight position={[0, 3, 1]} color={color} intensity={20} distance={12} />

      {/* hero platform */}
      <group position={[0, -0.5, 0]} scale={[8, 1, 8]}>
        <mesh geometry={unitBox} material={mats.neon} />
        <lineSegments geometry={unitEdges} material={edgeMat(theme.accent, 2.6)} />
      </group>
      <group position={[0, -1.5, 0]} scale={[6, 1, 6]}>
        <mesh geometry={unitBox} material={mats.metal} />
      </group>
      <group ref={runner} position={[-0.8, 0, 0.6]}>
        <RunnerModel color={color} />
      </group>
      {/* portal */}
      <group position={[2.2, 0, -2.4]} rotation={[0, -0.5, 0]}>
        <mesh ref={ring} position={[0, 1.9, 0]} material={ringMat}>
          <torusGeometry args={[1.6, 0.09, 8, 64]} />
        </mesh>
        <mesh position={[0, 1.9, 0]}>
          <circleGeometry args={[1.55, 48]} />
          <meshBasicMaterial color={new THREE.Color(COLORS.safe).multiplyScalar(1.2)} transparent opacity={0.25} toneMapped={false} />
        </mesh>
      </group>
      {/* cores */}
      <group ref={cores} position={[0, 0, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2) * 3.2, 2, Math.sin((i / 3) * Math.PI * 2) * 3.2]} material={coreMat}>
            <octahedronGeometry args={[0.3, 0]} />
          </mesh>
        ))}
      </group>
      {/* floating islands */}
      <group ref={floaters}>
        {islands.map((d, i) => (
          <group key={i} position={d.p} scale={d.s}>
            <mesh geometry={unitBox} material={i % 4 === 0 ? mats.glass : mats.metal} />
            <lineSegments geometry={unitEdges} material={edgeMat(i % 4 === 0 ? COLORS.secret : theme.accent, 1.8)} />
          </group>
        ))}
      </group>
    </>
  )
}
