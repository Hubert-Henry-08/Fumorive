/**
 * Game Configuration Index
 * ========================
 * Central export point for all game configurations.
 * 
 * Import configurations from here:
 * ```typescript
 * import { DEFAULT_PHYSICS_CONFIG, DEFAULT_CAMERA_CONFIG } from '../config'
 * ```
 */

// Physics Configuration
export {
  DEFAULT_PHYSICS_CONFIG,
  FORKLIFT_PHYSICS_CONFIG,
  HINO_DUTRO_PHYSICS_CONFIG,
  MOTOR_PHYSICS_CONFIG,
  AIRCRAFT_PHYSICS_CONFIG,
  PHYSICS_PRESETS,
  type PhysicsPreset,
} from './physics.config'

// Camera Configuration
export {
  DEFAULT_CAMERA_CONFIG,
  DEFAULT_THIRD_PERSON_CONFIG,
  DEFAULT_FIRST_PERSON_CONFIG,
  DEFAULT_FREE_CAMERA_CONFIG,
  LARGE_VEHICLE_CAMERA_CONFIG,
  SMALL_VEHICLE_CAMERA_CONFIG,
  FORKLIFT_CAMERA_CONFIG,
  HINO_DUTRO_CAMERA_CONFIG,
  MOTOR_CAMERA_CONFIG,
  AIRCRAFT_CAMERA_CONFIG,
  getLegacyCameraConfig,
  CAMERA_PRESETS,
  type CameraPreset,
} from './camera.config'

// Controls Configuration
export {
  DEFAULT_CONTROLS_CONFIG,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_MOUSE_CONFIG,
  ARROW_KEY_BINDINGS,
  RACING_KEY_BINDINGS,
  HIGH_SENSITIVITY_MOUSE_CONFIG,
  LOW_SENSITIVITY_MOUSE_CONFIG,
  CONTROLS_PRESETS,
  type ControlsPreset,
} from './controls.config'

// Map Configuration
export {
  DEFAULT_MAP_BOUNDS,
  DEFAULT_SPAWN_POINT,
  SOLO_CITY_CONFIG,
  SRIWEDARI_PARK_CONFIG,
  FORKLIFT_TESTING_CONFIG,
  HINO_DUTRO_TESTING_CONFIG,
  MOTOR_TESTING_CONFIG,
  PESAWAT_TESTING_CONFIG,
  MAP_CONFIGS,
  AVAILABLE_MAPS,
  getMapConfig,
} from './map.config'

// Audio Configuration
export {
  AUDIO_PATHS,
  MASTER_VOLUME,
  VOLUME_CATEGORIES,
  SOUND_VOLUMES,
  ENGINE_AUDIO_CONFIG,
  AUDIO_BEHAVIOR,
  AUDIO_CONFIG,
  calculateEffectiveVolume,
  calculateEngineVolume,
  calculateEnginePitch,
  type AudioCategory,
  type SoundName,
  type AudioConfig,
} from './audio.config'

// Drift Particle Configuration
export {
  DEFAULT_DRIFT_PARTICLE_CONFIG,
  SMOKE_DRIFT_PARTICLE_CONFIG,
  DUST_DRIFT_PARTICLE_CONFIG,
  BURNOUT_DRIFT_PARTICLE_CONFIG,
} from './drift-particles.config'
