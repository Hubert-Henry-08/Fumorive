/**
 * ForkSystem
 * ==========
 * Mengontrol mekanisme depan forklift: LIFT (T/G) & TILT (Y/H).
 * HANYA aktif untuk map forklift-testing.
 *
 * ═══ AUDIT MODEL (forkliftbaru.glb — hierarchy FLAT, 28 node) ═══
 * Semua node adalah child LANGSUNG dari root `CTRL_FORKLIFT` (y=0 = ground;
 * roda Drive bottom ≈0.02, Steer bottom ≈0.15):
 *
 *   Carriage       (1.64, 3.30, 0)        CarriageBar  (1.78, 3.69, 0)
 *   CarriageRoller_0.62 / CarriageRoller_-0.62  (1.63, 3.10, ±0.62)
 *   Fork_0.48      (2.48, 2.53, -0.48)  Fork_-0.48  (2.48, 2.53, +0.48)
 *     blade bentang X 1.655→3.305 (1.65 m), tebal 0.16, top = 2.61 (anear)
 *   ForkTip_0.48/-0.48  (3.23, 2.55, ±0.48)    ForkHeel_0.48/-0.48 (1.78, 2.83, ±0.48)
 *   ForkliftBody_MERGED  (-0.75, 4.08, 0.58)   y 0.51→4.02
 *   DriveWheel_L/R_PIVOT (0.65, 0.62, ±0.90) → L / _Cap / _Hub
 *   SteerWheel_L/R_STEER_PIVOT (-1.15, 0.64, ±0.84) → roda belakang
 * TIDAK ADA node MastInner/MastOuter/MastTop — lift = gerakkan assembly
 * Carriage+Fork (rail tak terlihat di model), tilt = Carriage+Fork.
 *
 * Posisi rest: seluruh unit garpu digeser turun agar blade top 1.0 → 0.18
 * (sejajar roda depan ≈0.02, tidak menembus tanah; slot pallet deck bottom
 * = 0.19 → fork top 0.18 pas masuk slot).
 *
 * ═══ RUNTIME HIERARCHY (dibangun ulang, GLB tidak disentuh) ═══
 *
 *   rootMesh  (physics; rot.y = heading - π/2)
 *   └── forkliftLiftPivot (TransformNode, anak root)
 *       │   LIFT (T/G) = liftPivot.position.y
 *       └── forkliftTiltPivot (TransformNode, anak liftPivot)
 *           │   TILT (Y/H) = tiltPivot.rotation.z  (pivot di titik Carriage)
 *           └── Carriage, CarriageBar, CarriageRoller_±0.62,
 *               Fork_±0.48, ForkTip_±0.48, ForkHeel_±0.48
 *
 *   RODA / BODY TIDAK PERNAH menjadi child Lift/Tilt.
 *
 * ═══ FIX CATATAN ═══
 * - Re-parent memakai REBAKE EKSPLISIT (Matrix.invert().multiply().decompose),
 *   bukan Node.setParent() (stale world-matrix saat init → assembly ter-bake
 *   salah & tampak terpisah).
 * - Pola nama node garpu ANCHORED presisi (/^(Fork_|ForkTip_|ForkHeel_|Carriage)/),
 *   sehingga node pivot steering 'SteerWheel_L/R_STEER_PIVOT' TIDAK pernah
 *   ikut (pola /fork/i lama membuat roda belakang ikut terangkat saat T/G/Y/H).
 *
 * ═══ ORIENTASI / AXIS TILT ═══
 * Babylon = right-handed, +X model = depan/fork, +Y = atas.
 * Rotasi pivot.rotation.z (sumbu kiri-kanan):
 *   rotation.z NEGATIF → ujung blade TURUN  (TILT MAJU / Y)  → minTilt
 *   rotation.z POSITIF → ujung blade NAIK   (TILT MUNDUR / H) → maxTilt
 * (sudut kecil: blade 1.65 m, tilt maju maks -0.08 rad → tip turun ≈0.13 m,
 * masih di atas tanah saat fork rest 0.18).
 *
 * SCOPE: hanya forklift-testing. Tanpa mengubah CarController/CarPhysics/
 * CarCameraManager/map lain. Prinsip: ADD, DON'T BREAK.
 */

import {
  Scene,
  Node,
  Vector3,
  Matrix,
  Quaternion,
  TransformNode,
  AbstractMesh,
  Observer,
  KeyboardInfo,
  KeyboardEventTypes,
} from '@babylonjs/core'

// ============================================
// CONFIG
// ============================================

export interface ForkSystemConfig {
  /**
   * Tinggi permukaan angkat garpu (TOP blade) saat REST / spawn (meter).
   * Kalibrasi: deck pallet bottom ≈ 0.19 → fork top 0.18 (blade bottom 0.02,
   * hampir sejajar roda depan y=0.02, tidak menembus tanah).
   */
  restForkSurfaceY: number
  /** Tinggi permukaan angkat garpu MAKSIMUM saat fork terangkat penuh (meter). */
  maxForkSurfaceY: number
  /** Ketebalan half sesungguhnya blade (untuk komputasi top blade dari node). */
  forkBladeHalfThickness: number
  /**
   * Tinggi slot pallet (de + ruang kosong di bawah deck tempat fork masuk).
   * Pallet root ditempatkan sehingga DECK BOTTOM = (bladeTop - legHeight + legHeight)
   * tepat menyentuh top blade → pallet "duduk" di atas tine.
   */
  palletSlotHeight: number
  /** Kecepatan naik/turun (meter/detik). */
  liftSpeed: number
  /** Sudut tilt minimum (radian, negatif = maju / ujung turun). */
  minTilt: number
  /** Sudut tilt maximum (radian, positif = mundur / ujung naik). */
  maxTilt: number
  /** Kecepatan tilt (radian/detik). */
  tiltSpeed: number
}

/**
 * Kalibrasi dari dimensi AABB aktual forkliftbaru.glb:
 * - blade top model = 2.61 → rest = 0.18 (Δ_rest ≈ -2.43, dihitung runtime).
 * - max = 2.50 → lift 0 → 2.32 m (carriage max y≈3.19, di bawah body top 4.02).
 * - restOffset = restForkSurfaceY - bladeTopRef.
 */
export const DEFAULT_FORK_CONFIG: ForkSystemConfig = {
  restForkSurfaceY: 0.18,
  maxForkSurfaceY: 2.5,
  forkBladeHalfThickness: 0.08,
  palletSlotHeight: 0.19,
  liftSpeed: 0.6,
  minTilt: -0.08,  // ~-4.6° maju (ujung blade turun, aman saat rest di 0.18)
  maxTilt: 0.12,   // ~+6.9° mundur (ujung blade naik)
  tiltSpeed: 0.4,
}

// ============================================
// INTERNAL TYPES
// ============================================

interface ReparentedNode {
  node: TransformNode | AbstractMesh
  originalParent: Node | null
}

// ============================================
// FORK SYSTEM
// ============================================

export class ForkSystem {
  private scene: Scene
  private config: ForkSystemConfig

  /** Node assembly CARRIAGE/FORK (child TiltPivot). */
  private forkNodes: Array<TransformNode | AbstractMesh> = []
  /** Node rail MastInner (child LiftPivot). */
  private innerRails: Array<TransformNode | AbstractMesh> = []
  private reparented: ReparentedNode[] = []
  private allNodesDumped = false

  private liftPivot: TransformNode | null = null
  private liftBaseY = 0
  private tiltPivot: TransformNode | null = null
  private restOffset = 0
  private maxLiftHeight = 2.0
  private attachLocalPosition = Vector3.Zero()
  /** TOP blade di frame TiltPivot (basis tinggi muatan saat diangkat). */
  private attachBladeTopLocal = -0.6
  /** Sumbu X anchor lift di frame root — diturunkan dari posisi carriage model. */
  private anchorX = 1.8

  // Current state (0 = rest / level slot)
  private _currentHeight = 0
  private _currentTilt = 0
  private _targetHeight = 0
  private _targetTilt = 0

  // Input state
  private liftUp = false
  private liftDown = false
  private tiltForward = false
  private tiltBackward = false

  private keyboardObserver: Observer<KeyboardInfo> | null = null
  private isDisposed = false

  constructor(scene: Scene, config?: Partial<ForkSystemConfig>) {
    this.scene = scene
    this.config = { ...DEFAULT_FORK_CONFIG, ...config }
    this.maxLiftHeight = this.config.maxForkSurfaceY - this.config.restForkSurfaceY
  }

  // ============================================
  // INIT
  // ============================================

  init(rootMesh: AbstractMesh): void {
    this.dumpNodeHierarchy(rootMesh)
    this.discoverLiftNodes(rootMesh)
    this.setupHierarchy(rootMesh)
    this.registerKeyboard()

    console.log(
      `[ForkSystem] Initialized — ${this.innerRails.length} MastInner + ${this.forkNodes.length} carriage/fork nodes moved, ` +
        `rest fork top=${this.config.restForkSurfaceY.toFixed(3)}, max=${this.config.maxForkSurfaceY.toFixed(3)}, ` +
        `maxLift=${this.maxLiftHeight.toFixed(2)}m, tilt [${this.config.minTilt.toFixed(3)}..${this.config.maxTilt.toFixed(3)}]`
    )
    this.logWheelGroundCheck(rootMesh)
  }

  private dumpNodeHierarchy(root: AbstractMesh): void {
    if (this.allNodesDumped) return
    this.allNodesDumped = true

    const lines: string[] = ['[ForkSystem] ═══ FORKLIFT MODEL NODE HIERARCHY ═══']
    const dump = (node: TransformNode | AbstractMesh, depth: number) => {
      const indent = '  '.repeat(depth)
      const pos = node.position
      const type = node instanceof AbstractMesh ? 'Mesh' : 'Transform'
      lines.push(`${indent}${type}: ${node.name}  pos(${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`)
      const children = node.getChildren(undefined, false)
      for (const child of children) {
        if (child instanceof TransformNode || child instanceof AbstractMesh) {
          dump(child, depth + 1)
        }
      }
    }
    dump(root, 0)
    lines.push('[ForkSystem] ═══ END HIERARCHY ═══')
    console.log(lines.join('\n'))
  }

  /**
   * Kelompokkan node:
   *  - forkNodes   : CARRIAGE + FORK assembly → child TiltPivot.
   *  - innerRails  : MastInner_± → child LiftPivot.
   * Pola ANCHORED presisi (bukan /fork/i) supaya 'forkliftSteerPivotL/R'
   * (pivot steering, child root) TIDAK ikut.
   */
  private discoverLiftNodes(root: AbstractMesh): void {
    const carriagePattern = /^(Fork_|ForkTip_|ForkHeel_|Carriage)/i
    const innerPattern = /^MastInner/i

    const allMeshes = root.getChildMeshes(false) as Array<AbstractMesh>
    const allTransforms = root.getChildTransformNodes(false) as Array<TransformNode | AbstractMesh>

    const candidates: Array<TransformNode | AbstractMesh> = []
    const seen = new Set<Object>()
    for (const node of allMeshes) {
      if (!seen.has(node)) { seen.add(node); candidates.push(node) }
    }
    for (const node of allTransforms) {
      if (!seen.has(node)) { seen.add(node); candidates.push(node) }
    }

    this.forkNodes = []
    this.innerRails = []

    for (const node of candidates) {
      const name = node.name
      if (innerPattern.test(name)) this.innerRails.push(node)
      else if (carriagePattern.test(name)) this.forkNodes.push(node)
    }

    this.forkNodes.sort((a, b) => (a.name < b.name ? -1 : 1))

    if (this.forkNodes.length === 0) {
      console.warn('[ForkSystem] No fork/carriage nodes found. Fork lift/tilt will not work. Check hierarchy dump.')
    }
    if (this.innerRails.length === 0) {
      console.warn('[ForkSystem] No MastInner nodes found. Inner mast will stay static.')
    }
  }

  /**
   * Bangun runtime hierarchy 2 tingkat dengan REBAKE eksplisit (world-preserved):
   *   root → forkliftLiftPivot → [MastInner] + forkliftTiltPivot → [Carriage/Fork]
   */
  private setupHierarchy(root: AbstractMesh): void {
    // ---- 0) Resolusi node Carriage (titik pivot tilt & anchor lift) ----
    const carriage =
      this.forkNodes.find((n) => n.name === 'Carriage' && !(n instanceof AbstractMesh)) ??
      this.forkNodes.find((n) => n.name === 'Carriage') ??
      null

    // Posisi world Carriage saat bake (sebelum rest remount). Dipakai untuk
    // anchor lift DI FRAME ROOT dan posisi TiltPivot DI FRAME LiftPivot.
    const carriageWorld = carriage ? carriage.getAbsolutePosition() : new Vector3(1.64, 3.3, 0)
    // Anchor X = posisi world Carriage (bukan hardcode). Model baru:
    // carriage di x=1.64 → lift pivot menggantung di bawah kolom carriage.
    this.anchorX = carriage ? carriage.getAbsolutePosition().x : 1.8

    // ---- 1) LiftPivot (di dasar area mast; anchor x = carriage) ----
    const anchorX = this.anchorX
    this.liftPivot = new TransformNode('forkliftLiftPivot', this.scene)
    this.liftPivot.parent = root
    this.liftPivot.rotationQuaternion = null
    this.liftPivot.rotation = Vector3.Zero()
    this.liftPivot.position = new Vector3(anchorX, 0, 0)
    this.liftBaseY = 0
    root.computeWorldMatrix(true)
    this.liftPivot.computeWorldMatrix(true)

    // Rebake MastInner (top-level) ke LiftPivot. (Model forkliftbaru.glb tidak
    // memiliki node MastInner → list kosong, lift hanya menggerakkan carriage.)
    const innerSet = new Set<Object>(this.innerRails)
    const innerTopLevel = this.innerRails.filter((n) => {
      const p = n.parent
      return !(p && innerSet.has(p))
    })
    for (const node of innerTopLevel) {
      this.reparented.push({ node, originalParent: node.parent })
      this.remountNode(node, this.liftPivot)
    }

    // ---- 2) TiltPivot (di titik Carriage, dalam frame LiftPivot) ----
    const liftLocal = new Vector3(
      carriageWorld.x - anchorX,
      carriageWorld.y - this.liftBaseY,
      carriageWorld.z
    )

    this.tiltPivot = new TransformNode('forkliftTiltPivot', this.scene)
    this.tiltPivot.parent = this.liftPivot
    this.tiltPivot.rotationQuaternion = null
    this.tiltPivot.rotation = Vector3.Zero()
    this.tiltPivot.position = liftLocal.clone()
    this.tiltPivot.computeWorldMatrix(true)

    // Rebake CARRIAGE + FORK (top-level) ke TiltPivot.
    const forkSet = new Set<Object>(this.forkNodes)
    const forkTopLevel = this.forkNodes.filter((n) => {
      const p = n.parent
      return !(p && forkSet.has(p))
    })
    for (const node of forkTopLevel) {
      this.reparented.push({ node, originalParent: node.parent })
      this.remountNode(node, this.tiltPivot)
    }

    // ---- 3) Rest calibration ----
    // bladeTopRef = TOP blade model (node center + half thickness).
    // NOTE: Fork_ nodes are AbstractMesh, NOT TransformNode — must not filter them out.
    const bladeNode = this.forkNodes.find((n) => /^Fork_/i.test(n.name))
    const bladeCenterY = bladeNode?.getAbsolutePosition().y ?? 1.70
    const bladeTopRef = bladeCenterY + this.config.forkBladeHalfThickness
    this.restOffset = this.config.restForkSurfaceY - bladeTopRef
    console.log(`[ForkSystem] Rest calibration: bladeNode=${bladeNode?.name ?? 'NONE'} bladeCenterY=${bladeCenterY.toFixed(3)} bladeTopRef=${bladeTopRef.toFixed(3)} restOffset=${this.restOffset.toFixed(3)}`)

    this.applyTransform()

    // ---- 4) Attachment point pallet di frame TiltPivot ----
    // Setelah remount, node Fork_*/ForkTip_* adalah child TiltPivot dengan
    // posisi LOKAL yang sudah di-rebake (ikut lift+tilt otomatis). Baca posisi
    // lokal aktual di frame tilt saja — tanpa memakai nilai world/bladeTopRef
    // lagi (rumus lama double-count restOffset & memakai midX frame dunia
    // sebagai posisi frame tilt).
    const bladeLocalX: number[] = []
    const bladeTopLocalY: number[] = []
    for (const n of this.forkNodes) {
      if (/^Fork_/i.test(n.name) || /^ForkTip_/i.test(n.name)) {
        bladeLocalX.push(n.position.x)
        bladeTopLocalY.push(n.position.y + this.config.forkBladeHalfThickness)
      }
    }
    const midX = bladeLocalX.length ? bladeLocalX.reduce((a, b) => a + b, 0) / bladeLocalX.length : 1.2
    // TOP blade lokal di frame TiltPivot (forkliftbaru.glb: ≈ -0.69).
    const bladeTopLocal = bladeTopLocalY.length ? Math.max(...bladeTopLocalY) : -0.6
    // Muatan root ditempatkan sehingga: root.y = TOP blade − tinggi slot/pocket.
    // (Pocket crate dibuat dengan underside = TOP blade saat box di-ground →
    // saat diangkat box "duduk" persis di atas tine; lihat ForkliftCargoTest.)
    this.attachBladeTopLocal = bladeTopLocal
    this.attachLocalPosition = new Vector3(midX, bladeTopLocal - this.config.palletSlotHeight, 0)

    console.log(
      `[ForkSystem] Hierarchy: ${root.name} → ${this.liftPivot.name} → ${this.tiltPivot.name}` +
        `\n[ForkSystem] LiftPivot anchor=(${anchorX},${this.liftBaseY.toFixed(2)},0)  TiltPivot@carriage liftLocal=(${liftLocal.x.toFixed(2)}, ${liftLocal.y.toFixed(2)}, ${liftLocal.z.toFixed(2)})` +
        `\n[ForkSystem] rebated: ${innerTopLevel.length} MastInner → LiftPivot;  ${forkTopLevel.length} carriage/fork → TiltPivot` +
        `\n[ForkSystem] bladeTopRef=${bladeTopRef.toFixed(3)} restOffset=${this.restOffset.toFixed(3)}` +
        ` forkTop@rest=${(bladeTopRef + this.restOffset).toFixed(3)}  attachLocal=${this.attachLocalPosition.x.toFixed(2)},${this.attachLocalPosition.y.toFixed(2)}`
    )
  }

  /** Re-bake transform lokal node agar world transform PRESERVED di bawah parent baru. */
  private remountNode(node: TransformNode | AbstractMesh, newParent: TransformNode | null): void {
    node.computeWorldMatrix(true)
    const world = node.getWorldMatrix()

    let local: Matrix
    if (newParent) {
      newParent.computeWorldMatrix(true)
      local = newParent.getWorldMatrix().clone().invert().multiply(world)
    } else {
      local = world.clone()
    }

    const decScale = new Vector3()
    const decQuat = new Quaternion()
    const decPos = new Vector3()
    local.decompose(decScale, decQuat, decPos)

    node.position.copyFrom(decPos)
    node.rotationQuaternion = decQuat
    node.rotation.setAll(0)
    node.scaling.copyFrom(decScale)
    node.parent = newParent
    node.computeWorldMatrix(true)
  }

  /** Verifikasi: world Y roda = konstan (harus ≈0.02-0.15). */
  private logWheelGroundCheck(root: AbstractMesh): void {
    const wheelNames = /^(SteerWheel|DriveWheel)/i
    const parts = root.getChildTransformNodes(false, (n) => wheelNames.test(n.name)) as Array<TransformNode>
    const targets: string[] = []
    for (const part of parts) {
      const abs = part.getAbsolutePosition()
      targets.push(`${part.name}=${abs.y.toFixed(3)}`)
    }
    console.log(`[ForkSystem] Wheel world Y after remount (harus tetap ≈0.02..0.15): ${targets.join(', ')}`)
  }

  // ============================================
  // INPUT
  // ============================================

  private registerKeyboard(): void {
    this.keyboardObserver = this.scene.onKeyboardObservable.add((info) => {
      const pressed = info.type === KeyboardEventTypes.KEYDOWN
      const released = info.type === KeyboardEventTypes.KEYUP
      if (!pressed && !released) return

      switch (info.event.code) {
        case 'KeyT': this.liftUp = pressed; break
        case 'KeyG': this.liftDown = pressed; break
        case 'KeyY': this.tiltForward = pressed; break
        case 'KeyH': this.tiltBackward = pressed; break
      }
    })
  }

  /** Wheel profile input. Keyboard remains available when wheel mode is not selected. */
  setWheelInput(input: { liftUp: boolean; liftDown: boolean; tiltForward: boolean; tiltBackward: boolean }): void {
    this.liftUp = input.liftUp
    this.liftDown = input.liftDown
    this.tiltForward = input.tiltForward
    this.tiltBackward = input.tiltBackward
  }

  // ============================================
  // UPDATE — call each frame
  // ============================================

  update(dt: number): void {
    if (this.isDisposed || !this.liftPivot || !this.tiltPivot) return

    const clampedDt = Math.min(dt, 0.05)

    this._targetHeight = this.liftUp ? this.maxLiftHeight : (this.liftDown ? 0 : this._currentHeight)
    this._targetTilt = this.tiltForward ? this.config.minTilt : (this.tiltBackward ? this.config.maxTilt : 0)

    const hDiff = this._targetHeight - this._currentHeight
    if (Math.abs(hDiff) < 0.01) {
      this._currentHeight = this._targetHeight
    } else {
      this._currentHeight += hDiff * Math.min(1, this.config.liftSpeed * clampedDt * 5)
    }

    const tDiff = this._targetTilt - this._currentTilt
    if (Math.abs(tDiff) < 0.005) {
      this._currentTilt = this._targetTilt
    } else {
      this._currentTilt += tDiff * Math.min(1, this.config.tiltSpeed * clampedDt * 5)
    }

    this.applyTransform()
  }

  /**
   * LIFT = liftPivot.position.y (MastInner + TiltPivot + Carriage + Fork ikut),
   * TILT = tiltPivot.rotation.z (hanya Carriage + Fork; MastInner tetap tegak).
   * Roda/body/mast outer tidak terlibat.
   */
  private applyTransform(): void {
    if (!this.liftPivot || !this.tiltPivot) return
    this.liftPivot.position.x = this.anchorX
    this.liftPivot.position.y = this.liftBaseY + this.restOffset + this._currentHeight
    this.liftPivot.position.z = 0
    this.liftPivot.rotation.x = 0
    this.liftPivot.rotation.y = 0
    this.liftPivot.rotation.z = 0

    this.tiltPivot.rotation.x = 0
    this.tiltPivot.rotation.y = 0
    this.tiltPivot.rotation.z = this._currentTilt
  }

  // ============================================
  // PUBLIC ACCESS
  // ============================================

  /** Node tempel pallet: TiltPivot (carriage) — pallet ikut lift + tilt. */
  getPivot(): TransformNode | null {
    return this.tiltPivot
  }

  /** Posisi tempel muatan di frame TiltPivot.
   *  - x = tengah bentang blade (arah fork)
   *  - y = TOP blade − tinggi slot/pocket → muatan "duduk" tepat di atas tine
   *  Jika `forkPocketHeight` disuplai (mis. crate), dipakai; jika tidak,
   *  pakai palletSlotHeight (kompatibel dengan pemanggil lama).
   */
  getForkAttachLocalPosition(forkPocketHeight?: number): Vector3 {
    const slot = forkPocketHeight ?? this.config.palletSlotHeight
    return new Vector3(this.attachLocalPosition.x, this.attachBladeTopLocal - slot, 0)
  }

  /** Offset tinggi fork dari rest (meter). 0 = rest (level slot). */
  getForkHeight(): number {
    return this._currentHeight
  }

  /** Sudut tilt saat ini (radian). */
  getForkTilt(): number {
    return this._currentTilt
  }

  /** Perkiraan Y dunia permukaan angkat garpu (TOP blade). */
  getForkSurfaceY(): number {
    return this.config.restForkSurfaceY + this._currentHeight
  }

  hasForkNodes(): boolean {
    return this.forkNodes.length > 0
  }

  getForkNodeCount(): number {
    return this.forkNodes.length
  }

  /** Force set fork height (clamped [rest, max]). */
  setForkHeight(height: number): void {
    this._currentHeight = Math.max(0, Math.min(this.maxLiftHeight, height))
    this._targetHeight = this._currentHeight
  }

  // ============================================
  // DISPOSE
  // ============================================

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    if (this.keyboardObserver) {
      this.scene.onKeyboardObservable.remove(this.keyboardObserver)
      this.keyboardObserver = null
    }

    for (const r of this.reparented) {
      try {
        if (r.node.parent !== r.originalParent) {
          this.remountNode(r.node, r.originalParent as TransformNode | null)
        }
      } catch {
        // scene sedang di-dispose — abaikan
      }
    }
    this.reparented = []

    this.liftPivot?.dispose()
    this.liftPivot = null
    this.tiltPivot?.dispose()
    this.tiltPivot = null
    this.forkNodes = []
    this.innerRails = []

    console.log('[ForkSystem] Disposed')
  }
}
