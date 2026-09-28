import { create } from 'zustand'

interface AircraftStoreState {
  throttle: number      // 0-1
  speed: number         // km/h
  altitude: number      // m
  pitch: number         // degrees
  roll: number          // degrees
  yaw: number           // degrees
  engineRunning: boolean
  isAirborne: boolean
  cameraMode: 'chase' | 'cockpit'
  
  setThrottle: (val: number) => void
  setSpeed: (val: number) => void
  setAltitude: (val: number) => void
  setPitch: (val: number) => void
  setRoll: (val: number) => void
  setYaw: (val: number) => void
  setEngineRunning: (val: boolean) => void
  setIsAirborne: (val: boolean) => void
  setCameraMode: (val: 'chase' | 'cockpit') => void
}

export const useAircraftStore = create<AircraftStoreState>((set) => ({
  throttle: 0,
  speed: 0,
  altitude: 0,
  pitch: 0,
  roll: 0,
  yaw: 0,
  engineRunning: false,
  isAirborne: false,
  cameraMode: 'chase',

  setThrottle: (throttle) => set({ throttle }),
  setSpeed: (speed) => set({ speed }),
  setAltitude: (altitude) => set({ altitude }),
  setPitch: (pitch) => set({ pitch }),
  setRoll: (roll) => set({ roll }),
  setYaw: (yaw) => set({ yaw }),
  setEngineRunning: (engineRunning) => set({ engineRunning }),
  setIsAirborne: (isAirborne) => set({ isAirborne }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
}))
