/**
 * IndonesiaMap
 * ============
 * Layout dan logic khusus untuk map "Ngawi City" (nuansa lingkungan Indonesia).
 *
 * PRINSIP:
 *  - Layout + posisi objek + logic dipisahkan dari asset/model, sehingga
 *    placeholder primitive dapat diganti dengan model 3D final nanti TANPA
 *    mengubah layout utama map.
 *  - Fitur di modul ini HANYA untuk map Ngawi City dan tidak menyentuh
 *    map existing (Solo City / Sriwedari Park).
 *
 * Aturan tata letak:
 *  - Bangunan TIDAK pernah berada di jalur kendaraan / trotoar / zebra cross.
 *  - NPC pejalan kaki hanya menyeberang melalui zebra cross.
 *  - NPC kendaraan hanya berada di jalur jalan.
 */

import {
  Scene,
  Vector3,
  Quaternion,
  Color3,
  MeshBuilder,
  PBRMaterial,
  AbstractMesh,
  Mesh,
  SceneLoader,
} from '@babylonjs/core'
import { LightingSetup } from './LightingSetup'

// ============================================
// TYPES
// ============================================

/** Satu ruas jalan di tabel `ROADS` (sinkron dengan entri jaringan jalan Ngawi). */
export interface RoadDef {
  name: string
  cx: number
  cz: number
  halfX: number
  halfZ: number
  width: number
  orient: 'H' | 'V'
  kind: 'main' | 'sec' | 'ling'
}

export interface BoxColliderDef {
  min: Vector3
  max: Vector3
  mesh?: AbstractMesh
}

export interface SpawnPointDef {
  x: number
  z: number
  rotationY: number
}

export interface PedestrianWalkPoint {
  x: number
  z: number
}

/** Definsi rute pejalan kaki: urutan titik yang diikuti (looping). */
export interface PedestrianCrossing {
  /** indeks pasangan titik (segmen) yang menyeberang jalan. */
  segIndex: number
  /** orientasi jalan yang diseberang ('EW' = jalan horizontal, 'NS' = vertikal). */
  axis: 'EW' | 'NS'
  /** posisi pusat jalan pada sumbu penyeberangan (z untuk EW, x untuk NS). */
  roadCenter: number
  /** setengah lebar jalan yang diseberang. */
  half: number
}

export interface PedestrianDef {
  id: number
  points: PedestrianWalkPoint[]
  /** kecepatan dalam m/s */
  speed: number
  /** bobot bobot untuk efek langkah */
  bobAmplitude?: number
  /** warna pakaian untuk membedakan tipe NPC */
  color: Color3
  /** daftar penyeberangan zebra yang dilakukan pada segmen tertentu. */
  crossings?: PedestrianCrossing[]
}

export interface NpcWayPoint {
  x: number
  z: number
}

export interface NpcVehicleDef {
  id: number
  startX: number
  startZ: number
  speed: number
  color: Color3
  /** tipe kendaraan: 'mobil' (default), 'motor', atau 'truck' */
  type?: 'mobil' | 'motor' | 'truck'
  /**
   * Loop waypoint jalur (satu arah) yang diikuti kendaraan terus-menerus.
   * Waypoint berada DI ATAS JALAN pada satu lane, mengikuti arah lalu lintas
   * (tidak pernah berbalik arah / keluar jalur).
   */
  waypoints: NpcWayPoint[]
  /**
   * Toleransi jarak utk pindah ke waypoint berikutnya (m).
   * Default diisi otomatis bila tidak ada (2.0 m).
   */
  arrivalRadius?: number
}

/** Segmen garis stop (stop line) pada sebuah pendekat persimpangan. */
export interface StopLineDef {
  x1: number
  z1: number
  x2: number
  z2: number
  /** sumbu jalan tempat stop line berada: 'EW' = jalan horizontal, 'NS' = vertikal */
  axis: 'EW' | 'NS'
  /** arah kendaraan yang diproteksi: '+X' | '-X' | '+Z' | '-Z' */
  dir: '+X' | '-X' | '+Z' | '-Z'
}

/** Satu unit lampu lalu lintas (mengontrol satu persimpangan). */
export interface TrafficLightDef {
  id: number
  x: number
  z: number
  /** lampu merah/kuning/hijau untuk sumbu EW (jalan horizontal) — satu utk tiap pendekat */
  ewRed: AbstractMesh[]
  ewYellow: AbstractMesh[]
  ewGreen: AbstractMesh[]
  /** lampu merah/kuning/hijau untuk sumbu NS (jalan vertikal) — satu utk tiap pendekat */
  nsRed: AbstractMesh[]
  nsYellow: AbstractMesh[]
  nsGreen: AbstractMesh[]
  /** stop line tiap pendekat */
  stops: StopLineDef[]
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ============================================
// CONSTANTS (warna & material dipakai ulang)
// ============================================

const ROAD_MAIN_COLOR = new Color3(0.35, 0.37, 0.33)
const ROAD_SECONDARY_COLOR = new Color3(0.40, 0.42, 0.38)
const ROAD_LINGKUNGAN_COLOR = new Color3(0.45, 0.47, 0.43)
const GRASS_COLOR = new Color3(0.38, 0.55, 0.30)
const SIDEWALK_COLOR = new Color3(0.62, 0.60, 0.55)
const BARRIER_COLOR = new Color3(0.55, 0.55, 0.55)

// ============================================
// MAIN CLASS
// ============================================

export class IndonesiaMap {
  private scene: Scene
  private lightingSetup: LightingSetup | null

  private meshes: AbstractMesh[] = []
  private colliders: BoxColliderDef[] = []

  private spawnPoint: SpawnPointDef = { x: 0, z: 0, rotationY: 0 }
  private boundaryWalls: AbstractMesh[] = []

  /** Kumpulan material yang dipakai ulang agar hemat. */
  private mats: Record<string, PBRMaterial> = {}

  private pedestrians: PedestrianDef[] = []
  private npcVehicles: NpcVehicleDef[] = []
  private trafficLights: TrafficLightDef[] = []

  // ---- Model 3D final bangunan Ngawi (placeholder → GLB) ----
  // Antrian tiap penempatan bangunan final. Diproses async oleh
  // dispatchFinalModels() memakai SceneLoader.ImportMeshAsync (loader yang
  // sudah dipakai DemoScene). Placeholder tetap dibangun sebagai fallback +
  // collider; ketika model final selesai dimuat, placeholder visual dibuang
  // dan model diletakkan pada area yang sama (layout TIDAK berubah).
  // Cache PROMISE GLB sengaja bersifat INSTANCE-LEVEL (bukan static class):
  // setiap instance IndonesiaMap terikat pada satu scene. Promise yang dibuat
  // oleh scene lama TIDAK boleh dipakai ulang oleh scene baru (mis. saat React
  // StrictMode double-mount, atau saat pemain keluar lalu masuk Ngawi lagi),
  // karena mesin hasil import milik scene yang sudah di-dispose.
  private glbCache = new Map<string, Promise<{ meshes: AbstractMesh[] }>>()
  private readonly finalModelsQueue: Array<{
    instance: string
    x: number
    z: number
    asset: string
    footW: number
    footD: number
    maxHeight: number
  }> = []

  // ---- Geometri jalan (dipakai untuk validasi posisi) ----
  private readonly MAIN_HALF = { w: 8, h: 8 } // setengah lebar jalan utama

  /**
   * Data jalan (network). Semua jalan saling terhubung membentuk grafik,
   * tanpa jalan buntu (kecuali ujung jalan utama di tepi map yang diberi
   * ruang putar balik). Layout dirancang variatif:
   *  - main_h × main_v = poros utama (4 arah, bundaran kecil di tengah)
   *  - loop pertokoan (timur), loop permukiman (barat), loop sekolah (selatan)
   *  - T-junction & jalan akses dari area perumahan ke jalan utama
   */
  private readonly ROADS: Array<{
    name: string
    cx: number
    cz: number
    halfX: number   // setengah bentang sumbu X
    halfZ: number   // setengah bentang sumbu Z
    width: number
    orient: 'H' | 'V'
    kind: 'main' | 'sec' | 'ling'
  }> = [
    // Ring road luar (loop tertutup) — keliling kota, tidak ada ujung bebas
    // Semua jalan memakai LEBAR KONSISTEN 16m (sama dengan lebar jalan standar
    // Solo City, SimpleMap roadWidth=16) agar terasa seperti bagian game yang
    // sama; halfX/halfZ sisi tipis = w/2 = 8.
    { name: 'ring_n', cx: 0,    cz: 245,  halfX: 245, halfZ: 8,  width: 16, orient: 'H', kind: 'main' },
    { name: 'ring_s', cx: 0,    cz: -245, halfX: 245, halfZ: 8,  width: 16, orient: 'H', kind: 'main' },
    { name: 'ring_w', cx: -245, cz: 0,    halfX: 8,   halfZ: 245, width: 16, orient: 'V', kind: 'main' },
    { name: 'ring_e', cx: 245,  cz: 0,    halfX: 8,   halfZ: 245, width: 16, orient: 'V', kind: 'main' },
    // Poros utama (Silang, ujung tersambung ring)
    { name: 'main_h', cx: 0, cz: 0,    halfX: 245, halfZ: 8,  width: 16, orient: 'H', kind: 'main' },
    { name: 'main_v', cx: 0, cz: 0,    halfX: 8,   halfZ: 245, width: 16, orient: 'V', kind: 'main' },
    // Ring pertengahan (loop tertutup) — jalan ALTERNATIF paralel di dalam ring
    // luar; memberi loop kedua, belokan, & percabangan ke semua kuadran.
    { name: 'i_n', cx: 0,  cz: 60,  halfX: 60, halfZ: 8, width: 16, orient: 'H', kind: 'sec' }, // x -60..60
    { name: 'i_s', cx: 0,  cz: -60, halfX: 60, halfZ: 8, width: 16, orient: 'H', kind: 'sec' }, // x -60..60
    { name: 'i_w', cx: -60, cz: 0,  halfX: 8,  halfZ: 60, width: 16, orient: 'V', kind: 'sec' }, // z -60..60
    { name: 'i_e', cx: 60,  cz: 0,  halfX: 8,  halfZ: 60, width: 16, orient: 'V', kind: 'sec' }, // z -60..60
    // Jalan sekunder (alternatif antar zona) — diambil TIDAK simetris dengan
    // poros & ring tengah, sehingga membentuk peremptaan & belokan bervariasi.
    { name: 's_n', cx: 0,    cz: 140,  halfX: 245, halfZ: 8, width: 16, orient: 'H', kind: 'sec' }, // z=140, x -245..245 (ke ring)
    { name: 's_s', cx: 0,    cz: -140, halfX: 245, halfZ: 8, width: 16, orient: 'H', kind: 'sec' }, // z=-140, x -245..245 (ke ring)
    { name: 's_w', cx: -140, cz: 0,    halfX: 8,   halfZ: 245, width: 16, orient: 'V', kind: 'sec' }, // x=-140, z -245..245 (ke ring)
    { name: 's_e', cx: 140,  cz: 0,    halfX: 8,   halfZ: 245, width: 16, orient: 'V', kind: 'sec' }, // x=140, z -245..245 (ke ring)
    // Percabangan permukiman barat (T-junction ke s_w & ring_w) — dua jalan
    // penghubung antar-zona agar blok barat bercabang & tidak kaku.
    { name: 'rn', cx: -190, cz: 110, halfX: 50, halfZ: 8, width: 16, orient: 'H', kind: 'ling' }, // x -240..-140 (ring_w⇄s_w)
    { name: 'rs', cx: -190, cz: 45,  halfX: 50, halfZ: 8, width: 16, orient: 'H', kind: 'ling' }, // x -240..-140 (ring_w⇄s_w)
    // Percabangan pertokoan timur (T-junction ke s_e & ring_e)
    { name: 'e1', cx: 192.5, cz: 123, halfX: 52.5, halfZ: 8, width: 16, orient: 'H', kind: 'ling' }, // x 140..245 (s_e⇄ring_e)
    // Zona SPBU/bengkel — jalan penghubung antar-zona (main_v ⇄ s_e)
    { name: 'spbu_a', cx: 70, cz: 95, halfX: 70, halfZ: 8, width: 16, orient: 'H', kind: 'ling' }, // x 0..140
    // Zona sekolah — blok loop (main_v + sch_top + sch_v + sch_bottom) di
    // kuadran tenggara, jauh dari ring selatan agar tidak menabrak sudut.
    { name: 'sch_top',    cx: 50,  cz: -120, halfX: 50, halfZ: 8,  width: 16, orient: 'H', kind: 'ling' }, // x 0..100
    { name: 'sch_bottom', cx: 50,  cz: -160, halfX: 50, halfZ: 8,  width: 16, orient: 'H', kind: 'ling' }, // x 0..100
    { name: 'sch_v',      cx: 100, cz: -140, halfX: 8,  halfZ: 20, width: 16, orient: 'V', kind: 'ling' }, // z -160..-120
    // ── PERLUASAN 1,5× — jalan penghubung zona baru (lebar tetap 16m) ─────
    // Pita antara ring sekunder (±140) dan ring luar (±245) diisi blok & zona:
    //  - 1 spine vertikal (pertokoan timur) + jalan penghubung antar-zona
    //  - semua ujung jalan selalu tersambung ke jalan lain (tanpa jalan buntu)
    // Spine timur (pertokoan/lapangan) — ring_s → ring_n.
    { name: 'et_a', cx: 195,  cz: 0,   halfX: 8, halfZ: 245, width: 16, orient: 'V', kind: 'ling' }, // x=195, z -245..245
    // Jalan penghubung horizontal utara (perkantoran/utara) — s_w ⇄ main_v ⇄ s_e
    { name: 'nr_h', cx: 0,   cz: 200,  halfX: 140, halfZ: 8, width: 16, orient: 'H', kind: 'sec' }, // z=200, x -140..140
    // Jalan penghubung horizontal selatan (sekolah/lapangan) — s_w ⇄ main_v ⇄ s_e
    { name: 'sr_h', cx: 0,   cz: -200, halfX: 140, halfZ: 8, width: 16, orient: 'H', kind: 'sec' }, // z=-200, x -140..140
    // Blok perumahan barat DIAGONAL banding s_w(‑140) dan ring_w(‑245) — spine
    // barat DIHINDARI (tidak menabrak perumahan existing); cukup 2 jalur luar.
    { name: 'wh_1', cx: -195, cz: 182, halfX: 50,   halfZ: 8, width: 16, orient: 'H', kind: 'ling' }, // x -245..-145 (ring_w⇄s_w)
    { name: 'wh_2', cx: -195, cz: -182, halfX: 50,  halfZ: 8, width: 16, orient: 'H', kind: 'ling' }, // x -245..-145 (ring_w⇄s_w)
    // Blok pertokoan timur (antara s_e x=140 & et_a x=195 & ring_e x=245)
    { name: 'eh_1', cx: 195, cz: 182, halfX: 50,   halfZ: 8, width: 16, orient: 'H', kind: 'ling' }, // x 145..245 (s_e⇄ring_e)
    { name: 'eh_2', cx: 195, cz: -210, halfX: 50,  halfZ: 8, width: 16, orient: 'H', kind: 'ling' }, // x 145..245 (s_e⇄ring_e), selatan sekolah
    { name: 'eh_3', cx: 168, cz: 82,  halfX: 28,   halfZ: 8, width: 16, orient: 'H', kind: 'ling' }, // x 140..196 (s_e⇄et_a)
    { name: 'eh_4', cx: 168, cz: -90, halfX: 28,   halfZ: 8, width: 16, orient: 'H', kind: 'ling' }, // x 140..196 (s_e⇄et_a)
    // Zona sekolah/lapangan selatan (antara s_s z=-140 & sr_h z=-200)
    // (sf_a dihapus: strip z=-208..-192 sudah tercakup sr_h & sf_v tersambung langsung ke sr_h.)
    { name: 'sf_v', cx: 100, cz: -180, halfX: 8,    halfZ: 20, width: 16, orient: 'V', kind: 'ling' }, // z -200..-160 (hubung selatan)
  ]

  /**
   * Area parkiran luas (spawn) khusus Ngawi — strip aspal di sisi selatan jalan
   * rs (cz=45) dengan akses/entri menuju jalan lewat celah pembatas di x=openX.
   * Termasuk dalam area yang boleh dilalui kendaraan (bukan rumput), tetapi
   * TIDAK memperluas area hijau di sekitarnya menjadi boleh-lalu.
   */
  private readonly PARKING = {
    cx: -165,
    cz: 24,
    halfX: 18,   // x -183..-147 (di antara wr_a x=-195 & s_w x=-140)
    halfZ: 12,   // z 12..36  (selatan rs road; dekat celah pembatas akses)
    openX: -165, // pusat celah pembatas untuk akses ke jalan rs
  }

  constructor(scene: Scene, lightingSetup?: LightingSetup) {
    this.scene = scene
    this.lightingSetup = lightingSetup ?? null
  }

  // ============================================
  // PUBLIC ACCESSORS
  // ============================================

  getMeshes(): AbstractMesh[] {
    return this.meshes
  }

  getColliders(): BoxColliderDef[] {
    return this.colliders
  }

  /**
   * Area aspal (rect jalan) yang boleh dilalui kendaraan pemain di Ngawi.
   * Dipakai "road-corridor constraint" oleh SimpleMap (khsusus Ngawi) agar
   * player tidak bebas mengemudi di atas rumput/taman.
   */
  getDrivableRects(): Array<{ x0: number; x1: number; z0: number; z1: number }> {
    const roads = this.ROADS.map((r) => ({
      x0: r.orient === 'H' ? r.cx - r.halfX : r.cx - r.width / 2,
      x1: r.orient === 'H' ? r.cx + r.halfX : r.cx + r.width / 2,
      z0: r.orient === 'V' ? r.cz - r.halfZ : r.cz - r.width / 2,
      z1: r.orient === 'V' ? r.cz + r.halfZ : r.cz + r.width / 2,
    }))
    // Area parkiran juga termasuk "boleh dilalui" kendaraan (spawn), bukan rumput.
    roads.push({
      x0: this.PARKING.cx - this.PARKING.halfX,
      x1: this.PARKING.cx + this.PARKING.halfX,
      z0: this.PARKING.cz - this.PARKING.halfZ,
      z1: this.PARKING.cz + this.PARKING.halfZ,
    })
    return roads
  }

  getSpawnPoint(): SpawnPointDef {
    return this.spawnPoint
  }

  getBoundaryWalls(): AbstractMesh[] {
    return this.boundaryWalls
  }

  getPedestrians(): PedestrianDef[] {
    return this.pedestrians
  }

  getNpcVehicles(): NpcVehicleDef[] {
    return this.npcVehicles
  }

  getTrafficLights(): TrafficLightDef[] {
    return this.trafficLights
  }

  // ============================================
  // MATERIAL & REGISTRATION HELPERS
  // ============================================

  private mat(key: string, base: Color3, opts?: Partial<{ metallic: number; roughness: number; emissive: Color3; emissiveIntensity: number; alpha: number }>): PBRMaterial {
    if (!this.mats[key]) {
      const m = new PBRMaterial(`ngawi_${key}`, this.scene)
      m.albedoColor = base
      m.metallic = opts?.metallic ?? 0.1
      m.roughness = opts?.roughness ?? 0.85
      if (opts?.emissive) {
        m.emissiveColor = opts.emissive
        m.emissiveIntensity = opts.emissiveIntensity ?? 1
      }
      if (opts?.alpha !== undefined) {
        m.alpha = opts.alpha
      }
      this.mats[key] = m
    }
    return this.mats[key]
  }

  private commit(mesh: AbstractMesh, withCollider = false, addShadow = true): void {
    this.meshes.push(mesh)
    if (addShadow) {
      this.lightingSetup?.addShadowCaster(mesh)
    }
    if (withCollider) {
      this.addBoxCollider(mesh)
    }
  }

  /**
   * Area parkiran luas (tempat spawn) — lantai aspal + garis parkir placeholder.
   * TANPA collider (kendaraan boleh melintas). Area ini sekaligus didaftarkan
   * sebagai "drivable rect" sehingga road-corridor constraint tidak mendorong
   * pemain keluar dari parkiran. Entri/akses ke jalan rs (utara) lewat celah
   * pembatas yang dibuat oleh buildRoadBarriers().
   */
  private buildParking(): void {
    const p = this.PARKING
    const w = p.halfX * 2
    const d = p.halfZ * 2

    // Lantai aspal
    const floor = MeshBuilder.CreateGround('ngawi_parking_floor', {
      width: w,
      height: d,
      subdivisions: 1,
    }, this.scene)
    floor.position = new Vector3(p.cx, 0.005, p.cz)
    floor.material = this.mat('asphalt', new Color3(0.16, 0.16, 0.17), { roughness: 0.9 })
    floor.receiveShadows = true
    this.commit(floor, false)

    // Garis parkir placeholder (strip tipis tanpa collider)
    const lineMat = this.mat('parkingLine', new Color3(0.92, 0.92, 0.88), { roughness: 0.6 })
    const rowCount = 4
    const colCount = 7
    const cellW = (w - 2) / colCount
    const cellD = (d - 2) / rowCount
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cx = p.cx - w / 2 + 1 + c * cellW + cellW / 2
        const cz = p.cz - d / 2 + 1 + r * cellD + cellD / 2
        const body = MeshBuilder.CreateBox(`ngawi_parking_slot_${r}_${c}`, {
          width: cellW - 1,
          height: 0.02,
          depth: 0.3,
        }, this.scene)
        body.position = new Vector3(cx, 0.06, cz)
        body.material = lineMat
        this.commit(body, false)
      }
    }
  }

  private addBoxCollider(mesh: AbstractMesh): void {
    mesh.computeWorldMatrix(true)
    const bb = mesh.getBoundingInfo().boundingBox
    this.colliders.push({
      min: bb.minimumWorld.clone(),
      max: bb.maximumWorld.clone(),
      mesh,
    })
  }

  // ============================================
  // GROUND & SIDEWALK
  // ============================================

  private createGround(): void {
    const ground = MeshBuilder.CreateGround('ngawi_ground', {
      width: 800,
      height: 1000,
      subdivisions: 32,
    }, this.scene)
    ground.material = this.mat('grass', GRASS_COLOR)
    ground.receiveShadows = true
    ground.position.y = -0.03
    ground.position.z = -100
    this.commit(ground, false, false)
  }

  private createSidewalk(x: number, z: number, w: number, h: number, nameIndex: number): void {
    const sw = MeshBuilder.CreateGround(`ngawi_sidewalk_${nameIndex}`, { width: w, height: h }, this.scene)
    sw.material = this.mat('sidewalk', SIDEWALK_COLOR)
    sw.receiveShadows = true
    sw.position = new Vector3(x, 0.02, z)
    this.commit(sw, false, false)
  }

  // ============================================
  // ROAD
  // ============================================

  private createRoad(name: string, x: number, z: number, width: number, height: number, colorKey: string): void {
    const road = MeshBuilder.CreateGround(name, { width, height }, this.scene)
    road.material = this.mat(colorKey,
      colorKey === 'road_main' ? ROAD_MAIN_COLOR : colorKey === 'road_sec' ? ROAD_SECONDARY_COLOR : ROAD_LINGKUNGAN_COLOR)
    road.receiveShadows = true
    road.position = new Vector3(x, 0.01, z)
    this.commit(road, false, false)
  }

  private createJunction(x: number, z: number, size: number): void {
    const j = MeshBuilder.CreateGround(`ngawi_junction_${x}_${z}`, { width: size + 4, height: size + 4 }, this.scene)
    j.material = this.mat('road_main', ROAD_MAIN_COLOR)
    j.receiveShadows = true
    j.position = new Vector3(x, 0.015, z)
    this.commit(j, false, false)
  }

  private createDashedCenterH(xCenter: number, zCenter: number, xFrom: number, xTo: number): void {
    const lineMat = this.mat('line', new Color3(1, 1, 0.9), { emissive: new Color3(0.3, 0.3, 0.25), emissiveIntensity: 0.6 })
    for (let i = xFrom + 5; i < xTo; i += 10) {
      const dash = MeshBuilder.CreateBox(`ngawi_dash_h_${i}_${zCenter}`, { width: 5, height: 0.02, depth: 0.3 }, this.scene)
      dash.position = new Vector3(xCenter + i, 0.025, zCenter)
      dash.material = lineMat
      this.commit(dash, false, false)
    }
  }

  private createDashedCenterV(xCenter: number, zCenter: number, zFrom: number, zTo: number): void {
    const lineMat = this.mat('line', new Color3(1, 1, 0.9), { emissive: new Color3(0.3, 0.3, 0.25), emissiveIntensity: 0.6 })
    for (let i = zFrom + 5; i < zTo; i += 10) {
      const dash = MeshBuilder.CreateBox(`ngawi_dash_v_${xCenter}_${i}`, { width: 0.3, height: 0.02, depth: 5 }, this.scene)
      dash.position = new Vector3(xCenter, 0.025, zCenter + i)
      dash.material = lineMat
      this.commit(dash, false, false)
    }
  }

  /** Zebra cross di atas jalan. arah 'EW' berarti penyeberangan memotong jalan horizontal. */
  private createZebraCross(x: number, z: number, roadOrientation: 'EW' | 'NS', roadWidth: number, nameIndex: number): void {
    const stripeMat = this.mat('zebra', new Color3(0.95, 0.95, 0.92), { emissive: new Color3(0.5, 0.5, 0.5), emissiveIntensity: 0.3 })
    const count = 6
    const gap = Math.max(1.2, roadWidth / count)
    for (let i = 0; i < count; i++) {
      const offset = -roadWidth / 2 + i * gap + gap / 2
      if (roadOrientation === 'EW') {
        // Jalan horizontal (bentang sumbu X). Zebra memanjang sumbu X.
        const stripe = MeshBuilder.CreateBox(`ngawi_zebra_${nameIndex}_${i}`, { width: 3.2, height: 0.02, depth: 1.0 }, this.scene)
        stripe.position = new Vector3(x - roadWidth / 2 + offset, 0.02, z)
        stripe.material = stripeMat
        this.commit(stripe, false, false)
      } else {
        // Jalan vertikal (bentang sumbu Z). Zebra memanjang sumbu Z.
        const stripe = MeshBuilder.CreateBox(`ngawi_zebra_${nameIndex}_${i}`, { width: 1.0, height: 0.02, depth: 3.2 }, this.scene)
        stripe.position = new Vector3(x, 0.02, z - roadWidth / 2 + offset)
        stripe.material = stripeMat
        this.commit(stripe, false, false)
      }
    }
  }

  /** Stop line (garis putih) sebelum zebra/persimpangan. */
  private createStopLine(x: number, z: number, horizontal: boolean, nameIndex: number): void {
    const mat = this.mat('stopline', new Color3(0.95, 0.95, 0.92), { emissive: new Color3(0.5, 0.5, 0.5), emissiveIntensity: 0.4 })
    if (horizontal) {
      const line = MeshBuilder.CreateBox(`ngawi_stopline_${nameIndex}`, { width: 7, height: 0.02, depth: 0.3 }, this.scene)
      line.position = new Vector3(x, 0.02, z)
      line.material = mat
      this.commit(line, false, false)
    } else {
      const line = MeshBuilder.CreateBox(`ngawi_stopline_${nameIndex}`, { width: 0.3, height: 0.02, depth: 7 }, this.scene)
      line.position = new Vector3(x, 0.02, z)
      line.material = mat
      this.commit(line, false, false)
    }
  }

  /** Pembatas jalan (kerb beton) di sisi jalan. */
  private createRoadBarrier(x: number, z: number, length: number, horizontal: boolean, nameIndex: number): void {
    const bMat = this.mat('barrier', BARRIER_COLOR)
    const pieceCount = Math.floor(length / 4)
    for (let i = 0; i < pieceCount; i++) {
      const pos = -length / 2 + i * 4 + 2
      if (horizontal) {
        const p = MeshBuilder.CreateBox(`ngawi_barrier_${nameIndex}_${i}`, { width: 4, height: 0.7, depth: 0.4 }, this.scene)
        p.position = new Vector3(x + pos, 0.4, z)
        p.material = bMat
        this.commit(p, true)
      } else {
        const p = MeshBuilder.CreateBox(`ngawi_barrier_${nameIndex}_${i}`, { width: 0.4, height: 0.7, depth: 4 }, this.scene)
        p.position = new Vector3(x, 0.4, z + pos)
        p.material = bMat
        this.commit(p, true)
      }
    }
  }

  // ============================================
  // LAMPU LALU LINTAS
  // ============================================

  /**
   * Buat satu unit lampu lalu lintas (tiang + head 3 lampu).
   * rotY menentukan arah hadap head (menuju kendaraan pendekat).
   * Lampu menggunakan emissive agar MERAH/KUNING/HIJAU terlihat jelas
   * (aktif dikontrol runtime oleh NpcSystem).
   */
  private createTrafficLight(x: number, z: number, rotY: number, nameIndex: number): {
    red: AbstractMesh; yellow: AbstractMesh; green: AbstractMesh
  } {
    const pole = MeshBuilder.CreateCylinder(`ngawi_trl_pole_${nameIndex}`, { diameter: 0.22, height: 5 }, this.scene)
    pole.position = new Vector3(x, 2.5, z)
    pole.material = this.mat('trl_pole', new Color3(0.35, 0.35, 0.38))
    this.commit(pole, true)

    const box = MeshBuilder.CreateBox(`ngawi_trl_box_${nameIndex}`, { width: 0.55, height: 1.5, depth: 0.32 }, this.scene)
    box.position = new Vector3(x, 4.7, z)
    box.rotation.y = rotY
    box.material = this.mat('trl_box', new Color3(0.15, 0.15, 0.17))
    this.commit(box, false)

    const red = MeshBuilder.CreateSphere(`ngawi_trl_red_${nameIndex}`, { diameter: 0.36 }, this.scene)
    red.parent = box
    red.position = new Vector3(0, 0.5, 0.12)
    red.material = this.mat(`trl_red_${nameIndex}`, new Color3(0.9, 0.08, 0.08), { emissive: new Color3(1, 0.1, 0.1), emissiveIntensity: 0.1 })

    const yellow = MeshBuilder.CreateSphere(`ngawi_trl_yellow_${nameIndex}`, { diameter: 0.36 }, this.scene)
    yellow.parent = box
    yellow.position = new Vector3(0, 0, 0.12)
    yellow.material = this.mat(`trl_yellow_${nameIndex}`, new Color3(0.95, 0.8, 0.1), { emissive: new Color3(1, 0.85, 0.1), emissiveIntensity: 0.1 })

    const green = MeshBuilder.CreateSphere(`ngawi_trl_green_${nameIndex}`, { diameter: 0.36 }, this.scene)
    green.parent = box
    green.position = new Vector3(0, -0.5, 0.12)
    green.material = this.mat(`trl_green_${nameIndex}`, new Color3(0.1, 0.9, 0.1), { emissive: new Color3(0.1, 1, 0.1), emissiveIntensity: 0.1 })

    return { red, yellow, green }
  }

  /**
   * Bangun sistem traffic light utk satu persimpangan 4 arah.
   * ewHalf = setengah lebar jalan horizontal, nsHalf = setengah lebar jalan vertikal.
   * Menempatkan tiang di tiap pendekat agar kendaraan dari 4 arah melihat lampu,
   * TANPA menghalangi jalur kendaraan (tiang di sudut di luar kedua jalan).
   */
  private buildJunctionTrafficLight(id: number, cx: number, cz: number, ewHalf: number, nsHalf: number): void {
    const d = Math.max(ewHalf, nsHalf) + 2.5
    // Tiang EW (mengatur jalan horizontal) — menghadap kendaraan dari barat & timur
    const ewWest = this.createTrafficLight(cx - d, cz + d, Math.PI / 2, id * 10 + 1)
    const ewEast = this.createTrafficLight(cx + d, cz - d, -Math.PI / 2, id * 10 + 2)
    // Tiang NS (mengatur jalan vertikal) — menghadap kendaraan dari selatan & utara
    const nsSouth = this.createTrafficLight(cx - d, cz - d, 0, id * 10 + 3)
    const nsNorth = this.createTrafficLight(cx + d, cz + d, Math.PI, id * 10 + 4)

    this.trafficLights.push({
      id,
      x: cx,
      z: cz,
      ewRed: [ewWest.red, ewEast.red],
      ewYellow: [ewWest.yellow, ewEast.yellow],
      ewGreen: [ewWest.green, ewEast.green],
      nsRed: [nsSouth.red, nsNorth.red],
      nsYellow: [nsSouth.yellow, nsNorth.yellow],
      nsGreen: [nsSouth.green, nsNorth.green],
      stops: [
        { x1: cx - ewHalf, z1: cz - nsHalf, x2: cx - ewHalf, z2: cz + nsHalf, axis: 'EW', dir: '+X' },
        { x1: cx + ewHalf, z1: cz - nsHalf, x2: cx + ewHalf, z2: cz + nsHalf, axis: 'EW', dir: '-X' },
        { x1: cx - ewHalf, z1: cz + nsHalf, x2: cx + ewHalf, z2: cz + nsHalf, axis: 'NS', dir: '-Z' },
        { x1: cx - ewHalf, z1: cz - nsHalf, x2: cx + ewHalf, z2: cz - nsHalf, axis: 'NS', dir: '+Z' },
      ],
    })
  }

  private buildTrafficLights(): void {
    // Hanya persimpangan utama yang PADAT diberi lampu lalu lintas.
    // Persimpangan minor (T-junction/pojok loop) menggunakan rambu & prioritas,
    // tidak semua persimpangan diberi lampu (sesuai prinsip "sesuai kebutuhan").
    // Persimpangan pusat (0,0) — main_h (half 8) × main_v (half 8), 4 arah.
    this.buildJunctionTrafficLight(1, 0, 0, 8, 8)
  }

  // ============================================
  // BUILDINGS (placeholder, diganti model 3D final nanti)
  // ============================================

  private createSolidBox(
    name: string, x: number, z: number, w: number, h: number, d: number, matKey: string
  ): AbstractMesh {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene)
    mesh.position = new Vector3(x, h / 2, z)
    mesh.material = this.mat(matKey, new Color3(0.85, 0.82, 0.78))
    mesh.receiveShadows = true
    this.commit(mesh, false)
    return mesh
  }

  private createHouse1(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 8, 5, 7, 'house_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 9, height: 2, depth: 3 }, this.scene)
    roof.position = new Vector3(x, 5.5, z)
    roof.rotation.x = Math.PI / 2 + 0.3
    roof.material = this.mat('roof_red', new Color3(0.7, 0.2, 0.15))
    this.commit(roof, false)
    this.enqueueModel(name, x, z, 8, 7, 'rumah1.glb', 8)
  }

  private createHouse2(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 10, 6, 9, 'house_wall2')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 10, height: 2.2, depth: 4 }, this.scene)
    roof.position = new Vector3(x, 6.6, z)
    roof.rotation.x = Math.PI / 2 + 0.3
    roof.material = this.mat('roof_grey', new Color3(0.45, 0.45, 0.48))
    this.commit(roof, false)
    this.enqueueModel(name, x, z, 10, 9, 'rumah2.glb', 9)
  }

  private createHouse3(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 12, 7, 11, 'house_wall3')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 12, height: 2.5, depth: 4.5 }, this.scene)
    roof.position = new Vector3(x, 7.7, z)
    roof.rotation.x = Math.PI / 2 + 0.3
    roof.material = this.mat('roof_brown', new Color3(0.5, 0.35, 0.2))
    this.commit(roof, false)
    this.enqueueModel(name, x, z, 12, 11, 'rumah3.glb', 10)
  }

  private createRuko1(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 6, 5, 10, 'ruko_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 6.5, height: 0.8, depth: 10.5 }, this.scene)
    roof.position = new Vector3(x, 5, z)
    roof.material = this.mat('ruko_roof', new Color3(0.3, 0.3, 0.34))
    this.commit(roof, false)
    this.enqueueModel(name, x, z, 6, 10, 'rumah&ruko.glb', 10)
  }

  private createRuko2(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 6, 9, 10, 'ruko_wall2')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 6.5, height: 0.8, depth: 10.5 }, this.scene)
    roof.position = new Vector3(x, 9, z)
    roof.material = this.mat('ruko_roof', new Color3(0.3, 0.3, 0.34))
    this.commit(roof, false)
    this.enqueueModel(name, x, z, 6, 10, 'rumah&ruko.glb', 10)
  }

  private createWarung(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 7, 4, 6, 'warung_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 7.5, height: 0.6, depth: 6.5 }, this.scene)
    roof.position = new Vector3(x, 4.2, z)
    roof.material = this.mat('warung_roof', new Color3(0.85, 0.35, 0.2))
    this.commit(roof, false)
    // Warung makan menggunakan asset pendukung (nasi padang / pecel lele), dan
    // kantin sekolah memakai "dapur" (dapur&kopdes.glb) sebagai dapur MBG.
    const warungAsset: Record<string, string> = {
      rh_warung: 'nasi_padang.glb',
      rh_m1: 'nasi_padang.glb',
      rte_5: 'nasi_padang.glb',
      ps_warung: 'pecel_lele.glb',
      rhw_6: 'pecel_lele.glb',
    }
    this.enqueueModel(name, x, z, 7, 6, warungAsset[name] ?? 'nasi_padang.glb', 5)
  }

  private createKopdes(name: string, x: number, z: number, rotY = 0): void {
    // Kopdes (Koperasi Desa) — placeholder satu lantai sederhana,
    // tampak seperti bangunan layanan unit desa dekat permukiman.
    const body = this.createSolidBox(`${name}_body`, x, z, 9, 4.5, 7, 'kopdes_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const flat = MeshBuilder.CreateBox(`${name}_flat`, { width: 9.5, height: 0.5, depth: 7.5 }, this.scene)
    flat.position = new Vector3(x, 4.5, z)
    flat.material = this.mat('kopdes_flat', new Color3(0.55, 0.35, 0.2))
    this.commit(flat, false)
    const porch = MeshBuilder.CreateBox(`${name}_porch`, { width: 3, height: 0.3, depth: 6 }, this.scene)
    porch.position = new Vector3(x + (rotY === Math.PI / 2 ? 5.5 : 0), 0.3, z)
    porch.material = this.mat('kopdes_porch', new Color3(0.65, 0.6, 0.5))
    this.commit(porch, false)
    const sign = MeshBuilder.CreateBox(`${name}_sign`, { width: 2.2, height: 0.9, depth: 0.15 }, this.scene)
    sign.position = new Vector3(x + (rotY === Math.PI / 2 ? 5.5 : 0), 3, z)
    sign.material = this.mat('kopdes_sign', new Color3(0.15, 0.5, 0.8))
    this.commit(sign, false)
    this.enqueueModel(name, x, z, 9, 7, 'Kopdes.glb', 6)
  }

  private createBengkel(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 9, 4, 10, 'bengkel_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 9.5, height: 0.5, depth: 10.5 }, this.scene)
    roof.position = new Vector3(x, 4, z)
    roof.material = this.mat('bengkel_roof', new Color3(0.3, 0.35, 0.4))
    this.commit(roof, false)
    this.enqueueModel(name, x, z, 9, 10, 'bengkel.glb', 8)
  }

  private createSpbu(name: string, x: number, z: number, rotY = 0): void {
    // Bangunan utama SPBU (toko) ditaruh di sisi, tidak menghalangi jalan.
    const shop = this.createSolidBox(`${name}_shop`, x, z, 6, 3.5, 10, 'spbu_shop')
    shop.rotation.y = rotY
    shop.computeWorldMatrix(true)
    this.addBoxCollider(shop)
    // Kanopi di depan toko (menghadap jalan).
    const canopy = MeshBuilder.CreateBox(`${name}_canopy`, { width: 12, height: 3, depth: 8 }, this.scene)
    canopy.position = new Vector3(x + (rotY === Math.PI / 2 ? 9 : 0), 3.2, z)
    canopy.material = this.mat('spbu_canopy', new Color3(0.8, 0.1, 0.1))
    this.commit(canopy, false)
    // Pilar kanopi
    const py = rotY === Math.PI / 2 ? 9 : 0
    for (const [dx, dz] of [[1, -3.5], [1, 3.5], [-1, -3.5], [-1, 3.5]]) {
      const pillar = MeshBuilder.CreateCylinder(`${name}_pillar_${dx}_${dz}`, { diameter: 0.35, height: 3 }, this.scene)
      pillar.position = new Vector3(x + py + dx, 1.5, z + dz)
      pillar.material = this.mat('spbu_pillar', new Color3(0.8, 0.1, 0.1))
      this.commit(pillar, true)
    }
    this.enqueueModel(name, x, z, 16, 12, 'spbu.glb', 6)
  }

  private createKantor(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 18, 9, 14, 'kantor_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 18.5, height: 1, depth: 14.5 }, this.scene)
    roof.position = new Vector3(x, 9, z)
    roof.material = this.mat('kantor_roof', new Color3(0.35, 0.35, 0.4))
    this.commit(roof, false)
    this.enqueueModel(name, x, z, 18, 14, 'gedung1.glb', 16)
  }

  // ============================================
  // ENVIRONMENT
  // ============================================

  private createTree(x: number, z: number, nameIndex: number): void {
    const trunk = MeshBuilder.CreateCylinder(`ngawi_tree_trunk_${nameIndex}`, { diameter: 0.5, height: 2.5 }, this.scene)
    trunk.position = new Vector3(x, 1.25, z)
    trunk.material = this.mat('tree_trunk', new Color3(0.35, 0.25, 0.15))
    this.commit(trunk, true)
    const leaf = MeshBuilder.CreateSphere(`ngawi_tree_leaf_${nameIndex}`, { diameter: 2.6 }, this.scene)
    leaf.position = new Vector3(x, 3.6, z)
    leaf.material = this.mat('tree_leaf', new Color3(0.28, 0.55, 0.25))
    this.commit(leaf, false)
  }

  private createBush(x: number, z: number, nameIndex: number): void {
    const bush = MeshBuilder.CreateSphere(`ngawi_bush_${nameIndex}`, { diameter: 1.2 }, this.scene)
    bush.position = new Vector3(x, 0.6, z)
    bush.material = this.mat('bush', new Color3(0.3, 0.5, 0.25))
    this.commit(bush, false)
  }

  private createStreetLamp(x: number, z: number, nameIndex: number): void {
    const pole = MeshBuilder.CreateCylinder(`ngawi_lamp_pole_${nameIndex}`, { diameter: 0.25, height: 5 }, this.scene)
    pole.position = new Vector3(x, 2.5, z)
    pole.material = this.mat('lamp_pole', new Color3(0.4, 0.4, 0.4))
    this.commit(pole, true)
    const arm = MeshBuilder.CreateCylinder(`ngawi_lamp_arm_${nameIndex}`, { diameter: 0.12, height: 1.6 }, this.scene)
    arm.position = new Vector3(x, 5, z)
    arm.rotation.x = Math.PI / 2
    arm.material = this.mat('lamp_pole', new Color3(0.4, 0.4, 0.4))
    this.commit(arm, false)
    const head = MeshBuilder.CreateSphere(`ngawi_lamp_head_${nameIndex}`, { diameter: 0.5 }, this.scene)
    head.position = new Vector3(x, 4.9, z)
    head.material = this.mat('lamp_head', new Color3(1, 1, 0.85), { emissive: new Color3(1, 0.95, 0.7), emissiveIntensity: 1.4 })
    this.commit(head, false)
  }

  private createPowerPole(x: number, z: number, nameIndex: number): void {
    const pole = MeshBuilder.CreateCylinder(`ngawi_powerpole_${nameIndex}`, { diameter: 0.3, height: 7 }, this.scene)
    pole.position = new Vector3(x, 3.5, z)
    pole.material = this.mat('powerpole', new Color3(0.35, 0.32, 0.3))
    this.commit(pole, true)
    const crossarm = MeshBuilder.CreateBox(`ngawi_powerpole_arm_${nameIndex}`, { width: 4, height: 0.15, depth: 0.15 }, this.scene)
    crossarm.position = new Vector3(x, 6.6, z)
    crossarm.material = this.mat('powerpole', new Color3(0.35, 0.32, 0.3))
    this.commit(crossarm, false)
  }

  private createTrashBin(x: number, z: number, nameIndex: number): void {
    const bin = MeshBuilder.CreateCylinder(`ngawi_trash_${nameIndex}`, { diameter: 0.6, height: 0.9 }, this.scene)
    bin.position = new Vector3(x, 0.45, z)
    bin.material = this.mat('trash', new Color3(0.25, 0.55, 0.3))
    this.commit(bin, true)
  }

  private createBench(x: number, z: number, nameIndex: number, rotY = 0): void {
    const seat = MeshBuilder.CreateBox(`ngawi_bench_${nameIndex}`, { width: 1.8, height: 0.15, depth: 0.6 }, this.scene)
    seat.position = new Vector3(x, 0.55, z)
    seat.rotation.y = rotY
    seat.material = this.mat('bench', new Color3(0.6, 0.4, 0.25))
    this.commit(seat, true)
    const back = MeshBuilder.CreateBox(`ngawi_benchback_${nameIndex}`, { width: 1.8, height: 0.7, depth: 0.12 }, this.scene)
    back.position = new Vector3(x, 0.95, z + 0.2)
    back.rotation.y = rotY
    back.material = this.mat('bench', new Color3(0.6, 0.4, 0.25))
    this.commit(back, false)
  }

  private createPotPlant(x: number, z: number, nameIndex: number): void {
    const pot = MeshBuilder.CreateCylinder(`ngawi_pot_${nameIndex}`, { diameter: 0.7, height: 0.5 }, this.scene)
    pot.position = new Vector3(x, 0.25, z)
    pot.material = this.mat('pot', new Color3(0.7, 0.4, 0.2))
    this.commit(pot, true)
    const plant = MeshBuilder.CreateSphere(`ngawi_potplant_${nameIndex}`, { diameter: 0.8 }, this.scene)
    plant.position = new Vector3(x, 0.9, z)
    plant.material = this.mat('potplant', new Color3(0.2, 0.55, 0.2))
    this.commit(plant, false)
  }

  private createRambu(x: number, z: number, nameIndex: number): void {
    const pole = MeshBuilder.CreateCylinder(`ngawi_rambu_pole_${nameIndex}`, { diameter: 0.12, height: 2 }, this.scene)
    pole.position = new Vector3(x, 1, z)
    pole.material = this.mat('rambu_pole', new Color3(0.6, 0.6, 0.6))
    this.commit(pole, true)
    const plate = MeshBuilder.CreateBox(`ngawi_rambu_plate_${nameIndex}`, { width: 0.8, height: 0.8, depth: 0.08 }, this.scene)
    plate.position = new Vector3(x, 2.3, z)
    plate.material = this.mat('rambu_plate', new Color3(0.9, 0.1, 0.1))
    this.commit(plate, false)
  }

  private createBoundaryWalls(): void {
    const wallMat = this.mat('boundary', new Color3(0.5, 0.5, 0.5))
    // Dinding batas dibentang sesuai ukuran kota 1,5× — ring luar ±245 + ruang
    // hijau tepi, jadi batas fisik di ±270 (lebih lebar dari mapBounds yang besar).
    const walls = [
      { x: 0, z: 270, width: 540, rot: 0 },
      { x: 0, z: -270, width: 540, rot: 0 },
      { x: 270, z: 0, width: 540, rot: Math.PI / 2 },
      { x: -270, z: 0, width: 540, rot: Math.PI / 2 },
    ]
    walls.forEach((w, i) => {
      const mesh = MeshBuilder.CreateBox(`ngawi_boundary_${i}`, { width: w.width, height: 3, depth: 2 }, this.scene)
      mesh.position = new Vector3(w.x, 1.5, w.z)
      mesh.rotation.y = w.rot
      mesh.material = wallMat
      mesh.receiveShadows = true
      mesh.checkCollisions = true
      this.commit(mesh, true)
      this.boundaryWalls.push(mesh)
    })
  }

  // ============================================
  // PROTOTYPE PEJALAN KAKI (manusia sederhana)
  // ============================================

  static createPedestrianMesh(scene: Scene, name: string, color: Color3): {
    root: AbstractMesh
    body: AbstractMesh
    head: AbstractMesh
    armL: AbstractMesh
    armR: AbstractMesh
    legL: AbstractMesh
    legR: AbstractMesh
  } {
    const root = MeshBuilder.CreateBox(`${name}_root`, { width: 0.1, height: 0.1, depth: 0.1 }, scene)
    root.isVisible = false

    // Badan (baju)
    const body = MeshBuilder.CreateBox(`${name}_body`, { width: 0.55, height: 0.8, depth: 0.32 }, scene)
    body.parent = root
    body.position = new Vector3(0, 0.75, 0)
    const bodyMat = new PBRMaterial(`${name}_bodym`, scene)
    bodyMat.albedoColor = color
    bodyMat.roughness = 0.9
    body.material = bodyMat

    // Kepala
    const head = MeshBuilder.CreateSphere(`${name}_head`, { diameter: 0.32 }, scene)
    head.parent = root
    head.position = new Vector3(0, 1.35, 0)
    const headMat = new PBRMaterial(`${name}_headm`, scene)
    headMat.albedoColor = new Color3(0.9, 0.72, 0.55)
    head.material = headMat

    // Kaki
    const legMat = new PBRMaterial(`${name}_legm`, scene)
    legMat.albedoColor = new Color3(0.2, 0.2, 0.28)
    const legL = MeshBuilder.CreateBox(`${name}_legL`, { width: 0.18, height: 0.7, depth: 0.18 }, scene)
    legL.parent = root
    legL.position = new Vector3(-0.12, 0.05, 0)
    legL.material = legMat
    const legR = MeshBuilder.CreateBox(`${name}_legR`, { width: 0.18, height: 0.7, depth: 0.18 }, scene)
    legR.parent = root
    legR.position = new Vector3(0.12, 0.05, 0)
    legR.material = legMat

    // Tangan (lengan)
    const armMat = new PBRMaterial(`${name}_armm`, scene)
    armMat.albedoColor = new Color3(0.9, 0.72, 0.55)
    const armL = MeshBuilder.CreateBox(`${name}_armL`, { width: 0.14, height: 0.6, depth: 0.14 }, scene)
    armL.parent = root
    armL.position = new Vector3(-0.38, 0.65, 0)
    armL.material = armMat
    const armR = MeshBuilder.CreateBox(`${name}_armR`, { width: 0.14, height: 0.6, depth: 0.14 }, scene)
    armR.parent = root
    armR.position = new Vector3(0.38, 0.65, 0)
    armR.material = armMat

    return { root, body, head, armL, armR, legL, legR }
  }

  // ============================================
  // PUBLIC BUILD ENTRY
  // ============================================

  buildNgawi(): SpawnPointDef {
    this.createGround()
    this.buildRoads()
    this.buildSidewalks()
    this.buildParking()
    this.buildRoadBarriers()
    this.buildBuildings()
    this.buildEnvironment()
    this.createBoundaryWalls()
    this.buildPedestrianRoutes()
    this.buildNpcVehicles()
    this.buildTrafficLights()
    this.reportSceneStats('BEFORE-modelfinal')
    this.prewarmHeavyAssets()
    this.dispatchFinalModels()

    // Spawn: DI DALAM area parkiran luas (aspal) yang punya akses langsung ke
    // jalan rs di utara. Posisi aman, bukan di tengah jalan, bukan trotoar,
    // bukan bangunan/pembatas, bukan rumput.
    // Menghadap utara (+Z) agar pemain segera keluar parkiran menuju jalan raya.
    this.spawnPoint = { x: this.PARKING.cx, z: this.PARKING.cz, rotationY: 0 }

    console.log('[IndonesiaMap] Ngawi City created with', this.colliders.length, 'colliders')
    return this.spawnPoint
  }

  // ============================================
  // ROAD LAYOUT
  // ============================================

  private buildRoads(): void {
    // ── GAMBAR SEMUA JALAN DARI TABEL `ROADS` ────────────────
    // Semua jalan (poros utama + loop pertokoan + loop permukiman +
    // loop sekolah) digambar + dashes dari satu sumber data agar
    // trotoar/pembatas/system lain selalu konsisten.
    for (const r of this.ROADS) {
      const horizontal = r.orient === 'H'
      const sizeX = horizontal ? r.halfX * 2 : r.width
      const sizeZ = horizontal ? r.width : r.halfZ * 2
      const colorKey = r.kind === 'main' ? 'road_main' : r.kind === 'sec' ? 'road_sec' : 'road_ling'
      this.createRoad(r.name, r.cx, r.cz, sizeX, sizeZ, colorKey)
      if (horizontal) this.createDashedCenterH(r.cx, r.cz, -r.halfX + 5, r.halfX - 5)
      else this.createDashedCenterV(r.cx, r.cz, -r.halfZ + 5, r.halfZ - 5)
    }

    // ── JUNCTION / PERSIMPANGAN (di-generate otomatis dari tabel ROADS) ─────
    // Semua titik di mana dua jalan yang saling tegak lurus bertemu — termasuk
    // persilangan 4-arah, sambungan T (end-to-side), dan sudut loop — diberi
    // area persimpangan yang KOSONG (bisa dilewati). Ukuran ubin mengikuti
    // lebar jalan terlebar agar pembatas/trotoar tidak pernah masuk ke area ini.
    for (const inter of this.roadIntersections()) {
      this.createJunction(inter.x, inter.z, inter.tileSize)
    }

    // ── ZEBRA CROSS (penyeberangan resmi) ──────────────────
    // 1) Depan sekolah (menyeberang jalan horizontal sch_top)
    this.createZebraCross(50, -120, 'EW', 16, 1)
    // 2) Kawasan pusat (menyeberang main_h dekat bundaran)
    this.createZebraCross(20, 0, 'EW', 16, 2)
    // 3) Permukiman barat (menyeberang rs dekat s_w)
    this.createZebraCross(-170, 45, 'EW', 16, 3)
  }

  /**
   * Hitung semua persimpangan (dua jalan saling tegak lurus yang bertemu)
   * dari tabel `ROADS` + ukuran ubin yang konsisten dengan lebar terlebar.
   * Menggunakan batas inklusif (<=/>=) sehingga sambungan T / ujung-ring /
   * sudut loop juga dianggap persimpangan (bukan ujung buntu).
   */
  private roadIntersections(): Array<{ x: number; z: number; tileSize: number }> {
    const seen = new Set<string>()
    const out: Array<{ x: number; z: number; tileSize: number }> = []
    for (const a of this.ROADS) {
      for (const b of this.ROADS) {
        if (a.orient === b.orient) continue
        const hr = a.orient === 'H' ? a : b
        const vr = a.orient === 'V' ? a : b
        // pusat jalan vertikal harus berada dalam bentang horizontal,
        // dan pusat jalan horizontal dalam bentang vertikal
        const vx = vr.cx
        const hz = hr.cz
        if (vx < hr.cx - hr.halfX || vx > hr.cx + hr.halfX) continue
        if (hz < vr.cz - vr.halfZ || hz > vr.cz + vr.halfZ) continue
        const key = `${vx}_${hz}`
        if (seen.has(key)) continue
        seen.add(key)
        // ubin persimpangan selebar jalan terlebar + margin, supaya gap
        // pembatas/trotoar (lebar penyilang + 4) selalu di dalam ubin.
        const wmax = Math.max(a.width, b.width)
        out.push({ x: vx, z: hz, tileSize: wmax + 4 })
      }
    }
    return out
  }

  /** Hasilkan segmen-segmen [from,to] setelah memotong semua gap persimpangan. */
  private sidewalkSegments(
    from: number,
    to: number,
    gaps: Array<[number, number]>
  ): Array<[number, number]> {
    const g = gaps
      .filter(([c]) => c >= from && c <= to)
      .sort((a, b) => a[0] - b[0])
    const out: Array<[number, number]> = []
    let cur = from
    for (const [c, hg] of g) {
      const start = c - hg
      const end = c + hg
      if (start > cur) out.push([cur, start])
      cur = Math.max(cur, end)
    }
    if (cur < to) out.push([cur, to])
    return out.filter(([a, b]) => b - a > 1.5)
  }

  /**
   * Hitung celah (gap) pembatas/trotoar untuk satu ruas jalan berdasarkan
   * OVERLAP ASPAL (tegak-lurus) — bukan hanya pusat. Setiap jalur tegak lurus
   * yang aspalnya BENAR-BENAR menimpa badan jalan ini membuka celah di titik
   * perpotongan aspal. Ini memperbaiki T-junction / sambungan-ujung ke ring:
   * sebelumnya celah hanya terbuka bila PUSAT jalur penyilang berada di dalam
   * bentang ruas ini, sehingga pada sambungan ujung (mis. rs/rn/wh_1/wh_2 ke
   * ring_w, atau eh_1/eh_2 ke s_e) pembatas/trotoar memanjang menutup jalan
   * penyilang. Sekarang celah terbuka di mana pun aspal dua jalan bertemu.
   */
  private edgeGaps(r: RoadDef): Array<[number, number]> {
    const halfGap = (rW: number, crossW: number) => Math.max(rW, crossW) / 2 + 3
    const gaps: Array<[number, number]> = []
    if (r.orient === 'H') {
      const rX0 = r.cx - r.halfX
      const rX1 = r.cx + r.halfX
      const rZ0 = r.cz - r.width / 2
      const rZ1 = r.cz + r.width / 2
      for (const b of this.ROADS) {
        if (b.orient !== 'V') continue
        const bX0 = b.cx - b.width / 2
        const bX1 = b.cx + b.width / 2
        const bZ0 = b.cz - b.halfZ
        const bZ1 = b.cz + b.halfZ
        const ox0 = Math.max(rX0, bX0)
        const ox1 = Math.min(rX1, bX1)
        if (ox1 <= ox0) continue // aspal tidak menumpuk pada arah X
        if (bZ1 <= rZ0 || rZ1 <= bZ0) continue // tidak bersilang pada arah Z
        const center = Math.max(ox0, Math.min(b.cx, ox1))
        gaps.push([center, halfGap(r.width, b.width)])
      }
    } else {
      const rZ0 = r.cz - r.halfZ
      const rZ1 = r.cz + r.halfZ
      const rX0 = r.cx - r.width / 2
      const rX1 = r.cx + r.width / 2
      for (const b of this.ROADS) {
        if (b.orient !== 'H') continue
        const bZ0 = b.cz - b.width / 2
        const bZ1 = b.cz + b.width / 2
        const bX0 = b.cx - b.halfX
        const bX1 = b.cx + b.halfX
        const oz0 = Math.max(rZ0, bZ0)
        const oz1 = Math.min(rZ1, bZ1)
        if (oz1 <= oz0) continue
        if (bX1 <= rX0 || rX1 <= bX0) continue
        const center = Math.max(oz0, Math.min(b.cz, oz1))
        gaps.push([center, halfGap(r.width, b.width)])
      }
    }
    return gaps
  }

  /**
   * Tambahan celah trotoar agar strip tidak menimpa aspal jalan LAIN — termasuk
   * jalan sejajar (paralel) yang hanya berdekatan. Untuk garis trotoar suatu
   * ruas di koordinat `edgeCoord`, bila pita aspal ruas lain memuat koordinat
   * itu di arah yang sama, buka celah pada perpotongan bentangnya.
   */
  private sidewalkClip(r: RoadDef, edgeCoord: number, gaps: Array<[number, number]>): Array<[number, number]> {
    const out = gaps.slice()
    if (r.orient === 'H') {
      const rX0 = r.cx - r.halfX
      const rX1 = r.cx + r.halfX
      for (const o of this.ROADS) {
        if (o.name === r.name) continue
        const oZ0 = o.orient === 'V' ? o.cz - o.halfZ : o.cz - o.width / 2
        const oZ1 = o.orient === 'V' ? o.cz + o.halfZ : o.cz + o.width / 2
        if (!(oZ0 <= edgeCoord && edgeCoord <= oZ1)) continue
        const oX0 = o.orient === 'H' ? o.cx - o.halfX : o.cx - o.width / 2
        const oX1 = o.orient === 'H' ? o.cx + o.halfX : o.cx + o.width / 2
        const lo = Math.max(rX0, oX0)
        const hi = Math.min(rX1, oX1)
        if (hi <= lo) continue
        out.push([(lo + hi) / 2, (hi - lo) / 2 + 2])
      }
    } else {
      const rZ0 = r.cz - r.halfZ
      const rZ1 = r.cz + r.halfZ
      for (const o of this.ROADS) {
        if (o.name === r.name) continue
        const oX0 = o.orient === 'H' ? o.cx - o.halfX : o.cx - o.width / 2
        const oX1 = o.orient === 'H' ? o.cx + o.halfX : o.cx + o.width / 2
        if (!(oX0 <= edgeCoord && edgeCoord <= oX1)) continue
        const oZ0 = o.orient === 'V' ? o.cz - o.halfZ : o.cz - o.width / 2
        const oZ1 = o.orient === 'V' ? o.cz + o.halfZ : o.cz + o.width / 2
        const lo = Math.max(rZ0, oZ0)
        const hi = Math.min(rZ1, oZ1)
        if (hi <= lo) continue
        out.push([(lo + hi) / 2, (hi - lo) / 2 + 2])
      }
    }
    return out
  }

  private buildSidewalks(): void {
    // Trotoar hanya di SISI jalan (lebar 1.5m). Setiap strip DIHENTIKAN
    // sebelum persimpangan (gap = lebar jalan bersilang + 2m margin) agar
    // kendaraan bisa lurus/belok dan trotoar tidak "menutup" persimpangan.
    // Geometri dihitung otomatis dari tabel `ROADS` agar selalu konsisten.
    let si = 0

    // Trotoar jalan HORIZONTAL: dua strip sejajar sumbu X (utara & selatan).
    for (const r of this.ROADS) {
      if (r.orient !== 'H') continue
      const gaps = this.edgeGaps(r)
      const edgeZ = r.width / 2 + 1.5
      for (const zEdge of [r.cz + edgeZ, r.cz - edgeZ]) {
        // Ngawi: kerb bawah sch_bottom (sisi menghadap ring_s, z lebih kecil)
        // dipendekkan sebelum x=86 agar tidak menyentuh sudut persimpangan
        // ring_s × sec_e di (100,-200).
        const isSchBottomSouth = r.name === 'sch_bottom' && zEdge < r.cz
        const toX = isSchBottomSouth ? 86 : r.cx + r.halfX
        const clipGaps = this.sidewalkClip(r, zEdge, gaps)
        for (const [a, b] of this.sidewalkSegments(r.cx - r.halfX, toX, clipGaps)) {
          this.createSidewalk((a + b) / 2, zEdge, b - a, 1.5, si++)
        }
      }
    }

    // Trotoar jalan VERTIKAL: dua strip sejajar sumbu Z (timur & barat).
    for (const r of this.ROADS) {
      if (r.orient !== 'V') continue
      const gaps = this.edgeGaps(r)
      const edgeX = r.width / 2 + 1.5
      for (const xEdge of [r.cx + edgeX, r.cx - edgeX]) {
        const clipGaps = this.sidewalkClip(r, xEdge, gaps)
        for (const [a, b] of this.sidewalkSegments(r.cz - r.halfZ, r.cz + r.halfZ, clipGaps)) {
          this.createSidewalk(xEdge, (a + b) / 2, 1.5, b - a, si++)
        }
      }
    }
  }

  private buildRoadBarriers(): void {
    // ── PEMBATAS (kerb) di sisi luar SETIAP jalan ─────────────────────────
    // Tujuan: kendaraan TIDAK bisa keluar dari area jalan. Pembatas berada di
    // tepi luar jalur (bukan di tengah persimpangan / menutup zebra / belokan).
    // Gap sengaja dibiarkan di tiap PERSIMPANGAN (agar bisa lurus/belok/putar
    // balik) & di ujung jalan (ruang putar balik), dengan margin ±2m agar
    // kendaraan dapat berbelok tanpa menabrak sudut pembatas.
    // CELAH KHUSUS ZEBRA CROSS: tambahan celah di posisi zebra cross agar
    // pedestrian dapat menyeberang dengan aman.
    // Geometri dihitung otomatis dari tabel `ROADS` agar selalu konsisten.
    let bi = 100

    // Definisi zebra cross untuk celah pembatas (hanya untuk jalan horizontal)
    const zebraCrossDefs = [
      { x: 50, z: -120, roadName: 'sch_top' },  // Zebra 1: depan sekolah
      { x: 20, z: 0, roadName: 'main_h' },      // Zebra 2: kawasan pusat
      { x: -170, z: 45, roadName: 'rs' },       // Zebra 3: permukiman barat
    ]

    // Pembatas jalan HORIZONTAL (tepi utara & selatan, sejajar sumbu X).
    for (const r of this.ROADS) {
      if (r.orient !== 'H') continue
      const gaps = this.edgeGaps(r)

      // Tambahkan celah khusus untuk zebra cross pada jalan ini
      for (const zd of zebraCrossDefs) {
        if (zd.roadName === r.name) {
          const gapHalf = 4 // celah setengah lebar 4m (total 8m) di sekitar zebra
          gaps.push([zd.x, gapHalf])
        }
      }

      const edgeZ = r.width / 2 + 0.5
      for (const zEdge of [r.cz + edgeZ, r.cz - edgeZ]) {
        // Ngawi: kerb bawah sch_bottom (sisi menghadap ring_s, z lebih kecil)
        // dipendekkan sebelum x=86 agar tidak menyentuh sudut persimpangan
        // ring_s × sec_e di (100,-200).
        const isSchBottomSouth = r.name === 'sch_bottom' && zEdge < r.cz
        const toX = isSchBottomSouth ? 86 : r.cx + r.halfX

        // Area parkiran (spawn) tersambung ke sisi SELATAN jalan rs lewat celah
        // pembatas agar pemain bisa keluar parkiran menuju jalan — bukan netral.
        const accessGaps = gaps.slice()
        if (r.name === 'rs' && zEdge < r.cz && r.cx - r.halfX <= this.PARKING.openX
          && this.PARKING.openX <= r.cx + r.halfX) {
          accessGaps.push([this.PARKING.openX, 6])
        }

        for (const [a, b] of this.sidewalkSegments(r.cx - r.halfX, toX, accessGaps)) {
          this.edgeBarrierH(zEdge, [a, b], bi++)
        }
      }
    }

    // Pembatas jalan VERTICAL (tepi timur & barat, sejajar sumbu Z).
    for (const r of this.ROADS) {
      if (r.orient !== 'V') continue
      const gaps = this.edgeGaps(r)
      const edgeX = r.width / 2 + 0.5
      for (const xEdge of [r.cx + edgeX, r.cx - edgeX]) {
        for (const [a, b] of this.sidewalkSegments(r.cz - r.halfZ, r.cz + r.halfZ, gaps)) {
          this.edgeBarrierV(xEdge, [a, b], bi++)
        }
      }
    }

    // ── UJUNG JALAN SUDUT RING → TIDAK ADA BARRIER BUNTU ─────
    // Semua jalan internal tersambung ke ring & antar satu sama lain,
    // sehingga tidak ada jalan yang berakhir di barrier. Ring road sendiri
    // adalah loop tertutup; sisi luarnya dibatasi oleh boundary wall.
    // (Sengaja dibiarkan kosong: tidak ada turnaround/end-cap barrier.)
  }

  /** Pembatas horizontal (bentang sumbu X pada Z tetap), dari xFrom..xTo. */
  private edgeBarrierH(z: number, [xFrom, xTo]: [number, number], nameIndex: number): void {
    if (xTo <= xFrom) return
    const len = xTo - xFrom + 1.6
    this.createRoadBarrier((xFrom + xTo) / 2, z, len, true, nameIndex)
  }

  /** Pembatas vertikal (bentang sumbu Z pada X tetap), dari zFrom..zTo. */
  private edgeBarrierV(x: number, [zFrom, zTo]: [number, number], nameIndex: number): void {
    if (zTo <= zFrom) return
    const len = zTo - zFrom + 1.6
    this.createRoadBarrier(x, (zFrom + zTo) / 2, len, false, nameIndex)
  }

  // ============================================
  // BUILDING LAYOUT (konsep Indonesia campuran,
  // bangunan TIDAK menempati jalur kendaraan/trotoar/zebra)
  // ============================================

  private buildBuildings(): void {
    // Konsep tata kota Indonesia: bangunan campuran di dalam blok-blok yang
    // dibentuk jaringan ring + jalan tengah + ring tengah + sekunder. Semua
    // bangunan ditempatkan JAUH dari jalur kendaraan (min ~2m dari tepi aspal),
    // dari trotoar & zebra, sehingga: JALAN ASPAL → AREA AMAN → BANGUNAN.
    // Posisi divalidasi terhadap seluruh rect ROADS (16m) di tools/ngawi_audit.mjs.

    // ── ZONA PERUMAHAN BARAT (blok antara rs & rn, ring_w s.d. s_w) ──
    this.createHouse1('rh_1', -184, 60, 0)
    this.createHouse2('rh_2', -163, 60, 0)
    this.createHouse3('rh_3', -184, 80, 0)
    this.createHouse1('rh_4', -156, 80, 0)
    this.createWarung('rh_warung', -184, 97, 0)
    this.createKopdes('rh_kopdes', -156, 93, 0)

    // ── BLOK PERUMAHAN BARAT-SELATAN (antara main_h & s_s, s_w & ring_w) ──
    this.createHouse1('rh_s1', -175, -60, 0)
    this.createHouse2('rh_s2', -155, -60, 0)
    this.createHouse3('rh_s3', -180, -85, 0)
    this.createHouse1('rh_s4', -160, -85, 0)
    this.createHouse2('rh_5', -182, -32, 0)

    // ── ZONA PERTOKOAN (ruko/warung di sepanjang main_h timur & band utama) ──
    this.createRuko1('ps_ruko1', 75, -25, 0)
    this.createRuko2('ps_ruko2', 105, -25, 0)
    this.createRuko1('ps_ruko3', 165, -25, 0)
    this.createRuko2('ps_ruko4', 105, 25, 0)
    this.createRuko1('ps_ruko5', 165, 25, 0)
    this.createWarung('ps_warung', 115, -45, 0)
    this.createRuko2('ps_ruko6', 160, -70, 0)
    this.createRuko1('ps_ruko7', 125, -70, 0)

    // ── ZONA PERKANTORAN (blok utara, antara s_n & ring_n) ──
    this.createKantor('knt_1', -70, 165, 0)
    this.createKantor('knt_2', 40, 165, 0)
    this.createHouse2('knt_h1', -120, 165, 0)
    this.createKantor('knt_3', 120, 165, 0)

    // ── SPBU & BENGKEL (di utara spbu_a agar tidak memakan jalur kendaraan) ──
    this.createSpbu('spbu_1', 25, 112, 0)
    this.createBengkel('bengkel_1', 115, 112, 0)

    // ── WARUNG/SEKITAR POROS (kuadran tengah, jauh dari i_s/i_e) ──
    this.createWarung('rh_m1', 75, -90, 0)
    this.createHouse1('rh_m2', 120, -95, 0)
    this.createHouse3('rh_m3', 30, 44, 0)
    this.createKantor('rh_k1', -30, -30, 0)

    // ══ PERLUASAN 1,5× — bangunan zona baru (ring sekunder → ring luar) ══
    // Posisi divalidasi terhadap seluruh rect ROADS (16m) agar TIDAK ada
    // bangunan di jalur kendaraan / menimpa persimpangan (tools/ngawi_bldcheck.py).

    // ── BLOK PERUMAHAN BARAT-SELATAN (perluasan: antara s_s & ring_s/ring_w) ──
    this.createHouse1('rhw_1', -178, -45, 0)
    this.createHouse2('rhw_2', -160, -50, 0)
    this.createHouse3('rhw_3', -175, -100, 0)
    this.createHouse1('rhw_4', -165, -115, 0)
    this.createHouse2('rhw_5', -178, -160, 0)
    this.createWarung('rhw_6', -158, -160, 0)
    this.createHouse1('rhw_8', -120, -120, 0)

    // ── BLOK PT PERTOKOAN TIMUR (perluasan: antara s_e/et_a & ring_e) ──
    this.createRuko1('rte_1', 158, -55, 0)
    this.createRuko2('rte_2', 180, -55, 0)
    this.createRuko1('rte_3', 158, 55, 0)
    this.createRuko2('rte_4', 180, 55, 0)
    this.createWarung('rte_5', 160, -120, 0)
    this.createBengkel('rte_7', 160, 100, 0)
    this.createRuko1('rte_8', 178, 100, 0)
    this.createBengkel('bengkel_e', 180, 40, 0)
    this.createHouse2('rte_9', 165, 160, 0)

    // ── ZONA PERUMAHAN BARAT-UTARA (perluasan ring_n: antara rn & ring_n) ──
    this.createHouse2('rhw_10', -178, 125, 0)
    this.createHouse1('rhw_11', -158, 124, 0)

    // ── ZONA PERKANTORAN UTARA (perluasan: antara s_n & nr_h) ──
    this.createKantor('ofc_s', -90, 160, 0)
    this.createKantor('ofc_p', -20, 160, 0)
    this.createKantor('ofc_q', 90, 160, 0)

    // ── WARUNG di zona sekolah/lapangan selatan ──
    this.createWarung('skl_warung', 120, -125, 0)
  }

  // ============================================
  // MODEL 3D FINAL BANGUNAN (placeholder → GLB)
  // ============================================
  // Memakai SceneLoader.ImportMeshAsync (loader yang sudah dipakai DemoScene
  // untuk kendaraan pemain). Setiap asset GLB dimuat SEKALI lalu di-clone per
  // instance agar hemat memory/FPS. Placeholder tidak dibuang sebelum model
  // berhasil dimuat (fallback aman).

  /**
   * Daftarkan sebuah instance bangunan untuk diganti dengan model GLB final.
   * footW/footD = luasan aman (footprint placeholder) yang harus dipertahankan
   * agar bangunan tidak masuk jalan/area kendaraan. Layout koordinat TIDAK
   * diubah: model ditempatkan pada (x, z) yang sama dengan placeholder.
   */
  private enqueueModel(
    instance: string,
    x: number,
    z: number,
    footW: number,
    footD: number,
    asset: string,
    maxHeight: number
  ): void {
    this.finalModelsQueue.push({ instance, x, z, asset, footW, footD, maxHeight })
  }

  /**
   * Prewarm: fetch GLB paling berat ke cache browser lebih dulu (fire-and-forget)
   * agar ImportMeshAsync berikutnya tidak menunggu stream/download dari nol saat
   * pipeline dispatch juga sibuk memuat asset lain (rumah1.glb ~39MB).
   */
  private prewarmHeavyAssets(): void {
    const baseFolder = '/assets/Model 3d map Ngawi City/'
    const heavy = ['rumah1.glb', 'nasi_padang.glb', 'rumah3.glb']
    for (const f of heavy) {
      fetch(baseFolder + encodeURIComponent(f))
        .then((r) => {
          if (!r.ok) throw new Error(`fetch ${r.status}`)
          return r.arrayBuffer()
        })
        .then(() => {
          if (this.perfEnabled()) console.log(`[NgawiWarm] ${f} ok`)
        })
        .catch(() => {
          /* prewarm gagal → loader tetap dicoba utuh; tidak fatal */
        })
    }
  }

  /**
   * Mulai memuat semua model final secara async (fire-and-forget). dipanggil
   * di akhir buildNgawi() agar flow pembangunan map yang sinkron tidak terganggu.
   */
  private async dispatchFinalModels(): Promise<void> {
    const byAsset = new Map<string, typeof this.finalModelsQueue>()
    for (const q of this.finalModelsQueue) {
      let arr = byAsset.get(q.asset)
      if (!arr) {
        arr = []
        byAsset.set(q.asset, arr)
      }
      arr.push(q)
    }

    // Muat SEMUA asset secara paralel dengan per-await. Satu asset yang lambat/
    // gagal TIDAK boleh memblokir asset lain, sehingga tiap asset punya
    // penanganan error sendiri (placeholder tetap jadi fallback).
    // Catatan: SceneLoader me-encode parameter `file` (mis. `&` -> `%26`) yang
    // membuat server tidak menemukan file berkarakter `&` (mnjd SPA fallback).
    // Untuk asset berkarakter `&`, `rootUrl` dipakai sebagai URL lengkap apa
    // adanya (Babylon tidak me-encode rootUrl) dengan `file` kosong.
    const baseFolder = '/assets/Model 3d map Ngawi City/'
    const LOAD_TIMEOUT_MS = 240000 // pagar: satu fetch macet tidak boleh
    // menggantung Promise.all (asset lain sudah selesai, daftar final tetap selesai
    // dan report AFTER tetap berjalan; asset yang timeout mempertahankan placeholder).
    const tasks = [...byAsset.entries()].map(async ([asset, entries]) => {
      try {
        let pending = this.glbCache.get(asset)
        if (!pending) {
          const needsRaw = asset.includes('&')
          const rootUrl = needsRaw ? encodeURI(baseFolder) + asset : encodeURI(baseFolder)
          const file = needsRaw ? '' : encodeURIComponent(asset)
          pending = SceneLoader.ImportMeshAsync('', rootUrl, file, this.scene)
          this.glbCache.set(asset, pending)
        }
        const loaded = await Promise.race([
          pending,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`timeout ${LOAD_TIMEOUT_MS}ms`)), LOAD_TIMEOUT_MS)
          ),
        ])
        if (this.scene.isDisposed) {
          // Scene sudah dibuang (StrictMode double-mount / re-entry). Hasil
          // load tidak boleh ditulis ke scene disposed; cukup dibuang diam-diam
          // tanpa exception dan tanpa menyentuh scene barunya.
          return
        }
        if (entries.length > 0) {
          this.placeGlbInstances(loaded.meshes, entries)
          console.log(`[IndonesiaMap] Loaded & placed ${asset} (${entries.length} instance)`)
        }
      } catch (err) {
        if (this.scene.isDisposed) {
          // Kegagalan load di scene yang sudah dibuang wajar, bukan bug.
          return
        }
        // Gagal memuat: placeholder dibiarkan sebagai fallback (TIDAK dibuang).
        console.error(`[IndonesiaMap] Gagal memuat model ${asset}; placeholder dipertahankan.`, err)
      }
    })
    await Promise.all(tasks)
    this.watchdogMissing(byAsset)
    this.reportSceneStats('AFTER-modelfinal')
  }

  /**
   * Pengecekan akhir: pastikan setiap instance yang di-enqueue punya mesh final
   * (_final) di scene. Kalau ada yang tidak (asset gagal/timeout), laporkan
   * eksplisit agar diharvest test — placeholder tetap jadi fallback visual.
   */
  private watchdogMissing(byAsset: Map<string, { instance: string }[]>): void {
    const scene = this.scene
    if (scene.isDisposed) return
    for (const [asset, entries] of byAsset) {
      if (entries.length === 0) continue
      let placedCount = 0
      for (const q of entries) {
        const found = scene.meshes.some((m) => m.name.startsWith(`${q.instance}_final`))
        if (found) placedCount++
      }
      if (placedCount < entries.length) {
        console.error(
          `[IndonesiaMap] MISSING model ${asset}: ${placedCount}/${entries.length} instance; placeholder dipertahankan.`
        )
      }
    }
  }

  /**
   * Ukuran TARGET tinggi (unit dunia) per JENIS bangunan Ngawi agar tiap tipe
   * tampak BERBEDA secara wajar (warung kecil, rumah sedang, ruko lebih tinggi,
   * kantor paling besar, SPBU footprint lebar) — SEMAIN menghormati rasio
   * bounding box model asli. Parameter:
   *  - targetH  : tinggi dunia (unit, ~meter) yang diinginkan untuk tipe itu;
   *               dipakai sebagai skala natural s = targetH / tinggiModel.
   *  - ovf      : batas ATAS footprint = skala-fit x ovf (maks. keluar kotak
   *               placeholder sedikit, asal masih menjauh dari jalan).
   *  - minFrac  : batas BAWAH skala = fraksi dari skala-fit agar yang ukurannya
   *               dibatasi footprint tidak sampai menjadi mungil absurd.
   *  - minWorldH: batas BAWAH TINGGI dunia (m) supaya tidak ada bangunan yang
   *               terlihat seperti lantai rata (mis. model paviliun yang pendek).
   * Hasil akhir dikunci rutin sehingga TIDAK ada ukuran ekstrem: maksimum
   * footprint ~ skala-fit x 1.35 dan tidak pernah melebihi maxHeight placeholder.
   */
  private static readonly TYPE_VISUAL: Record<
    string,
    { targetH: number; ovf: number; minFrac: number; minWorldH: number }
  > = {
    // Warung / kantin (kecil)
    'pecel_lele.glb': { targetH: 3.4, ovf: 1.25, minFrac: 0.5, minWorldH: 1.8 },
    'dapur&kopdes.glb': { targetH: 3.6, ovf: 1.25, minFrac: 0.5, minWorldH: 2.0 },
    'nasi_padang.glb': { targetH: 3.4, ovf: 1.25, minFrac: 0.5, minWorldH: 1.8 },
    // Rumah (kecil → sedang → besar)
    'rumah1.glb': { targetH: 4.5, ovf: 1.2, minFrac: 0.55, minWorldH: 2.5 },
    'rumah2.glb': { targetH: 5.2, ovf: 1.35, minFrac: 0.6, minWorldH: 2.8 },
    'rumah3.glb': { targetH: 6.0, ovf: 1.3, minFrac: 0.65, minWorldH: 3.0 },
    // Layanan umum (sedang)
    'Kopdes.glb': { targetH: 4.8, ovf: 1.2, minFrac: 0.55, minWorldH: 2.6 },
    'bengkel.glb': { targetH: 4.8, ovf: 1.2, minFrac: 0.55, minWorldH: 2.8 },
    // SPBU — footprint luas, tinggi sedang
    'spbu.glb': { targetH: 4.5, ovf: 1.1, minFrac: 0.8, minWorldH: 2.6 },
    // Ruko (lebih tinggi dari rumah)
    'rumah&ruko.glb': { targetH: 7.0, ovf: 1.2, minFrac: 0.7, minWorldH: 3.5 },
    // Kantor/gedung (paling besar, tapi dibatasi footprint 18x14 + maxHeight 16)
    'gedung1.glb': { targetH: 9.5, ovf: 1.2, minFrac: 0.85, minWorldH: 5.0 },
  }

  /**
   * Normalisasi tiap model final ke footprint aman placeholder lalu tempatkan.
   * Skala dihitung otomatis dari bounding box model (ukur asli dihormati):
   *  - skala natural per jenis dari `TYPE_VISUAL` (target tinggi → tipe bangunan
   *    tampak BERBEDA: warung kecil, rumah sedang, ruko lebih tinggi, kantor
   *    paling besar, SPBU footprint lebar),
   *  - dibatasi ATAS oleh footprint placeholder x ovf (kecil, aman dari jalan)
   *    dan dibatasi BAWAH oleh minFrac + minWorldH (tidak mungil / lantai),
   *  - orientasi rotY dipilih berdasarkan skala-fit TERBESAR (proporsi model
   *    dihormati; tie-break selaraskan sumbu panjang model & placeholder),
   *  - dasar model berada di y=0, anchor X/Z tetap di posisi placeholder.
   * Setelah ditata, seluruh child mesh di-flatten ke world-space lalu DIGABUNG
   * (chunked merge) menjadi beberapa mesh statis per instance — jumlah mesh/
   * draw-call/shadow-caster berkurang drastis; bila merge gagal, child yang
   * sudah world-space tetap dirender (visible), tidak pernah kosong.
   */
  private placeGlbInstances(loadedMeshes: AbstractMesh[], entries: typeof this.finalModelsQueue): void {
    // Safety guard: JANGAN pernah menulis/menempatkan model ke scene yang sudah
    // di-dispose. Scene yang terlihat tidak boleh menerima model milik scene lama.
    if (this.scene.isDisposed) return

    const root = loadedMeshes[0]
    if (!root) return

    // Reset semua transform agar bounding box diukur dari pose asli model.
    root.parent = null
    root.scaling = new Vector3(1, 1, 1)
    root.rotationQuaternion = null
    root.rotation.set(0, 0, 0)
    root.position.set(0, 0, 0)
    root.isVisible = false
    root.computeWorldMatrix(true)
    const bb = root.getHierarchyBoundingVectors()
    const mdx = bb.max.x - bb.min.x
    const mdy = bb.max.y - bb.min.y
    const mdz = bb.max.z - bb.min.z
    if (mdx <= 0 || mdz <= 0 || mdy <= 0) {
      console.warn(`[IndonesiaMap] Model ${entries[0]?.asset} punya bounding box tak valid; placeholder dipertahankan.`)
      return
    }
    const modelLong = mdx >= mdz ? 'X' : 'Z'
    const asset = entries[0]?.asset ?? ''
    const cfg = IndonesiaMap.TYPE_VISUAL[asset] ?? { targetH: 4.5, ovf: 1.2, minFrac: 0.6, minWorldH: 2.5 }
    if (this.perfEnabled()) {
      console.log(`[NgawiRaw] ${asset} n=${entries.length} raw=[${mdx.toFixed(3)} x ${mdy.toFixed(3)} x ${mdz.toFixed(3)}]`)
    }

    for (const e of entries) {
      // Pilih orientasi (rotY 0 atau 90°) yang MEMBERI skala-fit TERBESAR agar
      // proporsi model dihormati dan tinggi punya ruang; bila sama besar,
      // selaraskan sumbu panjang model dengan sumbu panjang placeholder.
      const anchorLong = e.footW >= e.footD ? 'X' : 'Z'
      const sLong = e.footW >= e.footD ? e.footW : e.footD
      const sShort = e.footW >= e.footD ? e.footD : e.footW
      let bestS = 0
      let bestRot = 0
      for (const rot of [0, Math.PI / 2]) {
        const long = rot === 0 ? mdx : mdz
        const short = rot === 0 ? mdz : mdx
        const sF = Math.min(sLong / long, sShort / short, e.maxHeight / mdy)
        const ok = sF > bestS || (sF === bestS && rot === (modelLong === anchorLong ? 0 : Math.PI / 2))
        if (ok) {
          bestS = sF
          bestRot = rot
        }
      }
      if (bestS <= 0) continue
      // Skala NATURAL per jenis (target tinggi) dibatasi ATAS oleh footprint
      // (x ovf, tidak ekstrem) dan dibatasi BAWAH oleh minFrac + minWorldH
      // (tidak mungil/lantai). Anchor X/Z TETAP di posisi placeholder.
      const sTarget = cfg.targetH / mdy
      const s = Math.max(Math.min(sTarget, bestS * cfg.ovf), Math.max(bestS * cfg.minFrac, cfg.minWorldH / mdy))

      const inst = root.clone(`${e.instance}_final`, null)
      if (!inst) continue
      inst.parent = null
      inst.isVisible = false
      inst.scaling = new Vector3(s, s, s)
      inst.rotationQuaternion = null
      inst.rotation.set(0, bestRot, 0)
      inst.computeWorldMatrix(true)

      const ibb = inst.getHierarchyBoundingVectors()
      const cx = (ibb.max.x + ibb.min.x) / 2
      const cz = (ibb.max.z + ibb.min.z) / 2
      inst.position.set(e.x - cx, -ibb.min.y, e.z - cz)
      inst.computeWorldMatrix(true)

      // Optimasi performa: seluruh child mesh di-flatten ke world-space lalu
      // DIGABUNG (chunked merge) menjadi beberapa mesh statis per instance —
      // draw-call dan jumlah mesh jauh berkurang. Hasil selalu geometri dunia
      // yang valid (fallback = child sudah world-space), tidak pernah kosong.
      const placedMeshes = this.flattenInstToRenderables(inst, `${e.instance}_final`)
      if (this.perfEnabled()) {
        console.log(`[NgawiFlat] ${asset} ${e.instance} instClass=${inst.getClassName()} scale=${s.toFixed(4)} placed=${placedMeshes.length} names=${placedMeshes.slice(0,3).map((p)=>p.name).join(',')}`)
      }
      for (const pm of placedMeshes) {
        pm.isVisible = true
        pm.receiveShadows = true
        pm.checkCollisions = false
        pm.isPickable = false
        this.lightingSetup?.addShadowCaster(pm)
      }
      this.meshes.push(...placedMeshes)

      if (this.perfEnabled()) {
        let minX = Infinity, minY = Infinity, minZ = Infinity
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
        for (const pm of placedMeshes) {
          const pbb = pm.getHierarchyBoundingVectors()
          minX = Math.min(minX, pbb.min.x); minY = Math.min(minY, pbb.min.y); minZ = Math.min(minZ, pbb.min.z)
          maxX = Math.max(maxX, pbb.max.x); maxY = Math.max(maxY, pbb.max.y); maxZ = Math.max(maxZ, pbb.max.z)
        }
        console.log(`[NgawiPlace] ${asset} ${e.instance} world=[${(maxX - minX).toFixed(2)} x ${(maxY - minY).toFixed(2)} x ${(maxZ - minZ).toFixed(2)}] minY=${minY.toFixed(2)}`)
      }

      // Buang visual placeholder utk instance ini (collider statis tetap aktif).
      this.disposePlaceholderVisuals(e.instance)
    }

    // Sumber selesai dipakai oleh semua instance — buang hierarchy root agar
    // tidak menambah beban registrasi scene (clone sudah punya geometri sendiri).
    try {
      root.dispose(false, false)
    } catch {
      // aman dibiarkan bila dispose melempar
    }
  }

  /** True saat flag audit performa aktif (window.__NGAWI_PERF__ === true). */
  private perfEnabled(): boolean {
    try {
      return typeof window !== 'undefined' && (window as any).__NGAWI_PERF__ === true
    } catch {
      return false
    }
  }

  /**
   * Laporan statistik scene (hanya saat flag window.__NGAWI_PERF__ aktif) untuk
   * mengukur dampak: jumlah mesh, mesh aktif, vertices, indeks/triangle, serta
   * placeholder yang masih tersisa dan ukuran dunia setiap model final.
   */
  private reportSceneStats(label: string): void {
    if (!this.perfEnabled()) return
    const scene = this.scene
    const meshes = scene.meshes
    let verts = 0
    let tris = 0
    let active = 0
    for (const m of meshes) {
      verts += m.getTotalVertices ? m.getTotalVertices() : 0
      tris += m.getTotalIndices ? m.getTotalIndices() : 0
      if (m.isEnabled() && m.isVisible) active++
    }
    console.log(`[NgawiPerf:${label}] meshes=${meshes.length} active=${active} verts=${verts} tris=${tris}`)

    // Placeholder visual yang masih tertinggal (nama dengan prefix instance antrian).
    const queuePrefixes = new Set<string>()
    for (const q of this.finalModelsQueue) queuePrefixes.add(`${q.instance}_`)
    const leftovers: string[] = []
    for (const m of meshes) {
      if (m.name.includes('_final')) continue
      for (const p of queuePrefixes) {
        if (m.name.startsWith(p)) { leftovers.push(m.name); break }
      }
    }
    console.log(`[NgawiPerf:${label}] leftoverPlaceholderMeshes=${leftovers.length}`)
    if (leftovers.length > 0) console.log('  ' + leftovers.slice(0, 30).join(', '))

    // Ukuran dunia model final (untuk memeriksa proporsi antar jenis).
    const finals = meshes.filter((m) => m.name.includes('_final'))
    const rows: Array<{ name: string; w: number; h: number; d: number }> = []
    for (const m of finals) {
      const b = m.getHierarchyBoundingVectors()
      rows.push({ name: m.name, w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z })
    }
    rows.sort((a, b) => a.w * a.d - b.w * b.d)
    console.log(`[NgawiPerf:${label}] finalMeshes=${finals.length}`)
    rows.forEach((r) => {
      console.log(`  [finalSize] ${r.name.padEnd(22)} w=${r.w.toFixed(2)} h=${r.h.toFixed(2)} d=${r.d.toFixed(2)}`)
    })
  }

  /**
   * Flatten seluruh child mesh hasil clone ke world-space (transform dijejakkan
   * ke koordinat dunia, tanpa mengubah geometri biCara vertices) lalu menggabung
   * mereka menjadi beberapa mesh statis per instance (chunked merge, batas
   * aman ~250 mesh/chunk) sehingga jumlah mesh/draw-call/shadow-caster turun
   * drastis tanpa kecolongan geometri.
   * GARANSI: selalu mengembalikan set mesh render world-space yang valid.
   *  - chunk yang berhasil di-merge  → satu mesh statis;
   *  - chunk yang gagal di-merge     → child world-space dipertahankan apa adanya;
   *  - child yang tidak bisa dijalan  → tetap tinggal sebagai hierarchy inst
   *    (transform inst yang benar) dan ikut didaftarkan.
   * `inst` hanya dibuang bila sudah tidak memiliki child yang tersisa.
   */
  private flattenInstToRenderables(inst: AbstractMesh, finalName: string): AbstractMesh[] {
    // Kasus root adalah satu mesh itu sendiri (tanpa child) — pakai langsung.
    if (inst instanceof Mesh && inst.getTotalVertices() > 0 && inst.getChildren().length === 0) {
      return [inst]
    }
    const out: AbstractMesh[] = []
    const toMerge: Mesh[] = []
    // GLB biasanya bertingkat: root → TransformNode → ... → Mesh. Pakai
    // SEMUA descendant mesh (getChildMeshes(false) = rekursif) agar tidak ada
    // geometri yang terlewat, lalu flatten tiap mesh ke world-space
    // (decomposisi transform dari world matrix).
    const nonMerge: Mesh[] = []
    for (const c of inst.getChildMeshes(false)) {
      if (!(c instanceof Mesh)) continue
      if (c.isAnInstance) {
        // InstancedMesh tidak bisa di-MergeMeshes (mengembalikan null) dan sudah
        // berbagi geometri — biarkan apa adanya (tetap dirender, hemat memori).
        nonMerge.push(c)
        continue
      }
      if (!(c instanceof Mesh) || c.getTotalVertices() <= 0) continue
      c.computeWorldMatrix(true)
      try {
        const wm = c.getWorldMatrix()
        const t = new Vector3()
        const q = new Quaternion()
        const scl = new Vector3()
        wm.decompose(scl, q, t)
        c.makeGeometryUnique()
        c.parent = null
        c.position.copyFrom(t)
        c.rotationQuaternion = q
        c.scaling.copyFrom(scl)
        c.computeWorldMatrix(true)
        toMerge.push(c)
      } catch {
        // child yang gagal di-flatten tetap tinggal di bawah inst (transform
        // inst sudah benar saat render) — tidak pernah hilang.
      }
    }

    let mergedCount = 0
    let chunkFail = 0
    const failDetail: string[] = []
    if (toMerge.length > 0) {
      const CHUNK = 250
      for (let i = 0; i < toMerge.length; i += CHUNK) {
        const chunk = toMerge.slice(i, i + CHUNK)
        // MergeMeshes gagal (null) bila dalam satu batch ada perbedaan
        // sideOrientation ATAU beberapa material. Partisi batch per pasangan
        // (sideOrientation, material) dulu: tiap grup homogen sehingga merge
        // plain (bukan multiMultiMaterials) aman dipakai, visual tiap grup tetap
        // material aslinya, dan jumlah mesh per instance berkurang drastis
        // (mis. gedung1: ratusan shell per material → 1 mesh per material).
        const byKey = new Map<string, Mesh[]>()
        for (const m of chunk) {
          const key = `${m.sideOrientation ?? 0}|${m.material ? m.material.uniqueId : 'none'}`
          let arr = byKey.get(key)
          if (!arr) { arr = []; byKey.set(key, arr) }
          arr.push(m)
        }
        for (const group of byKey.values()) {
          let merged: Mesh | null = null
          try {
            merged = Mesh.MergeMeshes(group, false, true, undefined, false, false)
          } catch (err) {
            console.log(`[NgawiMergeErr] ${finalName} n=${group.length} err=${String(err).slice(0, 160)}`)
          }
          if (!merged) {
            const mats = [...new Set(group.map((m) => (m.material ? (m.material as { name?: string }).name || m.material.getClassName() : 'none')))].length
            if (failDetail.length < 3) failDetail.push(`n${group.length} mats${mats} ori[${[...new Set(group.map((m) => m.sideOrientation ?? 0))].join(',')}]`)
            chunkFail++
            out.push(...group)
            continue
          }
          mergedCount++
          merged.name = toMerge.length > CHUNK ? `${finalName}#${i / CHUNK + mergedCount - 1}` : finalName
          merged.parent = null
          merged.position.set(0, 0, 0)
          merged.rotation.set(0, 0, 0)
          merged.scaling.set(1, 1, 1)
          merged.computeWorldMatrix(true)
          group.forEach((m) => m.dispose(false, false))
          out.push(merged)
        }
      }
    }
    out.push(...nonMerge)
    if (this.perfEnabled()) {
      console.log(`[NgawiFlatIn] ${finalName} solids=${toMerge.length} merged=${mergedCount} chunkFail=${chunkFail} skipInst=${nonMerge.length} out=${out.length} fail=[${failDetail.join(' ; ')}]`)
    }

    if (inst.getChildMeshes(false).length === 0) {
      // Semua child geometric sudah dipindah ke world-space (atau inst memang
      // kosong tanpa isi) — buang skeleton node yang tersisa (aman, tidak ada
      // geometri yang tersangkut).
      try { inst.dispose(false, false) } catch { /* aman */ }
    } else {
      // Masih ada isi di bawah inst (child gagal flatten / sub-hierarchy):
      // daftarkan seluruh descendant mesh agar di-set flag dan tetap dirender.
      const desc = inst.getChildMeshes(false)
      if (desc.length > 0) out.push(...desc)
    }
    return out
  }

  /**
   * Buang mesh visual placeholder milik instance (prefix `${instance}_`).
   * Iterasi memakai SALINAN daftar scene agar penghapusan saat iterasi tidak
   * melewati mesh (bug splice-skip) — sebelumnya beberapa balok/atap placeholder
   * kadang tertinggal melayang. Collider statis tidak terikat mesh sehingga tetap.
   */
  private disposePlaceholderVisuals(instance: string): void {
    const prefix = `${instance}_`
    for (const mesh of this.scene.meshes.slice()) {
      if (mesh.name.startsWith(prefix) && !mesh.name.includes('_final')) {
        mesh.dispose()
        const idx = this.meshes.indexOf(mesh)
        if (idx >= 0) this.meshes.splice(idx, 1)
      }
    }
  }

  // ============================================
  // ENVIRONMENT LAYOUT
  // ============================================

  private buildEnvironment(): void {
    let idx = 0
    // Pohon di area hijau & taman (jauh dari jalur jalan)
    const trees: [number, number][] = [
      [-180, -170], [-120, -160], [-80, 150], [40, 170],
      [130, -160], [170, 103], [180, -60], [-185, 161],
      [-20, -70], [20, -70], [-20, 70], [20, 70],
      [-230, 30], [230, 40], [230, 90], [-230, -120], [60, 160],
      // taman & area hijau zona perluasan 1,5× (di luar jalur jalan/bangunan)
      [60, 220], [100, 220], [80, 225], [-60, 220], [-100, 228],
      [-80, -225], [-40, -220], [60, -228], [120, -220],
      [225, 100], [225, -100], [220, 45], [222, 60],
      [-225, 200], [-225, -200], [-220, 130], [-215, -100],
      [15, 222], [-15, 222], [30, 218], [-30, 218],
    ]
    for (const [x, z] of trees) this.createTree(x, z, idx++)

    // Semak (di antara bangunan/tepi jalan, bukan di jalur kendaraan)
    const bushes: [number, number][] = [
      [-90, 150], [90, 150], [60, 110],
      [-90, -80], [130, 110], [30, -90], [-40, -160], [160, 110],
    ]
    for (const [x, z] of bushes) this.createBush(x, z, idx++)

    // Lampu jalan di sisi main_h (z=±11) — hanya x di luar zona perumahan barat.
    const lampX = [-80, -20, 20, 80, 180]
    for (const i of lampX) {
      this.createStreetLamp(i, 11, idx++)
      this.createStreetLamp(i, -11, idx++)
    }
    // Lampu khusus untuk s_e (trotoar di x=130.5 dan 149.5)
    // z=120 dikecualikan utk sisi timur (x=149.5): di z tsb x=149.5 jatuh pada
    // jalan e1 (z 115..131), jadi sisi timur diganti lampu di (151,110) yg aman.
    const s_e_z = [60, -60, -120]
    for (const z of s_e_z) {
      this.createStreetLamp(130.5, z, idx++)
      this.createStreetLamp(149.5, z, idx++)
    }
    this.createStreetLamp(151, 110, idx++)
    // Lampu khusus untuk sch_top (cz=-120, trotoar di z=-110.5 dan -129.5)
    // x=140 dihapus: pada z=-110.5/-129.5 posisi ini jatuh pada jalan s_e.
    for (const x of [-80, -20, 20, 80, 180]) {
      this.createStreetLamp(x, -110.5, idx++)
      this.createStreetLamp(x, -129.5, idx++)
    }

    // Tiang listrik (z=±15 / x=±15), sejajar jalan utama — hindari jalan.
    const poleX = [-80, -20, 40, 100, 160]
    for (const i of poleX) {
      this.createPowerPole(i, 15, idx++)
      this.createPowerPole(i, -15, idx++)
    }
    // Tiang listrik di sekitar ring tengah — z=±60 dipindah ke ±72 karena
    // (±15,±60) jatuh pada jalan i_n/i_s (z 52..68 / -68..-52).
    const poleZ = [72, -72, 120]
    for (const i of poleZ) {
      this.createPowerPole(15, i, idx++)
      this.createPowerPole(-15, i, idx++)
    }

    // Tempat sampah di area sekolah & pertokoan (di luar jalur jalan)
    for (let i = 0; i < 4; i++) this.createTrashBin(30 + i * 6, -108, i)
    this.createTrashBin(130, 15, 4)
    this.createTrashBin(165, 15, 5)

    // Bangku di halaman sekolah & taman (hindari sch_top/sch_bottom)
    this.createBench(42, -105, 0, 0)
    this.createBench(52, -105, 1, 0)
    this.createBench(-90, -180, 2, 0)
    // Bangku taman zona perluasan utara (nr_h ↔ ring_n, di sisi timur main_v)
    // (0,222) dipindah ke (12,224) karena x=0 berada di atas jalan main_v.
    this.createBench(25, 216, 3, 0)
    this.createBench(-25, 216, 4, 0)
    this.createBench(12, 224, 5, 0)

    // Pot tanaman di depan ruko pertokoan (di luar jalur jalan)
    this.createPotPlant(125, 15, 0)
    this.createPotPlant(155, 15, 1)
    this.createPotPlant(25, 18, 2)

    // Rambu lalu lintas dekat zebra (di luar jalur jalan)
    this.createRambu(60, -110, 0)   // dekat zebra sekolah
    this.createRambu(20, 16, 1)     // dekat zebra pusat (main_h)
    this.createRambu(-170, 56, 2)   // dekat zebra permukiman (rs) - di luar jalur rs (z37..53)
  }

  // ============================================
  // NPC PEJALAN KAKI (hanya menyeberang zebra cross)
  // ============================================

  private buildPedestrianRoutes(): void {
    // 1) Pengunjung ruko pertokoan (trotoar utara main_h, z≈9.5, antara sec_w & sec_e).
    this.pedestrians.push({
      id: 1,
      points: [
        { x: -80, z: 9.5 }, { x: 20, z: 9.5 }, { x: 80, z: 9.5 },
        { x: 20, z: 9.5 },
      ],
      speed: 1.1,
      color: new Color3(0.3, 0.5, 0.8),
    })

    // 2) Siswa menuju/dari sekolah: menyeberang HANYA lewat zebra depan
    //    sekolah (sch_top, x=50, z=-120). Jalan sch_top lebar 16m (half 8);
    //    trotoar utara z≈-110.5, selatan z≈-129.5.
    this.pedestrians.push({
      id: 2,
      points: [
        { x: 40, z: -110.5 }, { x: 50, z: -110.5 }, { x: 50, z: -129.5 },
        { x: 40, z: -129.5 }, { x: 50, z: -129.5 }, { x: 50, z: -110.5 },
        { x: 40, z: -110.5 },
      ],
      speed: 1.3,
      color: new Color3(0.9, 0.6, 0.2),
      crossings: [
        { segIndex: 1, axis: 'EW', roadCenter: -120, half: 8 },
        { segIndex: 4, axis: 'EW', roadCenter: -120, half: 8 },
      ],
    })

    // 3) Warga menyeberang main_h di kawasan pusat (zebra x=20, z=0).
    this.pedestrians.push({
      id: 3,
      points: [
        { x: 12, z: 9.5 }, { x: 20, z: 9.5 }, { x: 20, z: -9.5 },
        { x: 12, z: -9.5 }, { x: 20, z: -9.5 }, { x: 20, z: 9.5 },
        { x: 12, z: 9.5 },
      ],
      speed: 1.0,
      color: new Color3(0.6, 0.3, 0.3),
      crossings: [
        { segIndex: 1, axis: 'EW', roadCenter: 0, half: 8 },
        { segIndex: 4, axis: 'EW', roadCenter: 0, half: 8 },
      ],
    })

    // 4) Warga permukiman menyeberang rs (zebra x=-170, z=45). Trotoar
    //    z≈54.5 (utara) & z≈35.5 (selatan) — rs lebar 16m (half 8).
    this.pedestrians.push({
      id: 4,
      points: [
        { x: -170, z: 35.5 }, { x: -170, z: 45 }, { x: -170, z: 54.5 },
        { x: -170, z: 54.5 }, { x: -170, z: 45 }, { x: -170, z: 35.5 },
      ],
      speed: 1.0,
      color: new Color3(0.3, 0.7, 0.5),
      crossings: [
        { segIndex: 1, axis: 'EW', roadCenter: 45, half: 8 },
        { segIndex: 4, axis: 'EW', roadCenter: 45, half: 8 },
      ],
    })
  }

  // ============================================
  // NPC KENDARAAN (hanya di jalur jalan, mengikuti arah lalu lintas)
  // ============================================

  /**
   * Bangun loop "shuttle" sepanjang satu lane lurus dengan putar balik
   * (U-turn) di kedua ujungnya di dalam lebar jalan. Kendaraan selalu berada
   * di atas jalan, dalam satu lane, dan tidak pernah berbalik di tengah.
   * - lane adalah offset lateral dari tengah jalan utk lane yg dituju.
   * - halfRoad = setengah lebar jalan (untuk ruang putar balik).
   */
  private buildShuttle(
    x1: number, x2: number,
    z1: number, z2: number,
    laneOffset: number,
    axis: 'EW' | 'NS',
    turnGap: number
  ): NpcWayPoint[] {
    if (axis === 'EW') {
      // Jalan horizontal: lane bergerak sepanjang X pada Z tetap.
      // U-turn di ujung menggunakan titik ekstra agar tetap di dalam jalan.
      return [
        { x: x1, z: z1 },
        { x: x2, z: z1 },
        { x: x2 + turnGap, z: z1 + laneOffset * 0.4 },
        { x: x2 + turnGap, z: z2 },
        { x: x2, z: z2 },
        { x: x1, z: z2 },
        { x: x1 - turnGap, z: z2 - laneOffset * 0.4 },
        { x: x1 - turnGap, z: z1 },
      ]
    }
    // jalan vertikal: lane bergerak sepanjang Z pada X tetap
    return [
      { x: x1, z: z1 },
      { x: x1, z: z2 },
      { x: x1 + laneOffset * 0.4, z: z2 + turnGap },
      { x: x2, z: z2 + turnGap },
      { x: x2, z: z2 },
      { x: x2, z: z1 },
      { x: x2 - laneOffset * 0.4, z: z1 - turnGap },
      { x: x1, z: z1 - turnGap },
    ]
  }

  private buildNpcVehicles(): void {
    let nextId = 1

    // ── Helper ──────────────────────────────────────────────────────────
    const addTruck = (
      startX: number, startZ: number,
      speed: number,
      color: Color3,
      waypoints: NpcWayPoint[],
      arrivalRadius = 2,
    ) => {
      this.npcVehicles.push({
        id: nextId++,
        startX, startZ, speed, color,
        type: 'truck',
        waypoints,
        arrivalRadius,
      })
    }

    // ── NPC TRUK (Indonesia LHT, hanya di jalur jalan) ─────────────
    // Truk menggunakan sistem waypoint & update yang sama dengan mobil NPC,
    // hanya saja tipe 'truck' dan warnanya kuning-kelelawar khas truk.
    // Truk berkeliling kota dengan beberapa route berbeda agar tidak hanya
    // berputar di satu tempat.

    // Truk 1: lintasan loop ring sekunder (s_n/s_e/s_s/s_w), searah jarum
    // jam = LHT. Lebih besar dari mobil, jadi lane sedikit di luar.
    addTruck(
      -140, 148.5,   // start di s_n (utara, lane sedikit di luar x=-144.5)
      6.5,
      new Color3(0.85, 0.65, 0.15),
      [
        { x: -140, z: 148.5 }, { x: 140, z: 148.5 },      // s_n → timur
        { x: 140, z: 148.5 }, { x: 148.5, z: 140 },       // belok → s_e
        { x: 148.5, z: 140 }, { x: 148.5, z: -140 },      // s_e → selatan
        { x: 148.5, z: -140 }, { x: 140, z: -148.5 },     // belok → s_s
        { x: 140, z: -148.5 }, { x: -140, z: -148.5 },    // s_s → barat
        { x: -140, z: -148.5 }, { x: -148.5, z: -140 },   // belok → s_w
        { x: -148.5, z: -140 }, { x: -148.5, z: 140 },    // s_w → utara
        { x: -148.5, z: 140 }, { x: -140, z: 148.5 },     // belok → s_n (tutup loop)
      ],
      2.5,
    )

    // Truk 2: lintasan main_h timur (lane z=5.5 → +X), shuttle.
    addTruck(
      -180, 5.5,
      7,
      new Color3(0.75, 0.55, 0.05),
      this.buildShuttle(-185, 185, 5.5, -5.5, 5.5, 'EW', 5),
      2,
    )

    // Truk 3: lintasan main_v selatan (lane x=5.5 → -Z), shuttle.
    addTruck(
      5.5, 180,
      6,
      new Color3(0.8, 0.7, 0.2),
      this.buildShuttle(5.5, -5.5, 180, -180, 5.5, 'NS', 5),
      2,
    )

    // Truk 4: koridor pertokoan timur baru (et_a x=195 antara eh_3 & eh_2),
    // naik di lane timur (x=199) lalu turun di lane barat (x=191). LHT.
    addTruck(
      199, 78,
      6.5,
      new Color3(0.7, 0.55, 0.35),
      this.buildShuttle(199, 191, 78, -206, 8, 'NS', 5),
      2,
    )

    // Truk 5: zona utara (nr_h z=200, antara s_w & s_e), shuttle di band
    // perkantoran baru. Pergi ke timur di lane utara (z=196), balik barat (z=204).
    addTruck(
      -136, 196,
      6,
      new Color3(0.6, 0.65, 0.4),
      this.buildShuttle(-136, 136, 196, 204, 4, 'EW', 5),
      2,
    )

    // Truk 6: zona selatan (sr_h z=-200, antara s_w & s_e), shuttle di band
    // sekolah/lapangan. Pergi ke barat di lane selatan (z=-204), balik timur (z=-196).
    addTruck(
      136, -204,
      6,
      new Color3(0.55, 0.6, 0.45),
      this.buildShuttle(136, -136, -204, -196, 4, 'EW', 5),
      2,
    )

    // ── NPC MOBIL (sudah ada, tidak diubah) ───────────────────────
    // 1) Mobil di jalan utama (main_h): lane timur z=4.5 (Z>0 → +X).
    this.npcVehicles.push({
      id: nextId++,
      startX: -180, startZ: 4.5, speed: 6,
      color: new Color3(0.8, 0.2, 0.2),
      type: 'mobil',
      waypoints: this.buildShuttle(-190, 190, 4.5, -4.5, 4.5, 'EW', 6),
      arrivalRadius: 2,
    })
    // 2) Mobil di jalan utama (main_v): lane utara x=-4.5 (X<0 → +Z).
    this.npcVehicles.push({
      id: nextId++,
      startX: -4.5, startZ: -180, speed: 5.5,
      color: new Color3(0.2, 0.4, 0.8),
      type: 'mobil',
      waypoints: this.buildShuttle(-4.5, 4.5, -190, 190, 4.5, 'NS', 6),
      arrivalRadius: 2,
    })
    // 3) Mobil mengelilingi RING ROAD (loop tertutup, lane luar, searah jarum jam = LHT).
    this.npcVehicles.push({
      id: 3,
      startX: -245, startZ: 249.5, speed: 7,
      color: new Color3(0.85, 0.6, 0.1),
      type: 'mobil',
      waypoints: [
        { x: -245, z: 249.5 }, { x: 245, z: 249.5 },      // ring_n → timur (z=249.5)
        { x: 245, z: 249.5 }, { x: 249.5, z: 245 },       // belok → ring_e
        { x: 249.5, z: 245 }, { x: 249.5, z: -245 },      // ring_e → selatan (x=249.5)
        { x: 249.5, z: -245 }, { x: 245, z: -249.5 },     // belok → ring_s
        { x: 245, z: -249.5 }, { x: -245, z: -249.5 },    // ring_s → barat (z=-249.5)
        { x: -245, z: -249.5 }, { x: -249.5, z: -245 },   // belok → ring_w
        { x: -249.5, z: -245 }, { x: -249.5, z: 245 },    // ring_w → utara (x=-249.5)
        { x: -249.5, z: 245 }, { x: -245, z: 249.5 },     // belok → ring_n (tutup loop)
      ],
      arrivalRadius: 2,
    })
    // 4) Mobil berputar mengelilingi LOOP RING TENGAH (i_n/i_e/i_s/i_w), searah jarum jam = LHT.
    this.npcVehicles.push({
      id: 4,
      startX: -55, startZ: -58, speed: 5.5,
      color: new Color3(0.6, 0.3, 0.7),
      type: 'mobil',
      waypoints: [
        { x: -55, z: -58 }, { x: 55, z: -58 },   // i_n utara → timur
        { x: 58, z: -55 }, { x: 58, z: 55 },     // i_e timur → selatan
        { x: 55, z: 58 }, { x: -55, z: 58 },     // i_s selatan → barat
        { x: -58, z: 55 }, { x: -58, z: -55 },   // i_w barat → utara
        { x: -55, z: -58 },
      ],
      arrivalRadius: 1.5,
    })
    // 5) Mobil shuttle di zona SPBU (spbu_a, lane utara z=99 → +X).
    this.npcVehicles.push({
      id: 5,
      startX: 10, startZ: 99, speed: 5,
      color: new Color3(0.2, 0.7, 0.5),
      type: 'mobil',
      waypoints: this.buildShuttle(6, 134, 99, 91, 4, 'EW', 3),
      arrivalRadius: 1.5,
    })
    // 6) Mobil shuttle di perumahan barat (rs, lane utara z=49 → +X).
    this.npcVehicles.push({
      id: 6,
      startX: -180, startZ: 49, speed: 5,
      color: new Color3(0.9, 0.9, 0.2),
      type: 'mobil',
      waypoints: this.buildShuttle(-190, -150, 49, 41, 4, 'EW', 3),
      arrivalRadius: 1.5,
    })

    // 7) Mobil mengelilingi RING SEKUNDER (s_n/s_e/s_s/s_w), searah jarum jam = LHT.
    //    Menyusuri sisi utara (perkantoran), timur (pertokoan), selatan (kota),
    //    barat (perumahan). Setiap waypoint DI JALUR LHT (kiri) pada jalurnya.
    //    Lintasan: s_n timur (z=144.5) → s_e selatan (x=144.5) → s_s barat
    //    (z=-144.5) → s_w utara (x=-144.5).
    this.npcVehicles.push({
      id: nextId++,
      startX: -140, startZ: 144.5, speed: 6.5,
      color: new Color3(0.4, 0.7, 0.9),
      type: 'mobil',
      waypoints: [
        { x: -140, z: 144.5 }, { x: 140, z: 144.5 },      // s_n → timur
        { x: 140, z: 144.5 }, { x: 144.5, z: 140 },       // belok → s_e
        { x: 144.5, z: 140 }, { x: 144.5, z: -140 },      // s_e → selatan
        { x: 144.5, z: -140 }, { x: 140, z: -144.5 },     // belok → s_s
        { x: 140, z: -144.5 }, { x: -140, z: -144.5 },    // s_s → barat
        { x: -140, z: -144.5 }, { x: -144.5, z: -140 },   // belok → s_w
        { x: -144.5, z: -140 }, { x: -144.5, z: 140 },    // s_w → utara
        { x: -144.5, z: 140 }, { x: -140, z: 144.5 },     // belok → s_n (tutup loop)
      ],
      arrivalRadius: 2,
    })

    // 8) Mobil mengelilingi LOOP RING KELILING (s_n + ring_e + s_s + ring_w),
    //    searah jarum jam = LHT. Perjalanan lebih luar dari v7, menyusuri
    //    pertokoan timur & perumahan barat hingga mendekati ring road luar.
    //    Lintasan: s_n timur (z=144.5) → ring_e selatan (x=204.5)
    //    → s_s barat (z=-144.5) → ring_w utara (x=-204.5).
    this.npcVehicles.push({
      id: nextId++,
      startX: -245, startZ: 144.5, speed: 6.5,
      color: new Color3(0.7, 0.5, 0.9),
      type: 'mobil',
      waypoints: [
        { x: -245, z: 144.5 }, { x: 245, z: 144.5 },      // s_n → timur (z=144.5)
        { x: 245, z: 144.5 }, { x: 249.5, z: 140 },       // belok → ring_e (x=249.5)
        { x: 249.5, z: 140 }, { x: 249.5, z: -140 },      // ring_e → selatan
        { x: 249.5, z: -140 }, { x: 245, z: -144.5 },     // belok → s_s
        { x: 245, z: -144.5 }, { x: -245, z: -144.5 },    // s_s → barat (z=-144.5)
        { x: -245, z: -144.5 }, { x: -249.5, z: -140 },   // belok → ring_w (x=-249.5)
        { x: -249.5, z: -140 }, { x: -249.5, z: 140 },    // ring_w → utara
        { x: -249.5, z: 140 }, { x: -245, z: 144.5 },     // belok → s_n (tutup loop)
      ],
      arrivalRadius: 2,
    })
  }
}
