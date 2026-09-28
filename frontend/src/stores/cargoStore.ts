import { create } from 'zustand'

/**
 * Cargo Store (khusus map forklift-testing)
 * ==========================================
 * Progress CARGO DELIVERY (X/12) — TERPISAH dari POINT pelanggaran.
 * Point pelanggaran tetap di violationStore (collision = 10 poin, dll) dan
 * TIDAK diubah oleh store ini. Store ini hanya cermin progress cargo dari
 * ForkliftCargoTest → dipakai HUD progress & MISSION COMPLETE.
 */

const CARGO_TOTAL = 12

interface CargoStoreState {
  delivered: number
  total: number
  isMissionComplete: boolean

  setProgress: (delivered: number, total: number, isMissionComplete: boolean) => void
  resetCargo: () => void
}

export const useCargoStore = create<CargoStoreState>((set) => ({
  delivered: 0,
  total: CARGO_TOTAL,
  isMissionComplete: false,

  setProgress: (delivered, total, isMissionComplete) =>
    set({ delivered, total, isMissionComplete }),

  resetCargo: () =>
    set({ delivered: 0, total: CARGO_TOTAL, isMissionComplete: false }),
}))