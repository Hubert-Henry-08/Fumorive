/**
 * Map Configuration
 * =================
 * Konfigurasi untuk map/level dalam game.
 */

import type { MapConfig, MapBounds, SpawnPoint } from '../types'

/**
 * Default Map Bounds
 * Batas area bermain dalam meters
 */
export const DEFAULT_MAP_BOUNDS: MapBounds = {
  minX: -200,
  maxX: 200,
  minZ: -300,
  maxZ: 200,
}

/**
 * Default Spawn Point
 * Posisi awal mobil saat game dimulai
 */
export const DEFAULT_SPAWN_POINT: SpawnPoint = {
  position: { x: 50, y: 0, z: 50 },
  rotation: Math.PI / 2,  // Facing direction in radians
}

/**
 * Solo City Map Configuration
 * Urban environment dengan banyak obstacle
 */
export const SOLO_CITY_CONFIG: MapConfig = {
  id: 'solo-city',
  name: 'Solo City',
  description: 'Kota urban dengan gedung-gedung, jalan raya, dan banyak obstacle.',
  
  bounds: DEFAULT_MAP_BOUNDS,
  
  spawn: {
    position: { x: 50, y: 0, z: 50 },
    rotation: Math.PI / 2,
  },
  
  // Environment settings
  environment: {
    groundColor: { r: 0.55, g: 0.65, b: 0.45 },  // Sage green
    skyColorTop: { r: 0.4, g: 0.6, b: 0.9 },     // Bright blue
    skyColorBottom: { r: 0.7, g: 0.8, b: 0.95 }, // Light horizon
    sunDirection: { x: -1, y: -2, z: -1 },
    sunIntensity: 3,
    ambientIntensity: 1.5,
  },
  
  // Map-specific settings
  settings: {
    hasLake: true,
    hasBuildings: true,
    treeCount: 'many',
    roadWidth: 16,
  },
}

/**
 * Sriwedari Park Map Configuration
 * Open park dengan sedikit obstacle
 */
export const SRIWEDARI_PARK_CONFIG: MapConfig = {
  id: 'sriwedari-park',
  name: 'Sriwedari Park',
  description: 'Taman terbuka yang luas dengan sedikit obstacle. Sempurna untuk testing.',
  
  bounds: DEFAULT_MAP_BOUNDS,
  
  spawn: {
    position: { x: 0, y: 0, z: -50 },
    rotation: 0,  // Facing north
  },
  
  environment: {
    groundColor: { r: 0.35, g: 0.55, b: 0.25 },  // Bright green
    skyColorTop: { r: 0.4, g: 0.6, b: 0.9 },
    skyColorBottom: { r: 0.7, g: 0.8, b: 0.95 },
    sunDirection: { x: -1, y: -2, z: -1 },
    sunIntensity: 3,
    ambientIntensity: 1.5,
  },
  
  settings: {
    hasLake: false,
    hasBuildings: false,
    treeCount: 'few',
    roadWidth: 12,
    hasFountain: true,
    hasBenches: true,
    hasLamps: true,
  },
}

/**
 * Forklift Testing Map Configuration
 * ==================================
 * Area simulasi pekerjaan forklift (hanya untuk map forklift-testing):
 * pindahkan 12 cargo dari STORAGE AREA ke DROP-OFF AREA melewati
 * OPERATIONAL LANE, MANEUVER AREA & OBSTACLE/SAFETY AREA.
 * Tanpa NPC, tanpa traffic light, tanpa waypoint wajib.
 */
export const FORKLIFT_TESTING_CONFIG: MapConfig = {
  id: 'forklift-testing',
  name: 'Forklift Testing',
  description: 'Simulasi kerja forklift: angkut 12 cargo dari Storage ke Drop-Off Area melewati lane, maneuver & obstacle.',

  bounds: {
    minX: -120,
    maxX: 120,
    minZ: -110,
    maxZ: 150,
  },

  spawn: {
    position: { x: 0, y: 0, z: -82 },
    rotation: 0, // Heading 0 → menghadap +Z (utara). Model forklift +X disejajarkan via offset.
  },

  environment: {
    groundColor: { r: 0.62, g: 0.62, b: 0.6 },
    skyColorTop: { r: 0.4, g: 0.6, b: 0.9 },
    skyColorBottom: { r: 0.7, g: 0.8, b: 0.95 },
    sunDirection: { x: -1, y: -2, z: -1 },
    sunIntensity: 3,
    ambientIntensity: 1.5,
  },

  settings: {
    hasLake: false,
    hasBuildings: false,
    treeCount: 'none',
    roadWidth: 30,
  },
}

/**
 * Hino Dutro Testing Map Configuration
 * =====================================
 * BUKAN map tersendiri — CLONE dari Solo City. Seluruh struktur (ground,
 * jalan, bangunan, env, boundary, spawn station) dibangun oleh builder yang
 * sama dengan Solo City (SimpleMap.buildSoloCityLayout). Satu-satunya
 * perbedaan: kendaraan pemain diganti truck Hino Dutro
 * (truk_refference_rig.glb). Waypoint & wrong-way detection = Solo City.
 * Metadata di bawah meniru Solo City (Solo City TIDAK diubah).
 */
export const HINO_DUTRO_TESTING_CONFIG: MapConfig = {
  id: 'hino-dutro-testing',
  name: 'Hino Dutro Testing',
  description: 'Solo City clone - kota urban dengan gedung & jalan raya, kendaraan pemain diganti truck Hino Dutro. Waypoint = rute Solo City.',

  bounds: DEFAULT_MAP_BOUNDS,

  spawn: {
    position: { x: 50, y: 0, z: 50 },
    rotation: Math.PI / 2,
  },

  environment: {
    groundColor: { r: 0.55, g: 0.65, b: 0.45 },  // Sage green (mirror Solo City)
    skyColorTop: { r: 0.4, g: 0.6, b: 0.9 },
    skyColorBottom: { r: 0.7, g: 0.8, b: 0.95 },
    sunDirection: { x: -1, y: -2, z: -1 },
    sunIntensity: 3,
    ambientIntensity: 1.5,
  },

  settings: {
    hasLake: true,
    hasBuildings: true,
    treeCount: 'many',
    roadWidth: 16,
  },
}

/**
 * Motor Testing Map Configuration
 * ================================
 * CLONE dari Solo City. Seluruh struktur (ground, jalan, bangunan, env,
 * boundary, spawn station) dibangun oleh builder yang sama dengan Solo City
 * (SimpleMap.buildSoloCityLayout). Kendaraan pemain diganti motor
 * (motor_lowpoly_functional.glb). Waypoint & wrong-way detection = Solo City.
 */
export const MOTOR_TESTING_CONFIG: MapConfig = {
  id: 'motor-testing',
  name: 'Motor Testing',
  description: 'Solo City clone - kota urban dengan gedung & jalan raya, kendaraan pemain diganti motor. Waypoint = rute Solo City.',

  bounds: DEFAULT_MAP_BOUNDS,

  spawn: {
    position: { x: 50, y: 0, z: 50 },
    rotation: Math.PI / 2,
  },

  environment: {
    groundColor: { r: 0.55, g: 0.65, b: 0.45 },
    skyColorTop: { r: 0.4, g: 0.6, b: 0.9 },
    skyColorBottom: { r: 0.7, g: 0.8, b: 0.95 },
    sunDirection: { x: -1, y: -2, z: -1 },
    sunIntensity: 3,
    ambientIntensity: 1.5,
  },

  settings: {
    hasLake: true,
    hasBuildings: true,
    treeCount: 'many',
    roadWidth: 16,
  },
}

/**
 * Pesawat Testing Map Configuration
 * ================================
 * Airport layout sederhana khusus testing pesawat Vultee BT-13 Valiant.
 * TASK 10: layout di-KOMPRESI (ground x -340..620, z -680..980) — cukup untuk
 * airport, city, takeoff, landing, turning, flight route, dan checkpoint.
 * TASK 15: lahan kosong diperkecil lagi menjadi x -410..330, z -460..430
 * (740x890, 41.3% luas lama) — diturunkan dari bbox AKTUAL seluruh objek map
 * (x -301.3..209.3, z -321.3..321.3) ∪ rute CP1-CP10 + radius (x -54..224,
 * z -354..254), ditambah margin 100 m untuk gerak pesawat. Semua objek,
 * runway, apron, taxiway, jalan, dan checkpoint tetap berada di dalam.
 * Nilai bounds ini DICOCOKKAN dengan mesh `airport_ground` di AirportMap.
 */
export const PESAWAT_TESTING_CONFIG: MapConfig = {
  id: 'pesawat-testing',
  name: 'Pesawat Testing',
  description: 'Area testing penerbangan dengan landasan pacu, apron, dan ruang udara yang luas. Kendaraan pemain diganti pesawat.',

  bounds: {
    minX: -410,
    maxX: 330,
    minZ: -460,
    maxZ: 430,
  },

  spawn: {
    position: { x: 0, y: 0, z: -200 },
    rotation: 0,
  },


  environment: {
    groundColor: { r: 0.3, g: 0.4, b: 0.2 },
    skyColorTop: { r: 0.2, g: 0.5, b: 0.9 },
    skyColorBottom: { r: 0.6, g: 0.8, b: 0.9 },
    sunDirection: { x: -1, y: -2, z: -1 },
    sunIntensity: 3,
    ambientIntensity: 1.5,
  },

  settings: {
    hasLake: false,
    hasBuildings: false,
    treeCount: 'none',
    roadWidth: 20,
  },
}

/**
 * All available maps
 */
export const MAP_CONFIGS = {
  'solo-city': SOLO_CITY_CONFIG,
  'sriwedari-park': SRIWEDARI_PARK_CONFIG,
  'forklift-testing': FORKLIFT_TESTING_CONFIG,
  'hino-dutro-testing': HINO_DUTRO_TESTING_CONFIG,
  'motor-testing': MOTOR_TESTING_CONFIG,
  'pesawat-testing': PESAWAT_TESTING_CONFIG,
} as const

/**
 * Get map configuration by ID
 */
export function getMapConfig(mapId: string): MapConfig | undefined {
  return MAP_CONFIGS[mapId as keyof typeof MAP_CONFIGS]
}

/**
 * List of all available map IDs
 */
export const AVAILABLE_MAPS = Object.keys(MAP_CONFIGS) as Array<keyof typeof MAP_CONFIGS>
