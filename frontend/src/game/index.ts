/**
 * Game Module Index
 * ==================
 * Central export point for the entire game module.
 * 
 * Usage:
 * ```typescript
 * import { GameEngine, DemoScene, CarController } from '../game'
 * import type { CameraMode, MapType } from '../game'
 * ```
 */

// ============================================
// TYPES
// ============================================
export * from './types'

// ============================================
// CONFIG
// ============================================
export * from './config'

// ============================================
// ENGINE
// ============================================
export { GameEngine } from './engine/GameEngine'
export { PostProcessingPipeline } from './engine/PostProcessingPipeline'
export { AssetManager } from './engine/AssetManager'
export { InputManager } from './engine/InputManager'

// ============================================
// COMPONENTS
// ============================================
// Camera
export { CameraController } from './components/CameraController'

// Lighting & Environment
export { LightingSetup } from './components/LightingSetup'
export { EnvironmentSetup } from './components/EnvironmentSetup'

// Car (from modular car folder)
export { 
  CarController, 
  CarPhysics,
  CarCameraManager,
  DEFAULT_CAMERA_CONFIG,
} from './components/car'

export type { 
  CameraMode, 
  ControlMode, 
  CameraPositionConfig,
  CarControllerConfig,
  PhysicsInfo,
} from './components/car'

// Map
export { SimpleMap } from './components/SimpleMap'

// ============================================
// SCENES
// ============================================
export { DemoScene } from './scenes/DemoScene'

// ============================================
// SYSTEMS
// ============================================
export { ForkSystem } from './systems/ForkSystem'
