import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { LevelDef } from '../../game/types'
import { rt } from '../../game/runtime'
import { COLORS, KEY_COLORS } from '../../game/constants'
import { glow } from '../../procedural-assets/materials'
import { useGame } from '../../game/store'
import { portalOpen } from '../../systems/world'
import { burst } from '../../systems/fx'
import { edgeMat, unitBox, unitEdges } from './Geometry'

const coreGlow = glow(COLORS.objective, 2.6)
const coreHalo = glow(COLORS.objective, 1.4, 0.35)
const secretGlow = glow(COLORS.secret, 2.8)
const safeGlow = glow(COLORS.safe, 2.6)
const cpGlow = glow(COLORS.checkpoint, 2.4)
const dimMat = new THREE.MeshStandardMaterial({ color: '#1a2131', metalness: 0.7, roughness: 0.35 })

export function Cores({ level }: { level: LevelDef }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    level.cores.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      g.visible = !rt.coresTaken[i]
      g.position.set(c[0], c[1] + Math.sin(t * 2 + i) * 0.15, c[2])
      g.rotation.y = t * 1.8 + i
    })
  })
  return (
    <>
      {level.cores.map((_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <mesh material={coreGlow}>
            <octahedronGeometry args={[0.38, 0]} />
          </mesh>
          <mesh material={coreHalo} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.62, 0.04, 6, 32]} />
          </mesh>
          <mesh material={coreHalo} rotation={[0, 0, Math.PI / 3]}>
            <torusGeometry args={[0.55, 0.03, 6, 32]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export function Secrets({ level }: { level: LevelDef }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    level.secrets.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      g.visible = !rt.secretsTaken[i]
      g.position.set(c[0], c[1] + Math.sin(t * 1.5) * 0.2, c[2])
      g.rotation.set(t * 0.7, t * 1.3, 0)
      if (g.visible && Math.random() < 0.08) burst(g.position, COLORS.secret, { count: 1, speed: 1.5, life: 0.8, size: 0.25 })
    })
  })
  return (
    <>
      {level.secrets.map((_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <mesh material={secretGlow}>
            <icosahedronGeometry args={[0.42, 0]} />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[0.7, 0]} />
            <meshBasicMaterial color={COLORS.secret} wireframe transparent opacity={0.5} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export function Pickups({ level }: { level: LevelDef }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const abilities = useGame((s) => s.progress.abilities)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    level.pickups.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      g.visible = !rt.pickupsTaken[i] && !abilities[c.ability]
      g.position.set(c.pos[0], c.pos[1] + Math.sin(t * 2) * 0.2, c.pos[2])
      g.rotation.y = t * 2
    })
  })
  return (
    <>
      {level.pickups.map((_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <mesh material={safeGlow}>
            <boxGeometry args={[0.45, 0.45, 0.45]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={safeGlow}>
            <torusGeometry args={[0.75, 0.04, 6, 32]} />
          </mesh>
          <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI]} material={safeGlow}>
            <coneGeometry args={[0.18, 0.3, 4]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export function Checkpoints({ level }: { level: LevelDef }) {
  const beams = useRef<(THREE.Mesh | null)[]>([])
  const rings = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    level.checkpoints.forEach((_, i) => {
      const on = rt.checkpointsHit[i]
      const b = beams.current[i]
      if (b) {
        b.visible = on
        b.scale.x = b.scale.z = 1 + Math.sin(t * 6) * 0.15
      }
      const r = rings.current[i]
      if (r) {
        r.position.y = 0.6 + ((t * 0.8 + i * 0.3) % 1) * 2.2
        ;(r.material as THREE.MeshBasicMaterial).opacity = on ? 0.9 : 0.35
      }
    })
  })
  return (
    <>
      {level.checkpoints.map((c, i) => (
        <group key={i} position={c}>
          <mesh material={dimMat} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[1.1, 1.2, 0.12, 24]} />
          </mesh>
          <mesh material={cpGlow} position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.85, 1.0, 32]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 1.0, 0, 0]}>
              <mesh material={dimMat} position={[0, 1.4, 0]}>
                <boxGeometry args={[0.16, 2.8, 0.16]} />
              </mesh>
              <mesh material={cpGlow} position={[0, 1.4, 0]}>
                <boxGeometry args={[0.05, 2.6, 0.2]} />
              </mesh>
            </group>
          ))}
          <mesh ref={(el) => (rings.current[i] = el)} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.7, 0.8, 32]} />
            <meshBasicMaterial color={new THREE.Color(COLORS.checkpoint).multiplyScalar(2)} transparent opacity={0.4} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={(el) => (beams.current[i] = el)} position={[0, 6, 0]} visible={false}>
            <cylinderGeometry args={[0.12, 0.12, 12, 8, 1, true]} />
            <meshBasicMaterial color={new THREE.Color(COLORS.checkpoint).multiplyScalar(1.4)} transparent opacity={0.22} toneMapped={false} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export function Pads({ level }: { level: LevelDef }) {
  const jumpRefs = useRef<(THREE.Group | null)[]>([])
  const healRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    jumpRefs.current.forEach((g) => {
      if (!g) return
      g.children.forEach((c, k) => {
        c.position.y = 0.15 + ((t * 1.2 + k / 3) % 1) * 1.2
        ;((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - ((t * 1.2 + k / 3) % 1)
      })
    })
    level.healthPads.forEach((_, i) => {
      const m = healRefs.current[i]
      if (m) m.opacity = rt.healthPadCd[i] > 0 ? 0.15 : 0.6 + Math.sin(t * 4) * 0.25
    })
  })
  return (
    <>
      {level.jumpPads.map((j, i) => (
        <group key={`j${i}`} position={j.pos}>
          <mesh material={dimMat} position={[0, 0.07, 0]}>
            <cylinderGeometry args={[1.3, 1.4, 0.14, 24]} />
          </mesh>
          <mesh material={safeGlow} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 1.2, 32]} />
          </mesh>
          <group ref={(el) => (jumpRefs.current[i] = el)}>
            {[0, 1, 2].map((k) => (
              <mesh key={k} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.9, 1.05, 32]} />
                <meshBasicMaterial color={new THREE.Color(COLORS.safe).multiplyScalar(2)} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
      {level.healthPads.map((h, i) => (
        <group key={`h${i}`} position={h}>
          <mesh material={dimMat} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[1.1, 1.2, 0.12, 24]} />
          </mesh>
          {[0, Math.PI / 2].map((r) => (
            <mesh key={r} position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, r]}>
              <planeGeometry args={[1.4, 0.4]} />
              <meshBasicMaterial ref={(el) => (healRefs.current[i] = el)} color={new THREE.Color(COLORS.checkpoint).multiplyScalar(2.2)} transparent toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

export function Switches({ level }: { level: LevelDef }) {
  const panels = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  useFrame(({ clock }) => {
    level.switches.forEach((s, i) => {
      const m = panels.current[i]
      if (!m) return
      const on = rt.switches[s.id]
      const c = new THREE.Color(KEY_COLORS[s.color])
      m.color.copy(c).multiplyScalar(on ? 3 : 1 + Math.sin(clock.elapsedTime * 5) * 0.5 + 0.5)
    })
  })
  return (
    <>
      {level.switches.map((s, i) => (
        <group key={s.id} position={s.pos}>
          <mesh material={dimMat} position={[0, 0.6, 0]}>
            <boxGeometry args={[0.7, 1.2, 0.7]} />
          </mesh>
          <mesh position={[0, 1.35, 0]}>
            <octahedronGeometry args={[0.32, 0]} />
            <meshBasicMaterial ref={(el) => (panels.current[i] = el)} color={KEY_COLORS[s.color]} toneMapped={false} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.sin((k * Math.PI) / 2) * 0.36, 0.7, Math.cos((k * Math.PI) / 2) * 0.36]} rotation={[0, (k * Math.PI) / 2, 0]}>
              <planeGeometry args={[0.4, 0.7]} />
              <meshBasicMaterial color={new THREE.Color(KEY_COLORS[s.color]).multiplyScalar(1.5)} toneMapped={false} transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

export function Plates({ level }: { level: LevelDef }) {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  useFrame(() => {
    level.plates.forEach((p, i) => {
      const m = mats.current[i]
      if (m) m.color.set(COLORS.safe).multiplyScalar(rt.plates[p.id] ? 3 : 0.8)
    })
  })
  return (
    <>
      {level.plates.map((p, i) => {
        const [w, d] = p.size ?? [2, 2]
        return (
          <group key={p.id} position={p.pos}>
            <mesh position={[0, 0.03, 0]} scale={[w, 0.06, d]} geometry={unitBox} material={dimMat} />
            <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w * 0.8, d * 0.8]} />
              <meshBasicMaterial ref={(el) => (mats.current[i] = el)} color={COLORS.safe} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

export function Anchors() {
  const refs = useRef<(THREE.Group | null)[]>([])
  const count = rt.anchors.length
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    rt.anchors.forEach((a, i) => {
      const g = refs.current[i]
      if (!g) return
      g.visible = a.active
      g.position.copy(a.pos)
      const targeted = rt.player.grappleCandidate === i
      const s = targeted ? 1.35 + Math.sin(t * 10) * 0.1 : 1
      g.scale.setScalar(s)
      g.rotation.y = t * (targeted ? 4 : 1.2)
    })
  })
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <mesh material={safeGlow}>
            <octahedronGeometry args={[0.3, 0]} />
          </mesh>
          <mesh material={safeGlow} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.65, 0.05, 6, 24]} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.9, 16, 12]} />
            <meshBasicMaterial color={COLORS.safe} transparent opacity={0.08} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

const portalFrag = /* glsl */ `
  uniform float uTime; uniform float uOpen; uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    if (r > 1.0) discard;
    float a = atan(c.y, c.x);
    float swirl = sin(a * 5.0 + r * 12.0 - uTime * 5.0) * 0.5 + 0.5;
    float core = smoothstep(0.9, 0.0, r);
    vec3 col = mix(uColor, vec3(1.0), core * 0.6) * (0.6 + swirl * 0.9);
    float alpha = (0.35 + core * 0.6) * uOpen * smoothstep(1.0, 0.85, r);
    gl_FragColor = vec4(col * 2.0, alpha);
  }
`

export function Portal({ level }: { level: LevelDef }) {
  const ring = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  const grp = useRef<THREE.Group>(null)
  const open = useRef(0)
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.danger, toneMapped: false }), [])
  const diskMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: portalFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uColor: { value: new THREE.Color(COLORS.safe) } },
      }),
    [],
  )
  const isBoss = !!level.boss
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const o = portalOpen() && (!isBoss || !rt.boss?.active)
    open.current += ((o ? 1 : 0) - open.current) * (1 - Math.exp(-3 * dt))
    diskMat.uniforms.uTime.value = t
    diskMat.uniforms.uOpen.value = open.current
    ringMat.color.set(o ? COLORS.safe : COLORS.danger).multiplyScalar(o ? 3 : 1.2)
    if (ring.current) ring.current.rotation.z = t * (o ? 1.5 : 0.3)
    if (ring2.current) ring2.current.rotation.z = -t * (o ? 2.2 : 0.2)
    if (grp.current) {
      // boss portal stays hidden until the Sentinel falls
      grp.current.visible = !isBoss || open.current > 0.02
      grp.current.scale.setScalar(isBoss ? Math.max(0.01, open.current) : 1)
    }
    if (o && grp.current && Math.random() < 0.5) {
      const p = grp.current.position
      const a = Math.random() * Math.PI * 2
      burst(new THREE.Vector3(p.x + Math.cos(a) * 1.6, p.y + 1.7 + Math.sin(a) * 1.6, p.z), COLORS.safe, {
        count: 1,
        speed: 1.2,
        life: 0.9,
        size: 0.3,
      })
    }
  })
  return (
    <group ref={grp} position={level.portal}>
      <mesh position={[0, 0.05, 0]} material={dimMat}>
        <cylinderGeometry args={[2.2, 2.4, 0.1, 32]} />
      </mesh>
      <group position={[0, 1.8, 0]}>
        <mesh ref={ring} material={ringMat}>
          <torusGeometry args={[1.7, 0.09, 8, 64]} />
        </mesh>
        <mesh ref={ring2} material={ringMat} scale={1.15}>
          <torusGeometry args={[1.7, 0.03, 6, 6]} />
        </mesh>
        <mesh material={diskMat}>
          <planeGeometry args={[3.4, 3.4]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------- hazards ----------------
const lavaFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uColor;
  varying vec3 vPos;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
  void main(){
    vec2 p = vPos.xz * 0.12;
    float v = n(p + uTime * 0.15) * 0.6 + n(p * 2.3 - uTime * 0.22) * 0.4;
    float cracks = smoothstep(0.42, 0.5, v) - smoothstep(0.5, 0.58, v);
    vec3 col = uColor * (0.18 + v * 0.55) + vec3(1.0, 0.75, 0.35) * cracks * 1.1;
    gl_FragColor = vec4(col * 0.85, 1.0);
  }
`

export function Hazards({ level }: { level: LevelDef }) {
  const mats = useMemo(
    () =>
      level.hazards.map(
        (h) =>
          new THREE.ShaderMaterial({
            vertexShader: 'varying vec3 vPos; void main(){ vPos = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vPos,1.0); }',
            fragmentShader: lavaFrag,
            uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(h.kind === 'lava' ? level.theme.hazard ?? '#ff4d0a' : '#7a3cff') } },
            toneMapped: false,
            transparent: h.kind !== 'lava',
            opacity: 0.9,
          }),
      ),
    [level],
  )
  useFrame((_, dt) => mats.forEach((m) => (m.uniforms.uTime.value += dt)))
  return (
    <>
      {level.hazards.map((h, i) => (
        <mesh key={i} position={[h.pos[0], h.pos[1] + h.size[1] / 2, h.pos[2]]} rotation={[-Math.PI / 2, 0, 0]} material={mats[i]}>
          <planeGeometry args={[h.size[0], h.size[2]]} />
        </mesh>
      ))}
    </>
  )
}

export function Surges({ level }: { level: LevelDef }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ff6a1a').multiplyScalar(2.2),
        transparent: true,
        opacity: 0.55,
        toneMapped: false,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useFrame(({ clock }) => {
    level.surges.forEach((s, i) => {
      const g = refs.current[i]
      const st = rt.surges[i]
      if (!g || !st) return
      g.visible = st.triggered
      g.position.copy(st.pos)
      g.scale.set(s.size[0], s.size[1] * (1 + Math.sin(clock.elapsedTime * 8) * 0.04), s.size[2])
      if (st.triggered && Math.random() < 0.9) {
        burst(
          new THREE.Vector3(st.pos.x + (Math.random() - 0.5) * s.size[0], st.pos.y + (Math.random() - 0.3) * s.size[1] * 0.5, st.pos.z),
          '#ff7a1a',
          { count: 2, speed: 5, life: 0.8, size: 0.6, dir: new THREE.Vector3(0, 0.6, -1), spread: 0.5 },
        )
      }
    })
  })
  return (
    <>
      {level.surges.map((_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} visible={false}>
          <mesh geometry={unitBox} material={mat} />
          <lineSegments geometry={unitEdges} material={edgeMat('#ffb070', 3)} />
        </group>
      ))}
    </>
  )
}

export function Lasers({ level }: { level: LevelDef }) {
  const beams = useRef<(THREE.Group | null)[]>([])
  const count = rt.lasers.length
  const coreMat = useMemo(() => glow('#ff2244', 4), [])
  const outerMat = useMemo(() => glow('#ff2244', 1.6, 0.35), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  useFrame(() => {
    rt.lasers.forEach((l, i) => {
      const g = beams.current[i]
      if (!g) return
      g.visible = l.enabled
      if (!l.enabled) return
      const beam = g.children[0] as THREE.Group
      q.setFromUnitVectors(up, l.dir)
      beam.quaternion.copy(q)
      beam.scale.set(1, l.len, 1)
      beam.position.copy(l.dir).multiplyScalar(l.len / 2)
      if (Math.random() < 0.3) burst(new THREE.Vector3().copy(l.origin).addScaledVector(l.dir, l.len), '#ff5566', { count: 1, speed: 3, life: 0.25, size: 0.25 })
    })
  })
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const l = rt.lasers[i]
        const post = i < level.lasers.length && level.lasers[i].post
        return (
          <group key={i} ref={(el) => (beams.current[i] = el)} position={l.origin}>
            <group>
              <mesh material={coreMat}>
                <cylinderGeometry args={[0.035, 0.035, 1, 6, 1, true]} />
              </mesh>
              <mesh material={outerMat}>
                <cylinderGeometry args={[0.11, 0.11, 1, 8, 1, true]} />
              </mesh>
            </group>
            <mesh material={coreMat}>
              <sphereGeometry args={[0.16, 12, 8]} />
            </mesh>
            {post && (
              <mesh position={[0, -10.2, 0]} material={dimMat}>
                <cylinderGeometry args={[0.22, 0.3, 20, 10]} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}
