/**
 * Car Types
 * =========
 * Type definitions untuk konfigurasi dan state mobil.
 */

// ============================================
// CAMERA TYPES
// ============================================

/**
 * Available camera modes
 */
export type CameraMode = 'third-person' | 'first-person' | 'free'

/**
 * Third Person Camera Configuration
 */
export interface ThirdPersonCameraConfig {
  distance: number
  heightOffset: number
  targetHeightOffset: number
  alpha: number
  beta: number
  lowerRadiusLimit: number
  upperRadiusLimit: number
  inertia: number
  followSpeed: number
  /** Forward offset (meter) sepanjang arah heading mobil untuk look-at target.
   *  Default 0 (fokus di pusat mobil). Nilai positif menggeser titik pandang
   *  ke depan kendaraan (mis. forklift agar pandangan ke jalan lebih luas). */
  forwardTargetOffset?: number
}

/**
 * First Person Camera Configuration
 */
export interface FirstPersonCameraConfig {
  forwardOffset: number
  heightOffset: number
  sideOffset: number
  fov: number
  lookAheadDistance: number
  minZ: number
  maxZ: number
  /** Vertical offset above the firstPersonReferenceNode (meters). Only used when setFirstPersonReference() is called. */
  referenceHeightOffset?: number
  /** Height offset for the look-at target (meters). Used for look-ahead target elevation. */
  targetHeightOffset?: number
}

/**
 * Free Camera Configuration
 */
export interface FreeCameraConfig {
  distance: number
  alpha: number
  beta: number
  lowerRadiusLimit: number
  upperRadiusLimit: number
  lowerBetaLimit: number
  upperBetaLimit: number
  inertia: number
  followSpeed: number
  targetHeightOffset: number
  /** Mouse wheel zoom precision - lower value = faster zoom */
  wheelPrecision?: number
  /** Percentage of current radius to zoom per wheel delta */
  wheelDeltaPercentage?: number
}

/**
 * Complete Camera Configuration
 */
export interface CameraConfig {
  thirdPerson: ThirdPersonCameraConfig
  firstPerson: FirstPersonCameraConfig
  free: FreeCameraConfig
}

/**
 * Legacy Camera Position Config (untuk backward compatibility)
 */
export interface CameraPositionConfig {
  thirdPerson: {
    distance: number
    heightOffset: number
    targetHeightOffset: number
    alpha: number
    beta: number
    lowerRadiusLimit: number
    upperRadiusLimit: number
    forwardTargetOffset?: number
  }
  firstPerson: {
    forwardOffset: number
    heightOffset: number
    sideOffset: number
    fov: number
    lookAheadDistance: number
    /** Near clipping plane distance (opsional). */
    minZ?: number
    /** Far clipping plane distance (opsional). */
    maxZ?: number
  }
}

// ============================================
// CONTROL TYPES
// ============================================

/**
 * Available control modes
 */
export type ControlMode = 'keyboard' | 'mouse' | 'wheel'

/**
 * Key bindings mapping
 */
export interface KeyBindings {
  forward: string[]
  backward: string[]
  left: string[]
  right: string[]
  brake: string[]
  toggleCamera: string[]
  toggleControlMode: string[]
  toggleEngine: string[]
  horn?: string[]
  resetCar?: string[]
  pause?: string[]
}

/**
 * Mouse control configuration
 */
export interface MouseControlConfig {
  sensitivity: number
  returnSpeed: number
  steeringSmoothness: number
  deadZone: number
  invertX: boolean
}

/**
 * Complete controls configuration
 */
export interface ControlsConfig {
  keyBindings: KeyBindings
  mouse: MouseControlConfig
  defaultControlMode: ControlMode
  defaultCameraMode: CameraMode
}

// ============================================
// PHYSICS TYPES
// ============================================

/**
 * Car Physics Configuration
 */
export interface CarPhysicsConfig {
  // Engine
  maxSpeed: number
  reverseMaxSpeed: number
  acceleration: number
  reverseAcceleration: number
  engineBraking: number
  /** Skala kecepatan maksimum per gigi (1 = bawaan). Khusus kendaraan lambat
   *  seperti forklift: 0.75 → gigi tertinggi = 30 m/s. Default 1 (tanpa efek). */
  gearMaxSpeedScale?: number
  
  // Braking
  brakeForce: number
  
  // Steering
  maxSteerAngle: number
  steeringSpeed: number
  turnRadius: number
  /** Offset pivot steering (meter) dari pusat mesh sepanjang arah forward.
   *  0 = berputar di pusat (perilaku mobil biasa).
   *  Negatif = pivot di belakang pusat (rear-wheel steering, forklift).
   *  Default 0 → tidak ada perubahan untuk kendaraan lain. */
  steerPivotOffset?: number
  
  // Grip & Drift
  gripFront: number
  gripRear: number
  /** Speed threshold untuk mulai kehilangan grip saat belok (m/s) */
  driftSpeedThreshold: number
  /** Kecepatan minimum untuk drift terjadi (m/s) */
  driftMinSpeed: number
  /** Sudut steer minimum untuk trigger drift (0-1, relatif terhadap maxSteerAngle) */
  driftSteerThreshold: number
  /** Grip multiplier saat kondisi drift (0-1). Lower = more slidey */
  driftGripMultiplier: number
  /** Seberapa cepat grip berkurang saat brake + turn (0-1) */
  brakeTurnGripLoss: number
  
  // Physics
  mass: number
  rollingResistance: number
  airDragCoefficient: number
  
  // Gravity
  gravity: number
  
  // Visual
  bodyRollFactor: number
  bodyPitchFactor: number
  suspensionStiffness: number
  
  // Collision
  collisionRadius: number
  collisionDamping: number
  collisionBounciness: number
}

/**
 * Legacy CarControllerConfig (untuk backward compatibility)
 */
export type CarControllerConfig = Omit<CarPhysicsConfig, 'collisionRadius' | 'collisionDamping' | 'collisionBounciness'>

// ============================================
// DRIFT PARTICLE TYPES
// ============================================

/**
 * Individual wheel offset for drift particles
 */
export interface WheelOffset {
  /** X offset from car center (positive = right) */
  x: number
  /** Y offset from car center (positive = up) */
  y: number
  /** Z offset from car center (positive = forward) */
  z: number
}

/**
 * Drift particle system configuration
 */
export interface DriftParticleConfig {
  /** Enable/disable drift particles */
  enabled: boolean
  
  // Emission
  /** Base emission rate (particles per second) when drifting lightly */
  baseEmitRate: number
  /** Maximum emission rate at full drift intensity */
  maxEmitRate: number
  /** Minimum slip angle (degrees) to start emitting particles */
  minSlipAngle: number
  /** Slip angle (degrees) at which max emit rate is reached */
  maxSlipAngle: number
  
  // Particle appearance
  /** Minimum particle size */
  minSize: number
  /** Maximum particle size */
  maxSize: number
  /** Particle lifetime in seconds */
  lifetime: number
  /** Particle color (RGBA, 0-1) */
  color: { r: number; g: number; b: number; a: number }
  /** End color for gradient (RGBA, 0-1) */
  colorEnd: { r: number; g: number; b: number; a: number }
  
  // Physics
  /** Particle emit power (velocity) */
  emitPower: number
  /** Gravity affecting particles (positive = down) */
  gravity: number
  
  // Position
  /** Rear left wheel offset from car center */
  rearLeftOffset: WheelOffset
  /** Rear right wheel offset from car center */
  rearRightOffset: WheelOffset
  /** Emit box size (spread area) */
  emitBoxSize: { x: number; y: number; z: number }
  
  // Blending
  /** Use additive blending for brighter effect */
  additiveBlending: boolean
}

// ============================================
// STATE TYPES
// ============================================

/**
 * Car input state
 */
export interface CarInputState {
  throttle: number    // -1 to 1
  steering: number    // -1 to 1
  brake: boolean
}

/**
 * Car physics state (internal)
 */
export interface CarPhysicsState {
  velocity: { x: number; y: number; z: number }
  heading: number
  forwardVelocity: number
  lateralVelocity: number
  steerAngle: number
  targetSteerAngle: number
  verticalVelocity: number
  isGrounded: boolean
  isDrifting: boolean
  slipAngle: number
  bodyRoll: number
  bodyPitch: number
}
