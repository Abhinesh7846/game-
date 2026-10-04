import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useGame } from '../../game/store'

export function PostFX() {
  const quality = useGame((s) => s.settings.quality)
  if (quality === 'low') return null
  return (
    <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={quality === 'high' ? 1.15 : 0.9} radius={0.75} />
      <Vignette eskil={false} offset={0.25} darkness={0.65} />
    </EffectComposer>
  )
}
