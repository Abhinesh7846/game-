import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LevelTheme } from '../../game/types'

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`
const frag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uNebula;
  uniform vec3 uSun;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uBottom, uTop, smoothstep(-0.35, 0.65, h));
    // horizon glow band
    col += uNebula * 0.35 * exp(-abs(h + 0.05) * 9.0);
    // nebula clouds
    float n = fbm(d * 2.6 + vec3(uTime * 0.004, 0.0, uTime * 0.002));
    float n2 = fbm(d * 5.0 - vec3(0.0, uTime * 0.003, 0.0));
    float neb = smoothstep(0.45, 0.85, n) * (0.5 + 0.5 * n2);
    col += uNebula * neb * 0.55 * smoothstep(-0.2, 0.4, h + 0.2);
    // stars
    vec3 sp = d * 220.0;
    float s = hash(floor(sp));
    float star = step(0.9965, s) * smoothstep(-0.1, 0.3, h);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 100.0);
    col += vec3(star * tw * 1.6);
    // rift sun
    vec3 sunDir = normalize(vec3(-0.35, 0.28, -1.0));
    float sd = max(dot(d, sunDir), 0.0);
    col += uSun * (pow(sd, 400.0) * 3.0 + pow(sd, 18.0) * 0.35);
    // ring around the sun
    float ring = exp(-pow((acos(clamp(dot(d, sunDir), -1.0, 1.0)) - 0.16) * 60.0, 2.0));
    col += uSun * ring * 0.8;
    gl_FragColor = vec4(col, 1.0);
  }
`

export function Sky({ theme }: { theme: LevelTheme }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color(theme.skyTop) },
          uBottom: { value: new THREE.Color(theme.skyBottom) },
          uNebula: { value: new THREE.Color(theme.nebula) },
          uSun: { value: new THREE.Color(theme.sun) },
          uTime: { value: 0 },
        },
      }),
    [theme],
  )
  const mesh = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
    mesh.current?.position.copy(camera.position)
  })
  return (
    <mesh ref={mesh} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[500, 48, 24]} />
    </mesh>
  )
}

/** Distant floating debris and monoliths that sell the "suspended in the void" feeling. */
export function Debris({ accent, center = [0, 0, -60] }: { accent: string; center?: [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = 70
  const data = useMemo(() => {
    const rnd = mulberry(7)
    return Array.from({ length: count }, () => {
      const a = rnd() * Math.PI * 2
      const r = 110 + rnd() * 160
      return {
        pos: new THREE.Vector3(center[0] + Math.cos(a) * r, -60 + rnd() * 140, center[2] + Math.sin(a) * r),
        rot: new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3),
        scale: new THREE.Vector3(2 + rnd() * 8, 2 + rnd() * 18, 2 + rnd() * 8),
        spin: (rnd() - 0.5) * 0.1,
        bob: rnd() * 10,
      }
    })
  }, [center])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#141a28', metalness: 0.8, roughness: 0.4, emissive: new THREE.Color(accent), emissiveIntensity: 0.06 }),
    [accent],
  )
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    const im = ref.current
    if (!im) return
    const t = clock.elapsedTime
    data.forEach((d, i) => {
      p.copy(d.pos)
      p.y += Math.sin(t * 0.2 + d.bob) * 2
      q.setFromEuler(new THREE.Euler(d.rot.x + t * d.spin, d.rot.y + t * d.spin * 0.7, d.rot.z))
      m4.compose(p, q, d.scale)
      im.setMatrixAt(i, m4)
    })
    im.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} material={mat} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  )
}

export function mulberry(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
