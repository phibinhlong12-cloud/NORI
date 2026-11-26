import * as THREE from 'three';
import { OutsideGenerator } from './outside';
import { createParabolicEllipsoidGeometry, createParabolicLatheGeometry } from './parabolic';

export type MonsterDropKind = 'slime_orb' | 'mushroom_item';

export interface MonsterDropCallbacks {
  canCollect: (kind: MonsterDropKind) => boolean;
  onCollect: (kind: MonsterDropKind) => void;
  onBlocked?: (kind: MonsterDropKind) => void;
}

interface DropEntity {
  kind: MonsterDropKind;
  x: number;
  y: number;
  z: number;
  vy: number;
  vx: number;
  vz: number;
  groundY: number;
  age: number;
  state: 'pop' | 'idle' | 'flying';
  group: THREE.Group;
  ringMesh: THREE.Mesh;
}

const DROP_MAGNET_RANGE = 5.2;
const DROP_BLOCKED_RANGE = 2.0;
const DROP_EXPIRE_SECONDS = 120;

export class MonsterDropManager {
  private readonly scene: THREE.Scene;
  private readonly outside: OutsideGenerator;
  private readonly drops: DropEntity[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  // Shared geometries & materials for slime orbs and mushrooms
  private readonly orbOuterGeo: THREE.BufferGeometry;
  private readonly orbOuterMat: THREE.MeshPhysicalMaterial;
  private readonly orbCoreGeo: THREE.BufferGeometry;
  private readonly orbCoreMat: THREE.MeshStandardMaterial;
  private readonly orbRingGeo: THREE.BufferGeometry;
  private readonly orbRingMat: THREE.MeshBasicMaterial;

  private readonly stemGeo: THREE.BufferGeometry;
  private readonly stemMat: THREE.MeshStandardMaterial;
  private readonly capGeo: THREE.BufferGeometry;
  private readonly capMat: THREE.MeshStandardMaterial;
  private readonly spotGeo: THREE.BufferGeometry;
  private readonly spotMat: THREE.MeshStandardMaterial;
  private readonly mushRingGeo: THREE.BufferGeometry;
  private readonly mushRingMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, outside: OutsideGenerator) {
    this.scene = scene;
    this.outside = outside;

    // 1. Quả cầu Slime (dựa theo ảnh mẫu: vỏ gel xanh bạc hà bóng + lõi xanh ngọc lục bảo)
    this.orbOuterGeo = new THREE.SphereGeometry(0.28, 22, 16);
    this.orbOuterMat = new THREE.MeshPhysicalMaterial({
      color: '#bbf7d0',
      emissive: '#4ade80',
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.72,
      roughness: 0.14,
      metalness: 0.04,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
    });
    this.orbCoreGeo = createParabolicEllipsoidGeometry(0.18, 0.15, 0.18, 18, 10);
    this.orbCoreMat = new THREE.MeshStandardMaterial({
      color: '#22c55e',
      emissive: '#16a34a',
      emissiveIntensity: 0.45,
      roughness: 0.28,
    });
    this.orbRingGeo = new THREE.RingGeometry(0.26, 0.34, 24);
    this.orbRingGeo.rotateX(-Math.PI / 2);
    this.orbRingMat = new THREE.MeshBasicMaterial({
      color: '#4ade80',
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });

    // 2. Nấm đỏ đốm kem (dựa theo ảnh mẫu: mũ nấm parabol đỏ tươi đốm kem + thân kem)
    this.stemGeo = createParabolicLatheGeometry(0.24, 0.11, (t) => 1 - t * 0.27, 14, 6);
    this.stemMat = new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      roughness: 0.78,
    });
    this.capGeo = createParabolicEllipsoidGeometry(0.25, 0.18, 0.25, 20, 10);
    this.capMat = new THREE.MeshStandardMaterial({
      color: '#ea4326',
      emissive: '#991b1b',
      emissiveIntensity: 0.14,
      roughness: 0.42,
    });
    this.spotGeo = new THREE.SphereGeometry(0.055, 10, 8);
    this.spotMat = new THREE.MeshStandardMaterial({
      color: '#fef9e7',
      roughness: 0.65,
    });
    this.mushRingGeo = new THREE.RingGeometry(0.26, 0.34, 24);
    this.mushRingGeo.rotateX(-Math.PI / 2);
    this.mushRingMat = new THREE.MeshBasicMaterial({
      color: '#f97316',
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
    });

    this.geometries.push(
      this.orbOuterGeo,
      this.orbCoreGeo,
      this.orbRingGeo,
      this.stemGeo,
      this.capGeo,
      this.spotGeo,
      this.mushRingGeo,
    );
    this.materials.push(
      this.orbOuterMat,
      this.orbCoreMat,
      this.orbRingMat,
      this.stemMat,
      this.capMat,
      this.spotMat,
      this.mushRingMat,
    );
  }

  private buildDropMesh(kind: MonsterDropKind): { group: THREE.Group; ringMesh: THREE.Mesh } {
    const group = new THREE.Group();
    if (kind === 'slime_orb') {
      const outer = new THREE.Mesh(this.orbOuterGeo, this.orbOuterMat);
      outer.scale.set(1.06, 0.92, 1.06);
      outer.position.y = 0.26;
      const core = new THREE.Mesh(this.orbCoreGeo, this.orbCoreMat);
      core.position.y = 0.24;
      const ringMesh = new THREE.Mesh(this.orbRingGeo, this.orbRingMat);
      ringMesh.position.y = 0.02;
      group.add(outer, core, ringMesh);
      return { group, ringMesh };
    }

    const stem = new THREE.Mesh(this.stemGeo, this.stemMat);
    stem.position.y = 0.08;
    const cap = new THREE.Mesh(this.capGeo, this.capMat);
    cap.position.y = 0.27;

    const spotCoords: Array<[number, number, number, number]> = [
      [0, 0.16, 0, 1.05],
      [0.14, 0.09, 0.12, 0.85],
      [-0.15, 0.09, 0.11, 0.9],
      [0.13, 0.09, -0.13, 0.8],
      [-0.14, 0.08, -0.12, 0.85],
    ];
    for (const [sx, sy, sz, sc] of spotCoords) {
      const spot = new THREE.Mesh(this.spotGeo, this.spotMat);
      spot.position.set(sx, sy, sz);
      spot.scale.set(sc, sc * 0.65, sc);
      cap.add(spot);
    }

    const ringMesh = new THREE.Mesh(this.mushRingGeo, this.mushRingMat);
    ringMesh.position.y = 0.02;
    group.add(stem, cap, ringMesh);
    return { group, ringMesh };
  }

  spawnDrop(kind: MonsterDropKind, x: number, y: number, z: number): void {
    const { group, ringMesh } = this.buildDropMesh(kind);
    const groundY = this.outside.getHeightAt(x, z);
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.1 + Math.random() * 1.1;
    const startY = Math.max(groundY + 0.35, y + 0.45);
    group.position.set(x, startY, z);
    this.scene.add(group);

    this.drops.push({
      kind,
      x,
      y: startY,
      z,
      vy: 4.8,
      vx: Math.cos(angle) * speed,
      vz: Math.sin(angle) * speed,
      groundY,
      age: 0,
      state: 'pop',
      group,
      ringMesh,
    });
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    hasBackpack: boolean,
    callbacks?: MonsterDropCallbacks,
  ): void {
    const targetChestY = playerY + 0.9;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.age += dt;
      if (drop.age > DROP_EXPIRE_SECONDS) {
        this.scene.remove(drop.group);
        this.drops.splice(i, 1);
        continue;
      }

      if (drop.state === 'pop') {
        drop.x += drop.vx * dt;
        drop.z += drop.vz * dt;
        drop.groundY = this.outside.getHeightAt(drop.x, drop.z);
        drop.vy -= 14.5 * dt;
        drop.y += drop.vy * dt;
        if (drop.y <= drop.groundY + 0.14) {
          drop.y = drop.groundY + 0.14;
          drop.vy = 0;
          drop.vx = 0;
          drop.vz = 0;
          drop.state = 'idle';
        }
        drop.group.position.set(drop.x, drop.y, drop.z);
      } else if (drop.state === 'idle') {
        const hover = Math.sin(drop.age * 3.4) * 0.08;
        drop.group.position.set(drop.x, drop.groundY + 0.18 + hover, drop.z);
        drop.group.rotation.y += dt * 1.65;
        const pulse = 1 + Math.sin(drop.age * 4.2) * 0.12;
        drop.ringMesh.scale.set(pulse, 1, pulse);

        const distToPlayer = Math.hypot(playerX - drop.x, playerZ - drop.z);
        if (drop.age >= 0.45 && distToPlayer <= DROP_MAGNET_RANGE) {
          if (hasBackpack && callbacks?.canCollect(drop.kind)) {
            drop.state = 'flying';
            drop.ringMesh.visible = false;
          } else if (distToPlayer <= DROP_BLOCKED_RANGE) {
            callbacks?.onBlocked?.(drop.kind);
          }
        }
      } else {
        // Bay mượt vào balo trên lưng/ngực người chơi
        const dx = playerX - drop.x;
        const dy = targetChestY - drop.y;
        const dz = playerZ - drop.z;
        const dist = Math.hypot(dx, dy, dz);
        const speed = 13.5;
        if (dist <= Math.max(0.45, speed * dt)) {
          if (hasBackpack && callbacks?.canCollect(drop.kind)) {
            callbacks.onCollect(drop.kind);
            this.scene.remove(drop.group);
            this.drops.splice(i, 1);
            continue;
          } else {
            drop.state = 'idle';
            drop.ringMesh.visible = true;
            drop.y = drop.groundY + 0.18;
          }
        } else {
          const step = (speed * dt) / dist;
          drop.x += dx * step;
          drop.y += dy * step;
          drop.z += dz * step;
          drop.group.position.set(drop.x, drop.y, drop.z);
          drop.group.rotation.y += dt * 6.5;
          const shrink = Math.max(0.42, Math.min(1, dist / 2.2));
          drop.group.scale.setScalar(shrink);
        }
      }
    }
  }

  clearAll(): void {
    for (const drop of this.drops) {
      this.scene.remove(drop.group);
    }
    this.drops.length = 0;
  }

  dispose(): void {
    this.clearAll();
    for (const geo of this.geometries) {
      geo.dispose();
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
  }
}
