/**
 * Car Physics Engine
 * ==================
 * Handles all physics calculations for car movement including:
 * - Acceleration and braking
 * - Steering and turning
 * - Grip and drifting
 * - Collision detection and response
 * - Body dynamics (roll and pitch)
 */

import { Vector3, AbstractMesh, TransformNode } from '@babylonjs/core'
import type { CarPhysicsConfig, CarInputState, CarPhysicsState } from '../../types'
import { DEFAULT_PHYSICS_CONFIG } from '../../config'
import type { SimpleMap } from '../SimpleMap'

/**
 * Physics state interface for external access
 */
export interface PhysicsInfo {
  speed: number
  speedKmh: number
  forwardSpeed: number
  isDrifting: boolean
  slipAngle: number
  steerAngle: number
  isGrounded: boolean
}

export class CarPhysics {
  private config: CarPhysicsConfig
  private map: SimpleMap | null = null
  
  // Physics state
  private velocity: Vector3 = Vector3.Zero()
  private heading: number = 0
  private forwardVelocity: number = 0
  private lateralVelocity: number = 0
  private steerAngle: number = 0
  private targetSteerAngle: number = 0
  private verticalVelocity: number = 0
  private isGrounded: boolean = true
  private isDrifting: boolean = false
  private slipAngle: number = 0
  private bodyRoll: number = 0
  private bodyPitch: number = 0

  // Pergeseran posisi akibat pivot steering di belakang pusat mesh (khusus
  // kendaraan dengan config.steerPivotOffset ≠ 0, mis. forklift rear-wheel
  // steering). Default 0 → tidak berpengaruh untuk kendaraan lain.
  private pivotDisplacement: Vector3 = Vector3.Zero()

  // === TRANSMISSION SYSTEM ===
  private transmissionMode: 'automatic' | 'manual' = 'automatic'
  private currentGear: number = 0  // -1=R, 0=N, 1-5=forward gears
  private rpm: number = 800  // Engine RPM for sound/visual

  // Gear configuration: [maxSpeed m/s, accelMultiplier]
  private static readonly GEAR_TABLE: Array<[number, number]> = [
    [0, 0],        // N (neutral) - no drive
    [8, 1.8],      // 1st: max ~29 km/h, high torque
    [16, 1.4],     // 2nd: max ~58 km/h
    [25, 1.1],     // 3rd: max ~90 km/h
    [33, 0.85],    // 4th: max ~119 km/h
    [40, 0.7],     // 5th: max ~144 km/h (top gear)
  ]
  private static readonly REVERSE_MAX_SPEED = 12  // m/s (~43 km/h)
  private static readonly REVERSE_ACCEL_MULT = 1.2
  private static readonly AUTO_UPSHIFT_RPM = 0.85    // shift up at 85% of gear's max speed
  private static readonly AUTO_DOWNSHIFT_RPM = 0.35  // shift down at 35% of gear's max speed
  private static readonly MAX_GEAR = 5
  private static readonly SHIFT_COOLDOWN = 0.3  // seconds between auto shifts
  private autoShiftTimer: number = 0

  // Collision callback
  private onCollisionCallback: ((impactVelocity: number) => void) | null = null

  constructor(config?: Partial<CarPhysicsConfig>) {
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config }
  }

  /**
   * Set callback for collision events
   * @param callback Function called with impact velocity when collision occurs
   */
  onCollision(callback: (impactVelocity: number) => void): void {
    this.onCollisionCallback = callback
  }

  /**
   * Initialize heading from mesh rotation
   */
  initFromMesh(mesh: AbstractMesh): void {
    if (mesh.rotationQuaternion) {
      const euler = mesh.rotationQuaternion.toEulerAngles()
      this.heading = euler.y
    } else {
      this.heading = mesh.rotation.y
    }
  }

  /**
   * Set reference to map for collision detection
   */
  setMap(map: SimpleMap): void {
    this.map = map
  }

  /**
   * Update physics configuration
   */
  updateConfig(config: Partial<CarPhysicsConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current physics configuration
   */
  getConfig(): CarPhysicsConfig {
    return { ...this.config }
  }

  /**
   * Main physics update
   * @param dt Delta time in seconds
   * @param input Current input state
   * @param mesh Car mesh for position updates
   * @returns Updated turn rate for camera calculations
   */
  update(dt: number, input: CarInputState, mesh: AbstractMesh): number {
    // Clamp deltaTime for stability
    const clampedDt = Math.min(dt, 0.05)
    
    // Update auto-shift timer
    this.autoShiftTimer = Math.max(0, this.autoShiftTimer - clampedDt)
    
    // Get direction vectors
    const forward = this.getForwardVector()
    const right = this.getRightVector()
    
    // Decompose world velocity into local components
    this.forwardVelocity = Vector3.Dot(this.velocity, forward)
    this.lateralVelocity = Vector3.Dot(this.velocity, right)
    
    // Calculate slip angle and drift detection
    const speed = this.velocity.length()
    this.updateDriftState(speed)
    
    // Auto transmission logic
    if (this.transmissionMode === 'automatic') {
      this.updateAutoTransmission(input, speed)
    }
    
    // Update RPM estimation
    this.updateRPM()
    
    // Calculate forces
    const longitudinalForce = this.calculateLongitudinalForce(input, speed)
    const turnRate = this.calculateTurnRate(input, clampedDt)
    const lateralForce = this.calculateLateralForce(input)
    
    // Apply forces
    this.applyForces(clampedDt, longitudinalForce, lateralForce, turnRate, speed)
    
    // Update position with collision
    this.updatePosition(clampedDt, mesh)
    
    // Update body dynamics
    this.updateBodyDynamics(clampedDt, turnRate, input)
    
    // Apply rotation to mesh
    mesh.rotation.y = this.heading
    mesh.rotation.z = this.bodyRoll
    mesh.rotation.x = this.bodyPitch
    
    return turnRate
  }

  /**
   * Update drift detection state
   * This is ONLY for visual feedback (body roll, effects, UI)
   * NOT used to change physics behavior - physics is purely grip-based
   */
  private updateDriftState(speed: number): void {
    if (speed > 0.5) {
      // Slip angle = angle between velocity direction and car heading
      this.slipAngle = Math.atan2(this.lateralVelocity, Math.abs(this.forwardVelocity) + 0.1)
      
      // Simple detection: significant lateral velocity = drifting (for visual purposes)
      this.isDrifting = Math.abs(this.lateralVelocity) > 3 && speed > this.config.driftMinSpeed
    } else {
      this.slipAngle = 0
      this.isDrifting = false
    }
  }

  /**
   * Calculate longitudinal (forward/backward) force
   * Now respects gear system - force depends on current gear
   */
  private calculateLongitudinalForce(input: CarInputState, speed: number): number {
    let force = 0
    
    const gear = this.currentGear

    // === NEUTRAL (gear 0) - no drive force ===
    if (gear === 0) {
      // No throttle drive in neutral, only braking / engine braking
      if (input.brake && Math.abs(this.forwardVelocity) > 0.1) {
        force = -Math.sign(this.forwardVelocity) * this.config.brakeForce
      }
      if (!input.brake && Math.abs(this.forwardVelocity) > 0.5) {
        force = -Math.sign(this.forwardVelocity) * this.config.engineBraking
      }
      // Resistance forces
      if (Math.abs(this.forwardVelocity) > 0.1) {
        const rollingResistance = this.config.rollingResistance * this.config.mass * Math.abs(this.forwardVelocity)
        const airDrag = 0.5 * this.config.airDragCoefficient * speed * speed
        const resistanceForce = (rollingResistance + airDrag) * Math.sign(this.forwardVelocity)
        force -= resistanceForce / this.config.mass
      }
      return force
    }

    // === REVERSE (gear -1) ===
    if (gear === -1) {
      // Determine the "go backward" input based on transmission mode
      // Manual: W (throttle>0) = go backward in R, S = brake
      // Automatic: S (throttle<0) = go backward in R, W = brake/switch to forward
      const wantsReverse = this.transmissionMode === 'manual'
        ? input.throttle > 0
        : input.throttle < 0
      const wantsBrake = this.transmissionMode === 'manual'
        ? input.throttle < 0
        : input.throttle > 0

      if (wantsReverse) {
        const absThrottle = Math.abs(input.throttle)
        if (this.forwardVelocity > 0.5) {
          // Still rolling forward - brake first
          force = -this.config.brakeForce
        } else if (this.forwardVelocity > -CarPhysics.REVERSE_MAX_SPEED) {
          const powerFactor = 1 - Math.pow(Math.abs(this.forwardVelocity) / CarPhysics.REVERSE_MAX_SPEED, 2) * 0.6
          force = -this.config.reverseAcceleration * CarPhysics.REVERSE_ACCEL_MULT * powerFactor * absThrottle
        }
      } else if (wantsBrake) {
        // Opposite key in reverse gear = brake
        if (Math.abs(this.forwardVelocity) > 0.1) {
          force = -Math.sign(this.forwardVelocity) * this.config.brakeForce
        }
      }

      // Brake pedal
      if (input.brake && Math.abs(this.forwardVelocity) > 0.1) {
        force = -Math.sign(this.forwardVelocity) * this.config.brakeForce
      }

      // Engine braking in reverse
      if (input.throttle === 0 && !input.brake && Math.abs(this.forwardVelocity) > 0.5) {
        force = -Math.sign(this.forwardVelocity) * this.config.engineBraking
      }

      // Resistance
      if (Math.abs(this.forwardVelocity) > 0.1) {
        const rollingResistance = this.config.rollingResistance * this.config.mass * Math.abs(this.forwardVelocity)
        const airDrag = 0.5 * this.config.airDragCoefficient * speed * speed
        const resistanceForce = (rollingResistance + airDrag) * Math.sign(this.forwardVelocity)
        force -= resistanceForce / this.config.mass
      }
      return force
    }

    // === FORWARD GEARS (1-5) ===
    const gearMaxSpeed = this.getGearMaxSpeed(gear)
    const accelMult = CarPhysics.GEAR_TABLE[gear][1]
    
    // Throttle
    if (input.throttle > 0) {
      if (this.forwardVelocity < 0) {
        // Braking if moving backward
        force = this.config.brakeForce
      } else if (this.forwardVelocity < gearMaxSpeed) {
        // Accelerate with power curve limited by gear
        const gearRatio = this.forwardVelocity / gearMaxSpeed
        const powerFactor = 1 - Math.pow(gearRatio, 2) * 0.6
        force = this.config.acceleration * accelMult * powerFactor * input.throttle
      }
      // If speed exceeds gear max, no more acceleration (hitting rev limiter)
    } else if (input.throttle < 0) {
      // In automatic: S = reverse/brake. In manual forward gear: S = brake only
      if (this.transmissionMode === 'automatic') {
        if (this.forwardVelocity > 0.5) {
          force = -this.config.brakeForce
        } else if (this.forwardVelocity > -this.config.reverseMaxSpeed) {
          force = this.config.reverseAcceleration * input.throttle
        }
      } else {
        // Manual mode, forward gear: S = brake only (must switch to R to reverse)
        if (Math.abs(this.forwardVelocity) > 0.1) {
          force = -Math.sign(this.forwardVelocity) * this.config.brakeForce
        }
      }
    }
    
    // Brake pedal
    if (input.brake && Math.abs(this.forwardVelocity) > 0.1) {
      force = -Math.sign(this.forwardVelocity) * this.config.brakeForce
    }
    
    // Engine braking
    if (input.throttle === 0 && !input.brake && Math.abs(this.forwardVelocity) > 0.5) {
      force = -Math.sign(this.forwardVelocity) * this.config.engineBraking
    }
    
    // Resistance forces
    if (Math.abs(this.forwardVelocity) > 0.1) {
      const rollingResistance = this.config.rollingResistance * this.config.mass * Math.abs(this.forwardVelocity)
      const airDrag = 0.5 * this.config.airDragCoefficient * speed * speed
      const resistanceForce = (rollingResistance + airDrag) * Math.sign(this.forwardVelocity)
      force -= resistanceForce / this.config.mass
    }
    
    return force
  }

  /**
   * Calculate turn rate based on steering input
   * Simple and always responsive - no drift mode dependency
   */
  private calculateTurnRate(input: CarInputState, dt: number): number {
    // Update steering angle with smooth response
    this.targetSteerAngle = input.steering * this.config.maxSteerAngle
    const steerDiff = this.targetSteerAngle - this.steerAngle
    this.steerAngle += steerDiff * Math.min(1, this.config.steeringSpeed * dt * 10)
    
    // Calculate turn rate based on bicycle model
    let turnRate = 0
    const minSpeedForTurn = 0.5
    const speed = this.velocity.length()
    
    if (Math.abs(this.forwardVelocity) > minSpeedForTurn) {
      const effectiveRadius = this.config.turnRadius + Math.abs(this.forwardVelocity) * 0.15
      turnRate = (this.forwardVelocity / effectiveRadius) * Math.tan(this.steerAngle)
    }
    
    // Slight reduction at very high speed
    if (speed > 40) {
      turnRate *= Math.max(0.7, 1 - (speed - 40) / 150)
    }
    
    // Add slip angle influence - creates natural drift rotation
    // This is proportional to how much the car is sliding
    if (Math.abs(this.lateralVelocity) > 1) {
      const slipInfluence = this.slipAngle * 0.8 * Math.sign(this.forwardVelocity)
      turnRate += slipInfluence
    }
    
    return turnRate
  }

  /**
   * Calculate lateral (sideways) force based on grip
   * NATURAL TIRE PHYSICS - no drift mode, just grip levels
   * Lower grip = more slide, higher grip = less slide
   */
  private calculateLateralForce(input: CarInputState): number {
    const speed = this.velocity.length()
    const steerRatio = Math.abs(this.steerAngle) / this.config.maxSteerAngle
    
    // Base grip - this is the tire's natural grip level
    let grip = this.config.gripRear // Use rear grip as base (RWD feel)
    
    // === NATURAL GRIP REDUCTION ===
    // These conditions reduce grip naturally, creating slide
    
    // 1. Speed reduces grip gradually (tires have limits)
    if (speed > 10) {
      const speedFactor = Math.min(0.5, (speed - 10) / 80)
      grip *= (1 - speedFactor)
    }
    
    // 2. Sharp steering at speed = centrifugal force exceeds grip
    if (steerRatio > 0.2 && speed > 8) {
      const turnForce = steerRatio * speed * 0.008
      grip *= Math.max(0.2, 1 - turnForce)
    }
    
    // 3. Braking while turning = weight transfer, rear gets light
    if (input.brake && steerRatio > 0.1 && speed > 5) {
      grip *= Math.max(0.15, 1 - this.config.brakeTurnGripLoss * steerRatio)
    }
    
    // 4. Throttle while turning = power oversteer
    if (input.throttle > 0.5 && steerRatio > 0.2 && speed > 5) {
      const powerLoss = input.throttle * steerRatio * 0.4
      grip *= Math.max(0.25, 1 - powerLoss)
    }
    
    // Clamp grip
    grip = Math.max(0.1, Math.min(1, grip))
    
    // === LATERAL FORCE ===
    // This force pulls the car back to its heading direction
    // Higher grip = stronger pull = less slide
    // Lower grip = weaker pull = more slide
    
    const lateralForce = this.lateralVelocity * grip * 6
    
    return lateralForce
  }

  /**
   * Apply calculated forces to velocity
   * KEY INSIGHT: Velocity exists in WORLD space and has inertia!
   * When the car turns, velocity doesn't instantly follow - grip must redirect it.
   */
  private applyForces(
    dt: number, 
    longitudinalForce: number, 
    lateralForce: number, 
    turnRate: number,
    speed: number
  ): void {
    // Update heading (car body rotation)
    // REAR-WHEEL STEERING (scoped): jika config.steerPivotOffset != 0, rotasi
    // body dilakukan di sekitar titik pivot bergeser dari pusat mesh (forklift =
    // pivot di poros belakang). Origin digeser tiap frame agar front berayun dan
    // tail tidak ikut menggeser — menghasilkan feel forklift, bukan mobil biasa.
    const rightBefore = this.getRightVector()
    const pivotOffset = this.config.steerPivotOffset ?? 0
    const dHeading = turnRate * dt
    this.heading += dHeading

    if (pivotOffset !== 0 && Math.abs(dHeading) > 1e-5) {
      this.pivotDisplacement = rightBefore.scale(-pivotOffset * dHeading)
    } else {
      this.pivotDisplacement = Vector3.Zero()
    }
    
    // Get new direction vectors AFTER heading change
    const newForward = this.getForwardVector()
    const newRight = this.getRightVector()
    
    // === CRITICAL PHYSICS: Momentum-based velocity handling ===
    // The velocity exists in WORLD space. When the car rotates,
    // the velocity doesn't magically follow - tires must redirect it.
    
    // Decompose current world velocity into the NEW car frame
    // This is where the magic happens - if car turned but velocity didn't,
    // we now have lateral velocity (sliding!)
    const newForwardVel = Vector3.Dot(this.velocity, newForward)
    const newLateralVel = Vector3.Dot(this.velocity, newRight)
    
    // Apply longitudinal force (acceleration/braking) in forward direction
    this.forwardVelocity = newForwardVel + longitudinalForce * dt
    
    // Lateral velocity handling - THIS IS WHERE DRIFT HAPPENS
    // lateralForce tries to eliminate lateral velocity (grip)
    // Low grip = can't eliminate lateral velocity = SLIDING
    this.lateralVelocity = newLateralVel - lateralForce * dt
    
    // === LATERAL FRICTION ===
    // Natural tire friction - always the same, no mode switching
    // This gradually reduces lateral velocity (sliding stops naturally)
    const lateralFriction = 0.92 // Consistent friction
    this.lateralVelocity *= lateralFriction
    
    // Clamp lateral velocity based on speed
    const maxLateralVelocity = Math.max(5, Math.abs(this.forwardVelocity) * 0.8)
    this.lateralVelocity = Math.max(-maxLateralVelocity, Math.min(maxLateralVelocity, this.lateralVelocity))
    
    // Reconstruct world velocity from local components
    this.velocity = newForward.scale(this.forwardVelocity).add(newRight.scale(this.lateralVelocity))
    
    // Come to complete stop when very slow
    if (speed < 0.3 && Math.abs(longitudinalForce) < 0.1) {
      this.velocity = this.velocity.scale(0.9)
      this.forwardVelocity *= 0.9
      this.lateralVelocity *= 0.9
      
      if (speed < 0.05) {
        this.velocity = Vector3.Zero()
        this.forwardVelocity = 0
        this.lateralVelocity = 0
      }
    }
  }

  /**
   * Update position with gravity and collision
   */
  private updatePosition(dt: number, mesh: AbstractMesh): void {
    // Gravity
    if (!this.isGrounded) {
      this.verticalVelocity += this.config.gravity * dt
    }
    
    // Calculate movement
    const movement = new Vector3(
      this.velocity.x * dt,
      this.verticalVelocity * dt,
      this.velocity.z * dt
    )
    // Use world position for physics (works for both parented and non-parented meshes)
    const worldPos = mesh.getAbsolutePosition()
    let newPosition = worldPos.add(movement)

    // Pergeseran pivot (rear-wheel steering forklift) — bagian dari gerakan fisik
    if (this.pivotDisplacement.lengthSquared() > 1e-12) {
      newPosition = newPosition.add(this.pivotDisplacement)
    }
    
    // Check collision with map
    if (this.map) {
      const collision = this.map.checkCollision(newPosition, this.config.collisionRadius)
      if (collision.collided) {
        newPosition = newPosition.add(collision.normal.scale(collision.penetration))
        
        const velocityDot = Vector3.Dot(this.velocity, collision.normal)
        if (velocityDot < 0) {
          // Calculate impact velocity (negative velocityDot = approaching collision)
          const impactVelocity = Math.abs(velocityDot)
          
          // Trigger collision callback for crash sound
          if (this.onCollisionCallback) {
            this.onCollisionCallback(impactVelocity)
          }
          
          const reflection = collision.normal.scale(velocityDot * this.config.collisionBounciness)
          this.velocity = this.velocity.subtract(reflection)
          this.velocity = this.velocity.scale(this.config.collisionDamping)
          this.forwardVelocity *= this.config.collisionDamping
          this.lateralVelocity *= this.config.collisionDamping
        }
      }
    }
    
    // Ground collision
    if (newPosition.y <= 0) {
      newPosition.y = 0
      this.verticalVelocity = 0
      this.isGrounded = true
    } else {
      this.isGrounded = false
    }
    
    // Write position: if mesh has a TransformNode parent (axis correction wrapper),
    // write to parent position (world space). Otherwise write to mesh directly.
    if (mesh.parent instanceof TransformNode) {
      mesh.parent.position = newPosition
    } else {
      mesh.position = newPosition
    }
  }

  /**
   * Update body roll and pitch for visual feedback
   */
  private updateBodyDynamics(dt: number, turnRate: number, input: CarInputState): void {
    const lateralG = turnRate * Math.abs(this.forwardVelocity) / 9.81
    const longitudinalG = (input.throttle !== 0 || input.brake) ? 
      (input.throttle * this.config.acceleration - (input.brake ? this.config.brakeForce : 0)) / 9.81 : 0
    
    const targetRoll = lateralG * this.config.bodyRollFactor
    const targetPitch = -longitudinalG * this.config.bodyPitchFactor * 0.3
    
    const response = this.config.suspensionStiffness * dt
    this.bodyRoll += (targetRoll - this.bodyRoll) * Math.min(1, response)
    this.bodyPitch += (targetPitch - this.bodyPitch) * Math.min(1, response)
    
    this.bodyRoll = Math.max(-0.15, Math.min(0.15, this.bodyRoll))
    this.bodyPitch = Math.max(-0.1, Math.min(0.1, this.bodyPitch))
  }

  /**
   * Get forward direction vector
   */
  private getForwardVector(): Vector3 {
    return new Vector3(Math.sin(this.heading), 0, Math.cos(this.heading))
  }

  /**
   * Get right direction vector
   */
  private getRightVector(): Vector3 {
    return new Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading))
  }

  // === PUBLIC GETTERS ===

  getSpeed(): number {
    return this.velocity.length()
  }

  getSpeedKmh(): number {
    return Math.round(this.velocity.length() * 3.6)
  }

  getForwardSpeed(): number {
    return this.forwardVelocity
  }

  getIsDrifting(): boolean {
    return this.isDrifting
  }

  getSlipAngle(): number {
    return this.slipAngle * (180 / Math.PI)
  }

  getSteerAngle(): number {
    return this.steerAngle * (180 / Math.PI)
  }

  /** Sudut steering dalam radian (untuk visual rear-wheel steering). */
  getSteerAngleRad(): number {
    return this.steerAngle
  }

  getIsGrounded(): boolean {
    return this.isGrounded
  }

  getHeading(): number {
    return this.heading
  }

  getCurrentGear(): number {
    return this.currentGear
  }

  getTransmissionMode(): 'automatic' | 'manual' {
    return this.transmissionMode
  }

  getRPM(): number {
    return this.rpm
  }

  getPhysicsInfo(): PhysicsInfo {
    return {
      speed: this.getSpeed(),
      speedKmh: this.getSpeedKmh(),
      forwardSpeed: this.forwardVelocity,
      isDrifting: this.isDrifting,
      slipAngle: this.getSlipAngle(),
      steerAngle: this.getSteerAngle(),
      isGrounded: this.isGrounded,
    }
  }

  // === TRANSMISSION CONTROL ===

  /**
   * Toggle between automatic and manual transmission
   */
  toggleTransmissionMode(): 'automatic' | 'manual' {
    this.transmissionMode = this.transmissionMode === 'automatic' ? 'manual' : 'automatic'
    console.log(`[CarPhysics] Transmission: ${this.transmissionMode}`)
    // When switching to manual, keep current gear
    // When switching to automatic, let auto-shift take over
    return this.transmissionMode
  }

  /**
   * Shift up one gear (manual mode)
   */
  shiftUp(): number {
    if (this.transmissionMode !== 'manual') return this.currentGear
    
    if (this.currentGear < CarPhysics.MAX_GEAR) {
      this.currentGear++
      console.log(`[CarPhysics] Shift up → Gear ${this.getGearName()}`)
    }
    return this.currentGear
  }

  /**
   * Shift down one gear (manual mode) 
   * Goes from 1 → N(0) → R(-1)
   */
  shiftDown(): number {
    if (this.transmissionMode !== 'manual') return this.currentGear
    
    if (this.currentGear > -1) {
      this.currentGear--
      console.log(`[CarPhysics] Shift down → Gear ${this.getGearName()}`)
    }
    return this.currentGear
  }

  /**
   * Get gear display name
   */
  getGearName(): string {
    if (this.currentGear === -1) return 'R'
    if (this.currentGear === 0) return 'N'
    return `${this.currentGear}`
  }

  /**
   * Automatic transmission logic
   */
  private updateAutoTransmission(input: CarInputState, speed: number): void {
    const absForwardSpeed = Math.abs(this.forwardVelocity)

    // === REVERSE: pressing S when stopped or very slow ===
    if (input.throttle < 0 && this.forwardVelocity <= 0.5) {
      if (this.currentGear !== -1) {
        this.currentGear = -1
        // No cooldown for entering reverse from stop – instant response
      }
      return
    }

    // === FORWARD: pressing W ===
    if (input.throttle > 0) {
      // From reverse/neutral → 1st instantly (no cooldown for this essential shift)
      if (this.currentGear <= 0) {
        this.currentGear = 1
        return
      }

      // Gear-to-gear shifts respect cooldown
      if (this.autoShiftTimer > 0) return

      // Upshift: when speed exceeds threshold of current gear
      if (this.currentGear < CarPhysics.MAX_GEAR) {
        const gearMax = this.getGearMaxSpeed(this.currentGear)
        if (absForwardSpeed > gearMax * CarPhysics.AUTO_UPSHIFT_RPM) {
          this.currentGear++
          this.autoShiftTimer = CarPhysics.SHIFT_COOLDOWN
          return
        }
      }

      // Downshift: when speed drops below threshold
      if (this.currentGear > 1) {
        const lowerGearMax = this.getGearMaxSpeed(this.currentGear - 1)
        if (absForwardSpeed < lowerGearMax * CarPhysics.AUTO_DOWNSHIFT_RPM) {
          this.currentGear--
          this.autoShiftTimer = CarPhysics.SHIFT_COOLDOWN
          return
        }
      }
    }

    // No throttle, fully stopped → neutral (only when truly stopped)
    if (input.throttle === 0 && !input.brake && absForwardSpeed < 0.3 && this.currentGear !== 0) {
      this.currentGear = 0
    }
  }

  /**
   * Estimate RPM from speed and current gear (for UI/audio)
   */
  private updateRPM(): void {
    const idleRPM = 800
    const maxRPM = 7000
    const absSpeed = Math.abs(this.forwardVelocity)

    if (this.currentGear === 0) {
      this.rpm = idleRPM
      return
    }

    if (this.currentGear === -1) {
      const ratio = Math.min(1, absSpeed / CarPhysics.REVERSE_MAX_SPEED)
      this.rpm = idleRPM + (maxRPM - idleRPM) * ratio
      return
    }

    const [gearMaxRaw] = CarPhysics.GEAR_TABLE[this.currentGear]
    const gearMax = gearMaxRaw * (this.config.gearMaxSpeedScale ?? 1)
    const ratio = Math.min(1, absSpeed / Math.max(0.1, gearMax))
    this.rpm = idleRPM + (maxRPM - idleRPM) * ratio
  }

  /**
   * Kecepatan maksimum per gigi (sudah memperhitungkan gearMaxSpeedScale).
   */
  private getGearMaxSpeed(gear: number): number {
    return CarPhysics.GEAR_TABLE[gear][0] * (this.config.gearMaxSpeedScale ?? 1)
  }

  /**
   * Reset physics state
   */
  reset(): void {
    this.velocity = Vector3.Zero()
    this.forwardVelocity = 0
    this.lateralVelocity = 0
    this.steerAngle = 0
    this.targetSteerAngle = 0
    this.verticalVelocity = 0
    this.isGrounded = true
    this.isDrifting = false
    this.slipAngle = 0
    this.bodyRoll = 0
    this.bodyPitch = 0
    this.pivotDisplacement = Vector3.Zero()
    this.currentGear = 0
    this.rpm = 800
    this.autoShiftTimer = 0
  }
}
