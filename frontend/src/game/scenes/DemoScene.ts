import {
  Scene,
  Vector3,
  Color3,
  MeshBuilder,
  PBRMaterial,
  AbstractMesh,
  SceneLoader,
  TransformNode,
  Quaternion,
  UniversalCamera,
} from '@babylonjs/core'
// Import all available loaders
import '@babylonjs/loaders/OBJ'
import '@babylonjs/loaders/glTF'
import '@babylonjs/loaders'
import type { GameScene, SceneContext, GraphicsConfig, MapType, CameraMode, ControlMode, CameraPositionConfig } from '../types'
import { DEFAULT_GRAPHICS_CONFIG } from '../types'
import { HINO_DUTRO_PHYSICS_CONFIG } from '../config/physics.config'
import { HINO_DUTRO_CAMERA_CONFIG } from '../config/camera.config'
import { LightingSetup } from '../components/LightingSetup'
import { EnvironmentSetup } from '../components/EnvironmentSetup'
import { PostProcessingPipeline } from '../engine/PostProcessingPipeline'
import { InputManager } from '../engine/InputManager'
import { CarController } from '../components/car'
import { SimpleMap } from '../components/SimpleMap'
import { WrongWayDetector } from '../systems/WrongWayDetector'
import { WaypointSystem, getRandomRoute } from '../systems/WaypointSystem'
import { WaypointMarkers } from '../systems/WaypointMarkers'
import type { WaypointSessionData } from '../systems/WaypointSystem'
import { ForkliftCargoTest } from '../systems/ForkliftCargoTest'
import { ForkSystem, DEFAULT_FORK_CONFIG } from '../systems/ForkSystem'
import { FORKLIFT_PHYSICS_CONFIG } from '../config/physics.config'
import { FORKLIFT_CAMERA_CONFIG } from '../config/camera.config'
import { AircraftSystem } from '../systems/AircraftSystem'
import { AirportMap } from '../components/AirportMap'

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
  private wrongWayDetector: WrongWayDetector = new WrongWayDetector()
  // Waypoint navigation system
  private waypointSystem: WaypointSystem | null = null
  private waypointMarkers: WaypointMarkers | null = null
private forkliftCargoTest: ForkliftCargoTest | null = null
  private forkSystem: ForkSystem | null = null
  /** physicsMesh dump forklift (invisible) — dipakai ForkliftCargoTest untuk collision crate. */
  private forkliftPhysicsMesh: AbstractMesh | null = null
  /** Visual root forklift (CTRL_FORKLIFT) — disinkronkan ke physics heading per-frame. */
  private forkliftVisualRoot: TransformNode | null = null

  // Visual steering node untuk Motor Testing — stang/fork ikut belok (visual only)
  private motorSteeringPivot: TransformNode | null = null
  private motorSteeringDiagFrame = 0

  // Aircraft system (khusus pesawat-testing)
  private aircraftSystem: AircraftSystem | null = null
  private airportMap: AirportMap | null = null

  // Hino Dutro debug nodes
  private hinoDebugNodes: {
    driverSeat: TransformNode | null
    driverEye: TransformNode | null
    steeringWheel: TransformNode | null
    windshield: TransformNode | null
  } = { driverSeat: null, driverEye: null, steeringWheel: null, windshield: null }

  // Hino Dutro vibration tracker
  private hinoVibrationTracker: {
    prevCamY: number
    prevEyeY: number
    prevSeatY: number
    prevCtrlY: number
    prevPhysY: number
    prevPhysRootY: number
    frameCount: number
    maxDyCam: number
    maxDyEye: number
    maxDySeat: number
    maxDyCtrl: number
    maxDyPhys: number
    maxDyPhysRoot: number
  } | null = null

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
    if (this.aircraftSystem) return this.aircraftSystem.getSpeedKmh()
    return this.carController?.getSpeedKmh() ?? 0
  }

  /**
   * Get whether car is currently drifting
   */
  getIsDrifting(): boolean {
    return this.carController?.getIsDrifting() ?? false
  }

  /**
   * Get slip angle in degrees for drift visualization
   */
  getSlipAngle(): number {
    return this.carController?.getSlipAngle() ?? 0
  }

  /**
   * Get whether engine is running
   */
  isEngineRunning(): boolean {
    if (this.aircraftSystem) return this.aircraftSystem.isEngineRunning()
    return this.carController?.isEngineRunning() ?? false
  }

  /**
   * Get current gear number (-1=R, 0=N, 1-5)
   */
  getCurrentGear(): number {
    return this.carController?.getCurrentGear() ?? 0
  }

  /**
   * Get gear display name (R, N, 1-5)
   */
  getGearName(): string {
    return this.carController?.getGearName() ?? 'N'
  }

  /**
   * Get transmission mode
   */
  getTransmissionMode(): 'automatic' | 'manual' {
    return this.carController?.getTransmissionMode() ?? 'automatic'
  }

  /**
   * Get engine RPM
   */
  getRPM(): number {
    return this.carController?.getRPM() ?? 800
  }

  /**
   * Get whether car is driving the wrong way (against traffic)
   */
  isWrongWay(): boolean {
    return this.wrongWayDetector.isWrongWay
  }

  /**
   * Get the waypoint system instance
   */
  getWaypointSystem(): WaypointSystem | null {
    return this.waypointSystem
  }

  /**
   * Get waypoint session data for UI
   */
  getWaypointSessionData(): WaypointSessionData | null {
    return this.waypointSystem?.getSessionData() ?? null
  }

  /**
   * Get distance from car to active waypoint
   */
  getDistanceToActiveWaypoint(): number {
    if (this.aircraftSystem && this.waypointSystem) {
      const pos = this.aircraftSystem.getPosition()
      return this.waypointSystem.getDistanceToActive(new Vector3(pos.x, pos.y, pos.z))
    }
    if (!this.waypointSystem || !this.carController) return -1
    return this.waypointSystem.getDistanceToActive(this.carController.getPosition())
  }

  /**
   * Get active waypoint position {x, z} or null
   */
  getActiveWaypointPosition(): { x: number; z: number } | null {
    const wp = this.waypointSystem?.getActiveWaypoint()
    if (!wp) return null
    return { x: wp.position.x, z: wp.position.z }
  }

  /**
   * Get car heading in radians (for navigation arrow)
   */
  getCarHeading(): number {
    if (this.aircraftSystem) return this.aircraftSystem.getHeading()
    return this.carController?.getHeading() ?? 0
  }

  /**
   * Get car world position {x, z}
   */
  getCarPosition(): { x: number; z: number } {
    if (this.aircraftSystem) return this.aircraftSystem.getPosition()
    const pos = this.carController?.getPosition()
    return pos ? { x: pos.x, z: pos.z } : { x: 0, z: 0 }
  }

  async init(context: SceneContext): Promise<void> {
    this.scene = context.scene
    this.canvas = context.canvas

    console.log('[DemoScene] Initializing...')

    // Setup input manager
    this.inputManager = new InputManager(this.scene, this.canvas)

    // Setup lighting - bright daylight
    this.lightingSetup = new LightingSetup(this.scene, this.graphicsConfig, {
      sunDirection: new Vector3(-1, -2, -1),
      sunIntensity: 3,
      ambientIntensity: 1.5,
    })

    // Create map based on selected mapType
    this.simpleMap = new SimpleMap(this.scene, this.lightingSetup)
    switch (this.mapType) {
      case 'sriwedari-park':
        this.simpleMap.createSriwedariPark()
        console.log('[DemoScene] Loading Sriwedari Park map')
        break
      case 'hino-dutro-testing':
        this.simpleMap.createHinoDutroTesting()
        console.log('[DemoScene] Loading Hino Dutro Testing map (Solo City layout)')
        break
      case 'forklift-testing':
        try {
          this.simpleMap.createForkliftTesting()
        } catch (error) {
          console.error('[DemoScene] createForkliftTesting failed:', error)
        }
        console.log('[DemoScene] Loading Forklift Testing map')
        break
      case 'pesawat-testing':
        this.airportMap = new AirportMap(this.scene!, this.lightingSetup!)
        this.airportMap.build()
        console.log('[DemoScene] Loading Pesawat Testing map (Airport)')
        break
      default:
        this.simpleMap.createSoloCity()
        console.log('[DemoScene] Loading Solo City map')
        break
    }

    // Setup environment (skybox only, ground is from map)
    this.environmentSetup = new EnvironmentSetup(this.scene, this.graphicsConfig)
    this.environmentSetup.createProceduralSkybox(
      new Color3(0.4, 0.6, 0.9), // Top color (bright blue sky)
      new Color3(0.7, 0.8, 0.95) // Bottom color (light horizon)
    )
    this.environmentSetup.setupGlowLayer(0.3)

    // Setup post-processing
    if (this.scene.activeCamera) {
      this.postProcessing = new PostProcessingPipeline({
        scene: this.scene,
        camera: this.scene.activeCamera,
        config: this.graphicsConfig,
      })
    }

// Load the appropriate model based on map type
    if (this.mapType === 'pesawat-testing') {
      await this.loadAircraftModel()
    } else if (this.mapType === 'hino-dutro-testing') {
      await this.loadTruckModel()
    } else if (this.mapType === 'motor-testing') {
      await this.loadMotorModel()
    } else if (this.mapType === 'forklift-testing') {
      await this.loadForkliftModel()
    } else {
      await this.loadCarModel()
    }

    // Create demo objects (optional, can be removed if you only want the car)
    // this.createDemoObjects()

    // Initialize waypoint system for Solo City layout maps (Solo City + Hino Dutro Testing + Motor Testing)
    // Also for pesawat-testing (aircraft checkpoints)
    if (this.mapType === 'solo-city' || this.mapType === 'hino-dutro-testing' || this.mapType === 'motor-testing' || this.mapType === 'pesawat-testing') {
      const route = getRandomRoute(this.mapType)
      this.waypointSystem = new WaypointSystem(route)
      console.log(`[DemoScene] Waypoint route selected: ${route.name} (${route.waypoints.length} checkpoints)`)

      // Create 3D waypoint markers in the scene
      this.waypointMarkers = new WaypointMarkers(this.scene!)
      this.waypointMarkers.createMarkers(route.waypoints)

    // Listen for waypoint state changes to update 3D markers
    this.waypointSystem.setOnWaypointReached((_wpId, index, total) => {
      console.log(`[DemoScene] Checkpoint ${index + 1}/${total} reached!`)
      // Update all marker states
      if (this.waypointSystem && this.waypointMarkers) {
        const data = this.waypointSystem.getSessionData()
        this.waypointMarkers.updateStates(
          data.waypointProgress.map(p => ({
            waypointId: p.waypointId,
            state: p.state,
          }))
        )
      }
    })

    this.waypointSystem.setOnWaypointChanged((_currentIndex) => {
      // Update marker states when active waypoint changes
      if (this.waypointSystem && this.waypointMarkers) {
        const data = this.waypointSystem.getSessionData()
        this.waypointMarkers.updateStates(
          data.waypointProgress.map(p => ({
            waypointId: p.waypointId,
            state: p.state,
          }))
        )
      }
    })

    this.waypointSystem.setOnRouteCompleted((elapsedTime, missed) => {
      console.log(`[DemoScene] Route completed! Time: ${elapsedTime.toFixed(1)}s, Missed: ${missed}`)
    })

      // Auto-start the waypoint timer
      this.waypointSystem.start()
    } else {
      console.log('[DemoScene] Sriwedari Park: waypoint system disabled')
    }

    console.log('[DemoScene] Initialized')
  }

  /**
   * Load the car model from assets
   */
  private async loadCarModel(): Promise<void> {
    if (!this.scene) return

    console.log('[DemoScene] Loading car model...')

    try {
      // Load the GLB model - Chevrolet C10 Pickup 1963 (resized in Blender)
      const modelPath = '/assets/Chevrolet_C10_Pickup_1963/'
      const modelFile = 'quit.glb'
      
      console.log(`[DemoScene] Attempting to load: ${modelPath}${modelFile}`)
      
      // Load the model using SceneLoader
      const result = await SceneLoader.ImportMeshAsync(
        '', // Import all meshes
        modelPath, // Path to the folder
        modelFile, // File name
        this.scene
      )

      console.log('[DemoScene] Car model loaded, meshes:', result.meshes.length)

      // Get the root mesh (first one is usually the root)
      if (result.meshes.length > 0) {
        const rootMesh = result.meshes[0]
        this.carMesh = rootMesh

        // Position car at the map's spawn station / garage
        const spawn = this.simpleMap?.getSpawnPoint() ?? { x: 50, z: 50, rotationY: Math.PI / 2 }
        rootMesh.position = new Vector3(spawn.x, 0, spawn.z)
        
        // Scale - model sudah di-resize di Blender, gunakan skala 1.0
        rootMesh.scaling = new Vector3(1.0, 1.0, 1.0)
        
        // GLB models import with rotationQuaternion which overrides euler rotation.
        // Clear it so rotation.y is respected, then CarController.initFromMesh reads it.
        rootMesh.rotationQuaternion = null
        rootMesh.rotation.y = spawn.rotationY
        
        // Enable collision on car mesh
        rootMesh.checkCollisions = true
        result.meshes.forEach((mesh) => {
          mesh.checkCollisions = true
        })

        // Log bounding info for debugging
        rootMesh.computeWorldMatrix(true)
        const boundingInfo = rootMesh.getHierarchyBoundingVectors()
        console.log('[DemoScene] Model bounds:', boundingInfo)

        // Apply texture and materials to all meshes
        result.meshes.forEach((mesh) => {
          // Add shadow casting
          this.lightingSetup?.addShadowCaster(mesh)
          // Make mesh receive shadows
          mesh.receiveShadows = true
        })

        // Setup car controller for WASD movement with dual camera system
        // Camera position config - EASILY ADJUSTABLE VALUES
        // Disesuaikan untuk Chevrolet C10 Pickup (pickup truck lebih besar)
        const cameraConfig: Partial<CameraPositionConfig> = {
          thirdPerson: {
            distance: 10,             // Distance from car (lebih jauh untuk pickup)
            heightOffset: 3.0,        // Height above car (pickup lebih tinggi)
            targetHeightOffset: 2.5,  // Look at point height
            alpha: -Math.PI / 4,      // Horizontal angle
            beta: Math.PI / 2.2,      // Vertical angle
            lowerRadiusLimit: 5,
            upperRadiusLimit: 25,
          },
          firstPerson: {
            forwardOffset: 0.1,       // Forward from car center (driver position)
            heightOffset: 2.25,        // Eye level height (pickup cab lebih tinggi)
            sideOffset: -0.05,          // Right offset (driver seat)
            fov: 1.2,                 // Field of view
            lookAheadDistance: 50,    // How far to look ahead
          },
        }

        this.carController = new CarController(
          this.scene!, 
          rootMesh, 
          {}, // Car physics config (use defaults)
          cameraConfig
        )

        // Setup cameras with canvas
        if (this.canvas) {
          this.carController.setupCameras(this.canvas)
        }

        // Set camera mode change callback
        if (this.onCameraModeChange) {
          this.carController.onCameraModeChanged(this.onCameraModeChange)
        }

        // Set control mode change callback
        if (this.onControlModeChange) {
          this.carController.onControlModeChanged(this.onControlModeChange)
        }

        // Set engine state change callback
        if (this.onEngineStateChange) {
          this.carController.onEngineStateChanged(this.onEngineStateChange)
        }

        // Set collision callback
        if (this.onCollisionCallback) {
          this.carController.onCollisionEvent(this.onCollisionCallback)
        }

        // Set map reference for collision detection
        if (this.simpleMap) {
          this.carController.setMap(this.simpleMap)
        }

        // Set active camera from car controller
        const activeCamera = this.carController.getActiveCamera()
        if (activeCamera) {
          this.scene!.activeCamera = activeCamera
        }

        console.log('[DemoScene] Car model setup complete with dual camera system')
      }
    } catch (error) {
      console.error('[DemoScene] Failed to load car model:', error)
      console.log('[DemoScene] Note: FBX format is not supported natively.')
      console.log('[DemoScene] Please convert your FBX file to GLB format using Blender or an online converter.')
      // Create a fallback box to show something
      this.createFallbackCar()
    }
  }

  /**
   * Load the motor model from assets
   */
  private async loadMotorModel(): Promise<void> {
    if (!this.scene) return

    console.log('[DemoScene] Loading motor model...')

    try {
      const modelPath = '/assets/Motor/'
      const modelFile = 'motor_lowpoly_manual_steering.glb'
      
      console.log(`[DemoScene] Attempting to load: ${modelPath}${modelFile}`)
      
      const result = await SceneLoader.ImportMeshAsync(
        '',
        modelPath,
        modelFile,
        this.scene
      )

      console.log('[DemoScene] Motor model loaded, meshes:', result.meshes.length)

      if (result.meshes.length > 0) {
        const rootMesh = result.meshes[0]

        const spawn = this.simpleMap?.getSpawnPoint() ?? { x: 50, z: 50, rotationY: Math.PI / 2 }

        // Physics mesh (tak terlihat) = konvensi STANDAR seperti Solo City
        // (forward = (sin h, 0, cos h); heading init dari spawn.rotationY).
        const physicsMesh = MeshBuilder.CreateBox(
          'motorPhysicsMesh',
          { width: 0.4, height: 1.0, depth: 1.8 },
          this.scene
        )
        physicsMesh.isVisible = false
        physicsMesh.checkCollisions = true
        physicsMesh.position = new Vector3(spawn.x, 0, spawn.z)
        physicsMesh.rotationQuaternion = null
        physicsMesh.rotation.y = spawn.rotationY   // heading seperti Solo City
        physicsMesh.scaling = new Vector3(1.0, 1.0, 1.0)

        // VISUAL WRAPPER — koreksi orientasi khusus MOTOR (lokal):
        // GLB motor menghadap +X (handlebar/roda depan di +X), konvensi physics
        // forward = +Z. Root GLB dipindah ke wrapper yang memutar -PI/2 sehingga
        // visual motor selalu sejajar physics forward — SAMA seperti Solo City.
        // Hierarchy GLB tidak diubah (semua part tetap satu kesatuan).
        const visualRoot = new TransformNode('MotorVisualRoot', this.scene)
        visualRoot.parent = physicsMesh
        visualRoot.rotationQuaternion = null
        visualRoot.rotation.y = -Math.PI / 2

        const glbRoot =
          result.transformNodes?.find((n) => n.name === 'Motorcycle_Root') ??
          result.transformNodes?.[0] ??
          rootMesh
        glbRoot.parent = visualRoot

        // Simpan node steering pivot dari GLB (Node 41 'FrontFork_Steering_Pivot',
        // berisi handlebar + fork + roda depan). Dipakai visual steering tiap frame.
        this.motorSteeringPivot =
          result.transformNodes?.find((n) => n.name === 'FrontFork_Steering_Pivot') ??
          Array.from(this.scene.transformNodes).find((n) => n.name === 'FrontFork_Steering_Pivot') ??
          null
        if (this.motorSteeringPivot) {
          this.motorSteeringPivot.rotationQuaternion = null
          console.log('[DemoScene] Motor steering pivot attached:', this.motorSteeringPivot.name)
        } else {
          console.warn(
            '[DemoScene] Motor steering pivot NOT FOUND. Available transform nodes:',
            result.transformNodes.map((n) => n.name)
          )
        }

        result.meshes.forEach((mesh) => {
          mesh.checkCollisions = true
        })

        this.carMesh = rootMesh

        rootMesh.computeWorldMatrix(true)
        const boundingInfo = rootMesh.getHierarchyBoundingVectors()
        console.log('[DemoScene] Motor bounds:', boundingInfo)

        result.meshes.forEach((mesh) => {
          this.lightingSetup?.addShadowCaster(mesh)
          mesh.receiveShadows = true
        })

        // Use default physics and camera config (same as Solo City car)
        this.carController = new CarController(
          this.scene!, 
          physicsMesh, 
          {}, // default physics config
          {
            thirdPerson: {
              distance: 10,
              heightOffset: 3.0,
              targetHeightOffset: 2.5,
              alpha: -Math.PI / 4,
              beta: Math.PI / 2.2,
              lowerRadiusLimit: 5,
              upperRadiusLimit: 25,
            },
            firstPerson: {
              forwardOffset: 0.1,
              heightOffset: 2.25,
              sideOffset: -0.05,
              fov: 1.2,
              lookAheadDistance: 50,
            },
          }
        )

        if (this.canvas) {
          this.carController.setupCameras(this.canvas)
        }

        if (this.onCameraModeChange) {
          this.carController.onCameraModeChanged(this.onCameraModeChange)
        }

        if (this.onControlModeChange) {
          this.carController.onControlModeChanged(this.onControlModeChange)
        }

        if (this.onEngineStateChange) {
          this.carController.onEngineStateChanged(this.onEngineStateChange)
        }

        if (this.onCollisionCallback) {
          this.carController.onCollisionEvent(this.onCollisionCallback)
        }

        if (this.simpleMap) {
          this.carController.setMap(this.simpleMap)
        }

        const activeCamera = this.carController.getActiveCamera()
        if (activeCamera) {
          this.scene!.activeCamera = activeCamera
        }

        console.log('[DemoScene] Motor model setup complete')
      }
    } catch (error) {
      console.error('[DemoScene] Failed to load motor model:', error)
      this.createFallbackCar()
    }
  }

  /**
   * Load the forklift model from assets
   */
  private async loadForkliftModel(): Promise<void> {
    if (!this.scene) return

    console.log('[DemoScene] Loading forklift model...')

    try {
      const modelPath = '/assets/Forklift_Model/'
      const modelFile = 'forkliftbaru.glb'
      
      console.log(`[DemoScene] Attempting to load: ${modelPath}${modelFile}`)
      
      const result = await SceneLoader.ImportMeshAsync(
        '',
        modelPath,
        modelFile,
        this.scene
      )

      console.log('[DemoScene] Forklift model loaded, meshes:', result.meshes.length)

if (result.meshes.length > 0) {
        // Find the root TransformNode (CTRL_FORKLIFT) from the GLB hierarchy
        const rootTransformNode = result.transformNodes?.find(n => n.name === 'CTRL_FORKLIFT') ?? result.transformNodes?.[0]
        
        if (!rootTransformNode) {
          console.error('[DemoScene] CTRL_FORKLIFT root node not found in GLB!')
          this.createFallbackCar()
          this.ensureForkliftFallbackCamera()
          return
        }

const spawn = this.simpleMap?.getSpawnPoint() ?? { x: 0, z: -82, rotationY: 0 }

        // Create physics root for physics/camera (heading=0, forward=+Z)
        const physicsRoot = new TransformNode('ForkliftPhysicsRoot', this.scene)
        physicsRoot.position = new Vector3(spawn.x, 0, spawn.z)
        physicsRoot.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 0) // heading=0, forward=+Z

        // Gunakan root GLB (CTRL_FORKLIFT) sebagai visual root.
        // PENTING: CTRL di-reparent dengan rotasi 0 (IDENTITY terhadap world)
        // karena ForkSystem membangun lift/tilt pivot dari KOORDINAT WORLD yang
        // dipakai sebagai frame CTRL. Yaw visual -PI/2 baru dipasang SETELAH
        // ForkSystem.init() selesai (lihat bawah) supaya geometri garpu tetap
        // benar dan model +X (fork depan) → world +Z = arah gerak heading 0.
        const visualRoot = rootTransformNode
        this.forkliftVisualRoot = visualRoot
        visualRoot.parent = physicsRoot
        visualRoot.rotationQuaternion = null
        visualRoot.rotation.set(0, 0, 0)
        visualRoot.scaling = new Vector3(1.0, 1.0, 1.0)

        // Find the actual root mesh for collision reference (first mesh)
        const rootMesh = result.meshes[0]
        this.carMesh = rootMesh

        // Ensure all meshes have collisions
        result.meshes.forEach((mesh) => {
          mesh.checkCollisions = true
        })

        physicsRoot.computeWorldMatrix(true)
        const boundingInfo = physicsRoot.getHierarchyBoundingVectors()
        console.log('[DemoScene] Forklift bounds:', boundingInfo)

        result.meshes.forEach((mesh) => {
          this.lightingSetup?.addShadowCaster(mesh)
          mesh.receiveShadows = true
        })

        // Create a dummy mesh for CarController physics (at physics root, heading=0)
        const physicsMesh = MeshBuilder.CreateBox('forkliftPhysicsMesh', { width: 2.5, height: 2.5, depth: 4 }, this.scene)
        physicsMesh.isVisible = false
        physicsMesh.parent = physicsRoot
        physicsMesh.checkCollisions = true
        physicsMesh.rotationQuaternion = null
        physicsMesh.rotation.set(0, 0, 0)
        this.forkliftPhysicsMesh = physicsMesh

        result.meshes.forEach((mesh) => {
          this.lightingSetup?.addShadowCaster(mesh)
          mesh.receiveShadows = true
        })

        // CarController uses the dummy physics mesh
        this.carController = new CarController(
          this.scene!, 
          physicsMesh, 
          FORKLIFT_PHYSICS_CONFIG,
          FORKLIFT_CAMERA_CONFIG
        )

        if (this.canvas) {
          this.carController.setupCameras(this.canvas)
        }

        if (this.onCameraModeChange) {
          this.carController.onCameraModeChanged(this.onCameraModeChange)
        }

        if (this.onControlModeChange) {
          this.carController.onControlModeChanged(this.onControlModeChange)
        }

        if (this.onEngineStateChange) {
          this.carController.onEngineStateChanged(this.onEngineStateChange)
        }

        if (this.onCollisionCallback) {
          this.carController.onCollisionEvent(this.onCollisionCallback)
        }

        if (this.simpleMap) {
          this.carController.setMap(this.simpleMap)
        }

        const activeCamera = this.carController.getActiveCamera()
        if (activeCamera) {
          this.scene!.activeCamera = activeCamera
        }

        // Initialize forklift system
        // Use the GLB's root TransformNode (CTRL_FORKLIFT) so ForkSystem can find forks
        // ForkSystem discovers fork nodes by traversing from the given root
        const forkliftRootNode = rootTransformNode
        this.forkSystem = new ForkSystem(this.scene!, DEFAULT_FORK_CONFIG)
        this.forkSystem.init(forkliftRootNode as any)

        // Visual yaw -PI/2 DITERAPKAN SETELAH ForkSystem.init: saat CTRL masih
        // identity semua pivot lift/tilt ter-bake dari koordinat world → sekarang
        // putar seluruh subtree CTRL -90° agar model +X (fork depan) menghadap +Z
        // (= arah gerak heading 0, menuju Storage Area). QUATERNION PERSISTED —
        // JANGAN di-null (versi lama men-null setelah set → model menyamping).
        visualRoot.rotationQuaternion = Quaternion.FromEulerAngles(0, -Math.PI / 2, 0)
        visualRoot.computeWorldMatrix(true)
        
        // CAMERA 2 FORKLIFT — bind reference ke VISUAL ROOT (CTRL_FORKLIFT),
        // bukan physics heading. Visual root sudah termasuk koreksi heading
        // forklift (rotation.y = physics - π/2 → model +X fork depan → world +Z).
        // Maka camera 2 mengikuti visual cabin/operator (stir tetap terlihat,
        // kamera sedikit di atas stir), dan mengikuti belokan/turn forklift.
        // Physics/heading/steering/movement TIDAK disentuh — hanya reference.
        if (this.forkliftVisualRoot) {
          this.carController.setFirstPersonReference(this.forkliftVisualRoot)
          console.log('[DemoScene] Forklift Camera 2 reference bound to CTRL_FORKLIFT visual root')
        } else {
          console.warn('[DemoScene] Forklift visual root not ready; Camera 2 keeps physics fallback')
        }

        // Initialize forklift cargo test
        this.forkliftCargoTest = new ForkliftCargoTest(
          this.scene!,
          this.simpleMap,
          this.lightingSetup,
          undefined
        )
        this.forkliftCargoTest.setForkSystem(this.forkSystem)
        this.forkliftCargoTest.buildTestArea()

        console.log('[DemoScene] Forklift model setup complete with fork system and cargo test')
      }
    } catch (error) {
      console.error('[DemoScene] Failed to load forklift model:', error)
      this.createFallbackCar()
      this.ensureForkliftFallbackCamera()
    }
  }

  /**
   * Pengaman minimal khusus map forklift-testing: jika model GLB gagal dimuat
   * (exception apa pun / root node tidak ditemukan), `createFallbackCar()`
   * TIDAK membuat kamera → `scene.activeCamera` null → render loop GameEngine
   * melewatkan `scene.render()` → MAP (yang sudah dibuat) tidak pernah digambar.
   * ADD-ONLY: tidak menyentuh kamera CarController/CarCameraManager, hanya
   * menjamin ada kamera + activeCamera saat fallback sehingga scena tetap
   * ter-render dan error GLB terlihat di console.
   */
  private ensureForkliftFallbackCamera(): void {
    if (!this.scene) return
    if (this.scene.activeCamera) return

    const spawn = this.simpleMap?.getSpawnPoint() ?? { x: 0, z: -82, rotationY: 0 }
    const camera = new UniversalCamera(
      'forkliftFallbackCamera',
      new Vector3(spawn.x, 4, spawn.z + 12),
      this.scene
    )
    camera.setTarget(new Vector3(spawn.x, 1, spawn.z))
    camera.attachControl(this.canvas ?? this.scene.getEngine().getRenderingCanvas(), true)
    this.scene.activeCamera = camera
    console.warn('[DemoScene] Forklift fallback camera attached (activeCamera was missing); map will render.')
  }

  /**
   * Load the Hino Dutro truck model from assets
   */
  private async loadTruckModel(): Promise<void> {
    if (!this.scene) return

    console.log('[DemoScene] Loading Hino Dutro truck model...')

    try {
      const modelPath = '/assets/Hino-Dutro/'
      const modelFile = 'truk_refference_rig.glb'
      
      console.log(`[DemoScene] Attempting to load: ${modelPath}${modelFile}`)
      
      const result = await SceneLoader.ImportMeshAsync(
        '',
        modelPath,
        modelFile,
        this.scene
      )

      console.log('[DemoScene] Hino Dutro model loaded, meshes:', result.meshes.length)

if (result.meshes.length > 0) {
        const rootMesh = result.meshes[0]

        const spawn = this.simpleMap?.getSpawnPoint() ?? { x: 50, z: 50, rotationY: Math.PI / 2 }

        // Header physics = konvensi STANDAR seperti mobil Solo City
        // (forward = (sin h, 0, cos h); heading init dari spawn.rotationY).
        // Dummy mesh tak terlihat membawa physics; visual model dipasang di
        // bawahnya lewat wrapper orientasi (lihat di bawah).
        const physicsMesh = MeshBuilder.CreateBox(
          'hinoPhysicsMesh',
          { width: 2.5, height: 3, depth: 5 },
          this.scene
        )
        physicsMesh.isVisible = false
        physicsMesh.checkCollisions = true
        physicsMesh.position = new Vector3(spawn.x, 0, spawn.z)
        physicsMesh.rotationQuaternion = null
        physicsMesh.rotation.y = spawn.rotationY   // heading like Solo City
        physicsMesh.scaling = new Vector3(1.0, 1.0, 1.0)

        // PHYSICS ROOT — follows physics position + yaw ONLY (no pitch/roll)
        // Separate from physicsMesh (which has no parent for physics engine compatibility).
        // We sync this root to physicsMesh position + yaw each frame.
        const physicsRoot = new TransformNode('HinoPhysicsRoot', this.scene)
        physicsRoot.position.copyFrom(physicsMesh.position)
        physicsRoot.rotationQuaternion = null
        physicsRoot.rotation.y = physicsMesh.rotation.y

        // VISUAL ROOT — correction for Hino model (+X) vs physics (+Z)
        // Child of physicsRoot, follows stable yaw-only transform.
        const visualRoot = new TransformNode('HinoVisualRoot', this.scene)
        visualRoot.parent = physicsRoot
        visualRoot.rotationQuaternion = null
        visualRoot.rotation.y = -Math.PI / 2

        const glbRoot =
          result.transformNodes?.find((n) => n.name === 'CTRL_TRUCK') ??
          result.transformNodes?.[0] ??
          rootMesh
        glbRoot.parent = visualRoot

        result.meshes.forEach((mesh) => {
          mesh.checkCollisions = true
        })

        this.carMesh = rootMesh

        this.carController = new CarController(
          this.scene!, 
          physicsMesh, 
          HINO_DUTRO_PHYSICS_CONFIG,
          HINO_DUTRO_CAMERA_CONFIG
        )

        // Set first-person reference to a dedicated eye position node for correct driver POV
        // DriverSeat in GLB is at seat cushion (too far back/low). Create eye node at proper position.
        // GLB audit (model space, before CTRL_TRUCK scale=2, visualRoot -PI/2):
        //   SteeringColumn.001 (wheel center): [2.0, 1.98, 0.28] → world Y≈3.96
        //   CabWindshield bottom: [2.25, 2.18, 0] → world Y≈4.36
        //   DriverSeat cushion: [1.2, 1.55, 0.28] → world Y≈3.10
        //   Dashboard.001: [1.98, 1.80, 0] → world Y≈3.60
        // Target eye: slightly above wheel (Y>3.96), behind wheel (Z<6.96), centered on wheel (X≈-1.09)
        // Model space target: [1.77, 2.1, 0.28] (0.23m behind steering column, 0.12m above it)
        // Offset from DriverSeat [1.2, 1.55, 0.28]: [0.57, 0.55, 0]
        // DriverSeat is a Mesh, not TransformNode -- must use getMeshByName
        const driverSeat = this.scene!.getMeshByName('DriverSeat')
        let driverEye: TransformNode | null = null
        let steeringWheel: TransformNode | null = null
        let windshield: TransformNode | null = null
        
        // RUNTIME AUDIT: Find ALL driver-related nodes in loaded scene
        console.log('[HINO AUDIT] Searching for driver-related nodes in loaded scene...')
        const allNodes = this.scene!.transformNodes
        const allMeshes = this.scene!.meshes
        
        const driverKeywords = ['driver', 'Driver', 'DRIVER', 'seat', 'Seat', 'SEAT', 'steer', 'Steer', 'STEER', 'wheel', 'Wheel', 'WHEEL', 'cab', 'Cab', 'CAB', 'cockpit', 'Cockpit', 'dashboard', 'Dashboard', 'windshield', 'Windshield', 'interior', 'Interior']
        
        console.log('[HINO AUDIT] All TransformNodes:')
        allNodes.forEach((node: TransformNode) => {
          const name = node.name
          const isDriverRelated = driverKeywords.some(kw => name.includes(kw))
          if (isDriverRelated) {
            const pos = node.getAbsolutePosition()
            console.log(`  [NODE] "${name}" | class=${node.getClassName()} | parent="${node.parent?.name}" | pos=(${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}) | rotQuat=${node.rotationQuaternion ? 'yes' : 'no'}`)
          }
        })
        
        console.log('[HINO AUDIT] All Meshes:')
        allMeshes.forEach((mesh: AbstractMesh) => {
          const name = mesh.name
          const isDriverRelated = driverKeywords.some(kw => name.includes(kw))
          if (isDriverRelated) {
            const pos = mesh.getAbsolutePosition()
            console.log(`  [MESH] "${name}" | class=${mesh.getClassName()} | parent="${mesh.parent?.name}" | pos=(${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}) | rotQuat=${mesh.rotationQuaternion ? 'yes' : 'no'}`)
          }
        })
        
        // Now try to find specific nodes -- DriverSeat is a Mesh, not TransformNode
        if (driverSeat) {
          driverEye = new TransformNode('DriverEye', this.scene)
          driverEye.parent = driverSeat
          // Forward 0.57 (+X), Up 0.55 (+Y) from seat cushion in model space
          // Scale 2 → world: forward 1.14m, up 1.1m from seat
          driverEye.position = new Vector3(0.57, 0.55, 0)
          driverEye.rotationQuaternion = null
          driverEye.rotation = new Vector3(0, 0, 0)

          this.carController.setFirstPersonReference(driverEye)
          console.log('[DemoScene] Hino Dutro first-person reference: DriverEye (on DriverSeat Mesh)')
        } else {
          console.warn('[DemoScene] DriverSeat node not found in Hino Dutro GLB')
          
          // FALLBACK: Try to find best alternative for driver reference
          // Look for seat-like nodes in BOTH transformNodes and meshes
          const seatCandidates = [...allNodes, ...allMeshes].filter((n: any) => 
            n.name.toLowerCase().includes('seat') || 
            n.name.toLowerCase().includes('driver')
          )
          console.log('[HINO AUDIT] Seat/Driver candidates:', seatCandidates.map((n: any) => n.name))
          
          if (seatCandidates.length > 0) {
            const bestSeat = seatCandidates[0]
            driverEye = new TransformNode('DriverEye', this.scene)
            driverEye.parent = bestSeat
            driverEye.position = new Vector3(0.57, 0.55, 0)
            driverEye.rotationQuaternion = null
            driverEye.rotation = new Vector3(0, 0, 0)
            this.carController.setFirstPersonReference(driverEye)
            console.log(`[DemoScene] Hino Dutro first-person reference: DriverEye (fallback to ${bestSeat.name})`)
          }
        }

        // Debug: Find steering wheel and windshield for runtime verification (also via keyword search)
        if (!steeringWheel) {
          const steerCandidates = [...allNodes, ...allMeshes].filter((n: any) => 
            n.name.toLowerCase().includes('steer') || 
            n.name.toLowerCase().includes('wheel') ||
            n.name.toLowerCase().includes('column')
          )
          console.log('[HINO AUDIT] Steering candidates:', steerCandidates.map((n: any) => n.name))
          if (steerCandidates.length > 0) steeringWheel = steerCandidates[0]
        }
        if (!steeringWheel) {
          steeringWheel = this.scene!.getTransformNodeByName('SteeringColumn.001')
        }
        
        if (!windshield) {
          const wsCandidates = [...allNodes, ...allMeshes].filter((n: any) => 
            n.name.toLowerCase().includes('windshield') || 
            n.name.toLowerCase().includes('cab')
          )
          console.log('[HINO AUDIT] Windshield/Cab candidates:', wsCandidates.map((n: any) => n.name))
          if (wsCandidates.length > 0) windshield = wsCandidates[0]
        }
        if (!windshield) {
          windshield = this.scene!.getTransformNodeByName('CabWindshield')
        }

        // Store for per-frame debug
        this.hinoDebugNodes = { driverSeat, driverEye, steeringWheel, windshield }

        // Initial debug dump
        if (driverEye && steeringWheel && windshield) {
          const de = driverEye.getAbsolutePosition()
          const sw = steeringWheel.getAbsolutePosition()
          const ws = windshield.getAbsolutePosition()
          console.log('[HINO DEBUG] Initial positions (world):')
          console.log('  DriverEye:', de.x.toFixed(3), de.y.toFixed(3), de.z.toFixed(3))
          console.log('  SteeringWheel:', sw.x.toFixed(3), sw.y.toFixed(3), sw.z.toFixed(3))
          console.log('  Windshield:', ws.x.toFixed(3), ws.y.toFixed(3), ws.z.toFixed(3))
          if (driverSeat) {
            const ds = driverSeat.getAbsolutePosition()
            console.log('  DriverSeat:', ds.x.toFixed(3), ds.y.toFixed(3), ds.z.toFixed(3))
            console.log('  Distances:')
            console.log('    Camera→DriverEye will be tracked per-frame')
            console.log('    DriverEye→SteeringWheel:', Vector3.Distance(de, sw).toFixed(3))
            console.log('    DriverEye→Windshield:', Vector3.Distance(de, ws).toFixed(3))
            console.log('    DriverSeat→DriverEye:', Vector3.Distance(ds, de).toFixed(3))
          } else {
            console.log('  DriverSeat: NOT FOUND')
            console.log('  Distances:')
            console.log('    Camera→DriverEye will be tracked per-frame')
            console.log('    DriverEye→SteeringWheel:', Vector3.Distance(de, sw).toFixed(3))
            console.log('    DriverEye→Windshield:', Vector3.Distance(de, ws).toFixed(3))
          }
        }

        if (this.canvas) {
          this.carController.setupCameras(this.canvas)
        }

        if (this.onCameraModeChange) {
          this.carController.onCameraModeChanged(this.onCameraModeChange)
        }

        if (this.onControlModeChange) {
          this.carController.onControlModeChanged(this.onControlModeChange)
        }

        if (this.onEngineStateChange) {
          this.carController.onEngineStateChanged(this.onEngineStateChange)
        }

        if (this.onCollisionCallback) {
          this.carController.onCollisionEvent(this.onCollisionCallback)
        }

        if (this.simpleMap) {
          this.carController.setMap(this.simpleMap)
        }

        const activeCamera = this.carController.getActiveCamera()
        if (activeCamera) {
          this.scene!.activeCamera = activeCamera
        }

        console.log('[DemoScene] Hino Dutro model setup complete')
      }
    } catch (error) {
      console.error('[DemoScene] Failed to load Hino Dutro model:', error)
      this.createFallbackCar()
    }
  }

  /**
   * Load the aircraft model from assets (khusus pesawat-testing)
   */
  private async loadAircraftModel(): Promise<void> {
    if (!this.scene) return

    console.log('[DemoScene] Loading aircraft model...')

    try {
      const modelPath = '/assets/Airplane_Vultee_BT-13_Valiant/'
      const modelFile = 'classic_trainer_aircraft.glb'

      console.log(`[DemoScene] Attempting to load: ${modelPath}${modelFile}`)

      const result = await SceneLoader.ImportMeshAsync(
        '',
        modelPath,
        modelFile,
        this.scene
      )

      console.log('[DemoScene] Aircraft model loaded, meshes:', result.meshes.length)

      if (result.meshes.length > 0) {
        const rootMesh = result.meshes[0]

        // Get spawn from AirportMap
        const spawnRaw = this.airportMap?.getSpawnPoint() ?? { position: { x: 0, y: 0, z: -200 }, rotation: 0 }
        const hasPosition = 'position' in spawnRaw
        const spawnPos = hasPosition ? spawnRaw.position : { x: (spawnRaw as any).x, y: 0, z: (spawnRaw as any).z }
        const spawnRot = hasPosition ? spawnRaw.rotation : (spawnRaw as any).rotationY

        // Create aircraft root (physics + visual combined)
        const aircraftRoot = new TransformNode('AircraftRoot', this.scene)
        aircraftRoot.position = new Vector3(spawnPos.x ?? 0, 0, spawnPos.z ?? 0)

        // Raw GLB axes: nose=+X, top=+Z, right wing=+Y (wheels below). Spawn the
        // aircraft level and nose-first toward +Z (heading 0). A single yaw isn't
        // enough: the raw model also needs a -PI/2 roll around the nose axis so the
        // wings end up horizontal and the top points +Y. With this rotation:
        //   nose(+X) -> World +Z, right wing(+Y) -> World +X, top(+Z) -> World +Y
        aircraftRoot.rotationQuaternion = Quaternion.FromEulerAngles(-Math.PI / 2, -Math.PI / 2, 0)

        // If spawn has rotation, apply it
        if (spawnRot) {
          const spawnQuat = Quaternion.FromEulerAngles(0, spawnRot, 0)
          aircraftRoot.rotationQuaternion = aircraftRoot.rotationQuaternion.multiply(spawnQuat)
        }

        // Parent GLB root under aircraftRoot
        const glbRoot =
          result.transformNodes?.[0] ??
          rootMesh
        glbRoot.parent = aircraftRoot

        // Compute bounds and adjust Y so wheels touch ground
        aircraftRoot.computeWorldMatrix(true)
        const boundingInfo = aircraftRoot.getHierarchyBoundingVectors()
        const groundOffsetY = -boundingInfo.min.y
        aircraftRoot.position.y = groundOffsetY

        console.log('[DemoScene] Aircraft bounds:', boundingInfo)
        console.log('[DemoScene] Aircraft ground offset Y:', groundOffsetY)

        // Enable collision on all meshes
        result.meshes.forEach((mesh) => {
          mesh.checkCollisions = true
          this.lightingSetup?.addShadowCaster(mesh)
          mesh.receiveShadows = true
        })

        this.carMesh = rootMesh

        // Create AircraftSystem (handles physics, input, camera, store sync)
        this.aircraftSystem = new AircraftSystem(
          this.scene,
          aircraftRoot,
          'pesawat-testing',
          this.simpleMap,
          this.airportMap?.getSpawnPoint() ?? null,
          // Task 16: AABB statis bangunan dari AirportMap dipakai sebagai
          // collision pesawat. Untuk map lain airportMap null → tidak ada
          // collision bangunan sama sekali.
          this.airportMap?.getColliders() ?? null
        )

        // Setup cameras with canvas
        if (this.canvas) {
          this.aircraftSystem.setupCameras(this.canvas)
        }

        // Set camera mode change callback
        if (this.onCameraModeChange) {
          this.aircraftSystem.onCameraModeChanged(this.onCameraModeChange)
        }

        // Set engine state change callback
        if (this.onEngineStateChange) {
          this.aircraftSystem.onEngineStateChanged(this.onEngineStateChange)
        }

        // Set active camera from aircraft system
        const activeCamera = this.aircraftSystem.getActiveCamera()
        if (activeCamera) {
          this.scene.activeCamera = activeCamera
        }

        console.log('[DemoScene] Aircraft model setup complete')
      }
    } catch (error) {
      console.error('[DemoScene] Failed to load aircraft model:', error)
      this.createFallbackCar()
    }
  }

  /**
   * Create a fallback car placeholder if model loading fails
   */
  private createFallbackCar(): void {
    if (!this.scene) return

    console.log('[DemoScene] Creating fallback car placeholder')

    // Create a more detailed car-like placeholder
    // Main car body
    const carBody = MeshBuilder.CreateBox('carBody', { width: 4, height: 1, depth: 2 }, this.scene)
    carBody.position = new Vector3(0, 0.6, 50)

    // Car cabin (roof)
    const carCabin = MeshBuilder.CreateBox('carCabin', { width: 2.2, height: 0.9, depth: 1.8 }, this.scene)
    carCabin.position = new Vector3(-0.3, 1.55, 50)

    // Hood (front)
    const hood = MeshBuilder.CreateBox('hood', { width: 1, height: 0.3, depth: 1.8 }, this.scene)
    hood.position = new Vector3(1.3, 0.9, 0)

    // Create wheels
    const wheelPositions = [
      new Vector3(1.2, 0.35, 1.1),   // Front right
      new Vector3(1.2, 0.35, -1.1),  // Front left
      new Vector3(-1.2, 0.35, 1.1),  // Back right
      new Vector3(-1.2, 0.35, -1.1), // Back left
    ]

    const wheelMaterial = new PBRMaterial('wheelMaterial', this.scene)
    wheelMaterial.albedoColor = new Color3(0.1, 0.1, 0.1)
    wheelMaterial.metallic = 0.3
    wheelMaterial.roughness = 0.8

    wheelPositions.forEach((pos, i) => {
      const wheel = MeshBuilder.CreateCylinder(`wheel_${i}`, {
        diameter: 0.7,
        height: 0.3,
        tessellation: 24
      }, this.scene!)
      wheel.rotation.x = Math.PI / 2
      wheel.position = pos
      wheel.material = wheelMaterial
      this.lightingSetup?.addShadowCaster(wheel)
    })

    // Create materials
    const bodyMaterial = new PBRMaterial('carBodyMaterial', this.scene)
    bodyMaterial.albedoColor = new Color3(0.8, 0.2, 0.2) // Red car
    bodyMaterial.metallic = 0.7
    bodyMaterial.roughness = 0.3
    carBody.material = bodyMaterial
    hood.material = bodyMaterial

    const cabinMaterial = new PBRMaterial('cabinMaterial', this.scene)
    cabinMaterial.albedoColor = new Color3(0.1, 0.1, 0.15) // Dark windows
    cabinMaterial.metallic = 0.9
    cabinMaterial.roughness = 0.1
    carCabin.material = cabinMaterial

    // Headlights
    const headlightMaterial = new PBRMaterial('headlightMaterial', this.scene)
    headlightMaterial.albedoColor = new Color3(1, 1, 0.9)
    headlightMaterial.emissiveColor = new Color3(1, 1, 0.8)
    headlightMaterial.emissiveIntensity = 1

    const headlightPositions = [
      new Vector3(2, 0.6, 0.6),
      new Vector3(2, 0.6, -0.6),
    ]

    headlightPositions.forEach((pos, i) => {
      const headlight = MeshBuilder.CreateSphere(`headlight_${i}`, { diameter: 0.3 }, this.scene!)
      headlight.position = pos
      headlight.material = headlightMaterial
    })

    // Taillights
    const taillightMaterial = new PBRMaterial('taillightMaterial', this.scene)
    taillightMaterial.albedoColor = new Color3(1, 0.1, 0.1)
    taillightMaterial.emissiveColor = new Color3(1, 0, 0)
    taillightMaterial.emissiveIntensity = 0.5

    const taillightPositions = [
      new Vector3(-2, 0.6, 0.6),
      new Vector3(-2, 0.6, -0.6),
    ]

    taillightPositions.forEach((pos, i) => {
      const taillight = MeshBuilder.CreateBox(`taillight_${i}`, { width: 0.1, height: 0.2, depth: 0.4 }, this.scene!)
      taillight.position = pos
      taillight.material = taillightMaterial
    })

    this.carMesh = carBody
    this.lightingSetup?.addShadowCaster(carBody)
    this.lightingSetup?.addShadowCaster(carCabin)
    this.lightingSetup?.addShadowCaster(hood)

    console.log('[DemoScene] Fallback car created')
  }

  update(deltaTime: number): void {
    // Update car controller (physics, movement, and camera)
    this.carController?.update(deltaTime)

    // Hino Dutro: Sync physicsRoot position + yaw from physicsMesh (NOT pitch/roll)
    // This prevents visual micro-jitter from physics pitch/roll on rough ground.
    if (this.mapType === 'hino-dutro-testing') {
      const physicsMesh = this.scene!.getMeshByName('hinoPhysicsMesh')
      const physicsRoot = this.scene!.getTransformNodeByName('HinoPhysicsRoot')
      if (physicsMesh && physicsRoot) {
        // Copy position
        physicsRoot.position.copyFrom(physicsMesh.position)
        // Copy yaw ONLY (not pitch/roll) - visual should stay level
        physicsRoot.rotation.y = physicsMesh.rotation.y
      }
    }

    // Hino Dutro Camera 2 vibration debug
    if (this.mapType === 'hino-dutro-testing' && this.carController) {
      const cameraManager = (this.carController as any).cameraManager
      const cameraMode = cameraManager?.getMode?.()
      if (cameraMode === 'first-person' && this.hinoDebugNodes) {
        const { driverEye, steeringWheel, windshield, driverSeat } = this.hinoDebugNodes
        const activeCamera = this.carController.getActiveCamera()
        
        if (activeCamera && driverEye && steeringWheel && windshield && driverSeat) {
          // Capture positions
          const camPos = activeCamera.position.clone()
          const camTarget = (activeCamera as any).target ? (activeCamera as any).target.clone() : new Vector3(0, 0, 0)
          const camForward = activeCamera.getForwardRay().direction.clone()
          
          const eyePos = driverEye.getAbsolutePosition()
          const wheelPos = steeringWheel.getAbsolutePosition()
          const wsPos = windshield.getAbsolutePosition()
          const seatPos = driverSeat.getAbsolutePosition()
          
          // Get CTRL_TRUCK root position
          const ctrlTruck = this.scene!.getTransformNodeByName('CTRL_TRUCK')
          const ctrlPos = ctrlTruck ? ctrlTruck.getAbsolutePosition() : new Vector3(0, 0, 0)
          
          // Get physics mesh position (now child of HinoPhysicsRoot)
          const physicsMesh = this.scene!.getMeshByName('hinoPhysicsMesh')
          const physPos = physicsMesh ? physicsMesh.getAbsolutePosition() : new Vector3(0, 0, 0)
          
          // Get HinoPhysicsRoot position (should be stable, no pitch/roll)
          const physicsRoot = this.scene!.getTransformNodeByName('HinoPhysicsRoot')
          const physRootPos = physicsRoot ? physicsRoot.getAbsolutePosition() : new Vector3(0, 0, 0)
          
          // Distances
          const camToEye = Vector3.Distance(camPos, eyePos)
          
          // Vibration detection: track Y changes
          if (!this.hinoVibrationTracker) {
            this.hinoVibrationTracker = {
              prevCamY: camPos.y,
              prevEyeY: eyePos.y,
              prevSeatY: seatPos.y,
              prevCtrlY: ctrlPos.y,
              prevPhysY: physPos.y,
              prevPhysRootY: physRootPos.y,
              frameCount: 0,
              maxDyCam: 0,
              maxDyEye: 0,
              maxDySeat: 0,
              maxDyCtrl: 0,
              maxDyPhys: 0,
              maxDyPhysRoot: 0,
            }
          }
          
          const tracker = this.hinoVibrationTracker
          const dyCam = Math.abs(camPos.y - tracker.prevCamY)
          const dyEye = Math.abs(eyePos.y - tracker.prevEyeY)
          const dySeat = Math.abs(seatPos.y - tracker.prevSeatY)
          const dyCtrl = Math.abs(ctrlPos.y - tracker.prevCtrlY)
          const dyPhys = Math.abs(physPos.y - tracker.prevPhysY)
          const dyPhysRoot = Math.abs(physRootPos.y - tracker.prevPhysRootY)
          
          tracker.maxDyCam = Math.max(tracker.maxDyCam, dyCam)
          tracker.maxDyEye = Math.max(tracker.maxDyEye, dyEye)
          tracker.maxDySeat = Math.max(tracker.maxDySeat, dySeat)
          tracker.maxDyCtrl = Math.max(tracker.maxDyCtrl, dyCtrl)
          tracker.maxDyPhys = Math.max(tracker.maxDyPhys, dyPhys)
          tracker.maxDyPhysRoot = Math.max(tracker.maxDyPhysRoot, dyPhysRoot)
          
          tracker.prevCamY = camPos.y
          tracker.prevEyeY = eyePos.y
          tracker.prevSeatY = seatPos.y
          tracker.prevCtrlY = ctrlPos.y
          tracker.prevPhysY = physPos.y
          tracker.prevPhysRootY = physRootPos.y
          tracker.frameCount++
          
          // Log every 30 frames (~0.5s at 60fps) or if significant vibration detected
          const shouldLog = tracker.frameCount % 30 === 0 || 
            dyCam > 0.005 || dyEye > 0.005 || dySeat > 0.005 || dyCtrl > 0.005 || dyPhys > 0.005 || dyPhysRoot > 0.005
          
          if (shouldLog) {
            console.log('[HINO VIBRATION] Frame:', tracker.frameCount)
            console.log('  Camera Y:', camPos.y.toFixed(4), 'ΔY:', dyCam.toFixed(6), 'max:', tracker.maxDyCam.toFixed(6))
            console.log('  DriverEye Y:', eyePos.y.toFixed(4), 'ΔY:', dyEye.toFixed(6), 'max:', tracker.maxDyEye.toFixed(6))
            console.log('  DriverSeat Y:', seatPos.y.toFixed(4), 'ΔY:', dySeat.toFixed(6), 'max:', tracker.maxDySeat.toFixed(6))
            console.log('  CTRL_TRUCK Y:', ctrlPos.y.toFixed(4), 'ΔY:', dyCtrl.toFixed(6), 'max:', tracker.maxDyCtrl.toFixed(6))
            console.log('  PhysicsMesh Y:', physPos.y.toFixed(4), 'ΔY:', dyPhys.toFixed(6), 'max:', tracker.maxDyPhys.toFixed(6))
            console.log('  HinoPhysicsRoot Y:', physRootPos.y.toFixed(4), 'ΔY:', dyPhysRoot.toFixed(6), 'max:', tracker.maxDyPhysRoot.toFixed(6))
            console.log('  Camera→DriverEye:', camToEye.toFixed(6), camToEye < 0.01 ? '✓' : '✗')
            console.log('  Speed:', this.carController.getSpeed().toFixed(2), 'km/h')
          }
        }
      }
    }

    // Aircraft system updates itself via onBeforeRenderObservable.
    // We only need to update waypoint system with aircraft position here.
    // Kirim Y asli agar checkpoint udara (pesawat-testing) bisa ditegakkan 3D.
    if (this.aircraftSystem && this.waypointSystem) {
      const pos = this.aircraftSystem.getPosition()
      this.waypointSystem.update(new Vector3(pos.x, pos.y, pos.z), deltaTime)
    }

    // Visual steering Motor Testing — stang/fork mengikuti sudut steering existing.
    // rotation.y = +steerAngleRad: A (steer negatif) → fork/stang belok KIRI,
    // D (steer positif) → belok KANAN; kembali tengah saat steering dilepas.
    if (this.motorSteeringPivot && this.carController) {
      this.motorSteeringPivot.rotation.y = this.carController.getSteerAngleRad()
      // Temp debug: log 1 per ~1 detik agar user bisa cek di F12 Console.
      this.motorSteeringDiagFrame++
      if (this.motorSteeringDiagFrame % 60 === 0) {
        this.motorSteeringDiagFrame = 0
        console.log(
          '[MotorDiag] steerAngleRad:',
          this.carController.getSteerAngleRad().toFixed(3),
          'steeringInput:',
          this.carController.getSteeringInput().toFixed(3),
          'pivotRotY:',
          this.motorSteeringPivot.rotation.y.toFixed(3)
        )
      }
    }

    // Update wrong-way detection
    if (this.carController) {
      const position = this.carController.getPosition()
      const heading = this.carController.getHeading()
      const speed = this.carController.getSpeed()
      this.wrongWayDetector.update(position, heading, speed, deltaTime)

      // Update waypoint system
      if (this.waypointSystem) {
        this.waypointSystem.update(position, deltaTime)
      }
    }

    // Forklift Testing — per-frame: update ForkSystem (T/G = lift, Y/H = tilt)
    // & ForkliftCargoTest (pickup/drop cargo). Tanpa ini T/G/Y/H & cargo tidak
    // pernah berjalan (ADD, ADD-ONLY, khusus map forklift-testing).
    if (this.mapType === 'forklift-testing') {
      this.forkSystem?.update(deltaTime)
      if (this.carController && this.forkliftCargoTest && this.forkliftPhysicsMesh) {
        this.forkliftCargoTest.update(
          this.forkliftPhysicsMesh,
          this.carController.getPosition(),
          this.carController.getHeading(),
          deltaTime
        )
      }

      // Sinkronkan visual CTRL_FORKLIFT dengan physics heading agar badan/fork
      // ikut berbelok saat A/D. Koreksi -PI/2: model +X (fork depan) → world +Z.
      // QUATERNION PERSISTED — jangan di-null / overwrite rotation.set setelahnya.
      if (this.forkliftVisualRoot && this.carController) {
        this.forkliftVisualRoot.rotationQuaternion = Quaternion.FromEulerAngles(
          0,
          this.carController.getHeading() - Math.PI / 2,
          0
        )
      }
    }
  }

  // Forklift cargo test methods
  getCargoDeliveredCount(): number {
    return this.forkliftCargoTest?.getDeliveredCount() ?? 0
  }

  getCargoTotalCount(): number {
    return this.forkliftCargoTest?.getTotalCargo() ?? 0
  }

  isCargoMissionComplete(): boolean {
    return this.forkliftCargoTest?.isComplete() ?? false
  }

  // Wheel controller methods
  setControlMode(mode: 'keyboard' | 'mouse' | 'wheel'): void {
    this.carController?.setControlMode(mode)
  }

  updateWheelSettings(settings: any): void {
    this.carController?.updateWheelSettings(settings)
  }

  detectWheelPedal(kind: 'throttle' | 'brake'): boolean {
    return this.carController?.detectWheelPedal(kind) ?? false
  }

  captureWheelPedalRest(kind: 'throttle' | 'brake'): boolean {
    return this.carController?.captureWheelPedalRest(kind) ?? false
  }

  setForkSystem(forkSystem: ForkSystem): void {
    this.forkSystem = forkSystem
    this.forkliftCargoTest?.setForkSystem(forkSystem)
  }

  dispose(): void {
    this.postProcessing?.dispose()
    this.environmentSetup?.dispose()
    this.lightingSetup?.dispose()
    this.inputManager?.dispose()
    this.carController?.dispose()
    this.aircraftSystem?.dispose()
    this.aircraftSystem = null
    this.airportMap = null
    this.forkSystem?.dispose()
    this.forkSystem = null
    this.forkliftCargoTest?.dispose()
    this.forkliftCargoTest = null
    this.forkliftPhysicsMesh = null
    if (typeof this.simpleMap?.dispose === 'function') {
      this.simpleMap?.dispose();
    }

    this.animatedMeshes.forEach((mesh) => mesh.dispose())
    this.animatedMeshes = []

    if (this.carMesh) {
      this.carMesh.dispose()
      this.carMesh = null
    }

    this.waypointMarkers?.dispose()
    this.waypointMarkers = null
    this.waypointSystem = null
    this.onCameraModeChange = null
    this.onControlModeChange = null
    this.canvas = null

    console.log('[DemoScene] Disposed')
  }
}
