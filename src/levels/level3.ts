import { level, plat, wallX, wallZ } from './builders'

/**
 * Circuit Labyrinth — five rooms, each a puzzle:
 *  A  cyan switch opens the cyan door (crystal hides a secret alcove)
 *  B  laser grid: shove the cube into the beams to cast a safe shadow
 *  C  pressure plate drives the bridge over the pit — park a cube on it
 *  D  orange switch on a ledge → orange door → magenta switch → magenta door
 *  E  core gate + extraction
 */
export const level3 = level({
  id: 3,
  name: 'Circuit Labyrinth',
  subtitle: 'Logic Trial',
  blurb: 'A maze of locked doors and live circuits. Switches, lasers, pressure plates — and blaster drones guarding them.',
  introduces: ['Color switches', 'Laser grids', 'Push cubes', 'Pressure plates', 'Blaster drones'],
  parTime: 125,
  killY: -18,
  spawn: [0, 0, 1],
  spawnYaw: 0,
  theme: {
    skyTop: '#020d10',
    skyBottom: '#0d4a4a',
    fog: '#062226',
    accent: '#2ee6ff',
    sun: '#a8fff4',
    nebula: '#18d6b8',
  },
  coresRequired: 5,
  platforms: [
    // ---- Room A (z 4..-16)
    plat(0, 0, -6, 16, 20),
    wallZ(4.3, -8.6, 8.6),
    wallX(-8.3, 4, -2),
    wallX(-8.3, -6, -16),
    wallX(8.3, 4, -16),
    wallZ(-16.3, -8.6, -2),
    wallZ(-16.3, 2, 8.6),
    // secret alcove behind the crystal
    plat(-11, 0, -4, 5, 4, 1, 'glass'),
    wallX(-13.8, -1.7, -6.3),
    wallZ(-1.7, -13.8, -8),
    wallZ(-6.3, -13.8, -8),
    // ---- Room B laser corridor (x -4..4, z -16..-34) + cube alcove on the right
    plat(0, 0, -25, 8, 18),
    wallX(-4.3, -16, -34),
    wallX(4.3, -16, -19),
    wallX(4.3, -25, -34),
    plat(7, 0, -22, 6, 6),
    wallX(10.3, -18.7, -25.3),
    wallZ(-18.7, 4, 10.6),
    wallZ(-25.3, 4, 10.6),
    // ---- Room C plate + pit (x -6..6, z -34..-56)
    plat(0, 0, -38, 12, 8),
    wallZ(-34.3, -6.6, -4),
    wallZ(-34.3, 4, 6.6),
    wallX(-6.3, -34, -56),
    wallX(6.3, -34, -56),
    // ---- Room D (x -8..8, z -56..-80)
    plat(0, 0, -68, 16, 24),
    wallZ(-56.3, -8.6, -6),
    wallZ(-56.3, 6, 8.6),
    wallX(-8.3, -56, -80),
    wallX(8.3, -56, -80),
    wallZ(-80.3, -8.6, -2),
    wallZ(-80.3, 2, 8.6),
    // inner orange vault (x 2..8, z -72..-80)
    wallZ(-71.7, 1.4, 4),
    wallZ(-71.7, 6, 8),
    wallX(1.7, -71.4, -80),
    plat(-6, 3, -62, 4, 4, 3), // orange switch ledge
    plat(-5, 2.5, -76, 2, 2, 2.5), // core pillar
    // ---- Room E (x -5..5, z -80..-96)
    plat(0, 0, -88, 10, 16),
    wallX(-5.3, -80, -96),
    wallX(5.3, -80, -96),
    wallZ(-96.3, -5.6, 5.6),
  ],
  crystals: [{ pos: [-8.3, 3.5, -4], size: [0.6, 7, 4] }],
  switches: [
    { id: 'cyan', pos: [-6, 0, -12], color: 'cyan' },
    { id: 'orange', pos: [-6.5, 3, -62.5], color: 'orange' },
    { id: 'magenta', pos: [5, 0, -77.5], color: 'magenta' },
  ],
  gates: [
    { id: 'door_c', pos: [0, 3.5, -16.3], size: [4, 7, 0.6], color: 'cyan', requires: { switch: 'cyan' } },
    { id: 'door_o', pos: [5, 3.5, -71.7], size: [2, 7, 0.6], color: 'orange', requires: { switch: 'orange' } },
    { id: 'door_m', pos: [0, 3.5, -80.3], size: [4, 7, 0.6], color: 'magenta', requires: { switch: 'magenta' } },
    { id: 'core', pos: [0, 3.5, -86], size: [10, 7, 0.5], color: 'core', requires: { cores: 5 } },
  ],
  cubes: [{ pos: [7.5, 0.85, -22] }, { pos: [3.5, 0.85, -37] }],
  lasers: [
    { pos: [3.95, 0.45, -28], dir: [-1, 0, 0], length: 8 },
    { pos: [3.95, 1.2, -28], dir: [-1, 0, 0], length: 8 },
    { pos: [3.95, 2.6, -28], dir: [-1, 0, 0], length: 8 },
    { pos: [-3, 0.7, -66], dir: [1, 0, 0], length: 5, rotSpeed: 1.1, post: true },
  ],
  hazards: [{ pos: [0, -3, -49], size: [12, 2, 14], dps: 30, bounce: 17, kind: 'energy' }],
  plates: [{ id: 'p1', pos: [-3.5, 0, -39.5], size: [2.2, 2.2] }],
  movers: [{ id: 'bridge', size: [4, 0.6, 4], path: [[0, -0.3, -44], [0, -0.3, -54]], speed: 3.2, wait: 0.8, activatedBy: 'p1' }],
  cores: [
    [5, 1.2, -10],
    [-2, 1.2, -31.5],
    [0, 1.3, -49],
    [-7, 4.2, -63.2],
    [-5, 3.7, -76],
    [6.5, 1.2, -78],
  ],
  secrets: [[-11, 1.2, -4]],
  checkpoints: [
    [0, 0, -32.5],
    [0, 0, -58.5],
  ],
  healthPads: [[6, 0, -60]],
  enemies: [
    { type: 'blaster', pos: [0, 4.5, -31] },
    { type: 'blaster', pos: [-4, 4.5, -70] },
    { type: 'blaster', pos: [4, 4.5, -62] },
    { type: 'scout', pos: [0, 3, -66], patrol: [[-6, 3, -60], [6, 3, -60], [6, 3, -68], [-6, 3, -68]] },
  ],
  hints: [
    { pos: [0, 0, 0], radius: 4, text: 'Circuit Labyrinth: doors open with matching COLOR SWITCHES' },
    { pos: [-6, 0, -12], radius: 3.2, text: 'Hit a switch with a PULSE BLAST or press E next to it' },
    { pos: [0, 0, -20], radius: 3.5, text: 'Laser grid ahead. Shove the CUBE from the side room into the beams' },
    { pos: [0, 0, -37], radius: 3.2, text: 'The PRESSURE PLATE powers the bridge — but only while something sits on it' },
    { pos: [0, 0, -58.5], radius: 3, text: 'Blaster drones telegraph their shots. Strafe, dash, or pulse the bolts away' },
  ],
  portal: [0, 0, -92],
  unlocks: ['slowField'],
})
