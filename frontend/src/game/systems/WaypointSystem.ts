/**
 * WaypointSystem
 * ==============
 * Checkpoint/waypoint navigation system for driving sessions.
 * 
 * - Waypoints are placed on road center-lines
 * - Multiple pre-defined routes available per map
 * - Route is randomly selected each session
 * - Player must pass checkpoints in order
 * - Tracks progress, time, and missed checkpoints
 */

import { Vector3 } from '@babylonjs/core'
import type { MapType } from '../types'

// ============================================
// TYPES
// ============================================

export interface Waypoint {
  id: number
  position: Vector3        // World position (y=0 on road surface)
  radius: number           // Trigger radius in meters
  roadName: string         // Which road segment it's on
  label?: string           // Optional display label
}

export interface WaypointRoute {
  id: string
  name: string
  description: string
  waypoints: Waypoint[]
  mapType: MapType
}

export type WaypointState = 'upcoming' | 'active' | 'reached' | 'missed'

export interface WaypointProgress {
  waypointId: number
  state: WaypointState
  reachedAt?: number       // timestamp in seconds from session start
}

export interface WaypointSessionData {
  routeId: string
  routeName: string
  totalWaypoints: number
  currentWaypointIndex: number
  waypointProgress: WaypointProgress[]
  startTime: number
  elapsedTime: number
  isCompleted: boolean
  missedCount: number
  reachedCount: number
}

// ============================================
// SOLO CITY ROUTES
// ============================================

/**
 * All waypoints are placed at road center-lines based on the actual
 * road segments in SimpleMap.ts. Coordinates verified against road bounds.
 * 
 * Road center-lines reference:
 * - road_center_v:  x=50,  z range [-180, 160]
 * - road_left_v:    x=-80, z range [-50, 150]
 * - road_top:       z=150, x range [-130, 50]
 * - road_mid:       z=50,  x range [-85, 95]
 * - road_lower:     z=-50, x range [-70, 50]
 * - road_right_v:   x=90,  z range [-112, 58]
 * - road_to_H:      z=-100, x range [100, 170]
 * - road_south_H:   z=-178, x range [45, 175]
 * - road_gedungH_e: x=170, z range [-186, -92]
 * - radial_north:   x=50,  z range [150, 330]
 * - radial_south:   x=50,  z range [-506, -180]
 * - radial_east:    z=-100, x range [90, 290]
 * - radial_west:    z=50,  x range [-286, -80]
 * - ring_north:     z=310, x range [-280, 284]
 * - ring_south:     z=-506, x range [-280, 284]
 * - ring_east:      x=290, z range [-500, 300]
 * - ring_west:      x=-286, z range [-500, 300]
 */

function createWaypoint(id: number, x: number, z: number, roadName: string, radius = 12, label?: string, y = 0): Waypoint {
  // y = ketinggian (unit ~meter). Untuk map darat default 0 (XZ-only);
  // untuk map pesawat-testing bisa > 0 → checkpoint udara.
  return { id, position: new Vector3(x, y, z), radius, roadName, label }
}

// --- Route 1: City Center Loop (short, 8 checkpoints) ---
const SOLO_ROUTE_1: WaypointRoute = {
  id: 'solo-center-loop',
  name: 'Rute Pusat Kota',
  description: 'Rute pendek mengelilingi pusat kota Solo.',
  mapType: 'solo-city',
  waypoints: [
    createWaypoint(1, 50, 80,    'road_center_v',   12, 'Start'),
    createWaypoint(2, 50, 150,   'road_center_v',   12, 'Persimpangan Utara'),
    createWaypoint(3, -30, 150,  'road_top',        12, 'Jl. Atas Tengah'),
    createWaypoint(4, -80, 150,  'road_left_v',     12, 'Simpang Kiri-Atas'),
    createWaypoint(5, -80, 50,   'road_left_v',     12, 'Simpang Kiri-Tengah'),
    createWaypoint(6, -30, 50,   'road_mid',        12, 'Jl. Tengah'),
    createWaypoint(7, 50, 50,    'road_center_v',   12, 'Persimpangan Pusat'),
    createWaypoint(8, 50, -20,   'road_center_v',   12, 'Finish'),
  ],
}

// --- Route 2: Eastern District (medium, 10 checkpoints) ---
const SOLO_ROUTE_2: WaypointRoute = {
  id: 'solo-east-district',
  name: 'Rute Distrik Timur',
  description: 'Rute melalui distrik timur dan area Gedung H.',
  mapType: 'solo-city',
  waypoints: [
    createWaypoint(1,  50,  80,   'road_center_v',   12, 'Start'),
    createWaypoint(2,  50,  25,   'road_center_v',   12, 'Jl. Pusat Selatan'),
    createWaypoint(3,  50,  -50,  'road_center_v',   12, 'Simpang Bawah'),
    createWaypoint(4,  50,  -120, 'road_center_v',   12, 'Jl. Pusat Jauh'),
    createWaypoint(5,  50,  -178, 'road_center_v',   12, 'Simpang Selatan'),
    createWaypoint(6,  110, -178, 'road_south_H',    12, 'Jl. Selatan H'),
    createWaypoint(7,  170, -178, 'road_gedungH_e',  12, 'Gedung H Selatan'),
    createWaypoint(8,  170, -100, 'road_gedungH_e',  12, 'Gedung H Utara'),
    createWaypoint(9,  135, -100, 'road_to_H',       12, 'Jl. Menuju H'),
    createWaypoint(10, 90,  -30,  'road_right_v',    12, 'Finish'),
  ],
}

// --- Route 3: Ring Road Half (long, 12 checkpoints) ---
const SOLO_ROUTE_3: WaypointRoute = {
  id: 'solo-ring-north',
  name: 'Rute Ring Road Utara',
  description: 'Rute panjang melalui ring road bagian utara.',
  mapType: 'solo-city',
  waypoints: [
    createWaypoint(1,  50,  80,   'road_center_v',   12, 'Start'),
    createWaypoint(2,  50,  150,  'road_center_v',   12, 'Radial Utara'),
    createWaypoint(3,  50,  240,  'radial_north',    12, 'Jl. Radial Utara'),
    createWaypoint(4,  50,  310,  'ring_north',      14, 'Ring Utara Tengah'),
    createWaypoint(5,  170, 310,  'ring_north',      14, 'Ring Utara Timur'),
    createWaypoint(6,  290, 310,  'ring_east',       14, 'Sudut Timur Laut'),
    createWaypoint(7,  290, 100,  'ring_east',       14, 'Ring Timur Atas'),
    createWaypoint(8,  290, -100, 'ring_east',       14, 'Ring Timur Tengah'),
    createWaypoint(9,  230, -100, 'radial_east',     12, 'Radial Timur'),
    createWaypoint(10, 170, -100, 'radial_east',     12, 'Simpang Gedung H'),
    createWaypoint(11, 135, -100, 'road_to_H',       12, 'Jl. Menuju H'),
    createWaypoint(12, 90,  -50,  'road_right_v',    12, 'Finish'),
  ],
}

// --- Route 4: Western Loop (medium, 10 checkpoints) ---
const SOLO_ROUTE_4: WaypointRoute = {
  id: 'solo-west-loop',
  name: 'Rute Loop Barat',
  description: 'Rute mengelilingi bagian barat kota melalui ring road.',
  mapType: 'solo-city',
  waypoints: [
    createWaypoint(1,  50,  80,   'road_center_v',   12, 'Start'),
    createWaypoint(2,  50,  50,   'road_center_v',   12, 'Persimpangan Pusat'),
    createWaypoint(3,  -20, 50,   'road_mid',        12, 'Jl. Tengah Kiri'),
    createWaypoint(4,  -80, 50,   'road_left_v',     12, 'Simpang Kiri'),
    createWaypoint(5,  -180,50,   'radial_west',     12, 'Radial Barat'),
    createWaypoint(6,  -286,50,   'ring_west',       14, 'Ring Barat Tengah'),
    createWaypoint(7,  -286,200,  'ring_west',       14, 'Ring Barat Utara'),
    createWaypoint(8,  -286,310,  'ring_north',      14, 'Sudut Barat Laut'),
    createWaypoint(9,  -100,310,  'ring_north',      14, 'Ring Utara Barat'),
    createWaypoint(10, 50,  310,  'radial_north',    14, 'Finish Ring Utara'),
  ],
}

// --- Route 5: Full Ring Road (long, 14 checkpoints) ---
const SOLO_ROUTE_5: WaypointRoute = {
  id: 'solo-full-ring',
  name: 'Rute Ring Road Penuh',
  description: 'Satu putaran penuh ring road. Rute terpanjang!',
  mapType: 'solo-city',
  waypoints: [
    createWaypoint(1,  50,  80,   'road_center_v',   12, 'Start'),
    createWaypoint(2,  50,  240,  'radial_north',    12, 'Radial Utara'),
    createWaypoint(3,  50,  310,  'ring_north',      14, 'Ring Utara'),
    createWaypoint(4,  200, 310,  'ring_north',      14, 'Ring Utara Timur'),
    createWaypoint(5,  290, 310,  'ring_east',       14, 'Sudut Timur Laut'),
    createWaypoint(6,  290, 50,   'ring_east',       14, 'Ring Timur Atas'),
    createWaypoint(7,  290, -300, 'ring_east',       14, 'Ring Timur Bawah'),
    createWaypoint(8,  290, -506, 'ring_south',      14, 'Sudut Tenggara'),
    createWaypoint(9,  50,  -506, 'ring_south',      14, 'Ring Selatan'),
    createWaypoint(10, -150,-506, 'ring_south',      14, 'Ring Selatan Barat'),
    createWaypoint(11, -286,-506, 'ring_west',       14, 'Sudut Barat Daya'),
    createWaypoint(12, -286,0,    'ring_west',       14, 'Ring Barat Tengah'),
    createWaypoint(13, -286,310,  'ring_north',      14, 'Sudut Barat Laut'),
    createWaypoint(14, 50,  310,  'ring_north',      14, 'Finish'),
  ],
}

// --- Route 6: South District (medium, 10 checkpoints) ---
const SOLO_ROUTE_6: WaypointRoute = {
  id: 'solo-south-district',
  name: 'Rute Distrik Selatan',
  description: 'Menjelajahi bagian selatan kota hingga ring road.',
  mapType: 'solo-city',
  waypoints: [
    createWaypoint(1,  50,  80,   'road_center_v',   12, 'Start'),
    createWaypoint(2,  50,  -50,  'road_center_v',   12, 'Simpang Bawah'),
    createWaypoint(3,  -20, -50,  'road_lower',      12, 'Jl. Bawah'),
    createWaypoint(4,  -80, -50,  'road_left_v',     12, 'Simpang Kiri Bawah'),
    createWaypoint(5,  -80, 50,   'road_left_v',     12, 'Simpang Kiri'),
    createWaypoint(6,  50,  50,   'road_mid',        12, 'Kembali ke Pusat'),
    createWaypoint(7,  50,  -178, 'road_center_v',   12, 'Selatan Jauh'),
    createWaypoint(8,  50,  -343, 'radial_south',    12, 'Radial Selatan'),
    createWaypoint(9,  50,  -506, 'ring_south',      14, 'Ring Selatan'),
    createWaypoint(10, 150, -506, 'ring_south',      14, 'Finish'),
  ],
}

// ============================================
// NGAWI CITY ROUTES
// ============================================

// Waypoint positions di Jalan Ngawi City (ring + ring tengah + sekunder + zona),
// semua DI ATAS JALAN. Jalan (koordinat TERKINI, sinkron IndonesiaMap.ts ±245):
//  - ring luar: ring_n z=245, ring_s z=-245, ring_w x=-245, ring_e x=245
//  - poros: main_h z=0 (x -245..245), main_v x=0 (z -245..245)
//  - ring tengah: i_n z=60, i_s z=-60, i_w x=-60, i_e x=60
//  - sekunder: s_n z=140, s_s z=-140, s_w x=-140, s_e x=140 (bentang sampai ±245)
//  - percabangan: rn cz=110 cx=-190 halfX=50 (x -240..-140), rs cz=45 cx=-190 halfX=50,
//    e1 cz=123 cx=192.5 halfX=52.5 (x 140..245)
//  - spbu_a cz=95 cx=70 halfX=70 (x 0..140); sekolah sch_top z=-120, sch_bottom z=-160,
//    sch_v x=100 (z -160..-120); et_a x=195; nr_h z=200; sr_h z=-200
// Spawn di dalam PARKIRAN luas selatan jalan rs (±-165,24), menghadap utara (+Z)
// menuju jalan; bukan di (-170,0).
// Checkpoint pertama SENGAJA dijauhkan dari spawn (>=150m).

const NGAWI_ROUTE_1: WaypointRoute = {
  id: 'ngawi-pintas-kota',
  name: 'Rute Pintas Kota',
  description: 'Putaran mengelilingi pusat & ring tengah: sekunder, main, loop i, perumahan barat.',
  mapType: 'ngawi-city',
  waypoints: [
    createWaypoint(1, 0, 140,    's_n', 12, 'Sekunder Utara'),
    createWaypoint(2, 140, 140,  's_n', 14, 'Simpang Timur-Utara'),
    createWaypoint(3, 140, 60,   's_e', 12, 'Pertokoan Timur'),
    createWaypoint(4, 140, -60,  's_e', 12, 'Timur Selatan'),
    createWaypoint(5, 60, -60,   'i_s', 12, 'Loop Tenggara'),
    createWaypoint(6, 0, 0,      'main_v', 14, 'Simpang Utama'),
    createWaypoint(7, -60, 60,   'i_n', 12, 'Loop Barat-Utara'),
    createWaypoint(8, -140, 60,  's_w', 12, 'Barat Tengah'),
    createWaypoint(9, -140, 45,  'rs', 12, 'Permukiman Timur-Barat'),
    createWaypoint(10, -200, 45, 'rs', 12, 'Pintu Ring Barat'),
  ],
}

const NGAWI_ROUTE_2: WaypointRoute = {
  id: 'ngawi-utara-kantor',
  name: 'Rute Utara & Perkantoran',
  description: 'Menyusuri ring atas, permukiman barat (kopdes), dan jalan utama ke pusat.',
  mapType: 'ngawi-city',
  waypoints: [
    createWaypoint(1, 100, 140,  's_n', 12, 'Sekunder Utara-Timur'),
    createWaypoint(2, 100, 245,  'ring_n', 12, 'Ring Utara'),
    createWaypoint(3, -100, 245, 'ring_n', 12, 'Ring Utara-Barat'),
    createWaypoint(4, -100, 140, 's_n', 12, 'Sekunder Utara-Barat'),
    createWaypoint(5, -170, 110, 'rn', 12, 'Permukiman Utara (Kopdes)'),
    createWaypoint(6, -200, 110, 'rn', 12, 'Ring Barat-Utara'),
    createWaypoint(7, -200, 45,  'rs', 12, 'Ring Barat-Tengah'),
    createWaypoint(8, -140, 45,  'rs', 12, 'Permukiman'),
    createWaypoint(9, 0, 0,      'main_v', 14, 'Simpang Utama'),
    createWaypoint(10, 100, 0,   'main_h', 12, 'Finish Pertokoan'),
  ],
}

const NGAWI_ROUTE_3: WaypointRoute = {
  id: 'ngawi-sekolah-spbu',
  name: 'Rute Sekolah & SPBU',
  description: 'Pertokoan timur, kawasan sekolah (zebra), dan SPBU/bengkel.',
  mapType: 'ngawi-city',
  waypoints: [
    createWaypoint(1, 60, 140,   's_n', 12, 'Sekunder Utara'),
    createWaypoint(2, 140, 123,  'e1', 12, 'Pertokoan Timur'),
    createWaypoint(3, 245, 123,  'e1', 12, 'Ring Timur-Tengah'),
    createWaypoint(4, 245, -60,  'ring_e', 12, 'Ring Timur-Selatan'),
    createWaypoint(5, 140, -140, 's_e', 14, 'Selatan-Timur'),
    createWaypoint(6, 100, -140, 'sch_v', 12, 'Sekolah'),
    createWaypoint(7, 0, -120,   'sch_top', 12, 'Depan Sekolah (Zebra)'),
    createWaypoint(8, 0, 95,     'spbu_a', 12, 'Kawasan SPBU'),
    createWaypoint(9, 100, 95,   'spbu_a', 12, 'SPBU Timur'),
    createWaypoint(10, 140, 140, 's_e', 14, 'Finish Timur'),
  ],
}

const NGAWI_ROUTE_4: WaypointRoute = {
  id: 'ngawi-ring-explore',
  name: 'Rute Eksplorasi Ring',
  description: 'Satu putaran penuh ring road dengan percabangan ring tengah & sekunder.',
  mapType: 'ngawi-city',
  waypoints: [
    createWaypoint(1, 60, 140,   's_n', 12, 'Sekunder Utara'),
    createWaypoint(2, 180, 245,  'ring_n', 12, 'Ring Utara-Timur'),
    createWaypoint(3, 245, 180,  'ring_e', 14, 'Ring Timur'),
    createWaypoint(4, 245, 60,   'ring_e', 12, 'Ring Timur-Tengah'),
    createWaypoint(5, 120, -245, 'ring_s', 12, 'Ring Selatan'),
    createWaypoint(6, -120, -245,'ring_s', 12, 'Ring Selatan-Barat'),
    createWaypoint(7, -245, -120,'ring_w', 12, 'Ring Barat-Selatan'),
    createWaypoint(8, -245, 60,  'ring_w', 12, 'Ring Barat-Tengah'),
    createWaypoint(9, -140, 110, 'rn', 12, 'Permukiman Utara-Barat'),
    createWaypoint(10, 0, 0,     'main_v', 14, 'Finish Simpang Utama'),
  ],
}

// ============================================
// ROUTE REGISTRY
// ============================================

const SOLO_CITY_ROUTES: WaypointRoute[] = [
  SOLO_ROUTE_1,
  SOLO_ROUTE_2,
  SOLO_ROUTE_3,
  SOLO_ROUTE_4,
  SOLO_ROUTE_5,
  SOLO_ROUTE_6,
]

const NGAWI_CITY_ROUTES: WaypointRoute[] = [
  NGAWI_ROUTE_1,
  NGAWI_ROUTE_2,
  NGAWI_ROUTE_3,
  NGAWI_ROUTE_4,
]

// ============================================
// PESAWAT TESTING ROUTES
// ============================================

// Rute sirkuit penerbangan (flight circuit) KOMPAK untuk uji terbang pesawat.
// SELURUH rute berada DI SEKITAR bandara + kota (layout COMPACT Task 10):
//   - Runway x=0, z -260..240; spawn (0,-200) heading 0 (+Z = utara).
//   - Kota timur x≈150..204, z -250..240 (rumah ≤6m, kantor ≤9m)→ CP ≥15m.
// POLA trafik bandara (searah jarum jam): Takeoff(+Z di runway) → Climb →
// Crosswind (kota utara) → Downwind (sisi timur kota) → Base (kembali ke
// bandara) → Final Approach (+Z sejajar runway x=0) → Landing (tepat sebelum
// area touchdown ≈ spawn). 10 checkpoint UDARA, ketinggian nanjak 3→25m lalu
// turun 25→1.5m. Semua koordinat dalam area airport+kota (x -30..200,
// z -330..230) — tidak keluar jauh dari map. radius per-CP dikecilkan (16-24)
// sesuai skala compact; urutan/aktivasi/logika radius GLOBAL tidak diubah.
const PESAWAT_ROUTE_1: WaypointRoute = {
  id: 'pesawat-flight-circuit',
  name: 'Sirkuit Penerbangan Kompak',
  description: 'Sirkuit pendek 10 checkpoint udara di sekitar bandara & kota: Takeoff → Climb → City Circuit → Base → Final Approach → Landing.',
  mapType: 'pesawat-testing',
  waypoints: [
    createWaypoint(1, 0, -140,   'air', 20, 'CP1 — Takeoff', 3),
    createWaypoint(2, 20, 140,   'air', 22, 'CP2 — Climb', 15),
    createWaypoint(3, 150, 230,  'air', 24, 'CP3 — Area Kota (Utara)', 25),
    createWaypoint(4, 200, 90,   'air', 24, 'CP4 — Sisi Kota (Timur)', 25),
    createWaypoint(5, 185, -180, 'air', 24, 'CP5 — Putaran Kota (Selatan)', 18),
    createWaypoint(6, 100, -250, 'air', 24, 'CP6 — Kembali ke Bandara', 12),
    createWaypoint(7, -30, -330, 'air', 24, 'CP7 — Downwind / Persiapan Approach', 10),
    createWaypoint(8, 0, -295,   'air', 22, 'CP8 — Final Approach', 8),
    createWaypoint(9, 0, -250,   'air', 20, 'CP9 — Descent', 4),
    createWaypoint(10, 0, -215,  'air', 16, 'CP10 — Final (Siap Mendarat)', 1.5),
  ],
}

const PESAWAT_TESTING_ROUTES: WaypointRoute[] = [
  PESAWAT_ROUTE_1,
]

/**
 * Get all available routes for a specific map
 */
export function getRoutesForMap(mapType: MapType): WaypointRoute[] {
  if (mapType === 'ngawi-city') {
    return NGAWI_CITY_ROUTES
  }
  if (mapType === 'pesawat-testing') {
    return PESAWAT_TESTING_ROUTES
  }
  // hino-dutro-testing adalah CLONE Solo City → pakai route Solo City.
  return SOLO_CITY_ROUTES
}

/**
 * Get a random route for a specific map
 */
export function getRandomRoute(mapType: MapType): WaypointRoute {
  const routes = getRoutesForMap(mapType)
  const idx = Math.floor(Math.random() * routes.length)
  return routes[idx]
}

/**
 * Get a specific route by ID (any map)
 */
export function getRouteById(routeId: string): WaypointRoute | undefined {
  const all = [...SOLO_CITY_ROUTES, ...NGAWI_CITY_ROUTES, ...PESAWAT_TESTING_ROUTES]
  return all.find(r => r.id === routeId)
}

// ============================================
// WAYPOINT SYSTEM (runtime tracker)
// ============================================

export class WaypointSystem {
  private route: WaypointRoute
  private progress: WaypointProgress[]
  private currentIndex: number = 0
  private startTime: number = 0
  private elapsedTime: number = 0
  private _isCompleted: boolean = false
  private _isStarted: boolean = false

  // Callbacks
  private onWaypointReached?: (waypointId: number, index: number, total: number) => void
  private onRouteCompleted?: (elapsedTime: number, missed: number) => void
  private onWaypointChanged?: (currentIndex: number) => void

  constructor(route: WaypointRoute) {
    this.route = route
    this.progress = route.waypoints.map(wp => ({
      waypointId: wp.id,
      state: 'upcoming' as WaypointState,
    }))
    // Mark first waypoint as active
    if (this.progress.length > 0) {
      this.progress[0].state = 'active'
    }
  }

  /**
   * Set callback for when a waypoint is reached
   */
  setOnWaypointReached(cb: (waypointId: number, index: number, total: number) => void): void {
    this.onWaypointReached = cb
  }

  /**
   * Set callback for when the entire route is completed
   */
  setOnRouteCompleted(cb: (elapsedTime: number, missed: number) => void): void {
    this.onRouteCompleted = cb
  }

  /**
   * Set callback for when the active waypoint changes
   */
  setOnWaypointChanged(cb: (currentIndex: number) => void): void {
    this.onWaypointChanged = cb
  }

  /**
   * Start the waypoint timer
   */
  start(): void {
    this._isStarted = true
    this.startTime = performance.now() / 1000
  }

  /**
   * Update the system every frame.
   * Checks if the car position is within the active waypoint's radius.
   */
  update(carPosition: Vector3, deltaTime: number): void {
    if (!this._isStarted || this._isCompleted) return

    this.elapsedTime += deltaTime

    if (this.currentIndex >= this.route.waypoints.length) {
      this._isCompleted = true
      return
    }

    const activeWaypoint = this.route.waypoints[this.currentIndex]
    // Map pesawat-testing memakai deteksi JARAK 3D (termasuk ketinggian) karena
    // checkpoint udara/altitude. Map darat lain tetap XZ-only (y di-nol-kan).
    const useAltitude = this.route.mapType === 'pesawat-testing'
    const distance = Vector3.Distance(
      new Vector3(carPosition.x, useAltitude ? carPosition.y : 0, carPosition.z),
      new Vector3(
        activeWaypoint.position.x,
        useAltitude ? activeWaypoint.position.y : 0,
        activeWaypoint.position.z
      )
    )

    if (distance <= activeWaypoint.radius) {
      // Waypoint reached!
      this.progress[this.currentIndex].state = 'reached'
      this.progress[this.currentIndex].reachedAt = this.elapsedTime

      this.onWaypointReached?.(
        activeWaypoint.id,
        this.currentIndex,
        this.route.waypoints.length
      )

      this.currentIndex++

      if (this.currentIndex >= this.route.waypoints.length) {
        // Route completed!
        this._isCompleted = true
        const missed = this.progress.filter(p => p.state === 'missed').length
        this.onRouteCompleted?.(this.elapsedTime, missed)
      } else {
        // Activate next waypoint
        this.progress[this.currentIndex].state = 'active'
        this.onWaypointChanged?.(this.currentIndex)
      }
    }
  }

  /**
   * Get current session data for UI
   */
  getSessionData(): WaypointSessionData {
    return {
      routeId: this.route.id,
      routeName: this.route.name,
      totalWaypoints: this.route.waypoints.length,
      currentWaypointIndex: this.currentIndex,
      waypointProgress: [...this.progress],
      startTime: this.startTime,
      elapsedTime: this.elapsedTime,
      isCompleted: this._isCompleted,
      missedCount: this.progress.filter(p => p.state === 'missed').length,
      reachedCount: this.progress.filter(p => p.state === 'reached').length,
    }
  }

  /**
   * Get the current active waypoint
   */
  getActiveWaypoint(): Waypoint | null {
    if (this.currentIndex >= this.route.waypoints.length) return null
    return this.route.waypoints[this.currentIndex]
  }

  /**
   * Get all waypoints in this route
   */
  getAllWaypoints(): Waypoint[] {
    return this.route.waypoints
  }

  /**
   * Get the route info
   */
  getRoute(): WaypointRoute {
    return this.route
  }

  /**
   * Get progress for a specific waypoint
   */
  getWaypointProgress(index: number): WaypointProgress | undefined {
    return this.progress[index]
  }

  /**
   * Whether the route is fully completed
   */
  get isCompleted(): boolean {
    return this._isCompleted
  }

  /**
   * Whether the system has been started
   */
  get isStarted(): boolean {
    return this._isStarted
  }

  /**
   * Get distance from car to active waypoint
   */
  getDistanceToActive(carPosition: Vector3): number {
    const active = this.getActiveWaypoint()
    if (!active) return -1
    const useAltitude = this.route.mapType === 'pesawat-testing'
    return Vector3.Distance(
      new Vector3(carPosition.x, useAltitude ? carPosition.y : 0, carPosition.z),
      new Vector3(
        active.position.x,
        useAltitude ? active.position.y : 0,
        active.position.z
      )
    )
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime(): number {
    return this.elapsedTime
  }

  /**
   * Reset the system for a new attempt
   */
  reset(): void {
    this.currentIndex = 0
    this.elapsedTime = 0
    this.startTime = 0
    this._isCompleted = false
    this._isStarted = false
    this.progress = this.route.waypoints.map(wp => ({
      waypointId: wp.id,
      state: 'upcoming' as WaypointState,
    }))
    if (this.progress.length > 0) {
      this.progress[0].state = 'active'
    }
  }
}
