import { level, plat } from './builders'

/**
 * Gravity Furnace — a molten sea. Lava never kills outright: it burns and launches you.
 * Phase platforms → laser bridge → shielded drone arena → SURGE chase → timed finale. Only two checkpoints.
 */
export const level4 = level({
  id: 4,
  name: 'Gravity Furnace',
  subtitle: 'Endurance Trial',
  blurb: 'A collapsing forge over a sea of plasma. Flickering platforms, sweeping lasers, shielded drones — and a surge that hunts you.',
  introduces: ['Lava', 'Phase platforms', 'Chase section', 'Shield drones', 'Hunter drones', 'Slow Field'],
  parTime: 150,
  killY: -40,
  spawn: [0, 0, 2],
  spawnYaw: 0,
  theme: {
    skyTop: '#140302',
    skyBottom: '#6e1c05',
    fog: '#3a0d04',
    accent: '#ff7a1a',
    sun: '#ffc08a',
    nebula: '#ff5a1f',
    hazard: '#ff4d0a',
  },
  coresRequired: 5,
  platforms: [
    plat(0, 0, 0, 10, 10, 2),
    plat(0, 0, -41, 8, 8, 2),
    plat(0, 0, -58, 5, 22, 1.5),
    plat(0, 0, -80, 18, 16, 2),
    plat(-26, 2, -80, 4, 4, 1, 'glass'), // secret ledge
    // chase run
    plat(0, 0, -96, 6, 8, 2),
    plat(3, 1.5, -106, 4, 4, 2),
    plat(-1, 3, -114, 4, 4, 2),
    plat(0, 3, -134, 6, 6, 2),
    plat(0, 3, -145, 6, 10, 2),
    // finale
    plat(0, 4, -197, 10, 12, 2),
  ],
  timed: [
    { pos: [0, -0.5, -10], size: [4, 1, 4], period: 3, onTime: 1.9, offset: 0 },
    { pos: [0, -0.5, -17], size: [4, 1, 4], period: 3, onTime: 1.9, offset: 0.75 },
    { pos: [0, -0.5, -24], size: [4, 1, 4], period: 3, onTime: 1.9, offset: 1.5 },
    { pos: [0, -0.5, -31], size: [4, 1, 4], period: 3, onTime: 1.9, offset: 2.25 },
    { pos: [0, 2.5, -157], size: [4, 1, 4], period: 2.6, onTime: 1.7, offset: 0 },
    { pos: [0, 3.5, -185], size: [4, 1, 4], period: 2.6, onTime: 1.7, offset: 1.3 },
  ],
  movers: [{ id: 'ferry', size: [4, 0.6, 4], path: [[0, 2.9, -165], [0, 2.9, -177]], speed: 4, wait: 0.4 }],
  lasers: [
    { pos: [-4.5, 0.7, -52], dir: [1, 0, 0], length: 9, rotSpeed: 1.5, post: true },
    { pos: [4.5, 0.7, -63], dir: [-1, 0, 0], length: 9, rotSpeed: -1.8, post: true },
  ],
  hazards: [{ pos: [0, -4.5, -100], size: [260, 3, 320], dps: 40, bounce: 16, kind: 'lava' }],
  surges: [
    {
      trigger: { pos: [0, 2, -91], size: [18, 10, 2] },
      from: [0, 3, -86],
      to: [0, 3, -138],
      size: [22, 16, 2.5],
      speed: 6.6,
      dps: 45,
    },
  ],
  anchors: [
    [0, 9, -125],
    [-17, 8, -80],
  ],
  gates: [{ id: 'core', pos: [0, 6.5, -194], size: [10, 5, 0.5], color: 'core', requires: { cores: 5 } }],
  cores: [
    [0, 1.2, -39],
    [0, 1.2, -58],
    [6, 1.2, -76],
    [-6, 1.2, -86],
    [3, 2.7, -106],
    [0, 4.4, -171],
  ],
  secrets: [[-26, 3.2, -80]],
  checkpoints: [
    [0, 0, -43],
    [0, 3, -148],
  ],
  healthPads: [[7, 0, -86]],
  enemies: [
    { type: 'shield', pos: [0, 4, -83] },
    { type: 'blaster', pos: [-5, 3.5, -85] },
    { type: 'blaster', pos: [5, 3.5, -85] },
    { type: 'hunter', pos: [-7, 7, -108] },
    { type: 'hunter', pos: [7, 8, -118] },
  ],
  hints: [
    { pos: [0, 0, 1], radius: 4, text: 'Lava burns and launches you — it won’t kill you instantly, but it will hurt' },
    { pos: [0, 0, -4], radius: 2.5, text: 'PHASE PLATFORMS flicker before they vanish. Watch the rhythm' },
    { pos: [0, 0, -43], radius: 3.2, text: 'New ability: SLOW FIELD (F) slows traps, drones and projectiles' },
    { pos: [0, 0, -73], radius: 4, text: 'SHIELD DRONES protect their allies — destroy the shield drone first' },
    { pos: [0, 0, -91], radius: 4, text: 'FURNACE SURGE incoming — RUN!' },
  ],
  portal: [0, 4, -200],
  unlocks: [],
})
