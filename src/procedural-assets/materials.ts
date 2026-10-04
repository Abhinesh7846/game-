import * as THREE from 'three'
import type { SurfaceKind } from '../game/types'

interface GridOpts {
  base: THREE.ColorRepresentation
  line: THREE.ColorRepresentation
  intensity: number
  scale?: number
  metalness?: number
  roughness?: number
  opacity?: number
  emissive?: THREE.ColorRepresentation
  emissiveIntensity?: number
}

/**
 * MeshStandardMaterial with a world-space, triplanar neon grid baked into the emissive term.
 * Grid lines are anti-aliased with fwidth so they stay crisp at any distance; bloom picks them up.
 */
export function gridMaterial(o: GridOpts) {
  const m = new THREE.MeshStandardMaterial({
    color: o.base,
    metalness: o.metalness ?? 0.6,
    roughness: o.roughness ?? 0.4,
    transparent: o.opacity != null && o.opacity < 1,
    opacity: o.opacity ?? 1,
    emissive: o.emissive ?? '#000000',
    emissiveIntensity: o.emissiveIntensity ?? 1,
  })
  const uniforms = {
    uGridColor: { value: new THREE.Color(o.line) },
    uGridIntensity: { value: o.intensity },
    uGridScale: { value: o.scale ?? 1 },
  }
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGridPos;\nvarying vec3 vGridNormal;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvGridPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGridNormal = normalize(mat3(modelMatrix) * objectNormal);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vGridPos;\nvarying vec3 vGridNormal;\nuniform vec3 uGridColor;\nuniform float uGridIntensity;\nuniform float uGridScale;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 an = abs(vGridNormal);
          vec2 guv = an.y > 0.6 ? vGridPos.xz : (an.x > 0.6 ? vGridPos.zy : vGridPos.xy);
          guv *= uGridScale;
          vec2 gw = max(fwidth(guv), vec2(1e-4));
          vec2 g = abs(fract(guv - 0.5) - 0.5) / gw;
          float minor = 1.0 - min(min(g.x, g.y), 1.0);
          vec2 guv2 = guv * 0.25;
          vec2 gw2 = max(fwidth(guv2), vec2(1e-4));
          vec2 g2 = abs(fract(guv2 - 0.5) - 0.5) / (gw2 * 1.6);
          float major = 1.0 - min(min(g2.x, g2.y), 1.0);
          float fade = clamp(1.0 - length(gw) * 2.5, 0.0, 1.0);
          totalEmissiveRadiance += uGridColor * (minor * 0.22 * fade + major * 0.9) * uGridIntensity;
        }`,
      )
  }
  m.customProgramCacheKey = () => 'grid-v1'
  return m
}

/** Material set for a level theme. Cached per accent so remounts reuse compiled programs. */
const cache = new Map<string, Record<SurfaceKind, THREE.MeshStandardMaterial>>()

export function surfaceMaterials(accent: string) {
  let set = cache.get(accent)
  if (set) return set
  set = {
    metal: gridMaterial({ base: '#1a2131', line: accent, intensity: 0.55, metalness: 0.75, roughness: 0.35 }),
    neon: gridMaterial({ base: '#121726', line: accent, intensity: 0.9, metalness: 0.6, roughness: 0.3 }),
    glass: gridMaterial({
      base: '#6a3cff',
      line: '#b45cff',
      intensity: 1.2,
      opacity: 0.55,
      metalness: 0.1,
      roughness: 0.1,
      emissive: '#2a0e55',
    }),
    runwall: gridMaterial({ base: '#0d2747', line: '#36c8ff', intensity: 1.4, scale: 1, metalness: 0.5, roughness: 0.3, emissive: '#06182e' }),
    dark: gridMaterial({ base: '#0f131c', line: accent, intensity: 0.28, metalness: 0.7, roughness: 0.5 }),
    arena: gridMaterial({ base: '#171320', line: accent, intensity: 0.7, scale: 0.5, metalness: 0.7, roughness: 0.35 }),
  }
  cache.set(accent, set)
  return set
}

/** Unlit glowing material that bloom will pick up. */
export function glow(color: THREE.ColorRepresentation, intensity = 2, opacity = 1) {
  const c = new THREE.Color(color).multiplyScalar(intensity)
  return new THREE.MeshBasicMaterial({
    color: c,
    toneMapped: false,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  })
}
