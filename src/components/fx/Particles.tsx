import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MAX_PARTICLES, particles } from '../../systems/fx'
import { rt } from '../../game/runtime'

const vert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (420.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`
const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * (1.4 + a * 1.6), a * vAlpha);
  }
`

/** Renders the CPU particle pool from systems/fx as a single additive point cloud. */
export function Particles() {
  const ref = useRef<THREE.Points>(null)
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1).setUsage(THREE.DynamicDrawUsage))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    // clear pool between runs
    particles.life.fill(0)
    return { geo, mat }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20) * (rt.running ? 1 : 0.0)
    const pos = geo.attributes.position.array as Float32Array
    const col = geo.attributes.aColor.array as Float32Array
    const size = geo.attributes.aSize.array as Float32Array
    const alpha = geo.attributes.aAlpha.array as Float32Array
    const P = particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (P.life[i] <= 0) {
        alpha[i] = 0
        size[i] = 0
        continue
      }
      P.life[i] -= dt
      const i3 = i * 3
      P.vel[i3 + 1] += P.grav[i] * dt
      const drag = 1 - 1.8 * dt
      P.vel[i3] *= drag
      P.vel[i3 + 1] *= drag
      P.vel[i3 + 2] *= drag
      P.pos[i3] += P.vel[i3] * dt
      P.pos[i3 + 1] += P.vel[i3 + 1] * dt
      P.pos[i3 + 2] += P.vel[i3 + 2] * dt
      pos[i3] = P.pos[i3]
      pos[i3 + 1] = P.pos[i3 + 1]
      pos[i3 + 2] = P.pos[i3 + 2]
      col[i3] = P.col[i3]
      col[i3 + 1] = P.col[i3 + 1]
      col[i3 + 2] = P.col[i3 + 2]
      const k = Math.max(0, P.life[i] / P.maxLife[i])
      alpha[i] = k
      size[i] = P.size[i] * (0.4 + 0.6 * k)
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.aColor.needsUpdate = true
    geo.attributes.aSize.needsUpdate = true
    geo.attributes.aAlpha.needsUpdate = true
  })

  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} renderOrder={10} />
}

/** Expanding billboard rings for pulses, explosions and pickups. */
export function Shockwaves() {
  const group = useRef<THREE.Group>(null)
  const { geo, mats } = useMemo(() => {
    const geo = new THREE.RingGeometry(0.82, 1, 48)
    const mats = Array.from({ length: 16 }, () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    )
    return { geo, mats }
  }, [])
  useFrame(({ camera }, delta) => {
    const g = group.current
    if (!g) return
    const dt = rt.running ? Math.min(delta, 0.05) : 0
    rt.shockwaves.forEach((w, i) => {
      const m = g.children[i] as THREE.Mesh
      if (!m) return
      if (!w.alive) {
        m.visible = false
        return
      }
      w.t += dt
      const k = w.t / w.life
      if (k >= 1) {
        w.alive = false
        m.visible = false
        return
      }
      m.visible = true
      m.position.copy(w.pos)
      m.quaternion.copy(camera.quaternion)
      const s = w.radius * (0.15 + 0.85 * (1 - Math.pow(1 - k, 3)))
      m.scale.setScalar(s)
      const mat = m.material as THREE.MeshBasicMaterial
      mat.color.copy(w.color).multiplyScalar(2.5)
      mat.opacity = (1 - k) * 0.9
    })
  })
  return (
    <group ref={group}>
      {mats.map((m, i) => (
        <mesh key={i} geometry={geo} material={m} visible={false} frustumCulled={false} />
      ))}
    </group>
  )
}
