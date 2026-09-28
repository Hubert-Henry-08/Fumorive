import {
  Scene,
  TransformNode,
  Vector3,
  KeyboardEventTypes,
  Quaternion,
  AnimationGroup,
  Camera,
  UniversalCamera,
  Matrix,
} from '@babylonjs/core'
import { AIRCRAFT_CAMERA_CONFIG } from '../config'
import { useAircraftStore } from '../../stores/aircraftStore'
import type { MapType, CameraMode } from '../types'
import { SimpleMap } from '../components/SimpleMap'
import { CarCameraManager } from '../components/car/CarCameraManager'
import type { SpawnPoint } from '../types/map.types'

// Reused every frame when recomposing the aircraft root matrix for the contact
// point, so the per-frame ground check allocates nothing.
const UNIT_SCALE = new Vector3(1, 1, 1)

export class AircraftSystem {
  private scene: Scene
  private aircraftRoot: TransformNode
  private mapType: MapType
  private simpleMap: SimpleMap | null

  // Aircraft state
  private throttle: number = 0
  private speed: number = 0
  private velocityY: number = 0
  private isAirborne: boolean = false
  private engineRunning: boolean = false

  // Physics constants
  private readonly maxSpeed = 60
  private readonly acceleration = 8
  private readonly gravity = 9.8
  private readonly TAKEOFF_SPEED = 20
  private readonly STALL_SPEED = 12
  private readonly GROUND_FRICTION = 2.0
  private readonly AIR_DRAG = 0.3
  // Vertical slack allowed before the aircraft counts as touching the surface
  // (5 cm — small enough to look like a real contact, big enough to stop the
  // aircraft from flickering between airborne/grounded every frame).
  private readonly GROUND_CONTACT_TOLERANCE = 0.05
  // Rate (per second) at which the attitude re-levels once on the ground. Fast
  // enough that the aircraft settles instead of scraping nose-down, slow enough
  // to be a smooth rotation rather than a snap.
  private readonly GROUND_ALIGN_RATE = 8

  // --- Task 16: parameter collision bangunan ---
  // Jarak kecil yang dipakai untuk mendorong pesawat keluar dari permukaan
  // bangunan. Cukup supaya pesawat tidak berkedip nyangkut di dalam face, tapi
  // tetap dianggap menabrak.
  private readonly BUILDING_SKIN = 0.02
  // Sisa kecepatan horizontal setelah menabrak (0..1). Memakai mekanisme velocity
  // yang sudah ada (besaran `speed`), tanpa menambah sistem velocity baru.
  private readonly BUILDING_SPEED_KEEP = 0.25
  // Swept guard (anti-tunneling) hanya dijalankan bila perpindahan frame ini
  // lebih besar dari nilai ini. Frame normal 60 fps pada 60 m/s = 1 m, jauh di
  // bawah ini; tunneling hanya mungkin pada frame panjang / kecepatan ekstrem.
  private readonly BUILDING_SWEEP_MIN_STEP = 1.2
  // Batas iterasi anti-jitter: setelah push-out pesawat sudah tepat di luar
  // permukaan, jadi 2 iterasi cukup untuk kasus dua bangunan bersenggolan.
  private readonly BUILDING_MAX_ITER = 2
  // Bobot biaya exit untuk sumbu yang BUKAN sumbu dominan gerak pesawat.
  // > 1 membuat pesawat cenderung terdorong balik ke arah datangnya (menyeret
  // Along dinding) alih-alih memilih sumbu lain yang kebetulan lebih murah
  // (mis. naik ke atap bangunan).
  private readonly BUILDING_AXIS_BIAS = 4

  // Flight dynamics
  private pitchRate: number = 0
  private rollRate: number = 0
  private yawRate: number = 0

  // Input state
  private inputs = {
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
    yawLeft: false,
    yawRight: false,
    throttleUp: false,
    throttleDown: false,
    brake: false,
  }

  // Animation
  private propellerAnimGroup: AnimationGroup | null = null

  // Camera - using existing CarCameraManager
  private cameraManager: CarCameraManager

  private observers: any[] = []

  // Camera 2 (external propeller chase camera) reference:
  // Propeller center position relative to aircraft root (model frame:
  // +X = nose/arah terbang, +Y = kanan, +Z = atas). Read from the real
  // "propeller" node in the GLB so it follows the actual model.
  private propellerLocalOffset: Vector3 = new Vector3(4.56, 0, 1.38)

  // Ground offset (cached once)
  private groundOffsetY: number = 0

  // Lowest-surface point cloud of the aircraft, cached ONCE in the aircraft's
  // own model frame (raw GLB convention below: nose = +X, right wing = +Y,
  // top = +Z, so "down" is -Z). One point per (X, Y) column = the lowest vertex
  // of that column. Projecting it through the live world matrix each frame gives
  // the aircraft's real contact point (wheels, tail wheel or wingtip, whichever
  // is lowest at the current attitude) without any per-frame allocation.
  // `getContactY()` is the single source of truth for ground contact.
  private contactPoints: Float32Array | null = null
  private readonly contactMatrix = Matrix.Identity()
  // Contact point world Y from the previous update, used to tell "the lowest
  // point is at/below the surface AND moving onto it" from "the lowest point is
  // at the surface but already rising away" (take-off).
  private lastContactY = Number.NEGATIVE_INFINITY

  // --- Task 16: collision pesawat vs bangunan (Pesawat Testing) ---
  //
  // Sumber kebenaran tetap collider yang sudah dibangun AirportMap (AABB per
  // bangunan: rumah, ruko, terminal, hanggar, menara+kabin, shelter, gate, pos,
  // pohon). Collider dibungkus/di-cache SEKALI di constructor menjadi Float32Array
  // datar [minX,minY,minZ,maxX,maxY,maxZ] x N → tidak ada alokasi per frame, tidak
  // ada pencarian hierarchy per frame, tidak ada penghitungan ulang bounding box
  // per frame.
  private buildingBoxes: Float32Array | null = null
  private buildingBoxCount = 0
  // AABB point-cloud aircraft di model frame (untuk broad phase konservatif O(1)
  // tanpa mentransformasi 562 titik), dan buffer world hasil transformasi
  // (dipakai hanya saat benar-benar dekat bangunan).
  private cloudMinX = 0
  private cloudMaxX = 0
  private cloudMinY = 0
  private cloudMaxY = 0
  private cloudMinZ = 0
  private cloudMaxZ = 0
  // AABB sementara untuk broad phase (6 angka). Dialokasikan sekali.
  private readonly scratchAabb = new Float32Array(6)
  private readonly scratchAabb2 = new Float32Array(6)


  // Canonical wings-level, nose-horizontal attitude. Used to re-level the
  // aircraft after a touch-down that happened while banked or nose-down
  // (heading is preserved, so this is NOT an auto-landing).
  private readonly levelAttitude = Quaternion.FromEulerAngles(-Math.PI / 2, -Math.PI / 2, 0)
  private readonly scratchQuatA = Quaternion.Identity()
  private readonly scratchQuatB = Quaternion.Identity()
  // Dedicated storage for the re-levelled attitude: it BECOMES the aircraft's
  // `rotationQuaternion`, so it is never reused as a scratch value. Reusing a
  // scratch here would overwrite the aircraft's current rotation before the next
  // slerp could read it, corrupting the re-levelling.
  private readonly levelQuat = Quaternion.Identity()

  // Ground surfaces of the airfield used for ground collision (lazy cache,
  // packed flat: [minX, maxX, minZ, maxZ, surfaceTopY] x N). Collected once from
  // the real airport meshes so the aircraft sits on the actual runway / apron /
  // taxiway / access road / roads AND on the green grass terrain
  // `airport_ground` — the grass is a ground surface for the aircraft even
  // though cars cannot drive on it.
  private groundSurfaces: Float32Array | null = null
  private groundSurfaceCount = 0
  // Height of the green terrain plane; also the fallback height outside every
  // packed surface so the aircraft never falls through the map edge.
  private terrainY: number = 0

  // Spawn state (for reset)
  private spawnPosition: Vector3 = Vector3.Zero()
  private spawnRotation: Quaternion = Quaternion.Identity()

  // Optional spawn point override, supplied only by the Pesawat Testing demo.
  // When set, it replaces the car map's default spawn so reset (R) returns to
  // the real airport runway spawn point instead of the car map origin.
  private spawnOverride: SpawnPoint | null = null

  // Local axes in the aircraft's own model frame (raw GLB):
  //   nose = +X (propeller at +X end), top = +Z, right wing = +Y.
  // The root rotation Quaternion.FromEulerAngles(-PI/2, -PI/2, 0) maps:
  //   nose(+X) -> World +Z, right wing(+Y) -> World +X, top(+Z) -> World +Y
  // so the physics forward IS the visual nose and camera heading stays in sync.
  // LOCAL_RIGHT is the wing axis around which pitch rotates the nose up (+).
  private readonly LOCAL_FORWARD = new Vector3(1, 0, 0)
  private readonly LOCAL_RIGHT = new Vector3(0, -1, 0)
  private readonly LOCAL_UP = new Vector3(0, 0, 1)

  constructor(
    scene: Scene,
    aircraftRoot: TransformNode,
    mapType: MapType,
    simpleMap: SimpleMap | null,
    spawnOverride: SpawnPoint | null = null,
    /**
     * Task 16: AABB statis bangunan dari map (AirportMap.getColliders()).
     * Opsional & nullable supaya constructor ini tetap kompatibel dengan
     * pemanggil lama; untuk map selain Pesawat Testing nilainya null sehingga
     * tidak ada perilaku collision bangunan sama sekali.
     */
    buildingColliders: ReadonlyArray<{ min: Vector3; max: Vector3 }> | null = null
  ) {
    this.scene = scene
    this.aircraftRoot = aircraftRoot
    this.mapType = mapType
    this.simpleMap = simpleMap
    this.spawnOverride = spawnOverride

    if (!this.aircraftRoot.rotationQuaternion) {
      this.aircraftRoot.rotationQuaternion = Quaternion.Identity()
    }

    // Cache ground contact geometry (once, at construction).
    //
    // 1) `groundOffsetY` (root → wheel drop) is measured with the root at y=0
    //    but its SPAWN attitude, because DemoScene may already have lifted the
    //    root so the wheels touch the ground — a naive
    //    getHierarchyBoundingVectors() there returns ~0 and buries the plane on
    //    landing.
    // 2) `contactPoints` is measured with the root at the ORIGIN and an IDENTITY
    //    rotation, i.e. in the aircraft's own model frame, so it can be
    //    re-projected through the live world matrix on every frame.
    const prevPosition = this.aircraftRoot.position.clone()
    const prevRotation = this.aircraftRoot.rotationQuaternion
      ? this.aircraftRoot.rotationQuaternion.clone()
      : null

    this.aircraftRoot.position.set(0, 0, 0)
    this.aircraftRoot.computeWorldMatrix(true)
    this.aircraftRoot.getDescendants(true).forEach((n) => n.computeWorldMatrix(true))
    const bounds = this.aircraftRoot.getHierarchyBoundingVectors()
    this.groundOffsetY = -bounds.min.y

    this.aircraftRoot.rotationQuaternion = Quaternion.Identity()
    this.buildContactPoints()
    this.packBuildingColliders(buildingColliders)
    this.aircraftRoot.rotationQuaternion = prevRotation ?? Quaternion.Identity()
    this.aircraftRoot.position.copyFrom(prevPosition)

    // Store spawn position and rotation from the map. When an explicit spawn
    // override is provided (Pesawat Testing runway), prefer it over the car
    // map's default so reset (R) returns to the real runway spawn point.
    const spawnRaw =
      this.spawnOverride ?? this.simpleMap?.getSpawnPoint() ?? { position: { x: 0, y: 0, z: 0 }, rotation: 0 }
    const hasPosition = 'position' in spawnRaw
    const sp = hasPosition ? spawnRaw.position : { x: (spawnRaw as any).x, y: 0, z: (spawnRaw as any).z }
    const sr = hasPosition ? spawnRaw.rotation : (spawnRaw as any).rotationY
    this.spawnPosition = new Vector3(
      sp.x ?? 0,
      this.getGroundHeight(sp.x ?? 0, sp.z ?? 0) + this.groundOffsetY,
      sp.z ?? 0
    )
    this.spawnRotation = Quaternion.FromEulerAngles(-Math.PI / 2, -Math.PI / 2, 0)
    if (sr) {
      this.spawnRotation = this.spawnRotation.multiply(Quaternion.FromEulerAngles(0, sr, 0))
    }

    // Initialize CarCameraManager with aircraft root and aircraft-specific camera config
    this.cameraManager = new CarCameraManager(scene, aircraftRoot, AIRCRAFT_CAMERA_CONFIG)

    // Resolve the real propeller node position (Camera 2 reference)
    this.propellerLocalOffset = this.findPropellerLocalOffset()

    this.setupInputs()
    this.findAnimations()

    // Start update loop
    const obs = this.scene.onBeforeRenderObservable.add(() => this.update())
    this.observers.push(obs)
  }

  private setupInputs(): void {
    const obs = this.scene.onKeyboardObservable.add((kbInfo) => {
      const isDown = kbInfo.type === KeyboardEventTypes.KEYDOWN
      const key = kbInfo.event.key.toLowerCase()

      // Engine toggle (K)
      if (kbInfo.type === KeyboardEventTypes.KEYDOWN && key === 'k') {
        this.engineRunning = !this.engineRunning
        useAircraftStore.getState().setEngineRunning(this.engineRunning)
        this.onEngineStateChangeCallback?.(this.engineRunning)

        if (this.engineRunning && this.propellerAnimGroup) {
          this.propellerAnimGroup.play(true)
        } else if (!this.engineRunning && this.propellerAnimGroup) {
          this.propellerAnimGroup.stop()
        }
      }

      // Camera toggle (V)
      if (kbInfo.type === KeyboardEventTypes.KEYDOWN && key === 'v') {
        this.cameraManager.toggleMode()
      }

      // Reset (R)
      if (kbInfo.type === KeyboardEventTypes.KEYDOWN && key === 'r') {
        this.resetAircraft()
      }

      switch (key) {
        // Throttle
        case 'shift': this.inputs.throttleUp = isDown; break
        case 'control': this.inputs.throttleDown = isDown; break

        // Flight controls — ArrowDown = pull nose up, ArrowUp = push nose down
        case 'arrowup': this.inputs.pitchDown = isDown; break
        case 'arrowdown': this.inputs.pitchUp = isDown; break
        case 'arrowleft': this.inputs.rollLeft = isDown; break
        case 'arrowright': this.inputs.rollRight = isDown; break

        // Yaw (rudder)
        case 'q': this.inputs.yawLeft = isDown; break
        case 'e': this.inputs.yawRight = isDown; break

        // Brake
        case ' ': this.inputs.brake = isDown; break
      }
    })
    this.observers.push(obs)
  }

  private findAnimations(): void {
    const propellerAnim = this.scene.animationGroups.find(ag => ag.name === 'Propeller_Spin')
    if (propellerAnim) {
      this.propellerAnimGroup = propellerAnim
      this.propellerAnimGroup.stop()
    }
  }

  /**
   * Locate the real "propeller" node position relative to the aircraft root.
   * Used only as a POSITION reference for Camera 2 — never as a look target,
   * so the spinning blades cannot make the camera unstable.
   */
  private findPropellerLocalOffset(): Vector3 {
    const propNode = this.scene.getTransformNodeByName('propeller')

    if (!propNode) {
      console.warn('[AircraftSystem] propeller node not found; use audited fallback (4.56, 0, 1.38)')
      return new Vector3(4.56, 0, 1.38)
    }

    const rootWorld = this.aircraftRoot.computeWorldMatrix(true).invert()
    const local = Vector3.TransformCoordinates(propNode.getAbsolutePosition(), rootWorld)
    console.log('[AircraftSystem] propeller local offset (Camera 2 ref):', local.asArray().map(v => +v.toFixed(3)))
    return local
  }

  /**
   * Camera 2 Pesawat Testing = EXTERNAL PROPELLER CHASE CAMERA.
   * Kamera diletakkan DI BELAKANG propeller (mundur sejauh config forwardOffset)
   * + LEBIH TINGGI di atas pusat propeller (config heightOffset), menghadap ke depan
   * dengan look-ahead target. Posisi & orientasi di-hitung dari
   * aircraftRoot world matrix sehingga mengikuti heading, pitch, roll, dan
   * posisi pesawat. Bukan cockpit, bukan dari bawah pesawat.
   *
   * Tidak menambahkan physics camera; menggunakan UniversalCamera first-person
   * milik CarCameraManager dan men-set position + rotationQuaternion langsung.
   */
  private updatePropellerCamera(): void {
    // Camera 2 modes: the aircraft's first-person slot is a UniversalCamera managed
    // by CarCameraManager (used here as the external propeller chase camera).
    const cam = this.cameraManager.getActiveCamera() as UniversalCamera | null
    if (!cam) return

    const fpConfig = AIRCRAFT_CAMERA_CONFIG.firstPerson
    const backGap = fpConfig.forwardOffset
    const upGap = fpConfig.heightOffset
    const lookAheadDist = fpConfig.lookAheadDistance
    const targetHeightOff = fpConfig.targetHeightOffset ?? 1.5

    const worldMatrix = this.aircraftRoot.computeWorldMatrix(true)

    // Position: aircraft root + (propeller offset, then slightly back and above)
    const camLocal = this.propellerLocalOffset.add(new Vector3(-backGap, 0, upGap))
    const camWorld = Vector3.TransformCoordinates(camLocal, worldMatrix)

    // Look-ahead target: aircraft world position + forward * lookAheadDistance + up * targetHeightOffset
    const aircraftWorldPos = this.aircraftRoot.getAbsolutePosition()
    const forwardWorld = Vector3.TransformNormal(this.LOCAL_FORWARD, worldMatrix).normalize()
    const upWorld = Vector3.TransformNormal(this.LOCAL_UP, worldMatrix).normalize()

    const lookTarget = aircraftWorldPos
      .add(forwardWorld.scale(lookAheadDist))
      .add(upWorld.scale(targetHeightOff))

    cam.position.copyFrom(camWorld)
    cam.setTarget(lookTarget)
  }

  /**
   * Build the aircraft's contact point cloud in the MODEL frame.
   *
   * The model frame (documented above) has "up" along local +Z, so the lowest
   * surface of the aircraft at any attitude is decided by, for every (X, Y)
   * column, the vertex with the smallest Z. We keep exactly that one vertex per
   * ~0.35 m column: a tight set (so a wings-level aircraft touches on its
   * wheels, not on an over-wide box that would make it float) yet still
   * attitude-aware (a steeply banked aircraft stops on the wingtip that really
   * is lowest instead of sinking the whole airframe into the ground).
   *
   * Runs once. All buffers are local; the result is a Float32Array so the
   * per-frame projection in getContactY() allocates nothing.
   */
  private buildContactPoints(): void {
    const children = this.aircraftRoot.getChildMeshes(false)
    if (children.length === 0) return

    this.aircraftRoot.computeWorldMatrix(true)
    // Force the whole airframe to be re-evaluated FIRST. Setting the root's
    // rotation only marks the root dirty, so the child world matrices would
    // otherwise still hold the previous attitude and the cloud would be baked
    // rotated into the wrong frame.
    for (const child of children) child.computeWorldMatrix(true)
    const rootInverse = this.aircraftRoot.getWorldMatrix().clone().invert()
    const airframe = this.aircraftRoot.getHierarchyBoundingVectors()
    const spanX = Math.max(airframe.max.x - airframe.min.x, 1e-3)
    const spanY = Math.max(airframe.max.y - airframe.min.y, 1e-3)

    const nx = Math.min(64, Math.max(8, Math.ceil(spanX / 0.35)))
    const ny = Math.min(64, Math.max(8, Math.ceil(spanY / 0.35)))
    const columnZ = new Float32Array(nx * ny).fill(Number.POSITIVE_INFINITY)
    const columnX = new Float32Array(nx * ny)
    const columnY = new Float32Array(nx * ny)

    const meshWorld = new Matrix()
    const toLocal = new Matrix()
    const vertex = new Vector3()
    const local = new Vector3()

    for (const mesh of children) {
      const data = mesh.getVerticesData('position')
      if (!data || data.length < 3) continue
      meshWorld.copyFrom(mesh.getWorldMatrix())
      meshWorld.multiplyToRef(rootInverse, toLocal)

      for (let i = 0; i < data.length; i += 3) {
        vertex.set(data[i], data[i + 1], data[i + 2])
        Vector3.TransformCoordinatesToRef(vertex, toLocal, local)
        const cx = Math.min(nx - 1, Math.max(0, Math.floor(((local.x - airframe.min.x) / spanX) * nx)))
        const cy = Math.min(ny - 1, Math.max(0, Math.floor(((local.y - airframe.min.y) / spanY) * ny)))
        const cell = cy * nx + cx
        if (local.z < columnZ[cell]) {
          columnZ[cell] = local.z
          columnX[cell] = local.x
          columnY[cell] = local.y
        }
      }
    }

    let count = 0
    for (let i = 0; i < columnZ.length; i++) {
      if (columnZ[i] !== Number.POSITIVE_INFINITY) count++
    }
    if (count === 0) return

    const points = new Float32Array(count * 3)
    let w = 0
    for (let i = 0; i < columnZ.length; i++) {
      if (columnZ[i] === Number.POSITIVE_INFINITY) continue
      points[w++] = columnX[i]
      points[w++] = columnY[i]
      points[w++] = columnZ[i]
    }
    this.contactPoints = points

    // AABB point-cloud di model frame. Dipakai broad phase collision bangunan
    // dengan cara O(1) (proyeksi AABB model lewat elemen matriks rotasi), sehingga
    // 562 titik tidak perlu ditransformasi hanya untuk menolak aircraft yang
    // jelas-jelas jauh dari bangunan.
    let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY, minZ = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY, maxZ = Number.NEGATIVE_INFINITY
    for (let i = 0; i < points.length; i += 3) {
      const px = points[i], py = points[i + 1], pz = points[i + 2]
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
      if (pz < minZ) minZ = pz
      if (pz > maxZ) maxZ = pz
    }
    this.cloudMinX = minX; this.cloudMaxX = maxX
    this.cloudMinY = minY; this.cloudMaxY = maxY
    this.cloudMinZ = minZ; this.cloudMaxZ = maxZ
  }

  /**
   * Task 16: bungkus AABB bangunan dari map menjadi satu Float32Array datar
   * [minX, minY, minZ, maxX, maxY, maxZ] x N. Dilakukan SEKALI di constructor.
   *
   * Kolom dengan volume nol dilewati: tidak bisa ditabrak dengan benar dan hanya
   * menambah beban loop. Bentuk tiap box mengikuti AABB asli map — tidak ada box
   * raksasa artificial yang memblokir area kosong. min > max dinormalkan.
   */
  private packBuildingColliders(colliders: ReadonlyArray<{ min: Vector3; max: Vector3 }> | null): void {
    if (!colliders || colliders.length === 0) return
    const boxes = new Float32Array(colliders.length * 6)
    let n = 0
    for (const c of colliders) {
      const mn = c.min
      const mx = c.max
      if (!mn || !mx) continue
      const minX = Math.min(mn.x, mx.x), maxX = Math.max(mn.x, mx.x)
      const minY = Math.min(mn.y, mx.y), maxY = Math.max(mn.y, mx.y)
      const minZ = Math.min(mn.z, mx.z), maxZ = Math.max(mn.z, mx.z)
      // Box yang tidak punya volume (tipis satu sisi) dilewati: tidak bisa
      // ditabrak dengan benar dan hanya menambah beban loop.
      if (maxX - minX <= 0 || maxY - minY <= 0 || maxZ - minZ <= 0) continue
      const o = n * 6
      boxes[o] = minX; boxes[o + 1] = minY; boxes[o + 2] = minZ
      boxes[o + 3] = maxX; boxes[o + 4] = maxY; boxes[o + 5] = maxZ
      n++
    }
    if (n === 0) return
    this.buildingBoxes = boxes
    this.buildingBoxCount = n
  }

  /**
   * World-space Y of the aircraft's LOWEST point under its CURRENT position and
   * attitude. This is the real contact point, so ground contact is a purely
   * geometric comparison (lowest point vs. surface height) that holds for every
   * surface and every attitude.
   *
   * The root world matrix is recomposed here (allocation-free, from the live
   * position/rotation) so the result always reflects the position and attitude
   * AFTER this frame's integration — using a matrix captured at the top of the
   * frame would compare the surface against a contact point the aircraft had
   * already left. The projection itself is a tight loop over the cached
   * Float32Array using the raw column-major matrix elements: no Vector3
   * allocation, no hierarchy walk, no raycast, no bounding box rebuild. Falls
   * back to the canonical level wheel drop if the model geometry is missing.
   */
  private getContactY(): number {
    const points = this.contactPoints
    const rotation = this.aircraftRoot.rotationQuaternion
    if (!points || points.length === 0 || !rotation) {
      return this.aircraftRoot.position.y - this.groundOffsetY
    }
    Matrix.ComposeToRef(UNIT_SCALE, rotation, this.aircraftRoot.position, this.contactMatrix)
    const m = this.contactMatrix.m
    let minY = Number.POSITIVE_INFINITY
    for (let i = 0; i < points.length; i += 3) {
      const wy = points[i] * m[1] + points[i + 1] * m[5] + points[i + 2] * m[9] + m[13]
      if (wy < minY) minY = wy
    }
    return minY
  }

  // ============================================
  // TASK 16 — COLLISION PESAWAT vs BANGUNAN (Pesawat Testing)
  // ============================================
  //
  // Bentuk/"ukuran" yang dipakai:
  //  - Pesawat  : AABB dunia yang dihitung dari AABB point-cloud model (dihitung
  //              sekali di buildContactPoints). Jadi tabrakan mengikuti ukuran &
  //              ORIENTASI pesawat sebenarnya, bukan titik pusat root, dan
  //              ikut berputar saat pesawat bank/miring.
  //  - Bangunan: AABB asli yang sudah dibangun AirportMap (rumah, ruko, terminal,
  //              hangar, menara + kabin ATC, shelter, gate, pos keamanan, pohon).
  //              Tidak ada satu box besar untuk seluruh map.
  //
  // Biaya per frame:
  //  - Collider dipaketkan SEKALI jadi Float32Array datar di constructor → tidak
  //    ada alokasi per frame, tidak ada pencarian hierarchy, tidak ada bounding
  //    box yang dihitung ulang.
  //  - Uji overlap = perbandingan 6 angka per box (49 box ≈ 300 operasi).
  //  - Jauh dari seluruh bangunan: tidak ada transformasi titik sama sekali.
  //
  // Resolusi memakai MINIMUM EXIT VECTOR (lihat pushOutOfBox) dengan pengaman
  // arah gerak + larangan mendorong ke bawah tanah. Pesawat didorong keluar
  // sebesar jarak yang benar-benar diperlukan — tidak dipindahkan ke posisi
  // lain, tidak ada lompatan, tidak ada sistem crash/damage global baru.
  // Berjalan untuk aircraft airborne maupun grounded.
  // Penting: setelah resolve, `clampToGround()` dipanggil ulang supaya collision
  // tanah tetap otoritatif untuk sumbu Y (tidak melayang, tidak tenggelam).

  /** AABB dunia konservatif dari AABB model frame, tanpa mentransformasi 562 titik. */
  private getCloudWorldAABB(
    out: Float32Array,
    offX: number, offY: number, offZ: number
  ): void {
    const rotation = this.aircraftRoot.rotationQuaternion
    if (!rotation) {
      const p = this.aircraftRoot.position
      out[0] = this.cloudMinX + p.x + offX; out[1] = this.cloudMinY + p.y + offY; out[2] = this.cloudMinZ + p.z + offZ
      out[3] = this.cloudMaxX + p.x + offX; out[4] = this.cloudMaxY + p.y + offY; out[5] = this.cloudMaxZ + p.z + offZ
      return
    }
    // Matriks disusun dari rotasi saja (translasi nol) supaya `offX/Y/Z` bisa
    // dipakai menggeser AABB untuk swept test. Posisi pesawat ditambahkan
    // eksplisit ke titik tengah hasil rotasi.
    Matrix.ComposeToRef(UNIT_SCALE, rotation, Vector3.ZeroReadOnly, this.contactMatrix)
    const m = this.contactMatrix.m
    const pos = this.aircraftRoot.position
    // AABB yang sudah diputar (konservatif): worldExtent_i = Σ |R_ij| · extent_j
    const cx = (this.cloudMinX + this.cloudMaxX) / 2
    const cy = (this.cloudMinY + this.cloudMaxY) / 2
    const cz = (this.cloudMinZ + this.cloudMaxZ) / 2
    const hx = (this.cloudMaxX - this.cloudMinX) / 2
    const hy = (this.cloudMaxY - this.cloudMinY) / 2
    const hz = (this.cloudMaxZ - this.cloudMinZ) / 2

    const wcx = cx * m[0] + cy * m[4] + cz * m[8] + pos.x + offX
    const wcy = cx * m[1] + cy * m[5] + cz * m[9] + pos.y + offY
    const wcz = cx * m[2] + cy * m[6] + cz * m[10] + pos.z + offZ
    const ex = Math.abs(m[0]) * hx + Math.abs(m[4]) * hy + Math.abs(m[8]) * hz
    const ey = Math.abs(m[1]) * hx + Math.abs(m[5]) * hy + Math.abs(m[9]) * hz
    const ez = Math.abs(m[2]) * hx + Math.abs(m[6]) * hy + Math.abs(m[10]) * hz
    out[0] = wcx - ex + offX; out[1] = wcy - ey + offY; out[2] = wcz - ez + offZ
    out[3] = wcx + ex + offX; out[4] = wcy + ey + offY; out[5] = wcz + ez + offZ
  }

  /** True bila AABB pesawat (6 angka) beririsan dengan salah satu box bangunan. */
  private anyBoxOverlap(aabb: Float32Array): boolean {
    const boxes = this.buildingBoxes
    const count = this.buildingBoxCount
    if (!boxes) return false
    for (let i = 0; i < count; i++) {
      const o = i * 6
      if (aabb[0] > boxes[o + 3] || aabb[3] < boxes[o]) continue
      if (aabb[1] > boxes[o + 4] || aabb[4] < boxes[o + 1]) continue
      if (aabb[2] > boxes[o + 5] || aabb[5] < boxes[o + 2]) continue
      return true
    }
    return false
  }

  /**
   * Tabrakan pesawat vs bangunan. `prevX/Y/Z` = posisi sebelum integrasi frame
   * ini (dipakai untuk anti-tunneling). Aman dipanggil setiap frame: biaya ~0
   * ketika pesawat jauh dari seluruh bangunan.
   *
   * Bentuk pesawat memakai AABB dunia dari point-cloud model (lihat
   * getCloudWorldAABB), jadi tabrakan mengikuti ukuran & orientasi pesawat
   * sebenarnya — bukan titik pusat root. Bentuk bangunan mengikuti AABB asli
   * AirportMap, jadi tidak ada box raksasa yang memblokir area kosong.
   */
  private resolveBuildingCollisions(prevX: number, prevY: number, prevZ: number): void {
    if (!this.buildingBoxes || this.buildingBoxCount === 0) return
    if (!this.contactPoints || this.contactPoints.length === 0) return

    const pos = this.aircraftRoot.position
    const dx = pos.x - prevX
    const dy = pos.y - prevY
    const dz = pos.z - prevZ

    for (let iter = 0; iter < this.BUILDING_MAX_ITER; iter++) {
      const aabb = this.scratchAabb
      this.getCloudWorldAABB(aabb, 0, 0, 0)
      const hit = this.anyBoxOverlap(aabb) ? 1 : 0
      if (!hit) {
        // Tidak ada tumpang tindih pada posisi akhir. Kalau frame ini panjang
        // (kecepatan tinggi / dt besar) mungkin pesawat sudah MELOMPAT melewati
        // bangunan tanpa sempat terdeteksi → cek jalur swept lalu kembalikan.
        const stepLen = Math.sqrt(dx * dx + dz * dz)
        if (stepLen > this.BUILDING_SWEEP_MIN_STEP && this.sweptHitsBuilding(dx, dy, dz)) {
          this.backOffAlongPath(prevX, prevY, prevZ, dx, dy, dz)
          this.onBuildingImpact()
        }
        return
      }
      if (!this.pushOutOfBox(aabb, dx, dy, dz)) return
      this.onBuildingImpact()
    }
  }

  /**
   * Dorong pesawat keluar dari box bangunan yang sedang ditabrakan.
   *
   * Memakai MINIMUM EXIT VECTOR dari AABB pesawat vs AABB bangunan: untuk
   * setiap face, jaraknya adalah jarak dari sisi TERDEKAT pesawat ke face itu
   * (`boxMax - aircraftMin` untuk keluar lewat +axis, `aircraftMax - boxMin`
   * untuk -axis) — BUKAN besar irisan, karena irisan understated untuk objek
   * tipis. Graduation dengan minimum-exit murni tidak bisa dipakai di sini:
   * roda pesawat duduk di y≈0 sementara box bangunan mulai juga di y=0, jadi
   * opsi "turun" selalu paling murah dan pesawat akan unterschentered ke tanah.
   *
   * Dua pengaman:
   *  1) Sumbu Y ke bawah DILARANG saat grounded (tidak bisa menembus tanah).
   *  2) Sumbu dominan dari gerak aircraft diberi bobot 1, sumbu lain diberi
   *     bobot BUILDING_AXIS_BIAS — jadi pesawat yang terbang ke timur menabrak
   *     sisi barat dan terdorong ke barat (menggeser Along dinding), bukan naik
   *     ke atap bangunan yang kalau tidak akan terlihat "lebih murah".
   */
  private pushOutOfBox(aabb: Float32Array, dx: number, dy: number, dz: number): boolean {
    const boxes = this.buildingBoxes!
    // Box pertama yang beririsan (AABB sangat kecil, loop pendek & deterministik).
    let o = -1
    for (let i = 0; i < this.buildingBoxCount; i++) {
      const k = i * 6
      if (aabb[0] > boxes[k + 3] || aabb[3] < boxes[k]) continue
      if (aabb[1] > boxes[k + 4] || aabb[4] < boxes[k + 1]) continue
      if (aabb[2] > boxes[k + 5] || aabb[5] < boxes[k + 2]) continue
      o = k
      break
    }
    if (o < 0) return false

    const bMinX = boxes[o], bMinY = boxes[o + 1], bMinZ = boxes[o + 2]
    const bMaxX = boxes[o + 3], bMaxY = boxes[o + 4], bMaxZ = boxes[o + 5]

    const cNegX = aabb[3] - bMinX   // keluar lewat -X
    const cPosX = bMaxX - aabb[0]   // keluar lewat +X
    const cNegY = aabb[4] - bMinY   // keluar lewat -Y
    const cPosY = bMaxY - aabb[1]   // keluar lewat +Y
    const cNegZ = aabb[5] - bMinZ   // keluar lewat -Z
    const cPosZ = bMaxZ - aabb[2]   // keluar lewat +Z

    const grounded = !this.isAirborne

    // Sumbu dominan gerak aircraft pada frame ini.
    const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz)
    let dominant = -1
    if (ax > 1e-6 && ax >= ay && ax >= az) dominant = 0
    else if (ay > 1e-6 && ay >= az) dominant = 1
    else if (az > 1e-6) dominant = 2

    let best = Number.POSITIVE_INFINITY
    let bestAxis = -1
    let bestSign = 0
    let bestCost = 0
    const consider = (axis: number, sign: number, cost: number) => {
      if (cost <= 0) return
      if (grounded && axis === 1 && sign < 0) return
      const w = (dominant >= 0 && axis === dominant) ? cost : cost * this.BUILDING_AXIS_BIAS
      if (w < best) { best = w; bestAxis = axis; bestSign = sign; bestCost = cost }
    }
    consider(0, -1, cNegX)
    consider(0, 1, cPosX)
    consider(1, -1, cNegY)
    consider(1, 1, cPosY)
    consider(2, -1, cNegZ)
    consider(2, 1, cPosZ)
    if (bestAxis < 0) return false

    const push = bestCost + this.BUILDING_SKIN
    const pos = this.aircraftRoot.position
    if (bestAxis === 0) {
      pos.x += bestSign * push
    } else if (bestAxis === 1) {
      pos.y += bestSign * push
      // Buang komponen vertikal yang mengarah ke dalam permukaan.
      if (bestSign > 0) this.velocityY = Math.max(0, this.velocityY)
      else this.velocityY = Math.min(0, this.velocityY)
    } else {
      pos.z += bestSign * push
    }
    return true
  }

  /**
   * True bila jalur frame ini melewati box bangunan (artinya pesawat sudah
   * melewati/menabrak bangunan dalam satu frame). Memakai AABB gabungan posisi
   * sebelum ∪ posisi sesudah, sehingga objek tepat di antara keduanya ikut
   * terdeteksi (tunneling).
   */
  private sweptHitsBuilding(dx: number, dy: number, dz: number): boolean {
    const aabb = this.scratchAabb
    const prev = this.scratchAabb2
    this.getCloudWorldAABB(aabb, 0, 0, 0)
    this.getCloudWorldAABB(prev, -dx, -dy, -dz)
    aabb[0] = Math.min(aabb[0], prev[0])
    aabb[1] = Math.min(aabb[1], prev[1])
    aabb[2] = Math.min(aabb[2], prev[2])
    aabb[3] = Math.max(aabb[3], prev[3])
    aabb[4] = Math.max(aabb[4], prev[4])
    aabb[5] = Math.max(aabb[5], prev[5])
    return this.anyBoxOverlap(aabb)
  }


  /**
   * Kembalikan posisi pesawat ke titik SEBELUM masuk bangunan dengan menelusuri
   * balik jalur frame ini (maks 24 sub-step, O(1) per sub-step, tanpa alokasi).
   * Dipakai hanya pada kasus tunneling (kecepatan tinggi / frame panjang).
   */
  private backOffAlongPath(prevX: number, prevY: number, prevZ: number, dx: number, dy: number, dz: number): void {
    const pos = this.aircraftRoot.position
    const aabb = this.scratchAabb
    const STEPS = 24
    for (let k = STEPS; k >= 0; k--) {
      const f = k / STEPS
      this.getCloudWorldAABB(aabb, -dx * f, -dy * f, -dz * f)
      if (!this.anyBoxOverlap(aabb)) {
        pos.x = prevX + dx * f
        pos.y = prevY + dy * f
        pos.z = prevZ + dz * f
        return
      }
    }
    // Tetap di dalam bahkan di posisi awal frame: berhenti saja di sana.
    pos.x = prevX
    pos.y = prevY
    pos.z = prevZ
  }

  /** Redam kecepatan horizontal memakai mekanisme `speed` yang sudah ada. */
  private onBuildingImpact(): void {
    this.speed *= this.BUILDING_SPEED_KEEP
  }

  /**
   * Re-level the attitude while on the ground, keeping the current heading.
   * Zeroing pitchRate/rollRate only stops the rotation RATE, so without this the
   * attitude frozen at touch-down (e.g. a dive) would keep pushing the nose or
   * a wingtip into the surface and the contact point would hold the aircraft
   * visibly above the ground. For a wings-level aircraft the target equals the
   * current attitude, so taxi / takeoff roll / runway landing are untouched.
   * This only rotates the aircraft where it already is — it never moves it to
   * another surface and never counts as a runway landing.
   */
  private alignToLevelAttitude(dt: number): void {
    const heading = this.getHeading()
    Quaternion.RotationAxisToRef(this.LOCAL_UP, heading, this.scratchQuatA)
    this.levelAttitude.multiplyToRef(this.scratchQuatA, this.scratchQuatB)
    Quaternion.SlerpToRef(
      this.aircraftRoot.rotationQuaternion!,
      this.scratchQuatB,
      Math.min(1, this.GROUND_ALIGN_RATE * dt),
      this.levelQuat
    )
    // `levelQuat` is dedicated storage for the aircraft's rotation (see its
    // declaration): it must not be one of the scratch quaternions, or the
    // scratch reuse above would overwrite the current rotation before slerp
    // read it.
    this.aircraftRoot.rotationQuaternion = this.levelQuat
  }

  /**
   * Lazily collect the airfield surfaces used for ground collision.
   *
   * AirportMap audit (Pesawat Testing): the green terrain is ONE flat mesh,
   * `airport_ground` (740 x 890 at y = -0.02), which spans the whole playable
   * area x -410..330 / z -460..430. There is no second grass mesh, no terrain
   * elevation, and the grass is purely visual geometry (no collider) — so it was
   * invisible to the aircraft. It IS included below and is also the fallback
   * height, because grass must stop the aircraft even though cars cannot drive
   * on it.
   *
   * Buildings, fences, shelters, trees, markings and props are deliberately
   * excluded: they are not ground, and their bounding boxes must never be
   * mistaken for a terrain surface. Each surface is stored as its world AABB XZ
   * footprint plus the TOP of its world AABB, which is the face the aircraft
   * actually rolls on (identical to the mesh origin for these zero-thickness
   * planes, and correct for a bed that has thickness).
   *
   * Called once (and retried if the map is not built yet); every later lookup
   * is a flat O(numbers) loop with no allocation.
   */
  private ensureGroundSurfaces(): void {
    if (this.groundSurfaces) return

    const isSurface = (name: string) =>
      name.startsWith('airport_ground') ||
      name.startsWith('runway') ||
      name.startsWith('apron') ||
      name.startsWith('airport_taxiway') ||
      name.startsWith('airport_access_road') ||
      name === 'road'

    const meshes = this.scene.meshes.filter((m) => {
      if (!isSurface(m.name)) return false
      // Painted markings (dashes, thresholds, edge lines) sit ON a surface;
      // they are not a surface themselves.
      if (/dash|_threshold|_edge/.test(m.name)) return false
      return true
    })
    // Map not built yet (or not an airfield): retry on the next lookup instead
    // of caching an empty list forever.
    if (meshes.length === 0) return

    const packed = new Float32Array(meshes.length * 5)
    let count = 0
    for (const m of meshes) {
      const box = m.getBoundingInfo().boundingBox
      const o = count * 5
      packed[o] = box.minimumWorld.x
      packed[o + 1] = box.maximumWorld.x
      packed[o + 2] = box.minimumWorld.z
      packed[o + 3] = box.maximumWorld.z
      packed[o + 4] = box.maximumWorld.y
      count++
    }
    this.groundSurfaceCount = count
    this.groundSurfaces = packed

    const grass = meshes.find((m) => m.name.startsWith('airport_ground'))
    this.terrainY = grass ? grass.getBoundingInfo().boundingBox.maximumWorld.y : 0
  }

  /**
   * Height of the real ground surface below a world-space (x, z): the highest
   * packed surface whose XZ footprint contains the point, else the green
   * terrain height. Uses world-space AABBs of the frozen static meshes, so it is
   * O(1)-ish per query and fully cached — no hierarchy search, no raycast, and
   * no bounding box re-computation per frame.
   */
  private getGroundHeight(x: number, z: number): number {
    this.ensureGroundSurfaces()
    const surfaces = this.groundSurfaces
    if (!surfaces) return this.terrainY

    let height = this.terrainY
    for (let i = 0; i < this.groundSurfaceCount; i++) {
      const o = i * 5
      if (x >= surfaces[o] && x <= surfaces[o + 1] &&
          z >= surfaces[o + 2] && z <= surfaces[o + 3]) {
        const y = surfaces[o + 4]
        if (y > height) height = y
      }
    }
    return height
  }

  private resetAircraft(): void {
    this.aircraftRoot.position.copyFrom(this.spawnPosition)
    this.aircraftRoot.rotationQuaternion = this.spawnRotation.clone()

    // Reset physics state
    this.throttle = 0
    this.speed = 0
    this.velocityY = 0
    this.isAirborne = false
    this.engineRunning = false
    this.pitchRate = 0
    this.rollRate = 0
    this.yawRate = 0
    this.lastContactY = Number.NEGATIVE_INFINITY

    // Reset inputs
    this.inputs = {
      pitchUp: false, pitchDown: false, rollLeft: false, rollRight: false,
      yawLeft: false, yawRight: false, throttleUp: false, throttleDown: false, brake: false,
    }

    // Reset store
    useAircraftStore.getState().setEngineRunning(false)
    this.onEngineStateChangeCallback?.(false)
    useAircraftStore.getState().setThrottle(0)
    useAircraftStore.getState().setSpeed(0)
    useAircraftStore.getState().setAltitude(0)
    useAircraftStore.getState().setPitch(0)
    useAircraftStore.getState().setRoll(0)
    useAircraftStore.getState().setYaw(0)
    useAircraftStore.getState().setIsAirborne(false)

    if (this.propellerAnimGroup) {
      this.propellerAnimGroup.stop()
    }

    // Reset camera to third person
    this.cameraManager.setMode('third-person')
  }

  public update(): void {
    const dt = this.scene.getEngine().getDeltaTime() / 1000
    if (dt <= 0 || dt > 0.1) return

    // === ENGINE & THROTTLE ===
    if (this.engineRunning) {
      if (this.inputs.throttleUp) this.throttle += 0.5 * dt
      if (this.inputs.throttleDown) this.throttle -= 0.5 * dt
      this.throttle = Math.max(0, Math.min(1, this.throttle))

      const targetSpeed = this.throttle * this.maxSpeed
      if (this.speed < targetSpeed) {
        this.speed += this.acceleration * this.throttle * dt
      } else {
        this.speed -= this.acceleration * 0.3 * dt
      }
    } else {
      this.throttle = 0
      this.speed -= this.acceleration * 0.2 * dt
    }

    if (this.inputs.brake) {
      this.speed -= this.acceleration * dt * 3
    }
    this.speed = Math.max(0, this.speed)

    // === STATE MACHINE ===
    // Posisi SEBELUM integrasi frame ini, dipakai resolveBuildingCollisions()
    // untuk swept guard (anti-tunneling).
    const prevX = this.aircraftRoot.position.x
    const prevY = this.aircraftRoot.position.y
    const prevZ = this.aircraftRoot.position.z

    if (this.isAirborne) {
      this.updateAirborne(dt)
    } else {
      this.updateGround(dt)
    }

    // === TASK 16: COLLISION BANGUNAN (Pesawat Testing) ===
    // Berjalan untuk aircraft airborne maupun grounded, dan DI SESUDAI state
    // machine supaya yang diuji adalah posisi akhir frame.
    this.resolveBuildingCollisions(prevX, prevY, prevZ)
    // Tanah tetap otoritatif untuk sumbu Y: terapkan ulang clamp agar pesawat
    // tidak melayang (terdorong ke atas) maupun tenggelam (terdorong ke bawah)
    // akibat collision bangunan.
    if (!this.isAirborne) {
      this.clampToGround()
    }

    // === CAMERA ===
    if (this.cameraManager.getMode() === 'first-person') {
      // Camera 2 Pesawat Testing = external propeller view (di belakang & di atas propeller)
      this.updatePropellerCamera()
    } else {
      this.cameraManager.update(this.getHeading())
    }

    // === STORE SYNC ===
    this.updateStore()
  }

  private updateAirborne(dt: number): void {
    const worldMatrix = this.aircraftRoot.computeWorldMatrix(true)
    const worldForward = Vector3.TransformNormal(this.LOCAL_FORWARD, worldMatrix).normalize()
    const worldRight = Vector3.TransformNormal(this.LOCAL_RIGHT, worldMatrix).normalize()

    // --- Pitch ---
    const pitchInput = (this.inputs.pitchUp ? 1 : 0) - (this.inputs.pitchDown ? 1 : 0)
    const pitchDamping = 5
    this.pitchRate += (pitchInput * 1.5 - this.pitchRate) * pitchDamping * dt

    // --- Roll ---
    // ArrowRight = bank right (right wing down). With forward = +Z at heading 0,
    // a positive rotation around the nose axis banks LEFT, so negate the input.
    const rollInput = (this.inputs.rollLeft ? 1 : 0) - (this.inputs.rollRight ? 1 : 0)
    const rollDamping = 5
    this.rollRate += (rollInput * 2.0 - this.rollRate) * rollDamping * dt

    // --- Yaw ---
    const yawInput = (this.inputs.yawRight ? 1 : 0) - (this.inputs.yawLeft ? 1 : 0)
    const yawDamping = 5
    this.yawRate += (yawInput * 1.0 - this.yawRate) * yawDamping * dt

    // --- Apply rotations (Yaw * Pitch * Roll in local space) ---
    const pitchQuat = Quaternion.RotationAxis(this.LOCAL_RIGHT, this.pitchRate * dt)
    const rollQuat = Quaternion.RotationAxis(this.LOCAL_FORWARD, this.rollRate * dt)
    const yawQuat = Quaternion.RotationAxis(this.LOCAL_UP, this.yawRate * dt)

    let rot = this.aircraftRoot.rotationQuaternion!
    rot = rot.multiply(yawQuat).multiply(pitchQuat).multiply(rollQuat)
    this.aircraftRoot.rotationQuaternion = rot

    // --- Move along heading direction ---
    const velocity = worldForward.scale(this.speed * dt)
    this.aircraftRoot.position.addInPlace(velocity)

    // --- Lift vs Gravity ---
    const liftFactor = Math.min(1.2, this.speed / this.TAKEOFF_SPEED)
    const liftForce = this.gravity * liftFactor
    const netVertical = liftForce - this.gravity
    this.velocityY += netVertical * dt
    this.velocityY *= 0.95
    this.aircraftRoot.position.y += this.velocityY * dt

    // --- Speed from climbing/descending ---
    if (worldForward.y > 0.01) {
      this.speed -= this.gravity * worldForward.y * dt * 0.5
    } else if (worldForward.y < -0.01) {
      this.speed += this.gravity * Math.abs(worldForward.y) * dt * 0.3
    }

    // Air drag
    this.speed -= this.AIR_DRAG * dt
    this.speed = Math.max(0, this.speed)

    // --- Stall: if speed too low, lose altitude ---
    if (this.speed < this.STALL_SPEED) {
      this.velocityY -= (this.STALL_SPEED - this.speed) * 0.5 * dt
    }

    // --- Ground contact (runway, apron, taxiway, roads AND green terrain) ---
    // This is a PURELY GEOMETRIC test and must never be gated on velocityY: a
    // plane can descend purely by moving along a nose-down forward vector while
    // the lift term (which saturates above TAKEOFF_SPEED) still keeps velocityY
    // POSITIVE. The old `velocityY <= 0` guard then never fired, so the whole
    // touch-down block was skipped and the aircraft sank straight through the
    // terrain and kept going. Comparing the aircraft's real lowest point against
    // the real surface height below it cannot be fooled like that.
    const groundY = this.getGroundHeight(
      this.aircraftRoot.position.x,
      this.aircraftRoot.position.z
    )
    const contactY = this.getContactY()
    // The contact point must also be MOVING ONTO the surface. Without this the
    // take-off frame itself would read as contact: on take-off the wheels are
    // still at ground level (corrected to the surface, i.e. inside the tolerance)
    // while the aircraft is already climbing, so a pure "at or below" test would
    // cancel the lift-off on the very next frame. The test is on the real
    // contact-point motion, not on velocityY, so a nose-down high-speed descent
    // (where velocityY stays positive but the contact point IS falling) still
    // registers.
    const isContact = contactY <= this.lastContactY
    const penetration = groundY + this.GROUND_CONTACT_TOLERANCE - contactY
    if (penetration > 0 && isContact) {
      // Correct ONLY the actual penetration, so the aircraft ends up exactly on
      // the surface: never snapped to a fixed height, never launched upwards,
      // and never moved to a different surface.
      this.aircraftRoot.position.y += penetration

      // Vertical velocity is consumed by the contact — gravity must not keep
      // pulling the aircraft into the ground. Horizontal momentum is left
      // untouched, so the aircraft rolls/taxis out naturally.
      this.velocityY = 0
      this.isAirborne = false
      this.pitchRate = 0
      this.rollRate = 0

      // Hard landing speed penalty
      if (this.speed > 15) {
        this.speed *= 0.7
      }

      useAircraftStore.getState().setIsAirborne(false)

      // Contact point after the correction, so the next frame compares against
      // the real (now on-surface) height instead of the pre-correction one.
      this.lastContactY = groundY + this.GROUND_CONTACT_TOLERANCE
      return
    }
    this.lastContactY = contactY
  }

  private updateGround(dt: number): void {
    // Re-level FIRST so the movement direction and the clamp below both use the
    // settled attitude. A wings-level aircraft is left completely untouched.
    this.alignToLevelAttitude(dt)

    const worldMatrix = this.aircraftRoot.computeWorldMatrix(true)
    const worldForward = Vector3.TransformNormal(this.LOCAL_FORWARD, worldMatrix).normalize()

    // --- Takeoff check: speed sufficient + nose up input → airborne ---
    if (this.speed >= this.TAKEOFF_SPEED && this.inputs.pitchUp) {
      this.isAirborne = true
      this.velocityY = 2.0
      useAircraftStore.getState().setIsAirborne(true)
      return
    }

    // --- Ground steering (yaw only) ---
    const yawInput = (this.inputs.yawRight ? 1 : 0) - (this.inputs.yawLeft ? 1 : 0)
    // Arrow Left/Right also steer on ground
    const groundSteer = (this.inputs.rollRight ? 1 : 0) - (this.inputs.rollLeft ? 1 : 0)
    const effectiveYaw = yawInput + groundSteer

    const steerDamping = 5
    this.yawRate += (effectiveYaw * 1.5 - this.yawRate) * steerDamping * dt
    const yawQuat = Quaternion.RotationAxis(this.LOCAL_UP, this.yawRate * dt)

    let rot = this.aircraftRoot.rotationQuaternion!
    rot = rot.multiply(yawQuat)
    this.aircraftRoot.rotationQuaternion = rot

    // Keep wings level on ground
    this.pitchRate = 0
    this.rollRate = 0
    this.velocityY = 0

    // --- Forward movement ---
    const velocity = worldForward.scale(this.speed * dt)
    this.aircraftRoot.position.addInPlace(velocity)

    // --- Ground friction (rolling resistance) ---
    if (!this.engineRunning || this.throttle < 0.05) {
      this.speed -= this.GROUND_FRICTION * dt
    }
    this.speed = Math.max(0, this.speed)

    // --- Ground clamping ---
    // Keep the aircraft's real contact point (lowest point of the airframe, not
    // a fixed wheel offset) ON the surface below it, so taxi, roll-out, runway
    // landing and landing on the green terrain all stay ON the ground. At a
    // level attitude this reduces exactly to the previous
    // `groundY + groundOffsetY`, so Task 13's runway behaviour is unchanged.
    this.clampToGround()
  }

  /**
   * Menempelkan contact point pesawat ke permukaan di bawahnya. Dipisah dari
   * updateGround supaya bisa dipanggil ulang setelah collision bangunan
   * (Task 16) — supaya tanah tetap otoritatif untuk sumbu Y dan pesawat tidak
   * pernah melayang setelah terdorong ke atas atau tenggelam setelah terdorong
   * ke bawah. Ground collision & landing yang ada tetap utuh.
   */
  private clampToGround(): void {
    const groundY = this.getGroundHeight(
      this.aircraftRoot.position.x,
      this.aircraftRoot.position.z
    )
    this.aircraftRoot.position.y = groundY + (this.aircraftRoot.position.y - this.getContactY())
    // The clamp above puts the contact point exactly on the surface.
    this.lastContactY = groundY
  }

  private updateStore(): void {
    const state = useAircraftStore.getState()

    state.setThrottle(this.throttle)
    state.setSpeed(this.speed * 3.6)

    const worldMatrix = this.aircraftRoot.computeWorldMatrix(true)

    // Altitude above the actual surface under the aircraft (AGL), measured from
    // the aircraft's real contact point so it reads 0 on the ground everywhere.
    const groundY = this.getGroundHeight(
      this.aircraftRoot.position.x,
      this.aircraftRoot.position.z
    )
    const altitudeAgl = this.getContactY() - groundY
    state.setAltitude(Math.max(0, altitudeAgl))

    // Extract pitch/roll/yaw from rotation quaternion
    const worldForward = Vector3.TransformNormal(this.LOCAL_FORWARD, worldMatrix).normalize()
    const worldRight = Vector3.TransformNormal(this.LOCAL_RIGHT, worldMatrix).normalize()

    const pitchRad = Math.asin(Math.max(-1, Math.min(1, worldForward.y)))
    const pitchDeg = pitchRad * (180 / Math.PI)

    const rollRad = Math.asin(Math.max(-1, Math.min(1, worldRight.y)))
    const rollDeg = rollRad * (180 / Math.PI)

    const yawRad = Math.atan2(worldForward.x, worldForward.z)
    const yawDeg = yawRad * (180 / Math.PI)

    state.setPitch(pitchDeg)
    state.setRoll(rollDeg)
    state.setYaw(yawDeg)
    state.setIsAirborne(this.isAirborne)

    const camMode = this.cameraManager.getMode()
    const mappedMode = camMode === 'first-person' ? 'cockpit' : 'chase'
    state.setCameraMode(mappedMode)
  }

  public setupCameras(canvas: HTMLCanvasElement): void {
    this.cameraManager.setup(canvas)
  }

  public onCameraModeChanged(callback: (mode: CameraMode) => void): void {
    this.cameraManager.onModeChanged(callback)
  }

  public onEngineStateChanged(callback: (running: boolean) => void): void {
    this.onEngineStateChangeCallback = callback
  }

  private onEngineStateChangeCallback: ((running: boolean) => void) | null = null

  public getActiveCamera(): Camera | null {
    return this.cameraManager.getActiveCamera()
  }

  public dispose(): void {
    this.observers.forEach(obs => {
      this.scene.onBeforeRenderObservable.remove(obs)
      this.scene.onKeyboardObservable.remove(obs)
    })
    this.observers = []

    this.cameraManager.dispose()
  }

  // Public getters for DemoScene
  public getSpeedKmh(): number { return this.speed * 3.6 }
  public getPosition(): { x: number, y: number, z: number } {
    return { x: this.aircraftRoot.position.x, y: this.aircraftRoot.position.y, z: this.aircraftRoot.position.z }
  }
  public getHeading(): number {
    const worldMatrix = this.aircraftRoot.computeWorldMatrix(true)
    const worldForward = Vector3.TransformNormal(this.LOCAL_FORWARD, worldMatrix).normalize()
    return Math.atan2(worldForward.x, worldForward.z)
  }
  public getCameraMode(): string { return this.cameraManager.getMode() }
  public isEngineRunning(): boolean { return this.engineRunning }
  public getThrottle(): number { return this.throttle }

  // Camera mode controls (exposed for UI)
  public toggleCamera(): void { this.cameraManager.toggleMode() }
  public setCameraMode(mode: CameraMode): void { this.cameraManager.setMode(mode) }
}
