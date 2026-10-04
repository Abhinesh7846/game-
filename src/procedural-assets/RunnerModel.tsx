import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export interface RunnerPose {
  speed: number
  grounded: boolean
  wallRunning: boolean
  wallSide: number
  dashing: boolean
  grappling: boolean
  punch: number
  blink: boolean
  vy: number
}

const idlePose: RunnerPose = {
  speed: 0,
  grounded: true,
  wallRunning: false,
  wallSide: 0,
  dashing: false,
  grappling: false,
  punch: 0,
  blink: false,
  vy: 0,
}

/**
 * Fully procedural runner: capsules + plates + emissive accents. Feet at origin, facing -Z.
 * `getPose` is polled every frame so the model never re-renders through React.
 */
export function RunnerModel({ color, getPose }: { color: string; getPose?: () => RunnerPose }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const foreL = useRef<THREE.Group>(null)
  const foreR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const shinL = useRef<THREE.Group>(null)
  const shinR = useRef<THREE.Group>(null)
  const thrust = useRef<THREE.Mesh>(null)
  const phase = useRef(0)
  const lean = useRef(0)
  const tilt = useRef(0)

  const mats = useMemo(() => {
    const accent = new THREE.Color(color)
    return {
      suit: new THREE.MeshStandardMaterial({ color: '#1a2030', metalness: 0.55, roughness: 0.45 }),
      armor: new THREE.MeshStandardMaterial({ color: '#d8e2f2', metalness: 0.35, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: '#0b0e16', metalness: 0.8, roughness: 0.3 }),
      glow: new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(3), toneMapped: false }),
      glowSoft: new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.85 }),
    }
  }, [color])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const p = getPose ? getPose() : idlePose
    const t = state.clock.elapsedTime
    const run = Math.min(1, p.speed / 9.5)
    if (p.grounded) phase.current += dt * (4 + p.speed * 1.05)
    const ph = phase.current
    const sw = Math.sin(ph)

    let thighL = 0
    let thighR = 0
    let kneeL = 0
    let kneeR = 0
    let upperL = 0
    let upperR = 0
    let elbowL = 0.3
    let elbowR = 0.3
    let spreadL = 0.12
    let spreadR = -0.12
    let bob = 0

    if (!getPose) {
      // menu idle: breathing + weight shift
      bob = Math.sin(t * 1.6) * 0.015
      upperL = Math.sin(t * 0.8) * 0.06
      upperR = -Math.sin(t * 0.8) * 0.06
      spreadL = 0.2
      spreadR = -0.2
    } else if (p.wallRunning) {
      thighL = sw * 1.0
      thighR = -sw * 1.0
      kneeL = Math.max(0, -Math.cos(ph)) * 1.4
      kneeR = Math.max(0, Math.cos(ph)) * 1.4
      upperL = -sw * 0.8
      upperR = sw * 0.8
      if (p.wallSide > 0) spreadR = -1.1
      else spreadL = 1.1
    } else if (!p.grounded) {
      const up = THREE.MathUtils.clamp(p.vy / 10, -1, 1)
      thighL = 0.7 + up * 0.2
      thighR = -0.2 + up * 0.3
      kneeL = 1.2
      kneeR = 0.6
      upperL = -0.6 - up * 0.4
      upperR = 0.4 - up * 0.6
      spreadL = 0.5
      spreadR = -0.5
    } else {
      thighL = sw * 0.95 * run
      thighR = -sw * 0.95 * run
      kneeL = Math.max(0, -Math.cos(ph)) * 1.5 * run
      kneeR = Math.max(0, Math.cos(ph)) * 1.5 * run
      upperL = -sw * 0.9 * run
      upperR = sw * 0.9 * run
      elbowL = 0.3 + run * 1.0
      elbowR = 0.3 + run * 1.0
      bob = Math.abs(Math.cos(ph)) * 0.07 * run + Math.sin(t * 2) * 0.01 * (1 - run)
    }
    if (p.grappling) {
      upperR = 2.6
      elbowR = 0
      spreadR = -0.1
    }
    if (p.punch > 0) {
      const k = Math.sin((p.punch / 0.3) * Math.PI)
      upperR = THREE.MathUtils.lerp(upperR, 1.6, k)
      elbowR = THREE.MathUtils.lerp(elbowR, 0, k)
      upperL = THREE.MathUtils.lerp(upperL, 1.4, k * 0.8)
      elbowL = THREE.MathUtils.lerp(elbowL, 0, k * 0.8)
    }

    const k = 1 - Math.exp(-18 * dt)
    const set = (g: THREE.Group | null, x: number, z = 0) => {
      if (!g) return
      g.rotation.x += (x - g.rotation.x) * k
      g.rotation.z += (z - g.rotation.z) * k
    }
    set(legL.current, thighL)
    set(legR.current, thighR)
    set(shinL.current, -kneeL)
    set(shinR.current, -kneeR)
    set(armL.current, upperL, spreadL)
    set(armR.current, upperR, spreadR)
    set(foreL.current, elbowL)
    set(foreR.current, elbowR)

    const targetLean = p.dashing ? 0.55 : p.grounded ? run * 0.22 : 0.05
    lean.current += (targetLean - lean.current) * (1 - Math.exp(-10 * dt))
    const targetTilt = p.wallRunning ? p.wallSide * 0.38 : 0
    tilt.current += (targetTilt - tilt.current) * (1 - Math.exp(-10 * dt))
    if (body.current) {
      body.current.rotation.x = -lean.current
      body.current.rotation.z = tilt.current
      body.current.position.y = bob
    }
    if (head.current) head.current.rotation.x = lean.current * 0.6
    if (thrust.current) {
      const s = p.dashing ? 2.4 : !p.grounded ? 1.3 : 0.6 + run * 0.4
      thrust.current.scale.set(1, s + Math.sin(t * 40) * 0.1, 1)
    }
    if (root.current) root.current.visible = !p.blink || Math.floor(t * 20) % 2 === 0
  })

  return (
    <group ref={root}>
      <group ref={body}>
        {/* legs */}
        {[
          [legL, shinL, -0.14],
          [legR, shinR, 0.14],
        ].map(([leg, shin, x], i) => (
          <group key={i} ref={leg as React.RefObject<THREE.Group>} position={[x as number, 0.92, 0]}>
            <mesh material={mats.suit} position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.1, 0.28, 4, 8]} />
            </mesh>
            <mesh material={mats.armor} position={[0, -0.18, -0.08]}>
              <boxGeometry args={[0.16, 0.22, 0.06]} />
            </mesh>
            <group ref={shin as React.RefObject<THREE.Group>} position={[0, -0.45, 0]}>
              <mesh material={mats.suit} position={[0, -0.2, 0]} castShadow>
                <capsuleGeometry args={[0.085, 0.26, 4, 8]} />
              </mesh>
              <mesh material={mats.armor} position={[0, -0.16, -0.07]}>
                <boxGeometry args={[0.14, 0.2, 0.05]} />
              </mesh>
              <mesh material={mats.dark} position={[0, -0.42, -0.04]} castShadow>
                <boxGeometry args={[0.15, 0.1, 0.3]} />
              </mesh>
              <mesh material={mats.glow} position={[0, -0.44, -0.2]}>
                <boxGeometry args={[0.15, 0.03, 0.02]} />
              </mesh>
            </group>
          </group>
        ))}
        {/* pelvis + torso */}
        <mesh material={mats.dark} position={[0, 0.95, 0]}>
          <boxGeometry args={[0.38, 0.14, 0.22]} />
        </mesh>
        <mesh material={mats.suit} position={[0, 1.25, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.3, 4, 10]} />
        </mesh>
        <mesh material={mats.armor} position={[0, 1.33, -0.12]} castShadow>
          <boxGeometry args={[0.42, 0.3, 0.12]} />
        </mesh>
        <mesh material={mats.glow} position={[0, 1.27, -0.185]}>
          <boxGeometry args={[0.26, 0.025, 0.01]} />
        </mesh>
        <mesh material={mats.glow} position={[0, 1.38, -0.185]}>
          <boxGeometry args={[0.08, 0.08, 0.01]} />
        </mesh>
        {/* backpack + thruster */}
        <mesh material={mats.dark} position={[0, 1.3, 0.2]} castShadow>
          <boxGeometry args={[0.34, 0.38, 0.14]} />
        </mesh>
        <mesh material={mats.glowSoft} position={[0, 1.45, 0.28]}>
          <boxGeometry args={[0.22, 0.04, 0.02]} />
        </mesh>
        <mesh ref={thrust} material={mats.glowSoft} position={[0, 1.04, 0.22]}>
          <coneGeometry args={[0.07, 0.3, 10]} />
        </mesh>
        {/* arms */}
        {[
          [armL, foreL, -0.3],
          [armR, foreR, 0.3],
        ].map(([arm, fore, x], i) => (
          <group key={i} ref={arm as React.RefObject<THREE.Group>} position={[x as number, 1.5, 0]}>
            <mesh material={mats.armor} position={[0, 0, 0]}>
              <sphereGeometry args={[0.1, 10, 8]} />
            </mesh>
            <mesh material={mats.suit} position={[0, -0.17, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.22, 4, 8]} />
            </mesh>
            <group ref={fore as React.RefObject<THREE.Group>} position={[0, -0.34, 0]}>
              <mesh material={mats.suit} position={[0, -0.14, 0]} castShadow>
                <capsuleGeometry args={[0.065, 0.2, 4, 8]} />
              </mesh>
              <mesh material={mats.armor} position={[0, -0.12, -0.02]}>
                <boxGeometry args={[0.13, 0.18, 0.13]} />
              </mesh>
              <mesh material={mats.glow} position={[0, -0.12, -0.09]}>
                <boxGeometry args={[0.1, 0.02, 0.01]} />
              </mesh>
            </group>
          </group>
        ))}
        {/* head */}
        <group ref={head} position={[0, 1.66, 0]}>
          <mesh material={mats.armor} castShadow>
            <sphereGeometry args={[0.19, 16, 12]} />
          </mesh>
          <mesh material={mats.dark} position={[0, 0.01, -0.07]}>
            <sphereGeometry args={[0.165, 16, 12]} />
          </mesh>
          <mesh material={mats.glow} position={[0, 0.02, -0.165]}>
            <boxGeometry args={[0.24, 0.06, 0.05]} />
          </mesh>
          <mesh material={mats.glowSoft} position={[0.15, 0.1, 0.04]} rotation={[0.4, 0, 0.3]}>
            <boxGeometry args={[0.02, 0.2, 0.04]} />
          </mesh>
          <mesh material={mats.glowSoft} position={[-0.15, 0.1, 0.04]} rotation={[0.4, 0, -0.3]}>
            <boxGeometry args={[0.02, 0.2, 0.04]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
