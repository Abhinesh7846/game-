import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rt } from '../../game/runtime'
import { COLORS } from '../../game/constants'
import { glow } from '../../procedural-assets/materials'

/**
 * The Sentinel: a floating armoured core. Four armour petals split open in phase 4 to expose the
 * yellow weak point; spiked rings spin faster as the fight escalates.
 */
export function Boss() {
  const root = useRef<THREE.Group>(null)
  const ringA = useRef<THREE.Group>(null)
  const ringB = useRef<THREE.Group>(null)
  const petals = useRef<(THREE.Group | null)[]>([])
  const eye = useRef<THREE.Mesh>(null)
  const shield = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.Mesh>(null)
  const core = useRef<THREE.Mesh>(null)
  const beam = useRef<THREE.Mesh>(null)

  const mats = useMemo(
    () => ({
      armor: new THREE.MeshStandardMaterial({ color: '#2b2433', metalness: 0.9, roughness: 0.25, emissive: COLORS.danger, emissiveIntensity: 0.05 }),
      armorLight: new THREE.MeshStandardMaterial({ color: '#9a8fa8', metalness: 0.7, roughness: 0.3 }),
      red: glow(COLORS.danger, 3),
      redSoft: glow(COLORS.danger, 1.5, 0.45),
      core: glow(COLORS.objective, 3.5),
      white: glow('#ffffff', 3, 0.8),
    }),
    [],
  )

  useFrame(({ clock, camera }) => {
    const b = rt.boss
    const g = root.current
    if (!b || !g) return
    const t = clock.elapsedTime
    g.visible = b.phase < 5 || b.deathT > 0
    g.position.copy(b.pos)
    const p = rt.player.pos
    g.rotation.y = Math.atan2(p.x - b.pos.x, p.z - b.pos.z)
    const speed = b.phase === 0 ? 0.2 : 0.6 + b.phase * 0.5
    if (ringA.current) ringA.current.rotation.set(Math.PI / 2 + Math.sin(t * 0.5) * 0.2, 0, t * speed)
    if (ringB.current) ringB.current.rotation.set(Math.sin(t * 0.4) * 0.3, t * speed * 0.7, Math.PI / 3)
    petals.current.forEach((pt, i) => {
      if (!pt) return
      const a = (i / 4) * Math.PI * 2
      const o = b.open * 1.6
      pt.position.set(-Math.cos(a) * o, -Math.sin(a) * o, 0)
    })
    if (eye.current) {
      eye.current.visible = b.phase < 4
      eye.current.scale.setScalar(b.phase === 0 ? 0.4 : 1 + Math.sin(t * 6) * 0.1)
    }
    if (core.current) core.current.scale.setScalar(0.6 + b.open * 0.6 + Math.sin(t * 8) * 0.05 * b.open)
    if (shield.current) {
      shield.current.visible = b.shield
      shield.current.rotation.y = t * 0.5
    }
    if (flash.current) flash.current.visible = b.hitFlash > 0
    if (beam.current) {
      beam.current.visible = b.active && b.phase >= 1 && b.phase <= 4
      beam.current.scale.set(1, b.pos.y, 1)
      beam.current.position.y = -b.pos.y / 2
      ;(beam.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 10) * 0.05
    }
    void camera
  })

  return (
    <group ref={root}>
      {/* core / weak point */}
      <mesh ref={core} material={mats.core}>
        <icosahedronGeometry args={[1.2, 1]} />
      </mesh>
      {/* armour petals */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2
        return (
          <group key={i} ref={(el) => (petals.current[i] = el)}>
            {/* wedges are cut around Y then tipped onto the facing (Z) axis */}
            <mesh material={mats.armor} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <sphereGeometry args={[2.1, 24, 16, a - Math.PI / 4 + 0.03, Math.PI / 2 - 0.06, 0, Math.PI]} />
            </mesh>
            <mesh material={mats.redSoft} rotation={[Math.PI / 2, 0, 0]} scale={1.015}>
              <sphereGeometry args={[2.1, 6, 16, a + Math.PI / 4 - 0.07, 0.04, 0.2, Math.PI - 0.4]} />
            </mesh>
          </group>
        )
      })}
      {/* eye */}
      <mesh ref={eye} material={mats.red} position={[0, 0.2, 2.05]}>
        <sphereGeometry args={[0.42, 16, 12]} />
      </mesh>
      {/* spiked rings */}
      <group ref={ringA}>
        <mesh material={mats.armorLight}>
          <torusGeometry args={[3.2, 0.14, 8, 64]} />
        </mesh>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2
          return (
            <mesh key={i} material={mats.red} position={[Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0]} rotation={[0, 0, a - Math.PI / 2]}>
              <coneGeometry args={[0.16, 0.6, 4]} />
            </mesh>
          )
        })}
      </group>
      <group ref={ringB}>
        <mesh material={mats.redSoft}>
          <torusGeometry args={[3.9, 0.05, 6, 64]} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <mesh key={i} material={mats.armor} position={[Math.cos(a) * 3.9, Math.sin(a) * 3.9, 0]}>
              <octahedronGeometry args={[0.35, 0]} />
            </mesh>
          )
        })}
      </group>
      {/* tractor beam to the arena floor */}
      <mesh ref={beam}>
        <cylinderGeometry args={[0.5, 1.6, 1, 16, 1, true]} />
        <meshBasicMaterial color={new THREE.Color(COLORS.danger).multiplyScalar(1.4)} transparent opacity={0.2} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={shield} visible={false}>
        <icosahedronGeometry args={[4.6, 2]} />
        <meshBasicMaterial color={new THREE.Color(COLORS.safe).multiplyScalar(1.6)} wireframe transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh ref={flash} visible={false} material={mats.white}>
        <sphereGeometry args={[2.3, 16, 12]} />
      </mesh>
    </group>
  )
}
