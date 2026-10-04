import { level, plat, wallX } from './builders'

/**
 * Training Rift — a straight, readable line that layers one verb at a time:
 * move → jump → dash → double jump → wall-run → pulse → core gate → portal.
 */
export const level1 = level({
  id: 1,
  name: 'Training Rift',
  subtitle: 'Calibration Trial',
  blurb: 'Learn to move like a Runner. Jump, dash, wall-run and blast your way to extraction.',
  introduces: ['Jump', 'Dash', 'Double Jump', 'Wall-run', 'Pulse Blast'],
  parTime: 55,
  killY: -18,
  spawn: [0, 0, 3],
  spawnYaw: 0,
  theme: {
    skyTop: '#04081c',
    skyBottom: '#1a2f6b',
    fog: '#0c1838',
    accent: '#36c8ff',
    sun: '#9fd8ff',
    nebula: '#3b6cff',
  },
  coresRequired: 4,
  platforms: [
    plat(0, 0, 0, 10, 12),
    plat(0, 0, -14, 6, 8),
    plat(0, 1.8, -25, 6, 6),
    plat(0, 1.8, -41, 6, 10),
    plat(-13, 3, -41, 4, 4, 1, 'glass'), // secret perch
    plat(0, 5, -50, 6, 5),
    wallX(3.6, -49, -67, 7, 3, 'runwall'),
    plat(0, 5, -69, 6, 9),
    plat(0, 5, -80, 8, 12),
  ],
  crystals: [{ pos: [0, 7.5, -73.75], size: [6, 5, 0.5] }],
  gates: [{ id: 'g1', pos: [0, 7.5, -82], size: [8, 5, 0.5], color: 'core', requires: { cores: 4 } }],
  cores: [
    [0, 1.3, -14],
    [0, 3.1, -43],
    [2.2, 7.2, -58],
    [0, 6.3, -77],
  ],
  secrets: [[-13, 4.3, -41]],
  pickups: [{ pos: [0, 3.1, -38], ability: 'doubleJump' }],
  checkpoints: [
    [0, 1.8, -45],
    [0, 5, -76],
  ],
  enemies: [
    { type: 'target', pos: [-1.6, 6.8, -71.5] },
    { type: 'target', pos: [1.6, 7.4, -71.5] },
  ],
  hints: [
    { pos: [0, 0, 2], radius: 5, text: 'WASD to move · MOUSE to look around' },
    { pos: [0, 0, -5], radius: 3, text: 'SPACE to jump the gap' },
    { pos: [0, 0, -14], radius: 4, text: 'Grab the yellow ENERGY CORES — they power the exit gate' },
    { pos: [0, 1.8, -25], radius: 3.5, text: 'Long gap — JUMP then press SHIFT mid-air to DASH' },
    { pos: [0, 1.8, -38], radius: 2.6, text: 'Module acquired: press SPACE again in mid-air to DOUBLE JUMP' },
    { pos: [0, 1.8, -45], radius: 2.4, text: 'Green pylons are CHECKPOINTS. Something purple glints to the left…' },
    { pos: [0, 5, -50], radius: 3, text: 'Sprint along the blue wall to WALL-RUN · SPACE to kick off' },
    { pos: [0, 5, -68], radius: 3.5, text: 'LEFT CLICK fires a PULSE BLAST. Shatter the targets and the crystal' },
    { pos: [0, 5, -80], radius: 3, text: 'Core gate unlocks with enough cores. Step into the portal to extract!' },
  ],
  portal: [0, 5, -85],
  unlocks: ['grapple'],
})
