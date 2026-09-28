/**
 * Camera Configuration
 * ====================
 * Semua konfigurasi kamera terpusat di sini.
 * Mendukung Third Person, First Person, dan Free Camera modes.
 */

import type { CameraConfig, ThirdPersonCameraConfig, FirstPersonCameraConfig, FreeCameraConfig, CameraPositionConfig } from '../types'

/**
 * Third Person Camera Configuration
 * Camera yang mengikuti mobil dari belakang
 */
export const DEFAULT_THIRD_PERSON_CONFIG: ThirdPersonCameraConfig = {
  /** Distance from car center in meters */
  distance: 8,
  
  /** Height above car center in meters */
  heightOffset: 1.0,
  
  /** Height offset for camera look-at target */
  targetHeightOffset: 0.8,
  
  /** Horizontal angle in radians (rotation around car) */
  alpha: -Math.PI / 4,
  
  /** Vertical angle in radians (elevation) */
  beta: Math.PI / 3.5,
  
  /** Minimum zoom distance */
  lowerRadiusLimit: 4,
  
  /** Maximum zoom distance */
  upperRadiusLimit: 20,
  
  /** Camera smoothing inertia (0-1). Higher = smoother but slower response */
  inertia: 0.9,
  
  /** Follow speed when car moves (0-1). Higher = faster follow */
  followSpeed: 0.15,
}

/**
 * First Person Camera Configuration
 * Cockpit view dari dalam mobil
 */
export const DEFAULT_FIRST_PERSON_CONFIG: FirstPersonCameraConfig = {
  /** Forward/backward offset from car center. Positive = forward */
  forwardOffset: 0.3,
  
  /** Height above car floor (eye level) */
  heightOffset: 0.8,
  
  /** Left/right offset. Positive = right (driver's seat) */
  sideOffset: 0.3,
  
  /** Field of view in radians. ~1.2 rad ≈ 70° */
  fov: 1.2,
  
  /** How far ahead the camera looks in meters */
  lookAheadDistance: 50,
  
  /** Near clipping plane distance */
  minZ: 0.1,
  
  /** Far clipping plane distance */
  maxZ: 1000,
}

/**
 * Free Camera Configuration
 * User dapat memutar kamera bebas di sekitar mobil
 */
export const DEFAULT_FREE_CAMERA_CONFIG: FreeCameraConfig = {
  /** Initial distance from car */
  distance: 8,
  
  /** Initial horizontal angle */
  alpha: -Math.PI / 2,
  
  /** Initial vertical angle */
  beta: Math.PI / 3,
  
  /** Minimum zoom distance */
  lowerRadiusLimit: 4,
  
  /** Maximum zoom distance */
  upperRadiusLimit: 50,
  
  /** Minimum vertical angle (prevent going underground) */
  lowerBetaLimit: 0.1,
  
  /** Maximum vertical angle (prevent going too high) */
  upperBetaLimit: Math.PI / 2 - 0.1,
  
  /** Camera smoothing inertia */
  inertia: 0.9,
  
  /** Target follow speed */
  followSpeed: 0.15,
  
  /** Height offset for target */
  targetHeightOffset: 0.8,
  
  /** Mouse wheel zoom precision - lower = faster zoom */
  wheelPrecision: 20,
  
  /** Percentage of current radius to zoom per wheel delta */
  wheelDeltaPercentage: 0.05,
}

/**
 * Complete Camera Configuration
 * Menggabungkan semua mode kamera
 */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  thirdPerson: DEFAULT_THIRD_PERSON_CONFIG,
  firstPerson: DEFAULT_FIRST_PERSON_CONFIG,
  free: DEFAULT_FREE_CAMERA_CONFIG,
}

/**
 * Camera config untuk kendaraan yang lebih besar (truck, pickup)
 */
export const LARGE_VEHICLE_CAMERA_CONFIG: CameraConfig = {
  thirdPerson: {
    ...DEFAULT_THIRD_PERSON_CONFIG,
    distance: 10,           // Lebih jauh
    heightOffset: 3.0,      // Lebih tinggi
    targetHeightOffset: 2.5,
  },
  firstPerson: {
    ...DEFAULT_FIRST_PERSON_CONFIG,
    forwardOffset: 0.1,
    heightOffset: 2.25,     // Cab lebih tinggi
    sideOffset: -0.05,
  },
  free: {
    ...DEFAULT_FREE_CAMERA_CONFIG,
    distance: 10,
  },
}

/**
 * Camera config untuk kendaraan kecil (sports car)
 */
export const SMALL_VEHICLE_CAMERA_CONFIG: CameraConfig = {
  thirdPerson: {
    ...DEFAULT_THIRD_PERSON_CONFIG,
    distance: 6,
    heightOffset: 0.8,
    targetHeightOffset: 0.5,
  },
  firstPerson: {
    ...DEFAULT_FIRST_PERSON_CONFIG,
    heightOffset: 0.6,
    forwardOffset: 0.5,
  },
  free: {
    ...DEFAULT_FREE_CAMERA_CONFIG,
    distance: 6,
  },
}

/**
 * Camera config untuk forklift.
 * Operator duduk di belakang tengah (seat base y≈1.95, eye ≈2.05).
 * Body tinggi (forkliftbaru.glb: y 0.51→4.02) → kamera third-person diangkat
 * & target di-raise agar mast/carriage + fork terlihat keseluruhan.
 */
export const FORKLIFT_CAMERA_CONFIG: CameraConfig = {
  thirdPerson: {
    ...DEFAULT_THIRD_PERSON_CONFIG,
    // Jarak lebih dekat agar forklift terlihat cukup besar di layar.
    distance: 8,
    // Forkliftbaru.glb tinggi ~4 m → kamera diangkat supaya body tidak
    // memenuhi layar dan mast/garpu terlihat.
    heightOffset: 3.4,
    targetHeightOffset: 2.0,
    forwardTargetOffset: 1.5,
    alpha: -Math.PI / 4,
    // β ≈ 65° — kamera melihat sedikit dari atas, cukup untuk melihat
    // mast + fork + body secara keseluruhan tanpa mast mendominasi layar.
    beta: Math.PI / 2.8,
    lowerRadiusLimit: 4,
    upperRadiusLimit: 18,
  },
  firstPerson: {
    ...DEFAULT_FIRST_PERSON_CONFIG,
    // Posisi operator: duduk di kursi (seat y≈1.95), mata ≈2.05.
    // Model faces +X but physics heading=0 forward is +Z (perpendicular).
    // forwardOffset > 0 moves toward physics forward (+Z = model REAR side).
    // For operator POV, we place camera at model center looking toward +X (mast).
    // The visual rotation (heading-π/2) aligns +X→+Z, so at heading=0 camera looks
    // roughly toward the mast side when combined with model rotation.
    forwardOffset: 0.4,
    // Kamera sedikit di atas stir (stir ≈2.05) — naik moderat ke 2.3
    // (tengah range 2.25–2.35, selisih kecil =0.25) sehingga stir tetap
    // terlihat jelas di bawah frame, tidak mendominasi, tidak hilang.
    // Tidak drone / third-person — tetap area operator, pandangan ke depan.
    heightOffset: 2.3,
    sideOffset: 0,
    fov: 1.2,
    lookAheadDistance: 60,
    minZ: 0.3,
    maxZ: 1000,
  },
  free: {
    ...DEFAULT_FREE_CAMERA_CONFIG,
    distance: 11,
    targetHeightOffset: 2.1,
  },
}

/**
 * Camera config untuk truck Hino Dutro.
 * Model trucks_ref: panjang ±4.8 m, lebar 3.44 m, tinggi ±3.9 m (atap kabin).
 * Pengemudi duduk di FRONT-LEFT (model depan +X, kiri pengemudi +Z),
 * stir di (x≈1.35..2, y≈1.98, z≈0.28).
 * - Third person: jarak lebih jauh (12) + tinggi (4.6) + target dinaikkan
 *   agar body tinggi/muatan terlihat utuh; kamera mengikuti depan truk.
 * - First person: kamera dari kursi pengemudi (depan +X = physics forward saat
 *   heading 0; sideOffset NEGATIF = pindah ke sisi KIRI pengemudi).
 */
export const HINO_DUTRO_CAMERA_CONFIG: CameraConfig = {
  thirdPerson: {
    ...DEFAULT_THIRD_PERSON_CONFIG,
    distance: 17.0,
    heightOffset: 4.0,          // (ArcRotate: height = targetHeight + distance*cos(beta), heightOffset tidak dipakai
                                //  third-person; dijaga untuk first/person lain)
    targetHeightOffset: 5.0,    // Target tinggi → kamera di atas atap Hino
    forwardTargetOffset: 8.0,   // Pandangan 8m di depan truck → area depan lebih jauh terlihat
    alpha: -Math.PI / 4,
    beta: Math.PI / 2.3,        // 78° dari sumbu-Y → sedikit menunduk, pandangan ke jalan
    lowerRadiusLimit: 5,
    upperRadiusLimit: 25,
  },
  firstPerson: {
    ...DEFAULT_FIRST_PERSON_CONFIG,
    forwardOffset: 0,           // not used when reference node is set
    heightOffset: 2.25,         // fallback if no reference node
    sideOffset: 0,              // not used when reference node is set
    fov: 1.05,                  // natural cabin FOV, slightly narrower for truck cabin
    lookAheadDistance: 40,      // look further down the road
    referenceHeightOffset: 0,   // DriverEye node already at correct eye height
  },
  free: {
    ...DEFAULT_FREE_CAMERA_CONFIG,
    distance: 10,
    targetHeightOffset: 2.5,
  },
}

/**
 * Motor (motorcycle) Camera Configuration
 * =========================================
 * Third-person lebih dekat untuk sensasi naik motor.
 */
export const MOTOR_CAMERA_CONFIG: CameraConfig = {
  thirdPerson: {
    ...DEFAULT_THIRD_PERSON_CONFIG,
    distance: 20,
    heightOffset: 5.0,
    targetHeightOffset: 3.0,
    forwardTargetOffset: 6.0,
    alpha: -Math.PI / 4,
    beta: Math.PI / 2.5,
    lowerRadiusLimit: 5,
    upperRadiusLimit: 26,
  },
  firstPerson: {
    ...DEFAULT_FIRST_PERSON_CONFIG,
    forwardOffset: 0,
    heightOffset: 0,
    sideOffset: 0,
    fov: 1.4,
    lookAheadDistance: 15,
    minZ: 0.1,
    maxZ: 1000,
  },
  free: {
    ...DEFAULT_FREE_CAMERA_CONFIG,
    distance: 12,
    targetHeightOffset: 2.5,
  },
}

/**
 * Aircraft Camera Configuration
 * ----------------------------
 * Third person: further back and higher.
 * First person: external propeller chase camera (Camera 2 Pesawat Testing).
 */
export const AIRCRAFT_CAMERA_CONFIG: CameraConfig = {
  thirdPerson: {
    ...DEFAULT_THIRD_PERSON_CONFIG,
    distance: 18,
    heightOffset: 5,
    targetHeightOffset: 2,
    alpha: -Math.PI / 2,
    beta: Math.PI / 3,
    upperRadiusLimit: 50,
  },
  firstPerson: {
    // Camera 2 Pesawat Testing = EXTERNAL AIRCRAFT CHASE CAMERA.
    // Posisi dihitung relatif terhadap node "propeller" pada GLB:
    //   propeller terletak ≈ (x 4.56, z 1.38) terhadap aircraft root
    //   (model: +X = nose/arah terbang, +Z = atas).
    // Pesawat: nose +4.52, tail -4.9, top +4.18, bottom -1.15.
    // Kamera ditempatkan DI BELAKANG SELURUH PESAWAT (bukan di tengah badan):
    //   - forwardOffset = jarak mundur dari pusat propeller → cukup besar agar
    //     kamera berada di belakang ekor (camera local X ≈ -8), badan tidak
    //     lagi memenuhi layar.
    //   - heightOffset = tinggi kamera di atas pusat propeller (sedikit di atas
    //     fuselage, di bawah ekor vertikal).
    //   - lookAheadDistance = jarak titik look-target di depan pesawat.
    //   - targetHeightOffset = tinggi look-target → diset hampir setinggi kamera
    //     sehingga arah pandang hampir horizontal (horizon terlihat, runway/area
    //     depan terbuka, tidak menunduk ke ground).
    // Look target = aircraft position + forward * lookAheadDistance + up * targetHeightOffset.
    // (Diupdate oleh AircraftSystem.updatePropellerCamera, mengikuti heading,
    //  pitch, roll, dan posisi pesawat. Bukan cockpit, bukan dari bawah.)
    ...DEFAULT_FIRST_PERSON_CONFIG,
    forwardOffset: 12.5,
    heightOffset: 1.5,
    sideOffset: 0,
    fov: 1.2,
    lookAheadDistance: 55,
    targetHeightOffset: 2.5,
    minZ: 0.1,
    maxZ: 1000,
  },
  free: {
    ...DEFAULT_FREE_CAMERA_CONFIG,
    distance: 18,
    upperRadiusLimit: 100,
  },
}

/**
 * Camera Presets
 */
export const CAMERA_PRESETS = {
  default: DEFAULT_CAMERA_CONFIG,
  largeVehicle: LARGE_VEHICLE_CAMERA_CONFIG,
  smallVehicle: SMALL_VEHICLE_CAMERA_CONFIG,
  forklift: FORKLIFT_CAMERA_CONFIG,
  hinoDutro: HINO_DUTRO_CAMERA_CONFIG,
  motor: MOTOR_CAMERA_CONFIG,
  aircraft: AIRCRAFT_CAMERA_CONFIG,
} as const

export type CameraPreset = keyof typeof CAMERA_PRESETS

/**
 * Konversi CameraConfig penuh → format legacy CameraPositionConfig
 * (Backward-compatible dengan parameter CarController lama).
 */
export function getLegacyCameraConfig(config: CameraConfig): Partial<CameraPositionConfig> {
  return {
    thirdPerson: {
      distance: config.thirdPerson.distance,
      heightOffset: config.thirdPerson.heightOffset,
      targetHeightOffset: config.thirdPerson.targetHeightOffset,
      alpha: config.thirdPerson.alpha,
      beta: config.thirdPerson.beta,
      lowerRadiusLimit: config.thirdPerson.lowerRadiusLimit,
      upperRadiusLimit: config.thirdPerson.upperRadiusLimit,
      forwardTargetOffset: config.thirdPerson.forwardTargetOffset,
    },
    firstPerson: {
      forwardOffset: config.firstPerson.forwardOffset,
      heightOffset: config.firstPerson.heightOffset,
      sideOffset: config.firstPerson.sideOffset,
      fov: config.firstPerson.fov,
      lookAheadDistance: config.firstPerson.lookAheadDistance,
      minZ: config.firstPerson.minZ,
      maxZ: config.firstPerson.maxZ,
    },
  }
}
