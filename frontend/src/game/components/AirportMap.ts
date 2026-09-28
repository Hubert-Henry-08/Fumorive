import {
  Scene,
  Vector3,
  Quaternion,
  Color3,
  MeshBuilder,
  StandardMaterial,
  AbstractMesh,
  Mesh,
  SceneLoader,
} from '@babylonjs/core'
import { LightingSetup } from './LightingSetup'
import type { SpawnPoint } from '../types'
import { PESAWAT_TESTING_CONFIG } from '../config/map.config'

export interface Collider {
  min: Vector3
  max: Vector3
  mesh?: AbstractMesh
}

interface ModelEntry {
  instance: string
  x: number
  z: number
  asset: string
  footW: number
  footD: number
  maxHeight: number
}

/**
 * AirportMap (Pesawat Testing)
 * ============================
 * Layout khusus testing penerbangan Vultee BT-13 Valiant.
 *
 * ATURAN KINEMATIK:
 *  - Runway membentang searah sumbu +Z, spawn di apron (0,0,-200) heading 0
 *    (pesawat menuju +Z / arah utara). Rute PESAWAT_ROUTE_1 (sirkuit terbang
 *    10 checkpoint udara) melintasi x=0 hanya saat takeoff & final approach.
 *  - SEMUA bangunan/rumah/jalan/tanaman diletakkan JAUH dari koridor terbang
 *    x≈0 (minimal x ≥ +80 di sisi timur, x ≤ -60 di sisi barat), sehingga
 *    takeoff/landing tidak pernah menabrak bangunan.
 *  - Ground tetap DATAR y=0 (physics pesawat bergantung pada ground flat).
 *  - Bangunan penting diberi checkCollisions + static colliders; pesawat tidak
 *    menggunakan moveWithCollisions sehingga tetap aman (posisi berbasis ISL).
 *
 * Asset 3D direuse dari '/assets/Model 3d map Ngawi City/':
 *  - rumah1/2/3.glb          → model rumah penduduk
 *  - Kopdes.glb              → gedung Koperasi Desa
 *  - pecel_lele.glb          → warung makan Pecel Lele
 *  - nasi_padang.glb         → warung makan Nasi Padang
 *  - rumah&ruko.glb          → deretan ruko/komersial (Task 10: TIDAK dipakai)
 *  - gedung1.glb             → gedung perkantoran (landmark)
 *  - spbu.glb                → pom bensin (Task 10: TIDAK dipakai)
 *  - bengkel.glb             → bengkel (landmark)
 *
 * STRUKTUR TASK 8 (semua prototype primitive — tidak ada asset baru):
 *  - Pagar perimeter bandara mengelilingi area operasional (kotak x 62..150,
 *    z -270..140) = batas visual kota↔bandara. Sisi timur x=150 menyusuri
 *    jalan raya; sisi barat x=62 di tepi apron; ditutup utara z=140 dan
 *    selatan z=-270. TIDAK ada pagar melintang runway/taxiway/flight corridor
 *    (koridor x≈0 tetap terbuka; runway & apron sebelah barat tetap airside).
 *  - MAIN GATE di persilangan jalan akses ↔ jalan raya (x=150, z=-200) + pos
 *    keamanan di dalam perimeter + barrier boom.
 *  - Opening airside di sisi barat (x=62, z=-200) untuk akses apron.
 *  - 4 aircraft shelter semi-tertutup (cluster x=126, z 22/58/94/130) menghadap
 *    apron/hangar, berisi kosong (visual-only).
 *  - Pagar memakai INSTANCING (master mesh tak terlihat + createInstance per
 *    tiang/panel; pondasi beton 1 box per ruas) agar mesh/draw-call rendah —
 *    pagar visual-only (tanpa collider), collider hanya di gate/pos/shelter.
 *  - 6 rumah `apt_wh_0..5` direlokasi dari x=118 ke x=252 (rotY dibalik)
 *    supaya strip operasional di dalam pagar bersih dari bangunan kota.
 *
 * STRUKTUR TASK 9 (optimasi render — TIDAK mengubah bentuk/posisi/komposisi):
 *  - Semua material bagian security dishare (fence_metal/fence_dark/fence_base/
 *    roof_dark); warna nyaris identik dirangkum, tidak ada warna baru.
 *  - Pagar: tiang & panel tetap INSTANCING; pondasi beton (6 ruas) & panel ekor
 *    (<8m) DIGABUNG per material (bakeCurrentTransformIntoVertices + merge)
 *    menjadi 1 mesh — visual kontinyu, draw-call turun.
 *  - Main gate: 2 pilar → 1 master + 2 instance (shadow lewat master sekaligus);
 *    lintel/sign/boom tidak lagi shadow caster (hanya pilar & panel geser).
 *  - Security post: tetap 4 bagian, shadow caster hanya hut & roof.
 *  - 4 aircraft shelter: 5 master geometry (back/side/roof/col/beam) + instance
 *    per bagian; shadow caster hanya back/side/roof master; collider dinding
 *    (back + 2 sisi) & gate pillar + sliding + hut dipertahankan manual AABB.
 *  - Semua environment isPickable = false (tidak butuh ray-picking).
 * Tidak ada file asset baru; placeholder primitive dibangun sebagai fallback +
 * collider, lalu diganti visual dengan model GLB (pola proven IndonesiaMap).
 *
 * STRUKTUR TASK 10 (MAP COMPACT — kompresi layout, KONSEP TIDAK BERUBAH):
 *  - Ground & bounds disusutkan (TASK 10) → x -340..620, z -680..980 (960x1660).
 *    TASK 15 lanjutkan: lahan kosong diperkecil lagi → x -410..330, z -460..430
 *    (740x890) berdasarkan bbox AKTUAL objek + rute CP1-CP10 + margin 100 m.
 *    Cukup untuk airport+city+takeoff+landing+turning+flight route+checkpoint;
 *    data checkpoint/waypoint TIDAK disentuh (WaypointSystem dilarang diubah).
 *  - Runway 1000m → 500m (z -260..240), tetap x=0 dominan; physics takeoff
 *    (~25-40m, TAKEOFF_SPEED 20) & landing roll (~75-150m) tetap aman.
 *  - Apron 120x120 → 80x80 (z -240..-160); spawn (0,-200) heading 0 TETAP.
 *  - Taxiway baru: strip sejajar runway (x 28..44, z -250..160) → apron sampai
 *    area terminal/hangar/shelter tetap "terasa bandara".
 *  - Fasilitas airport dikompres: terminal (18x6x16 @70,-115, menara tetap
 *    landmark ~16m), hangar (18x6x16 @70,-35), akses interior x 88..96.
 *  - Fence perimeter kotak operasional: x 45..130, z -215..105 (vs 62..150
 *    z -270..140). Main gate x=130 (bukaan 8m z -204..-196), security post
 *    (118,-210), 4 aircraft shelter cluster 2x2 (x 52..84, z 40/85) memakai
 *    instancing + collider dinding yang sama. Semua di x≥45 → koridor x≈0
 *    (takeoff/final approach) tetap bebas.
 *  - Jalan: main road x=148 (z -300..300), akses z=-200 (x 30..142), jalan
 *    lingkungan z=20 (x 156..172). Kota compact 12 rumah + Kopdes + Pecel Lele
 *    + Nasi Padang + bengkel + 1 gedung kantor di x≥150 (timur).
 *  - OBJEK DIHAPUS sesuai aturan Task 10: SPBU (apt_spbu) & 6 ruko
 *    (apt_ruko_*) BESERTA builder & TYPE_VISUAL-nya (spbu.glb, rumah&ruko.glb).
 *    ~27 rumah & pohon/semak dikurangi (39→12 rumah, 35→12 pohon, 16→8 semak).
 *  - Skala model proporsional terhadap pesawat/kendaraan: shelter diperkecil
 *    (footprint 10x12, tinggi 4), fence 3.1m, pilar gate 4m, jalan tetap cukup
 *    untuk kendaraan (8-12m).
 *
 * STRUKTUR TASK 11 (PERF AUDIT — reduksi beban render, konsep TIDAK berubah):
 *  - Audit statis: map ini TERBUKTI setara-lebih ringan dari Solo City & Ngawi
 *    (StandardMaterial vs PBR, mesh & GLB bytes lebih sedikit, tanpa alokasi
 *    per-frame). Beban paling besar diperkirakan di pass bayangan (CSM) dan
 *    kamera udara yang membuka seluruh scene sekaligus — bukan map-specific.
 *  - Freeze world-matrix SEMUA mesh statis map (CPU-side, visual identik) —
 *    di akhir build() dan setelah penempatan GLB-final (async).
 *  - Vegetasi kecil (12 pohon x2 + 8 semak = 32 bagian) TIDAK lagi shadow
 *    caster (mesh & collider tetap); bangunan/gate/shelter/pos tetap caster.
 */
export class AirportMap {
  private scene: Scene
  private lightingSetup: LightingSetup | null
  private meshes: AbstractMesh[] = []
  private colliders: Collider[] = []
  private spawnPoint: SpawnPoint = PESAWAT_TESTING_CONFIG.spawn
  private mapBounds = PESAWAT_TESTING_CONFIG.bounds
  private mats = new Map<string, StandardMaterial>()

  // ---- Task 8/9: infrastruktur penting bandara (perimeter/gate/pos/shelter) ----
  private fenceIdx = 0
  private fencePanelMaster: Mesh | null = null
  private fencePostMaster: Mesh | null = null
  // Task 9: statis sementara dikumpulkan lalu DIGABUNG (per material) pada
  // finalize agar objek kecil dengan material sama hanya 1 draw-call.
  private mergeBases: Mesh[] = []
  private mergeTailPanels: Mesh[] = []

  // ---- Model 3D final bangunan (placeholder → GLB) ----
  // Cache PROMISE GLB bersifat instance-level: promise yang dibuat scene lama
  // TIDAK boleh dipakai ulang oleh scene baru (StrictMode double-mount / ganti
  // map), karena mesin hasil import milik scene yang sudah di-dispose.
  private glbCache = new Map<string, Promise<{ meshes: AbstractMesh[] }>>()
  private readonly finalModelsQueue: ModelEntry[] = []

  constructor(scene: Scene, lightingSetup?: LightingSetup) {
    this.scene = scene
    this.lightingSetup = lightingSetup ?? null
  }

  getColliders(): Collider[] {
    return this.colliders
  }

  getMapBounds() {
    return this.mapBounds
  }

  getSpawnPoint() {
    return this.spawnPoint
  }

  build(): void {
    console.log('[AirportMap] Building compact airport layout...')
    this.createGround()
    this.createRunway()
    this.createApron()
    this.buildTaxiway()
    this.buildAirportFacilities()
    this.buildRoads()
    this.buildAirportSecurity()
    this.buildResidentialArea()
    this.buildTrees()
    // Task 11: beku-kan world-matrix semua mesh statis map (CPU-side, visual
    // identik) — posisi tidak berubah lagi setelah build. GLB-final (async)
    // dibekukan juga saat ditempatkan (placeGlbInstances).
    this.freezeStatics(this.meshes)
    this.dispatchFinalModels()
  }

  /**
   * Task 11: Bebekukan world-matrix mesh statis (skip per-frame matrix
   * recompute di render loop). Murni CPU-side, visual identik. Aman karena
   * pesawat TIDAK memakai moveWithCollisions & collider memakai AABB manual.
   */
  private freezeStatics(list: Iterable<AbstractMesh>): void {
    for (const m of list) {
      try {
        m.freezeWorldMatrix()
      } catch {
        // aman dibiarkan — mesh tetap dihitung normal bila freeze gagal.
      }
    }
  }

  // ============================================
  // MATERIAL & REGISTRATION HELPERS
  // ============================================

  private mat(key: string, base: Color3): StandardMaterial {
    if (!this.mats.has(key)) {
      const m = new StandardMaterial(`airport_${key}`, this.scene)
      m.diffuseColor = base
      m.specularColor = new Color3(0, 0, 0)
      this.mats.set(key, m)
    }
    return this.mats.get(key)!
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

  private addBoxCollider(mesh: AbstractMesh): void {
    mesh.computeWorldMatrix(true)
    const bb = mesh.getBoundingInfo().boundingBox
    this.colliders.push({
      min: bb.minimumWorld.clone(),
      max: bb.maximumWorld.clone(),
      mesh,
    })
  }

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

  // ============================================
  // GROUND & AIRFIELD
  // ============================================

  private createGround(): void {
    // TASK 15 — Lahan kosong diperkecil dari pengukuran bbox AKTUAL seluruh
    // objek map (bukan angka tebakan):
    //
    //   isi map (450 mesh, placeholders + pagar/roads/shelter/pohon)
    //        x [ -301.3,  209.3]   z [ -321.3,  321.3]
    //   rute pesawat CP1-CP10 +radius
    //        x [  -54,    224  ]   z [ -354,    254  ]
    //   union isi                       x [ -301.3, 224 ]  z [ -354, 321.3]
    //   + margin operasi 100 m  ->      x [ -410,   330 ]  z [ -460,  430 ]
    //
    // Ground lama 960 x 1660 (x -340..620, z -680..980) menyisakan lahan kosong
    // yang jauh melebihi kebutuhan: 396 m di timur, 659 m di utara, 326 m di
    // selatan dari objek terjauh. Ground baru 740 x 890 (41.3% luas lama) —
    // seluruh objek, runway, apron, taxiway, shelter, jalan, dan KOTA tetap di
    // dalam, plus 100 m rumput di tiap sisi untuk gerak pesawat (takeoff,
    // landing, roll-out, dan maneuvering).
    //
    // Margin dipilih seragam agar tidak ada sisi yang terlalu rapat: sisi barat
    // dulunya hanya menyisakan 38.7 m dari pohon terjauh (x=-301.3), jadi batas
    // baru justru memberi ruang lebih di sana, sementara sisi timur/utara/
    // selatan dipangkas hundreds of meter. Rute CP1-CP10 TIDAK disentuh
    // (WaypointSystem tidak boleh diubah) — semua CP tetap di dalam ground
    // baru dengan jarak aman.
    //
    // Diletakkan SEDIKIT DI BAWAH semua permukaan keras (y=-0.02, pola
    // SimpleMap/IndonesiaMap) agar runway/road/apron (y≥0.012) terpisah
    // ≥30mm → tanpa z-fighting/pendar saat kamera taxi melihat miring.
    const ground = MeshBuilder.CreateGround('airport_ground', { width: 740, height: 890 }, this.scene)
    ground.position = new Vector3(-40, -0.02, -15)
    const color = PESAWAT_TESTING_CONFIG.environment.groundColor
    const mat = this.mat('ground', new Color3(color.r, color.g, color.b))
    ground.material = mat
    ground.receiveShadows = true
    this.meshes.push(ground)
  }

  private createRunway(): void {
    // Runway strip COMPACT — TETAP di x=0, sumbu +Z, z -260..240 (500m). Cukup
    // untuk takeoff (~25-40m) & landing roll (~75-150m) physics existing.
    // y=0.02 = LAPIS TERTINGGI dari permukaan keras (lapangan -0.02, apron 0.0),
    // sehingga runway memotong apron tanpa z-fighting (30mm+ rapat SENDIRI).
    const width = 30
    const length = 500
    const runway = MeshBuilder.CreatePlane('runway', { width, height: length }, this.scene)
    runway.rotation.x = Math.PI / 2
    runway.position.y = 0.02
    runway.position.z = -10

    const mat = this.mat('runway', new Color3(0.2, 0.2, 0.2))
    runway.material = mat
    runway.receiveShadows = true

    this.meshes.push(runway)

    // Marka tepi runway (garis putih tipis sepanjang sisi kiri & kanan).
    const edgeMat = this.mat('runway_edge', new Color3(0.92, 0.92, 0.9))
    for (const side of [-1, 1]) {
      const edge = MeshBuilder.CreatePlane('runway_edge', { width: 0.6, height: length }, this.scene)
      edge.rotation.x = Math.PI / 2
      edge.position.y = 0.045
      edge.position.x = side * (width / 2 + 0.5)
      edge.position.z = -10
      edge.material = edgeMat
      edge.receiveShadows = true
      this.meshes.push(edge)
    }

    // Marka threshold + centerline (dash putih kecil di tengah runway).
    const dashMat = this.mat('runway_dash', new Color3(0.92, 0.92, 0.9))
    for (let z = -240; z <= 220; z += 20) {
      const dash = MeshBuilder.CreatePlane('runway_dash', { width: 1, height: 10 }, this.scene)
      dash.rotation.x = Math.PI / 2
      dash.position.y = 0.045
      dash.position.z = z
      dash.material = dashMat
      dash.receiveShadows = true
      this.meshes.push(dash)
    }
    for (const zEnd of [-260, 240]) {
      const thr = MeshBuilder.CreatePlane('runway_threshold', { width: width, height: 4 }, this.scene)
      thr.rotation.x = Math.PI / 2
      thr.position.y = 0.045
      thr.position.z = zEnd + Math.sign(zEnd) * 2
      thr.material = dashMat
      thr.receiveShadows = true
      this.meshes.push(thr)
    }
  }

  private createApron(): void {
    // Apron COMPACT 80x80 (x -40..40, z -240..-160) di y=0.0 — sedikit DI BAWAH
    // runway y=0.02. Titik spawn (0,-200) ada di sini; aircraft physics memakai
    // groundOffsetY konstan sehingga permukaan murni visual.
    const size = 80
    const apron = MeshBuilder.CreatePlane('apron', { width: size, height: size }, this.scene)
    apron.rotation.x = Math.PI / 2
    apron.position.y = 0.0
    apron.position.z = -200 // Spawn location

    const mat = this.mat('apron', new Color3(0.25, 0.25, 0.25))
    apron.material = mat
    apron.receiveShadows = true

    this.meshes.push(apron)
  }

  private buildTaxiway(): void {
    // Taxiway COMPACT: strip sejajar runway (x 28..44) dari apron (z -250)
    // sampai utara terminal/hangar/shelter (z 160) → bandara tetap terasa &
    // akses aircraft menuju shelter/hangar terlihat jelas. y=0.02 di atas
    // apron (0.0) & jalan akses (0.012) → tanpa z-fighting.
    const taxiway = MeshBuilder.CreateGround('airport_taxiway', { width: 16, height: 410 }, this.scene)
    taxiway.position = new Vector3(36, 0.02, -45)
    taxiway.material = this.mat('taxiway', new Color3(0.19, 0.19, 0.21))
    taxiway.receiveShadows = true
    this.commit(taxiway, false, false)

    // Marka poros taxiway (garis putus-putus memanjang).
    const lineMat = this.mat('taxiway_line', new Color3(0.9, 0.88, 0.25))
    for (let z = -235; z <= 145; z += 16) {
      const dash = MeshBuilder.CreateBox(`taxiway_dash_${z}`, { width: 0.5, height: 0.02, depth: 6 }, this.scene)
      dash.position = new Vector3(36, 0.03, z)
      dash.material = lineMat
      this.commit(dash, false, false)
    }
  }

  // ============================================
  // AIRPORT FACILITIES (terminal, menara, hangar, akses)
  // ============================================

  private buildAirportFacilities(): void {
    // Jalan depan terminal/hangar (utara–selatan, x 88..96) — sengaja dinaikkan
    // y=0.03 (18mm DI ATAS akses horizontal y=0.012) agar perpotongan tidak
    // coplanar → tanpa z-fighting. Menghubungkan akses gate z=-200 ke area
    // terminal/hangar/shelter; berakhir persis di pagar utara (z 104).
    const access = MeshBuilder.CreateGround('airport_access_road', { width: 8, height: 304 }, this.scene)
    access.position = new Vector3(92, 0.03, -48)
    access.material = this.mat('road_access', new Color3(0.16, 0.16, 0.17))
    access.receiveShadows = true
    this.commit(access, false, false)

    // Terminal penumpang COMPACT — utara akses jalan (z -123..-107) di x 61..79
    // (timur apron/taxiway, luar jalur pesawat x≈0). Masih lebih besar dari
    // kendaraan/pesawat (footprint 18x16, tinggi 6).
    const terminal = MeshBuilder.CreateBox('airport_terminal', { width: 18, height: 6, depth: 16 }, this.scene)
    terminal.name = 'airport_terminal'
    terminal.position = new Vector3(70, 3, -115)
    terminal.material = this.mat('terminal_wall', new Color3(0.85, 0.83, 0.78))
    terminal.receiveShadows = true
    terminal.checkCollisions = true
    this.commit(terminal, true)

    const terminalRoof = MeshBuilder.CreateBox('airport_terminal_roof', { width: 20, height: 0.5, depth: 18 }, this.scene)
    terminalRoof.position = new Vector3(70, 6.25, -115)
    terminalRoof.material = this.mat('terminal_roof', new Color3(0.5, 0.5, 0.55))
    terminalRoof.receiveShadows = true
    this.commit(terminalRoof, false)

    // Menara kontrol ATC tetap di atas terminal (tetap landmark airport,
    // skala proporsional — total tinggi ~16m).
    const tower = MeshBuilder.CreateCylinder('airport_tower', { diameter: 2.5, height: 8 }, this.scene)
    tower.position = new Vector3(70, 10, -115)
    tower.material = this.mat('tower_body', new Color3(0.65, 0.66, 0.7))
    tower.receiveShadows = true
    tower.checkCollisions = true
    this.commit(tower, true)

    const towerCab = MeshBuilder.CreateBox('airport_tower_cab', { width: 4, height: 2, depth: 4 }, this.scene)
    towerCab.position = new Vector3(70, 15, -115)
    towerCab.material = this.mat('tower_cab', new Color3(0.12, 0.45, 0.7))
    towerCab.receiveShadows = true
    this.commit(towerCab, false)
    // Collider kabin ATC: collider menara hanya menutup y 6..14, sedangkan kabin
    // y 14..16 adalah volume tersendiri. Tanpa collider ini pesawat bisa menembus
    // kabin. Mengikuti ukuran & posisi mesh sebenarnya.
    this.pushCollider(68, 72, 14, 16, -117, -113)

    // Hangar sederhana COMPACT (utara terminal, sisi barat akses interior).
    const hangar = MeshBuilder.CreateBox('airport_hangar', { width: 18, height: 6, depth: 16 }, this.scene)
    hangar.position = new Vector3(70, 3, -35)
    hangar.material = this.mat('hangar_wall', new Color3(0.75, 0.76, 0.8))
    hangar.receiveShadows = true
    hangar.checkCollisions = true
    this.commit(hangar, true)

    const hangarDoor = MeshBuilder.CreatePlane('airport_hangar_door', { width: 12, height: 4.5 }, this.scene)
    hangarDoor.position = new Vector3(70, 2.5, -27)
    hangarDoor.material = this.mat('hangar_door', new Color3(0.4, 0.42, 0.5))
    hangarDoor.receiveShadows = true
    this.meshes.push(hangarDoor)
  }

  // ============================================
  // ROAD (nuansa Indonesia, sisi timur koridor)
  // ============================================

  private createRoadVert(zFrom: number, zTo: number, x: number, width: number): void {
    const road = MeshBuilder.CreateGround('road', { width, height: zTo - zFrom }, this.scene)
    road.position = new Vector3(x, 0.012, (zFrom + zTo) / 2)
    road.material = this.mat('road_main', new Color3(0.16, 0.16, 0.17))
    road.receiveShadows = true
    this.commit(road, false, false)

    // Garis putus-putus tengah.
    const lineMat = this.mat('road_line', new Color3(0.95, 0.95, 0.9))
    for (let i = zFrom + 5; i < zTo; i += 10) {
      const dash = MeshBuilder.CreateBox(`road_dash_${i}`, { width: 0.3, height: 0.02, depth: 5 }, this.scene)
      dash.position = new Vector3(x, 0.025, i)
      dash.material = lineMat
      this.commit(dash, false, false)
    }
  }

  private createRoadHoriz(xFrom: number, xTo: number, z: number, width: number): void {
    const road = MeshBuilder.CreateGround('road', { width: xTo - xFrom, height: width }, this.scene)
    road.position = new Vector3((xFrom + xTo) / 2, 0.012, z)
    road.material = this.mat('road_main', new Color3(0.16, 0.16, 0.17))
    road.receiveShadows = true
    this.commit(road, false, false)

    const lineMat = this.mat('road_line', new Color3(0.95, 0.95, 0.9))
    for (let i = xFrom + 5; i < xTo; i += 10) {
      const dash = MeshBuilder.CreateBox(`road_dash_${i}_${z}`, { width: 5, height: 0.02, depth: 0.3 }, this.scene)
      dash.position = new Vector3(i, 0.025, z)
      dash.material = lineMat
      this.commit(dash, false, false)
    }
  }

  private buildRoads(): void {
    // Jalan raya utama (utara–selatan, sumbu +Z) COMPACT di x=148 (x 142..154),
    // membentang z -300..300. Koridor terbang x≈0 TIDAK terkena.
    this.createRoadVert(-300, 300, 148, 12)
    // Jalan akses barat–timur di z=-200 (apron/terminal → main gate → jalan
    // raya utama), lebar 8m. Berhenti TEPAT di pinggir jalan raya (x=142) —
    // tidak overlap coplanar.
    this.createRoadHoriz(30, 142, -200, 8)
    // Jalan lingkungan perumahan COMPACT (barat–timur) z=20, x 156..172.
    this.createRoadHoriz(156, 172, 20, 8)
  }

  // ============================================
  // RESIDENTIAL AREA & PUBLIC BUILDINGS
  // ============================================

  private createSolidBox(
    name: string, x: number, z: number, w: number, h: number, d: number, matKey: string
  ): AbstractMesh {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene)
    mesh.position = new Vector3(x, h / 2, z)
    mesh.material = this.mat(matKey, new Color3(0.85, 0.82, 0.78))
    mesh.receiveShadows = true
    mesh.checkCollisions = true
    this.commit(mesh, false, false)
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
    this.commit(roof, false, false)
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
    this.commit(roof, false, false)
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
    this.commit(roof, false, false)
    this.enqueueModel(name, x, z, 12, 11, 'rumah3.glb', 10)
  }

  private createKopdes(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 9, 4.5, 7, 'kopdes_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const flat = MeshBuilder.CreateBox(`${name}_flat`, { width: 9.5, height: 0.5, depth: 7.5 }, this.scene)
    flat.position = new Vector3(x, 4.5, z)
    flat.material = this.mat('kopdes_flat', new Color3(0.55, 0.35, 0.2))
    this.commit(flat, false, false)
    const sign = MeshBuilder.CreateBox(`${name}_sign`, { width: 2.2, height: 0.9, depth: 0.15 }, this.scene)
    sign.position = new Vector3(x + (rotY === Math.PI / 2 ? 5.5 : 0), 3, z)
    sign.material = this.mat('kopdes_sign', new Color3(0.15, 0.5, 0.8))
    this.commit(sign, false, false)
    this.enqueueModel(name, x, z, 9, 7, 'Kopdes.glb', 6)
  }

  private createWarungPecel(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 7, 4, 6, 'warung_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 7.5, height: 0.6, depth: 6.5 }, this.scene)
    roof.position = new Vector3(x, 4.2, z)
    roof.material = this.mat('warung_roof', new Color3(0.85, 0.35, 0.2))
    this.commit(roof, false, false)
    this.enqueueModel(name, x, z, 7, 6, 'pecel_lele.glb', 5)
  }

  private createWarungNasi(name: string, x: number, z: number, rotY = 0): void {
    const body = this.createSolidBox(`${name}_body`, x, z, 7, 4, 6, 'warung_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 7.5, height: 0.6, depth: 6.5 }, this.scene)
    roof.position = new Vector3(x, 4.2, z)
    roof.material = this.mat('warung_roof', new Color3(0.85, 0.35, 0.2))
    this.commit(roof, false, false)
    this.enqueueModel(name, x, z, 7, 6, 'nasi_padang.glb', 5)
  }

  private createBengkel(name: string, x: number, z: number, rotY = 0): void {
    this.mat('bengkel_wall', new Color3(0.5, 0.52, 0.55))
    const body = this.createSolidBox(`${name}_body`, x, z, 9, 4, 10, 'bengkel_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 9.5, height: 0.5, depth: 10.5 }, this.scene)
    roof.position = new Vector3(x, 4.2, z)
    roof.material = this.mat('bengkel_roof', new Color3(0.3, 0.35, 0.4))
    this.commit(roof, false, false)
    this.enqueueModel(name, x, z, 9, 10, 'bengkel.glb', 8)
  }

  private createKantor(name: string, x: number, z: number, rotY = 0): void {
    this.mat('kantor_wall', new Color3(0.65, 0.66, 0.7))
    const body = this.createSolidBox(`${name}_body`, x, z, 18, 9, 14, 'kantor_wall')
    body.rotation.y = rotY
    body.computeWorldMatrix(true)
    this.addBoxCollider(body)
    const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 18.5, height: 1, depth: 14.5 }, this.scene)
    roof.position = new Vector3(x, 9.5, z)
    roof.material = this.mat('kantor_roof', new Color3(0.35, 0.35, 0.4))
    this.commit(roof, false, false)
    this.enqueueModel(name, x, z, 18, 14, 'gedung1.glb', 16)
  }

  private buildResidentialArea(): void {
    // Kota COMPACT (timur jalan raya x=148, x≥150 → jauh dari koridor x≈0).
    // Area perumahan sederhana: 2 baris rumah menghadap jalan raya + baris
    // kecil samping jalan lingkungan. TANPA SPBU & TANPA ruko (Task 10).
    const westRow = [90, 30, -30, -90]
    for (let i = 0; i < westRow.length; i++) {
      const z = westRow[i]
      if (i % 3 === 0) this.createHouse1(`apt_wh_${i}`, 162, z, -Math.PI / 2)
      else if (i % 3 === 1) this.createHouse2(`apt_wh_${i}`, 162, z, -Math.PI / 2)
      else this.createHouse3(`apt_wh_${i}`, 162, z, -Math.PI / 2)
    }
    const eastRow = [130, 50, -30, -110]
    for (let i = 0; i < eastRow.length; i++) {
      const z = eastRow[i]
      if (i % 3 === 0) this.createHouse1(`apt_eh_${i}`, 178, z, -Math.PI / 2)
      else if (i % 3 === 1) this.createHouse2(`apt_eh_${i}`, 178, z, -Math.PI / 2)
      else this.createHouse3(`apt_eh_${i}`, 178, z, -Math.PI / 2)
    }
    // Rumah samping jalan lingkungan z=20 (menghadap jalan).
    this.createHouse1('apt_lane_1', 192, 100, 0)
    this.createHouse2('apt_lane_2', 204, -80, 0)

    // Gedung layanan umum (landmark kota, tetap ringan).
    this.createKopdes('apt_kopdes', 166, 240, 0)
    this.createWarungPecel('apt_pecel', 166, -250, Math.PI / 2)
    this.createWarungNasi('apt_nasi', 204, 40, 0)
    this.createBengkel('apt_bengkel', 196, -250, 0)
    this.createKantor('apt_kantor', 200, 120, 0)

    // Cluster desa barat (seberang runway, x ≤ -60 keluar koridor) — ringan,
    // 2 rumah saja.
    this.createHouse2('apt_wc_1', -150, 170, Math.PI)
    this.createHouse1('apt_wc_2', -200, 260, 0)
  }

  // ============================================
  // SCENERY (trees/bushes, jauh dari koridor & jalan)
  // ============================================

  private createTree(x: number, z: number, nameIndex: number): void {
    const trunk = MeshBuilder.CreateCylinder(`airport_tree_trunk_${nameIndex}`, { diameter: 0.5, height: 2.5 }, this.scene)
    trunk.position = new Vector3(x, 1.25, z)
    trunk.material = this.mat('tree_trunk', new Color3(0.35, 0.25, 0.15))
    // Task 11: vegetasi kecil tidak lagi jadi shadow caster (pass bayangan =
    // caster x cascade; 24 bagian pohon + 8 semak keluar dari pass). Mesh &
    // collider TETAP — hanya bayangan rumput kecil yang hilang.
    this.commit(trunk, true, false)
    const leaf = MeshBuilder.CreateSphere(`airport_tree_leaf_${nameIndex}`, { diameter: 2.6 }, this.scene)
    leaf.position = new Vector3(x, 3.6, z)
    leaf.material = this.mat('tree_leaf', new Color3(0.28, 0.55, 0.25))
    this.commit(leaf, false, false)
  }

  private createBush(x: number, z: number, nameIndex: number): void {
    const bush = MeshBuilder.CreateSphere(`airport_bush_${nameIndex}`, { diameter: 1.2 }, this.scene)
    bush.position = new Vector3(x, 0.6, z)
    bush.material = this.mat('bush', new Color3(0.3, 0.5, 0.25))
    this.commit(bush, false, false)
  }

  private buildTrees(): void {
    // Pohon COMPACT — hanya lapangan BARAT & sekitar (x ≤ -60, jauh dari
    // runway & koridor x≈0). Jumlah dikurangi drastis (Task 10).
    const trees: Array<[number, number]> = [
      [-80, -200], [-120, -60], [-160, 80], [-200, -160], [-240, 140], [-280, -60],
      [-100, 220], [-160, 320], [-220, -260], [-300, 120], [-120, -320], [-260, 260],
    ]
    for (let i = 0; i < trees.length; i++) {
      this.createTree(trees[i][0], trees[i][1], i)
    }
    const bushes: Array<[number, number]> = [
      [-70, -30], [-90, -120], [-140, 160], [-180, -90],
      [-90, 300], [-240, 180], [-120, -240], [-200, 80],
    ]
    for (let i = 0; i < bushes.length; i++) {
      this.createBush(bushes[i][0], bushes[i][1], i)
    }
  }

  // ============================================
  // AIRPORT SECURITY (Task 8: perimeter, main gate, pos, shelter)
  // ============================================

  private buildAirportSecurity(): void {
    // Dipanggil SETELAH buildRoads() supaya pagar/pintu menutup rapi mengapit
    // area operasional bandara tanpa menimpa jalan/runway/apron/koridor x≈0.
    this.buildPerimeterFence()
    this.buildMainGate()
    this.buildSecurityPost()
    this.buildAircraftShelters()
  }

  /** Daftarkan mesh statis lingkungan: isPickable=false, receiveShadows, dst. */
  private markStatic(mesh: AbstractMesh, castShadow: boolean, withCollider: boolean): void {
    mesh.isPickable = false
    mesh.receiveShadows = true
    if (castShadow) {
      this.lightingSetup?.addShadowCaster(mesh)
    }
    if (withCollider) {
      this.addBoxCollider(mesh)
    }
    this.meshes.push(mesh)
  }

  /** Collider AABB manual (tanpa bergantung bounding-box instance/source). */
  private pushCollider(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): void {
    this.colliders.push({
      min: new Vector3(minX, minY, minZ),
      max: new Vector3(maxX, maxY, maxZ),
    })
  }

  /**
   * Task 16: samakan collider satu instance bangunan dengan AABB world model
   * FINAL-nya. Collider dibangun dari mesh placeholder (primitive) oleh
   * addBoxCollider(), sedangkan model GLB final bisa lebih lebar/tinggi, sehingga
   * collider placeholder bisa lebih kecil dari bangunan yang terlihat.
   * Collider yang sudah ada di-update in-place (indeks & identitas object tidak
   * berubah, jadi consumer yang menyimpan referensinya tetap valid); bila
   * instance tidak punya collider placeholder, collider baru ditambahkan dari
   * AABB model final.
   */

  private syncColliderToInstance(instance: string, placedMeshes: AbstractMesh[]): void {
    if (placedMeshes.length === 0) return

    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let maxZ = Number.NEGATIVE_INFINITY
    for (const pm of placedMeshes) {
      const bb = pm.getBoundingInfo().boundingBox
      if (bb.minimumWorld.x < minX) minX = bb.minimumWorld.x
      if (bb.minimumWorld.y < minY) minY = bb.minimumWorld.y
      if (bb.minimumWorld.z < minZ) minZ = bb.minimumWorld.z
      if (bb.maximumWorld.x > maxX) maxX = bb.maximumWorld.x
      if (bb.maximumWorld.y > maxY) maxY = bb.maximumWorld.y
      if (bb.maximumWorld.z > maxZ) maxZ = bb.maximumWorld.z
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return

    // Collider placeholder untuk instance ini berasal dari mesh `${instance}_body`.
    const bodyName = `${instance}_body`
    const existing = this.colliders.find((c) => c.mesh?.name === bodyName)
    if (existing) {
      existing.min.set(minX, minY, minZ)
      existing.max.set(maxX, maxY, maxZ)
      return
    }
    this.colliders.push({
      min: new Vector3(minX, minY, minZ),
      max: new Vector3(maxX, maxY, maxZ),
    })
  }

  private getFencePanelMaster(): Mesh {
    if (!this.fencePanelMaster) {
      const m = MeshBuilder.CreateBox('airport_fence_panel_master', { width: 0.12, height: 2.8, depth: 7.7 }, this.scene)
      m.material = this.mat('fence_metal', new Color3(0.7, 0.71, 0.74))
      m.isVisible = false
      m.isPickable = false
      this.fencePanelMaster = m
      this.meshes.push(m)
    }
    return this.fencePanelMaster
  }

  private getFencePostMaster(): Mesh {
    if (!this.fencePostMaster) {
      const m = MeshBuilder.CreateBox('airport_fence_post_master', { width: 0.15, height: 3.1, depth: 0.15 }, this.scene)
      m.material = this.mat('fence_dark', new Color3(0.44, 0.46, 0.5))
      m.isVisible = false
      m.isPickable = false
      this.fencePostMaster = m
      this.meshes.push(m)
    }
    return this.fencePostMaster
  }

  private buildPerimeterFence(): void {
    // Perimeter kotak operasional bandara COMPACT — sisi EAST x=130 & WEST x=45
    // (sepanjang z -215..105) + penutup NORTH z=105 & SOUTH z=-215 (x 45..130).
    // Bukaan:
    //  - EAST  = MAIN GATE (persilangan jalan akses z=-200, bukaan 8m z -204..-196);
    //  - WEST  = airside opening (akses apron dari bandara, bukaan 10m).
    const east = (zFrom: number, zTo: number) => this.buildFenceRun('Z', 130, zFrom, zTo)
    const west = (zFrom: number, zTo: number) => this.buildFenceRun('Z', 45, zFrom, zTo)
    const north = (xFrom: number, xTo: number) => this.buildFenceRun('X', 105, xFrom, xTo)
    const south = (xFrom: number, xTo: number) => this.buildFenceRun('X', -215, xFrom, xTo)
    east(-215, -204)
    east(-196, 105)
    west(-215, -205)
    west(-195, 105)
    north(45, 130)
    south(45, 130)
    // Task 9: pondasi beton semua ruas & panel ekor (<8m) digabung per material
    // menjadi 1 mesh (visual tetap kontinyu, draw-call turun drastis).
    this.finalizeFenceMerge()
  }

  /**
   * Gabungkan batch statis ber-material sama menjadi satu renderable (pola
   * bake-then-merge). Jika merge gagal, mesh asli tetap dipertahankan apa
   * adanya (visual tidak pernah hilang).
   */
  private mergeCommon(list: Mesh[], name: string, matKey: string): void {
    if (list.length === 0) return
    try {
      for (const m of list) {
        m.bakeCurrentTransformIntoVertices()
        m.position.set(0, 0, 0)
        m.rotation.set(0, 0, 0)
        m.scaling.set(1, 1, 1)
        m.computeWorldMatrix(true)
      }
      const merged = Mesh.MergeMeshes(list, true, false, undefined, false, false)
      if (merged) {
        merged.name = name
        merged.material = this.mat(matKey, Color3.Gray())
        merged.receiveShadows = true
        merged.isPickable = false
        this.meshes.push(merged)
        return
      }
    } catch {
      // aman dibiarkan — fallback ke mesh asli di bawah.
    }
    for (const m of list) {
      m.receiveShadows = true
      m.isPickable = false
      this.meshes.push(m)
    }
  }

  private finalizeFenceMerge(): void {
    this.mergeCommon(this.mergeBases, 'airport_fence_bases', 'fence_base')
    this.mergeBases = []
    this.mergeCommon(this.mergeTailPanels, 'airport_fence_panels_tail', 'fence_metal')
    this.mergeTailPanels = []
  }

  /**
   * Satu ruas pagar lurus. axis 'Z' = pagar menyusuri sumbu Z pada x=fixed;
   * axis 'X' = menyusuri sumbu X pada z=fixed. Pondasi dikumpulkan ke batch
   * merge; tiang & panel standar memakai INSTANCING (share geometri induk);
   * sisa ruas <8m ikut batch merge. Visual-only (tanpa collider).
   */
  private buildFenceRun(axis: 'X' | 'Z', fixed: number, from: number, to: number): void {
    const len = Math.abs(to - from)
    if (len < 1) return
    const dir = Math.sign(to - from)
    const baseMat = this.mat('fence_base', new Color3(0.6, 0.6, 0.63))
    if (axis === 'Z') {
      const base = MeshBuilder.CreateBox(`airport_fence_base_${this.fenceIdx++}`, { width: 0.3, height: 0.35, depth: len }, this.scene)
      base.position = new Vector3(fixed, 0.175, (from + to) / 2)
      base.material = baseMat
      this.mergeBases.push(base)
    } else {
      const base = MeshBuilder.CreateBox(`airport_fence_base_${this.fenceIdx++}`, { width: len, height: 0.35, depth: 0.3 }, this.scene)
      base.position = new Vector3((from + to) / 2, 0.175, fixed)
      base.material = baseMat
      this.mergeBases.push(base)
    }

    // Deret posisi tiang: start + kelipatan 8m; ujung ruas selalu diberi tiang.
    const posts: number[] = []
    let cur = from
    for (;;) {
      posts.push(cur)
      if (Math.abs(cur - to) < 0.01) break
      cur += dir * 8
      if (dir * (cur - to) > 0) cur = to
    }

    const panelMaster = this.getFencePanelMaster()
    const postMaster = this.getFencePostMaster()
    const panelMat = this.mat('fence_metal', new Color3(0.7, 0.71, 0.74))
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i]
      const post = postMaster.createInstance(`airport_fence_post_${this.fenceIdx++}`)
      if (axis === 'Z') post.position = new Vector3(fixed, 1.55, p)
      else post.position = new Vector3(p, 1.55, fixed)
      post.isPickable = false
      this.meshes.push(post)
      if (i >= posts.length - 1) continue
      const gap = Math.abs(posts[i + 1] - posts[i])
      const mid = (posts[i] + posts[i + 1]) / 2
      if (gap >= 7.5) {
        const panel = panelMaster.createInstance(`airport_fence_panel_${this.fenceIdx++}`)
        if (axis === 'Z') panel.position = new Vector3(fixed, 1.75, mid)
        else panel.position = new Vector3(mid, 1.75, fixed)
        panel.isPickable = false
        this.meshes.push(panel)
      } else {
        // Sisa ruas <8m → box unik, dikumpulkan untuk digabung per material.
        const panel =
          axis === 'Z'
            ? MeshBuilder.CreateBox(`airport_fence_panel_${this.fenceIdx++}`, { width: 0.12, height: 2.8, depth: gap }, this.scene)
            : MeshBuilder.CreateBox(`airport_fence_panel_${this.fenceIdx++}`, { width: gap, height: 2.8, depth: 0.12 }, this.scene)
        panel.material = panelMat
        if (axis === 'Z') panel.position = new Vector3(fixed, 1.75, mid)
        else panel.position = new Vector3(mid, 1.75, fixed)
        this.mergeTailPanels.push(panel)
      }
    }
  }

  private buildMainGate(): void {
    // Pintu utama COMPACT di sisi timur x=130, persilangan pagar ↔ jalan akses
    // z=-200 (bukaan z -204..-196 = sejalan jalan akses 8m). 2 pilar DIINSTANCE
    // (1 master + 2 instance, shadow lewat master sekaligus); lintel & papan
    // nama & boom tetap utuh tapi TIDAK jadi shadow caster (hanya pilar + panel
    // geser). Skala proporsional: bukaan 8m cukup untuk kendaraan (~2-3m).
    const gx = 130
    const darkMat = this.mat('fence_dark', new Color3(0.44, 0.46, 0.5))
    const metalMat = this.mat('fence_metal', new Color3(0.7, 0.71, 0.74))
    const concreteMat = this.mat('fence_base', new Color3(0.6, 0.6, 0.63))

    const pillarMaster = MeshBuilder.CreateBox('airport_gate_pillar_master', { width: 0.6, height: 4, depth: 0.6 }, this.scene)
    pillarMaster.material = darkMat
    pillarMaster.isVisible = false
    pillarMaster.isPickable = false
    pillarMaster.receiveShadows = false
    this.meshes.push(pillarMaster)
    this.lightingSetup?.addShadowCaster(pillarMaster)
    for (const gz of [-204, -196]) {
      const pillar = pillarMaster.createInstance(`airport_gate_pillar_${gz}`)
      pillar.position = new Vector3(gx, 2, gz)
      pillar.isPickable = false
      this.meshes.push(pillar)
      this.pushCollider(gx - 0.3, gx + 0.3, 0, 4, gz - 0.3, gz + 0.3)
    }

    // Lintel — visual, bukan caster, collider tidak perlu.
    const lintel = MeshBuilder.CreateBox('airport_gate_lintel', { width: 0.55, height: 0.5, depth: 9 }, this.scene)
    lintel.position = new Vector3(gx, 3.7, -200)
    lintel.material = darkMat
    this.markStatic(lintel, false, false)

    // Panel geser menutup badan jalan (8m) — caster & collider (area kritis).
    const sliding = MeshBuilder.CreateBox('airport_gate_sliding', { width: 0.4, height: 2.3, depth: 8 }, this.scene)
    sliding.position = new Vector3(gx, 1.15, -200)
    sliding.material = metalMat
    this.markStatic(sliding, true, true)

    // Papan nama di atas lintel — visual saja.
    const sign = MeshBuilder.CreateBox('airport_gate_sign', { width: 2.6, height: 1, depth: 0.25 }, this.scene)
    sign.position = new Vector3(gx, 4.9, -200)
    sign.material = this.mat('gate_sign', new Color3(0.12, 0.32, 0.62))
    this.markStatic(sign, false, false)

    // Barrier boom di jalur masuk dari dalam perimeter (x=124, z=-200).
    const boomPost = MeshBuilder.CreateBox('airport_boom_post', { width: 0.35, height: 1.6, depth: 0.35 }, this.scene)
    boomPost.position = new Vector3(124, 0.8, -200)
    boomPost.material = concreteMat
    this.markStatic(boomPost, false, false)
    const boomArm = MeshBuilder.CreateBox('airport_boom_arm', { width: 0.3, height: 0.16, depth: 8 }, this.scene)
    boomArm.position = new Vector3(124, 1.45, -200)
    boomArm.material = this.mat('boom_arm', new Color3(0.9, 0.82, 0.2))
    this.markStatic(boomArm, false, false)
  }

  private buildSecurityPost(): void {
    // Pos keamanan (x=118, z=-210) — di dalam perimeter dekat main gate (x=130),
    // pintu menghadap jalan akses (utara), jendela menghadap gate (timur).
    // Shadow caster hanya hut & roof (struktur utama); pintu & jendela visual.
    const wallMat = this.mat('post_wall', new Color3(0.82, 0.83, 0.85))
    const roofMat = this.mat('roof_dark', new Color3(0.32, 0.34, 0.38))
    const darkMat = this.mat('fence_dark', new Color3(0.44, 0.46, 0.5))
    const hut = MeshBuilder.CreateBox('airport_post_hut', { width: 3, height: 2.6, depth: 3 }, this.scene)
    hut.position = new Vector3(118, 1.3, -210)
    hut.material = wallMat
    this.markStatic(hut, true, true)
    const roof = MeshBuilder.CreateBox('airport_post_roof', { width: 3.4, height: 0.3, depth: 3.4 }, this.scene)
    roof.position = new Vector3(118, 2.75, -210)
    roof.material = roofMat
    this.markStatic(roof, true, false)
    const door = MeshBuilder.CreatePlane('airport_post_door', { width: 1.2, height: 2 }, this.scene)
    door.position = new Vector3(118, 1, -208.4)
    door.material = darkMat
    this.markStatic(door, false, false)
    const win = MeshBuilder.CreatePlane('airport_post_win', { width: 1.4, height: 0.8 }, this.scene)
    win.position = new Vector3(119.5, 1.7, -210)
    win.rotation.y = Math.PI / 2
    win.material = this.mat('post_win', new Color3(0.55, 0.78, 0.95))
    this.markStatic(win, false, false)
  }

  private buildAircraftShelters(): void {
    // 4 shelter COMPACT dalam cluster 2x2 (Task 10, komposisi shelter tetap
    // "satu cluster"): 2 kolom x (bukaan barat 52 & 74) x 2 baris z (40 & 85).
    // Membuka ke BARAT menuju apron/taxiway — konsep sama seperti Task 8/9.
    // 5 MASTER geometry + instance per bagian; shadow caster hanya master
    // back/side/roof; kolom & balok MURNI dekorasi. Collider dinding back + 2
    // sisi per shelter (manual AABB) dipertahankan; atap/kolom/balok tanpa.
    const wallMat = this.mat('shelter_wall', new Color3(0.52, 0.54, 0.58))
    const roofMat = this.mat('roof_dark', new Color3(0.32, 0.34, 0.38))
    const darkMat = this.mat('fence_dark', new Color3(0.44, 0.46, 0.5))

    const backM = MeshBuilder.CreateBox('airport_shelter_back_master', { width: 0.4, height: 4, depth: 12 }, this.scene)
    const sideM = MeshBuilder.CreateBox('airport_shelter_side_master', { width: 10, height: 4, depth: 0.4 }, this.scene)
    const roofM = MeshBuilder.CreateBox('airport_shelter_roof_master', { width: 10.5, height: 0.35, depth: 12.5 }, this.scene)
    const colM = MeshBuilder.CreateBox('airport_shelter_col_master', { width: 0.35, height: 4, depth: 0.35 }, this.scene)
    const beamM = MeshBuilder.CreateBox('airport_shelter_beam_master', { width: 0.4, height: 0.35, depth: 12 }, this.scene)
    backM.material = wallMat
    sideM.material = wallMat
    roofM.material = roofMat
    colM.material = darkMat
    beamM.material = darkMat

    for (const m of [backM, sideM, roofM]) {
      m.isVisible = false
      m.isPickable = false
      m.receiveShadows = false
      this.meshes.push(m)
      this.lightingSetup?.addShadowCaster(m)
    }
    for (const m of [colM, beamM]) {
      m.isVisible = false
      m.isPickable = false
      m.receiveShadows = false
      this.meshes.push(m)
    }

    // Cluster 2x2: kolom (bukaan west) [52, 74], baris z [40, 85].
    let n = 0
    for (const ox of [52, 74]) {
      for (const z0 of [40, 85]) {
        const tag = `${n++}`
        const zLo = z0 - 6
        const zHi = z0 + 6

        const back = backM.createInstance(`airport_shelter_${tag}_back`)
        back.position = new Vector3(ox + 10, 2, z0)
        back.isPickable = false
        this.meshes.push(back)
        this.pushCollider(ox + 9.8, ox + 10.2, 0, 4, zLo, zHi)

        const south = sideM.createInstance(`airport_shelter_${tag}_south`)
        south.position = new Vector3(ox + 5, 2, zLo)
        south.isPickable = false
        this.meshes.push(south)
        this.pushCollider(ox, ox + 10, 0, 4, zLo - 0.2, zLo + 0.2)

        const north = sideM.createInstance(`airport_shelter_${tag}_north`)
        north.position = new Vector3(ox + 5, 2, zHi)
        north.isPickable = false
        this.meshes.push(north)
        this.pushCollider(ox, ox + 10, 0, 4, zHi - 0.2, zHi + 0.2)

        const roof = roofM.createInstance(`airport_shelter_${tag}_roof`)
        roof.position = new Vector3(ox + 5, 4.2, z0)
        roof.isPickable = false
        this.meshes.push(roof)

        for (const fz of [zLo + 0.8, zHi - 0.8]) {
          const col = colM.createInstance(`airport_shelter_${tag}_col_${fz}`)
          col.position = new Vector3(ox, 2, fz)
          col.isPickable = false
          this.meshes.push(col)
        }

        const beam = beamM.createInstance(`airport_shelter_${tag}_beam`)
        beam.position = new Vector3(ox, 3.8, z0)
        beam.isPickable = false
        this.meshes.push(beam)
      }
    }
  }

  // ============================================
  // GLB MODEL LOADING (pola proven IndonesiaMap)
  // ============================================

  /**
   * Ukuran TARGET tinggi (unit dunia) per jenis bangunan — mirip IndonesiaMap
   * agar tiap tipe tampak berbeda wajar dan tetap aman di footprint placeholder.
   */
  private static readonly TYPE_VISUAL: Record<string, { targetH: number; ovf: number; minFrac: number; minWorldH: number }> = {
    'pecel_lele.glb': { targetH: 3.4, ovf: 1.25, minFrac: 0.5, minWorldH: 1.8 },
    'nasi_padang.glb': { targetH: 3.4, ovf: 1.25, minFrac: 0.5, minWorldH: 1.8 },
    'rumah1.glb': { targetH: 4.5, ovf: 1.2, minFrac: 0.55, minWorldH: 2.5 },
    'rumah2.glb': { targetH: 5.2, ovf: 1.35, minFrac: 0.6, minWorldH: 2.8 },
    'rumah3.glb': { targetH: 6.0, ovf: 1.3, minFrac: 0.65, minWorldH: 3.0 },
    'Kopdes.glb': { targetH: 4.8, ovf: 1.2, minFrac: 0.55, minWorldH: 2.6 },
    'bengkel.glb': { targetH: 4.8, ovf: 1.2, minFrac: 0.55, minWorldH: 2.8 },
    'gedung1.glb': { targetH: 9.5, ovf: 1.2, minFrac: 0.85, minWorldH: 5.0 },
  }

  /**
   * Mulai memuat semua model final secara async (fire-and-forget). dipanggil
   * di akhir build() agar flow pembangunan map yang sinkron tidak terganggu.
   */
  private async dispatchFinalModels(): Promise<void> {
    const byAsset = new Map<string, ModelEntry[]>()
    for (const q of this.finalModelsQueue) {
      let arr = byAsset.get(q.asset)
      if (!arr) {
        arr = []
        byAsset.set(q.asset, arr)
      }
      arr.push(q)
    }

    // Muat SEMUA asset secara paralel dengan per-await. Satu asset yang lambat/
    // gagal TIDAK boleh memblokir asset lain (placeholder tetap jadi fallback).
    const baseFolder = '/assets/Model 3d map Ngawi City/'
    const LOAD_TIMEOUT_MS = 240000
    const tasks = [...byAsset.entries()].map(async ([asset, entries]) => {
      try {
        let pending = this.glbCache.get(asset)
        if (!pending) {
          pending = SceneLoader.ImportMeshAsync('', encodeURI(baseFolder), encodeURIComponent(asset), this.scene)
          this.glbCache.set(asset, pending)
        }
        const loaded = await Promise.race([
          pending,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`timeout ${LOAD_TIMEOUT_MS}ms`)), LOAD_TIMEOUT_MS)
          ),
        ])
        if (this.scene.isDisposed) return
        if (entries.length > 0) {
          this.placeGlbInstances(loaded.meshes, entries)
          console.log(`[AirportMap] Loaded & placed ${asset} (${entries.length} instance)`)
        }
      } catch (err) {
        if (this.scene.isDisposed) return
        console.error(`[AirportMap] Gagal memuat model ${asset}; placeholder dipertahankan.`, err)
      }
    })
    await Promise.all(tasks)
  }

  /**
   * Normalisasi tiap model final ke footprint aman placeholder lalu tempatkan.
   * Skala dihitung otomatis dari bounding box model: skala natural per jenis
   * (target tinggi) dibatasi footprint x ovf dan dibatasi bawah minFrac /
   * minWorldH. Orientasi rotY dipilih dari skala-fit terbesar. Anchor X/Z tetap
   * di posisi placeholder, dasar y=0. Setelah ditata, child mesh dicoba
   * digabung (chunked merge); bila gagal, child world-space tetap dirender.
   */
  private placeGlbInstances(loadedMeshes: AbstractMesh[], entries: ModelEntry[]): void {
    if (this.scene.isDisposed) return

    const root = loadedMeshes[0]
    if (!root) return

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
      console.warn(`[AirportMap] Model ${entries[0]?.asset} punya bounding box tak valid; placeholder dipertahankan.`)
      return
    }
    const modelLong = mdx >= mdz ? 'X' : 'Z'
    const asset = entries[0]?.asset ?? ''
    const cfg = AirportMap.TYPE_VISUAL[asset] ?? { targetH: 4.5, ovf: 1.2, minFrac: 0.6, minWorldH: 2.5 }

    for (const e of entries) {
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

      const placedMeshes = this.flattenInstToRenderables(inst, `${e.instance}_final`)
      for (const pm of placedMeshes) {
        pm.isVisible = true
        pm.receiveShadows = true
        pm.checkCollisions = true
        pm.isPickable = false
        this.lightingSetup?.addShadowCaster(pm)
        this.meshes.push(pm)
      }
      // Task 11: GLB-final statis dibekukan world-matrix-nya setelah posisi final.
      this.freezeStatics(placedMeshes)

      // Task 16: collider placeholder memakai AABB mesh primitif, sedangkan model
      // final bisa LEBIH BESAR dari footprint placeholder (skala dinormalkan ke
      // target tinggi lalu dibatasi footprint x ovf, jadi overhang 1.2-1.5x bisa
      // terjadi). Kalau collider tidak di-sync, sudut bangunan yang terlihat
      // bisa berada di luar collider → pesawat tetap menembus bangunan.
      // Samakan collider dengan AABB world model final.
      this.syncColliderToInstance(e.instance, placedMeshes)

      // Buang visual placeholder utk instance ini (collider statis tetap aktif).
      this.disposePlaceholderVisuals(e.instance)
    }

    try {
      root.dispose(false, false)
    } catch {
      // aman dibiarkan bila dispose melempar
    }
  }

  /**
   * Flatten seluruh child mesh hasil clone ke world-space lalu gabung (chunked
   * merge, batas ~250 mesh/chunk) agar jumlah mesh/draw-call turun drastis.
   * GARANSI: selalu mengembalikan set mesh render world-space yang valid.
   */
  private flattenInstToRenderables(inst: AbstractMesh, finalName: string): AbstractMesh[] {
    if (inst instanceof Mesh && inst.getTotalVertices() > 0 && inst.getChildren().length === 0) {
      return [inst]
    }
    const out: AbstractMesh[] = []
    const toMerge: Mesh[] = []
    const nonMerge: Mesh[] = []
    for (const c of inst.getChildMeshes(false)) {
      if (!(c instanceof Mesh)) continue
      if (c.isAnInstance) {
        nonMerge.push(c)
        continue
      }
      if (c.getTotalVertices() <= 0) continue
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
        // child yang gagal di-flatten tetap tinggal di bawah inst (tidak hilang).
      }
    }

    if (toMerge.length > 0) {
      const CHUNK = 250
      for (let i = 0; i < toMerge.length; i += CHUNK) {
        const chunk = toMerge.slice(i, i + CHUNK)
        const byKey = new Map<string, Mesh[]>()
        for (const m of chunk) {
          const key = `${m.sideOrientation ?? 0}|${m.material ? m.material.uniqueId : 'none'}`
          let arr = byKey.get(key)
          if (!arr) {
            arr = []
            byKey.set(key, arr)
          }
          arr.push(m)
        }
        for (const group of byKey.values()) {
          let merged: Mesh | null = null
          try {
            merged = Mesh.MergeMeshes(group, false, true, undefined, false, false)
          } catch {
            // merge gagal → group dipertahankan apa adanya (render world-space).
          }
          if (merged) {
            merged.name = toMerge.length > CHUNK ? `${finalName}#${i / CHUNK}` : finalName
            merged.parent = null
            merged.position.set(0, 0, 0)
            merged.rotation.set(0, 0, 0)
            merged.scaling.set(1, 1, 1)
            merged.computeWorldMatrix(true)
            group.forEach((m) => m.dispose(false, false))
            out.push(merged)
          } else {
            out.push(...group)
          }
        }
      }
    }
    out.push(...nonMerge)
    if (inst.getChildMeshes(false).length === 0) {
      try {
        inst.dispose(false, false)
      } catch {
        // aman dibiarkan
      }
    } else {
      out.push(...inst.getChildMeshes(false))
    }
    return out
  }

  /**
   * Buang mesh visual placeholder milik instance (prefix `${instance}_`).
   * Iterasi memakai SALINAN daftar scene agar penghapusan saat iterasi tidak
   * melewati mesh. Collider statis tidak terikat mesh sehingga tetap.
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
}