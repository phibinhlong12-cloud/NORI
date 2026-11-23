import * as THREE from 'three';
import { BLOCK_COLORS, BlockId, CHUNK_SIZE } from './constants';
import { VND_PER_BLOCK } from './counter';
import { OutsideGenerator } from './outside';

export type TreeState = 'standing' | 'fallen';
export type DetachedLogState = 'falling' | 'fallen' | 'carried';

export const BACKPACK_CAPACITY = 9;

export interface BackpackItem {
  id: string;
  length: number;
  hasCanopy: boolean;
  valueVnd: number;
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
  hasCanopy: boolean;
  state: TreeState;
  standingGroup: THREE.Group | null;
  trunkHitMesh: THREE.Mesh | null;
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

  private readonly trunkMaterial: THREE.MeshLambertMaterial;
  private readonly canopyMaterialDark: THREE.MeshLambertMaterial;
  private readonly canopyMaterialLight: THREE.MeshLambertMaterial;

  // Dùng chung geometry đơn vị (height = 1, radius = 1) để tiết kiệm bộ nhớ GPU
  private readonly unitCylinderGeo: THREE.CylinderGeometry;
  private readonly canopyMainGeo: THREE.IcosahedronGeometry;
  private readonly canopyTopGeo: THREE.IcosahedronGeometry;

  private readonly chunkTrees = new Map<string, InteractiveTree[]>();
  private readonly detachedLogs = new Set<DetachedLog>();
  private readonly fallingLogs = new Set<DetachedLog>();
  private readonly backpackSlots: Array<DetachedLog | null> = Array.from(
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

  constructor(scene: THREE.Scene, outside: OutsideGenerator, seed: number) {
    this.scene = scene;
    this.outside = outside;
    this.seed = seed;

    this.trunkMaterial = new THREE.MeshLambertMaterial({
      color: BLOCK_COLORS[BlockId.WOOD],
    });
    this.canopyMaterialDark = new THREE.MeshLambertMaterial({
      color: BLOCK_COLORS[BlockId.LEAVES],
    });
    this.canopyMaterialLight = new THREE.MeshLambertMaterial({
      color: '#48962c',
    });

    // Cylinder cao 1 (tâm tại y = 0.5 để scale theo chiều cao dễ dàng)
    this.unitCylinderGeo = new THREE.CylinderGeometry(0.88, 1.0, 1.0, 8);
    this.unitCylinderGeo.translate(0, 0.5, 0);

    this.canopyMainGeo = new THREE.IcosahedronGeometry(1.65, 1);
    this.canopyTopGeo = new THREE.IcosahedronGeometry(1.18, 1);
  }

  private createCanopyGroup(scale: number): THREE.Group {
    const group = new THREE.Group();

    const mainCrown = new THREE.Mesh(this.canopyMainGeo, this.canopyMaterialDark);
    mainCrown.position.set(0, 0.55 * scale, 0);
    mainCrown.scale.set(scale, 0.85 * scale, scale);
    group.add(mainCrown);

    const upperCrown = new THREE.Mesh(this.canopyTopGeo, this.canopyMaterialLight);
    upperCrown.position.set(0.15 * scale, 1.55 * scale, -0.1 * scale);
    upperCrown.scale.set(scale, 0.9 * scale, scale);
    group.add(upperCrown);

    const sideCrown = new THREE.Mesh(this.canopyTopGeo, this.canopyMaterialDark);
    sideCrown.position.set(-0.65 * scale, 0.35 * scale, 0.45 * scale);
    sideCrown.scale.set(0.75 * scale, 0.72 * scale, 0.75 * scale);
    group.add(sideCrown);

    return group;
  }

  isCarryingLog(): boolean {
    return this.carriedLog !== null;
  }

  getCarriedLogLength(): number | null {
    return this.carriedLog ? this.carriedLog.length : null;
  }

  private rebuildBackpackSnapshot(): void {
    this.backpackSnapshot = this.backpackSlots.map((log) =>
      log
        ? {
            id: log.id,
            length: log.length,
            hasCanopy: log.hasCanopy,
            valueVnd: Math.max(10, Math.round(log.length * VND_PER_BLOCK)),
          }
        : null,
    );
  }

  getBackpackItems(): Array<BackpackItem | null> {
    return this.backpackSnapshot;
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
    this.backpackSlots[emptyIndex] = log;
    this.rebuildBackpackSnapshot();
    return true;
  }

  retrieveLogFromBackpackSlot(slotIndex: number): boolean {
    if (this.carriedLog || slotIndex < 0 || slotIndex >= BACKPACK_CAPACITY) {
      return false;
    }

    const log = this.backpackSlots[slotIndex];
    if (!log) return false;

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

    // Lấy nhanh theo thứ tự từ ô 1 tới ô 9
    const firstIndex = this.backpackSlots.findIndex((slot) => slot !== null);
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
        const trunkHeight = 4.6 + hRand * 2.2;
        const trunkRadius = 0.33 + hRand * 0.1;
        const canopyScale = 0.95 + hRand * 0.35;

        const standingGroup = new THREE.Group();
        standingGroup.position.set(wx, baseY, wz);

        const trunkMesh = new THREE.Mesh(this.unitCylinderGeo, this.trunkMaterial);
        trunkMesh.position.set(0, -EMBED_DEPTH, 0);
        trunkMesh.scale.set(trunkRadius, trunkHeight + EMBED_DEPTH, trunkRadius);
        standingGroup.add(trunkMesh);

        const canopyGroup = this.createCanopyGroup(canopyScale);
        canopyGroup.position.set(0, trunkHeight - 0.1, 0);
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
          hasCanopy: true,
          state: 'standing',
          standingGroup,
          trunkHitMesh: trunkMesh,
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

    // 1. Cập nhật phần thân còn lại (hoặc xóa sạch nếu cắt tận chân thân)
    if (actualCut <= 0) {
      if (tree.standingGroup) {
        this.scene.remove(tree.standingGroup);
        tree.standingGroup = null;
        tree.trunkHitMesh = null;
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

    // 2. Tách rời đoạn thân phía trên (kèm tán lá nếu là lần chặt phần ngọn) cho đổ và rớt đất
    const logRadius = tree.trunkRadius * 0.94;
    const group = new THREE.Group();
    const hitMeshes: THREE.Object3D[] = [];

    const upperTrunk = new THREE.Mesh(this.unitCylinderGeo, this.trunkMaterial);
    upperTrunk.scale.set(logRadius, upperHeight, logRadius);
    group.add(upperTrunk);
    hitMeshes.push(upperTrunk);

    if (includeCanopy) {
      const canopy = this.createCanopyGroup(tree.canopyScale);
      canopy.position.set(0, upperHeight - 0.1, 0);
      group.add(canopy);
      for (const child of canopy.children) {
        hitMeshes.push(child);
      }
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
    this.canopyMainGeo.dispose();
    this.canopyTopGeo.dispose();
    this.trunkMaterial.dispose();
    this.canopyMaterialDark.dispose();
    this.canopyMaterialLight.dispose();
  }
}
