/**
 * WaypointMarkers
 * ===============
 * Creates 3D visual markers in the Babylon.js scene for each waypoint.
 * 
 * - Active waypoint: large green glowing pillar
 * - Upcoming waypoints: small blue transparent pillars
 * - Reached waypoints: faded out / invisible
 */

import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Vector3,
  AbstractMesh,
  GlowLayer,
  Animation,
} from '@babylonjs/core'
import type { Waypoint, WaypointState } from './WaypointSystem'

interface MarkerMesh {
  pillar: AbstractMesh
  ring: AbstractMesh
  waypointId: number
}

export class WaypointMarkers {
  private scene: Scene
  private markers: MarkerMesh[] = []
  private activeMaterial!: PBRMaterial
  private upcomingMaterial!: PBRMaterial
  private reachedMaterial!: PBRMaterial
  private glowLayer: GlowLayer | null = null

  constructor(scene: Scene) {
    this.scene = scene
    this.createMaterials()
  }

  private createMaterials(): void {
    // Active waypoint: bright green glow
    this.activeMaterial = new PBRMaterial('wp_active_mat', this.scene)
    this.activeMaterial.albedoColor = new Color3(0.1, 0.9, 0.3)
    this.activeMaterial.emissiveColor = new Color3(0.1, 0.8, 0.2)
    this.activeMaterial.emissiveIntensity = 2
    this.activeMaterial.alpha = 0.8
    this.activeMaterial.metallic = 0.1
    this.activeMaterial.roughness = 0.5

    // Upcoming: blue semi-transparent
    this.upcomingMaterial = new PBRMaterial('wp_upcoming_mat', this.scene)
    this.upcomingMaterial.albedoColor = new Color3(0.2, 0.5, 1.0)
    this.upcomingMaterial.emissiveColor = new Color3(0.1, 0.3, 0.8)
    this.upcomingMaterial.emissiveIntensity = 0.5
    this.upcomingMaterial.alpha = 0.35
    this.upcomingMaterial.metallic = 0.0
    this.upcomingMaterial.roughness = 0.8

    // Reached: very faded
    this.reachedMaterial = new PBRMaterial('wp_reached_mat', this.scene)
    this.reachedMaterial.albedoColor = new Color3(0.3, 0.3, 0.3)
    this.reachedMaterial.emissiveColor = new Color3(0, 0, 0)
    this.reachedMaterial.alpha = 0.1
    this.reachedMaterial.metallic = 0.0
    this.reachedMaterial.roughness = 1.0

    // Setup glow layer for active checkpoint
    this.glowLayer = new GlowLayer('wp_glow', this.scene, {
      mainTextureSamples: 4,
      blurKernelSize: 32,
    })
    this.glowLayer.intensity = 0.6
  }

  /**
   * Create visual markers for all waypoints in a route
   */
  createMarkers(waypoints: Waypoint[]): void {
    this.disposeMarkers()

    waypoints.forEach((wp, index) => {
      const isFirst = index === 0
      // Checkpoint udara (wp.position.y > 0): marker dibuat MENGAMBANG di
      // ketinggian — pillar pendek sebagai beacon, ring horizontal sebagai
      // gerbang. Waypoint darat (y=0) tetap behavior lama (tancap di tanah).
      const isAir = wp.position.y > 0

      // Pillar (vertical cylinder beacon)
      const pillarHeight = isFirst ? (isAir ? 8 : 15) : (isAir ? 5 : 10)
      const pillarDiameter = isFirst ? 2.0 : 1.2
      const pillar = MeshBuilder.CreateCylinder(
        `wp_pillar_${wp.id}`,
        {
          height: pillarHeight,
          diameter: pillarDiameter,
          tessellation: 16,
        },
        this.scene
      )
      pillar.position = new Vector3(
        wp.position.x,
        isAir ? wp.position.y : pillarHeight / 2, // Darat: bottom di ground
        wp.position.z
      )
      pillar.material = isFirst ? this.activeMaterial : this.upcomingMaterial
      pillar.isPickable = false

      // Ground ring / gerbang udara
      const ring = MeshBuilder.CreateTorus(
        `wp_ring_${wp.id}`,
        {
          diameter: wp.radius * 2,
          thickness: 0.5,
          tessellation: 32,
        },
        this.scene
      )
      ring.position = new Vector3(wp.position.x, isAir ? wp.position.y : 0.15, wp.position.z)
      ring.material = isFirst ? this.activeMaterial : this.upcomingMaterial
      ring.isPickable = false

      // Add glow to active marker
      if (isFirst && this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(pillar as any)
        this.glowLayer.addIncludedOnlyMesh(ring as any)
      }

      // Bobbing animation on the pillar
      if (isFirst) {
        this.addBobbingAnimation(pillar, pillarHeight / 2)
      }

      this.markers.push({ pillar, ring, waypointId: wp.id })
    })
  }

  /**
   * Update marker visuals based on waypoint states
   */
  updateStates(states: { waypointId: number; state: WaypointState }[]): void {
    states.forEach(({ waypointId, state }) => {
      const marker = this.markers.find(m => m.waypointId === waypointId)
      if (!marker) return

      switch (state) {
        case 'active':
          marker.pillar.material = this.activeMaterial
          marker.ring.material = this.activeMaterial
          marker.pillar.scaling.y = 1.0
          marker.pillar.isVisible = true
          marker.ring.isVisible = true
          if (this.glowLayer) {
            this.glowLayer.addIncludedOnlyMesh(marker.pillar as any)
            this.glowLayer.addIncludedOnlyMesh(marker.ring as any)
          }
          this.addBobbingAnimation(marker.pillar, marker.pillar.position.y)
          break

        case 'upcoming':
          marker.pillar.material = this.upcomingMaterial
          marker.ring.material = this.upcomingMaterial
          marker.pillar.isVisible = true
          marker.ring.isVisible = true
          break

        case 'reached':
          marker.pillar.material = this.reachedMaterial
          marker.ring.material = this.reachedMaterial
          marker.pillar.isVisible = false // Hide completely once reached
          marker.ring.isVisible = false
          if (this.glowLayer) {
            this.glowLayer.removeIncludedOnlyMesh(marker.pillar as any)
            this.glowLayer.removeIncludedOnlyMesh(marker.ring as any)
          }
          break

        case 'missed':
          marker.pillar.isVisible = false
          marker.ring.isVisible = false
          break
      }
    })
  }

  /**
   * Simple bobbing animation for active checkpoint
   */
  private addBobbingAnimation(mesh: AbstractMesh, baseY: number): void {
    mesh.animations = []
    const anim = new Animation(
      'wpBob',
      'position.y',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    )
    anim.setKeys([
      { frame: 0, value: baseY },
      { frame: 30, value: baseY + 0.5 },
      { frame: 60, value: baseY },
    ])
    mesh.animations.push(anim)
    this.scene.beginAnimation(mesh, 0, 60, true)
  }

  /**
   * Dispose all marker meshes and materials
   */
  disposeMarkers(): void {
    this.markers.forEach(m => {
      m.pillar.dispose()
      m.ring.dispose()
    })
    this.markers = []
  }

  dispose(): void {
    this.disposeMarkers()
    this.activeMaterial?.dispose()
    this.upcomingMaterial?.dispose()
    this.reachedMaterial?.dispose()
    this.glowLayer?.dispose()
  }
}
