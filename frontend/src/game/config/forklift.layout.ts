/**
 * Forklift Layout
 * ===============
 * SINGLE SOURCE OF TRUTH untuk struktur area map `forklift-testing`.
 *
 * Alur alur baca (Sumbu Z menuju utara/+Z, spawn di selatan menghadap +Z):
 *   START → STORAGE AREA (12 cargo) → OPERATIONAL LANE → MANEUVER AREA
 *        → OBSTACLE / SAFETY AREA → DROP-OFF AREA (12 target slot) → FINISH
 *
 * Dipakai bersama oleh SimpleMap (struktur fisik map) & ForkliftCargoTest
 * (pickup/drop cargo) agar posisi selalu sinkron. Ground apron forklift:
 * 240 m (X) x 260 m (Z), pusat di z=20 → x -120..120, z -110..150.
 */

export const FORKLIFT_LAYOUT = {
  // Ground apron (dipakai SimpleMap.createForkliftGround)
  groundWidth: 240,
  groundDepth: 260,
  groundCenterZ: 20,

  // START AREA — pad spawn forklift (heading 0 → menghadap +Z ke storage)
  start: { x: 0, z: -82, halfW: 10, halfD: 7 },
  spawn: { x: 0, z: -82, rotationY: 0 },

  // STORAGE AREA — pad + grid 4 kolom x 3 baris (12 cargo)
  storagePad: { x: 0, z: -33, halfW: 20, halfD: 15 },
  cargoColumns: [-13.5, -4.5, 4.5, 13.5],
  cargoRows: [-44, -35, -26],

  // OPERATIONAL LANE — koridor tengah (strip tepi kuning), tanpa dinding
  laneEdgeX: 16,
  laneZStart: -17,
  laneZEnd: 104,

  // MANEUVER AREA — cone zig-zag di tengah lane
  maneuverCones: [
    { x: -7, z: 60 },
    { x: 7, z: 68 },
    { x: -7, z: 76 },
    { x: 7, z: 84 },
    { x: -7, z: 92 },
  ],

  // OBSTACLE / SAFETY AREA — gerbang barier dengan celah tengah 6 m
  obstacle: { x: 0, z: 98, halfW: 16, gapHalf: 3, height: 1.2 },

  // DROP-OFF AREA — pad + grid 4 kolom x 3 baris (12 target slot)
  dropPad: { x: 0, z: 118, halfW: 20, halfD: 13 },
  slotColumns: [-13.5, -4.5, 4.5, 13.5],
  slotRows: [107, 115, 123],

  // FINISH — banner dekat dinding utara
  finish: { x: 0, z: 146 },
} as const