import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rt, type Enemy } from '../../game/runtime'
import type { EnemyType } from '../../game/types'
import { COLORS } from '../../game/constants'
import { glow } from '../../procedural-assets/materials'

const hull = new THREE.MeshStandardMaterial({ color: '#2a2f3d', metalness: 0.85, roughness: 0.3 })
const hullLight = new THREE.MeshStandardMaterial({ color: '#8a93a8', metalness: 0.6, roughness: 0.35 })
const red = glow(COLORS.danger, 3)
const redSoft = glow(COLORS.danger, 1.5, 0.5)
const blue = glow('#7fd8ff', 2.5)
const white = glow('#ffffff', 2.5)

/** Watches the enemy list (boss waves append to it) and mounts one mesh per drone. */
export function Enemies() {
  const [count, setCount] = useState(rt.enemies.length)
  useFrame(() => {
    if (rt.enemies.length !== count) setCount(rt.enemies.length)
  })
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Drone key={rt.enemies[i].id} enemy={rt.enemies[i]} />
      ))}
      <ShieldLinks />
    </>
  )
}

function Drone({ enemy }: { enemy: Enemy }) {
  const grp = useRef<THREE.Group>(null)
  const face = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)
  const charge = useRef<THREE.Mesh>(null)
  const bubble = useRef<THREE.Mesh>(null)
  const bar = useRef<THREE.Group>(null)
  const barFill = useRef<THREE.Mesh>(null)
  useFrame(({ clock, camera }) => {
    const g = grp.current
    if (!g) return
    const e = enemy
    g.visible = e.alive
    if (!e.alive) return
    const t = clock.elapsedTime
    g.position.copy(e.pos)
    if (face.current) face.current.rotation.y = e.facing
    if (spin.current) spin.current.rotation.y = t * (e.type === 'hunter' ? 6 : 2.5)
    if (flash.current) flash.current.visible = e.hitFlash > 0
    if (charge.current) {
      const c = e.charge
      charge.current.visible = c > 0
      charge.current.scale.setScalar(0.2 + c * 0.9)
    }
    if (bubble.current) bubble.current.visible = e.shielded
    if (bar.current && barFill.current) {
      const show = e.hp < e.maxHp
      bar.current.visible = show
      bar.current.quaternion.copy(camera.quaternion)
      const k = Math.max(0, e.hp / e.maxHp)
      barFill.current.scale.x = k
      barFill.current.position.x = -(1 - k) * 0.5
    }
  })
  const barY = enemy.type === 'shield' ? 1.6 : 1.1
  return (
    <group ref={grp}>
      <group ref={face}>
        <group ref={spin}>{model(enemy.type)}</group>
        <mesh ref={charge} position={[0, 0, 0.7]} visible={false} material={red}>
          <sphereGeometry args={[0.3, 12, 8]} />
        </mesh>
      </group>
      <mesh ref={flash} visible={false} material={white}>
        <sphereGeometry args={[enemy.type === 'scout' ? 0.6 : 0.9, 12, 8]} />
      </mesh>
      <mesh ref={bubble} visible={false}>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshBasicMaterial color={new THREE.Color('#7fd8ff').multiplyScalar(1.5)} wireframe transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <group ref={bar} position={[0, barY, 0]} visible={false}>
        <mesh>
          <planeGeometry args={[1.1, 0.12]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.6} depthTest={false} />
        </mesh>
        <mesh ref={barFill} position={[0, 0, 0.001]}>
          <planeGeometry args={[1, 0.08]} />
          <meshBasicMaterial color={new THREE.Color(COLORS.danger).multiplyScalar(2)} toneMapped={false} depthTest={false} />
        </mesh>
      </group>
    </group>
  )
}

function model(type: EnemyType) {
  switch (type) {
    case 'scout':
      return (
        <group>
          <mesh material={hull} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.32, 0.9, 6]} />
          </mesh>
          <mesh material={red} position={[0, 0.05, 0.3]}>
            <sphereGeometry args={[0.12, 10, 8]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={hullLight} position={[s * 0.38, 0, -0.1]} rotation={[0, 0, s * 0.4]}>
              <boxGeometry args={[0.45, 0.04, 0.35]} />
            </mesh>
          ))}
          <mesh material={redSoft} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.5, 0.025, 6, 24]} />
          </mesh>
        </group>
      )
    case 'blaster':
      return (
        <group>
          <mesh material={hull}>
            <dodecahedronGeometry args={[0.6, 0]} />
          </mesh>
          <mesh material={red} position={[0, 0, 0.45]}>
            <sphereGeometry args={[0.2, 12, 8]} />
          </mesh>
          <mesh material={hullLight} position={[0, -0.05, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.14, 0.5, 8]} />
          </mesh>
          <mesh material={redSoft} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.85, 0.04, 6, 32]} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} material={hullLight} rotation={[0, (k * Math.PI * 2) / 3, 0]} position={[0, -0.45, 0]}>
              <boxGeometry args={[0.08, 0.35, 0.5]} />
            </mesh>
          ))}
        </group>
      )
    case 'shield':
      return (
        <group>
          <mesh material={hullLight}>
            <octahedronGeometry args={[0.7, 0]} />
          </mesh>
          <mesh material={blue}>
            <octahedronGeometry args={[0.35, 0]} />
          </mesh>
          <mesh material={blue} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.0, 0.04, 6, 32]} />
          </mesh>
          <mesh material={blue} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[1.1, 0.03, 6, 32]} />
          </mesh>
          <mesh material={red} position={[0, 0, 0.62]}>
            <sphereGeometry args={[0.1, 8, 6]} />
          </mesh>
        </group>
      )
    case 'hunter':
      return (
        <group>
          <mesh material={hull}>
            <icosahedronGeometry args={[0.55, 0]} />
          </mesh>
          {Array.from({ length: 8 }, (_, k) => {
            const a = (k / 8) * Math.PI * 2
            return (
              <mesh key={k} material={red} position={[Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0]} rotation={[0, 0, a - Math.PI / 2]}>
                <coneGeometry args={[0.1, 0.45, 4]} />
              </mesh>
            )
          })}
          <mesh material={red} position={[0, 0, 0.45]}>
            <sphereGeometry args={[0.16, 10, 8]} />
          </mesh>
        </group>
      )
    case 'target':
      return (
        <group>
          {[0.6, 0.4, 0.2].map((r, k) => (
            <mesh key={r} rotation={[0, 0, 0]}>
              <torusGeometry args={[r, 0.05, 6, 32]} />
              <meshBasicMaterial color={new THREE.Color(k % 2 ? '#ffffff' : COLORS.danger).multiplyScalar(2)} toneMapped={false} />
            </mesh>
          ))}
          <mesh material={hull} position={[0, -0.9, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.2, 6]} />
          </mesh>
        </group>
      )
  }
}

/** Beams from shield drones to the allies they protect. */
function ShieldLinks() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 6), 3))
    return g
  }, [])
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color('#7fd8ff').multiplyScalar(2.5), toneMapped: false, transparent: true, opacity: 0.7 }), [])
  useFrame(() => {
    const arr = geo.attributes.position.array as Float32Array
    let n = 0
    for (const s of rt.enemies) {
      if (!s.alive || s.type !== 'shield') continue
      for (const e of rt.enemies) {
        if (!e.alive || e === s || !e.shielded || e.pos.distanceTo(s.pos) >= 9 || n >= 64) continue
        arr.set([s.pos.x, s.pos.y, s.pos.z, e.pos.x, e.pos.y, e.pos.z], n * 6)
        n++
      }
    }
    geo.setDrawRange(0, n * 2)
    geo.attributes.position.needsUpdate = true
  })
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />
}

const _m = new THREE.Matrix4()
const _c = new THREE.Color()
export function Projectiles() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const n = rt.projectiles.length
  useFrame(({ clock }) => {
    const im = ref.current
    if (!im) return
    let k = 0
    const pulse = 1 + Math.sin(clock.elapsedTime * 20) * 0.15
    for (const p of rt.projectiles) {
      if (!p.alive) continue
      const s = p.radius * 1.6 * pulse
      _m.makeScale(s, s, s).setPosition(p.pos)
      im.setMatrixAt(k, _m)
      im.setColorAt(k, _c.set(p.boss ? '#ff8a1a' : COLORS.danger).multiplyScalar(p.homing ? 4 : 3))
      k++
    }
    im.count = k
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false}>
      <icosahedronGeometry args={[0.5, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
