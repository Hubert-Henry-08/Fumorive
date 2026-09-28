/**
 * Map Types
 * =========
 * Type definitions untuk map/level configuration.
 */

// ============================================
// BASIC TYPES
// ============================================

/**
 * Available map identifiers
 */
export type MapType = 'solo-city' | 'sriwedari-park' | 'ngawi-city' | 'forklift-testing' | 'hino-dutro-testing' | 'motor-testing' | 'pesawat-testing'

/**
 * 3D Vector type for positions
 */
export interface Vector3D {
  x: number
  y: number
  z: number
}

/**
 * RGB Color type
 */
export interface RGBColor {
  r: number
  g: number
  b: number
}

// ============================================
// MAP CONFIGURATION
// ============================================

/**
 * Map boundary definition
 */
export interface MapBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/**
 * Spawn point for vehicles
 */
export interface SpawnPoint {
  position: Vector3D
  rotation: number  // Y-axis rotation in radians
}

/**
 * Environment settings for a map
 */
export interface MapEnvironment {
  groundColor: RGBColor
  skyColorTop: RGBColor
  skyColorBottom: RGBColor
  sunDirection: Vector3D
  sunIntensity: number
  ambientIntensity: number
}

/**
 * Map-specific settings
 */
export interface MapSettings {
  hasLake?: boolean
  hasBuildings?: boolean
  treeCount?: 'none' | 'few' | 'many'
  roadWidth?: number
  hasFountain?: boolean
  hasBenches?: boolean
  hasLamps?: boolean
  [key: string]: unknown  // Allow additional settings
}

/**
 * Complete map configuration
 */
export interface MapConfig {
  id: MapType
  name: string
  description: string
  bounds: MapBounds
  spawn: SpawnPoint
  environment: MapEnvironment
  settings: MapSettings
}

// ============================================
// COLLISION TYPES
// ============================================

/**
 * Axis-aligned bounding box collider
 */
export interface AABBCollider {
  min: Vector3D
  max: Vector3D
}

/**
 * Collision result
 */
export interface CollisionResult {
  collided: boolean
  normal: Vector3D
  penetration: number
}

// ============================================
// MAP INFO (for UI)
// ============================================

/**
 * Map information for selection UI
 */
export interface MapInfo {
  id: MapType
  name: string
  description: string
  thumbnail?: string
}
