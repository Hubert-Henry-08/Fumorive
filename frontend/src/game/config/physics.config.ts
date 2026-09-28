/**
 * Car Physics Configuration
 * ========================
 * Semua nilai physics mobil terpusat di sini untuk kemudahan tuning.
 * 
 * Units:
 * - Speed: meters per second (m/s) | 1 m/s ≈ 3.6 km/h
 * - Acceleration: meters per second squared (m/s²)
 * - Angles: radians | π/6 ≈ 30°
 * - Mass: kilograms (kg)
 */

import type { CarPhysicsConfig } from '../types'

/**
 * Default Car Physics Configuration
 * Tuned for arcade-style driving feel
 */
export const DEFAULT_PHYSICS_CONFIG: CarPhysicsConfig = {
  // ============================================
  // ENGINE
  // ============================================
  /** Maximum forward speed in m/s. 35 m/s ≈ 126 km/h */
  maxSpeed: 40,
  
  /** Maximum reverse speed in m/s. 12 m/s ≈ 43 km/h */
  reverseMaxSpeed: 5,
  
  /** Forward acceleration force in m/s². Higher = faster acceleration */
  acceleration: 5,
  
  /** Reverse acceleration force in m/s² */
  reverseAcceleration: 2,
  
  /** Deceleration when coasting (no throttle) in m/s² */
  engineBraking: 4,

  // ============================================
  // BRAKING
  // ============================================
  /** Normal brake deceleration in m/s². Higher = stronger brakes */
  brakeForce: 30,

  // ============================================
  // STEERING
  // ============================================
  /** Maximum steering angle in radians. π/5 ≈ 36° */
  maxSteerAngle: Math.PI / 5,
  
  /** How fast steering wheel turns. Higher = more responsive */
  steeringSpeed: 5,
  
  /** Minimum turn radius at low speed in meters */
  turnRadius: 6,

  // ============================================
  // GRIP & DRIFT
  // ============================================
  /** Front tire grip (0-1). Higher = more grip, better handling */
  gripFront: 0.75,
  
  /** Rear tire grip (0-1). Lower = easier to drift/oversteer */
  gripRear: 0.45,
  
  /** Speed threshold where grip starts reducing during turns (m/s). 8 m/s ≈ 29 km/h */
  driftSpeedThreshold: 6,
  
  /** Minimum speed required for drift to occur (m/s). 4 m/s ≈ 14 km/h */
  driftMinSpeed: 3,
  
  /** Steering threshold to trigger drift (0-1). 0.3 = 30% of max steering */
  driftSteerThreshold: 0.2,
  
  /** Grip multiplier during drift conditions (0-1). Lower = more slidey */
  driftGripMultiplier: 0.1,
  
  /** How much grip is lost when braking while turning (0-1). Higher = more loss */
  brakeTurnGripLoss: 0.85,

  // ============================================
  // PHYSICS
  // ============================================
  /** Car mass in kg. Affects momentum and collision response */
  mass: 1200,
  
  /** Rolling friction coefficient. Higher = more resistance */
  rollingResistance: 0.01,
  
  /** Aerodynamic drag coefficient. Affects top speed */
  airDragCoefficient: 0.35,

  // ============================================
  // GRAVITY
  // ============================================
  /** Gravity acceleration in m/s². Negative = downward */
  gravity: -20,

  // ============================================
  // VISUAL DYNAMICS
  // ============================================
  /** Body roll intensity in radians per G-force. Higher = more lean in turns */
  bodyRollFactor: 0.02,
  
  /** Body pitch intensity in radians per G-force. Higher = more nose dive/lift */
  bodyPitchFactor: 0.02,
  
  /** How fast body returns to neutral (1-20). Higher = stiffer suspension */
  suspensionStiffness: 8,

  // ============================================
  // COLLISION
  // ============================================
  /** Car collision radius in meters */
  collisionRadius: 1.8,
  
  /** Energy loss on collision (0-1). Lower = more bounce */
  collisionDamping: 0.7,
  
  /** Bounce factor on collision. Higher = bouncier */
  collisionBounciness: 1.5,
}

/**
 * Forklift Physics Configuration
 * ==============================
 * Kendaraan industri (forklift) dengan karakteristik:
 * - Berat & lambat (mass 3500, akselerasi 2.5)
 * - REAR-WHEEL STEERING via steerPivotOffset = -1.15 (pivot di poros roda
 *   belakang model forkliftbaru.glb: SteerWheel_L/R_STEER_PIVOT = x -1.15)
 * - Kecepatan maksimum dibatasi 30 m/s via gearMaxSpeedScale = 0.75
 * - Grip kecil agar tidak oleng seperti mobil biasa
 */
export const FORKLIFT_PHYSICS_CONFIG: CarPhysicsConfig = {
  // ============================================
  // ENGINE
  // ============================================
  /** Maksimum kecepatan forward m/s (30 m/s ≈ 108 km/h) */
  maxSpeed: 30,
  
  /** Maksimum kecepatan mundur m/s (~11 km/h) */
  reverseMaxSpeed: 3.5,
  
  /** Akselerasi maju m/s² — lambat seperti kendaraan berat */
  acceleration: 2.5,
  
  /** Akselerasi mundur m/s² */
  reverseAcceleration: 1.2,
  
  /** Engine braking ketika tidak ada throttle */
  engineBraking: 2.5,

  /** Skala gigi sehingga top speed efektif = 40 * 0.75 = 30 m/s */
  gearMaxSpeedScale: 0.75,

  // ============================================
  // BRAKING
  // ============================================
  /** Rem m/s² */
  brakeForce: 25,

  // ============================================
  // STEERING
  // ============================================
  /** Max steering angle 30° */
  maxSteerAngle: Math.PI / 6,
  
  /** Steering response lambat — feel industri */
  steeringSpeed: 3.5,
  
  /** Turn radius kecil (forklift harus bisa manuver ketat) */
  turnRadius: 3.0,

  /** Rear-wheel steering: pivot rotasi di poros roda belakang (x -1.15 model) */
  steerPivotOffset: -1.15,

  // ============================================
  // GRIP & DRIFT
  // ============================================
  /** Grip depan */
  gripFront: 0.65,
  
  /** Grip belakang — forklift tidak boleh drift seperti mobil */
  gripRear: 0.55,
  
  /** Drift threshold */
  driftSpeedThreshold: 6,
  driftMinSpeed: 3,
  driftSteerThreshold: 0.25,
  driftGripMultiplier: 0.1,
  brakeTurnGripLoss: 0.75,

  // ============================================
  // PHYSICS
  // ============================================
  /** Massa berat (kg) */
  mass: 3500,
  
  /** Rolling resistance lebih besar (kendaraan berat) */
  rollingResistance: 0.02,
  
  /** Aerodynamic drag (badan kotak) */
  airDragCoefficient: 0.5,

  // ============================================
  // GRAVITY
  // ============================================
  gravity: -20,

  // ============================================
  // VISUAL DYNAMICS
  // ============================================
  // Roll/pitch visual dimatikan: forklift bertugas angkat box, body tidak
  // boleh tampak miring/terangkat saat berbelok (user: "bagian belakang
  // terangkat").
  bodyRollFactor: 0,
  bodyPitchFactor: 0,
  suspensionStiffness: 6,

  // ============================================
  // COLLISION
  // ============================================
  /** Collision radius (panjang total model ±3.6 m, lebar ±1.6 m) */
  collisionRadius: 2.2,
  
  /** Damping besar — massa berat tidak memantul */
  collisionDamping: 0.75,
  collisionBounciness: 1.2,
}

/**
 * Hino Dutro Truck Physics Configuration
 * ======================================
 * Truck pengangkut (Hino Dutro) dengan karakteristik:
 * - SANGAT berat & lambat (mass 4500, akselerasi 2.4) — feel truk sungguhan
 * - Front-wheel steering seperti mobil (front axle di x +1.35 model)
 * - Kecepatan maksimum dibatasi 28 m/s (≈ 101 km/h) via gearMaxSpeedScale.
 *   Untuk latihan truk, top speed sengaja diturunkan dari default mobil.
 * - Radius belok besar (turnRadius 9) — truk panjang ±4.8 m, tidak boleh
 *   manuver sengit seperti forklift.
 * - Collision radius 2.6 (body ±4.82 panjang × 3.44 lebar → ball radius kira-kira
 *   setengah diagonal bidang, dibulatkan ke atas agar aman di koridor 20m).
 * - Roll/pitch visual DIPERTAHANKAN (truk lebih dinamis dari forklift) namun
 *   kecil (0.012) karena body tinggi.
 */
export const HINO_DUTRO_PHYSICS_CONFIG: CarPhysicsConfig = {
  // ============================================
  // ENGINE
  // ============================================
  /** Maksimum kecepatan forward m/s (~101 km/h) */
  maxSpeed: 28,

  /** Maksimum kecepatan mundur m/s (~14 km/h) */
  reverseMaxSpeed: 4,

  /** Akselerasi maju m/s² — lambat seperti truk bermuatan */
  acceleration: 2.4,

  /** Akselerasi mundur m/s² */
  reverseAcceleration: 1.3,

  /** Engine braking ketika tidak ada throttle */
  engineBraking: 3.2,

  /** Skala gigi: default 40 juga dipakai internal; top speed 28/40 = 0.7 */
  gearMaxSpeedScale: 0.7,

  // ============================================
  // BRAKING
  // ============================================
  /** Rem m/s² — truk butuh jarak berhenti lebih panjang */
  brakeForce: 28,

  // ============================================
  // STEERING
  // ============================================
  /** Max steering angle 30° */
  maxSteerAngle: Math.PI / 6,

  /** Steering response sedang — truk tidak boleh belok menyentak */
  steeringSpeed: 3.2,

  /** Turn radius besar (panjang truk ±4.8 m) */
  turnRadius: 9,

  // ============================================
  // GRIP & DRIFT
  // ============================================
  /** Grip depan tinggi — arah truk stabil */
  gripFront: 0.7,

  /** Grip belakang cukup — truk tidak boleh drift */
  gripRear: 0.5,

  driftSpeedThreshold: 8,
  driftMinSpeed: 4,
  driftSteerThreshold: 0.25,
  driftGripMultiplier: 0.08,
  brakeTurnGripLoss: 0.8,

  // ============================================
  // PHYSICS
  // ============================================
  /** Massa sangat berat (kg) */
  mass: 4500,

  /** Rolling resistance besar (truk berat) */
  rollingResistance: 0.025,

  /** Aerodynamic drag tinggi (badan kotak) */
  airDragCoefficient: 0.55,

  // ============================================
  // GRAVITY
  // ============================================
  gravity: -20,

  // ============================================
  // VISUAL DYNAMICS
  // ============================================
  /** Roll/pitch visual kecil — truk tetap terasa hidup tapi tidak oleng */
  bodyRollFactor: 0.012,
  bodyPitchFactor: 0.012,
  suspensionStiffness: 7,

  // ============================================
  // COLLISION
  // ============================================
  /** Collision radius (±4.82 panjang × 3.44 lebar) */
  collisionRadius: 2.6,

  /** Damping besar — massa berat tidak memantul */
  collisionDamping: 0.72,
  collisionBounciness: 1.3,
}

/**
 * Motor (motorcycle) Physics Configuration
 * ==========================================
 * Ringan, lincah, akselerasi cepat. Motor sport ~150kg.
 */
export const MOTOR_PHYSICS_CONFIG: CarPhysicsConfig = {
  // ENGINE
  maxSpeed: 36,                  // ~130 km/h
  reverseMaxSpeed: 5,            // motor bisa mundur pelan
  acceleration: 5.5,             // akselerasi cepat (motor ringan)
  reverseAcceleration: 2.5,
  engineBraking: 2.5,
  gearMaxSpeedScale: 0.7,

  // BRAKING
  brakeForce: 22,

  // STEERING
  maxSteerAngle: Math.PI / 5,    // 36° — motor lebih lincah
  steeringSpeed: 5.0,
  turnRadius: 5,

  // GRIP & DRIFT
  gripFront: 0.85,
  gripRear: 0.8,
  driftSpeedThreshold: 12,
  driftMinSpeed: 8,
  driftSteerThreshold: 0.3,
  driftGripMultiplier: 0.15,
  brakeTurnGripLoss: 0.6,

  // PHYSICS
  mass: 180,                      // motor sport ringan
  rollingResistance: 0.012,
  airDragCoefficient: 0.4,

  // GRAVITY
  gravity: -20,

  // VISUAL DYNAMICS
  bodyRollFactor: 0.02,
  bodyPitchFactor: 0.015,
  suspensionStiffness: 10,

  // COLLISION
  collisionRadius: 2.2,           // scaled 1.855x → cukup untuk body motor
  collisionDamping: 0.5,
  collisionBounciness: 1.8,       // tinggi agar memantul dari pembatas
}

/**
 * Aircraft Physics Configuration
 * ==============================
 * Arcade flight physics untuk Vultee BT-13 Valiant.
 */
export const AIRCRAFT_PHYSICS_CONFIG: CarPhysicsConfig = {
  // ENGINE
  maxSpeed: 60,                  // ~216 km/h
  reverseMaxSpeed: 5,            // pushback pelan
  acceleration: 8,               // engine piston
  reverseAcceleration: 2,
  engineBraking: 1,              // gliding
  gearMaxSpeedScale: 1,

  // BRAKING
  brakeForce: 15,                // wheel brakes

  // STEERING (ground steering only)
  maxSteerAngle: Math.PI / 6,    // 30°
  steeringSpeed: 3,
  turnRadius: 8,

  // GRIP & DRIFT (not really used in air, used for ground)
  gripFront: 0.8,
  gripRear: 0.8,
  driftSpeedThreshold: 20,
  driftMinSpeed: 10,
  driftSteerThreshold: 0.5,
  driftGripMultiplier: 0.5,
  brakeTurnGripLoss: 0.5,

  // PHYSICS
  mass: 1200,                    // trainer aircraft mass
  rollingResistance: 0.005,      // low resistance on runway
  airDragCoefficient: 0.1,       // low drag

  // GRAVITY
  gravity: -20,

  // VISUAL DYNAMICS
  bodyRollFactor: 0,             // controlled by aircraft system instead
  bodyPitchFactor: 0,            // controlled by aircraft system instead
  suspensionStiffness: 15,

  // COLLISION
  collisionRadius: 4.5,          // covers wingspan and length mostly
  collisionDamping: 0.8,
  collisionBounciness: 0.2,
}

/**
 * Preset physics yang terdaftar (dapat dipilih lewat key lookup).
 * `forklift` ditambahkan agar konsisten dengan CAMERA_PRESETS dan tersedia
 * untuk konsumen yang me-resolve physics via preset key. DemoScene tetap
 * mengirim FORKLIFT_PHYSICS_CONFIG secara langsung (tanpa lookup).
 */
export const PHYSICS_PRESETS = {
  default: DEFAULT_PHYSICS_CONFIG,
  forklift: FORKLIFT_PHYSICS_CONFIG,
  hinoDutro: HINO_DUTRO_PHYSICS_CONFIG,
  motor: MOTOR_PHYSICS_CONFIG,
  aircraft: AIRCRAFT_PHYSICS_CONFIG,
} as const

export type PhysicsPreset = keyof typeof PHYSICS_PRESETS
