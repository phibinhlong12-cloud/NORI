import * as THREE from 'three';
import { CHUNK_SIZE } from './constants';
import { VND_PER_BLOCK } from './counter';
import { OutsideGenerator } from './outside';
import {
  createBarkTexture,
  createHeartwoodTexture,
  createLeafCanopyTexture,
} from './textures';

export type TreeState = 'standing' | 'fallen';
export type DetachedLogState = 'falling' | 'fallen' | 'carried';

export const BACKPACK_CAPACITY = 9;
export const MAX_POTION_STACK = 50;

export type BackpackItem =
  | {
      kind: 'wood';
      id: string;
      length: number;
      hasCanopy: boolean;
      valueVnd: number;
    }
  | {
      kind: 'potion';
      id: string;
      count: number;
    };

type InternalBackpackSlot =
  | { kind: 'wood'; log: DetachedLog }
  | { kind: 'potion'; id: string; count: number };

export interface TreeBranchSpec {
  localY: number;
  yaw: number;
  tilt: number;
  lengthScale: number;
  radiusScale: number;
  twigOffset: number;
  twigYaw: number;
  hasLeaves: boolean;
  leafScale: number;
  leafVariant: 0 | 1 | 2;
}

export interface InteractiveTree {
  id: string;
  chunkKey: string;
  x: number;
  z: number;
  baseY: number;
  trunkHeight: number;
  remainingHeight: number;
  trunkRadius: number;
  canopyScale: number;
  canopyRotation: number;
  variantSeed: number;
  hasCanopy: boolean;
  state: TreeState;
  branches: TreeBranchSpec[];
  standingGroup: THREE.Group | null;
  trunkHitMesh: THREE.Mesh | null;
  trunkBranchGroup: THREE.Group | null;
  canopyGroup: THREE.Group | null;
}

export interface DetachedLog {
  id: string;
  chunkKey: string;
  group: THREE.Group;
  hitMeshes: THREE.Object3D[];
  x: number;
  y: number;
  z: number;
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  tipX: number;
  tipY: number;
  tipZ: number;
  trunkRadius: number;
  length: number;
  hasCanopy: boolean;
  state: DetachedLogState;
  fallAxis: THREE.Vector3;
  startAngle: number;
  targetAngle: number;
  fallElapsed: number;
  fallDuration: number;
}

const FALL_DURATION = 1.0;
const PLACE_DROP_DURATION = 0.18;
const EMBED_DEPTH = 0.25;

function seededRand(x: number, z: number, seed: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 19.37) * 43758.5453123;
  return n - Math.floor(n);
}

export class TreeManager {
  private readonly scene: THREE.Scene;
  private readonly outside: OutsideGenerator;
  private readonly seed: number;

  private readonly barkTexture: THREE.CanvasTexture;
  private readonly heartwoodTexture: THREE.CanvasTexture;
  private readonly leafTextureDark: THREE.CanvasTexture;
  private readonly leafTextureMid: THREE.CanvasTexture;
  private readonly leafTextureLight: THREE.CanvasTexture;

  private readonly barkMaterial: THREE.MeshStandardMaterial;
  private readonly heartwoodMaterial: THREE.MeshStandardMaterial;
  private readonly trunkMaterials: THREE.Material[];
  private readonly canopyMaterialDark: THREE.MeshStandardMaterial;
  private readonly canopyMaterialMid: THREE.MeshStandardMaterial;
  private readonly canopyMaterialLight: THREE.MeshStandardMaterial;

  // Dùng chung geometry đơn vị (height = 1, radius = 1) để tiết kiệm bộ nhớ GPU
  private readonly unitCylinderGeo: THREE.CylinderGeometry;
  private readonly rootFlareGeo: THREE.CylinderGeometry;
  private readonly branchGeo: THREE.CylinderGeometry;
  private readonly twigGeo: THREE.CylinderGeometry;
  private readonly leafTuftGeo: THREE.IcosahedronGeometry;
  private readonly canopyMainGeo: THREE.IcosahedronGeometry;
  private readonly canopyTopGeo: THREE.IcosahedronGeometry;
  private readonly canopyAccentGeo: THREE.IcosahedronGeometry;

  private readonly chunkTrees = new Map<string, InteractiveTree[]>();
  private readonly detachedLogs = new Set<DetachedLog>();
  private readonly fallingLogs = new Set<DetachedLog>();
  private readonly backpackSlots: Array<InternalBackpackSlot | null> = Array.from(
    { length: BACKPACK_CAPACITY },
    () => null,
  );
  private backpackSnapshot: Array<BackpackItem | null> = Array.from(
    { length: BACKPACK_CAPACITY },
    () => null,
  );
  private carriedLog: DetachedLog | null = null;
  private cutCounter = 0;

  private readonly raycaster = new THREE.Raycaster();
  private readonly tempRayHitCheck: THREE.Object3D[] = [];
  private readonly carryLocalOffset = new THREE.Vector3(0.72, -0.46, -1.12);
  private readonly carryLocalQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI * 0.42, 0.12, -0.16, 'YXZ'),
  );
  private readonly tempCarryWorldPos = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    outside: OutsideGenerator,
    seed: number,
    maxAnisotropy = 4,
  ) {
    this.scene = scene;
    this.outside = outside;
    this.seed = seed;

    this.barkTexture = createBarkTexture(maxAnisotropy);
    this.heartwoodTexture = createHeartwoodTexture(maxAnisotropy);
    this.leafTextureDark = createLeafCanopyTexture('#2b6f1e', '#3e9229', '#1d4d14', maxAnisotropy);
    this.leafTextureMid = createLeafCanopyTexture('#3e8e28', '#5bb838', '#2a661a', maxAnisotropy);
    this.leafTextureLight = createLeafCanopyTexture('#58ae35', '#7fd44a', '#3d8625', maxAnisotropy);

    this.barkMaterial = new THREE.MeshStandardMaterial({
      map: this.barkTexture,
      roughness: 0.92,
      metalness: 0.02,
    });
    this.heartwoodMaterial = new THREE.MeshStandardMaterial({
      map: this.heartwoodTexture,
      roughness: 0.84,
      metalness: 0.02,
    });
    this.trunkMaterials = [this.barkMaterial, this.heartwoodMaterial, this.heartwoodMaterial];

    this.canopyMaterialDark = new THREE.MeshStandardMaterial({
      map: this.leafTextureDark,
      roughness: 0.78,
      metalness: 0.02,
    });
    this.canopyMaterialMid = new THREE.MeshStandardMaterial({
      map: this.leafTextureMid,
      roughness: 0.72,
      metalness: 0.02,
    });
    this.canopyMaterialLight = new THREE.MeshStandardMaterial({
      map: this.leafTextureLight,
      roughness: 0.68,
      metalness: 0.02,
    });

    // Cylinder 12 cạnh hơi thon lên ngọn cho thân cây sắc nét hơn
    this.unitCylinderGeo = new THREE.CylinderGeometry(0.84, 1.02, 1.0, 12);
    this.unitCylinderGeo.translate(0, 0.5, 0);

    // Gốc rễ xòe nhẹ giúp cây bám chắc vào sườn đồi
    this.rootFlareGeo = new THREE.CylinderGeometry(0.92, 1.56, 0.56, 8);
    this.rootFlareGeo.translate(0, 0.2, 0);

    this.branchGeo = new THREE.CylinderGeometry(0.09, 0.16, 1.15, 7);
    this.branchGeo.translate(0, 0.55, 0);

    this.twigGeo = new THREE.CylinderGeometry(0.045, 0.085, 0.72, 6);
    this.twigGeo.translate(0, 0.34, 0);

    this.leafTuftGeo = new THREE.IcosahedronGeometry(0.46, 1);

    this.canopyMainGeo = new THREE.IcosahedronGeometry(1.52, 2);
    this.canopyTopGeo = new THREE.IcosahedronGeometry(1.12, 2);
    this.canopyAccentGeo = new THREE.IcosahedronGeometry(0.86, 1);
  }

  private getCanopyMaterial(variant: number): THREE.MeshStandardMaterial {
    if (variant === 0) return this.canopyMaterialDark;
    if (variant === 1) return this.canopyMaterialMid;
    return this.canopyMaterialLight;
  }

  private buildBranchMeshGroup(
    spec: TreeBranchSpec,
    trunkRadius: number,
    baseOffsetY = 0,
  ): THREE.Group {
    const branchHolder = new THREE.Group();
    branchHolder.position.set(0, spec.localY - baseOffsetY, 0);
    branchHolder.rotation.y = spec.yaw;

    const limbPivot = new THREE.Group();
    limbPivot.rotation.z = spec.tilt;
    branchHolder.add(limbPivot);

    const thickness = Math.max(0.55, trunkRadius * spec.radiusScale * 2.35);
    const limbMesh = new THREE.Mesh(this.branchGeo, this.barkMaterial);
    limbMesh.scale.set(thickness, spec.lengthScale, thickness);
    limbMesh.castShadow = true;
    limbMesh.receiveShadow = true;
    limbPivot.add(limbMesh);

    const twigMesh = new THREE.Mesh(this.twigGeo, this.barkMaterial);
    twigMesh.position.set(0, spec.lengthScale * spec.twigOffset, 0);
    twigMesh.rotation.set(0.32, spec.twigYaw, 0.58);
    twigMesh.scale.set(thickness * 0.85, spec.lengthScale * 0.74, thickness * 0.85);
    twigMesh.castShadow = true;
    twigMesh.receiveShadow = true;
    limbPivot.add(twigMesh);

    if (spec.hasLeaves) {
      const matMain = this.getCanopyMaterial(spec.leafVariant);
      const matSub = this.getCanopyMaterial((spec.leafVariant + 1) % 3);

      const mainTuft = new THREE.Mesh(this.leafTuftGeo, matMain);
      mainTuft.position.set(0, spec.lengthScale * 1.12, 0);
      mainTuft.scale.set(spec.leafScale * 1.12, spec.leafScale * 0.86, spec.leafScale * 1.05);
      mainTuft.castShadow = true;
      mainTuft.receiveShadow = true;
      limbPivot.add(mainTuft);

      const twigTuft = new THREE.Mesh(this.leafTuftGeo, matSub);
      const twigTip = new THREE.Vector3(0, spec.lengthScale * 0.7, 0).applyEuler(twigMesh.rotation);
      twigTuft.position.set(
        twigMesh.position.x + twigTip.x,
        twigMesh.position.y + twigTip.y,
        twigMesh.position.z + twigTip.z,
      );
      twigTuft.scale.set(spec.leafScale * 0.76, spec.leafScale * 0.62, spec.leafScale * 0.74);
      twigTuft.castShadow = true;
      twigTuft.receiveShadow = true;
      limbPivot.add(twigTuft);
    }

    return branchHolder;
  }

  private createCanopyGroup(scale: number, rotY = 0, variantSeed = 0): THREE.Group {
    const group = new THREE.Group();
    group.rotation.y = rotY;

    const rand = (slot: number) => seededRand(variantSeed * 0.37 + slot * 17.3, slot * 29.1, this.seed + 1307);

    // 4-6 nhánh gỗ ngẫu nhiên tỏa vào tán lá giúp mỗi cây một dáng
    const crownBranchCount = 4 + Math.floor(rand(1) * 3);
    for (let i = 0; i < crownBranchCount; i++) {
      const yaw = (i / crownBranchCount) * Math.PI * 2 + (rand(10 + i) - 0.5) * 0.65;
      const tilt = 0.42 + rand(20 + i) * 0.52;
      const bLen = (0.78 + rand(30 + i) * 0.52) * scale;
      const bThick = (0.85 + rand(40 + i) * 0.45) * scale;

      const holder = new THREE.Group();
      holder.rotation.y = yaw;
      holder.position.set(0, (-0.42 + rand(50 + i) * 0.34) * scale, 0);

      const bMesh = new THREE.Mesh(this.branchGeo, this.barkMaterial);
      bMesh.rotation.z = tilt;
      bMesh.scale.set(bThick, bLen, bThick);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      holder.add(bMesh);

      if (rand(60 + i) > 0.35) {
        const subTwig = new THREE.Mesh(this.twigGeo, this.barkMaterial);
        subTwig.position.set(0, bLen * 0.58, 0);
        subTwig.rotation.set((rand(70 + i) - 0.5) * 0.5, rand(80 + i) * Math.PI, 0.55);
        subTwig.scale.set(bThick * 0.75, bLen * 0.72, bThick * 0.75);
        subTwig.castShadow = true;
        subTwig.receiveShadow = true;
        bMesh.add(subTwig);
      }

      group.add(holder);
    }

    // Cụm tán lá chính + các cụm phụ bất đối xứng theo seed từng cây
    const crownTiltX = (rand(2) - 0.5) * 0.24 * scale;
    const crownTiltZ = (rand(3) - 0.5) * 0.24 * scale;
    const heightBias = 0.85 + rand(4) * 0.32;

    const mainCrown = new THREE.Mesh(this.canopyMainGeo, this.canopyMaterialMid);
    mainCrown.position.set(crownTiltX * 0.5, (0.52 + rand(5) * 0.16) * scale, crownTiltZ * 0.5);
    mainCrown.scale.set(
      (0.96 + rand(6) * 0.22) * scale,
      (0.76 + rand(7) * 0.2) * scale * heightBias,
      (0.96 + rand(8) * 0.22) * scale,
    );

    const upperCrown = new THREE.Mesh(this.canopyTopGeo, this.canopyMaterialLight);
    upperCrown.position.set(
      (0.16 + (rand(9) - 0.5) * 0.45) * scale,
      (1.38 + rand(11) * 0.36) * scale * heightBias,
      (-0.08 + (rand(12) - 0.5) * 0.45) * scale,
    );
    upperCrown.scale.set(
      (0.92 + rand(13) * 0.22) * scale,
      (0.8 + rand(14) * 0.2) * scale,
      (0.9 + rand(15) * 0.22) * scale,
    );

    const sideCrownA = new THREE.Mesh(this.canopyTopGeo, this.canopyMaterialDark);
    sideCrownA.position.set(
      (-0.68 - rand(16) * 0.36) * scale,
      (0.28 + rand(17) * 0.35) * scale,
      (0.38 + (rand(18) - 0.5) * 0.45) * scale,
    );
    sideCrownA.scale.set(0.84 * scale, 0.72 * scale, 0.84 * scale);

    const sideCrownB = new THREE.Mesh(this.canopyTopGeo, this.canopyMaterialMid);
    sideCrownB.position.set(
      (0.68 + rand(19) * 0.36) * scale,
      (0.34 + rand(21) * 0.35) * scale,
      (-0.36 + (rand(22) - 0.5) * 0.45) * scale,
    );
    sideCrownB.scale.set(0.82 * scale, 0.74 * scale, 0.82 * scale);

    const lowerAccent = new THREE.Mesh(this.canopyAccentGeo, this.canopyMaterialDark);
    lowerAccent.position.set(
      (0.25 + (rand(23) - 0.5) * 0.5) * scale,
      (0.14 + rand(24) * 0.22) * scale,
      (0.72 + rand(25) * 0.28) * scale,
    );
    lowerAccent.scale.set(0.88 * scale, 0.72 * scale, 0.88 * scale);

    const topAccent = new THREE.Mesh(this.canopyAccentGeo, this.canopyMaterialLight);
    topAccent.position.set(
      (-0.3 + (rand(26) - 0.5) * 0.45) * scale,
      (1.06 + rand(27) * 0.28) * scale,
      (0.38 + (rand(28) - 0.5) * 0.35) * scale,
    );
    topAccent.scale.set(0.8 * scale, 0.74 * scale, 0.8 * scale);

    const crownMeshes: THREE.Mesh[] = [
      mainCrown,
      upperCrown,
      sideCrownA,
      sideCrownB,
      lowerAccent,
      topAccent,
    ];

    // 1-3 cụm tán phụ vươn lệch ngẫu nhiên tạo dáng tự nhiên riêng biệt cho từng cây
    const extraPuffs = 1 + Math.floor(rand(29) * 3);
    for (let e = 0; e < extraPuffs; e++) {
      const puffAngle = rand(90 + e) * Math.PI * 2;
      const puffDist = (0.78 + rand(100 + e) * 0.58) * scale;
      const puffY = (0.1 + rand(110 + e) * 1.15) * scale;
      const puffScale = (0.62 + rand(120 + e) * 0.42) * scale;
      const mat = this.getCanopyMaterial(Math.floor(rand(130 + e) * 3));
      const puff = new THREE.Mesh(this.canopyAccentGeo, mat);
      puff.position.set(Math.cos(puffAngle) * puffDist, puffY, Math.sin(puffAngle) * puffDist);
      puff.scale.set(puffScale, puffScale * 0.82, puffScale);
      crownMeshes.push(puff);
    }

    for (const m of crownMeshes) {
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }

    return group;
  }

  isCarryingLog(): boolean {
    return this.carriedLog !== null;
  }

  getCarriedLogLength(): number | null {
    return this.carriedLog ? this.carriedLog.length : null;
  }

  private rebuildBackpackSnapshot(): void {
    this.backpackSnapshot = this.backpackSlots.map((slot) => {
      if (!slot) return null;
      if (slot.kind === 'potion') {
        return {
          kind: 'potion',
          id: slot.id,
          count: slot.count,
        };
      }
      const log = slot.log;
      return {
        kind: 'wood',
        id: log.id,
        length: log.length,
        hasCanopy: log.hasCanopy,
        valueVnd: Math.max(10, Math.round(log.length * VND_PER_BLOCK)),
      };
    });
  }

  getBackpackItems(): Array<BackpackItem | null> {
    return this.backpackSnapshot;
  }

  getSlotKind(slotIndex: number): 'wood' | 'potion' | null {
    if (slotIndex < 0 || slotIndex >= BACKPACK_CAPACITY) return null;
    const slot = this.backpackSlots[slotIndex];
    return slot ? slot.kind : null;
  }

  getPotionCountAtSlot(slotIndex: number): number {
    if (slotIndex < 0 || slotIndex >= BACKPACK_CAPACITY) return 0;
    const slot = this.backpackSlots[slotIndex];
    return slot && slot.kind === 'potion' ? slot.count : 0;
  }

  addPotionToBackpack(): { added: boolean; slotIndex: number; count: number } {
    for (let i = 0; i < BACKPACK_CAPACITY; i++) {
      const slot = this.backpackSlots[i];
      if (slot && slot.kind === 'potion' && slot.count < MAX_POTION_STACK) {
        slot.count += 1;
        this.rebuildBackpackSnapshot();
        return { added: true, slotIndex: i, count: slot.count };
      }
    }

    const emptyIndex = this.backpackSlots.findIndex((slot) => slot === null);
    if (emptyIndex === -1) {
      return { added: false, slotIndex: -1, count: 0 };
    }

    this.backpackSlots[emptyIndex] = {
      kind: 'potion',
      id: `potion:${emptyIndex}:${++this.cutCounter}`,
      count: 1,
    };
    this.rebuildBackpackSnapshot();
    return { added: true, slotIndex: emptyIndex, count: 1 };
  }

  consumePotionFromSlot(slotIndex: number): number {
    if (slotIndex < 0 || slotIndex >= BACKPACK_CAPACITY) return -1;
    const slot = this.backpackSlots[slotIndex];
    if (!slot || slot.kind !== 'potion') return -1;

    slot.count -= 1;
    const remaining = slot.count;
    if (remaining <= 0) {
      this.backpackSlots[slotIndex] = null;
    }
    this.rebuildBackpackSnapshot();
    return Math.max(0, remaining);
  }

  isBackpackFull(): boolean {
    return this.backpackSlots.every((slot) => slot !== null);
  }

  storeCarriedLogToBackpack(): boolean {
    if (!this.carriedLog) return false;

    const emptyIndex = this.backpackSlots.findIndex((slot) => slot === null);
    if (emptyIndex === -1) {
      return false;
    }

    const log = this.carriedLog;
    this.carriedLog = null;
    this.fallingLogs.delete(log);
    this.detachedLogs.delete(log);
    this.scene.remove(log.group);
    this.backpackSlots[emptyIndex] = { kind: 'wood', log };
    this.rebuildBackpackSnapshot();
    return true;
  }

  retrieveLogFromBackpackSlot(slotIndex: number): boolean {
    if (this.carriedLog || slotIndex < 0 || slotIndex >= BACKPACK_CAPACITY) {
      return false;
    }

    const slot = this.backpackSlots[slotIndex];
    if (!slot || slot.kind !== 'wood') return false;

    const log = slot.log;
    this.backpackSlots[slotIndex] = null;
    log.state = 'carried';
    log.group.scale.set(0.52, 0.52, 0.52);
    this.scene.add(log.group);
    this.detachedLogs.add(log);
    this.carriedLog = log;
    this.rebuildBackpackSnapshot();
    return true;
  }

  retrieveLogFromBackpack(): boolean {
    if (this.carriedLog) return false;

    // Lấy nhanh khúc gỗ đầu tiên theo thứ tự từ ô 1 tới ô 9
    const firstIndex = this.backpackSlots.findIndex((slot) => slot !== null && slot.kind === 'wood');
    if (firstIndex === -1) {
      return false;
    }
    return this.retrieveLogFromBackpackSlot(firstIndex);
  }

  detachCarriedLog(): { group: THREE.Group; length: number; radius: number } | null {
    const log = this.carriedLog;
    if (!log) return null;

    this.carriedLog = null;
    this.fallingLogs.delete(log);
    this.detachedLogs.delete(log);
    for (const mesh of log.hitMeshes) {
      delete mesh.userData.detachedLog;
    }

    return {
      group: log.group,
      length: log.length,
      radius: log.trunkRadius,
    };
  }

  popFallenLogInZone(bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  }): { group: THREE.Group; length: number; radius: number } | null {
    for (const log of this.detachedLogs) {
      if (log.state !== 'fallen') continue;
      const midX = (log.x + log.tipX) * 0.5;
      const midY = (log.y + log.tipY) * 0.5;
      const midZ = (log.z + log.tipZ) * 0.5;

      const baseInside =
        log.x >= bounds.minX &&
        log.x <= bounds.maxX &&
        log.y >= bounds.minY &&
        log.y <= bounds.maxY &&
        log.z >= bounds.minZ &&
        log.z <= bounds.maxZ;
      const midInside =
        midX >= bounds.minX &&
        midX <= bounds.maxX &&
        midY >= bounds.minY &&
        midY <= bounds.maxY &&
        midZ >= bounds.minZ &&
        midZ <= bounds.maxZ;

      if (baseInside || midInside) {
        this.detachedLogs.delete(log);
        this.fallingLogs.delete(log);
        for (const mesh of log.hitMeshes) {
          delete mesh.userData.detachedLog;
        }
        return {
          group: log.group,
          length: log.length,
          radius: log.trunkRadius,
        };
      }
    }
    return null;
  }

  generateTreesForChunk(cx: number, cz: number, chunkKey: string): void {
    if (this.chunkTrees.has(chunkKey)) return;

    const trees: InteractiveTree[] = [];
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    const step = 4;
    for (let gz = 0; gz < CHUNK_SIZE; gz += step) {
      for (let gx = 0; gx < CHUNK_SIZE; gx += step) {
        const cellX = baseX + gx;
        const cellZ = baseZ + gz;
        const chance = seededRand(cellX, cellZ, this.seed + 307);
        if (chance < 0.62) continue;

        const rx = seededRand(cellX + 11, cellZ + 3, this.seed + 509);
        const rz = seededRand(cellX + 29, cellZ + 17, this.seed + 719);
        const wx = cellX + 0.9 + rx * (step - 1.8);
        const wz = cellZ + 0.9 + rz * (step - 1.8);

        if (!this.outside.isTreeAllowedAt(wx, wz)) continue;

        const baseY = this.outside.getHeightAt(wx, wz);
        const hRand = seededRand(cellX + 43, cellZ + 61, this.seed + 911);
        const sRand = seededRand(cellX + 59, cellZ + 97, this.seed + 1123);
        const trunkHeight = 4.3 + hRand * 3.1;
        const trunkRadius = 0.29 + sRand * 0.16;
        const canopyScale = 0.88 + sRand * 0.48;
        const canopyRotation = seededRand(cellX + 71, cellZ + 83, this.seed + 1013) * Math.PI * 2;
        const variantSeed = Math.floor(seededRand(cellX + 19, cellZ + 53, this.seed + 1451) * 100000);

        const branchCount = 3 + Math.floor(seededRand(cellX + 5, cellZ + 89, this.seed + 1601) * 4);
        const branches: TreeBranchSpec[] = [];
        const baseBranchYaw = canopyRotation + 0.5;

        for (let b = 0; b < branchCount; b++) {
          const bRand = (k: number) =>
            seededRand(variantSeed + b * 23 + k * 7, b * 41 + k * 13, this.seed + 1777);
          const heightFrac = 0.36 + (b / Math.max(1, branchCount)) * 0.52 + bRand(1) * 0.08;
          branches.push({
            localY: THREE.MathUtils.clamp(trunkHeight * heightFrac, 1.55, trunkHeight - 0.45),
            yaw: baseBranchYaw + b * 2.39996 + (bRand(2) - 0.5) * 0.75,
            tilt: 0.58 + bRand(3) * 0.58,
            lengthScale: 0.75 + bRand(4) * 0.82,
            radiusScale: 0.46 + bRand(5) * 0.24,
            twigOffset: 0.4 + bRand(6) * 0.26,
            twigYaw: (bRand(7) - 0.5) * 2.2,
            hasLeaves: bRand(8) > 0.22,
            leafScale: 0.78 + bRand(9) * 0.58,
            leafVariant: (Math.floor(bRand(10) * 3) % 3) as 0 | 1 | 2,
          });
        }

        const standingGroup = new THREE.Group();
        standingGroup.position.set(wx, baseY, wz);

        const trunkMesh = new THREE.Mesh(this.unitCylinderGeo, this.trunkMaterials);
        trunkMesh.position.set(0, -EMBED_DEPTH, 0);
        trunkMesh.scale.set(trunkRadius, trunkHeight + EMBED_DEPTH, trunkRadius);
        trunkMesh.castShadow = true;
        trunkMesh.receiveShadow = true;
        standingGroup.add(trunkMesh);

        const rootMesh = new THREE.Mesh(this.rootFlareGeo, this.barkMaterial);
        rootMesh.position.set(0, -0.14, 0);
        rootMesh.scale.set(trunkRadius, 0.95, trunkRadius);
        rootMesh.rotation.y = canopyRotation;
        rootMesh.castShadow = true;
        rootMesh.receiveShadow = true;
        standingGroup.add(rootMesh);

        const trunkBranchGroup = new THREE.Group();
        for (const spec of branches) {
          trunkBranchGroup.add(this.buildBranchMeshGroup(spec, trunkRadius, 0));
        }
        standingGroup.add(trunkBranchGroup);

        const canopyGroup = this.createCanopyGroup(canopyScale, canopyRotation, variantSeed);
        canopyGroup.position.set(0, trunkHeight - 0.12, 0);
        standingGroup.add(canopyGroup);

        this.scene.add(standingGroup);

        const tree: InteractiveTree = {
          id: `${chunkKey}:${gx},${gz}`,
          chunkKey,
          x: wx,
          z: wz,
          baseY,
          trunkHeight,
          remainingHeight: trunkHeight,
          trunkRadius,
          canopyScale,
          canopyRotation,
          variantSeed,
          hasCanopy: true,
          state: 'standing',
          branches,
          standingGroup,
          trunkHitMesh: trunkMesh,
          trunkBranchGroup,
          canopyGroup,
        };

        trunkMesh.userData.tree = tree;
        trees.push(tree);
      }
    }

    this.chunkTrees.set(chunkKey, trees);
  }

  removeTreesForChunk(chunkKey: string): void {
    const trees = this.chunkTrees.get(chunkKey);
    if (trees) {
      for (const tree of trees) {
        if (tree.standingGroup) {
          this.scene.remove(tree.standingGroup);
          tree.standingGroup = null;
          tree.trunkHitMesh = null;
          tree.trunkBranchGroup = null;
          tree.canopyGroup = null;
        }
      }
      this.chunkTrees.delete(chunkKey);
    }

    for (const log of Array.from(this.detachedLogs)) {
      if (log.state === 'fallen' && log.chunkKey === chunkKey) {
        this.scene.remove(log.group);
        this.detachedLogs.delete(log);
      }
    }
  }

  private normalizeCutLocalY(tree: InteractiveTree, rawLocalY: number): number {
    // Nếu đoạn thân còn lại ngắn hoặc người chơi nhắm sát chân thân -> cắt tận gốc (0) để lấy hết thân cây
    if (tree.remainingHeight <= 0.55 || rawLocalY <= 0.28) {
      return 0;
    }
    return THREE.MathUtils.clamp(rawLocalY, 0.28, tree.remainingHeight - 0.18);
  }

  raycastTrunk(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.0,
  ): { tree: InteractiveTree; point: THREE.Vector3; cutLocalY: number } | null {
    const pcx = Math.floor(origin.x / CHUNK_SIZE);
    const pcz = Math.floor(origin.z / CHUNK_SIZE);

    this.tempRayHitCheck.length = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.chunkTrees.get(`${pcx + dx},${pcz + dz}`);
        if (!list) continue;
        for (const tree of list) {
          if (tree.state === 'standing' && tree.trunkHitMesh && tree.remainingHeight > 0.05) {
            this.tempRayHitCheck.push(tree.trunkHitMesh);
          }
        }
      }
    }

    if (this.tempRayHitCheck.length === 0) return null;

    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;

    const hits = this.raycaster.intersectObjects(this.tempRayHitCheck, false);
    if (hits.length === 0) return null;

    const first = hits[0];
    const tree = first.object.userData.tree as InteractiveTree | undefined;
    if (!tree || tree.state !== 'standing') return null;

    const cutLocalY = this.normalizeCutLocalY(tree, first.point.y - tree.baseY);

    return {
      tree,
      point: first.point,
      cutLocalY,
    };
  }

  raycastDetachedLog(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.0,
  ): { log: DetachedLog; point: THREE.Vector3 } | null {
    if (this.carriedLog || this.detachedLogs.size === 0) return null;

    this.tempRayHitCheck.length = 0;
    for (const log of this.detachedLogs) {
      if (log.state === 'carried') continue;
      for (const mesh of log.hitMeshes) {
        this.tempRayHitCheck.push(mesh);
      }
    }

    if (this.tempRayHitCheck.length === 0) return null;

    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;

    const hits = this.raycaster.intersectObjects(this.tempRayHitCheck, false);
    if (hits.length === 0) return null;

    const first = hits[0];
    const log = first.object.userData.detachedLog as DetachedLog | undefined;
    if (!log || log.state === 'carried') return null;

    return {
      log,
      point: first.point,
    };
  }

  private computeGroundRestAngle(
    baseX: number,
    baseZ: number,
    baseY: number,
    dirX: number,
    dirZ: number,
    length: number,
    radius: number,
  ): number {
    const tipX = baseX + dirX * length;
    const tipZ = baseZ + dirZ * length;
    const tipGroundY = this.outside.getHeightAt(tipX, tipZ) + radius;
    return THREE.MathUtils.clamp(
      Math.PI / 2 - Math.atan2(tipGroundY - baseY, Math.max(0.5, length)),
      Math.PI * 0.32,
      Math.PI * 0.65,
    );
  }

  private syncLogTip(log: DetachedLog, angle: number): void {
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);
    const dirX = -log.fallAxis.z * sinA;
    const dirY = cosA;
    const dirZ = log.fallAxis.x * sinA;
    log.tipX = log.x + dirX * log.length;
    log.tipY = log.y + dirY * log.length;
    log.tipZ = log.z + dirZ * log.length;
  }

  cutTreeAt(
    tree: InteractiveTree,
    cutLocalY: number,
    playerX: number,
    playerZ: number,
  ): boolean {
    if (tree.state !== 'standing' || tree.remainingHeight <= 0.05) return false;

    const actualCut = this.normalizeCutLocalY(tree, cutLocalY);
    const upperHeight = tree.remainingHeight - actualCut;
    if (upperHeight <= 0.05) return false;

    const includeCanopy = tree.hasCanopy;
    const remainingBranches: TreeBranchSpec[] = [];
    const fallenBranches: TreeBranchSpec[] = [];
    for (const b of tree.branches) {
      if (b.localY >= actualCut - 0.08) {
        fallenBranches.push(b);
      } else {
        remainingBranches.push(b);
      }
    }
    tree.branches = remainingBranches;

    // 1. Cập nhật phần thân còn lại (hoặc xóa sạch nếu cắt tận chân thân)
    if (actualCut <= 0) {
      if (tree.standingGroup) {
        this.scene.remove(tree.standingGroup);
        tree.standingGroup = null;
        tree.trunkHitMesh = null;
        tree.trunkBranchGroup = null;
        tree.canopyGroup = null;
      }
      tree.remainingHeight = 0;
      tree.hasCanopy = false;
      tree.state = 'fallen';
    } else {
      if (tree.standingGroup && tree.canopyGroup) {
        tree.standingGroup.remove(tree.canopyGroup);
        tree.canopyGroup = null;
      }
      if (tree.standingGroup && tree.trunkBranchGroup) {
        tree.standingGroup.remove(tree.trunkBranchGroup);
        const keptGroup = new THREE.Group();
        for (const b of remainingBranches) {
          keptGroup.add(this.buildBranchMeshGroup(b, tree.trunkRadius, 0));
        }
        tree.trunkBranchGroup = keptGroup;
        tree.standingGroup.add(keptGroup);
      }
      tree.hasCanopy = false;
      tree.remainingHeight = actualCut;
      if (tree.trunkHitMesh) {
        tree.trunkHitMesh.scale.set(
          tree.trunkRadius,
          actualCut + EMBED_DEPTH,
          tree.trunkRadius,
        );
      }
    }

    // 2. Tách rời đoạn thân phía trên (kèm nhánh & tán lá nếu là lần chặt phần ngọn) cho đổ và rớt đất
    const logRadius = tree.trunkRadius * 0.94;
    const group = new THREE.Group();
    const hitMeshes: THREE.Object3D[] = [];

    const upperTrunk = new THREE.Mesh(this.unitCylinderGeo, this.trunkMaterials);
    upperTrunk.scale.set(logRadius, upperHeight, logRadius);
    upperTrunk.castShadow = true;
    upperTrunk.receiveShadow = true;
    group.add(upperTrunk);
    hitMeshes.push(upperTrunk);

    for (const b of fallenBranches) {
      const branchObj = this.buildBranchMeshGroup(
        { ...b, localY: Math.max(actualCut + 0.14, b.localY) },
        logRadius,
        actualCut,
      );
      group.add(branchObj);
      branchObj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          hitMeshes.push(child);
        }
      });
    }

    if (includeCanopy) {
      const canopy = this.createCanopyGroup(tree.canopyScale, tree.canopyRotation, tree.variantSeed);
      canopy.position.set(0, upperHeight - 0.12, 0);
      group.add(canopy);
      canopy.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          hitMeshes.push(child);
        }
      });
    }

    let dx = playerX - tree.x;
    let dz = playerZ - tree.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) {
      dx = 0;
      dz = 1;
    } else {
      dx /= dist;
      dz /= dist;
    }

    const separateDist = actualCut > 0 ? Math.max(0.45, tree.trunkRadius * 1.45) : 0.12;
    const targetX = tree.x + dx * separateDist;
    const targetZ = tree.z + dz * separateDist;
    const targetY = this.outside.getHeightAt(targetX, targetZ) + logRadius;
    const targetAngle = this.computeGroundRestAngle(
      targetX,
      targetZ,
      targetY,
      dx,
      dz,
      upperHeight,
      logRadius,
    );

    const startY = tree.baseY + actualCut + (actualCut <= 0 ? logRadius : 0);
    const duration = THREE.MathUtils.clamp(upperHeight * 0.25 + 0.35, 0.5, FALL_DURATION);

    this.cutCounter++;
    const log: DetachedLog = {
      id: `${tree.id}:log:${this.cutCounter}`,
      chunkKey: tree.chunkKey,
      group,
      hitMeshes,
      x: tree.x,
      y: startY,
      z: tree.z,
      startX: tree.x,
      startY,
      startZ: tree.z,
      targetX,
      targetY,
      targetZ,
      tipX: tree.x,
      tipY: startY + upperHeight,
      tipZ: tree.z,
      trunkRadius: logRadius,
      length: upperHeight,
      hasCanopy: includeCanopy,
      state: 'falling',
      fallAxis: new THREE.Vector3(dz, 0, -dx).normalize(),
      startAngle: 0,
      targetAngle,
      fallElapsed: 0,
      fallDuration: duration,
    };

    for (const mesh of hitMeshes) {
      mesh.userData.detachedLog = log;
    }

    group.position.set(log.x, log.y, log.z);
    this.syncLogTip(log, 0);
    this.scene.add(group);
    this.detachedLogs.add(log);
    this.fallingLogs.add(log);

    return true;
  }

  pickUpLog(log: DetachedLog): boolean {
    if (this.carriedLog || log.state === 'carried') return false;

    this.fallingLogs.delete(log);
    log.state = 'carried';
    log.group.scale.set(0.52, 0.52, 0.52);
    this.carriedLog = log;
    return true;
  }

  placeCarriedLog(
    placeX: number,
    placeZ: number,
    dirX: number,
    dirZ: number,
  ): boolean {
    const log = this.carriedLog;
    if (!log) return false;

    this.carriedLog = null;
    log.group.scale.set(1, 1, 1);

    let dx = dirX;
    let dz = dirZ;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) {
      dx = 0;
      dz = -1;
    } else {
      dx /= len;
      dz /= len;
    }

    const groundBase = this.outside.getHeightAt(placeX, placeZ) + log.trunkRadius;
    const targetAngle = this.computeGroundRestAngle(
      placeX,
      placeZ,
      groundBase,
      dx,
      dz,
      log.length,
      log.trunkRadius,
    );

    // Đặt xuống trong tư thế nằm ngang luôn (rơi nhẹ xuống mặt đất, không dựng đứng)
    log.startX = placeX;
    log.startY = groundBase + 0.35;
    log.startZ = placeZ;
    log.targetX = placeX;
    log.targetY = groundBase;
    log.targetZ = placeZ;
    log.x = log.startX;
    log.y = log.startY;
    log.z = log.startZ;
    log.fallAxis.set(dz, 0, -dx).normalize();
    log.startAngle = targetAngle;
    log.targetAngle = targetAngle;
    log.fallElapsed = 0;
    log.fallDuration = PLACE_DROP_DURATION;
    log.state = 'falling';
    log.chunkKey = `${Math.floor(placeX / CHUNK_SIZE)},${Math.floor(placeZ / CHUNK_SIZE)}`;

    log.group.position.set(log.x, log.y, log.z);
    log.group.setRotationFromAxisAngle(log.fallAxis, targetAngle);
    this.syncLogTip(log, targetAngle);
    this.fallingLogs.add(log);

    return true;
  }

  updateCarried(camera: THREE.Camera): void {
    const log = this.carriedLog;
    if (!log) return;

    this.tempCarryWorldPos
      .copy(this.carryLocalOffset)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);
    log.group.position.copy(this.tempCarryWorldPos);
    log.group.quaternion.copy(camera.quaternion).multiply(this.carryLocalQuat);
  }

  update(dt: number, onTreeLanded?: () => void): void {
    if (this.fallingLogs.size === 0) return;

    for (const log of Array.from(this.fallingLogs)) {
      log.fallElapsed += dt;
      const t = Math.min(1, log.fallElapsed / log.fallDuration);
      const rotEase = t * t;
      const dropEase = t * t;
      const sepEase = 1 - (1 - t) * (1 - t);

      log.x = log.startX + (log.targetX - log.startX) * sepEase;
      log.y = log.startY + (log.targetY - log.startY) * dropEase;
      log.z = log.startZ + (log.targetZ - log.startZ) * sepEase;

      const angle = log.startAngle + (log.targetAngle - log.startAngle) * rotEase;
      log.group.position.set(log.x, log.y, log.z);
      log.group.setRotationFromAxisAngle(log.fallAxis, angle);
      this.syncLogTip(log, angle);

      if (t >= 1) {
        log.state = 'fallen';
        log.chunkKey = `${Math.floor(log.x / CHUNK_SIZE)},${Math.floor(log.z / CHUNK_SIZE)}`;
        this.fallingLogs.delete(log);
        onTreeLanded?.();
      }
    }
  }

  private getLogHorizontalDistSq(
    log: DetachedLog,
    px: number,
    pz: number,
  ): { distSq: number; cy: number } {
    const segDx = log.tipX - log.x;
    const segDz = log.tipZ - log.z;
    const segLenSq = segDx * segDx + segDz * segDz;
    const s =
      segLenSq > 1e-5
        ? Math.max(0, Math.min(1, ((px - log.x) * segDx + (pz - log.z) * segDz) / segLenSq))
        : 0;
    const cx = log.x + segDx * s;
    const cy = log.y + (log.tipY - log.y) * s;
    const cz = log.z + segDz * s;
    const dx = px - cx;
    const dz = pz - cz;
    return { distSq: dx * dx + dz * dz, cy };
  }

  getTreeObstacleTopY(
    px: number,
    py: number,
    pz: number,
    playerHalfWidth: number,
    playerHeight = 1.75,
    prevX?: number,
    prevZ?: number,
  ): number | null {
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    let highestTop: number | null = null;

    // 1. Va chạm thân cây đứng và gốc cây còn lại
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.chunkTrees.get(`${pcx + dx},${pcz + dz}`);
        if (!list) continue;
        for (const tree of list) {
          if (tree.state !== 'standing' || tree.remainingHeight <= 0.05) continue;
          const topY = tree.baseY + tree.remainingHeight;
          if (py >= topY - 0.02 || py + playerHeight <= tree.baseY) continue;

          const minDist = tree.trunkRadius + playerHalfWidth;
          const distX = px - tree.x;
          const distZ = pz - tree.z;
          if (distX * distX + distZ * distZ < minDist * minDist) {
            if (highestTop === null || topY > highestTop) {
              highestTop = topY;
            }
          }
        }
      }
    }

    // 2. Va chạm các khúc gỗ nằm trên đất / đang rơi xuống đất
    for (const log of this.detachedLogs) {
      if (log.state === 'carried') continue;

      const r = log.trunkRadius;
      const minDist = r + playerHalfWidth;
      const minDistSq = minDist * minDist;
      const { distSq, cy } = this.getLogHorizontalDistSq(log, px, pz);
      if (distSq >= minDistSq) continue;

      const topY = cy + r;
      const bottomY = cy - r;
      if (py >= topY - 0.02 || py + playerHeight <= bottomY) continue;

      // Nếu người chơi vừa bị cây đổ trúng chân và đang bước ra xa khỏi khúc gỗ thì không kẹt
      if (prevX !== undefined && prevZ !== undefined) {
        const prev = this.getLogHorizontalDistSq(log, prevX, prevZ);
        if (prev.distSq < minDistSq && distSq > prev.distSq) {
          continue;
        }
      }

      if (highestTop === null || topY > highestTop) {
        highestTop = topY;
      }
    }

    return highestTop;
  }

  disposeAll(): void {
    for (const key of Array.from(this.chunkTrees.keys())) {
      this.removeTreesForChunk(key);
    }
    for (const log of this.detachedLogs) {
      this.scene.remove(log.group);
    }
    this.detachedLogs.clear();
    this.fallingLogs.clear();
    this.backpackSlots.fill(null);
    this.backpackSnapshot = Array.from({ length: BACKPACK_CAPACITY }, () => null);
    this.carriedLog = null;
    this.unitCylinderGeo.dispose();
    this.rootFlareGeo.dispose();
    this.branchGeo.dispose();
    this.twigGeo.dispose();
    this.leafTuftGeo.dispose();
    this.canopyMainGeo.dispose();
    this.canopyTopGeo.dispose();
    this.canopyAccentGeo.dispose();
    this.barkMaterial.dispose();
    this.heartwoodMaterial.dispose();
    this.canopyMaterialDark.dispose();
    this.canopyMaterialMid.dispose();
    this.canopyMaterialLight.dispose();
    this.barkTexture.dispose();
    this.heartwoodTexture.dispose();
    this.leafTextureDark.dispose();
    this.leafTextureMid.dispose();
    this.leafTextureLight.dispose();
  }
}
