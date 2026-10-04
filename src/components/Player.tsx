import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { rt } from '../game/runtime'
import { P, COLORS } from '../game/constants'
import { RunnerModel, type RunnerPose } from '../procedural-assets/RunnerModel'
import { trailColor } from '../systems/player'
import { useGame } from '../game/store'

/** Kinematic capsule the character controller drives. */
export function PlayerBody() {
  const body = useRef<RapierRigidBody>(null)
  const col = useRef<RapierCollider>(null)
  const start = useMemo(() => rt.player.pos.toArray() as [number, number, number], [])
  useEffect(() => {
    rt.refs.body = body.current
    rt.refs.collider = col.current
    return () => {
      rt.refs.body = null
      rt.refs.collider = null
    }
  }, [])
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={start} enabledRotations={[false, false, false]}>
      <CapsuleCollider ref={col} args={[P.halfHeight, P.radius]} />
    </RigidBody>
  )
}

const pose: RunnerPose = {
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
const side = new THREE.Vector3()

function getPose(): RunnerPose {
  const p = rt.player
  pose.speed = p.speed
  pose.grounded = p.grounded
  pose.wallRunning = p.wallRunning
  if (p.wallRunning) {
    // which side is the wall on, relative to facing?
    side.set(Math.cos(p.facing), 0, -Math.sin(p.facing))
    pose.wallSide = side.dot(p.wallNormal) > 0 ? -1 : 1
  }
  pose.dashing = p.dashT > 0
  pose.grappling = p.grappling
  pose.punch = p.pulseAnim
  pose.blink = p.invuln > 0 && !p.dead && p.invuln < 1.4
  pose.vy = p.vel.y
  return pose
}

export function PlayerVisual() {
  const grp = useRef<THREE.Group>(null)
  const shield = useRef<THREE.Mesh>(null)
  const slow = useRef<THREE.Mesh>(null)
  const trailId = useGame((s) => s.progress.trail)
  const color = useMemo(() => trailColor(), [trailId])

  useFrame(({ clock }) => {
    const p = rt.player
    const g = grp.current
    if (!g) return
    g.visible = !p.dead
    g.position.set(p.pos.x, p.pos.y - P.feet, p.pos.z)
    g.rotation.y = p.facing
    if (shield.current) {
      shield.current.visible = p.shieldT > 0
      shield.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 12) * 0.03)
      ;(shield.current.material as THREE.MeshBasicMaterial).opacity = p.shieldT < 0.6 ? (Math.floor(clock.elapsedTime * 16) % 2) * 0.35 : 0.35
    }
    if (slow.current) {
      slow.current.visible = p.slowT > 0
      slow.current.position.set(p.pos.x, p.pos.y, p.pos.z)
      slow.current.rotation.y = clock.elapsedTime * 0.2
      const k = Math.min(1, (P.slowTime - p.slowT) * 4, p.slowT * 2)
      slow.current.scale.setScalar(Math.max(0.01, k) * 14)
    }
  })

  return (
    <>
      <group ref={grp}>
        <RunnerModel color={color} getPose={getPose} />
        <mesh ref={shield} position={[0, 1.0, 0]} visible={false}>
          <icosahedronGeometry args={[1.35, 2]} />
          <meshBasicMaterial color={new THREE.Color(COLORS.safe).multiplyScalar(2)} transparent opacity={0.35} wireframe toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={slow} visible={false}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color={new THREE.Color(COLORS.secret).multiplyScalar(1.2)} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} wireframe />
      </mesh>
      <GrappleLine />
      <PlayerTrail color={color} />
    </>
  )
}

const TRAIL_N = 32

/** Camera-facing ribbon built from the runner's recent positions. Resets on teleports (respawn). */
function PlayerTrail({ color }: { color: string }) {
  const { geo, mat, hist } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage))
    const alpha = new Float32Array(TRAIL_N * 2)
    for (let i = 0; i < TRAIL_N; i++) alpha[i * 2] = alpha[i * 2 + 1] = Math.pow(i / (TRAIL_N - 1), 1.6)
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    const idx: number[] = []
    for (let i = 0; i < TRAIL_N - 1; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    geo.setIndex(idx)
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() } },
      vertexShader: 'attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor * 2.2, vA * 0.75); }',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const hist = Array.from({ length: TRAIL_N }, () => new THREE.Vector3())
    return { geo, mat, hist }
  }, [])
  useEffect(() => {
    mat.uniforms.uColor.value.set(color)
  }, [color, mat])
  const head = useMemo(() => new THREE.Vector3(), [])
  const toCam = useMemo(() => new THREE.Vector3(), [])
  const tan = useMemo(() => new THREE.Vector3(), [])
  const side = useMemo(() => new THREE.Vector3(), [])
  const primed = useRef(false)
  useFrame(({ camera }) => {
    const p = rt.player
    head.set(p.pos.x + Math.sin(p.facing) * 0.25, p.pos.y + 0.2, p.pos.z + Math.cos(p.facing) * 0.25)
    const last = hist[TRAIL_N - 1]
    if (!primed.current || last.distanceTo(head) > 6 || p.dead) {
      hist.forEach((h) => h.copy(head))
      primed.current = true
    } else if (rt.running) {
      for (let i = 0; i < TRAIL_N - 1; i++) hist[i].copy(hist[i + 1])
      hist[TRAIL_N - 1].copy(head)
    }
    const arr = geo.attributes.position.array as Float32Array
    for (let i = 0; i < TRAIL_N; i++) {
      const a = hist[Math.max(0, i - 1)]
      const b = hist[Math.min(TRAIL_N - 1, i + 1)]
      tan.subVectors(b, a)
      toCam.subVectors(camera.position, hist[i])
      side.crossVectors(tan, toCam)
      const len = side.length()
      const w = 0.28 * (i / (TRAIL_N - 1))
      if (len > 1e-5) side.multiplyScalar(w / len)
      else side.set(0, 0, 0)
      arr.set([hist[i].x + side.x, hist[i].y + side.y, hist[i].z + side.z, hist[i].x - side.x, hist[i].y - side.y, hist[i].z - side.z], i * 6)
    }
    geo.attributes.position.needsUpdate = true
  })
  return <mesh geometry={geo} material={mat} frustumCulled={false} visible={!rt.player.dead} />
}

function GrappleLine() {
  const line = useRef<THREE.Mesh>(null)
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const from = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const m = line.current
    const p = rt.player
    if (!m) return
    m.visible = p.grappling
    if (!p.grappling) return
    from.set(p.pos.x, p.pos.y + 0.6, p.pos.z)
    dir.subVectors(p.grappleTarget, from)
    const len = dir.length()
    dir.divideScalar(len)
    m.quaternion.setFromUnitVectors(up, dir)
    m.scale.set(1, len, 1)
    m.position.copy(from).addScaledVector(dir, len / 2)
  })
  return (
    <mesh ref={line} visible={false}>
      <cylinderGeometry args={[0.04, 0.04, 1, 6, 1, true]} />
      <meshBasicMaterial color={new THREE.Color(COLORS.safe).multiplyScalar(3)} toneMapped={false} />
    </mesh>
  )
}
