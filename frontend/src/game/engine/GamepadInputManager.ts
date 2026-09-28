import type { CarInputState } from '../types'

export type WheelAction = 'engine' | 'camera' | 'horn' | 'dropCargo' | 'forkUp' | 'forkDown' | 'tiltForward' | 'tiltBackward'

export interface WheelSettings {
  deadZone: number
  steeringAxis: number
  throttleAxis: number
  brakeAxis: number
  invertSteering: boolean
  invertThrottle: boolean
  invertBrake: boolean
  throttleRest: number
  throttlePressed: number
  brakeRest: number
  brakePressed: number
  throttleCalibrated: boolean
  brakeCalibrated: boolean
  buttons: Record<WheelAction, number>
}

// v5 adds R2 cargo drop while retaining brake-pedal reverse.
const STORAGE_KEY = 'fumorive-wheel-settings-v5'
const DEFAULT_SETTINGS: WheelSettings = {
  deadZone: 0.05,
  steeringAxis: 0,
  throttleAxis: 1,
  brakeAxis: 2,
  invertSteering: false,
  invertThrottle: false,
  invertBrake: false,
  // Safety first: never accelerate until the actual released and pressed
  // positions of a generic pedal have both been captured.
  throttleRest: 0,
  throttlePressed: 1,
  brakeRest: 0,
  brakePressed: 1,
  throttleCalibrated: false,
  brakeCalibrated: false,
  // Standard Gamepad API face buttons: 0=×, 1=○, 2=□, 3=△.
  // Face buttons are reserved for forklift actions; shoulder buttons run vehicle actions.
  buttons: { engine: 4, camera: 5, horn: 6, dropCargo: 7, forkUp: 3, forkDown: 2, tiltForward: 0, tiltBackward: 1 },
}

/** Browser-only adapter for USB wheels, pedals and button boxes. */
export class GamepadInputManager {
  private settings: WheelSettings
  private previousButtons: boolean[] = []
  private activeDeviceId: string | null = null
  private pedalRestSamples: Partial<Record<'throttle' | 'brake', number[]>> = {}

  constructor() {
    this.settings = this.loadSettings('default')
  }

  private storageKey(deviceId: string): string { return `${STORAGE_KEY}:${encodeURIComponent(deviceId)}` }
  private loadSettings(deviceId: string): WheelSettings {
    try {
      const saved = localStorage.getItem(this.storageKey(deviceId)) ?? (deviceId === 'default' ? localStorage.getItem(STORAGE_KEY) : null)
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved), buttons: { ...DEFAULT_SETTINGS.buttons, ...JSON.parse(saved).buttons } }
    } catch { /* localStorage may be unavailable in private contexts */ }
    return { ...DEFAULT_SETTINGS, buttons: { ...DEFAULT_SETTINGS.buttons } }
  }

  getSettings(): WheelSettings { return this.settings }
  saveSettings(next: Partial<WheelSettings>): void {
    this.settings = { ...this.settings, ...next, buttons: { ...this.settings.buttons, ...next.buttons } }
    try { localStorage.setItem(this.storageKey(this.activeDeviceId ?? 'default'), JSON.stringify(this.settings)) } catch { /* non-critical */ }
  }
  /** Capture pedal positions while all pedals are released. */
  capturePedalRest(kind: 'throttle' | 'brake'): boolean {
    const pad = this.getGamepad()
    if (!pad) return false
    this.pedalRestSamples[kind] = [...pad.axes]
    return true
  }

  /** Call while a pedal is held fully down, after capturePedalRest(). */
  detectPedalAxis(kind: 'throttle' | 'brake'): boolean {
    const pad = this.getGamepad()
    const restAxes = this.pedalRestSamples[kind]
    if (!pad || !restAxes) return false
    if (pad.id !== this.activeDeviceId) {
      this.activeDeviceId = pad.id
      this.settings = this.loadSettings(pad.id)
    }
    let axis = -1
    let magnitude = 0.15
    pad.axes.forEach((value, index) => {
      if (index === this.settings.steeringAxis) return
      const change = Math.abs(value - (restAxes[index] ?? 0))
      if (change > magnitude) { axis = index; magnitude = change }
    })
    if (axis < 0) return false
    const raw = pad.axes[axis]
    const rest = restAxes[axis] ?? 0
    this.saveSettings(kind === 'throttle'
      ? { throttleAxis: axis, throttleRest: rest, throttlePressed: raw, throttleCalibrated: true }
      : { brakeAxis: axis, brakeRest: rest, brakePressed: raw, brakeCalibrated: true })
    delete this.pedalRestSamples[kind]
    return true
  }
  isSupported(): boolean { return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' }
  getGamepad(): Gamepad | null {
    if (!this.isSupported()) return null
    return Array.from(navigator.getGamepads()).find((pad): pad is Gamepad => pad !== null) ?? null
  }
  isConnected(): boolean { return this.getGamepad() !== null }

  /** Returns normalized driving input and edge-triggered button actions. */
  read(): { input: CarInputState; brakeAmount: number; actions: Set<WheelAction>; heldActions: Set<WheelAction> } | null {
    const pad = this.getGamepad()
    if (!pad) { this.previousButtons = []; return null }
    if (pad.id !== this.activeDeviceId) {
      this.activeDeviceId = pad.id
      this.settings = this.loadSettings(pad.id)
      this.previousButtons = []
    }
    const axis = (index: number) => pad.axes[index] ?? 0
    const steering = this.applyDeadZone(axis(this.settings.steeringAxis), this.settings.invertSteering)
    const pedal = (index: number, rest: number, pressed: number, calibrated: boolean) => {
      if (!calibrated || Math.abs(pressed - rest) < 0.02) return 0
      return Math.max(0, Math.min(1, (axis(index) - rest) / (pressed - rest)))
    }
    const actions = new Set<WheelAction>()
    const heldActions = new Set<WheelAction>()
    ;(Object.keys(this.settings.buttons) as WheelAction[]).forEach((action) => {
      const index = this.settings.buttons[action]
      const pressed = Boolean(pad.buttons[index]?.pressed || (pad.buttons[index]?.value ?? 0) > 0.5)
      if (pressed && !this.previousButtons[index]) actions.add(action)
      if (pressed) heldActions.add(action)
      this.previousButtons[index] = pressed
    })
    const throttle = pedal(this.settings.throttleAxis, this.settings.throttleRest, this.settings.throttlePressed, this.settings.throttleCalibrated)
    const brakeAmount = pedal(this.settings.brakeAxis, this.settings.brakeRest, this.settings.brakePressed, this.settings.brakeCalibrated)
    return { input: { steering, throttle, brake: brakeAmount > 0.08 }, brakeAmount, actions, heldActions }
  }

  private applyDeadZone(value: number, invert: boolean): number {
    const signed = invert ? -value : value
    if (Math.abs(signed) <= this.settings.deadZone) return 0
    return Math.max(-1, Math.min(1, (signed - Math.sign(signed) * this.settings.deadZone) / (1 - this.settings.deadZone)))
  }
}
