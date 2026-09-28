import {
  Scene,
  Mesh,
  Vector3,
  Color3,
  Quaternion,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  AbstractMesh,
  TransformNode,
  SceneLoader,
} from '@babylonjs/core'
// Import all available loaders
import '@babylonjs/loaders/OBJ'
import '@babylonjs/loaders/glTF'
import '@babylonjs/loaders'
import type { GameScene, SceneContext, GraphicsConfig, MapType, CameraMode, ControlMode, CameraPositionConfig, CarPhysicsConfig } from '../types'
import { DEFAULT_GRAPHICS_CONFIG } from '../types'
import { FORKLIFT_PHYSICS_CONFIG, HINO_DUTRO_PHYSICS_CONFIG, MOTOR_PHYSICS_CONFIG, FORKLIFT_CAMERA_CONFIG, HINO_DUTRO_CAMERA_CONFIG, MOTOR_CAMERA_CONFIG, getLegacyCameraConfig } from '../config'
import { LightingSetup } from '../components/LightingSetup'
import { EnvironmentSetup } from '../components/EnvironmentSetup'
import { PostProcessingPipeline } from '../engine/PostProcessingPipeline'
import { InputManager } from '../engine/InputManager'
import { CarController } from '../components/car'
import { SimpleMap } from '../components/SimpleMap'
import { NpcSystem } from '../components/NpcSystem'
import { WrongWayDetector } from '../systems/WrongWayDetector'
import { ForkliftCargoTest } from '../systems/ForkliftCargoTest'
import { ForkSystem } from '../systems/ForkSystem'
import { WaypointSystem, getRandomRoute } from '../systems/WaypointSystem'
import { WaypointMarkers } from '../systems/WaypointMarkers'
import type { WaypointSessionData } from '../systems/WaypointSystem'

export type { MapType }

export class DemoScene implements GameScene {
  name = 'DemoScene'

  private scene: Scene | null = null
  private canvas: HTMLCanvasElement | null = null
  private lightingSetup: LightingSetup | null = null
  private environmentSetup: EnvironmentSetup | null = null
  private postProcessing: PostProcessingPipeline | null = null
  private inputManager: InputManager | null = null
  private carController: CarController | null = null
  private simpleMap: SimpleMap | null = null

  private animatedMeshes: AbstractMesh[] = []
  private carMesh: AbstractMesh | null = null

  // Khusus map forklift-testing: kendaraan = forklift (bukan C10).
  private isForklift: boolean = false
  // Node steering di model forklift: roda DEPAN (DriveWheel_L/R_PIVOT, x +0.65)
  // diputar mengikuti steer angle; roda belakang (SteerWheel_*_STEER_PIVOT)
  // dikunci lurus.
  private forkliftSteeringNode: TransformNode | AbstractMesh | null = null
  private forkliftFrontPivotL: TransformNode | null = null
  private forkliftFrontPivotR: TransformNode | null = null
  private forkliftSteeringWheelNode: TransformNode | AbstractMesh | null = null
  // Orientasi awal steering wheel dari model (kuaternion GLB). Digunakan untuk
  // memutar setir secara visual mengikuti steer angle tanpa kehilangan tilt asli.
  private forkliftSteeringWheelBaseQuat: Quaternion | null = null

  // Khusus map hino-dutro-testing: kendaraan = truck Hino Dutro.
  private isTruck: boolean = false
  // Pivot (wrapper) truck: inilah carMesh untuk CarController/CarPhysics.
  // Root model CTRL_TRUCK di-parent ke pivot, di-offset (-centerX, -bottomY,
  // -centerZ) agar body truck berpusat di pivot & ban menyentuh y=0 (physics
  // selalu memaksa mesh.position.y ≤ 0 → grounding dilakukan via offset ini).
  private truckPivot: Mesh | null = null
  private truckRoot: TransformNode | AbstractMesh | null = null
  // Node kemudi truck: STEERING_FRONT (+1.35, 0.65, 0) → roda depan ikut setir.
  private truckSteeringNode: TransformNode | null = null
  // Offset transform root (dihitung sekali saat load; independen terhadap rotasi)
  private truckCentering: Vector3 | null = null
  // Debug markers for Camera 2 position verification (temporary, will be removed)
  private cam2DebugMarker: Mesh | null = null
  private cam2DebugArrow: Mesh | null = null
  private cam2DebugHeadNode: TransformNode | null = null

  // Khusus map motor-testing: kendaraan = motor (motor_lowpoly_manual_steering.glb).
  private isMotor: boolean = false
  private motorPivot: Mesh | null = null
  private motorRoot: TransformNode | AbstractMesh | null = null
  private motorSteeringNode: TransformNode | null = null
  private motorFrontWheelPivot: TransformNode | null = null
  private motorRearWheelPivot: TransformNode | null = null

  private graphicsConfig: GraphicsConfig
  private mapType: MapType

  // Camera mode change callback
  private onCameraModeChange: ((mode: CameraMode) => void) | null = null
  // Control mode change callback
  private onControlModeChange: ((mode: ControlMode) => void) | null = null
  // Engine state change callback
  private onEngineStateChange: ((running: boolean) => void) | null = null
  // Collision callback
  private onCollisionCallback: ((impactVelocity: number) => void) | null = null
  // Wrong-way detection
  private wrongWayDetector: WrongWayDetector | null = null
  // Pallet & cargo test (khusus map forklift-testing)
  private cargoTest: ForkliftCargoTest | null = null
  // Fork lift system (khusus map forklift-testing)
  private forkSystem: ForkSystem | null = null
  // NPC system (khusus map Ngawi City)
  private npcSystem: NpcSystem | null = null
  // Waypoint navigation system
  private waypointSystem: WaypointSystem | null = null
  private waypointMarkers: WaypointMarkers | null = null

  constructor(graphicsConfig?: GraphicsConfig, mapType: MapType = 'solo-city') {
    this.graphicsConfig = graphicsConfig ?? DEFAULT_GRAPHICS_CONFIG
    this.mapType = mapType
  }

  /**
   * Set callback for camera mode changes (to update UI)
   */
  setOnCameraModeChange(callback: (mode: CameraMode) => void): void {
    this.onCameraModeChange = callback
    // Also set on car controller if already initialized
    if (this.carController) {
      this.carController.onCameraModeChanged(callback)
    }
  }

  /**
   * Set callback for control mode changes (to update UI)
   */
  setOnControlModeChange(callback: (mode: ControlMode) => void): void {
    this.onControlModeChange = callback
    // Also set on car controller if already initialized
    if (this.carController) {
      this.carController.onControlModeChanged(callback)
    }
  }

  /**
   * Set callback for engine state changes (to update UI)
   */
  setOnEngineStateChange(callback: (running: boolean) => void): void {
    this.onEngineStateChange = callback
    // Also set on car controller if already initialized
    if (this.carController) {
      this.carController.onEngineStateChanged(callback)
    }
  }

  /**
   * Set callback for collision events (to update violation system)
   */
  setOnCollision(callback: (impactVelocity: number) => void): void {
    this.onCollisionCallback = callback
    if (this.carController) {
      this.carController.onCollisionEvent(callback)
    }
  }

  /**
   * Get current control mode
   */
  getControlMode(): ControlMode {
    return this.carController?.getControlMode() ?? 'keyboard'
  }

  setControlMode(mode: ControlMode): void { this.carController?.setControlMode(mode) }
  getWheelStatus(): { supported: boolean; connected: boolean } { return this.carController?.getWheelStatus() ?? { supported: false, connected: false } }
  updateWheelSettings(settings: Parameters<CarController['updateWheelSettings']>[0]): void { this.carController?.updateWheelSettings(settings) }
  detectWheelPedal(kind: 'throttle' | 'brake'): boolean { return this.carController?.detectWheelPedal(kind) ?? false }
  captureWheelPedalRest(kind: 'throttle' | 'brake'): boolean { return this.carController?.captureWheelPedalRest(kind) ?? false }

  /**
   * Get current camera mode
   */
  getCameraMode(): CameraMode {
    return this.carController?.getCameraMode() ?? 'third-person'
  }

  /**
   * Get camera position config for UI adjustment
   */
  getCameraConfig(): CameraPositionConfig | null {
    return this.carController ? null : null // Can be extended to expose config
  }

  /**
   * Get current steering angle (-1 to 1)
   */
  getSteeringAngle(): number {
    return this.carController?.getSteeringInput() ?? 0
  }

  /**
   * Get current speed in km/h
   */
  getSpeedKmh(): number {
    return this.carController?.getSpeedKmh() ?? 0
  }
