/**
 * ForkliftCargoTest
 * =================
 * Mini cargo test KHUSUS map `forklift-testing` (ADD, DON'T BREAK).
 *
 * OBJECTIVE: pindahkan 12 CARGO dari STORAGE AREA (grid 4 kolom x 3 baris)
 * ke DROP-OFF AREA (12 TARGET SLOT). MISSION COMPLETE saat 12/12.
 *
 *   - PICKUP : fork masuk ke DUA fork pocket di bawah crate (validasi ketat)
 *   - CARRY  : crate ikut FORK via parent TransformNode (naik/turun/tilt)
 *   - DROP   : crate dilepas ke Drop-Off Zone & SNAP ke target slot terdekat
 *
 * ATURAN PENTING:
 * - Box TIDAK PERNAH hilang/hide/dispose/teleport karena ditabrak.
 *   Collision hanya menghentikan KENDARAAN (forklift terhalang), box tetap.
 * - Setiap crate IDLE / LANDED punya collider AABB statis sederhana
 *   (1 collider per crate, mencakup depan/belakang/kiri/kanan/atas).
 *   Saat crate DIANGKAT collider-nya dilepas sementara (agar forklift tidak
 *   menabrak muatannya sendiri) dan dipasang lagi saat diletakkan.
 * - Fork pocket dibuat JAUH lebih besar dari tine nyata agar fork mudah masuk:
 *     tine 0.18 (Z)  × tebal 0.16 (Y), spacing 0.96
 *     slot 0.40 (Z-dir gap) → margin 0.11 per sisi
 * - Progress CARGO (X/12) terpisah dari POINT pelanggaran (collision = 10 pt,
 *   cooldown 1.5 s, di violationStore). Point TIDAK diubah di sini.
 * - R = reset CARGO saja (crate kembali posisi awal, 0/12); point tidak direset.
 *
 * SCOPE: HANYA map forklift-testing. Tidak menyentuh CarPhysics/CarController/
 * HUD/waypoint/violation/NPC global maupun map lain (Solo/Sriwedari/Ngawi).
 * Crate & support primitive Babylon Box — tanpa asset 3D eksternal.
 */

import {
  Scene,
  Vector3,
  Quaternion,
  Color3,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  DynamicTexture,
  AbstractMesh,
  TransformNode,
  Observer,
  KeyboardInfo,
  KeyboardEventTypes,
} from '@babylonjs/core'
import type { SimpleMap } from '../components/SimpleMap'
import type { LightingSetup } from '../components/LightingSetup'
import type { ForkSystem } from './ForkSystem'
import { FORKLIFT_LAYOUT } from '../config/forklift.layout'

// ============================================
// STATE
// ============================================

export type CargoTestState =
  | 'WAITING_FOR_PICKUP'
  | 'PALLET_ATTACHED'
  | 'READY_TO_DROP'
  | 'COMPLETED'

export const CargoTestState = {
  WaitingForPickup: 'WAITING_FOR_PICKUP',
  PalletAttached: 'PALLET_ATTACHED',
  ReadyToDrop: 'READY_TO_DROP',
  Completed: 'COMPLETED',
} as const

// ============================================
// CONFIG (SINGLE SOURCE OF TRUTH)
// ============================================

export interface ForkliftCargoConfig {
  /**
   * Referensi AUDIT ukuran fork nyata dari forkliftbaru.glb (AABB aktual).
   * Dipakai sebagai dasar perhitungan slot — ubah bila model berganti.
   */
  fork: {
    tineWidth: number      // lebar solid tine (Z) — audit 0.18
    tineThickness: number  // tebal tine (Y) — audit 0.16
    tineSpacing: number    // jarak antar pusat tine (Z) — audit 0.96 (±0.48)
    topAtRest: number      // TOP tine dunia saat fork REST — 0.18
    length: number         // panjang bentang tine (X) — audit 1.65
    tipDistance: number    // jarak ujung tine (ForkTip) dari origin model — 3.37
  }
  /** Dimensi BOX/CRATE (peti). Local crate: X = arah spacing fork, Z = arah masuk fork. */
  boxWidth: number
  boxHeight: number        // tinggi total crate (termasuk slot)
  boxDepth: number         // kedalaman crate = kedalaman alur slot

  /** Dua FORK POCKET (alur terbuka di bawah crate).
   *  - width  : lebar bukaan internal (X) — LONGGAR: >> fork.tineWidth
   *  - height : tinggi bukaan internal (Y) — dihitung otomatis =
   *             fork.topAtRest + forkClearance (crate underside = TOP tine + clearance)
   *  - spacing: jarak antar pusat pocket (X) = fork.tineSpacing
   *  - depth  : kedalaman alur (Z) — boxDi dalam
   */
  forkPocketWidth: number
  forkPocketHeight: number
  forkPocketDepth: number
  forkPocketSpacing: number
  /** Spasi visual TOP tine (0.18) ke underside crate saat box diam di tanah. */
  forkClearance: number

  /** Validasi pickup — posisi & alignment forklift relatif crate. */
  pickupTolerance: {
    minDistance: number      // pusat→pusat minimum (maks penetrasi fork, dikunci collider)
    maxDistance: number      // pusat→pusat maksimum (fork masih cukup masuk)
    forwardDotMin: number    // minimal dot(forward, arah ke crate) → crate di depan
    lateralMax: number       // offset lateral agar KEDUA tine masuk pocket
    entryAlignDotMin: number // minimal dot(forward, sumbu pocket crate)
    forkHeightTolerance: number // toleransi tinggi fork (harus REST agar masuk di bawah)
    forkTiltTolerance: number   // toleransi tilt fork (radian)
  }

  /** Daftar posisi box di map forklift-testing (Area A/B/C/D).
   *  `decor: true`  = box tanpa pocket (mis. tumpukan atas) — hanya rintangan solid.
   *  `kind: 'drums'` = tumpukan tong di atas palet (tetap punya 2 slot garpu,
   *                    perilaku angkat sama persis dengan box kayu).
   *  Jumlah item TETAP 12 — ganti jenis saja, tidak menambah count. */
  boxes: Array<{
    x: number
    z: number
    y?: number          // origin Y (untuk tumpukan di atas crate lain)
    yaw?: number        // yaw awal crate (default 0)
    decor?: boolean     // true → solid box tanpa pocket, tidak bisa di-pickup
    kind?: 'crate' | 'drums' // jenis item: peti kayu (default) / tumpukan tong
  }>

  /** Pickup Zone (world) — approach dari arah -Z (heading ±0), fork masuk heading +Z. */
  pickupZone: {
    position: { x: number; z: number }
    guardHalfWidth: number   // setengah lebar kantung pelindung (sumbu X)
    guardDepth: number       // kedalaman kantung dari crate ke belakang (sumbu Z)
  }
  /** Drop-Off Zone (world) — area luas agar beberapa crate bisa berjajar. */
  dropZone: {
    position: { x: number; z: number }
    halfExtentX: number
    halfExtentZ: number
    headingTolerance: number // rad; crate boleh searah (fork mundur keluar)
  }

  attach: {
    forwardOffset: number    // sepanjang +X mesh (arah fork/depan = +X) — fallback
    heightOffset: number     // tinggi root crate saat diangkat — fallback
    carryRotationOffsetY: number // kompensasi orientasi mesh forklift (mesh rot.y = heading - π/2)
    carryGap: number         // spasi natural crate underside → TOP tine saat dibawa (tidak menempel)
  }

  resetKey: string
  debugVisuals: boolean
}

// Tombol yang TIDAK boleh memicu drop (kontrol kendaraan/garpu/kamera) —
// agar box tidak terjatuh saat pemain masih menahan gas/rem/belok.
const FORKLIFT_DROP_BLOCKED_KEYS = new Set([
  'w', 'a', 's', 'd',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'shift', ' ', 'spacebar',
  'v', 'c', 'k', 'x', 'e', 'q',
  't', 'g', 'y', 'h',
  'r',
])

export const FORKLIFT_CARGO_CONFIG: ForkliftCargoConfig = {
  // Audit fork forkliftbaru.glb (AABB nyata, diukur dari GLB).
  fork: {
    tineWidth: 0.18,
    tineThickness: 0.16,
    tineSpacing: 0.96,
    topAtRest: 0.18,
    length: 1.65,
    tipDistance: 3.37,
  },

  // BOX peti: 1.8 × 1.15 × 1.2 m.
  boxWidth: 1.8,
  boxHeight: 1.15,
  boxDepth: 1.2,

  // Pocket LONGGAR dari tine (0.40 vs tine 0.18 → margin 0.11/sisi).
  // height otomatis = topAtRest(0.18) + clearance(0.06) = 0.24.
  forkPocketWidth: 0.4,
  forkPocketHeight: 0.24,
  forkPocketDepth: 1.2,
  forkPocketSpacing: 0.96,
  forkClearance: 0.06,

  // Pickup SEDERHANA (magnet): box OTOMATIS terapasang begitu menyentuh area
  // ujung garpu forklift — tanpa gerbang tinggi/tilt/alignment presisi.
  //   minDistance..maxDistance = jarak DEPAN car origin ↦ pusat box saat snap.
  //   Saat dipasang, box di-snap PERSIS ke dudukan garpu
  //   (getForkAttachLocalPosition) → tine selalu terpusat di pocket box.
  pickupTolerance: {
    minDistance: 2.3,      // ujung garpu mulai menabrak box (collider stop di ~2.8)
    maxDistance: 2.9,      // masih dalam jangkauan garpu
    forwardDotMin: 0.5,    // box cukup di depan forklift
    lateralMax: 1.15,      // masih "menyentuh" garpu walau sedikit miring
    entryAlignDotMin: 0.5,     // legacy — tidak lagi dipakai untuk gate
    forkHeightTolerance: 99,   // legacy — tidak lagi dipakai untuk gate
    forkTiltTolerance: 99,     // legacy — tidak lagi dipakai untuk gate
  },

  // 12 item: grid STORAGE AREA 4 kolom x 3 baris (semua pickupable).
  // Kolom x = FORKLIFT_LAYOUT.cargoColumns, baris z = FORKLIFT_LAYOUT.cargoRows.
  // 10 box kayu + 2 tumpukan tong (kind: 'drums') — semua punya 2 fork pocket
  // & perilaku angkat identik. Pendekatan dari selatan (heading 0).
  boxes: [
    // Kolom 1 (x -13.5)
    { x: -13.5, z: -44 },
    { x: -13.5, z: -35 },
    { x: -13.5, z: -26 },
    // Kolom 2 (x -4.5)
    { x: -4.5, z: -44 },
    { x: -4.5, z: -35, kind: 'drums' },
    { x: -4.5, z: -26 },
    // Kolom 3 (x 4.5)
    { x: 4.5, z: -44 },
    { x: 4.5, z: -35 },
    { x: 4.5, z: -26, kind: 'drums' },
    // Kolom 4 (x 13.5)
    { x: 13.5, z: -44 },
    { x: 13.5, z: -35 },
    { x: 13.5, z: -26 },
  ],

  pickupZone: {
    position: { x: FORKLIFT_LAYOUT.storagePad.x, z: FORKLIFT_LAYOUT.storagePad.z },
    guardHalfWidth: FORKLIFT_LAYOUT.storagePad.halfW,
    guardDepth: FORKLIFT_LAYOUT.storagePad.halfD,
  },
  dropZone: {
    position: { x: FORKLIFT_LAYOUT.dropPad.x, z: FORKLIFT_LAYOUT.dropPad.z },
    halfExtentX: FORKLIFT_LAYOUT.dropPad.halfW,
    halfExtentZ: FORKLIFT_LAYOUT.dropPad.halfD,
    headingTolerance: 1.0,
  },

  attach: {
    forwardOffset: 2.8,
    heightOffset: -0.03,
    // Model menghadap +X (fork = depan = +X). DemoScene set rotation.y =
    // heading - π/2. Crate rot.y = +π/2 → sumbu pocket crate (local +Z)
    // sejajar arah fork → yaw dunia crate = heading (pickup/drop yaw 0).
    carryRotationOffsetY: Math.PI / 2,
    carryGap: 0.03,
  },
  resetKey: 'KeyR',
  debugVisuals: false,
}

// ============================================
// SYMBOL & MATERIAL COSTANTS
// ============================================

const PALETTE = {
  crateWood: new Color3(0.62, 0.44, 0.26),      // body peti
  crateWoodDark: new Color3(0.40, 0.27, 0.15),  // support/pocket
  crateWoodRim: new Color3(0.47, 0.32, 0.17),   // rangka/kornis
  barrelBody: new Color3(0.30, 0.37, 0.44),     // badan tong (biru baja)
  barrelLid: new Color3(0.20, 0.24, 0.30),      // tutup/drum tong
  paletteWood: new Color3(0.55, 0.40, 0.22),    // palet kayu bawah tong
  concrete: new Color3(0.55, 0.55, 0.53),
  markerYellow: new Color3(0.95, 0.8, 0.15),
  rail: new Color3(0.9, 0.75, 0.15),
  targetGreen: new Color3(0.25, 0.75, 0.35),
  completeGreen: new Color3(0.15, 0.9, 0.4),
  signBg: new Color3(0.12, 0.14, 0.2),
  signText: Color3.White(),
} as const

/** Dimensi tong (barrel) untuk tumpukan (kind: 'drums'). */
const DRUM_BARREL_DIAMETER = 0.42
const DRUM_BARREL_HEIGHT = 0.5

// ============================================
// CRATE INSTANCE
// ============================================

type CratePhase = 'idle' | 'attached' | 'landed' | 'decor'

interface CargoCrate {
  id: number
  phase: CratePhase
  pickupable: boolean
  home: Vector3
  homeYaw: number
  root: TransformNode
  colliderMesh: AbstractMesh
  hasCollider: boolean
}

export class ForkliftCargoTest {
  private scene: Scene
  private simpleMap: SimpleMap | null
  private lightingSetup: LightingSetup | null
  private config: ForkliftCargoConfig
  private forkSystem: ForkSystem | null = null

  private state: CargoTestState = CargoTestState.WaitingForPickup
  private deliveredCount = 0

  private crates: CargoCrate[] = []

  // Heading terakhir kendaraan (dipakai yaw box saat di-drop)
  private lastHeading = 0
  // Debounce drop (Auto-repeat keydown ditekan terus menerus)
  private lastDropTime = 0

  // Meshes zona/marker/sign + collider milik guard rails & zona
  private meshes: AbstractMesh[] = []
  private collidersMesh: AbstractMesh[] = []

  // Material drop pad/sign agar bisa diubah saat complete
  private dropPadMat: PBRMaterial | null = null
  private signMat: StandardMaterial | null = null
  private signTexture: DynamicTexture | null = null

  // 12 TARGET SLOT di DROP-OFF AREA (grid) — pad hijau + status terisi
  private slotMeshes: AbstractMesh[] = []
  private slotOccupied: boolean[] = []
  private slotPadMat: PBRMaterial | null = null
  private slotPadMatOff: PBRMaterial | null = null
  private slotPadMatOn: PBRMaterial | null = null

  // Total cargo = jumlah target slot (12)
  private get totalCargo(): number {
    return FORKLIFT_LAYOUT.cargoColumns.length * FORKLIFT_LAYOUT.cargoRows.length
  }

  // Semua material & texture untuk dispose bersih (tanpa bocor)
  private materials: (PBRMaterial | StandardMaterial)[] = []
  private textures: DynamicTexture[] = []

  private keyboardObserver: Observer<KeyboardInfo> | null = null
  private isDisposed = false

  constructor(
    scene: Scene,
    simpleMap: SimpleMap | null,
    lightingSetup: LightingSetup | null,
    config?: Partial<ForkliftCargoConfig>
  ) {
    this.scene = scene
    this.simpleMap = simpleMap
    this.lightingSetup = lightingSetup
    this.config = {
      ...FORKLIFT_CARGO_CONFIG,
      ...config,
      attach: { ...FORKLIFT_CARGO_CONFIG.attach, ...config?.attach },
      pickupTolerance: { ...FORKLIFT_CARGO_CONFIG.pickupTolerance, ...config?.pickupTolerance },
      dropZone: { ...FORKLIFT_CARGO_CONFIG.dropZone, ...config?.dropZone },
      boxes: config?.boxes?.length ? config.boxes : FORKLIFT_CARGO_CONFIG.boxes,
    }
    // Pocket height otomatis dijamin ≥ topAtRest + forkClearance.
    const minPocketH = this.config.fork.topAtRest + this.config.forkClearance
    if (this.config.forkPocketHeight < minPocketH) {
      this.config.forkPocketHeight = minPocketH
    }
  }

  /**
   * Set reference to ForkSystem for dynamic fork height integration.
   */
  setForkSystem(forkSystem: ForkSystem): void {
    this.forkSystem = forkSystem
  }

  // ============================================
  // BUILD TEST AREA
  // ============================================

  buildTestArea(): void {
    this.buildCrates()
    this.buildPickupZone()
    this.buildDropZone()
    this.registerKeys()
    console.log(
      `[ForkliftCargoTest] Test area built: ${this.crates.length} crates (${this.crates.filter((c) => c.pickupable).length} pickupable) + pickup/drop zone`
    )
  }

  // ---------- CRATES (BOX PETI + FORK POCKET) ----------

  private buildCrates(): void {
    this.config.boxes.forEach((def, i) => {
      this.buildCrate(def, i)
    })
  }

  private buildCrate(def: { x: number; z: number; y?: number; yaw?: number; decor?: boolean; kind?: 'crate' | 'drums' }, index: number): void {
    const cfg = this.config
    const name = `cargo_crate_${index}`
    const root = new TransformNode(name, this.scene)
    root.rotationQuaternion = null
    root.position = new Vector3(def.x, def.y ?? 0, def.z)
    root.rotation = new Vector3(0, def.yaw ?? 0, 0)

    const decor = !!def.decor
    const kind = def.kind ?? 'crate'

    const woodBody = this.makeSharedMaterial('cargo_crate_body_mat', PALETTE.crateWood, 0.85)
    const woodSupport = this.makeSharedMaterial('cargo_crate_support_mat', PALETTE.crateWoodDark, 0.9)
    const woodRim = this.makeSharedMaterial('cargo_crate_rim_mat', PALETTE.crateWoodRim, 0.9)

    if (decor) {
      // Spesial: box tumpukan atas — padat (tanpa pocket), solid, tidak di-pickup.
      const body = MeshBuilder.CreateBox(`${name}_body`, {
        width: cfg.boxWidth,
        height: cfg.boxHeight,
        depth: cfg.boxDepth,
      }, this.scene)
      body.material = woodBody
      body.parent = root
      this.lightingSetup?.addShadowCaster(body)
      body.receiveShadows = true
    } else if (kind === 'drums') {
      // Tumpukan tong di atas palet kayu — palet memakai geometri pocket yang
      // SAMA dengan box (2 alur garpu di bawah) sehingga angkatnya identik.
      this.buildDrumsStack(name, root, cfg, woodBody, woodSupport, woodRim)
    } else {
      const pocketH = cfg.forkPocketHeight
      const mainH = Math.max(0.1, cfg.boxHeight - pocketH)
      const halfPocket = cfg.forkPocketWidth / 2 // 0.20
      const halfSpacing = cfg.forkPocketSpacing / 2 // 0.48
      const innerEdge = halfSpacing - halfPocket // 0.28
      const outerEdge = halfSpacing + halfPocket // 0.68
      const legT = 0.14
      const outerLegCenter = outerEdge + legT / 2 // 0.75
      const centerLegW = innerEdge * 2 // 0.56

      // 3 leg support (kiri/center/kanan) → 2 alur terbuka (fork pocket).
      const legs = [
        { n: `${name}_leg_l`, cx: -outerLegCenter, w: legT },
        { n: `${name}_leg_c`, cx: 0, w: centerLegW },
        { n: `${name}_leg_r`, cx: outerLegCenter, w: legT },
      ]
      for (const leg of legs) {
        const m = MeshBuilder.CreateBox(leg.n, {
          width: leg.w,
          height: pocketH,
          depth: cfg.forkPocketDepth,
        }, this.scene)
        m.position = new Vector3(leg.cx, pocketH / 2, 0)
        m.material = woodSupport
        m.parent = root
        this.lightingSetup?.addShadowCaster(m)
        m.receiveShadows = true
      }

      // Body peti utama (di atas pocket).
      const main = MeshBuilder.CreateBox(`${name}_main`, {
        width: cfg.boxWidth,
        height: mainH,
        depth: cfg.boxDepth,
      }, this.scene)
      main.position = new Vector3(0, pocketH + mainH / 2, 0)
      main.material = woodBody
      main.parent = root
      this.lightingSetup?.addShadowCaster(main)
      main.receiveShadows = true

      // Rim bawah + 4 tiang pojok → tampilan peti kayu.
      const rimY = pocketH + 0.04
      const rimH = 0.09
      const rimSpecs = [
        { n: `${name}_rim_l`, pos: new Vector3(-cfg.boxWidth / 2 + 0.03, rimY, 0), size: { width: 0.06, height: rimH, depth: cfg.boxDepth } },
        { n: `${name}_rim_r`, pos: new Vector3(cfg.boxWidth / 2 - 0.03, rimY, 0), size: { width: 0.06, height: rimH, depth: cfg.boxDepth } },
        { n: `${name}_rim_n`, pos: new Vector3(0, rimY, -cfg.boxDepth / 2 + 0.03), size: { width: cfg.boxWidth, height: rimH, depth: 0.06 } },
        { n: `${name}_rim_s`, pos: new Vector3(0, rimY, cfg.boxDepth / 2 - 0.03), size: { width: cfg.boxWidth, height: rimH, depth: 0.06 } },
      ]
      for (const spec of rimSpecs) {
        const m = MeshBuilder.CreateBox(spec.n, spec.size, this.scene)
        m.position = spec.pos
        m.material = woodRim
        m.parent = root
        this.lightingSetup?.addShadowCaster(m)
        m.receiveShadows = true
      }

      const corner = 0.09
      const cornerY = pocketH + mainH / 2
      const cornerPts = [
        new Vector3(-cfg.boxWidth / 2 + corner / 2, cornerY, -cfg.boxDepth / 2 + corner / 2),
        new Vector3(cfg.boxWidth / 2 - corner / 2, cornerY, -cfg.boxDepth / 2 + corner / 2),
        new Vector3(-cfg.boxWidth / 2 + corner / 2, cornerY, cfg.boxDepth / 2 - corner / 2),
        new Vector3(cfg.boxWidth / 2 - corner / 2, cornerY, cfg.boxDepth / 2 - corner / 2),
      ]
      cornerPts.forEach((pos, ci) => {
        const m = MeshBuilder.CreateBox(`${name}_corner_${ci}`, {
          width: corner, height: mainH, depth: corner,
        }, this.scene)
        m.position = pos
        m.material = woodSupport
        m.parent = root
        this.lightingSetup?.addShadowCaster(m)
        m.receiveShadows = true
      })
    }

    // --- Collider AABB solid (satu collider per crate, mencakup seluruh item) ---
    // Invisible: dipakai SimpleMap.checkCollision → forklift terhalang (TIDAK
    // menembus box), box tetap solid di map. Diangkat saat dibawa, dipasang
    // kembali saat diletakkan.
    const col =
      kind === 'drums'
        ? { w: 1.5, d: 1.2, h: cfg.forkPocketHeight + 3 * DRUM_BARREL_HEIGHT }
        : { w: cfg.boxWidth, h: cfg.boxHeight, d: cfg.boxDepth }
    const collider = MeshBuilder.CreateBox(`${name}_collider`, {
      width: col.w,
      height: col.h,
      depth: col.d,
    }, this.scene)
    collider.isVisible = false
    collider.position = new Vector3(0, col.h / 2, 0)
    collider.parent = root

    const crate: CargoCrate = {
      id: index,
      phase: decor ? 'decor' : 'idle',
      pickupable: !decor,
      home: root.position.clone(),
      homeYaw: def.yaw ?? 0,
      root,
      colliderMesh: collider,
      hasCollider: false,
    }
    this.crates.push(crate)

    // Semua box (pickupable maupun decor/tumpukan) solid sejak awal.
    this.syncCollider(crate, true)
  }

  /**
   * Tumpukan tong (barrels) di atas palet kayu ber-pocket — kind: 'drums'.
   * Palet memakai geometri leg/pocket SAMA dengan box kayu (2 alur garpu di
   * ±0.48, lebar 0.40) → garpu masuk & auto-attach identik dengan box.
   * Barrels tersusun piramida 3-2-1 biar kelihatan "tumpukan tong".
   */
  private buildDrumsStack(
    name: string,
    root: TransformNode,
    cfg: ForkliftCargoConfig,
    woodBody: PBRMaterial,
    woodSupport: PBRMaterial,
    woodRim: PBRMaterial
  ): void {
    const pocketH = cfg.forkPocketHeight
    const halfPocket = cfg.forkPocketWidth / 2 // 0.20
    const halfSpacing = cfg.forkPocketSpacing / 2 // 0.48
    const innerEdge = halfSpacing - halfPocket // 0.28
    const outerEdge = halfSpacing + halfPocket // 0.68
    const legT = 0.14
    const outerLegCenter = outerEdge + legT / 2 // 0.75
    const centerLegW = innerEdge * 2 // 0.56

    // 3 leg palet (sama dengan box) → 2 alur terbuka untuk garpu.
    const legs = [
      { n: `${name}_leg_l`, cx: -outerLegCenter, w: legT },
      { n: `${name}_leg_c`, cx: 0, w: centerLegW },
      { n: `${name}_leg_r`, cx: outerLegCenter, w: legT },
    ]
    for (const leg of legs) {
      const m = MeshBuilder.CreateBox(leg.n, {
        width: leg.w,
        height: pocketH,
        depth: cfg.forkPocketDepth,
      }, this.scene)
      m.position = new Vector3(leg.cx, pocketH / 2, 0)
      m.material = woodSupport
      m.parent = root
      this.lightingSetup?.addShadowCaster(m)
      m.receiveShadows = true
    }

    // Lantai palet tempat tong berdiri (mengunci underside = pocketH).
    const paletteMat = this.makeSharedMaterial('cargo_palette_mat', PALETTE.paletteWood, 0.85)
    const shelf = MeshBuilder.CreateBox(`${name}_shelf`, {
      width: 1.5,
      height: 0.12,
      depth: 1.2,
    }, this.scene)
    shelf.position = new Vector3(0, pocketH - 0.06, 0)
    shelf.material = paletteMat
    shelf.parent = root
    this.lightingSetup?.addShadowCaster(shelf)
    shelf.receiveShadows = true

    // Papan atas palet (rim kayu tipis) supaya terlihat seperti palet.
    const rimH = 0.06
    const rim = MeshBuilder.CreateBox(`${name}_shelf_rim`, {
      width: 1.5,
      height: rimH,
      depth: 1.2,
    }, this.scene)
    rim.position = new Vector3(0, pocketH - 0.03, 0)
    rim.material = woodRim
    rim.parent = root
    this.lightingSetup?.addShadowCaster(rim)
    rim.receiveShadows = true

    // Tumpukan tong piramida 3-2-1 (tinggi total 3 × barrel).
    const bodyMat = this.makeSharedMaterial('cargo_barrel_body_mat', PALETTE.barrelBody, 0.65)
    const lidMat = this.makeSharedMaterial('cargo_barrel_lid_mat', PALETTE.barrelLid, 0.7)
    const layersZ: number[][] = [
      [-0.32, 0, 0.32],
      [-0.16, 0.16],
      [0],
    ]
    layersZ.forEach((row, layer) => {
      const baseY = pocketH + layer * DRUM_BARREL_HEIGHT
      for (const zOff of row) {
        const barrelName = `${name}_drum_l${layer}_z${zOff.toFixed(2).replace('.', '')}`
        const body = MeshBuilder.CreateCylinder(barrelName, {
          height: DRUM_BARREL_HEIGHT - 0.04,
          diameter: DRUM_BARREL_DIAMETER,
          tessellation: 24,
        }, this.scene)
        body.position = new Vector3(0, baseY + DRUM_BARREL_HEIGHT / 2, zOff)
        body.material = bodyMat
        body.parent = root
        this.lightingSetup?.addShadowCaster(body)
        body.receiveShadows = true

        const lid = MeshBuilder.CreateCylinder(`${barrelName}_lid`, {
          height: 0.04,
          diameter: DRUM_BARREL_DIAMETER - 0.04,
          tessellation: 24,
        }, this.scene)
        lid.position = new Vector3(0, baseY + DRUM_BARREL_HEIGHT - 0.02, zOff)
        lid.material = lidMat
        lid.parent = root
        lid.receiveShadows = true
      }
    })
  }

  private makeSharedMaterial(name: string, color: Color3, roughness: number): PBRMaterial {
    const m = this.materials.find((mm) => mm.name === name) as PBRMaterial | undefined
    if (m) return m
    const mat = new PBRMaterial(name, this.scene)
    mat.albedoColor = color
    mat.metallic = 0
    mat.roughness = roughness
    this.materials.push(mat)
    return mat
  }

  /**
   * Pasa/lepas collider statis crate di SimpleMap.
   * active=true  → box SOLID (idle / landed / decor) — forklift terhalang.
   * active=false → saat crate DIANGKUT forklift (muatan sendiri, jangan
   *                 menabrak kendaraan).
   */
  private syncCollider(crate: CargoCrate, active: boolean): void {
    if (!this.simpleMap) return
    if (active && !crate.hasCollider) {
      crate.root.computeWorldMatrix(true)
      crate.colliderMesh.computeWorldMatrix(true)
      this.simpleMap.addStaticCollider(crate.colliderMesh)
      crate.hasCollider = true
    } else if (!active && crate.hasCollider) {
      this.simpleMap.removeStaticCollider(crate.colliderMesh)
      crate.hasCollider = false
    }
  }

  // ---------- PICKUP / STORAGE AREA ----------

  private buildPickupZone(): void {
    const zone = this.config.pickupZone
    const cx = zone.position.x
    const cz = zone.position.z
    const halfW = zone.guardHalfWidth
    const halfD = zone.guardDepth

    // Floor pad (STORAGE AREA) — koridor terbuka, tanpa guard rail.
    const pad = MeshBuilder.CreateGround('cargo_pickup_pad', {
      width: halfW * 2,
      height: halfD * 2,
    }, this.scene)
    pad.position = new Vector3(cx, 0.01, cz)
    const padMat = new PBRMaterial('cargo_pickup_pad_mat', this.scene)
    padMat.albedoColor = PALETTE.concrete
    padMat.metallic = 0.1
    padMat.roughness = 0.9
    pad.material = padMat
    this.materials.push(padMat)
    pad.receiveShadows = true
    this.meshes.push(pad)

    // Border strips (kuning)
    this.createMarkerStrips(cx, cz, halfW, halfD)

    // Entry line + stub kolom: panduan align ke tiap baris/kolom cargo.
    const guideMat = this.makeSharedMaterial('cargo_pickup_guide_mat', PALETTE.markerYellow, 0.5)

    const entry = MeshBuilder.CreateBox('cargo_pickup_entry', {
      width: halfW * 2 + 1,
      height: 0.06,
      depth: 0.3,
    }, this.scene)
    entry.position = new Vector3(cx, 0.03, cz - halfD - 0.5)
    entry.material = guideMat
    entry.receiveShadows = true
    this.meshes.push(entry)

    for (const col of FORKLIFT_LAYOUT.cargoColumns) {
      const stub = MeshBuilder.CreateBox(`cargo_pickup_guide_${col}`, {
        width: 0.35,
        height: 0.06,
        depth: 1.6,
      }, this.scene)
      stub.position = new Vector3(cx + col - FORKLIFT_LAYOUT.storagePad.x, 0.03, cz - halfD - 1.4)
      stub.material = guideMat
      stub.receiveShadows = true
      this.meshes.push(stub)
    }

    // Sign "PICKUP" di sisi barat (menghadap timur — ke arah pemain).
    this.meshes.push(
      this.createSignPlane('PICKUP', 'cargo_pickup_sign', cx - halfW - 0.5, 3.0, cz, Math.PI / 2, 5, 1.0)
    )
  }

  // ---------- DROP-OFF ZONE ----------

  private buildDropZone(): void {
    const zone = this.config.dropZone
    const cx = zone.position.x
    const cz = zone.position.z
    const halfW = zone.halfExtentX
    const halfD = zone.halfExtentZ

    // Floor pad (emissive hijau → berubah saat complete)
    const pad = MeshBuilder.CreateGround('cargo_drop_pad', {
      width: halfW * 2,
      height: halfD * 2,
    }, this.scene)
    pad.position = new Vector3(cx, 0.01, cz)
    this.dropPadMat = new PBRMaterial('cargo_drop_pad_mat', this.scene)
    this.dropPadMat.albedoColor = PALETTE.targetGreen
    this.dropPadMat.metallic = 0.1
    this.dropPadMat.roughness = 0.85
    pad.material = this.dropPadMat
    this.materials.push(this.dropPadMat)
    pad.receiveShadows = true
    this.meshes.push(pad)

    // Target outline
    this.createMarkerStrips(cx, cz, halfW, halfD)

    // 12 TARGET SLOT (grid 4 kolom x 3 baris) — pad hijau tipis di permukaan.
    this.slotPadMatOff = this.makeSharedMaterial('cargo_slot_off_mat', PALETTE.targetGreen, 0.5)
    this.slotPadMatOff.emissiveColor = PALETTE.targetGreen
    this.slotPadMatOff.emissiveIntensity = 0.45
    this.slotPadMatOn = this.makeSharedMaterial('cargo_slot_on_mat', PALETTE.completeGreen, 0.4)
    this.slotPadMatOn.emissiveColor = PALETTE.completeGreen
    this.slotPadMatOn.emissiveIntensity = 0.7

    let idx = 0
    for (const col of FORKLIFT_LAYOUT.slotColumns) {
      for (const row of FORKLIFT_LAYOUT.slotRows) {
        const slot = MeshBuilder.CreateBox(`cargo_slot_${idx}`, {
          width: 3.0,
          height: 0.06,
          depth: 2.3,
        }, this.scene)
        slot.position = new Vector3(
          cx + col - FORKLIFT_LAYOUT.dropPad.x,
          0.035,
          cz + row - FORKLIFT_LAYOUT.dropPad.z
        )
        slot.material = this.slotPadMatOff
        slot.receiveShadows = true
        this.meshes.push(slot)
        this.slotMeshes.push(slot)
        idx++
      }
    }
    this.slotOccupied = new Array(idx).fill(false)

    // Sign (counter diperbarui via updateSign saat delivered)
    this.meshes.push(
      this.createSignPlane('DROP-OFF AREA', 'cargo_drop_sign', cx + halfW + 0.5, 3.0, cz, -Math.PI / 2, 6, 1.1)
    )

    // Debug: drop bounds wireframe (opsional)
    if (this.config.debugVisuals) {
      const w = MeshBuilder.CreateBox('cargo_debug_drop_bounds', {
        width: zone.halfExtentX * 2,
        height: 0.1,
        depth: zone.halfExtentZ * 2,
      }, this.scene)
      w.position = new Vector3(cx, 0.06, cz)
      w.material = this.dropPadMat
      this.meshes.push(w)
    }
  }

  // ---------- HELPERS ----------

  /** Marker strips kuning membentuk garis tepi zona (4 strip tipis). */
  private createMarkerStrips(cx: number, cz: number, halfW: number, halfD: number): void {
    const mat = this.makeSharedMaterial(`cargo_marker_mat_${cx}_${cz}`, PALETTE.markerYellow, 0.6)

    const specs = [
      { x: 0, z: cz - halfD, w: halfW * 2, d: 0.18 },
      { x: 0, z: cz + halfD, w: halfW * 2, d: 0.18 },
      { x: cx - halfW, z: 0, w: 0.18, d: halfD * 2 },
      { x: cx + halfW, z: 0, w: 0.18, d: halfD * 2 },
    ]
    specs.forEach((s, i) => {
      const strip = MeshBuilder.CreateBox(`cargo_marker_strip_${i}_${cx}_${cz}`, {
        width: s.w, height: 0.06, depth: s.d,
      }, this.scene)
      strip.position = new Vector3(s.x, 0.03, s.z)
      strip.material = mat
      strip.receiveShadows = true
      this.meshes.push(strip)
    })
  }

  /** Plane dengan DynamicTexture berisi teks (double-sided). */
  private createSignPlane(text: string, name: string, x: number, y: number, z: number, rotY: number, w: number, h: number): AbstractMesh {
    const plane = MeshBuilder.CreatePlane(name, { width: w, height: h }, this.scene)
    plane.position = new Vector3(x, y, z)
    plane.rotation.y = rotY

    this.signMat = new StandardMaterial(`${name}_mat`, this.scene)
    this.signTexture = this.makeSignTexture(`${name}_tex`, text, 512, 128)
    this.signMat.diffuseTexture = this.signTexture
    this.signMat.backFaceCulling = false
    this.signMat.emissiveColor = PALETTE.signText
    this.signMat.diffuseColor = PALETTE.signText
    plane.material = this.signMat
    this.materials.push(this.signMat)
    this.textures.push(this.signTexture)
    return plane
  }

  private makeSignTexture(name: string, text: string, w: number, h: number): DynamicTexture {
    const tex = new DynamicTexture(name, { width: w, height: h }, this.scene, true)
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
    ctx.fillStyle = '#1d2333'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#e5d43c'
    ctx.lineWidth = 8
    ctx.strokeRect(6, 6, w - 12, h - 12)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 44px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2)
    tex.update()
    return tex
  }

  private updateSign(text: string): void {
    if (!this.signMat) return
    const old = this.signMat.diffuseTexture
    if (old) {
      this.textures = this.textures.filter((t) => t !== old)
      old.dispose()
    }
    const tex = this.makeSignTexture('cargo_sign_tex', text, 512, 128)
    this.textures.push(tex)
    this.signMat.diffuseTexture = tex
    this.signTexture = tex
  }

  private registerKeys(): void {
    this.keyboardObserver = this.scene.onKeyboardObservable.add((info) => {
      if (info.type !== KeyboardEventTypes.KEYDOWN) return

      // Reset penuh (R) selalu jalan — termasuk saat sedang membawa box.
      if (info.event.code === this.config.resetKey) {
        this.reset()
        return
      }

      const attached = this.crates.find((c) => c.phase === 'attached')
      if (!attached) return

      // Drop muatan = tekan key APA SAJA, tetapi:
      //  - abaikan auto-repeat (tombol gas/rem yang ditahan tidak boleh
      //    langsung menjatuhkan box yang baru saja terpasang), dan
      //  - abaikan tombol kendali (gas/rem/belok/kamera/garpu/reset).
      if ((info.event as KeyboardEvent).repeat) return
      const key = (info.event.key ?? '').toLowerCase()
      if (FORKLIFT_DROP_BLOCKED_KEYS.has(key)) return

      const now = performance.now()
      if (now - this.lastDropTime > 300) {
        this.lastDropTime = now
        this.dropCrate(attached, this.lastHeading)
      }
    })
  }

  /** Drop the held crate from a mapped external control (for example R2). */
  dropAttachedCrate(heading: number): boolean {
    if (this.isDisposed) return false
    const attached = this.crates.find((crate) => crate.phase === 'attached')
    if (!attached) return false
    const now = performance.now()
    if (now - this.lastDropTime <= 300) return false
    this.lastDropTime = now
    this.lastHeading = heading
    this.dropCrate(attached, heading)
    return true
  }

  // ============================================
  // UPDATE LOOP (dipanggil tiap frame dari DemoScene)
  // ============================================

  update(carMesh: AbstractMesh, position: Vector3, heading: number, _dt: number): void {
    if (this.isDisposed) return

    this.lastHeading = heading

    // 1) Crate yang sedang DIBAWA — drop hanya lewat TOMBOL (key apa saja).
    const attached = this.crates.find((c) => c.phase === 'attached')
    if (attached) {
      if (this.forkSystem && attached.root.parent !== this.forkSystem.getPivot()) {
        // Fallback (fork system tidak tersedia): crate mengikuti body forklift.
        const forkH = this.forkSystem.getForkHeight()
        attached.root.position.y = this.config.attach.heightOffset + forkH
      }
      // Path utama (parent = tiltPivot) otomatis mengikuti lift/tilt — tanpa override.
      return
    }

    // 2) Tidak ada muatan — coba pickup box (idle ATAU landed, yang masih bisa).
    for (const crate of this.crates) {
      if (!crate.pickupable || crate.phase === 'decor' || crate.phase === 'attached') continue
      if (this.canPickup(crate, position, heading)) {
        this.attachCrate(crate, carMesh)
        return
      }
    }
  }

  // ---------- VALIDATION ----------

  private canPickup(crate: CargoCrate, carPos: Vector3, heading: number): boolean {
    const cratePos = crate.root.getAbsolutePosition()

    const dx = cratePos.x - carPos.x
    const dz = cratePos.z - carPos.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < 1e-6) return false

    // 1) Jarak DEPAN (car origin → pusat box) harus menyentuh jangkauan garpu.
    const fwdX = Math.sin(heading)
    const fwdZ = Math.cos(heading)
    const forward = (fwdX * dx + fwdZ * dz)
    const min = this.config.pickupTolerance.minDistance
    const max = this.config.pickupTolerance.maxDistance
    if (forward < min || forward > max) return false

    // 2) Box harus cukup di DEPAN forklift (bukan di samping/belakang).
    const toX = dx / dist
    const toZ = dz / dist
    if (fwdX * toX + fwdZ * toZ < this.config.pickupTolerance.forwardDotMin) return false

    // 3) Offset lateral garpu↔box tidak terlalu jauh (masih menyentuh).
    const lateral = Math.abs(fwdX * dz - fwdZ * dx)
    if (lateral > this.config.pickupTolerance.lateralMax) return false

    return true
  }

  private isInsideDropZone(x: number, z: number): boolean {
    const zone = this.config.dropZone
    return (
      Math.abs(x - zone.position.x) <= zone.halfExtentX &&
      Math.abs(z - zone.position.z) <= zone.halfExtentZ
    )
  }

  // ---------- ACTIONS ----------

  /**
   * Ukur posisi garpu di DUNIA langsung dari mesh tine asli di scene
   * (anak tiltPivot). Ini tidak bergantung pada asumsi koordinat lokal
   * internal ForkSystem → box SELALU menempel persis di garpu yang terlihat.
   * Mengembalikan titik tengah atas tine + yaw dunia crate agar pocket-nya
   * sejajar dengan tine. null bila tine tidak ditemukan.
   */
  private findForkDockWorld(carryGap: number): { pos: Vector3; yaw: number } | null {
    const pivot = this.forkSystem?.getPivot()
    if (!pivot) return null

    // Tine = mesh bernama "Fork_..." (body tine saja, bukan ForkTip/ForkHeel).
    const bladeCenters: { x: number; y: number; z: number }[] = []
    for (const mesh of this.scene.meshes) {
      if (!(mesh instanceof AbstractMesh)) continue
      if (!/^Fork_/.test(mesh.name)) continue
      if (/Steer/i.test(mesh.name)) continue
      mesh.computeWorldMatrix(true)
      const p = mesh.getAbsolutePosition()
      bladeCenters.push({ x: p.x, y: p.y, z: p.z })
    }
    if (bladeCenters.length === 0) return null

    let midX = 0
    let midZ = 0
    let bladeTopY = -Infinity
    for (const b of bladeCenters) {
      midX += b.x
      midZ += b.z
      if (b.y > bladeTopY) bladeTopY = b.y
    }
    midX /= bladeCenters.length
    midZ /= bladeCenters.length
    // Atas tine = center tine + setengah tebal tine (0.08) + gap bawa.
    bladeTopY += 0.08 + carryGap

    // Yaw dunia pivot (rotasi-Y) → yaw crate = pivotYaw + 90° agar sumbu
    // pocket crate (±0.48) sejajar arah memanjang tine.
    pivot.computeWorldMatrix(true)
    const scale = new Vector3()
    const rot = new Quaternion()
    const worldPos = new Vector3()
    pivot.getWorldMatrix().decompose(scale, rot, worldPos)
    const yaw = rot.toEulerAngles().y + Math.PI / 2

    return { pos: new Vector3(midX, bladeTopY, midZ), yaw }
  }

  private attachCrate(crate: CargoCrate, carMesh: AbstractMesh): void {
    if (!crate.root) return
    const cfg = this.config.attach

    // Muatan ikut FORK: naik/turun (T/G) & tilt (Y/H) terbawa otomatis karena
    // crate di-parent ke pivot garpu; body/roda/chassis tidak bergerak.
    const pivot = this.forkSystem?.getPivot() ?? null

    if (pivot) {
      // Buang collider muatan sendiri agar forklift tidak "menabrak" muatannya.
      this.syncCollider(crate, false)

      // PATH A (utama): posisi garpu diukur LANGSUNG dari mesh tine nyata.
      const dock = this.findForkDockWorld(cfg.carryGap)
      if (dock) {
        // Tempatkan crate pada titik tengah-atas tine (dunia) lalu re-parent
        // world-preserving → box PERSIS di atas garpu yang terlihat & ikut
        // naik/turun/tilt. Tidak ada tebakan koordinat lokal.
        crate.root.setParent(null)
        crate.root.rotationQuaternion = null
        crate.root.position = dock.pos
        crate.root.rotation.set(0, dock.yaw, 0)
        crate.root.computeWorldMatrix(true)
        crate.root.setParent(pivot, true)
      } else if (this.forkSystem && this.forkSystem.hasForkNodes()) {
        // PATH B (backup): dudukan terhitung internal ForkSystem.
        crate.root.parent = pivot
        crate.root.rotationQuaternion = null
        const seat = this.forkSystem.getForkAttachLocalPosition(this.config.forkPocketHeight)
        crate.root.position = new Vector3(seat.x, seat.y + cfg.carryGap, seat.z)
        crate.root.rotation.set(0, cfg.carryRotationOffsetY, 0)
      } else {
        // Pivot ada tapi garpu tidak terdeteksi sama sekali → ikut body.
        crate.root.setParent(carMesh)
        crate.root.rotationQuaternion = null
        crate.root.position = new Vector3(cfg.forwardOffset, cfg.heightOffset, 0)
        crate.root.rotation.set(0, cfg.carryRotationOffsetY, 0)
      }
    } else {
      // Fallback (forkSystem tidak tersedia): tempel di mesh forklift.
      this.syncCollider(crate, false)
      crate.root.parent = carMesh
      crate.root.rotationQuaternion = null
      crate.root.position = new Vector3(cfg.forwardOffset, cfg.heightOffset, 0)
      crate.root.rotation.set(0, cfg.carryRotationOffsetY, 0)
    }

    crate.phase = 'attached'
    this.state = CargoTestState.PalletAttached
    console.log(
      `[ForkliftCargoTest] Crate #${crate.id} ATTACHED @ (${crate.root
        .getAbsolutePosition()
        .x.toFixed(1)}, ${crate.root.getAbsolutePosition().z.toFixed(1)})`
    )
  }

  private dropCrate(crate: CargoCrate, heading: number): void {
    const pos = crate.root.getAbsolutePosition()

    // Lepas attachment — box menjadi objek statis biasa (solid).
    crate.root.setParent(null)
    crate.root.rotationQuaternion = null

    let x = pos.x
    let z = pos.z
    let snapped = false

    // Di dalam DROP-OFF AREA → SNAP ke target slot bebas terdekat (yaw 0,
    // searah pendekatan — fork mundur keluar saat cargo sudah di slot).
    if (this.isInsideDropZone(pos.x, pos.z)) {
      const slot = this.findFreeSlot(pos.x, pos.z)
      if (slot) {
        x = slot.x
        z = slot.z
        this.slotOccupied[slot.index] = true
        snapped = true
        crate.root.rotation.set(0, 0, 0)
      }
    }

    // Di luar drop zone (atau semua slot penuh) → titik drop bebas biasa.
    if (!snapped) {
      const spot = this.findFreeDropSpot(pos.x, pos.z)
      x = spot.x
      z = spot.z
      crate.root.rotation.set(0, heading, 0)
    }

    crate.root.position = new Vector3(x, 0, z)
    crate.root.computeWorldMatrix(true)

    crate.phase = 'landed'
    this.syncCollider(crate, true)

    // Delivered = berhasil SNAP ke target slot (hitung ulang dari slot penuh).
    if (snapped) {
      this.deliveredCount = this.slotOccupied.filter((v) => v).length
      this.state =
        this.deliveredCount >= this.totalCargo
          ? CargoTestState.Completed
          : CargoTestState.ReadyToDrop
      this.onDelivered()
    }
    console.log(`[ForkliftCargoTest] Crate #${crate.id} DROPPED @ (${x.toFixed(1)}, ${z.toFixed(1)}) — delivered total ${this.deliveredCount}`)
  }

  /**
   * Cari TARGET SLOT bebas terdekat dari posisi drop (grid 12 slot).
   * null bila seluruh 12 slot sudah terisi.
   */
  private findFreeSlot(px: number, pz: number): { index: number; x: number; z: number } | null {
    let best: { index: number; x: number; z: number; d: number } | null = null
    let idx = 0
    for (const col of FORKLIFT_LAYOUT.slotColumns) {
      for (const row of FORKLIFT_LAYOUT.slotRows) {
        if (!this.slotOccupied[idx]) {
          const sx = this.config.dropZone.position.x + col - FORKLIFT_LAYOUT.dropPad.x
          const sz = this.config.dropZone.position.z + row - FORKLIFT_LAYOUT.dropPad.z
          const d = (sx - px) * (sx - px) + (sz - pz) * (sz - pz)
          if (!best || d < best.d) {
            best = { index: idx, x: sx, z: sz, d }
          }
        }
        idx++
      }
    }
    return best
  }

  /**
   * Cari titik drop dalam Drop-Off Zone yang tidak bentrok dengan crate yang
   * sudah diletakkan (agar beberapa box bisa berjajar di pad, tidak menumpuk).
   */
  private findFreeDropSpot(px: number, pz: number): { x: number; z: number } {
    const zone = this.config.dropZone
    const landed = this.crates.filter((c) => c.phase === 'landed')
    const inBound = (x: number, z: number) =>
      Math.abs(x - zone.position.x) <= zone.halfExtentX &&
      Math.abs(z - zone.position.z) <= zone.halfExtentZ
    const overlapsLanded = (x: number, z: number) =>
      landed.some(
        (c) =>
          Math.abs(x - c.root.position.x) < this.config.boxWidth - 0.2 &&
          Math.abs(z - c.root.position.z) < this.config.boxDepth - 0.2
      )

    if (inBound(px, pz) && !overlapsLanded(px, pz)) {
      return { x: px, z: pz }
    }

    const candidates: Array<{ x: number; z: number }> = [
      { x: 0, z: 0 },
      { x: 2.8, z: 0 }, { x: -2.8, z: 0 },
      { x: 0, z: 2.4 }, { x: 0, z: -2.4 },
      { x: 2.8, z: 2.4 }, { x: -2.8, z: 2.4 },
      { x: 2.8, z: -2.4 }, { x: -2.8, z: -2.4 },
    ]
    for (const off of candidates) {
      const x = px + off.x
      const z = pz + off.z
      if (inBound(x, z) && !overlapsLanded(x, z)) {
        return { x, z }
      }
    }
    // Fallback: tetap tempatkan di posisi saat ini (jarang terjadi, kapasitas pad penuh).
    return { x: px, z: pz }
  }

  private onDelivered(): void {
    this.syncSlotColors()
    if (this.deliveredCount >= this.totalCargo && this.dropPadMat) {
      this.dropPadMat.albedoColor = PALETTE.completeGreen
      this.dropPadMat.emissiveColor = PALETTE.completeGreen
      this.dropPadMat.emissiveIntensity = 0.55
    }
    this.updateSign(`${this.deliveredCount} / ${this.totalCargo} \u2713`)
  }

  /** Sinkronkan warna pad slot: hijau terang = terisi, targetGreen = kosong. */
  private syncSlotColors(): void {
    this.slotMeshes.forEach((m, i) => {
      m.material = this.slotOccupied[i] ? this.slotPadMatOn : this.slotPadMatOff
    })
  }

  // ---------- RESET ----------

  /**
   * Reset LATIHAN: semua crate dikembalikan ke posisi awal (R). Ini adalah
   * reset MANUAL test — BUKAN dipicu oleh collision; box tidak pernah
   * hilang karena ditabrak.
   */
  reset(): void {
    for (const crate of this.crates) {
      if (crate.root.parent) {
        crate.root.setParent(null)
      }
      this.syncCollider(crate, false)

      crate.root.rotationQuaternion = null
      crate.root.position = crate.home.clone()
      crate.root.rotation.set(0, crate.homeYaw, 0)
      crate.root.computeWorldMatrix(true)

      if (crate.phase !== 'decor') {
        crate.phase = 'idle'
      }
      this.syncCollider(crate, crate.pickupable || crate.phase === 'decor')
    }

    this.deliveredCount = 0
    this.slotOccupied = new Array(this.totalCargo).fill(false)
    this.syncSlotColors()
    this.state = CargoTestState.WaitingForPickup

    if (this.dropPadMat) {
      this.dropPadMat.emissiveColor = new Color3(0, 0, 0)
      this.dropPadMat.emissiveIntensity = 0
      this.dropPadMat.albedoColor = PALETTE.targetGreen
    }
    this.updateSign('DROP-OFF AREA')

    console.log('[ForkliftCargoTest] TEST RESET → semua crate kembali ke posisi awal')
  }

  // ---------- INFO ----------

  getState(): CargoTestState {
    return this.state
  }

  isComplete(): boolean {
    return this.state === CargoTestState.Completed
  }

  getCrateCount(): number {
    return this.crates.length
  }

  getDeliveredCount(): number {
    return this.deliveredCount
  }

  /** Total cargo / target slot (12). */
  getTotalCargo(): number {
    return this.totalCargo
  }

  // ---------- DISPOSE ----------

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    if (this.keyboardObserver) {
      this.scene.onKeyboardObservable.remove(this.keyboardObserver)
      this.keyboardObserver = null
    }

    // Lepas collider crate & crate dari forklift agar tidak ikut dibuang dua kali
    for (const crate of this.crates) {
      this.syncCollider(crate, false)
      if (crate.root.parent) crate.root.setParent(null)
      crate.root.dispose()
    }
    this.crates = []

    this.meshes.forEach((m) => m.dispose())
    this.meshes = []

    // Hapus collider statis milik guard rails dari SimpleMap
    if (this.simpleMap) {
      this.collidersMesh.forEach((m) => this.simpleMap!.removeStaticCollider(m))
    }
    this.collidersMesh = []

    this.materials.forEach((m) => m.dispose())
    this.materials = []
    this.textures.forEach((t) => t.dispose())
    this.textures = []
    this.dropPadMat = null
    this.signMat = null
    this.signTexture = null

    console.log('[ForkliftCargoTest] Disposed')
  }
}
