import {
  Scene,
  Vector3,
  Color3,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  DynamicTexture,
  AbstractMesh,
} from '@babylonjs/core'
import { LightingSetup } from './LightingSetup'
import { IndonesiaMap } from './IndonesiaMap'
import { FORKLIFT_LAYOUT } from '../config/forklift.layout'

interface Collider {
  min: Vector3
  max: Vector3
  mesh?: AbstractMesh
}

export class SimpleMap {
  private scene: Scene
  private lightingSetup: LightingSetup | null
  private meshes: AbstractMesh[] = []
  private colliders: Collider[] = []
  private spawnPoint: { x: number; z: number; rotationY: number } = { x: 0, z: 0, rotationY: 0 }

  /** Instansi khusus map Ngawi City (HANYA terisi bila map ini dibuat). */
  private indonesiaMap: IndonesiaMap | null = null

  // Runtime obstacle kendaraan NPC (KHAUSUS Ngawi): lingkaran 2D yang dipakai
  // agar mobil PEMAIN tidak bisa menembus mobil NPC. Diisi tiap frame oleh
  // NpcSystem → DemoScene. Tidak mempengaruhi map lain (kosong di Solo/Sriwedari).
  private ngawiCarObstacles: Array<{ x: number; z: number; r: number }> = []

  // Material dinding latihan (lazy, khusus map forklift-testing)
  private forkliftWallMat: PBRMaterial | null = null

  // Material strip tepi operational lane (lazy, khusus map forklift-testing)
  private forkliftLaneEdgeMat: PBRMaterial | null = null

  // Map boundaries - diperluas untuk objektif game
  private mapBounds = {
    minX: -400,
    maxX: 400,
    minZ: -600,
    maxZ: 400,
  }

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

  /** Get the spawn point for the car (position + facing direction) */
  getSpawnPoint() {
    return this.spawnPoint
  }

  checkCollision(position: Vector3, radius: number = 1.5): { collided: boolean; normal: Vector3; penetration: number } {
    let result = { collided: false, normal: Vector3.Zero(), penetration: 0 }
    
    // Check map boundaries
    const boundaryCheck = this.checkBoundaryCollision(position, radius)
    if (boundaryCheck.collided) {
      return boundaryCheck
    }

    // Road-corridor constraint KHUSUS Ngawi: pastikan kendaraan pemain hanya
    // mengemudi di atas aspal (jalan). Tidak menghasilkan violation apa pun—
    // hanya mendorong kembali pemain ke jalan bila pusat mobil keluar area aspal.
    if (this.indonesiaMap) {
      const roadHit = this.checkRoadCorridor(position, radius)
      if (roadHit.collided) {
        return roadHit
      }
      // Mobil NPC (runtime) sebagai rintangan lingkaran 2D — pemain TIDAK
      // boleh menembus mobil NPC. Hanya aktif saat map Ngawi (list kosong di map
      // lain), dan tidak menyentuh collider/map existing.
      const o = this.ngawiCarObstacles
      let nCol = -1
      let nDist = Infinity
      for (let i = 0; i < o.length; i++) {
        const dx = position.x - o[i].x
        const dz = position.z - o[i].z
        const d2 = dx * dx + dz * dz
        if (d2 < nDist) {
          nDist = d2
          nCol = i
        }
      }
      if (nCol >= 0) {
        const ob = o[nCol]
        const dist = Math.sqrt(nDist)
        const minD = radius + ob.r
        if (dist < minD) {
          if (dist > 1e-6) {
            const nX = (position.x - ob.x) / dist
            const nZ = (position.z - ob.z) / dist
            return { collided: true, normal: new Vector3(nX, 0, nZ), penetration: minD - dist }
          }
          // pusat pemain tepat di pusat mobil NPC → dorong ke arah +X.
          return { collided: true, normal: new Vector3(1, 0, 0), penetration: minD }
        }
      }
    }
    
    // Check colliders
    for (const collider of this.colliders) {
      const closest = new Vector3(
        Math.max(collider.min.x, Math.min(position.x, collider.max.x)),
        Math.max(collider.min.y, Math.min(position.y, collider.max.y)),
        Math.max(collider.min.z, Math.min(position.z, collider.max.z))
      )
      
      const distance = Vector3.Distance(position, closest)
      
      if (distance < radius) {
        const normal = position.subtract(closest).normalize()
        if (normal.length() === 0) {
          const dx = Math.min(position.x - collider.min.x, collider.max.x - position.x)
          const dz = Math.min(position.z - collider.min.z, collider.max.z - position.z)
          if (dx < dz) {
            normal.x = position.x < (collider.min.x + collider.max.x) / 2 ? -1 : 1
          } else {
            normal.z = position.z < (collider.min.z + collider.max.z) / 2 ? -1 : 1
          }
        }
        
        result = {
          collided: true,
          normal: normal,
          penetration: radius - distance
        }
        break
      }
    }
    
    return result
  }

  private checkBoundaryCollision(position: Vector3, radius: number): { collided: boolean; normal: Vector3; penetration: number } {
    const bounds = this.mapBounds
    
    if (position.x - radius < bounds.minX) {
      return { collided: true, normal: new Vector3(1, 0, 0), penetration: bounds.minX - (position.x - radius) }
    }
    if (position.x + radius > bounds.maxX) {
      return { collided: true, normal: new Vector3(-1, 0, 0), penetration: (position.x + radius) - bounds.maxX }
    }
    if (position.z - radius < bounds.minZ) {
      return { collided: true, normal: new Vector3(0, 0, 1), penetration: bounds.minZ - (position.z - radius) }
    }
    if (position.z + radius > bounds.maxZ) {
      return { collided: true, normal: new Vector3(0, 0, -1), penetration: (position.z + radius) - bounds.maxZ }
    }
    
    return { collided: false, normal: Vector3.Zero(), penetration: 0 }
  }

  /**
   * Road-corridor constraint (HANYA dipakai saat map Ngawi aktif).
   * Jika pusat kendaraan pemain berada di luar semua area aspal (jalan/parkiran),
   * kendaraan didorong halus kembali menuju tepi aspal terdekat. Tidak menghasilkan
   * violation. Koreksi posisi dibatasi per-frame agar tidak snap/jitter/terpental.
   */
  private checkRoadCorridor(position: Vector3, radius: number): { collided: boolean; normal: Vector3; penetration: number } {
    const rects = this.indonesiaMap ? this.indonesiaMap.getDrivableRects() : []
    let bestDist = Infinity
    let bestX = 0
    let bestZ = 0

    for (const r of rects) {
      // clamp ke rect -> titik terdekat pada aspal
      const nx = Math.max(r.x0, Math.min(position.x, r.x1))
      const nz = Math.max(r.z0, Math.min(position.z, r.z1))
      const dx = position.x - nx
      const dz = position.z - nz
      const d2 = dx * dx + dz * dz
      if (d2 < bestDist) {
        bestDist = d2
        bestX = nx
        bestZ = nz
      }
    }

    const dist = Math.sqrt(bestDist)
    // Sudah di atas aspal (atau radius mobil menyentuh aspal) → tidak ada dorongan.
    if (dist <= radius || !isFinite(dist) || dist <= 1e-6) {
      return { collided: false, normal: Vector3.Zero(), penetration: 0 }
    }

    // Arah koreksi: dari posisi mobil MENUJU titik aspal terdekat (kembali ke jalan).
    // Sebelumnya arahnya terbalik (position - bestPoint) sehingga justru mendorong
    // mobil makin jauh ke rumput.
    const nx = (bestX - position.x) / dist
    const nz = (bestZ - position.z) / dist

    // Koreksi halus: batasi besarnya koreksi per frame agar tidak snap jauh.
    // Kecepatan yang diarahkan keluar jalan tetap dibatasi oleh damping normal
    // CarPhysics sehingga kendaraan "tertahan" halus di batas aspal.
    const MAX_PULL = 2.5
    const pull = Math.min(dist - radius, MAX_PULL)
    if (pull <= 0) {
      return { collided: false, normal: Vector3.Zero(), penetration: 0 }
    }
    return {
      collided: true,
      normal: new Vector3(nx, 0, nz),
      penetration: pull,
    }
  }

  /**
   * Create Solo City map - urban environment with buildings, roads, and obstacles
   */
  createSoloCity(): void {
    this.buildSoloCityLayout()
    console.log('[SimpleMap] Solo City map created with', this.colliders.length, 'colliders')
  }

  /**
   * Layout Solo City (shared builder).
   * Dipakai oleh createSoloCity() DAN createHinoDutroTesting() (Solo clone).
   * Urutan builder dijaga identik agar Solo City TIDAK berubah.
   */
  private buildSoloCityLayout(): void {
    this.createGround()
    this.createRoads()
    this.createRoadBarriers()
    this.createBuildings()
    this.createLake()
    this.createTrees()
    this.createBushes()
    this.createSpawnStation()
    this.createMapBoundaryWalls()
  }

  /**
   * Create Sriwedari Park map - open park environment with minimal obstacles
   * Perfect for testing and free driving
   */
  createSriwedariPark(): void {
    this.createParkGround()
    this.createParkPaths()
    this.createParkTrees()
    this.createParkBenches()
    this.createParkFountain()
    this.createParkLamps()
    this.createParkSpawnArea()
    this.createMapBoundaryWalls()
    
    console.log('[SimpleMap] Sriwedari Park map created with', this.colliders.length, 'colliders')
  }

  /**
   * Create Ngawi City map - lingkungan khas Indonesia (kampung/pedesaan kota).
   * Layout & objek dibangun di modul terpisah IndonesiaMap agar mudah
   * mengganti placeholder primitive dengan model 3D final nanti.
   */
  createNgawiCity(): void {
    const im = new IndonesiaMap(this.scene, this.lightingSetup ?? undefined)
    const spawn = im.buildNgawi()

    // Gabungkan mesh & collider dari IndonesiaMap ke SimpleMap
    this.meshes.push(...im.getMeshes())
    this.colliders.push(...im.getColliders())

    this.indonesiaMap = im
    this.spawnPoint = { x: spawn.x, z: spawn.z, rotationY: spawn.rotationY }

    console.log('[SimpleMap] Ngawi City map created, spawn at', this.spawnPoint)
  }

  /** Kembalikan instansi IndonesiaMap bila map saat ini adalah Ngawi City. */
  getIndonesiaMap(): IndonesiaMap | null {
    return this.indonesiaMap
  }

  /**
   * Create Forklift Testing map - area simulasi pekerjaan forklift.
   * Layout (sumbu Z menuju utara/+Z):
   * - Beton apron luas (±120 m, z -110..150) dengan boundary wall
   * - START (spawn) di selatan menghadap +Z
   * - STORAGE AREA (pad + 12 cargo, grid dipasang oleh ForkliftCargoTest)
   * - OPERATIONAL LANE (koridor tengah lebar, strip tepi kuning)
   * - MANEUVER AREA (cone zig-zag)
   * - OBSTACLE / SAFETY AREA (gerbang barier dengan celah tengah)
   * - DROP-OFF AREA (12 target slot, dipasang oleh ForkliftCargoTest)
   * - FINISH (banner di dekat dinding utara)
   * Semua koordinat diambil dari FORKLIFT_LAYOUT (single source of truth).
   */
  createForkliftTesting(): void {
    this.createForkliftGround()
    this.createForkliftBoundary()
    this.createForkliftStartArea()
    this.createForkliftStorageArea()
    this.createForkliftOperationalLane()
    this.createForkliftManeuverArea()
    this.createForkliftObstacleArea()
    this.createForkliftFinishArea()

    const s = FORKLIFT_LAYOUT.spawn
    this.spawnPoint = { x: s.x, z: s.z, rotationY: s.rotationY }

    console.log('[SimpleMap] Forklift Testing map created with', this.colliders.length, 'colliders')
  }

  /**
   * Create Hino Dutro Testing map - CLONE dari Solo City.
   *
   * Hino Dutro Testing ≈ Solo City: seluruh struktur map (ground, jalan,
   * barriers, bangunan, lake, trees, bushes, spawn station, boundary walls)
   * dibangun ulang oleh builder yang sama dengan Solo City
   * (buildSoloCityLayout) → layout, spawn & environment IDENTIK dengan
   * Solo City. Satu-satunya perbedaan adalah KENDARAAN PEMAIN: truck Hino
   * Dutro (truk_refference_rig.glb) yang dimuat DemoScene.loadTruckModel().
   * Solo City TIDAK diubah (ADD, DON'T BREAK).
   */
  createHinoDutroTesting(): void {
    this.buildSoloCityLayout()

    // Hide the canopy, pillars, and back wall above/around the spawn area
    // so the truck spawns under open sky. Floor, stripes, bollards,
    // driveway, and all road/building environment remain unchanged.
    this.hideSpawnCanopy()

    console.log('[SimpleMap] Hino Dutro Testing map created (Solo City clone, no canopy) with', this.colliders.length, 'colliders')
  }

  /**
   * Motor Testing: Solo City clone dengan kendaraan pemain diganti motor.
   * Layout identik Solo City, canopy spawn di-hide agar motor muncul di
   * bawah langit terbuka.
   */
  createMotorTesting(): void {
    this.buildSoloCityLayout()
    this.hideSpawnCanopy()
    console.log('[SimpleMap] Motor Testing map created (Solo City clone, no canopy) with', this.colliders.length, 'colliders')
  }

  // ============================================
  // FORKLIFT TESTING SPECIFIC CREATION METHODS
  // ============================================

  private createForkliftGround(): void {
    const ground = MeshBuilder.CreateGround('forkliftGround', {
      width: 240,
      height: 260,
      subdivisions: 8,
    }, this.scene)

    const groundMat = new PBRMaterial('forkliftGroundMat', this.scene)
    groundMat.albedoColor = new Color3(0.6, 0.6, 0.58) // Beton abu-abu
    groundMat.metallic = 0.1
    groundMat.roughness = 0.9
    ground.material = groundMat
    ground.receiveShadows = true
    ground.position.y = -0.02
    ground.position.z = 20

    this.meshes.push(ground)
  }

  private createForkliftBoundary(): void {
    // Dinding pembatas mengelilingi apron latihan
    const walls = [
      { x: 0, z: 150, width: 238, depth: 1 },    // North
      { x: 0, z: -108, width: 238, depth: 1 },   // South
      { x: 117, z: 20, width: 1, depth: 258 },   // East
      { x: -117, z: 20, width: 1, depth: 258 },  // West
    ]

    walls.forEach((wall) => {
      this.createForkliftWall(wall.x, wall.z, wall.width, wall.depth)
    })
  }

  /** START AREA — pad spawn forklift + sign. */
  private createForkliftStartArea(): void {
    const area = FORKLIFT_LAYOUT.start

    const padMat = new PBRMaterial('forkliftStartPadMat', this.scene)
    padMat.albedoColor = new Color3(0.42, 0.47, 0.45)
    padMat.metallic = 0.05
    padMat.roughness = 0.9

    const pad = MeshBuilder.CreateGround('forkliftStartPad', {
      width: area.halfW * 2,
      height: area.halfD * 2,
      subdivisions: 1,
    }, this.scene)
    pad.position = new Vector3(area.x, 0.005, area.z)
    pad.material = padMat
    pad.receiveShadows = true
    this.meshes.push(pad)

    // Penanda garis identifikasi START
    this.createForkliftSign('START \u2022 FORKLIFT OPERATION', 'forkliftStartSign', 17.5, area.z, -Math.PI / 2)
  }

  /** STORAGE AREA — sign identitas (pad & cargo dibangun ForkliftCargoTest). */
  private createForkliftStorageArea(): void {
    this.createForkliftSign('STORAGE AREA', 'forkliftStorageSign', 17.5, FORKLIFT_LAYOUT.storagePad.z, -Math.PI / 2)
  }

  /** OPERATIONAL LANE — koridor tengah tanpa dinding (strip tepi kuning). */
  private createForkliftOperationalLane(): void {
    const edgeMat = this.getForkliftLaneEdgeMaterial()
    const zStart = FORKLIFT_LAYOUT.laneZStart
    const zEnd = FORKLIFT_LAYOUT.laneZEnd
    const zc = (zStart + zEnd) / 2
    const depth = zEnd - zStart

    for (const s of [-1, 1]) {
      const strip = MeshBuilder.CreateBox(`forkliftLaneEdge_${s > 0 ? 'e' : 'w'}`, {
        width: 0.22,
        height: 0.05,
        depth,
      }, this.scene)
      strip.position = new Vector3(s * FORKLIFT_LAYOUT.laneEdgeX, 0.03, zc)
      strip.material = edgeMat
      strip.receiveShadows = true
      this.meshes.push(strip)
    }

    this.createForkliftLaneArrows()
    this.createForkliftSign('OPERATIONAL LANE', 'forkliftLaneSign', 17.5, 20, -Math.PI / 2)
  }

  /** Chevron penunjuk arah (utara) di pintu keluar storage. */
  private createForkliftLaneArrows(): void {
    const mat = this.getForkliftLaneEdgeMaterial()
    const pts = [
      { x: 0, z: -14 },
      { x: 0, z: -8 },
      { x: 0, z: -2 },
    ]
    pts.forEach((pos, i) => {
      for (const s of [-1, 1]) {
        const arm = MeshBuilder.CreateBox(`forkliftLaneChevron_${i}_${s > 0 ? 'r' : 'l'}`, {
          width: 1.7,
          height: 0.05,
          depth: 0.35,
        }, this.scene)
        arm.position = new Vector3(pos.x, 0.035, pos.z)
        arm.rotation.y = s * (Math.PI / 4)
        arm.material = mat
        this.meshes.push(arm)
      }
    })
  }

  /** MANEUVER AREA — cone zig-zag di tengah operational lane. */
  private createForkliftManeuverArea(): void {
    const coneMat = new PBRMaterial('forkliftConeMat', this.scene)
    coneMat.albedoColor = new Color3(0.9, 0.35, 0.1) // Oranye
    coneMat.metallic = 0
    coneMat.roughness = 0.7

    const stripeMat = new PBRMaterial('forkliftConeStripeMat', this.scene)
    stripeMat.albedoColor = new Color3(1, 1, 1)
    stripeMat.metallic = 0
    stripeMat.roughness = 0.7

    FORKLIFT_LAYOUT.maneuverCones.forEach((pos, i) => {
      const cone = MeshBuilder.CreateCylinder(`forkliftCone_${i}`, {
        diameterTop: 0.12,
        diameterBottom: 0.55,
        height: 1.0,
        tessellation: 12,
      }, this.scene)
      cone.position = new Vector3(pos.x, 0.5, pos.z)
      cone.material = coneMat
      this.lightingSetup?.addShadowCaster(cone)
      this.meshes.push(cone)
      this.addBoxCollider(cone)

      const stripe = MeshBuilder.CreateBox(`forkliftConeStripe_${i}`, {
        width: 0.16,
        height: 0.12,
        depth: 0.16,
      }, this.scene)
      stripe.position = new Vector3(pos.x, 0.85, pos.z)
      stripe.material = stripeMat
      this.meshes.push(stripe)
    })

    this.createForkliftSign('MANEUVER AREA', 'forkliftManeuverSign', -17.5, 76, Math.PI / 2)
  }

  /** OBSTACLE / SAFETY AREA — gerbang barier kuning dengan celah tengah 6 m. */
  private createForkliftObstacleArea(): void {
    const o = FORKLIFT_LAYOUT.obstacle
    const segHalfW = (o.halfW - o.gapHalf) / 2 // 6.5 per segmen
    const segW = o.halfW - o.gapHalf // 13

    const barrierMat = new PBRMaterial('forkliftObstacleMat', this.scene)
    barrierMat.albedoColor = new Color3(0.9, 0.72, 0.1) // Kuning safety
    barrierMat.metallic = 0.2
    barrierMat.roughness = 0.6

    const capMat = new PBRMaterial('forkliftObstacleCapMat', this.scene)
    capMat.albedoColor = new Color3(0.8, 0.3, 0.2)
    capMat.metallic = 0.2
    capMat.roughness = 0.5

    for (const s of [-1, 1]) {
      const cx = s * (o.gapHalf + segHalfW)
      const barrier = MeshBuilder.CreateBox(`forkliftObstacle_${s > 0 ? 'e' : 'w'}`, {
        width: segW,
        height: o.height,
        depth: 0.35,
      }, this.scene)
      barrier.position = new Vector3(cx, o.height / 2, o.z)
      barrier.material = barrierMat
      barrier.receiveShadows = true
      this.lightingSetup?.addShadowCaster(barrier)
      this.meshes.push(barrier)
      this.addBoxCollider(barrier)

      // Strip atas merah agar gerbang mudah terlihat (marking safety)
      const cap = MeshBuilder.CreateBox(`forkliftObstacleCap_${s > 0 ? 'e' : 'w'}`, {
        width: segW + 0.1,
        height: 0.14,
        depth: 0.4,
      }, this.scene)
      cap.position = new Vector3(cx, o.height + 0.07, o.z)
      cap.material = capMat
      cap.receiveShadows = true
      this.meshes.push(cap)
      this.addBoxCollider(cap)
    }

    this.createForkliftSign('OBSTACLE / SAFETY AREA', 'forkliftObstacleSign', -17.5, o.z, Math.PI / 2)
  }

  /** FINISH — banner di dekat dinding utara (facing selatan). */
  private createForkliftFinishArea(): void {
    this.createForkliftSign('FINISH', 'forkliftFinishSign', FORKLIFT_LAYOUT.finish.x, FORKLIFT_LAYOUT.finish.z, Math.PI, 14, 1.6)
  }

  /** Sign/plang teks (DynamicTexture, double-sided, tanpa collider). */
  private createForkliftSign(
    text: string,
    name: string,
    x: number,
    z: number,
    rotY: number,
    width = 6,
    height = 1.2
  ): void {
    const plane = MeshBuilder.CreatePlane(name, { width, height }, this.scene)
    plane.position = new Vector3(x, 3.0, z)
    plane.rotation.y = rotY

    const tex = new DynamicTexture(`${name}_tex`, { width: 512, height: 128 }, this.scene, true)
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
    ctx.fillStyle = '#1d2333'
    ctx.fillRect(0, 0, 512, 128)
    ctx.strokeStyle = '#e5d43c'
    ctx.lineWidth = 8
    ctx.strokeRect(6, 6, 500, 116)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 64)
    tex.update()

    const mat = new StandardMaterial(`${name}_mat`, this.scene)
    mat.diffuseTexture = tex
    mat.diffuseColor = Color3.White()
    mat.emissiveColor = Color3.White()
    mat.backFaceCulling = false
    plane.material = mat

    this.meshes.push(plane)
  }

  private getForkliftLaneEdgeMaterial(): PBRMaterial {
    if (!this.forkliftLaneEdgeMat) {
      this.forkliftLaneEdgeMat = new PBRMaterial('forkliftLaneEdgeMat', this.scene)
      this.forkliftLaneEdgeMat.albedoColor = new Color3(0.9, 0.75, 0.15) // Kuning safety
      this.forkliftLaneEdgeMat.metallic = 0.1
      this.forkliftLaneEdgeMat.roughness = 0.6
    }
    return this.forkliftLaneEdgeMat
  }

  private getForkliftWallMaterial(): PBRMaterial {
    if (!this.forkliftWallMat) {
      this.forkliftWallMat = new PBRMaterial('forkliftWallMat', this.scene)
      this.forkliftWallMat.albedoColor = new Color3(0.35, 0.45, 0.55) // Baja kebiruan
      this.forkliftWallMat.metallic = 0.4
      this.forkliftWallMat.roughness = 0.6
    }
    return this.forkliftWallMat
  }

  private createForkliftWall(x: number, z: number, width: number, depth: number): void {
    const wall = MeshBuilder.CreateBox(`forkliftWall_${x}_${z}`, {
      width: width,
      height: 2,
      depth: depth,
    }, this.scene)
    wall.position = new Vector3(x, 1, z)
    wall.material = this.getForkliftWallMaterial()
    wall.receiveShadows = true
    this.lightingSetup?.addShadowCaster(wall)
    this.meshes.push(wall)
    this.addBoxCollider(wall)
  }

  /**
   * Set daftar lingkaran posisi kendaraan NPC (runtime) untuk map Ngawi.
   * Dipanggil tiap frame oleh DemoScene dari NpcSystem. Kosong pada map lain.
   */
  setNgawiCarObstacles(obstacles: Array<{ x: number; z: number; r: number }>): void {
    this.ngawiCarObstacles = obstacles
  }

  // Legacy method - creates Solo City
  createRaceTrack(): void {
    this.createSoloCity()
  }
  createCityMap(): void {
    this.createSoloCity()
  }

  // ============================================
  // SRIWEDARI PARK SPECIFIC CREATION METHODS
  // ============================================

  private createParkGround(): void {
    // Lush green grass for park
    const ground = MeshBuilder.CreateGround('parkGround', {
      width: 800,
      height: 1000,
      subdivisions: 32,
    }, this.scene)

    const groundMaterial = new PBRMaterial('parkGroundMaterial', this.scene)
    groundMaterial.albedoColor = new Color3(0.35, 0.55, 0.25) // Bright green grass
    groundMaterial.metallic = 0
    groundMaterial.roughness = 0.95
    ground.material = groundMaterial
    ground.receiveShadows = true
    ground.position.y = -0.02
    ground.position.z = -100

    this.meshes.push(ground)
  }

  private createParkPaths(): void {
    // Stone/gravel path material
    const pathMaterial = new PBRMaterial('pathMaterial', this.scene)
    pathMaterial.albedoColor = new Color3(0.65, 0.6, 0.55) // Light stone color
    pathMaterial.metallic = 0
    pathMaterial.roughness = 0.9

    const pathWidth = 12

    // Main circular path around the park
    const mainPaths = [
      // Horizontal main path
      { x: 0, z: 0, width: 300, depth: pathWidth, rotation: 0 },
      // Vertical main path
      { x: 0, z: -50, width: 200, depth: pathWidth, rotation: Math.PI / 2 },
      // Diagonal paths for variety
      { x: -80, z: 50, width: 100, depth: pathWidth * 0.8, rotation: Math.PI / 6 },
      { x: 80, z: 50, width: 100, depth: pathWidth * 0.8, rotation: -Math.PI / 6 },
      // Wide open area in center (plaza)
      { x: 0, z: 0, width: 60, depth: 60, rotation: 0 },
    ]

    mainPaths.forEach((path, i) => {
      const pathMesh = MeshBuilder.CreateGround(`parkPath_${i}`, {
        width: path.width,
        height: path.depth,
      }, this.scene)
      pathMesh.position = new Vector3(path.x, 0.01, path.z)
      pathMesh.rotation.y = path.rotation
      pathMesh.material = pathMaterial
      pathMesh.receiveShadows = true
      this.meshes.push(pathMesh)
    })
  }

  private createParkTrees(): void {
    // Scattered trees around the edges - not blocking paths
    const treePositions = [
      // Left side trees
      { x: -150, z: 100 }, { x: -160, z: 50 }, { x: -140, z: -20 },
      { x: -155, z: -80 }, { x: -145, z: -150 },
      // Right side trees
      { x: 150, z: 100 }, { x: 160, z: 50 }, { x: 140, z: -20 },
      { x: 155, z: -80 }, { x: 145, z: -150 },
      // Back trees
      { x: -80, z: 150 }, { x: 0, z: 160 }, { x: 80, z: 150 },
      // Front scattered trees
      { x: -100, z: -200 }, { x: 100, z: -200 },
      // Some middle area trees (away from paths)
      { x: -100, z: -50 }, { x: 100, z: -50 },
      { x: -60, z: 100 }, { x: 60, z: 100 },
    ]

    treePositions.forEach((pos, i) => {
      this.createParkTree(pos.x, pos.z, i)
    })
  }

  private createParkTree(x: number, z: number, index: number): void {
    // Tree trunk
    const trunkHeight = 3 + Math.random() * 2
    const trunk = MeshBuilder.CreateCylinder(`parkTreeTrunk_${index}`, {
      diameter: 0.8,
      height: trunkHeight,
      tessellation: 12,
    }, this.scene)
    trunk.position = new Vector3(x, trunkHeight / 2, z)

    const trunkMaterial = new PBRMaterial(`parkTrunkMat_${index}`, this.scene)
    trunkMaterial.albedoColor = new Color3(0.4, 0.28, 0.18)
    trunkMaterial.metallic = 0
    trunkMaterial.roughness = 0.95
    trunk.material = trunkMaterial
    trunk.receiveShadows = true
    this.lightingSetup?.addShadowCaster(trunk)
    this.meshes.push(trunk)

    // Tree foliage (bigger, rounder for park aesthetic)
    const foliageSize = 4 + Math.random() * 2
    const foliage = MeshBuilder.CreateSphere(`parkTreeFoliage_${index}`, {
      diameter: foliageSize,
      segments: 8,
    }, this.scene)
    foliage.position = new Vector3(x, trunkHeight + foliageSize / 3, z)

    const foliageMaterial = new PBRMaterial(`parkFoliageMat_${index}`, this.scene)
    foliageMaterial.albedoColor = new Color3(0.2 + Math.random() * 0.15, 0.5 + Math.random() * 0.2, 0.15)
    foliageMaterial.metallic = 0
    foliageMaterial.roughness = 0.9
    foliage.material = foliageMaterial
    foliage.receiveShadows = true
    this.lightingSetup?.addShadowCaster(foliage)
    this.meshes.push(foliage)

    // Add collider for trunk only (small, won't block much)
    this.addBoxCollider(trunk)
  }

  private createParkBenches(): void {
    // Park benches scattered around paths
    const benchPositions = [
      { x: -30, z: 15, rotation: 0 },
      { x: 30, z: 15, rotation: 0 },
      { x: -30, z: -15, rotation: Math.PI },
      { x: 30, z: -15, rotation: Math.PI },
      { x: 15, z: -80, rotation: Math.PI / 2 },
      { x: -15, z: -80, rotation: -Math.PI / 2 },
    ]

    const benchMaterial = new PBRMaterial('benchMaterial', this.scene)
    benchMaterial.albedoColor = new Color3(0.45, 0.35, 0.25) // Wood color
    benchMaterial.metallic = 0.1
    benchMaterial.roughness = 0.8

    const metalMaterial = new PBRMaterial('benchMetalMaterial', this.scene)
    metalMaterial.albedoColor = new Color3(0.2, 0.2, 0.2)
    metalMaterial.metallic = 0.8
    metalMaterial.roughness = 0.3

    benchPositions.forEach((pos, i) => {
      // Bench seat
      const seat = MeshBuilder.CreateBox(`benchSeat_${i}`, {
        width: 2.5,
        height: 0.15,
        depth: 0.6,
      }, this.scene)
      seat.position = new Vector3(pos.x, 0.5, pos.z)
      seat.rotation.y = pos.rotation
      seat.material = benchMaterial
      seat.receiveShadows = true
      this.lightingSetup?.addShadowCaster(seat)
      this.meshes.push(seat)

      // Bench back
      const back = MeshBuilder.CreateBox(`benchBack_${i}`, {
        width: 2.5,
        height: 0.6,
        depth: 0.1,
      }, this.scene)
      back.position = new Vector3(
        pos.x - Math.sin(pos.rotation) * 0.25,
        0.8,
        pos.z - Math.cos(pos.rotation) * 0.25
      )
      back.rotation.y = pos.rotation
      back.material = benchMaterial
      back.receiveShadows = true
      this.lightingSetup?.addShadowCaster(back)
      this.meshes.push(back)

      // Bench legs (metal)
      const legPositions = [-1, 1]
      legPositions.forEach((offset, j) => {
        const leg = MeshBuilder.CreateBox(`benchLeg_${i}_${j}`, {
          width: 0.1,
          height: 0.5,
          depth: 0.5,
        }, this.scene)
        const legX = pos.x + Math.cos(pos.rotation) * offset
        const legZ = pos.z - Math.sin(pos.rotation) * offset
        leg.position = new Vector3(legX, 0.25, legZ)
        leg.rotation.y = pos.rotation
        leg.material = metalMaterial
        leg.receiveShadows = true
        this.meshes.push(leg)
      })

      // Add small collider for bench
      this.colliders.push({
        min: new Vector3(pos.x - 1.5, 0, pos.z - 0.5),
        max: new Vector3(pos.x + 1.5, 1, pos.z + 0.5),
      })
    })
  }

  private createParkFountain(): void {
    // Central fountain in the plaza
    const fountainMaterial = new PBRMaterial('fountainMaterial', this.scene)
    fountainMaterial.albedoColor = new Color3(0.7, 0.7, 0.75) // Light stone
    fountainMaterial.metallic = 0.2
    fountainMaterial.roughness = 0.6

    const waterMaterial = new PBRMaterial('waterMaterial', this.scene)
    waterMaterial.albedoColor = new Color3(0.3, 0.5, 0.7)
    waterMaterial.metallic = 0.1
    waterMaterial.roughness = 0.2
    waterMaterial.alpha = 0.8

    // Fountain base (outer ring)
    const base = MeshBuilder.CreateCylinder('fountainBase', {
      diameter: 10,
      height: 0.8,
      tessellation: 32,
    }, this.scene)
    base.position = new Vector3(0, 0.4, 0)
    base.material = fountainMaterial
    base.receiveShadows = true
    this.lightingSetup?.addShadowCaster(base)
    this.meshes.push(base)

    // Water pool
    const pool = MeshBuilder.CreateCylinder('fountainPool', {
      diameter: 8,
      height: 0.6,
      tessellation: 32,
    }, this.scene)
    pool.position = new Vector3(0, 0.5, 0)
    pool.material = waterMaterial
    this.meshes.push(pool)

    // Center pillar
    const pillar = MeshBuilder.CreateCylinder('fountainPillar', {
      diameter: 1.5,
      height: 3,
      tessellation: 16,
    }, this.scene)
    pillar.position = new Vector3(0, 1.5, 0)
    pillar.material = fountainMaterial
    pillar.receiveShadows = true
    this.lightingSetup?.addShadowCaster(pillar)
    this.meshes.push(pillar)

    // Top bowl
    const bowl = MeshBuilder.CreateTorus('fountainBowl', {
      diameter: 3,
      thickness: 0.5,
      tessellation: 32,
    }, this.scene)
    bowl.position = new Vector3(0, 3, 0)
    bowl.material = fountainMaterial
    bowl.receiveShadows = true
    this.lightingSetup?.addShadowCaster(bowl)
    this.meshes.push(bowl)

    // Add collider for fountain
    this.colliders.push({
      min: new Vector3(-5, 0, -5),
      max: new Vector3(5, 3.5, 5),
    })
  }

  private createParkLamps(): void {
    // Street lamps along paths
    const lampPositions = [
      { x: -50, z: 0 }, { x: 50, z: 0 },
      { x: 0, z: 50 }, { x: 0, z: -100 },
      { x: -100, z: 80 }, { x: 100, z: 80 },
      { x: -100, z: -120 }, { x: 100, z: -120 },
    ]

    const poleMaterial = new PBRMaterial('lampPoleMaterial', this.scene)
    poleMaterial.albedoColor = new Color3(0.15, 0.15, 0.15)
    poleMaterial.metallic = 0.9
    poleMaterial.roughness = 0.3

    const lampMaterial = new PBRMaterial('lampLightMaterial', this.scene)
    lampMaterial.albedoColor = new Color3(1, 0.95, 0.8)
    lampMaterial.emissiveColor = new Color3(1, 0.9, 0.7)
    lampMaterial.emissiveIntensity = 0.3

    lampPositions.forEach((pos, i) => {
      // Lamp pole
      const pole = MeshBuilder.CreateCylinder(`lampPole_${i}`, {
        diameter: 0.2,
        height: 4,
        tessellation: 8,
      }, this.scene)
      pole.position = new Vector3(pos.x, 2, pos.z)
      pole.material = poleMaterial
      pole.receiveShadows = true
      this.lightingSetup?.addShadowCaster(pole)
      this.meshes.push(pole)

      // Lamp head
      const head = MeshBuilder.CreateSphere(`lampHead_${i}`, {
        diameter: 0.6,
        segments: 8,
      }, this.scene)
      head.position = new Vector3(pos.x, 4.2, pos.z)
      head.material = lampMaterial
      this.meshes.push(head)

      // Small collider for lamp pole
      this.colliders.push({
        min: new Vector3(pos.x - 0.3, 0, pos.z - 0.3),
        max: new Vector3(pos.x + 0.3, 4.5, pos.z + 0.3),
      })
    })
  }

  // ============================================
  // SOLO CITY SPECIFIC METHODS (Original)
  // ============================================

  private createGround(): void {
    // Green grass ground
    const ground = MeshBuilder.CreateGround('ground', {
      width: 800,
      height: 1000,
      subdivisions: 32,
    }, this.scene)

    const groundMaterial = new PBRMaterial('groundMaterial', this.scene)
    groundMaterial.albedoColor = new Color3(0.55, 0.65, 0.45) // Sage green
    groundMaterial.metallic = 0
    groundMaterial.roughness = 0.95
    ground.material = groundMaterial
    ground.receiveShadows = true
    ground.position.y = -0.02
    ground.position.z = -100

    this.meshes.push(ground)
  }

  private createRoads(): void {
    const roadMaterial = new PBRMaterial('roadMaterial', this.scene)
    roadMaterial.albedoColor = new Color3(0.45, 0.48, 0.42) // Gray-green road
    roadMaterial.metallic = 0.05
    roadMaterial.roughness = 0.85

    const roadWidth = 16
    const ringRoadWidth = 20 // Wider for ring road

    // ============================================
    // RING ROAD + CENTRAL DISTRICT LAYOUT
    // ============================================

    // === CENTRAL DISTRICT (Downtown Solo City - Original Grid) ===
    
    // Top horizontal road (between Gedung A and B area)
    this.createRoadSegment('road_top', -40, 150, 180, roadWidth, roadMaterial)
    
    // Middle horizontal road (between Gedung C/D area)
    this.createRoadSegment('road_mid', 5, 50, 180, roadWidth, roadMaterial)
    
    // Lower horizontal road (between Gedung F and G area)
    this.createRoadSegment('road_lower', -10, -50, 120, roadWidth, roadMaterial)
    
    // Horizontal road connecting to Gedung H
    this.createRoadSegment('road_to_H', 135, -100, 70, roadWidth, roadMaterial)
    
    // Horizontal road south of Gedung H
    this.createRoadSegment('road_south_H', 110, -178, 130, roadWidth, roadMaterial)

    // Main center vertical road (runs through the map)
    this.createRoadSegment('road_center_v', 50, -10, roadWidth, 340, roadMaterial)
    
    // Left vertical road
    this.createRoadSegment('road_left_v', -80, 50, roadWidth, 200, roadMaterial)
    
    // Right vertical road - to junction with Gedung H road
    this.createRoadSegment('road_right_v', 90, -27, roadWidth, 170, roadMaterial)
    
    // Vertical road to Gedung H (east side)
    this.createRoadSegment('road_gedungH_east', 170, -139, roadWidth, 94, roadMaterial)

    // Top-left curve (near Gedung A)
    this.createCurveRoad('curve_tl', -80, 150, 0, Math.PI / 2, roadWidth)
    
    // Top-right curve
    this.createCurveRoad('curve_tr', 50, 150, Math.PI / 2, Math.PI, roadWidth)

    // === RING ROAD (Outer Circle) ===
    // Ring road segments forming a large circle/square around central district
    
    // North ring segment (extended to reach ring_east at x=284)
    this.createRoadSegment('ring_north', 2, 310, 564, ringRoadWidth, roadMaterial)
    
    // South ring segment (extended to reach ring_east at x=284)
    this.createRoadSegment('ring_south', 2, -506, 564, ringRoadWidth, roadMaterial)
    
    // East ring segment
    this.createRoadSegment('ring_east', 290, -100, ringRoadWidth, 800, roadMaterial)
    
    // West ring segment
    this.createRoadSegment('ring_west', -286, -100, ringRoadWidth, 800, roadMaterial)

    // === RADIAL ROADS (Connecting Center to Ring) ===
    
    // North radial - extends road_center_v to ring
    this.createRoadSegment('radial_north', 50, 240, roadWidth, 180, roadMaterial)
    
    // South radial - extends road_center_v to ring (shifted north and extended to connect)
    this.createRoadSegment('radial_south', 50, -343, roadWidth, 326, roadMaterial)
    
    // East radial - extends from center to ring
    this.createRoadSegment('radial_east', 190, -100, 200, roadWidth, roadMaterial)
    
    // West radial - extends from center to ring
    this.createRoadSegment('radial_west', -183, 50, 206, roadWidth, roadMaterial)

    // === SUBURBAN ROADS (Outside Ring) ===
    
    // North suburban area
    this.createRoadSegment('suburb_north_1', -150, 310, 200, roadWidth, roadMaterial)
    this.createRoadSegment('suburb_north_2', 150, 310, 200, roadWidth, roadMaterial)
    
    // South suburban area
    this.createRoadSegment('suburb_south_1', -150, -506, 200, roadWidth, roadMaterial)
    this.createRoadSegment('suburb_south_2', 150, -506, 200, roadWidth, roadMaterial)
    
    // East suburban
    this.createRoadSegment('suburb_east_1', 290, 100, roadWidth, 180, roadMaterial)
    this.createRoadSegment('suburb_east_2', 290, -300, roadWidth, 180, roadMaterial)

    // === JUNCTIONS ===
    
    // Central district junctions (original)
    this.createJunction(-80, 150, roadWidth)
    this.createJunction(50, 150, roadWidth)
    this.createJunction(-80, 50, roadWidth)
    this.createJunction(50, 50, roadWidth)
    this.createJunction(-80, -50, roadWidth)
    this.createJunction(50, -50, roadWidth)
    this.createJunction(90, -100, roadWidth)
    this.createJunction(170, -100, roadWidth)
    this.createJunction(170, -178, roadWidth)
    this.createJunction(50, -178, roadWidth)
    
    // Ring road intersections with radial roads
    this.createJunction(50, 310, ringRoadWidth)    // North ring + radial_north
    this.createJunction(50, -506, ringRoadWidth)   // South ring + radial_south
    this.createJunction(290, -100, ringRoadWidth)  // East ring + radial_east
    this.createJunction(-286, 50, ringRoadWidth)   // West ring + radial_west
    
    // Ring road corners
    this.createJunction(290, 310, ringRoadWidth)   // NE corner
    this.createJunction(-286, 310, ringRoadWidth)  // NW corner
    this.createJunction(290, -506, ringRoadWidth)  // SE corner
    this.createJunction(-286, -506, ringRoadWidth) // SW corner
    
    // Suburban intersections
    this.createJunction(-150, 310, roadWidth)  // North suburb west
    this.createJunction(150, 310, roadWidth)   // North suburb east
    this.createJunction(-150, -506, roadWidth) // South suburb west
    this.createJunction(150, -506, roadWidth)  // South suburb east
    this.createJunction(290, 100, roadWidth)   // East suburb north
    this.createJunction(290, -300, roadWidth)  // East suburb south

    // Road markings
    this.createRoadMarkings()
  }

  private createRoadSegment(
    name: string, 
    x: number, 
    z: number, 
    width: number, 
    height: number, 
    material: PBRMaterial
  ): void {
    const road = MeshBuilder.CreateGround(name, {
      width: width,
      height: height,
    }, this.scene)
    road.position = new Vector3(x, 0.01, z)
    road.material = material
    road.receiveShadows = true
    this.meshes.push(road)
  }

  private createCurveRoad(
    name: string,
    x: number,
    z: number,
    startAngle: number,
    endAngle: number,
    roadWidth: number
  ): void {
    const material = new PBRMaterial(`${name}_mat`, this.scene)
    material.albedoColor = new Color3(0.45, 0.48, 0.42)
    material.metallic = 0.05
    material.roughness = 0.85

    const curve = MeshBuilder.CreateDisc(name, {
      radius: roadWidth / 2 + 1,
      arc: Math.abs(endAngle - startAngle) / (2 * Math.PI),
      tessellation: 24,
    }, this.scene)
    curve.rotation.x = Math.PI / 2
    curve.rotation.y = startAngle
    curve.position = new Vector3(x, 0.01, z)
    curve.material = material
    curve.receiveShadows = true
    this.meshes.push(curve)
  }

  private createJunction(x: number, z: number, size: number): void {
    const material = new PBRMaterial(`junction_${x}_${z}`, this.scene)
    material.albedoColor = new Color3(0.45, 0.48, 0.42)
    material.metallic = 0.05
    material.roughness = 0.85

    const junction = MeshBuilder.CreateGround(`junction_${x}_${z}`, {
      width: size + 4,
      height: size + 4,
    }, this.scene)
    junction.position = new Vector3(x, 0.015, z)
    junction.material = material
    junction.receiveShadows = true
    this.meshes.push(junction)
  }

  private createRoadMarkings(): void {
    const lineMaterial = new StandardMaterial('lineMaterial', this.scene)
    lineMaterial.diffuseColor = new Color3(1, 1, 0.9)
    lineMaterial.emissiveColor = new Color3(0.3, 0.3, 0.25)

    // Dashed center lines for horizontal roads (central district + ring + suburban)
    const horizontalRoads = [
      // Central district
      { x: -40, z: 150, length: 180 },
      { x: 5, z: 50, length: 180 },
      { x: -10, z: -50, length: 120 },
      { x: 135, z: -100, length: 70 },
      { x: 110, z: -178, length: 130 },
      // Ring road
      { x: 2, z: 310, length: 564 },
      { x: 2, z: -506, length: 564 },
      // Radial roads (horizontal parts)
      { x: 190, z: -100, length: 200 },
      { x: -183, z: 50, length: 206 },
      // Suburban
      { x: -150, z: 310, length: 200 },
      { x: 150, z: 310, length: 200 },
      { x: -150, z: -506, length: 200 },
      { x: 150, z: -506, length: 200 },
    ]

    horizontalRoads.forEach(road => {
      for (let i = road.x - road.length / 2 + 5; i < road.x + road.length / 2; i += 10) {
        const dash = MeshBuilder.CreateBox(`dash_h_${road.z}_${i}`, {
          width: 5,
          height: 0.02,
          depth: 0.3,
        }, this.scene)
        dash.position = new Vector3(i, 0.02, road.z)
        dash.material = lineMaterial
        this.meshes.push(dash)
      }
    })

    // Dashed center lines for vertical roads (central district + ring + radial + suburban)
    const verticalRoads = [
      // Central district
      { x: 50, z: -20, length: 340 },
      { x: -80, z: 50, length: 200 },
      { x: 90, z: -27, length: 170 },
      { x: 170, z: -139, length: 94 },
      // Ring road
      { x: 290, z: -100, length: 800 },
      { x: -286, z: -100, length: 800 },
      // Radial roads
      { x: 50, z: 240, length: 180 },
      { x: 50, z: -343, length: 326 },
      // Suburban
      { x: 290, z: 100, length: 180 },
      { x: 290, z: -300, length: 180 },
    ]

    verticalRoads.forEach(road => {
      for (let i = road.z - road.length / 2 + 5; i < road.z + road.length / 2; i += 10) {
        const dash = MeshBuilder.CreateBox(`dash_v_${road.x}_${i}`, {
          width: 0.3,
          height: 0.02,
          depth: 5,
        }, this.scene)
        dash.position = new Vector3(road.x, 0.02, i)
        dash.material = lineMaterial
        this.meshes.push(dash)
      }
    })
  }

  private createRoadBarriers(): void {
    const barrierMaterial = new PBRMaterial('barrierMaterial', this.scene)
    barrierMaterial.albedoColor = new Color3(0.85, 0.85, 0.8) // Light gray/white
    barrierMaterial.metallic = 0.3
    barrierMaterial.roughness = 0.6

    const barrierHeight = 1.0
    const barrierWidth = 0.4
    const roadWidth = 16
    const ringRoadWidth = 20
    const offset = roadWidth / 2 + barrierWidth / 2 // Place barriers at road edge
    const ringOffset = ringRoadWidth / 2 + barrierWidth / 2
    const junctionGap = roadWidth + 2 // Gap size at intersections

    // Central district junctions (normal road width offset)
    const centralJunctions = [
      { x: -80, z: 150 },
      { x: 50, z: 150 },
      { x: -80, z: 50 },
      { x: 50, z: 50 },
      { x: 90, z: 50 },
      { x: -80, z: -50 },
      { x: 50, z: -50 },
      { x: 90, z: -100 },
      { x: 170, z: -100 },
      { x: 170, z: -178 },
      { x: 50, z: -178 },
      // Station exit junction (driveway meets road_center_v)
      { x: 50, z: 73 },
    ]

    // Ring road junctions (ring road width offset)
    const ringJunctions = [
      // Ring road intersections with radial
      { x: 50, z: 310 },     // ring_north + radial_north (corners handled separately)
      { x: 50, z: -506 },    // ring_south + radial_south
      { x: 290, z: -100 },   // ring_east + radial_east
      { x: -286, z: 50 },    // ring_west + radial_west
      // Ring corners - handled manually, barriers end before corners
    ]

    // Combined junctions for barrier gap calculation
    const junctions = [...centralJunctions, ...ringJunctions]

    // Horizontal roads with their barrier positions
    const horizontalRoads = [
      // Central district
      { x: -40, z: 150, length: 180, offset: offset },
      { x: 5, z: 50, length: 180, offset: offset },
      { x: -10, z: -50, length: 120, offset: offset },
      { x: 135, z: -100, length: 70, offset: offset },
      { x: 110, z: -178, length: 130, offset: offset },
      // Ring road (barriers end before corners for clean fit)
      { x: 2, z: 310, length: 556, offset: ringOffset },   // from x=-276 to x=280
      { x: 2, z: -506, length: 556, offset: ringOffset },  // from x=-276 to x=280
      // Radial horizontal - adjusted so barriers end at ring road edge
      { x: 185, z: -100, length: 190, offset: offset },  // ends at x=280, before ring_east
      { x: -178, z: 50, length: 196, offset: offset },   // starts at x=-276, after ring_west
      // Note: suburban roads at z:300 and z:-500 share barriers with ring road
    ]

    // Create barriers for horizontal roads with gaps at junctions
    horizontalRoads.forEach((road, roadIdx) => {
      const startX = road.x - road.length / 2
      const endX = road.x + road.length / 2
      const currentOffset = road.offset
      
      // Find junctions that intersect this road (same z)
      const roadJunctions = junctions
        .filter(j => Math.abs(j.z - road.z) < 1 && j.x >= startX && j.x <= endX)
        .map(j => j.x)
        .sort((a, b) => a - b)

      // Create barrier segments with gaps at junctions
      this.createBarriersWithGaps(
        `barrier_h_n_${roadIdx}`,
        startX, endX,
        road.z + currentOffset,
        roadJunctions,
        junctionGap,
        barrierHeight, barrierWidth,
        barrierMaterial,
        'horizontal'
      )
      this.createBarriersWithGaps(
        `barrier_h_s_${roadIdx}`,
        startX, endX,
        road.z - currentOffset,
        roadJunctions,
        junctionGap,
        barrierHeight, barrierWidth,
        barrierMaterial,
        'horizontal'
      )
    })

    // Vertical roads
    const verticalRoads = [
      // Central district
      { x: 50, z: -10, length: 340, offset: offset },
      { x: -80, z: 50, length: 200, offset: offset },
      { x: 90, z: -27, length: 170, offset: offset },
      { x: 170, z: -139, length: 94, offset: offset },
      // Ring road (barriers end before corners for clean fit)
      { x: 290, z: -98, length: 796, offset: ringOffset },  // from z=-496 to z=300
      { x: -286, z: -98, length: 796, offset: ringOffset }, // from z=-496 to z=300
      // Radial vertical - adjusted so barriers end at ring road edge
      { x: 50, z: 230, length: 140, offset: offset },   // start=171, end=299 (after road_top, before ring_north)
      { x: 50, z: -341, length: 310, offset: offset },  // start=-491, end=-191 (before junction at -178)
      // Note: suburban roads at x:280 and x:-280 share barriers with ring road
    ]

    // Create barriers for vertical roads with gaps at junctions
    verticalRoads.forEach((road, roadIdx) => {
      const startZ = road.z - road.length / 2
      const endZ = road.z + road.length / 2
      const currentOffset = road.offset
      
      // Find junctions that intersect this road (same x)
      const roadJunctions = junctions
        .filter(j => Math.abs(j.x - road.x) < 1 && j.z >= startZ && j.z <= endZ)
        .map(j => j.z)
        .sort((a, b) => a - b)

      // Create barrier segments with gaps at junctions
      this.createBarriersWithGaps(
        `barrier_v_e_${roadIdx}`,
        startZ, endZ,
        road.x + currentOffset,
        roadJunctions,
        junctionGap,
        barrierHeight, barrierWidth,
        barrierMaterial,
        'vertical'
      )
      this.createBarriersWithGaps(
        `barrier_v_w_${roadIdx}`,
        startZ, endZ,
        road.x - currentOffset,
        roadJunctions,
        junctionGap,
        barrierHeight, barrierWidth,
        barrierMaterial,
        'vertical'
      )
    })

    // Add special barriers for T-junctions (forced turn) - only for central district
    this.createTJunctionBarriers(offset, barrierHeight, barrierWidth, barrierMaterial)

    // Add corner pieces at junctions to close diagonal gaps
    this.createJunctionCorners(junctions, offset, barrierHeight, barrierWidth, barrierMaterial)
  }

  private createJunctionCorners(
    junctions: { x: number; z: number }[],
    offset: number,
    height: number,
    width: number,
    material: PBRMaterial
  ): void {
    const cornerSize = width + 0.5 // Size of corner piece

    junctions.forEach((junction, i) => {
      // Skip radial-ring junctions - custom corners handled in createTJunctionBarriers
      if (junction.x === 50 && junction.z === 310) return   // radial_north + ring_north
      if (junction.x === 50 && junction.z === -506) return  // radial_south + ring_south
      if (junction.x === 290 && junction.z === -100) return // radial_east + ring_east
      if (junction.x === -286 && junction.z === 50) return  // radial_west + ring_west
      // Skip ring corners - custom handling in createTJunctionBarriers
      if (junction.x === 290 && junction.z === 310) return   // NE corner
      if (junction.x === -286 && junction.z === 310) return  // NW corner
      if (junction.x === 290 && junction.z === -506) return  // SE corner
      if (junction.x === -286 && junction.z === -506) return // SW corner

      // Create 4 corner pieces for each junction (NE, NW, SE, SW)
      const corners = [
        { x: junction.x + offset, z: junction.z + offset, name: 'NE' },  // North-East
        { x: junction.x - offset, z: junction.z + offset, name: 'NW' },  // North-West
        { x: junction.x + offset, z: junction.z - offset, name: 'SE' },  // South-East
        { x: junction.x - offset, z: junction.z - offset, name: 'SW' },  // South-West
      ]

      corners.forEach(corner => {
        const cornerPiece = MeshBuilder.CreateBox(`corner_${i}_${corner.name}`, {
          width: cornerSize,
          height: height,
          depth: cornerSize,
        }, this.scene)
        cornerPiece.position = new Vector3(corner.x, height / 2, corner.z)
        cornerPiece.material = material
        cornerPiece.receiveShadows = true
        this.lightingSetup?.addShadowCaster(cornerPiece)
        this.meshes.push(cornerPiece)
        this.addBoxCollider(cornerPiece)
      })
    })
  }

  private createTJunctionBarriers(
    offset: number,
    height: number,
    width: number,
    material: PBRMaterial
  ): void {
    const roadWidth = 16

    // T-junction at road_top & road_left_v (-80, 150)
    // Block west and north sides
    
    // Barrier blocking west side of junction
    const blockWest0 = MeshBuilder.CreateBox('tjunc_-80_150_block_west', {
      width: width,
      height: height,
      depth: roadWidth,
    }, this.scene)
    blockWest0.position = new Vector3(-80 - offset, height / 2, 150)
    blockWest0.material = material
    blockWest0.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockWest0)
    this.meshes.push(blockWest0)
    this.addBoxCollider(blockWest0)

    // Barrier blocking north side of junction
    const blockNorth0 = MeshBuilder.CreateBox('tjunc_-80_150_block_north', {
      width: roadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockNorth0.position = new Vector3(-80, height / 2, 150 + offset)
    blockNorth0.material = material
    blockNorth0.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockNorth0)
    this.meshes.push(blockNorth0)
    this.addBoxCollider(blockNorth0)

    // T-junction at road_mid & road_right_v (90, 50)
    // Block going straight (east) and turning left (north)
    // This forces cars coming from west to turn right (south)
    
    // Barrier blocking straight path (east side of junction)
    const blockEast1 = MeshBuilder.CreateBox('tjunc_90_50_block_east', {
      width: width,
      height: height,
      depth: roadWidth,
    }, this.scene)
    blockEast1.position = new Vector3(90 + offset, height / 2, 50)
    blockEast1.material = material
    blockEast1.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockEast1)
    this.meshes.push(blockEast1)
    this.addBoxCollider(blockEast1)

    // Barrier blocking left turn (north side of junction)
    const blockNorth1 = MeshBuilder.CreateBox('tjunc_90_50_block_north', {
      width: roadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockNorth1.position = new Vector3(90, height / 2, 50 + offset)
    blockNorth1.material = material
    blockNorth1.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockNorth1)
    this.meshes.push(blockNorth1)
    this.addBoxCollider(blockNorth1)

    // T-junction at road_center_v & road_top (50, 150)
    // Block going straight (east) - north is now open for radial_north access
    
    // Barrier blocking straight path (east side of junction)
    const blockEast2 = MeshBuilder.CreateBox('tjunc_50_150_block_east', {
      width: width,
      height: height,
      depth: roadWidth,
    }, this.scene)
    blockEast2.position = new Vector3(50 + offset, height / 2, 150)
    blockEast2.material = material
    blockEast2.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockEast2)
    this.meshes.push(blockEast2)
    this.addBoxCollider(blockEast2)

    // North side is now OPEN for radial_north access

    // Junction (-80, 50) is now a full 4-way intersection
    // Allows access to: road_left_v (N/S), road_mid (E), radial_west (W)
    // Mobil bisa belok ke barat menuju radial_west

    // T-junction at road_left_v & road_lower (-80, -50)
    // Block west and south sides
    
    // Barrier blocking west side of junction
    const blockWest4 = MeshBuilder.CreateBox('tjunc_-80_-50_block_west', {
      width: width,
      height: height,
      depth: roadWidth,
    }, this.scene)
    blockWest4.position = new Vector3(-80 - offset, height / 2, -50)
    blockWest4.material = material
    blockWest4.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockWest4)
    this.meshes.push(blockWest4)
    this.addBoxCollider(blockWest4)

    // Barrier blocking south side of junction
    const blockSouth4 = MeshBuilder.CreateBox('tjunc_-80_-50_block_south', {
      width: roadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockSouth4.position = new Vector3(-80, height / 2, -50 - offset)
    blockSouth4.material = material
    blockSouth4.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockSouth4)
    this.meshes.push(blockSouth4)
    this.addBoxCollider(blockSouth4)

    // Junction (50, -50) - road_lower & road_center_v
    // Block east side
    const blockEast10 = MeshBuilder.CreateBox('tjunc_50_-50_block_east', {
      width: width,
      height: height,
      depth: roadWidth,
    }, this.scene)
    blockEast10.position = new Vector3(50 + offset, height / 2, -50)
    blockEast10.material = material
    blockEast10.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockEast10)
    this.meshes.push(blockEast10)
    this.addBoxCollider(blockEast10)

    // T-junction at road_center_v & road_south_H (50, -178)
    // Block west side - south is now open for radial_south access
    
    // Barrier blocking west side of junction
    const blockWest6 = MeshBuilder.CreateBox('tjunc_50_-178_block_west', {
      width: width,
      height: height,
      depth: roadWidth,
    }, this.scene)
    blockWest6.position = new Vector3(50 - offset, height / 2, -178)
    blockWest6.material = material
    blockWest6.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockWest6)
    this.meshes.push(blockWest6)
    this.addBoxCollider(blockWest6)

    // South side is now OPEN for radial_south access

    // T-junction at road_south_H & road_gedungH_east (170, -178)
    // Block east and south sides
    
    // Barrier blocking east side of junction
    const blockEast7 = MeshBuilder.CreateBox('tjunc_170_-178_block_east', {
      width: width,
      height: height,
      depth: roadWidth,
    }, this.scene)
    blockEast7.position = new Vector3(170 + offset, height / 2, -178)
    blockEast7.material = material
    blockEast7.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockEast7)
    this.meshes.push(blockEast7)
    this.addBoxCollider(blockEast7)

    // Barrier blocking south side of junction
    const blockSouth7 = MeshBuilder.CreateBox('tjunc_170_-178_block_south', {
      width: roadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockSouth7.position = new Vector3(170, height / 2, -178 - offset)
    blockSouth7.material = material
    blockSouth7.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockSouth7)
    this.meshes.push(blockSouth7)
    this.addBoxCollider(blockSouth7)

    // T-junction at road_gedungH_east & road_to_H (170, -100)
    // Now allows passage to east (radial_east) - only block north side
    
    // Barrier blocking north side of junction
    const blockNorth8 = MeshBuilder.CreateBox('tjunc_170_-100_block_north', {
      width: roadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockNorth8.position = new Vector3(170, height / 2, -100 + offset)
    blockNorth8.material = material
    blockNorth8.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockNorth8)
    this.meshes.push(blockNorth8)
    this.addBoxCollider(blockNorth8)

    // T-junction at road_to_H & road_right_v (90, -100)
    // Block south and west sides
    
    // Barrier blocking west side of junction
    const blockWest9 = MeshBuilder.CreateBox('tjunc_90_-100_block_west', {
      width: width,
      height: height,
      depth: roadWidth,
    }, this.scene)
    blockWest9.position = new Vector3(90 - offset, height / 2, -100)
    blockWest9.material = material
    blockWest9.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockWest9)
    this.meshes.push(blockWest9)
    this.addBoxCollider(blockWest9)

    // Barrier blocking south side of junction
    const blockSouth9 = MeshBuilder.CreateBox('tjunc_90_-100_block_south', {
      width: roadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockSouth9.position = new Vector3(90, height / 2, -100 - offset)
    blockSouth9.material = material
    blockSouth9.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockSouth9)
    this.meshes.push(blockSouth9)
    this.addBoxCollider(blockSouth9)

    // Ring road width for corner blocking barriers
    const ringRoadWidth = 20
    const ringOffset = ringRoadWidth / 2 + width / 2

    // T-junction at ring_north & radial_north (50, 310)
    // Block north side so cars can only turn east or west
    const blockNorthRadialNorth = MeshBuilder.CreateBox('tjunc_50_310_block_north', {
      width: ringRoadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockNorthRadialNorth.position = new Vector3(50, height / 2, 310 + ringOffset)
    blockNorthRadialNorth.material = material
    blockNorthRadialNorth.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockNorthRadialNorth)
    this.meshes.push(blockNorthRadialNorth)
    this.addBoxCollider(blockNorthRadialNorth)

    // Custom corners for (50, 310) junction - radial road (16 width) meets ring road (20 width)
    const radialOffset = 16 / 2 + width / 2  // 8.2 for radial side (south)
    const cornerSize = width + 0.5

    // SE corner - where radial meets ring on east side
    const cornerSE = MeshBuilder.CreateBox('corner_50_310_SE', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerSE.position = new Vector3(50 + radialOffset, height / 2, 310 - ringOffset)
    cornerSE.material = material
    cornerSE.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerSE)
    this.meshes.push(cornerSE)
    this.addBoxCollider(cornerSE)

    // SW corner - where radial meets ring on west side
    const cornerSW = MeshBuilder.CreateBox('corner_50_310_SW', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerSW.position = new Vector3(50 - radialOffset, height / 2, 310 - ringOffset)
    cornerSW.material = material
    cornerSW.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerSW)
    this.meshes.push(cornerSW)
    this.addBoxCollider(cornerSW)

    // ============================================
    // T-junction at ring_south & radial_south (50, -506)
    // Block south side so cars can only turn east or west
    // ============================================
    const blockSouthRadialSouth = MeshBuilder.CreateBox('tjunc_50_-506_block_south', {
      width: ringRoadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockSouthRadialSouth.position = new Vector3(50, height / 2, -506 - ringOffset)
    blockSouthRadialSouth.material = material
    blockSouthRadialSouth.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockSouthRadialSouth)
    this.meshes.push(blockSouthRadialSouth)
    this.addBoxCollider(blockSouthRadialSouth)

    // Corners for (50, -506) junction
    const cornerSouthNE = MeshBuilder.CreateBox('corner_50_-506_NE', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerSouthNE.position = new Vector3(50 + radialOffset, height / 2, -506 + ringOffset)
    cornerSouthNE.material = material
    cornerSouthNE.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerSouthNE)
    this.meshes.push(cornerSouthNE)
    this.addBoxCollider(cornerSouthNE)

    const cornerSouthNW = MeshBuilder.CreateBox('corner_50_-506_NW', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerSouthNW.position = new Vector3(50 - radialOffset, height / 2, -506 + ringOffset)
    cornerSouthNW.material = material
    cornerSouthNW.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerSouthNW)
    this.meshes.push(cornerSouthNW)
    this.addBoxCollider(cornerSouthNW)

    // ============================================
    // T-junction at ring_east & radial_east (290, -100)
    // Block east side so cars can only turn north or south
    // ============================================
    const blockEastRadialEast = MeshBuilder.CreateBox('tjunc_290_-100_block_east', {
      width: width,
      height: height,
      depth: ringRoadWidth,
    }, this.scene)
    blockEastRadialEast.position = new Vector3(290 + ringOffset, height / 2, -100)
    blockEastRadialEast.material = material
    blockEastRadialEast.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockEastRadialEast)
    this.meshes.push(blockEastRadialEast)
    this.addBoxCollider(blockEastRadialEast)

    // Corners for (290, -100) junction
    const cornerEastNW = MeshBuilder.CreateBox('corner_290_-100_NW', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerEastNW.position = new Vector3(290 - ringOffset, height / 2, -100 + radialOffset)
    cornerEastNW.material = material
    cornerEastNW.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerEastNW)
    this.meshes.push(cornerEastNW)
    this.addBoxCollider(cornerEastNW)

    const cornerEastSW = MeshBuilder.CreateBox('corner_290_-100_SW', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerEastSW.position = new Vector3(290 - ringOffset, height / 2, -100 - radialOffset)
    cornerEastSW.material = material
    cornerEastSW.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerEastSW)
    this.meshes.push(cornerEastSW)
    this.addBoxCollider(cornerEastSW)

    // ============================================
    // T-junction at ring_west & radial_west (-286, 50)
    // Block west side so cars can only turn north or south
    // ============================================
    const blockWestRadialWest = MeshBuilder.CreateBox('tjunc_-286_50_block_west', {
      width: width,
      height: height,
      depth: ringRoadWidth,
    }, this.scene)
    blockWestRadialWest.position = new Vector3(-286 - ringOffset, height / 2, 50)
    blockWestRadialWest.material = material
    blockWestRadialWest.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockWestRadialWest)
    this.meshes.push(blockWestRadialWest)
    this.addBoxCollider(blockWestRadialWest)

    // Corners for (-286, 50) junction
    const cornerWestNE = MeshBuilder.CreateBox('corner_-286_50_NE', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerWestNE.position = new Vector3(-286 + ringOffset, height / 2, 50 + radialOffset)
    cornerWestNE.material = material
    cornerWestNE.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerWestNE)
    this.meshes.push(cornerWestNE)
    this.addBoxCollider(cornerWestNE)

    const cornerWestSE = MeshBuilder.CreateBox('corner_-286_50_SE', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerWestSE.position = new Vector3(-286 + ringOffset, height / 2, 50 - radialOffset)
    cornerWestSE.material = material
    cornerWestSE.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerWestSE)
    this.meshes.push(cornerWestSE)
    this.addBoxCollider(cornerWestSE)

    // ============================================
    // Ring corner at NE (290, 310)
    // Block north and east sides so cars can only go south or west
    // ============================================
    
    // Block north side
    const blockNE_North = MeshBuilder.CreateBox('corner_290_310_block_north', {
      width: ringRoadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockNE_North.position = new Vector3(290, height / 2, 310 + ringOffset)
    blockNE_North.material = material
    blockNE_North.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockNE_North)
    this.meshes.push(blockNE_North)
    this.addBoxCollider(blockNE_North)

    // Block east side
    const blockNE_East = MeshBuilder.CreateBox('corner_290_310_block_east', {
      width: width,
      height: height,
      depth: ringRoadWidth,
    }, this.scene)
    blockNE_East.position = new Vector3(290 + ringOffset, height / 2, 310)
    blockNE_East.material = material
    blockNE_East.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockNE_East)
    this.meshes.push(blockNE_East)
    this.addBoxCollider(blockNE_East)

    // SW corner piece for NE junction (290, 310)
    const cornerNE_SW = MeshBuilder.CreateBox('corner_290_310_SW', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerNE_SW.position = new Vector3(290 - ringOffset, height / 2, 310 - ringOffset)
    cornerNE_SW.material = material
    cornerNE_SW.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerNE_SW)
    this.meshes.push(cornerNE_SW)
    this.addBoxCollider(cornerNE_SW)

    // ============================================
    // Ring corner at NW (-286, 310)
    // Block north and west sides so cars can only go south or east
    // ============================================
    
    // Block north side
    const blockNW_North = MeshBuilder.CreateBox('corner_-286_310_block_north', {
      width: ringRoadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockNW_North.position = new Vector3(-286, height / 2, 310 + ringOffset)
    blockNW_North.material = material
    blockNW_North.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockNW_North)
    this.meshes.push(blockNW_North)
    this.addBoxCollider(blockNW_North)

    // Block west side
    const blockNW_West = MeshBuilder.CreateBox('corner_-286_310_block_west', {
      width: width,
      height: height,
      depth: ringRoadWidth,
    }, this.scene)
    blockNW_West.position = new Vector3(-286 - ringOffset, height / 2, 310)
    blockNW_West.material = material
    blockNW_West.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockNW_West)
    this.meshes.push(blockNW_West)
    this.addBoxCollider(blockNW_West)

    // SE corner piece for NW junction (-286, 310)
    const cornerNW_SE = MeshBuilder.CreateBox('corner_-286_310_SE', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerNW_SE.position = new Vector3(-286 + ringOffset, height / 2, 310 - ringOffset)
    cornerNW_SE.material = material
    cornerNW_SE.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerNW_SE)
    this.meshes.push(cornerNW_SE)
    this.addBoxCollider(cornerNW_SE)

    // ============================================
    // Ring corner at SE (290, -506)
    // Block south and east sides so cars can only go north or west
    // ============================================
    
    // Block south side
    const blockSE_South = MeshBuilder.CreateBox('corner_290_-506_block_south', {
      width: ringRoadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockSE_South.position = new Vector3(290, height / 2, -506 - ringOffset)
    blockSE_South.material = material
    blockSE_South.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockSE_South)
    this.meshes.push(blockSE_South)
    this.addBoxCollider(blockSE_South)

    // Block east side
    const blockSE_East = MeshBuilder.CreateBox('corner_290_-506_block_east', {
      width: width,
      height: height,
      depth: ringRoadWidth,
    }, this.scene)
    blockSE_East.position = new Vector3(290 + ringOffset, height / 2, -506)
    blockSE_East.material = material
    blockSE_East.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockSE_East)
    this.meshes.push(blockSE_East)
    this.addBoxCollider(blockSE_East)

    // NW corner piece for SE junction (290, -506)
    const cornerSE_NW = MeshBuilder.CreateBox('corner_290_-506_NW', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerSE_NW.position = new Vector3(290 - ringOffset, height / 2, -506 + ringOffset)
    cornerSE_NW.material = material
    cornerSE_NW.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerSE_NW)
    this.meshes.push(cornerSE_NW)
    this.addBoxCollider(cornerSE_NW)

    // ============================================
    // Ring corner at SW (-286, -506)
    // Block south and west sides so cars can only go north or east
    // ============================================
    
    // Block south side
    const blockSW_South = MeshBuilder.CreateBox('corner_-286_-506_block_south', {
      width: ringRoadWidth,
      height: height,
      depth: width,
    }, this.scene)
    blockSW_South.position = new Vector3(-286, height / 2, -506 - ringOffset)
    blockSW_South.material = material
    blockSW_South.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockSW_South)
    this.meshes.push(blockSW_South)
    this.addBoxCollider(blockSW_South)

    // Block west side
    const blockSW_West = MeshBuilder.CreateBox('corner_-286_-506_block_west', {
      width: width,
      height: height,
      depth: ringRoadWidth,
    }, this.scene)
    blockSW_West.position = new Vector3(-286 - ringOffset, height / 2, -506)
    blockSW_West.material = material
    blockSW_West.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockSW_West)
    this.meshes.push(blockSW_West)
    this.addBoxCollider(blockSW_West)

    // NE corner piece for SW junction (-286, -506)
    const cornerSW_NE = MeshBuilder.CreateBox('corner_-286_-506_NE', {
      width: cornerSize,
      height: height,
      depth: cornerSize,
    }, this.scene)
    cornerSW_NE.position = new Vector3(-286 + ringOffset, height / 2, -506 + ringOffset)
    cornerSW_NE.material = material
    cornerSW_NE.receiveShadows = true
    this.lightingSetup?.addShadowCaster(cornerSW_NE)
    this.meshes.push(cornerSW_NE)
    this.addBoxCollider(cornerSW_NE)

    // ============================================
    // Station exit junction at road_center_v (50, 73)
    // West side OPEN (garage exit), East side BLOCKED
    // ============================================
    const blockEastStation = MeshBuilder.CreateBox('tjunc_50_73_block_east', {
      width: width,
      height: height,
      depth: roadWidth,
    }, this.scene)
    blockEastStation.position = new Vector3(50 + offset, height / 2, 73)
    blockEastStation.material = material
    blockEastStation.receiveShadows = true
    this.lightingSetup?.addShadowCaster(blockEastStation)
    this.meshes.push(blockEastStation)
    this.addBoxCollider(blockEastStation)
  }

  private createBarriersWithGaps(
    baseName: string,
    start: number,
    end: number,
    fixedCoord: number,
    gapPositions: number[],
    gapSize: number,
    height: number,
    width: number,
    material: PBRMaterial,
    orientation: 'horizontal' | 'vertical'
  ): void {
    // Build segments between gaps
    const segments: { start: number; end: number }[] = []
    let currentStart = start

    gapPositions.forEach(gapCenter => {
      const gapStart = gapCenter - gapSize / 2
      const gapEnd = gapCenter + gapSize / 2

      if (gapStart > currentStart) {
        segments.push({ start: currentStart, end: gapStart })
      }
      currentStart = gapEnd
    })

    // Add final segment after last gap
    if (currentStart < end) {
      segments.push({ start: currentStart, end: end })
    }

    // Create barrier meshes for each segment
    segments.forEach((seg, i) => {
      const length = seg.end - seg.start
      if (length <= 0) return

      const center = (seg.start + seg.end) / 2

      const barrier = MeshBuilder.CreateBox(`${baseName}_${i}`, {
        width: orientation === 'horizontal' ? length : width,
        height: height,
        depth: orientation === 'horizontal' ? width : length,
      }, this.scene)

      if (orientation === 'horizontal') {
        barrier.position = new Vector3(center, height / 2, fixedCoord)
      } else {
        barrier.position = new Vector3(fixedCoord, height / 2, center)
      }

      barrier.material = material
      barrier.receiveShadows = true
      this.lightingSetup?.addShadowCaster(barrier)
      this.meshes.push(barrier)
      this.addBoxCollider(barrier)
    })
  }

  private createBuildings(): void {
    // Building colors
    const buildingMaterial = new PBRMaterial('buildingMaterial', this.scene)
    buildingMaterial.albedoColor = new Color3(0.95, 0.93, 0.88) // Cream/off-white
    buildingMaterial.metallic = 0.1
    buildingMaterial.roughness = 0.8

    const outlineMaterial = new PBRMaterial('outlineMaterial', this.scene)
    outlineMaterial.albedoColor = new Color3(0.4, 0.4, 0.38)
    outlineMaterial.metallic = 0.1
    outlineMaterial.roughness = 0.8

    // Buildings based on reference image layout
    const buildings = [
      // Gedung A - top left
      { name: 'Gedung A', x: -120, z: 150, width: 60, depth: 35, height: 12 },
      // Gedung B - top right
      { name: 'Gedung B', x: 130, z: 150, width: 50, depth: 40, height: 14 },
      // Gedung C - center left (smaller, inside loop)
      { name: 'Gedung C', x: -20, z: 100, width: 40, depth: 30, height: 10 },
      // Gedung D - center right
      { name: 'Gedung D', x: 150, z: 10, width: 45, depth: 50, height: 11 },
      // Gedung F - bottom left
      { name: 'Gedung F', x: -120, z: -10, width: 55, depth: 45, height: 15 },
      // Gedung G - bottom right middle
      { name: 'Gedung G', x: 150, z: -70, width: 45, depth: 40, height: 12 },
      // Gedung H - far bottom right
      { name: 'Gedung H', x: 130, z: -145, width: 55, depth: 45, height: 13 },
    ]

    buildings.forEach((b) => {
      // Main building body
      const building = MeshBuilder.CreateBox(`building_${b.name}`, {
        width: b.width,
        height: b.height,
        depth: b.depth,
      }, this.scene)
      
      building.position = new Vector3(b.x, b.height / 2, b.z)
      building.material = buildingMaterial
      building.receiveShadows = true
      this.lightingSetup?.addShadowCaster(building)
      this.meshes.push(building)

      // Add collider for building
      this.addBoxCollider(building)

      // Building outline/border
      const outline = MeshBuilder.CreateBox(`outline_${b.name}`, {
        width: b.width + 1,
        height: 0.3,
        depth: b.depth + 1,
      }, this.scene)
      outline.position = new Vector3(b.x, 0.15, b.z)
      outline.material = outlineMaterial
      this.meshes.push(outline)

      // Building label
      this.createBuildingLabel(b.name, b.x, b.z, b.height)
    })

    // === NEW BUILDINGS - DIFFERENT STYLES ===
    this.createModernBuildings()
    this.createShopHouses()
    this.createApartmentBlocks()
  }

  /**
   * Modern glass/steel style buildings
   */
  private createModernBuildings(): void {
    const glassMaterial = new PBRMaterial('glassBuildingMaterial', this.scene)
    glassMaterial.albedoColor = new Color3(0.6, 0.7, 0.8) // Blue-gray glass
    glassMaterial.metallic = 0.8
    glassMaterial.roughness = 0.1
    glassMaterial.alpha = 0.9

    const steelMaterial = new PBRMaterial('steelBuildingMaterial', this.scene)
    steelMaterial.albedoColor = new Color3(0.5, 0.5, 0.55)
    steelMaterial.metallic = 0.9
    steelMaterial.roughness = 0.2

    const modernBuildings = [
      // Tower 1 - Near north, between A and B (x=0, above road_top z=150)
      { name: 'Tower 1', x: 0, z: 195, width: 25, depth: 25, height: 22 },
      // Tower 2 - East of central road, middle area
      { name: 'Tower 2', x: 15, z: 100, width: 20, depth: 22, height: 18 },
    ]

    modernBuildings.forEach((b) => {
      // Main tower body
      const tower = MeshBuilder.CreateBox(`modern_${b.name}`, {
        width: b.width,
        height: b.height,
        depth: b.depth,
      }, this.scene)
      tower.position = new Vector3(b.x, b.height / 2, b.z)
      tower.material = glassMaterial
      tower.receiveShadows = true
      this.lightingSetup?.addShadowCaster(tower)
      this.meshes.push(tower)
      this.addBoxCollider(tower)

      // Steel frame accent
      const frame = MeshBuilder.CreateBox(`frame_${b.name}`, {
        width: b.width + 0.5,
        height: b.height * 0.1,
        depth: b.depth + 0.5,
      }, this.scene)
      frame.position = new Vector3(b.x, b.height * 0.9, b.z)
      frame.material = steelMaterial
      this.meshes.push(frame)

      // Roof accent
      const roof = MeshBuilder.CreateBox(`roof_${b.name}`, {
        width: b.width * 0.6,
        height: 3,
        depth: b.depth * 0.6,
      }, this.scene)
      roof.position = new Vector3(b.x, b.height + 1.5, b.z)
      roof.material = steelMaterial
      this.lightingSetup?.addShadowCaster(roof)
      this.meshes.push(roof)

      this.createBuildingLabel(b.name, b.x, b.z, b.height + 3)
    })
  }

  /**
   * Ruko/Shop houses - small commercial buildings in a row
   */
  private createShopHouses(): void {
    const colors = [
      new Color3(0.85, 0.75, 0.65), // Cream
      new Color3(0.75, 0.82, 0.78), // Mint
      new Color3(0.82, 0.78, 0.72), // Beige
      new Color3(0.78, 0.75, 0.85), // Lavender
    ]

    const awningMaterial = new PBRMaterial('awningMaterial', this.scene)
    awningMaterial.albedoColor = new Color3(0.6, 0.3, 0.2)
    awningMaterial.metallic = 0
    awningMaterial.roughness = 0.9

    // Row 1: South of Gedung F, along west side (x=-130, z=-80 to -140)
    const shopRow1 = [
      { x: -130, z: -85, colorIdx: 0 },
      { x: -130, z: -105, colorIdx: 1 },
      { x: -130, z: -125, colorIdx: 2 },
      { x: -130, z: -145, colorIdx: 3 },
    ]

    // Row 2: East of lake area (x=-60, z=-120 to -160)
    const shopRow2 = [
      { x: -60, z: -130, colorIdx: 1 },
      { x: -60, z: -150, colorIdx: 0 },
      { x: -60, z: -170, colorIdx: 2 },
    ]

    const allShops = [...shopRow1, ...shopRow2]
    const shopWidth = 15
    const shopDepth = 12
    const shopHeight = 8

    allShops.forEach((shop, i) => {
      const shopMaterial = new PBRMaterial(`shopMat_${i}`, this.scene)
      shopMaterial.albedoColor = colors[shop.colorIdx]
      shopMaterial.metallic = 0.05
      shopMaterial.roughness = 0.85

      // Shop body
      const shopBuilding = MeshBuilder.CreateBox(`shop_${i}`, {
        width: shopWidth,
        height: shopHeight,
        depth: shopDepth,
      }, this.scene)
      shopBuilding.position = new Vector3(shop.x, shopHeight / 2, shop.z)
      shopBuilding.material = shopMaterial
      shopBuilding.receiveShadows = true
      this.lightingSetup?.addShadowCaster(shopBuilding)
      this.meshes.push(shopBuilding)
      this.addBoxCollider(shopBuilding)

      // Awning (front canopy)
      const awning = MeshBuilder.CreateBox(`awning_${i}`, {
        width: shopWidth + 2,
        height: 0.3,
        depth: 3,
      }, this.scene)
      awning.position = new Vector3(shop.x, shopHeight * 0.4, shop.z + shopDepth / 2 + 1.5)
      awning.material = awningMaterial
      this.meshes.push(awning)
    })
  }

  /**
   * Apartment blocks - medium rise residential
   */
  private createApartmentBlocks(): void {
    const apartmentMaterial = new PBRMaterial('apartmentMaterial', this.scene)
    apartmentMaterial.albedoColor = new Color3(0.88, 0.85, 0.8) // Warm white
    apartmentMaterial.metallic = 0.05
    apartmentMaterial.roughness = 0.8

    const balconyMaterial = new PBRMaterial('balconyMaterial', this.scene)
    balconyMaterial.albedoColor = new Color3(0.6, 0.58, 0.55)
    balconyMaterial.metallic = 0.3
    balconyMaterial.roughness = 0.6

    const windowMaterial = new PBRMaterial('windowMaterial', this.scene)
    windowMaterial.albedoColor = new Color3(0.4, 0.5, 0.6)
    windowMaterial.metallic = 0.7
    windowMaterial.roughness = 0.1

    // Apartment locations - between roads, not blocking paths
    const apartments = [
      // Block 1: West of road_left_v, between z=80 and z=130
      { name: 'Apartemen 1', x: -140, z: 80, width: 30, depth: 25, height: 16, floors: 5 },
      // Block 2: South area, west of center
      { name: 'Apartemen 2', x: -30, z: -130, width: 28, depth: 22, height: 14, floors: 4 },
      // Block 3: Far south, west of radial_south
      { name: 'Apartemen 3', x: 0, z: -240, width: 32, depth: 24, height: 18, floors: 6 },
    ]

    apartments.forEach((apt) => {
      // Main building body
      const building = MeshBuilder.CreateBox(`apt_${apt.name}`, {
        width: apt.width,
        height: apt.height,
        depth: apt.depth,
      }, this.scene)
      building.position = new Vector3(apt.x, apt.height / 2, apt.z)
      building.material = apartmentMaterial
      building.receiveShadows = true
      this.lightingSetup?.addShadowCaster(building)
      this.meshes.push(building)
      this.addBoxCollider(building)

      // Balcony stripes (horizontal lines)
      const floorHeight = apt.height / apt.floors
      for (let f = 1; f < apt.floors; f++) {
        const balcony = MeshBuilder.CreateBox(`balcony_${apt.name}_${f}`, {
          width: apt.width + 1,
          height: 0.4,
          depth: apt.depth + 1,
        }, this.scene)
        balcony.position = new Vector3(apt.x, f * floorHeight, apt.z)
        balcony.material = balconyMaterial
        this.meshes.push(balcony)
      }

      // Window strips on front
      for (let f = 0; f < apt.floors; f++) {
        const windowStrip = MeshBuilder.CreateBox(`window_${apt.name}_${f}`, {
          width: apt.width * 0.8,
          height: floorHeight * 0.4,
          depth: 0.2,
        }, this.scene)
        windowStrip.position = new Vector3(apt.x, f * floorHeight + floorHeight / 2 + 0.5, apt.z + apt.depth / 2 + 0.1)
        windowStrip.material = windowMaterial
        this.meshes.push(windowStrip)
      }

      // Roof structure
      const roofStructure = MeshBuilder.CreateBox(`roofStruct_${apt.name}`, {
        width: apt.width * 0.4,
        height: 2,
        depth: apt.depth * 0.4,
      }, this.scene)
      roofStructure.position = new Vector3(apt.x, apt.height + 1, apt.z)
      roofStructure.material = balconyMaterial
      this.lightingSetup?.addShadowCaster(roofStructure)
      this.meshes.push(roofStructure)

      this.createBuildingLabel(apt.name, apt.x, apt.z, apt.height + 2)
    })
  }

  private createBuildingLabel(name: string, x: number, z: number, height: number): void {
    // Simple colored marker for building identification
    const markerMaterial = new StandardMaterial(`marker_${name}`, this.scene)
    markerMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2)
    markerMaterial.emissiveColor = new Color3(0.1, 0.1, 0.1)

    const marker = MeshBuilder.CreateBox(`label_${name}`, {
      width: 8,
      height: 0.5,
      depth: 4,
    }, this.scene)
    marker.position = new Vector3(x, height + 1, z)
    marker.material = markerMaterial
    this.meshes.push(marker)
  }

  private createLake(): void {
    // Lake in bottom-left corner (based on reference)
    const lakeMaterial = new PBRMaterial('lakeMaterial', this.scene)
    lakeMaterial.albedoColor = new Color3(0.5, 0.75, 0.8) // Light blue
    lakeMaterial.metallic = 0.3
    lakeMaterial.roughness = 0.2

    const lake = MeshBuilder.CreateDisc('lake', {
      radius: 35,
      tessellation: 32,
    }, this.scene)
    lake.rotation.x = Math.PI / 2
    lake.position = new Vector3(-140, 0.02, -200)
    lake.material = lakeMaterial
    lake.receiveShadows = true
    this.meshes.push(lake)

    // Lake edge/shore
    const shoreMaterial = new PBRMaterial('shoreMaterial', this.scene)
    shoreMaterial.albedoColor = new Color3(0.6, 0.7, 0.5)
    shoreMaterial.metallic = 0
    shoreMaterial.roughness = 0.9

    const shore = MeshBuilder.CreateDisc('shore', {
      radius: 40,
      tessellation: 32,
    }, this.scene)
    shore.rotation.x = Math.PI / 2
    shore.position = new Vector3(-140, 0.01, -200)
    shore.material = shoreMaterial
    this.meshes.push(shore)

    // Add lake as obstacle (can't drive through)
    this.colliders.push({
      min: new Vector3(-175, 0, -235),
      max: new Vector3(-105, 2, -165),
    })
  }

  private createTrees(): void {
    const trunkMaterial = new PBRMaterial('trunkMaterial', this.scene)
    trunkMaterial.albedoColor = new Color3(0.4, 0.28, 0.15)
    trunkMaterial.metallic = 0
    trunkMaterial.roughness = 0.9

    const leavesMaterial = new PBRMaterial('leavesMaterial', this.scene)
    leavesMaterial.albedoColor = new Color3(0.25, 0.5, 0.3)
    leavesMaterial.metallic = 0
    leavesMaterial.roughness = 0.8

    const leavesDarkMaterial = new PBRMaterial('leavesDarkMaterial', this.scene)
    leavesDarkMaterial.albedoColor = new Color3(0.2, 0.4, 0.25)
    leavesDarkMaterial.metallic = 0
    leavesDarkMaterial.roughness = 0.8

    // Tree positions based on reference image
    const treePositions = [
      // Near Gedung A
      { x: -160, z: 120, scale: 1.2 },
      { x: -165, z: 105, scale: 0.9 },
      // Near Gedung B  
      { x: 170, z: 120, scale: 1.0 },
      { x: 175, z: 135, scale: 1.1 },
      { x: 180, z: 105, scale: 0.8 },
      // Near Gedung D
      { x: 175, z: 20, scale: 1.0 },
      { x: 180, z: 0, scale: 1.2 },
      // Near Gedung G
      { x: 190, z: -130, scale: 1.1 },
      { x: 195, z: -150, scale: 0.9 },
      // Near lake
      { x: -170, z: -160, scale: 1.0 },
      { x: -115, z: -160, scale: 0.8 },
      { x: -100, z: -180, scale: 1.1 },
      // Center area
      { x: 10, z: 110, scale: 0.9 },
      { x: -30, z: 130, scale: 1.0 },
    ]

    treePositions.forEach((pos, i) => {
      // Trunk
      const trunk = MeshBuilder.CreateCylinder(`trunk_${i}`, {
        diameter: 0.6 * pos.scale,
        height: 3 * pos.scale,
      }, this.scene)
      trunk.position = new Vector3(pos.x, 1.5 * pos.scale, pos.z)
      trunk.material = trunkMaterial
      this.lightingSetup?.addShadowCaster(trunk)
      this.meshes.push(trunk)

      // Leaves (layered spheres for fuller look)
      const leavesBottom = MeshBuilder.CreateSphere(`leaves_b_${i}`, {
        diameter: 4 * pos.scale,
        segments: 8,
      }, this.scene)
      leavesBottom.position = new Vector3(pos.x, 4 * pos.scale, pos.z)
      leavesBottom.material = leavesDarkMaterial
      this.lightingSetup?.addShadowCaster(leavesBottom)
      this.meshes.push(leavesBottom)

      const leavesTop = MeshBuilder.CreateSphere(`leaves_t_${i}`, {
        diameter: 3 * pos.scale,
        segments: 8,
      }, this.scene)
      leavesTop.position = new Vector3(pos.x, 5.5 * pos.scale, pos.z)
      leavesTop.material = leavesMaterial
      this.lightingSetup?.addShadowCaster(leavesTop)
      this.meshes.push(leavesTop)

      // Tree collider
      this.colliders.push({
        min: new Vector3(pos.x - 0.5, 0, pos.z - 0.5),
        max: new Vector3(pos.x + 0.5, 6 * pos.scale, pos.z + 0.5),
      })
    })
  }

  private createBushes(): void {
    const bushMaterial = new PBRMaterial('bushMaterial', this.scene)
    bushMaterial.albedoColor = new Color3(0.3, 0.5, 0.25)
    bushMaterial.metallic = 0
    bushMaterial.roughness = 0.85

    const bushDarkMaterial = new PBRMaterial('bushDarkMaterial', this.scene)
    bushDarkMaterial.albedoColor = new Color3(0.25, 0.42, 0.22)
    bushDarkMaterial.metallic = 0
    bushDarkMaterial.roughness = 0.85

    // Bush clusters based on reference
    const bushClusters = [
      // Near lake
      { x: -175, z: -175, count: 3 },
      { x: -180, z: -190, count: 2 },
      { x: -120, z: -240, count: 2 },
      // Near Gedung F
      { x: -160, z: -100, count: 2 },
      // Decorative around map
      { x: -170, z: 80, count: 2 },
      { x: 180, z: 80, count: 2 },
    ]

    bushClusters.forEach((cluster, ci) => {
      for (let i = 0; i < cluster.count; i++) {
        const offsetX = (Math.random() - 0.5) * 10
        const offsetZ = (Math.random() - 0.5) * 10
        const scale = 0.8 + Math.random() * 0.4

        const bush = MeshBuilder.CreateSphere(`bush_${ci}_${i}`, {
          diameter: 2.5 * scale,
          segments: 6,
        }, this.scene)
        bush.position = new Vector3(
          cluster.x + offsetX, 
          1 * scale, 
          cluster.z + offsetZ
        )
        bush.scaling.y = 0.7
        bush.material = i % 2 === 0 ? bushMaterial : bushDarkMaterial
        this.lightingSetup?.addShadowCaster(bush)
        this.meshes.push(bush)
      }
    })
  }

  private createMapBoundaryWalls(): void {
    const wallMaterial = new PBRMaterial('boundaryWallMaterial', this.scene)
    wallMaterial.albedoColor = new Color3(0.5, 0.5, 0.5)
    wallMaterial.metallic = 0.2
    wallMaterial.roughness = 0.8

    const wallHeight = 3
    const wallThickness = 2

    // Create boundary walls and add colliders (diperluas untuk map yang lebih besar)
    const walls = [
      { x: 0, z: 400, width: 800, rotation: 0 },       // North
      { x: 0, z: -600, width: 800, rotation: 0 },      // South
      { x: 400, z: -100, width: 1000, rotation: Math.PI / 2 },   // East
      { x: -400, z: -100, width: 1000, rotation: Math.PI / 2 },  // West
    ]

    walls.forEach((wall, i) => {
      const mesh = MeshBuilder.CreateBox(`boundaryWall_${i}`, {
        width: wall.width,
        height: wallHeight,
        depth: wallThickness,
      }, this.scene)
      mesh.position = new Vector3(wall.x, wallHeight / 2, wall.z)
      mesh.rotation.y = wall.rotation
      mesh.material = wallMaterial
      mesh.receiveShadows = true
      mesh.checkCollisions = true
      this.lightingSetup?.addShadowCaster(mesh)
      this.meshes.push(mesh)

      // Add collider for boundary wall
      this.addBoxCollider(mesh)
    })
  }

  private addBoxCollider(mesh: AbstractMesh): void {
    mesh.computeWorldMatrix(true)
    const boundingInfo = mesh.getBoundingInfo()
    const min = boundingInfo.boundingBox.minimumWorld
    const max = boundingInfo.boundingBox.maximumWorld
    
    this.colliders.push({
      min: min.clone(),
      max: max.clone(),
      mesh: mesh,
    })
  }

  /**
   * Tambah collider AABB statis dari mesh eksternal (dipakai sistem pihak
   * ketiga, mis. ForkliftCargoTest, untuk guard rail). Aditif & backward-
   * compatible: tidak mengubah collider/map yang sudah ada.
   */
  addStaticCollider(mesh: AbstractMesh): void {
    this.addBoxCollider(mesh)
  }

  /**
   * Hapus collider yang sebelumnya didaftarkan via addStaticCollider.
   * Hanya menghapus entri yang mesh-nya sama (untuk cleanup/dispose).
   */
  removeStaticCollider(mesh: AbstractMesh): void {
    this.colliders = this.colliders.filter((c) => c.mesh !== mesh)
  }

  // ============================================
  // SPAWN STATION / GARAGE
  // ============================================

  /**
   * Solo City – "Fumorive Station"
   * A covered carport west of road_center_v.
   * The car starts inside facing EAST – drive straight out onto road_center_v.
   */
  private createSpawnStation(): void {
    // Station is west of road_center_v (x=50). Car faces east (+X).
    const stationX = 18
    const stationZ = 73

    // Spawn: car faces east (+X toward road_center_v)
    // heading convention: forward = (sin(h), 0, cos(h)) → PI/2 = east
    this.spawnPoint = { x: stationX, z: stationZ, rotationY: Math.PI / 2 }

    // --- Materials ---
    const concreteMat = new PBRMaterial('stationConcrete', this.scene)
    concreteMat.albedoColor = new Color3(0.72, 0.72, 0.70)
    concreteMat.metallic = 0.05
    concreteMat.roughness = 0.92

    const roofMat = new PBRMaterial('stationRoof', this.scene)
    roofMat.albedoColor = new Color3(0.28, 0.32, 0.38)
    roofMat.metallic = 0.7
    roofMat.roughness = 0.3

    const pillarMat = new PBRMaterial('stationPillar', this.scene)
    pillarMat.albedoColor = new Color3(0.9, 0.82, 0.2)
    pillarMat.metallic = 0.3
    pillarMat.roughness = 0.5

    const wallMat = new PBRMaterial('stationWall', this.scene)
    wallMat.albedoColor = new Color3(0.55, 0.55, 0.52)
    wallMat.metallic = 0.1
    wallMat.roughness = 0.8

    const stripeMat = new PBRMaterial('stationStripe', this.scene)
    stripeMat.albedoColor = new Color3(0.95, 0.85, 0.15)
    stripeMat.metallic = 0
    stripeMat.roughness = 0.7

    // --- Concrete Floor Pad ---
    const floor = MeshBuilder.CreateGround('stationFloor', {
      width: 28,
      height: 22,
    }, this.scene)
    floor.position = new Vector3(stationX, 0.04, stationZ)
    floor.material = concreteMat
    floor.receiveShadows = true
    this.meshes.push(floor)

    // --- Driveway connecting station EAST to road_center_v ---
    // Station east edge: stationX + 14 = 32
    // road_center_v west edge: 50 - 8 = 42
    // Driveway fills the gap and overlaps slightly for seamless connection
    const driveway = MeshBuilder.CreateGround('stationDriveway', {
      width: 22,   // spans from ~27 to ~49, overlapping station edge and road edge
      height: 14,
    }, this.scene)
    driveway.position = new Vector3(stationX + 20, 0.03, stationZ)
    driveway.material = concreteMat
    driveway.receiveShadows = true
    this.meshes.push(driveway)

    // --- Yellow guide stripes on floor (parking lines) ---
    const stripePositions = [
      { x: stationX, z: stationZ + 8 },
      { x: stationX, z: stationZ - 8 },
    ]
    stripePositions.forEach((pos, i) => {
      const stripe = MeshBuilder.CreateGround(`stationStripe_${i}`, {
        width: 24,
        height: 0.3,
      }, this.scene)
      stripe.position = new Vector3(pos.x, 0.05, pos.z)
      stripe.material = stripeMat
      this.meshes.push(stripe)
    })

    // Center dashed arrow line pointing east (exit direction)
    for (let d = 0; d < 5; d++) {
      const dash = MeshBuilder.CreateGround(`stationDash_${d}`, {
        width: 3,
        height: 0.25,
      }, this.scene)
      dash.position = new Vector3(stationX - 10 + d * 5.5, 0.05, stationZ)
      dash.material = stripeMat
      this.meshes.push(dash)
    }

    // --- Flat Roof / Canopy ---
    const roof = MeshBuilder.CreateBox('stationRoof', {
      width: 30,
      height: 0.4,
      depth: 24,
    }, this.scene)
    roof.position = new Vector3(stationX, 6.2, stationZ)
    roof.material = roofMat
    this.lightingSetup?.addShadowCaster(roof)
    this.meshes.push(roof)

    // Roof edge trim on EAST lip (exit side visual cue)
    const roofEdge = MeshBuilder.CreateBox('stationRoofEdge', {
      width: 0.3,
      height: 0.8,
      depth: 24,
    }, this.scene)
    roofEdge.position = new Vector3(stationX + 15, 5.8, stationZ)
    roofEdge.material = pillarMat
    this.meshes.push(roofEdge)

    // --- 4 Support Pillars ---
    const pillarPositions = [
      { x: stationX - 13, z: stationZ - 10 },
      { x: stationX - 13, z: stationZ + 10 },
      { x: stationX + 13, z: stationZ - 10 },
      { x: stationX + 13, z: stationZ + 10 },
    ]
    pillarPositions.forEach((pos, i) => {
      const pillar = MeshBuilder.CreateCylinder(`stationPillar_${i}`, {
        diameter: 0.8,
        height: 6,
        tessellation: 8,
      }, this.scene)
      pillar.position = new Vector3(pos.x, 3, pos.z)
      pillar.material = pillarMat
      pillar.receiveShadows = true
      this.lightingSetup?.addShadowCaster(pillar)
      this.meshes.push(pillar)
    })

    // --- Back Wall on WEST side (behind the car) ---
    const backWall = MeshBuilder.CreateBox('stationBackWall', {
      width: 0.6,
      height: 6,
      depth: 24,
    }, this.scene)
    backWall.position = new Vector3(stationX - 14.5, 3, stationZ)
    backWall.material = wallMat
    backWall.receiveShadows = true
    this.lightingSetup?.addShadowCaster(backWall)
    this.meshes.push(backWall)
    this.addBoxCollider(backWall)

    // --- EAST side is OPEN (exit towards road_center_v) – no wall here ---

    // --- Side Bollards (north & south edges) ---
    const bollardMat = new PBRMaterial('bollardMat', this.scene)
    bollardMat.albedoColor = new Color3(0.85, 0.2, 0.15)
    bollardMat.metallic = 0.3
    bollardMat.roughness = 0.5

    const bollardRow = [
      // North side
      { x: stationX - 8, z: stationZ + 11.5 },
      { x: stationX, z: stationZ + 11.5 },
      { x: stationX + 8, z: stationZ + 11.5 },
      // South side
      { x: stationX - 8, z: stationZ - 11.5 },
      { x: stationX, z: stationZ - 11.5 },
      { x: stationX + 8, z: stationZ - 11.5 },
    ]
    bollardRow.forEach((pos, i) => {
      const bollard = MeshBuilder.CreateCylinder(`stationBollard_${i}`, {
        diameter: 0.6,
        height: 1.2,
        tessellation: 8,
      }, this.scene)
      bollard.position = new Vector3(pos.x, 0.6, pos.z)
      bollard.material = bollardMat
      this.lightingSetup?.addShadowCaster(bollard)
      this.meshes.push(bollard)
    })

    // Side barriers (invisible colliders along north & south)
    const sideColliderN = MeshBuilder.CreateBox('stationSideN', {
      width: 28,
      height: 1.5,
      depth: 0.5,
    }, this.scene)
    sideColliderN.position = new Vector3(stationX, 0.75, stationZ + 11.5)
    sideColliderN.isVisible = false
    this.meshes.push(sideColliderN)
    this.addBoxCollider(sideColliderN)

    const sideColliderS = MeshBuilder.CreateBox('stationSideS', {
      width: 28,
      height: 1.5,
      depth: 0.5,
    }, this.scene)
    sideColliderS.position = new Vector3(stationX, 0.75, stationZ - 11.5)
    sideColliderS.isVisible = false
    this.meshes.push(sideColliderS)
    this.addBoxCollider(sideColliderS)

    // --- Station Sign ---
    this.createBuildingLabel('Fumorive Station', stationX, stationZ, 7)

    console.log(`[SimpleMap] Spawn station created at (${stationX}, ${stationZ}), exit faces EAST → road_center_v`)
  }

  /**
   * Hide the canopy/roof, pillars, and back wall above/around the spawn
   * station.  Used by Hino Dutro Testing so the truck spawns under open sky
   * while keeping all other station elements (floor, stripes, bollards,
   * driveway).  Also removes colliders for hidden meshes so there are no
   * invisible walls.  Safe to call even if meshes don't exist.
   */
  private hideSpawnCanopy(): void {
    const meshNames = [
      'stationRoof',           // flat roof slab (30 × 0.4 × 24 m)
      'stationRoofEdge',       // yellow edge trim on east lip
      'stationBackWall',       // back wall behind the car (west side)
      'stationPillar_0',       // support pillars
      'stationPillar_1',
      'stationPillar_2',
      'stationPillar_3',
      'label_Fumorive Station', // floating station label above spawn
    ]
    for (const name of meshNames) {
      const mesh = this.scene.getMeshByName(name)
      if (mesh) {
        mesh.isVisible = false
        // Remove collider so there is no invisible collision box
        this.removeStaticCollider(mesh)
      }
    }
  }

  /**
   * Sriwedari Park – simple parking / starting area
   * A small open concrete pad next to the main path.
   */
  private createParkSpawnArea(): void {
    const padX = 0
    const padZ = -80

    // Update spawn point
    this.spawnPoint = { x: padX, z: padZ, rotationY: Math.PI / 2 }

    const concreteMat = new PBRMaterial('parkPadConcrete', this.scene)
    concreteMat.albedoColor = new Color3(0.7, 0.7, 0.68)
    concreteMat.metallic = 0.05
    concreteMat.roughness = 0.9

    const stripeMat = new PBRMaterial('parkPadStripe', this.scene)
    stripeMat.albedoColor = new Color3(0.95, 0.95, 0.95)
    stripeMat.metallic = 0
    stripeMat.roughness = 0.8

    // Concrete pad
    const pad = MeshBuilder.CreateGround('parkSpawnPad', {
      width: 20,
      height: 16,
    }, this.scene)
    pad.position = new Vector3(padX, 0.03, padZ)
    pad.material = concreteMat
    pad.receiveShadows = true
    this.meshes.push(pad)

    // Parking stripes
    for (let i = -1; i <= 1; i++) {
      const stripe = MeshBuilder.CreateGround(`parkStripe_${i}`, {
        width: 0.25,
        height: 14,
      }, this.scene)
      stripe.position = new Vector3(padX + i * 6, 0.04, padZ)
      stripe.material = stripeMat
      this.meshes.push(stripe)
    }

    // Connecting path to main paths
    const connector = MeshBuilder.CreateGround('parkSpawnConnector', {
      width: 12,
      height: 34,
    }, this.scene)
    connector.position = new Vector3(padX, 0.015, padZ + 25)
    connector.material = concreteMat
    connector.receiveShadows = true
    this.meshes.push(connector)

    // Small "P" marker (parking sign post)
    const postMat = new PBRMaterial('parkPostMat', this.scene)
    postMat.albedoColor = new Color3(0.2, 0.4, 0.8)
    postMat.metallic = 0.5
    postMat.roughness = 0.4

    const signPost = MeshBuilder.CreateCylinder('parkSignPost', {
      diameter: 0.3,
      height: 3,
      tessellation: 8,
    }, this.scene)
    signPost.position = new Vector3(padX - 10, 1.5, padZ)
    signPost.material = postMat
    this.meshes.push(signPost)

    const signPlate = MeshBuilder.CreateBox('parkSignPlate', {
      width: 2,
      height: 2,
      depth: 0.15,
    }, this.scene)
    signPlate.position = new Vector3(padX - 10, 3.5, padZ)
    signPlate.material = postMat
    this.meshes.push(signPlate)

    console.log(`[SimpleMap] Park spawn area created at (${padX}, ${padZ})`)
  }

  dispose(): void {
    this.meshes.forEach(mesh => mesh.dispose())
    this.meshes = []
    this.colliders = []
    console.log('[SimpleMap] Disposed')
  }
}
