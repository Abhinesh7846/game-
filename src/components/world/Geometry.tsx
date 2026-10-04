import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import type { LevelDef, SurfaceKind } from '../../game/types'
import { rt } from '../../game/runtime'
import { COLORS, KEY_COLORS } from '../../game/constants'
import { surfaceMaterials } from '../../procedural-assets/materials'
import { useGame } from '../../game/store'
import { timedPhase } from '../../systems/world'

export const unitBox = new THREE.BoxGeometry(1, 1, 1)
export const unitEdges = new THREE.EdgesGeometry(unitBox)

const edgeMatCache = new Map<string, THREE.LineBasicMaterial>()
export function edgeMat(color: string, intensity = 2.2, opacity = 1) {
  const key = `${color}-${intensity}-${opacity}`
  let m = edgeMatCache.get(key)
  if (!m) {
    m = new THREE.LineBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      toneMapped: false,
      transparent: opacity < 1,
      opacity,
    })
    edgeMatCache.set(key, m)
  }
  return m
}

function edgeFor(kind: SurfaceKind, accent: string) {
  switch (kind) {
    case 'runwall':
      return edgeMat(COLORS.safe, 3)
    case 'glass':
      return edgeMat(COLORS.secret, 3)
    case 'dark':
      return edgeMat(accent, 0.9)
    case 'neon':
      return edgeMat(accent, 2.6)
    default:
      return edgeMat(accent, 1.6)
  }
}

/** All static solids in a single fixed body + their meshes. */
export function StaticGeometry({ level }: { level: LevelDef }) {
  const mats = surfaceMaterials(level.theme.accent)
  const shadows = useGame((s) => s.settings.quality) === 'high'
  return (
    <>
      <RigidBody type="fixed" colliders={false} friction={0.9}>
        {level.platforms.map((p, i) =>
          p.shape === 'cylinder' ? (
            <CylinderCollider key={i} args={[p.size[1] / 2, p.size[0] / 2]} position={p.pos} />
          ) : (
            <CuboidCollider key={i} args={[p.size[0] / 2, p.size[1] / 2, p.size[2] / 2]} position={p.pos} />
          ),
        )}
        {level.switches.map((s) => (
          <CuboidCollider key={s.id} args={[0.35, 0.6, 0.35]} position={[s.pos[0], s.pos[1] + 0.6, s.pos[2]]} />
        ))}
      </RigidBody>
      {level.platforms.map((p, i) =>
        p.shape === 'cylinder' ? (
          <Arena key={i} pos={p.pos} size={p.size} accent={level.theme.accent} />
        ) : (
          <group key={i} position={p.pos} scale={p.size}>
            <mesh geometry={unitBox} material={mats[p.kind ?? 'metal']} castShadow={shadows} receiveShadow={shadows} />
            <lineSegments geometry={unitEdges} material={edgeFor(p.kind ?? 'metal', level.theme.accent)} />
          </group>
        ),
      )}
    </>
  )
}

function Arena({ pos, size, accent }: { pos: [number, number, number]; size: [number, number, number]; accent: string }) {
  const mats = surfaceMaterials(accent)
  const r = size[0] / 2
  const top = pos[1] + size[1] / 2
  const rings = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (rings.current) rings.current.rotation.y += dt * 0.05
  })
  const glowMat = useMemo(() => edgeMat(accent, 2.5), [accent])
  return (
    <group>
      <mesh position={pos} material={mats.arena} receiveShadow>
        <cylinderGeometry args={[r, r * 0.92, size[1], 72]} />
      </mesh>
      <mesh position={[pos[0], top, pos[2]]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r, 0.12, 8, 96]} />
        <meshBasicMaterial color={new THREE.Color(accent).multiplyScalar(3)} toneMapped={false} />
      </mesh>
      <group ref={rings} position={[pos[0], top + 0.02, pos[2]]}>
        {[6, 12.5, 19].map((rr) => (
          <mesh key={rr} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[rr - 0.08, rr + 0.08, 96]} />
            <meshBasicMaterial color={new THREE.Color(accent).multiplyScalar(1.6)} toneMapped={false} transparent opacity={0.6} />
          </mesh>
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <lineSegments key={i} rotation={[0, (i / 12) * Math.PI * 2, 0]} material={glowMat}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[new Float32Array([6.2, 0, 0, r - 0.6, 0, 0]), 3]} />
            </bufferGeometry>
          </lineSegments>
        ))}
      </group>
      {/* underside glow cone */}
      <mesh position={[pos[0], pos[1] - size[1] / 2 - 6, pos[2]]}>
        <coneGeometry args={[r * 0.9, 12, 48, 1, true]} />
        <meshBasicMaterial color={new THREE.Color(accent).multiplyScalar(0.6)} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Movers({ level }: { level: LevelDef }) {
  return (
    <>
      {level.movers.map((m, i) => (
        <Mover key={m.id} index={i} level={level} />
      ))}
    </>
  )
}

function Mover({ index, level }: { index: number; level: LevelDef }) {
  const def = level.movers[index]
  const body = useRef<RapierRigidBody>(null)
  const col = useRef<RapierCollider>(null)
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const mats = surfaceMaterials(level.theme.accent)
  useEffect(() => {
    const st = rt.movers[index]
    st.body = body.current
    if (col.current) rt.moverByCollider.set(col.current.handle, st)
  }, [index])
  useFrame(({ clock }) => {
    if (glow.current) {
      const active = rt.movers[index]?.active
      glow.current.opacity = active ? 0.5 + Math.sin(clock.elapsedTime * 6) * 0.2 : 0.15
    }
  })
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={def.path[0]}>
      <CuboidCollider ref={col} args={[def.size[0] / 2, def.size[1] / 2, def.size[2] / 2]} />
      <group scale={def.size}>
        <mesh geometry={unitBox} material={mats.neon} castShadow />
        <lineSegments geometry={unitEdges} material={edgeMat(COLORS.safe, 3)} />
      </group>
      <mesh position={[0, -def.size[1] / 2 - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[def.size[0] * 0.8, def.size[2] * 0.8]} />
        <meshBasicMaterial ref={glow} color={new THREE.Color(COLORS.safe).multiplyScalar(2)} toneMapped={false} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </RigidBody>
  )
}

export function TimedPlatforms({ level }: { level: LevelDef }) {
  return (
    <>
      {level.timed.map((_, i) => (
        <Timed key={i} index={i} level={level} />
      ))}
    </>
  )
}

function Timed({ index, level }: { index: number; level: LevelDef }) {
  const def = level.timed[index]
  const col = useRef<RapierCollider>(null)
  const solid = useRef<THREE.Group>(null)
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#103040',
        emissive: new THREE.Color(COLORS.safe),
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.85,
        metalness: 0.3,
        roughness: 0.2,
      }),
    [],
  )
  useEffect(() => {
    rt.timedColliders[index] = col.current
  }, [index])
  useFrame(({ clock }) => {
    const { on, warn } = timedPhase(index)
    if (solid.current) solid.current.visible = on && (!warn || Math.floor(clock.elapsedTime * 14) % 2 === 0)
    mat.emissiveIntensity = warn ? 1.6 : 0.6
    mat.emissive.set(warn ? COLORS.danger : COLORS.safe)
  })
  return (
    <RigidBody type="fixed" colliders={false} position={def.pos}>
      <CuboidCollider ref={col} args={[def.size[0] / 2, def.size[1] / 2, def.size[2] / 2]} />
      <group scale={def.size}>
        <group ref={solid}>
          <mesh geometry={unitBox} material={mat} />
        </group>
        <lineSegments geometry={unitEdges} material={edgeMat(COLORS.safe, 2.4)} />
      </group>
    </RigidBody>
  )
}

const gateVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() { vUv = uv; vPos = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0); }
`
const gateFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uTime; uniform float uOpen;
  varying vec2 vUv; varying vec3 vPos;
  void main() {
    float scan = 0.55 + 0.45 * sin(vPos.y * 9.0 - uTime * 4.0);
    float hex = abs(sin(vPos.x * 3.0 + vPos.y * 1.7)) * abs(sin(vPos.z * 3.0 - vPos.y * 1.7));
    float edge = smoothstep(0.42, 0.5, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
    float a = (0.22 + 0.25 * scan + 0.25 * step(0.85, hex) + edge * 0.8) * (1.0 - uOpen);
    gl_FragColor = vec4(uColor * (1.5 + edge * 2.0), a);
  }
`

export function Gates({ level }: { level: LevelDef }) {
  return (
    <>
      {level.gates.map((g) => (
        <Gate key={g.id} id={g.id} level={level} />
      ))}
    </>
  )
}

function Gate({ id, level }: { id: string; level: LevelDef }) {
  const def = level.gates.find((g) => g.id === id)!
  const col = useRef<RapierCollider>(null)
  const grp = useRef<THREE.Group>(null)
  const open = useRef(0)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: gateVert,
        fragmentShader: gateFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(KEY_COLORS[def.color]) }, uTime: { value: 0 }, uOpen: { value: 0 } },
      }),
    [def.color],
  )
  useEffect(() => {
    rt.gateColliders[id] = col.current
  }, [id])
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
    const target = rt.gates[id] ? 1 : 0
    open.current += (target - open.current) * (1 - Math.exp(-5 * dt))
    mat.uniforms.uOpen.value = open.current
    if (grp.current) grp.current.visible = open.current < 0.99
  })
  return (
    <RigidBody type="fixed" colliders={false} position={def.pos}>
      <CuboidCollider ref={col} args={[def.size[0] / 2, def.size[1] / 2, def.size[2] / 2]} />
      <group ref={grp} scale={def.size}>
        <mesh geometry={unitBox} material={mat} />
        <lineSegments geometry={unitEdges} material={edgeMat(KEY_COLORS[def.color], 3)} />
      </group>
      {/* frame posts stay after opening */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * def.size[0]) / 2, 0, 0]} scale={[0.25, def.size[1] + 0.2, Math.max(0.6, def.size[2] + 0.2)]} geometry={unitBox}>
          <meshStandardMaterial color="#1a2131" emissive={KEY_COLORS[def.color]} emissiveIntensity={0.5} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </RigidBody>
  )
}

export function Crystals({ level }: { level: LevelDef }) {
  return (
    <>
      {level.crystals.map((_, i) => (
        <Crystal key={i} index={i} level={level} />
      ))}
    </>
  )
}

function Crystal({ index, level }: { index: number; level: LevelDef }) {
  const def = level.crystals[index]
  const col = useRef<RapierCollider>(null)
  const grp = useRef<THREE.Group>(null)
  const shards = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; r: number }[] = []
    const [w, h, d] = def.size
    const n = Math.max(5, Math.round((w + d) * 1.6))
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      out.push({
        p: [w > d ? (t - 0.5) * w : 0, (Math.sin(i * 7.3) * 0.15 - 0.05) * h, d >= w ? (t - 0.5) * d : 0],
        s: [Math.max(w, d) / n * 1.3, h * (0.75 + 0.25 * Math.sin(i * 3.1)), Math.min(w, d) * 1.2 + 0.2],
        r: Math.sin(i * 5.7) * 0.25,
      })
    }
    return out
  }, [def])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#bfefff',
        emissive: '#5fd8ff',
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.75,
        metalness: 0.1,
        roughness: 0.05,
      }),
    [],
  )
  useEffect(() => {
    rt.crystals[index].collider = col.current
  }, [index])
  useFrame(({ clock }) => {
    if (grp.current) grp.current.visible = !rt.crystals[index]?.broken
    mat.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 3) * 0.25
  })
  return (
    <RigidBody type="fixed" colliders={false} position={def.pos}>
      <CuboidCollider ref={col} args={[def.size[0] / 2, def.size[1] / 2, def.size[2] / 2]} />
      <group ref={grp}>
        {shards.map((s, i) => (
          <mesh key={i} position={s.p} scale={s.s} rotation={[0, 0, s.r]} material={mat}>
            <octahedronGeometry args={[0.6, 0]} />
          </mesh>
        ))}
      </group>
    </RigidBody>
  )
}

export function Cubes({ level }: { level: LevelDef }) {
  return (
    <>
      {level.cubes.map((c, i) => (
        <PushCube key={i} index={i} pos={c.pos} />
      ))}
    </>
  )
}

function PushCube({ index, pos }: { index: number; pos: [number, number, number] }) {
  const body = useRef<RapierRigidBody>(null)
  useEffect(() => {
    rt.cubes[index].body = body.current
  }, [index])
  return (
    <RigidBody ref={body} type="dynamic" colliders={false} position={pos} lockRotations linearDamping={2.5} canSleep={false}>
      <CuboidCollider args={[0.8, 0.8, 0.8]} density={3} friction={0.3} />
      <group scale={1.6}>
        <mesh geometry={unitBox} castShadow>
          <meshStandardMaterial color="#1c2a3e" metalness={0.7} roughness={0.35} emissive={COLORS.safe} emissiveIntensity={0.08} />
        </mesh>
        <lineSegments geometry={unitEdges} material={edgeMat(COLORS.safe, 3)} />
      </group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI) / 2) * 0.81, 0, Math.cos((i * Math.PI) / 2) * 0.81]} rotation={[0, (i * Math.PI) / 2, 0]}>
          <planeGeometry args={[0.9, 0.9]} />
          <meshBasicMaterial color={new THREE.Color(COLORS.safe).multiplyScalar(1.5)} toneMapped={false} transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </RigidBody>
  )
}
