/**
 * Car Camera Manager
 * ==================
 * Manages all camera modes for the car:
 * - Third Person: Locked camera following behind the car
 * - First Person: Cockpit view inside the car
 * - Free: User-controlled orbit camera around the car
 */

import {
  Scene,
  Vector3,
  ArcRotateCamera,
  UniversalCamera,
  Camera,
  AbstractMesh,
  TransformNode,
  PointerEventTypes,
  Observer,
  PointerInfo,
} from '@babylonjs/core'
import type { CameraMode, CameraConfig } from '../../types'
import { DEFAULT_CAMERA_CONFIG } from '../../config'

export class CarCameraManager {
  private scene: Scene
  private carMesh: TransformNode
  private config: CameraConfig
  private canvas: HTMLCanvasElement | null = null
  
  // Cameras
  private thirdPersonCamera: ArcRotateCamera | null = null
  private firstPersonCamera: UniversalCamera | null = null
  private freeCamera: ArcRotateCamera | null = null
  
  // State
  private currentMode: CameraMode = 'third-person'
  private onModeChange: ((mode: CameraMode) => void) | null = null

  // Optional reference node for first-person camera (e.g. driver head position)
  private firstPersonReferenceNode: TransformNode | null = null
  
  // Wheel zoom - using BabylonJS observer and DOM handler
  private wheelObserver: Observer<PointerInfo> | null = null
  private wheelPreventHandler: ((e: WheelEvent) => void) | null = null

  constructor(scene: Scene, carMesh: TransformNode, config?: Partial<CameraConfig>) {
    this.scene = scene
    this.carMesh = carMesh
    this.config = this.mergeConfig(config)
  }

  /**
   * Merge partial config with defaults
   */
  private mergeConfig(config?: Partial<CameraConfig>): CameraConfig {
    if (!config) return { ...DEFAULT_CAMERA_CONFIG }
    
    return {
      thirdPerson: { ...DEFAULT_CAMERA_CONFIG.thirdPerson, ...config.thirdPerson },
      firstPerson: { ...DEFAULT_CAMERA_CONFIG.firstPerson, ...config.firstPerson },
      free: { ...DEFAULT_CAMERA_CONFIG.free, ...config.free },
    }
  }

  /**
   * Setup all cameras with canvas
   */
  setup(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.setupThirdPersonCamera()
    this.setupFirstPersonCamera()
    this.setupFreeCamera()
    this.setupWheelZoom()
    
    // Start with third person
    this.scene.activeCamera = this.thirdPersonCamera
    console.log('[CarCameraManager] Cameras initialized - Mode: third-person')
  }

  /**
   * Setup Third Person Camera (locked behind car)
   */
  private setupThirdPersonCamera(): void {
    const tpConfig = this.config.thirdPerson
    
    const forwardOffset = tpConfig.forwardTargetOffset ?? 0
    const initFwdX = forwardOffset !== 0 ? Math.sin(this.carMesh.rotation.y) * forwardOffset : 0
    const initFwdZ = forwardOffset !== 0 ? Math.cos(this.carMesh.rotation.y) * forwardOffset : 0
    const initialTarget = this.carMesh.getAbsolutePosition().add(new Vector3(initFwdX, tpConfig.targetHeightOffset, initFwdZ))

    this.thirdPersonCamera = new ArcRotateCamera(
      'thirdPersonCamera',
      tpConfig.alpha,
      tpConfig.beta,
      tpConfig.distance,
      initialTarget,
      this.scene
    )
    
    // Lock the camera - disable all user input
    this.thirdPersonCamera.lowerRadiusLimit = tpConfig.distance
    this.thirdPersonCamera.upperRadiusLimit = tpConfig.distance
    this.thirdPersonCamera.lowerBetaLimit = tpConfig.beta
    this.thirdPersonCamera.upperBetaLimit = tpConfig.beta
    this.thirdPersonCamera.lowerAlphaLimit = tpConfig.alpha
    this.thirdPersonCamera.upperAlphaLimit = tpConfig.alpha
    this.thirdPersonCamera.inertia = tpConfig.inertia
    this.thirdPersonCamera.panningSensibility = 0
    this.thirdPersonCamera.keysUp = []
    this.thirdPersonCamera.keysDown = []
    this.thirdPersonCamera.keysLeft = []
    this.thirdPersonCamera.keysRight = []
  }

  /**
   * Setup First Person Camera (cockpit view)
   */
  private setupFirstPersonCamera(): void {
    const fpConfig = this.config.firstPerson
    
    this.firstPersonCamera = new UniversalCamera(
      'firstPersonCamera',
      Vector3.Zero(),
      this.scene
    )
    
    this.firstPersonCamera.fov = fpConfig.fov
    this.firstPersonCamera.minZ = fpConfig.minZ
    this.firstPersonCamera.maxZ = fpConfig.maxZ
    this.firstPersonCamera.inputs.clear() // We control it manually
  }

  /**
   * Setup Free Camera (user can rotate and zoom)
   */
  private setupFreeCamera(): void {
    const freeConfig = this.config.free
    
    this.freeCamera = new ArcRotateCamera(
      'freeCamera',
      freeConfig.alpha,
      freeConfig.beta,
      freeConfig.distance,
      this.carMesh.getAbsolutePosition().add(new Vector3(0, freeConfig.targetHeightOffset, 0)),
      this.scene
    )
    
    // Set zoom limits
    this.freeCamera.lowerRadiusLimit = freeConfig.lowerRadiusLimit
    this.freeCamera.upperRadiusLimit = freeConfig.upperRadiusLimit
    this.freeCamera.lowerBetaLimit = freeConfig.lowerBetaLimit
    this.freeCamera.upperBetaLimit = freeConfig.upperBetaLimit
    this.freeCamera.inertia = freeConfig.inertia
    this.freeCamera.panningSensibility = 0
    
    // Disable keyboard controls
    this.freeCamera.keysUp = []
    this.freeCamera.keysDown = []
    this.freeCamera.keysLeft = []
    this.freeCamera.keysRight = []
    
    // Configure wheel zoom - use built-in BabylonJS wheel handling
    this.freeCamera.wheelPrecision = freeConfig.wheelPrecision ?? 20
    this.freeCamera.wheelDeltaPercentage = freeConfig.wheelDeltaPercentage ?? 0.05
    
    if (this.canvas) {
      // Attach control but detach initially since we start in third-person
      this.freeCamera.attachControl(this.canvas, true)
      this.freeCamera.detachControl()
    }
  }

  /**
   * Setup wheel zoom using BabylonJS pointer observable
   * This approach works even when pointer is locked
   */
  private setupWheelZoom(): void {
    if (!this.canvas) return
    
    const freeConfig = this.config.free
    const zoomSpeed = freeConfig.wheelDeltaPercentage ?? 0.05
    const lowerLimit = freeConfig.lowerRadiusLimit ?? 4
    const upperLimit = freeConfig.upperRadiusLimit ?? 50
    
    // Prevent page scroll when in free camera mode - this is the key fix!
    this.wheelPreventHandler = (e: WheelEvent) => {
      if (this.currentMode === 'free') {
        e.preventDefault()
      }
    }
    
    // Add to canvas with passive: false to allow preventDefault
    this.canvas.addEventListener('wheel', this.wheelPreventHandler, { passive: false })
    
    // Use BabylonJS onPointerObservable to capture wheel events for zoom
    this.wheelObserver = this.scene.onPointerObservable.add((pointerInfo) => {
      // Only handle wheel events
      if (pointerInfo.type !== PointerEventTypes.POINTERWHEEL) {
        return
      }
      
      // Only zoom when in free camera mode
      if (this.currentMode !== 'free' || !this.freeCamera) {
        return
      }
      
      // Get wheel delta from the event
      const wheelEvent = pointerInfo.event as WheelEvent
      const delta = wheelEvent.deltaY > 0 ? 1 : -1
      
      // Calculate new radius
      const zoomAmount = this.freeCamera.radius * zoomSpeed * delta
      const newRadius = this.freeCamera.radius + zoomAmount
      
      // Apply zoom with limits
      this.freeCamera.radius = Math.max(lowerLimit, Math.min(upperLimit, newRadius))
    })
    
    console.log('[CarCameraManager] Wheel zoom initialized with scroll prevention')
  }

  /**
   * Set callback for mode changes
   */
  onModeChanged(callback: (mode: CameraMode) => void): void {
    this.onModeChange = callback
  }

  /**
   * Set optional reference node for first-person camera position.
   * When set, the first-person camera will track this node's world position
   * instead of calculating from fixed offsets. Useful for placing the camera
   * at a specific point in the vehicle model hierarchy (e.g. driver's head).
   */
  setFirstPersonReference(node: TransformNode): void {
    this.firstPersonReferenceNode = node
  }

  /**
   * Update first-person camera with custom heading (used for vehicles
   * where visual model orientation differs from physics heading).
   * Only affects first-person camera; other modes use regular update().
   */
  updateFirstPersonCameraWithHeading(heading: number): void {
    if (!this.firstPersonCamera) return
    
    const fpConfig = this.config.firstPerson
    
    // Calculate forward direction from heading
    const forward = new Vector3(Math.sin(heading), 0, Math.cos(heading))
    
    let cameraPosition: Vector3
    
    if (this.firstPersonReferenceNode) {
      const refPos = this.firstPersonReferenceNode.getAbsolutePosition()
      const heightOff = fpConfig.referenceHeightOffset ?? 0
      cameraPosition = refPos.add(new Vector3(0, heightOff, 0))
    } else {
      const right = new Vector3(Math.cos(heading), 0, -Math.sin(heading))
      cameraPosition = this.carMesh.getAbsolutePosition()
        .add(forward.scale(fpConfig.forwardOffset))
        .add(right.scale(fpConfig.sideOffset))
        .add(new Vector3(0, fpConfig.heightOffset, 0))
    }
    
    const lookTarget = cameraPosition.add(forward.scale(fpConfig.lookAheadDistance))
    this.firstPersonCamera.position.copyFrom(cameraPosition)
    this.firstPersonCamera.setTarget(lookTarget)
  }

  /**
   * Toggle between camera modes
   */
  toggleMode(): void {
    if (this.currentMode === 'third-person') {
      this.setMode('first-person')
    } else if (this.currentMode === 'first-person') {
      this.setMode('free')
    } else {
      this.setMode('third-person')
    }
  }

  /**
   * Set specific camera mode
   */
  setMode(mode: CameraMode): void {
    // Detach free camera control when switching away
    if (this.currentMode === 'free' && this.freeCamera && this.canvas) {
      this.freeCamera.detachControl()
    }

    this.currentMode = mode
    
    switch (mode) {
      case 'third-person':
        if (this.thirdPersonCamera) {
          this.scene.activeCamera = this.thirdPersonCamera
          console.log('[CarCameraManager] Switched to Third Person camera (locked)')
        }
        break
        
      case 'first-person':
        if (this.firstPersonCamera) {
          this.scene.activeCamera = this.firstPersonCamera
          console.log('[CarCameraManager] Switched to First Person camera')
        }
        break
        
      case 'free':
        if (this.freeCamera && this.canvas) {
          this.freeCamera.attachControl(this.canvas, true)
          this.scene.activeCamera = this.freeCamera
          console.log('[CarCameraManager] Switched to Free camera')
        }
        break
    }

    // Notify listeners
    if (this.onModeChange) {
      this.onModeChange(mode)
    }
  }

  /**
   * Get current camera mode
   */
  getMode(): CameraMode {
    return this.currentMode
  }

  /**
   * Get active camera
   */
  getActiveCamera(): Camera | null {
    switch (this.currentMode) {
      case 'third-person':
        return this.thirdPersonCamera
      case 'first-person':
        return this.firstPersonCamera
      case 'free':
        return this.freeCamera
      default:
        return this.thirdPersonCamera
    }
  }

  /**
   * Update camera configuration at runtime
   */
  updateConfig(config: Partial<CameraConfig>): void {
    this.config = this.mergeConfig(config)
  }

  /**
   * Update cameras each frame
   * @param heading Car heading in radians
   */
  update(heading: number): void {
    switch (this.currentMode) {
      case 'third-person':
        this.updateThirdPersonCamera(heading)
        break
      case 'first-person':
        this.updateFirstPersonCamera(heading)
        break
      case 'free':
        this.updateFreeCamera()
        break
    }
  }

  /**
   * Update Third Person camera - follows behind car
   */
  private updateThirdPersonCamera(heading: number): void {
    if (!this.thirdPersonCamera) return
    
    const tpConfig = this.config.thirdPerson
    const forwardOffset = tpConfig.forwardTargetOffset ?? 0
    const fwdX = forwardOffset !== 0 ? Math.sin(heading) * forwardOffset : 0
    const fwdZ = forwardOffset !== 0 ? Math.cos(heading) * forwardOffset : 0
    const targetPosition = this.carMesh.getAbsolutePosition().add(new Vector3(fwdX, tpConfig.targetHeightOffset, fwdZ))
    
    // Smooth follow target
    this.thirdPersonCamera.target = Vector3.Lerp(
      this.thirdPersonCamera.target, 
      targetPosition, 
      tpConfig.followSpeed
    )
    
    // Lock alpha to follow car heading
    const targetAlpha = -heading - Math.PI / 2
    this.thirdPersonCamera.alpha = targetAlpha
    this.thirdPersonCamera.lowerAlphaLimit = targetAlpha
    this.thirdPersonCamera.upperAlphaLimit = targetAlpha
  }

  /**
   * Update First Person camera - rigidly attached
   */
  private updateFirstPersonCamera(heading: number): void {
    if (!this.firstPersonCamera) return
    
    const fpConfig = this.config.firstPerson
    
    // Calculate forward direction from heading
    const forward = new Vector3(Math.sin(heading), 0, Math.cos(heading))
    
    let cameraPosition: Vector3
    
    if (this.firstPersonReferenceNode) {
      // Use the reference node's world position + optional height offset
      const refPos = this.firstPersonReferenceNode.getAbsolutePosition()
      const heightOff = fpConfig.referenceHeightOffset ?? 0
      cameraPosition = refPos.add(new Vector3(0, heightOff, 0))
    } else {
      // Fallback: calculate from fixed offsets relative to carMesh
      const right = new Vector3(Math.cos(heading), 0, -Math.sin(heading))
      
      cameraPosition = this.carMesh.getAbsolutePosition()
        .add(forward.scale(fpConfig.forwardOffset))
        .add(right.scale(fpConfig.sideOffset))
        .add(new Vector3(0, fpConfig.heightOffset, 0))
    }
    
    const lookTarget = cameraPosition.add(forward.scale(fpConfig.lookAheadDistance))
    
    // Direct position update - no smoothing for FPS camera
    this.firstPersonCamera.position.copyFrom(cameraPosition)
    this.firstPersonCamera.setTarget(lookTarget)
  }

  /**
   * Update Free camera - follows car but user controls rotation
   */
  private updateFreeCamera(): void {
    if (!this.freeCamera) return
    
    const freeConfig = this.config.free
    const targetPosition = this.carMesh.getAbsolutePosition().add(new Vector3(0, freeConfig.targetHeightOffset, 0))
    
    // Smooth follow target only
    this.freeCamera.target = Vector3.Lerp(
      this.freeCamera.target, 
      targetPosition, 
      freeConfig.followSpeed
    )
  }

  /**
   * Dispose all cameras
   */
  dispose(): void {
    // Remove wheel observer
    if (this.wheelObserver) {
      this.scene.onPointerObservable.remove(this.wheelObserver)
      this.wheelObserver = null
    }
    
    // Remove wheel prevent handler
    if (this.wheelPreventHandler && this.canvas) {
      this.canvas.removeEventListener('wheel', this.wheelPreventHandler)
      this.wheelPreventHandler = null
    }
    
    if (this.thirdPersonCamera) {
      this.thirdPersonCamera.dispose()
      this.thirdPersonCamera = null
    }
    if (this.firstPersonCamera) {
      this.firstPersonCamera.dispose()
      this.firstPersonCamera = null
    }
    if (this.freeCamera) {
      this.freeCamera.dispose()
      this.freeCamera = null
    }
    this.onModeChange = null
    this.canvas = null
    console.log('[CarCameraManager] Disposed')
  }
}
