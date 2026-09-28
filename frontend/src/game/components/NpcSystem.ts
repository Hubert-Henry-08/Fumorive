/**
 * NpcSystem
 * =========
 * Runtime untuk fitur khusus map Ngawi City:
 *  - NPC pejalan kaki (prototype manusia) yang berjalan di trotoar &
 *    hanya menyeberang lewat zebra cross.
 *  - NPC kendaraan (mobil/motor) yang berjalan di jalur jalan.
 *  - Lampu lalu lintas (siklus merah → kuning → hijau).
 *
 * Pelanggaran yang terdeteksi DIINTEGRASIKAN ke sistem violation existing
 * (violationStore) - TIDAK membuat sistem point/alert baru.
 */

import { Scene, Vector3, Color3, AbstractMesh, MeshBuilder, PBRMaterial } from '@babylonjs/core'
import { IndonesiaMap } from './IndonesiaMap'
import type { PedestrianDef, PedestrianCrossing, NpcVehicleDef, TrafficLightDef } from './IndonesiaMap'
import { useViolationStore } from '../../stores/violationStore'

interface LivePedestrian {
  def: PedestrianDef
  root: AbstractMesh
  legL: AbstractMesh
  legR: AbstractMesh
  armL: AbstractMesh
  armR: AbstractMesh
  currentPoint: number
  progress: number
  distanceTravelled: number
  holding: boolean
}

interface LiveVehicle {
  def: NpcVehicleDef
  mesh: AbstractMesh
  x: number
  z: number
  heading: number
  travel: number
  currentPoint: number
  progress: number
  // ---- fisik/steering runtime (kinematic, khusus Ngawi) ----
  speed: number          // kecepatan aktual (m/s), diramp menuju target
  laneState: number      // 0 = lane normal, 1 = sedang menyapih/menyalip
  laneSide: number       // +1 / -1, sisi offset menyalip terhadap arah segmen
  laneRemain: number     // sisa jarak menyalip (m) sebelum kembali ke lane
  followFactor: number   // faktor lambat karena ada kendaraan di depan (0..1)
}

interface LiveTrafficLight {
  def: TrafficLightDef
  phase: number // 0=EW hijau, 1=EW kuning, 2=NS hijau, 3=NS kuning
  phaseTime: number
  redLockedFor: string[] // arah pendekat yang sudah tercatat melanggar (cooldown)
}

const PHASE_DURATION = 5 // detik tiap fase

export class NpcSystem {
  private scene: Scene
  private pedestrians: LivePedestrian[] = []
  private vehicles: LiveVehicle[] = []
  private trafficLights: LiveTrafficLight[] = []

  // ---- pelacakan posisi kendaraan utk deteksi lampu merah & pedestrian ----
  private prevCarX = 0
  private prevCarZ = 0
  private carInitialized = false
  private pedestrianHitCooldown = 0
  private playerSpeed = 0

  // ---- geometri jalan & obstacle statis (di-cache dari IndonesiaMap) ----
  private drivableRects: Array<{ x0: number; x1: number; z0: number; z1: number }> = []
  private staticBoxes: Array<{ minX: number; minZ: number; maxX: number; maxZ: number }> = []

  // ---- konstanta perilaku kendaraan (kinematic, khusus Ngawi) ----
  private readonly PASS_LATERAL = 2.6      // offset lateral saat menyapih/menyalip (m)
  private readonly OVERTAKE_DETECT = 20     // jarak deteksi kendaraan di depan (m)
  private readonly OVERTAKE_SAFE = 10       // jarak setelah melewati utk kembali ke lane (m)
  private readonly FOLLOW_MIN_DIST = 5.5    // jarak aman minimal (m) kalau tidak bisa menyalip
  private readonly CAR_RADIUS = 1.9         // radius lingkaran badan mobil utk collision
  private readonly TRUCK_RADIUS = 3.1       // radius lingkaran badan truk (2×, panjang 8m) utk collision
  private readonly MAX_STEP_PER_FRAME = 0.5 // kecepatan respon posisi (m/frame)
  private readonly STOP_REACT = 2.6         // jarak (m) sebelum stop line lampu merah utk berhenti

  constructor(scene: Scene) {
    this.scene = scene
  }

  init(map: IndonesiaMap): void {
    // Cache geometri jalan & obstacle statis utk collision kendaraan (khusus Ngawi).
    this.drivableRects = map.getDrivableRects()
    this.staticBoxes = map.getColliders().map((c) => ({
      minX: Math.min(c.min.x, c.max.x),
      maxX: Math.max(c.min.x, c.max.x),
      minZ: Math.min(c.min.z, c.max.z),
      maxZ: Math.max(c.min.z, c.max.z),
    }))
    for (const def of map.getPedestrians()) {
      const p = IndonesiaMap.createPedestrianMesh(this.scene, `ngawi_ped_${def.id}`, def.color)
      this.pedestrians.push({
        def,
        root: p.root,
        legL: p.legL,
        legR: p.legR,
        armL: p.armL,
        armR: p.armR,
        currentPoint: 0,
        progress: 0,
        distanceTravelled: 0,
        holding: false,
      })
    }

    for (const def of map.getNpcVehicles()) {
      let mesh: AbstractMesh
      if (def.type === 'truck') {
        mesh = this.createTruckMesh(`ngawi_npcv_${def.id}`, def.color)
      } else {
        mesh = this.createCarMesh(`ngawi_npcv_${def.id}`, def.color)
      }
      const start = def.waypoints[0] ?? { x: def.startX, z: def.startZ }
      mesh.position = new Vector3(start.x, 0, start.z)
      this.vehicles.push({
        def, mesh, x: start.x, z: start.z, heading: 0, travel: 0,
        currentPoint: 0, progress: 0,
        speed: 0, laneState: 0, laneSide: 1, laneRemain: 0, followFactor: 0,
      })
    }

    for (const def of map.getTrafficLights()) {
      this.trafficLights.push({
        def,
        phase: 0,
        phaseTime: 0,
        redLockedFor: [],
      })
    }

    console.log(
      `[NpcSystem] init ngawi-city: ${this.pedestrians.length} pedestrians, ${this.vehicles.length} vehicles, ${this.trafficLights.length} traffic lights`
    )
  }

  // ============================================
  // MESH FACTORIES
  // ============================================

  private createCarMesh(name: string, color: Color3): AbstractMesh {
    return this.createVehicleMesh(name, color, false)
  }

  private createTruckMesh(name: string, color: Color3): AbstractMesh {
    return this.createVehicleMesh(name, color, true)
  }

  private createVehicleMesh(name: string, color: Color3, isTruck: boolean): AbstractMesh {
    const group = MeshBuilder.CreateBox(`${name}_root`, { width: 0.1, height: 0.1, depth: 0.1 }, this.scene)
    group.isVisible = false

    if (isTruck) {
      // ── TRUK 2× MOBIL PEMANAIN ──────────────────────────────────────────
      // Mobil pemain = 2 (w) × 0.7 (h) × 4 (L), tinggi total ≈ 1.8 (tinggi kabin).
      // Truk dibuat TINGGI 2× (= 3.6) dan PANJANG 2× (= 8.0), lebar proporsional
      // (3.0 — tidak terlalu sempit/lebar), kabin & kargo proporsional, roda
      // menyentuh tanah (bawah roda y=0) tanpa melayang / tenggelam.
      const wheelR = 0.55 // jari-jari roda (ban bawah menyentuh tanah y=0)
      const chassisH = 0.45
      const chassisY = wheelR + chassisH / 2          // 0.775, bawah=0.55 di atas roda
      const cargoH = 2.6                              // puncak kargo = 3.6 (= 2×1.8)
      const cargoY = wheelR + chassisH + cargoH / 2   // 2.3, span 1.0..3.6

      // Sasis/badan (rangka rendah penuh 8m)
      const body = MeshBuilder.CreateBox(`${name}_body`, { width: 3.0, height: chassisH, depth: 8.0 }, this.scene)
      body.parent = group
      body.position = new Vector3(0, chassisY, 0)
      const bodyMat = new PBRMaterial(`${name}_bodym`, this.scene)
      bodyMat.albedoColor = color
      bodyMat.metallic = 0.5
      bodyMat.roughness = 0.5
      body.material = bodyMat

      // Kontainer/kargo (kotak besar di belakang)
      const cargo = MeshBuilder.CreateBox(`${name}_cargo`, { width: 2.9, height: cargoH, depth: 4.2 }, this.scene)
      cargo.parent = group
      cargo.position = new Vector3(0, cargoY, -1.7)
      const cargoMat = new PBRMaterial(`${name}_cargom`, this.scene)
      cargoMat.albedoColor = new Color3(0.92, 0.9, 0.85)
      cargoMat.metallic = 0.1
      cargoMat.roughness = 0.7
      cargo.material = cargoMat

      // Kabin lebih rendah & di depan (berdiri di atas sasis)
      const cabin = MeshBuilder.CreateBox(`${name}_cabin`, { width: 2.6, height: 1.9, depth: 2.2 }, this.scene)
      cabin.parent = group
      cabin.position = new Vector3(0, wheelR + chassisH + 1.9 / 2, 2.6)
      const cabinMat = new PBRMaterial(`${name}_cabinm`, this.scene)
      cabinMat.albedoColor = new Color3(0.15, 0.2, 0.3)
      cabinMat.metallic = 0.7
      cabinMat.roughness = 0.4
      cabin.material = cabinMat

      // 6 roda (2 depan + 4 belakang tandem) — bawah menyentuh tanah y=0
      const wheelMat = new PBRMaterial(`${name}_wheelm`, this.scene)
      wheelMat.albedoColor = new Color3(0.12, 0.12, 0.12)
      const wheelDia = wheelR * 2
      const wheelPos: Array<[number, number, number]> = [
        [1.35, 0, 2.6], [-1.35, 0, 2.6],
        [1.35, 0, -2.0], [-1.35, 0, -2.0],
        [1.35, 0, -3.2], [-1.35, 0, -3.2],
      ]
      for (let i = 0; i < wheelPos.length; i++) {
        const wheel = MeshBuilder.CreateCylinder(`${name}_wheel_${i}`, { diameter: wheelDia, height: 0.45, tessellation: 16 }, this.scene)
        wheel.parent = group
        wheel.rotation.x = Math.PI / 2
        wheel.position = new Vector3(wheelPos[i][0], wheelR, wheelPos[i][2])
        wheel.material = wheelMat
      }

      // Lampu depan & belakang
      const headMat = new PBRMaterial(`${name}_headm`, this.scene)
      headMat.albedoColor = new Color3(1, 1, 0.8)
      headMat.emissiveColor = new Color3(1, 1, 0.8)
      for (const dx of [2.1, 0, -2.1]) {
        const h = MeshBuilder.CreateBox(`${name}_head_${dx}`, { width: 0.3, height: 0.25, depth: 0.1 }, this.scene)
        h.parent = group
        h.position = new Vector3(dx, wheelR + 0.6, 4.0)
        h.material = headMat
      }
      const tailMat = new PBRMaterial(`${name}_tailm`, this.scene)
      tailMat.albedoColor = new Color3(0.9, 0.2, 0.2)
      tailMat.emissiveColor = new Color3(0.3, 0.05, 0.05)
      for (const dx of [2.1, 0, -2.1]) {
        const t = MeshBuilder.CreateBox(`${name}_tail_${dx}`, { width: 0.3, height: 0.2, depth: 0.08 }, this.scene)
        t.parent = group
        t.position = new Vector3(dx, wheelR + 0.5, -4.0)
        t.material = tailMat
      }
    } else {
      // Mobil biasa (existing)
      const body = MeshBuilder.CreateBox(`${name}_body`, { width: 2, height: 0.7, depth: 4 }, this.scene)
      body.parent = group
      body.position = new Vector3(0, 0.75, 0)
      const bodyMat = new PBRMaterial(`${name}_bodym`, this.scene)
      bodyMat.albedoColor = color
      bodyMat.metallic = 0.5
      bodyMat.roughness = 0.4
      body.material = bodyMat

      const cabin = MeshBuilder.CreateBox(`${name}_cabin`, { width: 1.7, height: 0.7, depth: 2.2 }, this.scene)
      cabin.parent = group
      cabin.position = new Vector3(0, 1.45, -0.2)
      const cabinMat = new PBRMaterial(`${name}_cabinm`, this.scene)
      cabinMat.albedoColor = new Color3(0.15, 0.2, 0.3)
      cabinMat.metallic = 0.7
      cabinMat.roughness = 0.4
      cabin.material = cabinMat

      const wheelMat = new PBRMaterial(`${name}_wheelm`, this.scene)
      wheelMat.albedoColor = new Color3(0.12, 0.12, 0.12)
      const wheelPos: Array<[number, number, number]> = [
        [1.0, 0, 1.3], [-1.0, 0, 1.3], [1.0, 0, -1.3], [-1.0, 0, -1.3],
      ]
      for (let i = 0; i < wheelPos.length; i++) {
        const wheel = MeshBuilder.CreateCylinder(`${name}_wheel_${i}`, { diameter: 0.75, height: 0.35, tessellation: 16 }, this.scene)
        wheel.parent = group
        wheel.rotation.x = Math.PI / 2
        wheel.position = new Vector3(wheelPos[i][0], 0.35, wheelPos[i][2])
        wheel.material = wheelMat
      }

      // Lampu depan & belakang sederhana
      const headMat = new PBRMaterial(`${name}_headm`, this.scene)
      headMat.albedoColor = new Color3(1, 1, 0.8)
      headMat.emissiveColor = new Color3(1, 1, 0.8)
      for (const dx of [0.8, -0.8]) {
        const h = MeshBuilder.CreateBox(`${name}_head_${dx}`, { width: 0.3, height: 0.25, depth: 0.1 }, this.scene)
        h.parent = group
        h.position = new Vector3(dx, 0.75, 2.05)
        h.material = headMat
      }
    }

    return group
  }

  // ============================================
  // LAMPU LALU LINTAS (siklus)
  // ============================================

  private updateTrafficLights(dt: number): void {
    for (const tl of this.trafficLights) {
      tl.phaseTime += dt
      if (tl.phaseTime >= PHASE_DURATION) {
        tl.phaseTime = 0
        tl.phase = (tl.phase + 1) % 4
        tl.redLockedFor = [] // reset cooldown penalti tiap ganti fase
      }

      const d = tl.def
      // EW fase 0 hijau, fase 1 kuning → merah saat fase 2 & 3
      const ewRedOn = tl.phase === 2 || tl.phase === 3
      const ewYellowOn = tl.phase === 1
      const ewGreenOn = tl.phase === 0
      const nsRedOn = tl.phase === 0 || tl.phase === 1
      const nsYellowOn = tl.phase === 3
      const nsGreenOn = tl.phase === 2

      // Nyala / mati lampu (semua tiang pada arah yang sama di-set sekali).
      // Nilai emissive tinggi utk lampu aktif, sangat rendah utk lampu mati.
      for (const m of d.ewRed) setLight(m, ewRedOn ? 3.0 : 0.06)
      for (const m of d.ewYellow) setLight(m, ewYellowOn ? 3.0 : 0.06)
      for (const m of d.ewGreen) setLight(m, ewGreenOn ? 3.0 : 0.06)
      for (const m of d.nsRed) setLight(m, nsRedOn ? 3.0 : 0.06)
      for (const m of d.nsYellow) setLight(m, nsYellowOn ? 3.0 : 0.06)
      for (const m of d.nsGreen) setLight(m, nsGreenOn ? 3.0 : 0.06)
    }
  }

  /** Deteksi pelanggaran lampu merah dengan menyeberangi stop line. */
  private checkRedLight(x: number, z: number): void {
    for (const tl of this.trafficLights) {
      const d = tl.def
      const ewRedOn = tl.phase === 2 || tl.phase === 3
      const nsRedOn = tl.phase === 0 || tl.phase === 1

      for (const stop of d.stops) {
        const isRed = stop.axis === 'EW' ? ewRedOn : nsRedOn
        if (!isRed) continue
        if (tl.redLockedFor.includes(`${tl.def.id}-${stop.dir}`)) continue

        // Deteksi penyeberangan garis stop (dari sebelum → sesudah), arah sesuai.
        if (crossedStop(this.prevCarX, this.prevCarZ, x, z, stop)) {
          tl.redLockedFor.push(`${tl.def.id}-${stop.dir}`)
          useViolationStore.getState().addViolation('red-light')
        }
      }
    }
  }

  // ============================================
  // PEJALAN KAKI
  // ============================================

  private updatePedestrians(dt: number): void {
    for (const p of this.pedestrians) {
      const pts = p.def.points
      if (pts.length < 2) continue

      const nextIndex = (p.currentPoint + 1) % pts.length
      const from = pts[p.currentPoint]
      const to = pts[nextIndex]
      const ax = to.x - from.x
      const az = to.z - from.z
      const segLen = Math.hypot(ax, az)
      if (segLen <= 0) continue

      // Posisi saat ini (sebelum progres frame ini) — dipakai utk penyeberangan zebra.
      const t0 = Math.min(0.9999, p.progress)
      const px0 = from.x + ax * t0
      const pz0 = from.z + az * t0

      // Perilaku penyeberangan zebra: berhenti di tepi, cek kendaraan, baru menyeberang.
      let advance = true
      const crossing = p.def.crossings?.find((c) => c.segIndex === p.currentPoint)
      if (crossing) {
        const crossFrom = crossing.axis === 'EW' ? from.z : from.x
        const crossTo = crossing.axis === 'EW' ? to.z : to.x
        const dir = Math.sign(crossTo - crossFrom)
        if (dir !== 0) {
          const coord = crossing.axis === 'EW' ? pz0 : px0
          const nearEdge = crossing.roadCenter - dir * crossing.half
          const farEdge = crossing.roadCenter + dir * crossing.half
          const pastFar = dir > 0 ? coord >= farEdge : coord <= farEdge
          if (!pastFar) {
            const atCurb = dir > 0 ? coord >= nearEdge - 0.05 : coord <= nearEdge + 0.05
            if (atCurb && this.crossingBlocked(crossing, px0, pz0)) advance = false
          }
        }
      }

      if (advance) {
        p.holding = false
        p.progress += (p.def.speed * dt) / segLen
      } else {
        p.holding = true
        // saat menunggu, tetap posisikan di titik berhenti (progress beku).
      }

      if (p.progress >= 1) {
        p.progress = 0
        p.currentPoint = nextIndex
        continue
      }

      const t = p.progress
      const px = from.x + ax * t
      const pz = from.z + az * t

      p.distanceTravelled += p.def.speed * dt
      const bob = p.holding ? 0 : Math.sin(p.distanceTravelled * 8) * 0.04

      // Root = pivot pinggul. Geometri kaki memanjang 0.3 ke bawah dari root,
      // sehingga agar ujung kaki menyentuh trotoar (~Y 0.02) root ~0.32.
      p.root.position = new Vector3(px, 0.32 + bob, pz)
      p.root.rotation.y = Math.atan2(ax, az)

      // Ayunan kaki & tangan (gerak berjalan)
      const step = p.holding ? 0 : Math.sin(p.distanceTravelled * 8)
      p.legL.rotation.x = step * 0.6
      p.legR.rotation.x = -step * 0.6
      p.armL.rotation.x = -step * 0.5
      p.armR.rotation.x = step * 0.5
      // Agak keluar sumbu untuk kesan alami
      p.legL.position.x = -0.12 + step * 0.08
      p.legR.position.x = 0.12 - step * 0.08
    }
  }

  /** Cek apakah ada kendaraan (NPC/player) di dekat titik penyeberangan zebra. */
  private crossingBlocked(c: PedestrianCrossing, x: number, z: number): boolean {
    const GAP = 14 // jarak (m) sepanjang jalan yang membuat penyeberang menunggu
    const band = c.half + 2.5
    const onRoad = (cx: number, cz: number): boolean =>
      c.axis === 'EW' ? Math.abs(cz - c.roadCenter) < band : Math.abs(cx - c.roadCenter) < band
    const gap = (cx: number, cz: number): number =>
      c.axis === 'EW' ? Math.abs(cx - x) : Math.abs(cz - z)
    for (const v of this.vehicles) {
      if (onRoad(v.x, v.z) && gap(v.x, v.z) < GAP) return true
    }
    if (this.carInitialized) {
      const cx = this.prevCarX
      const cz = this.prevCarZ
      if (onRoad(cx, cz) && gap(cx, cz) < GAP) return true
    }
    return false
  }

  /** Deteksi tabrakan dekat pemain dengan pejalan kaki & kendaraan NPC → violation 'collision' existing. */
  private checkNpcHit(carX: number, carZ: number, dt: number): void {
    this.pedestrianHitCooldown = Math.max(0, this.pedestrianHitCooldown - dt)
    if (this.pedestrianHitCooldown > 0) return

    // Pejalan kaki: radius deteksi = jangkauan bodi mobil pemain (collisionRadius
    // 1.8m + badan orang ~0.4m) sehingga sentuhan tubuh terdeteksi walau pusat
    // mobil masih ~2m. Dikirim ke registerCollision → violation 'collision'
    // existing (cooldown 2s lokal + 1.5s store → tidak spam per frame).
    for (const p of this.pedestrians) {
      const dx = p.root.position.x - carX
      const dz = p.root.position.z - carZ
      if (Math.hypot(dx, dz) < 2.2) {
        this.registerCollision('pejalan kaki')
        return
      }
    }

    // Kendaraan NPC: cek kotak berorientasi heading (bodi mobil ~4.4x1.9m)
    // + radius mobil pemain, sehingga tabrakan dari samping/tepat juga terdeteksi
    // (tidak hanya jarak pusat-ke-pusat).
    const carRadius = 1.8
    for (const v of this.vehicles) {
      const dx = v.x - carX
      const dz = v.z - carZ
      if (this.vehicleBodyHit(dx, dz, v.heading, 4.4, 1.9, carRadius)) {
        this.registerCollision('kendaraan NPC')
        return
      }
    }
  }

  private registerCollision(label: string): void {
    useViolationStore.getState().addViolation('collision')
    this.pedestrianHitCooldown = 2.0
    console.log(`[NpcSystem] Pemain menabrak ${label} (collision violation)`)
  }

  /** Cek apakah titik offset (dx,dz) pemain menabrak kotak berorientasi heading. */
  private vehicleBodyHit(
    dx: number, dz: number, heading: number, halfLen: number, halfWid: number, r: number
  ): boolean {
    const sn = Math.sin(heading)
    const cs = Math.cos(heading)
    // Rotasi offset ke ruang lokal kendaraan (heading=0 → arah +Z).
    const lz = dx * sn + dz * cs
    const lx = dx * cs - dz * sn
    const hx = halfWid + r
    const hz = halfLen + r
    // Jarak titik ke kotak membesar (rounded-box); jika < r → tabrakan.
    const qx = Math.max(-hx, Math.min(hx, lx))
    const qz = Math.max(-hz, Math.min(hz, lz))
    const ddx = lx - qx
    const ddz = lz - qz
    return ddx * ddx + ddz * ddz < r * r
  }

  // ============================================
  // KENDARAAN NPC
  // ============================================

  private updateVehicles(dt: number, carX?: number, carZ?: number): void {
    for (const v of this.vehicles) {
      const pts = v.def.waypoints
      if (!pts || pts.length < 2) continue
      this.updateVehicle(v, dt, carX, carZ)
    }

    // Separasi ringan antar-kendaraan NPC (khusus Ngawi) sebagai lapisan akhir
    // aga mobil yang berpapasan esp. di persimpangan tidak saling menembus.
    // Hanya mendorong posisi; tidak menyentuh sistem point/violation/map lain.
    const MIN_SEP = 3.6
    for (let i = 0; i < this.vehicles.length; i++) {
      for (let j = i + 1; j < this.vehicles.length; j++) {
        const a = this.vehicles[i]
        const b = this.vehicles[j]
        const dx = b.x - a.x
        const dz = b.z - a.z
        const dist = Math.hypot(dx, dz)
        if (dist < MIN_SEP && dist > 0.0001) {
          const push = Math.min((MIN_SEP - dist) / 2, 0.5)
          const nx = dx / dist
          const nz = dz / dist
          this.setVehPos(a, a.x - nx * push, a.z - nz * push)
          this.setVehPos(b, b.x + nx * push, b.z + nz * push)
        }
      }
    }
  }

  private setVehPos(v: LiveVehicle, x: number, z: number): void {
    v.x = x
    v.z = z
    v.mesh.position.x = x
    v.mesh.position.z = z
  }

  /**
   * Update kinematik satu kendaraan NPC:
   *  - kecepatan (target diramp mulus) dipengaruhi lampu merah & kendaraan di depan,
   *  - menyalip sederhana & aman (deteksi → perlambat → cek lane → pindah → lewat → kembali),
   *  - selalu dijaga di dalam road-corridor,
   *  - tidak menembus bangunan/barrier/player/NPC lain,
   *  - tidak pernah \"melompat\" (per-frame terbatas).
   * Semua hanya berlaku untuk map Ngawi.
   */
  private updateVehicle(v: LiveVehicle, dt: number, carX?: number, carZ?: number): void {
    const pts = v.def.waypoints
    const nextIndex = (v.currentPoint + 1) % pts.length
    const from = pts[v.currentPoint]
    const to = pts[nextIndex]
    const ax = to.x - from.x
    const az = to.z - from.z
    const segLen = Math.hypot(ax, az)
    if (segLen <= 1e-6) {
      v.currentPoint = nextIndex
      v.progress = 0
      return
    }
    const sx = ax / segLen
    const sz = az / segLen
    const px = -sz
    const pz = sx

    // 1) Lampu merah (persimpangan pusat) → target melambat/berhenti saat mendekat.
    let target = v.def.speed
    const stopD = this.redStopDistance(v, sx, sz)
    if (stopD !== null && stopD < this.STOP_REACT + 4) {
      target = Math.min(target, Math.max(0, (stopD - 1) * 2.4))
    }

    // 2) Kendaraan di depan (NPC lain atau player) yang lebih lambat / menghalangi.
    const lead = this.leaderAhead(v, carX, carZ, sx, sz, px, pz)

    // 3) Status menyalip.
    if (v.laneState === 0) {
      if (lead && lead.aheadDist < this.OVERTAKE_DETECT) {
        const side = this.pickOvertakeSide(v, px, pz, carX, carZ)
        if (side !== 0) {
          v.laneState = 1
          v.laneSide = side
          v.laneRemain = lead.aheadDist + this.OVERTAKE_SAFE
        }
      }
    } else {
      v.laneRemain -= v.speed * dt
      if (v.laneRemain <= 0 || !lead) {
        v.laneState = 0
        v.laneSide = 0
      }
    }

    if (v.laneState === 1) {
      // sedang menyalip → percepat agar melewati leader.
      target = Math.max(target, v.def.speed)
    } else if (lead) {
      // ikuti leader, jaga jarak aman.
      const gap = lead.aheadDist - this.FOLLOW_MIN_DIST
      if (lead.aheadDist < this.FOLLOW_MIN_DIST) {
        target = Math.min(target, 0)
      } else {
        target = Math.min(target, lead.speed, lead.speed + (gap - 0.6) * 1.1)
      }
    }

    // Ramp kecepatan agar gerakan mulus (tanpa loncat / terlempar).
    const accel = 4.5
    if (v.speed < target) {
      v.speed = Math.min(target, v.speed + accel * dt)
    } else {
      v.speed = Math.max(target, v.speed - accel * dt)
    }
    v.speed = Math.max(0, v.speed)

    // 4) Maju di sepanjang waypoint sesuai kecepatan.
    v.progress += (v.speed * dt) / segLen
    while (v.progress >= 1) {
      v.progress -= 1
      v.currentPoint = (v.currentPoint + 1) % pts.length
    }
    const from2 = pts[v.currentPoint]
    const next2 = pts[(v.currentPoint + 1) % pts.length]
    const ax2 = next2.x - from2.x
    const az2 = next2.z - from2.z
    const len2 = Math.hypot(ax2, az2) || 1e-6
    const t = v.progress
    let nx = from2.x + ax2 * t
    let nz = from2.z + az2 * t
    const hx = ax2 / len2
    const hz = az2 / len2

    // Lateral offset saat menyalip (sejajar segmen, tetap di atas jalan).
    if (v.laneState === 1) {
      const pxn = -hz
      const pzn = hx
      nx += pxn * v.laneSide * this.PASS_LATERAL
      nz += pzn * v.laneSide * this.PASS_LATERAL
    }

    // 5) Pertahankan di dalam road-corridor (tidak boleh masuk taman/trotoar).
    const onRoad = this.drivableRects.some((r) => nx >= r.x0 && nx <= r.x1 && nz >= r.z0 && nz <= r.z1)
    if (!onRoad) {
      const snapped = this.nearestRoadPoint(nx, nz)
      nx = snapped.x
      nz = snapped.z
    }

    // 6) Bukan menembus bangunan/barrier (circle vs AABB).
    const st = this.resolveStatic(nx, nz, this.radiusOf(v))
    nx = st.x
    nz = st.z

    // 7) Bukan menembus player.
    const sp = this.separateFromPlayer(nx, nz, this.radiusOf(v), carX, carZ)
    nx = sp.x
    nz = sp.z

    // 8) Batasi langkah per-frame agar tidak melompat/terlempar.
    const maxStep = v.speed * dt + 0.5
    const gdx = nx - v.x
    const gdz = nz - v.z
    const gd = Math.hypot(gdx, gdz)
    if (gd > maxStep && gd > 1e-6) {
      nx = v.x + (gdx / gd) * maxStep
      nz = v.z + (gdz / gd) * maxStep
    }

    this.setVehPos(v, nx, nz)
    v.heading = Math.atan2(hx, hz)
    v.mesh.rotation.y = v.heading
    v.travel += v.speed * dt
    const wheels = v.mesh.getChildMeshes()
    for (const w of wheels) {
      if (w.name.includes('wheel') || w.name.includes('mwheel')) {
        w.rotation.z += dt * 20
      }
    }
  }

  /** Jarak ke stop line merah terdekat untuk kendaraan yang mendekati; null bila hijau/jauh. */
  private redStopDistance(v: LiveVehicle, sx: number, sz: number): number | null {
    for (const tl of this.trafficLights) {
      const d = tl.def
      const redEW = tl.phase === 2 || tl.phase === 3
      const redNS = tl.phase === 0 || tl.phase === 1
      const movingZ = Math.abs(sz) >= Math.abs(sx)
      if (movingZ ? !redNS : !redEW) continue
      const toVisit = (d.x - v.x) * sx + (d.z - v.z) * sz
      if (toVisit < 0) continue
      return Math.hypot(d.x - v.x, d.z - v.z)
    }
    return null
  }

  /** Kendaraan/player terdekat yang ada DI DEPAN pada lane yang sejajar. */
  private leaderAhead(
    v: LiveVehicle,
    carX: number | undefined,
    carZ: number | undefined,
    sx: number,
    sz: number,
    px: number,
    pz: number
  ): { aheadDist: number; speed: number } | null {
    let best: { aheadDist: number; speed: number } | null = null
    for (const w of this.vehicles) {
      if (w === v) continue
      const dx = w.x - v.x
      const dz = w.z - v.z
      const ahead = dx * sx + dz * sz
      if (ahead <= 0.5 || ahead > this.OVERTAKE_DETECT + 8) continue
      const lat = Math.abs(dx * px + dz * pz)
      if (lat > 5) continue
      if (!best || ahead < best.aheadDist) best = { aheadDist: ahead, speed: w.speed }
    }
    if (carX !== undefined && carZ !== undefined && isFinite(carX)) {
      const dx = carX - v.x
      const dz = carZ - v.z
      const ahead = dx * sx + dz * sz
      if (ahead > 0.5 && ahead < this.OVERTAKE_DETECT + 8) {
        const lat = Math.abs(dx * px + dz * pz)
        if (lat <= 5 && (!best || ahead < best.aheadDist)) {
          best = { aheadDist: ahead, speed: this.playerSpeed }
        }
      }
    }
    return best
  }

  /**
   * Sisi menyalip. LHT (Left-Hand Traffic): kendaraan menyalip HANYA dari
   * sebelah KANAN kendaraan (masuk jalur lawan/akses cepat), tidak pernah dari
   * kiri. Di sini perp-(px,pz) adalah NORMAL KIRI (side=+1 = kiri), sehingga
   * side=-1 = kanan. Kami hanya mempertimbangkan sisi kanan (side=-1).
   * Jika lane kanan tidak aman/kosong & di atas jalan, return 0 → NPC menunggu/
   * memperlambat, tidak menembus kendaraan di depan.
   */
  private pickOvertakeSide(
    v: LiveVehicle,
    px: number,
    pz: number,
    carX: number | undefined,
    carZ: number | undefined
  ): number {
    const side = -1 // KANAN (LHT) — satu-satunya sisi yang diizinkan menyalip
    const nx = v.x + px * side * this.PASS_LATERAL
    const nz = v.z + pz * side * this.PASS_LATERAL
    // Lane sasaran harus masih di atas jalan & tidak menghadapi bangunan/barrier.
    if (!this.drivableRects.some((r) => nx >= r.x0 && nx <= r.x1 && nz >= r.z0 && nz <= r.z1)) return 0
    if (this.resolveStatic(nx, nz, this.radiusOf(v)).moved) return 0
    // Lane sasaran harus kosong dari NPC/player lain (tidak menembus).
    for (const w of this.vehicles) {
      if (w === v) continue
      if (Math.hypot(w.x - nx, w.z - nz) < 4.5) return 0
    }
    if (carX !== undefined && carZ !== undefined && isFinite(carX) && Math.hypot(carX - nx, carZ - nz) < 4.8) return 0
    return side
  }

  /** Titik terdekat pada jaringan jalan (road-corridor). */
  private nearestRoadPoint(x: number, z: number): { x: number; z: number } {
    let bestX = x
    let bestZ = z
    let bestD = Infinity
    for (const r of this.drivableRects) {
      const cx = Math.max(r.x0, Math.min(x, r.x1))
      const cz = Math.max(r.z0, Math.min(z, r.z1))
      const dx = x - cx
      const dz = z - cz
      const d = dx * dx + dz * dz
      if (d < bestD) {
        bestD = d
        bestX = cx
        bestZ = cz
      }
    }
    return { x: bestX, z: bestZ }
  }

  /** Dorong titik keluar dari kotak obstakel statis (bangunan/barrier). */
  private resolveStatic(x: number, z: number, r: number): { x: number; z: number; moved: boolean } {
    let moved = false
    for (let iter = 0; iter < 2; iter++) {
      for (const b of this.staticBoxes) {
        const cx = Math.max(b.minX, Math.min(x, b.maxX))
        const cz = Math.max(b.minZ, Math.min(z, b.maxZ))
        const dx = x - cx
        const dz = z - cz
        const d2 = dx * dx + dz * dz
        if (d2 < r * r) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2)
            x = cx + (dx / d) * r
            z = cz + (dz / d) * r
          } else {
            const left = x - b.minX
            const right = b.maxX - x
            const up = z - b.minZ
            const down = b.maxZ - z
            const m = Math.min(left, right, up, down)
            if (m === left) x = b.minX - r
            else if (m === right) x = b.maxX + r
            else if (m === up) z = b.minZ - r
            else z = b.maxZ + r
          }
          moved = true
        }
      }
    }
    return { x, z, moved }
  }

  /** Pemisahan circle-vs-circle dengan kendaraan pemain (tidak menembus player). */
  private separateFromPlayer(x: number, z: number, r: number, carX?: number, carZ?: number): { x: number; z: number; moved: boolean } {
    if (carX === undefined || carZ === undefined || !isFinite(carX)) return { x, z, moved: false }
    const dx = x - carX
    const dz = z - carZ
    const d = Math.hypot(dx, dz)
    const minD = r + 2.1
    if (d < minD && d > 1e-6) {
      return { x: carX + (dx / d) * minD, z: carZ + (dz / d) * minD, moved: true }
    }
    return { x, z, moved: false }
  }

  // ============================================
  // UPDATE (dipanggil DemoScene.setiap frame)
  // ============================================

  update(deltaTime: number, carX?: number, carZ?: number): void {
    const cx = carX ?? this.prevCarX
    const cz = carZ ?? this.prevCarZ

    // Estimasi kecepatan player (dipakai kendaraan NPC utk menyalip/ikut aman).
    if (this.carInitialized && deltaTime > 0) {
      this.playerSpeed = Math.min(20, Math.hypot(cx - this.prevCarX, cz - this.prevCarZ) / deltaTime)
    }

    this.updatePedestrians(deltaTime)
    this.updateVehicles(deltaTime, cx, cz)
    this.updateTrafficLights(deltaTime)

    if (this.carInitialized) {
      this.checkRedLight(cx, cz)
      this.checkNpcHit(cx, cz, deltaTime)
    } else {
      this.carInitialized = true
    }

    this.prevCarX = cx
    this.prevCarZ = cz
  }

  dispose(): void {
    for (const p of this.pedestrians) p.root.dispose()
    this.pedestrians = []
    for (const v of this.vehicles) v.mesh.dispose()
    this.vehicles = []
    this.trafficLights = []
  }

  /**
   * Posisi kendaraan NPC sebagai rintangan lingkaran 2D (khsusus Ngawi).
   * Dipakai SimpleMap.checkCollision agar mobil pemain tidak bisa menembus
   * mobil NPC. Radius = radius collision badan mobil.
   */
  getCarObstacles(): Array<{ x: number; z: number; r: number }> {
    return this.vehicles.map((v) => ({ x: v.x, z: v.z, r: this.radiusOf(v) }))
  }

  /** Radius collision per-kendaraan (truk lebih besar dari mobil). */
  private radiusOf(v: LiveVehicle): number {
    return v.def.type === 'truck' ? this.TRUCK_RADIUS : this.CAR_RADIUS
  }
}

// ============================================
// HELPERS
// ============================================

function setLight(mesh: AbstractMesh, intensity: number): void {
  const m = mesh.material as PBRMaterial
  if (m && typeof m.emissiveIntensity === 'number') {
    m.emissiveIntensity = intensity
  }
}

/**
 * Apakah kendaraan menyeberangi garis stop dalam arah yang benar
 * (dari \"sebelum\" menuju \"sesudah\" sesuai arah pendekat).
 */
function crossedStop(px: number, pz: number, cx: number, cz: number, stop: { x1: number; z1: number; x2: number; z2: number; axis: 'EW' | 'NS'; dir: '+X' | '-X' | '+Z' | '-Z' }): boolean {
  // Stop line EW: segmen vertikal di x=const (x1==x2). Kendaraan bergerak di sumbu X.
  if (stop.axis === 'EW') {
    const s = stop.x1
    // Hardening: titik persilangan harus benar-benar berada di dalam bentang
    // segmen stop (z dalam [z1,z2]). Tanpa ini, kendaraan yang melewati sumbu-x
    // stop namun TIDAK berada di jalan pendekat terkontrol bisa terdeteksi
    // melanggar lampu merah di persimpangan yang tidak punya lampu.
    const inSpan = Math.min(pz, cz) <= Math.max(stop.z1, stop.z2) && Math.max(pz, cz) >= Math.min(stop.z1, stop.z2)
    if (!inSpan) return false
    if (stop.dir === '+X') {
      // bergerak ke +X (timur): melewati garis dari kiri ke kanan
      return px < s && cx >= s
    } else {
      // -X (barat): melewati garis dari kanan ke kiri
      return px > s && cx <= s
    }
  } else {
    // NS: segmen horizontal di z=const (z1==z2). Kendaraan bergerak di sumbu Z.
    const s = stop.z1
    // Hardening: titik persilangan harus berada dalam bentang x [x1,x2] segmen.
    const inSpan = Math.min(px, cx) <= Math.max(stop.x1, stop.x2) && Math.max(px, cx) >= Math.min(stop.x1, stop.x2)
    if (!inSpan) return false
    if (stop.dir === '+Z') {
      // ke +Z (utara-selatan ke bawah?): gunakan definisi, bergerak ke +Z
      return pz < s && cz >= s
    } else {
      return pz > s && cz <= s
    }
  }
}
