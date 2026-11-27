import * as THREE from 'three';
import { applyCitadelToChunk } from './citadel';
import { CitadelStructure } from './citadelMesh';
import { BlockId, CHUNK_HEIGHT, CHUNK_SIZE } from './constants';
import { CashierStation } from './counter';
import { CraftingStation } from './crafting';
import {
  DragonAttackResult,
  DragonBossHudState,
  DragonBossManager,
  DragonUpdateCallbacks,
} from './dragon';
import { MonsterDropCallbacks, MonsterDropKind, MonsterDropManager } from './drops';
import { GrassManager } from './grass';
import {
  MushroomAttackResult,
  MushroomEntity,
  MushroomUpdateCallbacks,
  PoisonMushroomManager,
} from './mushroom';
import { OutsideGenerator } from './outside';
import { CharacterGender } from './firstPersonArms';
import { OutfitShop } from './outfitShop';
import {
  SlimeAttackResult,
  SlimeEntity,
  SlimeManager,
  SlimeUpdateCallbacks,
} from './slime';
import { BlockRgbTable, createBlockRgbTable } from './textures';
import {
  BackpackItem,
  BackpackKatanaVariant,
  DetachedLog,
  InteractiveTree,
  TreeManager,
} from './trees';
import { ShopItemId, WeaponShop } from './weaponShop';

export interface Chunk {
  cx: number;
  cz: number;
  key: string;
  data: Uint8Array;
  solidMesh: THREE.Mesh | null;
  groundMesh: THREE.Mesh | null;
  hasVoxelStructures: boolean;
  minSolidY: number;
  maxSolidY: number;
  modified?: boolean;
}

const LAYER_STRIDE = CHUNK_SIZE * CHUNK_SIZE;

interface MeshBuffers {
  pos: number[];
  norm: number[];
  color: number[];
  indices: number[];
}

function createEmptyBuffers(): MeshBuffers {
  return {
    pos: [],
    norm: [],
    color: [],
    indices: [],
  };
}

export class WorldManager {
  private readonly scene: THREE.Scene;
  private readonly solidMaterial: THREE.Material;
  private readonly blockRgb: BlockRgbTable;
  private readonly greedyMask = new Int16Array(CHUNK_SIZE * CHUNK_HEIGHT);
  private readonly outside: OutsideGenerator;
  private readonly maxAnisotropy: number;
  private trees: TreeManager;
  private grass: GrassManager;
  private citadelMesh: CitadelStructure;
  private cashier: CashierStation;
  private weaponShop: WeaponShop;
  private outfitShop: OutfitShop;
  private craftingStation: CraftingStation;
  private slimes: SlimeManager;
  private mushrooms: PoisonMushroomManager;
  private dragon: DragonBossManager;
  private monsterDrops: MonsterDropManager;

  readonly chunks = new Map<string, Chunk>();
  readonly dirtyChunks = new Set<string>();
  seed: number;

  private lastPlayerCx = Number.NaN;
  private lastPlayerCz = Number.NaN;
  private lastRenderDistance = -1;
  private pendingCoords: Array<{ cx: number; cz: number; distSq: number }> = [];
  private displayGender: CharacterGender = 'male';

  constructor(scene: THREE.Scene, solidMaterial: THREE.Material, maxAnisotropy = 4) {
    this.scene = scene;
    this.solidMaterial = solidMaterial;
    this.maxAnisotropy = maxAnisotropy;
    this.blockRgb = createBlockRgbTable();

    this.seed = Math.floor(Math.random() * 100000) + 1;
    this.outside = new OutsideGenerator(this.seed);
    this.trees = new TreeManager(this.scene, this.outside, this.seed, this.maxAnisotropy);
    this.grass = new GrassManager(this.scene, this.outside, this.seed);
    this.citadelMesh = new CitadelStructure(this.scene, this.maxAnisotropy);
    this.cashier = new CashierStation(this.scene);
    this.weaponShop = new WeaponShop(this.scene);
    this.outfitShop = new OutfitShop(this.scene, this.maxAnisotropy, this.displayGender);
    this.craftingStation = new CraftingStation(this.scene, this.maxAnisotropy);
    this.slimes = new SlimeManager(this.scene, this.outside, this.seed);
    this.mushrooms = new PoisonMushroomManager(this.scene, this.outside, this.seed, this.maxAnisotropy);
    this.dragon = new DragonBossManager(this.scene, this.outside, this.maxAnisotropy);
    this.monsterDrops = new MonsterDropManager(this.scene, this.outside);
  }

  setPlayerGender(gender: CharacterGender): void {
    this.displayGender = gender;
    this.outfitShop.setDisplayGender(gender);
  }

  resetSeed(newSeed: number): void {
    this.disposeAll();
    this.seed = newSeed;
    this.outside.resetSeed(newSeed);
    this.trees = new TreeManager(this.scene, this.outside, this.seed, this.maxAnisotropy);
    this.grass = new GrassManager(this.scene, this.outside, this.seed);
    this.citadelMesh = new CitadelStructure(this.scene, this.maxAnisotropy);
    this.cashier = new CashierStation(this.scene);
    this.weaponShop = new WeaponShop(this.scene);
    this.outfitShop = new OutfitShop(this.scene, this.maxAnisotropy, this.displayGender);
    this.craftingStation = new CraftingStation(this.scene, this.maxAnisotropy);
    this.slimes = new SlimeManager(this.scene, this.outside, this.seed);
    this.mushrooms = new PoisonMushroomManager(this.scene, this.outside, this.seed, this.maxAnisotropy);
    this.dragon = new DragonBossManager(this.scene, this.outside, this.maxAnisotropy);
    this.monsterDrops = new MonsterDropManager(this.scene, this.outside);
    this.lastPlayerCx = Number.NaN;
    this.lastPlayerCz = Number.NaN;
    this.pendingCoords = [];
  }

  getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  getGroundHeight(wx: number, wz: number): number {
    return this.outside.getHeightAt(wx, wz);
  }

  getMaxGroundHeightInBox(px: number, pz: number, halfWidth: number): number {
    const hCenter = this.outside.getHeightAt(px, pz);
    const h1 = this.outside.getHeightAt(px - halfWidth, pz - halfWidth);
    const h2 = this.outside.getHeightAt(px + halfWidth, pz - halfWidth);
    const h3 = this.outside.getHeightAt(px - halfWidth, pz + halfWidth);
    const h4 = this.outside.getHeightAt(px + halfWidth, pz + halfWidth);
    return Math.max(hCenter, h1, h2, h3, h4);
  }

  raycastTreeTrunk(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.0,
  ): { tree: InteractiveTree; point: THREE.Vector3; cutLocalY: number } | null {
    return this.trees.raycastTrunk(origin, direction, maxDistance);
  }

  raycastDetachedLog(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.0,
    touchTolerance = 0,
  ): { log: DetachedLog; point: THREE.Vector3 } | null {
    return this.trees.raycastDetachedLog(origin, direction, maxDistance, touchTolerance);
  }

  isCarryingLog(): boolean {
    return this.trees.isCarryingLog();
  }

  getCarriedLogLength(): number | null {
    return this.trees.getCarriedLogLength();
  }

  raycastConveyor(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.0,
  ): { point: THREE.Vector3 } | null {
    return this.cashier.raycastConveyor(origin, direction, maxDistance);
  }

  raycastShop(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.0,
  ): { point: THREE.Vector3 } | null {
    return this.weaponShop.raycastShop(origin, direction, maxDistance);
  }

  raycastOutfitShop(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.5,
  ): { point: THREE.Vector3 } | null {
    return this.outfitShop.raycastShop(origin, direction, maxDistance);
  }

  raycastCraftingStation(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.5,
  ): { point: THREE.Vector3 } | null {
    return this.craftingStation.raycastStation(origin, direction, maxDistance);
  }

  isShopItemOwned(itemId: ShopItemId): boolean {
    return this.weaponShop.isOwned(itemId);
  }

  markShopItemOwned(itemId: ShopItemId): void {
    this.weaponShop.markOwned(itemId);
  }

  getBackpackItems(): Array<BackpackItem | null> {
    return this.trees.getBackpackItems();
  }

  getBackpackSlotKind(
    slotIndex: number,
  ): 'wood' | 'potion' | 'slime_orb' | 'mushroom_item' | 'katana' | null {
    return this.trees.getSlotKind(slotIndex);
  }

  getBackpackSlotItem(slotIndex: number): BackpackItem | null {
    return this.trees.getSlotItem(slotIndex);
  }

  getPotionCountAtSlot(slotIndex: number): number {
    return this.trees.getPotionCountAtSlot(slotIndex);
  }

  addPotionToBackpack(): { added: boolean; slotIndex: number; count: number } {
    return this.trees.addPotionToBackpack();
  }

  canAddMaterialToBackpack(kind: MonsterDropKind): boolean {
    return this.trees.canAddMaterialToBackpack(kind);
  }

  addMaterialToBackpack(
    kind: MonsterDropKind,
    amount = 1,
  ): { added: boolean; slotIndex: number; count: number } {
    return this.trees.addMaterialToBackpack(kind, amount);
  }

  hasEmptyBackpackSlot(): boolean {
    return this.trees.hasEmptySlot();
  }

  addKatanaToBackpack(variant: BackpackKatanaVariant): { added: boolean; slotIndex: number } {
    return this.trees.addKatanaToBackpack(variant);
  }

  swapKatanaAtSlot(
    slotIndex: number,
    currentEquipped: BackpackKatanaVariant | null,
  ): { swapped: boolean; newVariant?: BackpackKatanaVariant } {
    return this.trees.swapKatanaAtSlot(slotIndex, currentEquipped);
  }

  deleteBackpackSlot(slotIndex: number): BackpackItem | null {
    return this.trees.deleteBackpackSlot(slotIndex);
  }

  getCraftingMaterialCounts(): {
    mushroomCount: number;
    slimeOrbCount: number;
    woodCount: number;
  } {
    return this.trees.getCraftingMaterialCounts();
  }

  consumeCraftingMaterials(req: {
    mushrooms: number;
    slimeOrbs: number;
    woods: number;
  }): boolean {
    return this.trees.consumeCraftingMaterials(req);
  }

  consumePotionFromSlot(slotIndex: number): number {
    return this.trees.consumePotionFromSlot(slotIndex);
  }

  isBackpackFull(): boolean {
    return this.trees.isBackpackFull();
  }

  storeCarriedLogToBackpack(): boolean {
    return this.trees.storeCarriedLogToBackpack();
  }

  retrieveLogFromBackpackSlot(slotIndex: number): boolean {
    return this.trees.retrieveLogFromBackpackSlot(slotIndex);
  }

  retrieveLogFromBackpack(): boolean {
    return this.trees.retrieveLogFromBackpack();
  }

  placeCarriedOnConveyor(): boolean {
    const item = this.trees.detachCarriedLog();
    if (!item) return false;
    this.cashier.acceptLog(item.group, item.length, item.radius);
    return true;
  }

  cutTree(
    tree: InteractiveTree,
    cutLocalY: number,
    playerX: number,
    playerZ: number,
  ): boolean {
    return this.trees.cutTreeAt(tree, cutLocalY, playerX, playerZ);
  }

  pickUpLog(log: DetachedLog): boolean {
    return this.trees.pickUpLog(log);
  }

  placeCarriedLog(
    placeX: number,
    placeZ: number,
    dirX: number,
    dirZ: number,
  ): boolean {
    return this.trees.placeCarriedLog(placeX, placeZ, dirX, dirZ);
  }

  updateCarried(camera: THREE.Camera): void {
    this.trees.updateCarried(camera);
  }

  raycastSlime(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 6.5,
  ): { slime: SlimeEntity; point: THREE.Vector3 } | null {
    return this.slimes.raycastSlime(origin, direction, maxDistance);
  }

  spawnMonsterDrop(kind: MonsterDropKind, x: number, y: number, z: number): void {
    this.monsterDrops.spawnDrop(kind, x, y, z);
  }

  attackSlimeWithKatana(
    cameraPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    damage = 100,
    maxRange = 3.8,
  ): SlimeAttackResult {
    return this.slimes.attackWithKatana(cameraPos, forwardDir, damage, maxRange);
  }

  raycastMushroom(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 6.5,
  ): { mushroom: MushroomEntity; point: THREE.Vector3 } | null {
    return this.mushrooms.raycastMushroom(origin, direction, maxDistance);
  }

  attackMushroomWithKatana(
    cameraPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    damage = 100,
    maxRange = 4.0,
  ): MushroomAttackResult {
    return this.mushrooms.attackWithKatana(cameraPos, forwardDir, damage, maxRange);
  }

  raycastDragon(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 8.0,
  ): { point: THREE.Vector3; hp: number; maxHp: number } | null {
    return this.dragon.raycastDragon(origin, direction, maxDistance);
  }

  raycastDroppedIceKatana(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 6.5,
  ): { point: THREE.Vector3 } | null {
    return this.dragon.raycastDroppedIceKatana(origin, direction, maxDistance);
  }

  tryCollectIceKatana(callbacks?: DragonUpdateCallbacks): boolean {
    return this.dragon.tryCollectIceKatana(callbacks);
  }

  attackDragonWithKatana(
    cameraPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    damage = 100,
    maxRange = 5.4,
    playerLevel = 1,
  ): DragonAttackResult {
    return this.dragon.attackWithKatana(cameraPos, forwardDir, damage, maxRange, playerLevel);
  }

  getBossHudState(playerX: number, playerZ: number): DragonBossHudState {
    return this.dragon.getBossHudState(playerX, playerZ);
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerYaw: number,
    shieldRaised: boolean,
    onTreeLanded?: () => void,
    onEarnMoney?: (earned: number, lengthBlocks: number) => void,
    slimeCallbacks?: SlimeUpdateCallbacks,
    dragonCallbacks?: DragonUpdateCallbacks,
    mushroomCallbacks?: MushroomUpdateCallbacks,
    hasBackpack = false,
    dropCallbacks?: MonsterDropCallbacks,
  ): void {
    this.trees.update(dt, onTreeLanded);
    this.grass.update(dt, playerX, playerZ);
    this.citadelMesh.update(dt);
    this.outfitShop.update(dt);
    this.craftingStation.update(dt);
    this.slimes.update(dt, playerX, playerY, playerZ, playerYaw, shieldRaised, slimeCallbacks);
    this.mushrooms.update(
      dt,
      playerX,
      playerY,
      playerZ,
      playerYaw,
      shieldRaised,
      mushroomCallbacks,
    );
    this.dragon.update(dt, playerX, playerY, playerZ, playerYaw, shieldRaised, dragonCallbacks);
    this.monsterDrops.update(dt, playerX, playerY, playerZ, hasBackpack, dropCallbacks);

    const bounds = this.cashier.getConveyorDropBounds();
    const droppedOnBelt = this.trees.popFallenLogInZone(bounds);
    if (droppedOnBelt) {
      this.cashier.acceptLog(droppedOnBelt.group, droppedOnBelt.length, droppedOnBelt.radius);
    }

    this.cashier.update(dt, (earned, lengthBlocks) => {
      onEarnMoney?.(earned, lengthBlocks);
    });
  }

  getTreeObstacleTopY(
    px: number,
    py: number,
    pz: number,
    halfWidth: number,
    playerHeight = 1.75,
    prevX?: number,
    prevZ?: number,
  ): number | null {
    let highest = this.trees.getTreeObstacleTopY(
      px,
      py,
      pz,
      halfWidth,
      playerHeight,
      prevX,
      prevZ,
    );
    const stationTop = this.cashier.getObstacleTopY(px, py, pz, halfWidth, playerHeight);
    if (stationTop !== null && (highest === null || stationTop > highest)) {
      highest = stationTop;
    }
    const shopTop = this.weaponShop.getObstacleTopY(px, py, pz, halfWidth, playerHeight);
    if (shopTop !== null && (highest === null || shopTop > highest)) {
      highest = shopTop;
    }
    const outfitShopTop = this.outfitShop.getObstacleTopY(px, py, pz, halfWidth, playerHeight);
    if (outfitShopTop !== null && (highest === null || outfitShopTop > highest)) {
      highest = outfitShopTop;
    }
    const craftingTop = this.craftingStation.getObstacleTopY(
      px,
      py,
      pz,
      halfWidth,
      playerHeight,
    );
    if (craftingTop !== null && (highest === null || craftingTop > highest)) {
      highest = craftingTop;
    }
    return highest;
  }

  generateChunkData(cx: number, cz: number, markNeighbors = true): Chunk {
    const key = this.getChunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);

    // 1. Dựng cấu trúc Trong Thành (tường thành 50x50x50, cổng 6x6x6, viền đá)
    const citadelInfo = applyCitadelToChunk(data, cx, cz);

    // 2. Sinh cây tương tác và thảm cỏ lú ở khu vực Ngoài Thành
    this.trees.generateTreesForChunk(cx, cz, key);
    this.grass.generateGrassForChunk(cx, cz, key);

    const chunk: Chunk = {
      cx,
      cz,
      key,
      data,
      solidMesh: null,
      groundMesh: null,
      hasVoxelStructures: citadelInfo.hasStructures,
      minSolidY: citadelInfo.minSolidY,
      maxSolidY: citadelInfo.maxSolidY,
      modified: false,
    };

    this.chunks.set(key, chunk);
    this.dirtyChunks.add(key);
    if (markNeighbors) {
      this.markNeighborChunksDirty(cx, cz, citadelInfo.hasStructures);
    }

    return chunk;
  }

  private markNeighborChunksDirty(cx: number, cz: number, currentHasStructures: boolean): void {
    const neighbors: Array<[number, number]> = [
      [cx - 1, cz],
      [cx + 1, cz],
      [cx, cz - 1],
      [cx, cz + 1],
    ];
    for (const [nx, nz] of neighbors) {
      const nKey = this.getChunkKey(nx, nz);
      const neighbor = this.chunks.get(nKey);
      if (neighbor && (currentHasStructures || neighbor.hasVoxelStructures || neighbor.modified)) {
        this.dirtyChunks.add(nKey);
      }
    }
  }

  getBlockAt(wx: number, wy: number, wz: number): BlockId {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockId.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(this.getChunkKey(cx, cz));
    if (!chunk) return BlockId.AIR;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.data[lx + lz * CHUNK_SIZE + wy * LAYER_STRIDE] as BlockId;
  }

  setBlockAt(wx: number, wy: number, wz: number, blockId: BlockId): boolean {
    if (wy <= 0 || wy >= CHUNK_HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return false;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = lx + lz * CHUNK_SIZE + wy * LAYER_STRIDE;

    if (chunk.data[idx] === blockId) return false;
    chunk.data[idx] = blockId;
    chunk.modified = true;
    chunk.minSolidY = 0;
    chunk.maxSolidY = CHUNK_HEIGHT;
    this.dirtyChunks.add(key);

    if (lx === 0) this.dirtyChunks.add(this.getChunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) this.dirtyChunks.add(this.getChunkKey(cx + 1, cz));
    if (lz === 0) this.dirtyChunks.add(this.getChunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) this.dirtyChunks.add(this.getChunkKey(cx, cz + 1));

    return true;
  }

  isSolidBlock(wx: number, wy: number, wz: number): boolean {
    const b = this.getBlockAt(wx, wy, wz);
    return b !== BlockId.AIR && b !== BlockId.WATER;
  }

  private emitGreedyQuad(
    buffers: MeshBuffers,
    dir: 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back',
    shade: number,
    nx: number,
    ny: number,
    nz: number,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    blockId: BlockId,
  ): void {
    const [baseR, baseG, baseB] = this.blockRgb[blockId];
    const r = baseR * shade;
    const g = baseG * shade;
    const b = baseB * shade;

    const vertStart = buffers.pos.length / 3;

    switch (dir) {
      case 'top': {
        const py = y + 1;
        buffers.pos.push(
          x, py, z + h,
          x + w, py, z + h,
          x + w, py, z,
          x, py, z,
        );
        break;
      }
      case 'bottom': {
        buffers.pos.push(
          x, y, z,
          x + w, y, z,
          x + w, y, z + h,
          x, y, z + h,
        );
        break;
      }
      case 'left': {
        buffers.pos.push(
          x, y, z,
          x, y, z + w,
          x, y + h, z + w,
          x, y + h, z,
        );
        break;
      }
      case 'right': {
        const px = x + 1;
        buffers.pos.push(
          px, y, z + w,
          px, y, z,
          px, y + h, z,
          px, y + h, z + w,
        );
        break;
      }
      case 'front': {
        const pz = z + 1;
        buffers.pos.push(
          x, y, pz,
          x + w, y, pz,
          x + w, y + h, pz,
          x, y + h, pz,
        );
        break;
      }
      case 'back': {
        buffers.pos.push(
          x + w, y, z,
          x, y, z,
          x, y + h, z,
          x + w, y + h, z,
        );
        break;
      }
    }

    for (let i = 0; i < 4; i++) {
      buffers.norm.push(nx, ny, nz);
      buffers.color.push(r, g, b);
    }

    buffers.indices.push(
      vertStart,
      vertStart + 1,
      vertStart + 2,
      vertStart,
      vertStart + 2,
      vertStart + 3,
    );
  }

  private buildMeshFromBuffers(buffers: MeshBuffers, material: THREE.Material): THREE.Mesh | null {
    if (buffers.pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buffers.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.norm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(buffers.color, 3));
    geo.setIndex(buffers.indices);
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.scene.add(mesh);
    return mesh;
  }

  buildChunkMesh(chunk: Chunk): void {
    // 1. Mặt đất parabol/phẳng liên tục (không cạnh 90 độ), chỉ tạo 1 lần mỗi chunk
    if (!chunk.groundMesh) {
      chunk.groundMesh = this.outside.buildChunkGroundMesh(chunk.cx, chunk.cz, this.solidMaterial);
      this.scene.add(chunk.groundMesh);
    }

    // 2. Xóa mesh voxel cũ (tường thành) nếu cần dựng lại
    if (chunk.solidMesh) {
      this.scene.remove(chunk.solidMesh);
      chunk.solidMesh.geometry.dispose();
      chunk.solidMesh = null;
    }

    // Mô hình 3D thành cổ 50x50x25 được dựng chi tiết bằng CitadelStructure (giữ chunk.data để xử lý va chạm & raycast)
    if (!chunk.modified) {
      return;
    }

    const data = chunk.data;
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const minBuildY = chunk.modified ? 0 : chunk.minSolidY;
    const maxBuildY = chunk.modified ? CHUNK_HEIGHT : chunk.maxSolidY;
    const heightSpan = maxBuildY - minBuildY;
    if (heightSpan <= 0) return;

    const leftData = this.chunks.get(this.getChunkKey(chunk.cx - 1, chunk.cz))?.data ?? null;
    const rightData = this.chunks.get(this.getChunkKey(chunk.cx + 1, chunk.cz))?.data ?? null;
    const backData = this.chunks.get(this.getChunkKey(chunk.cx, chunk.cz - 1))?.data ?? null;
    const frontData = this.chunks.get(this.getChunkKey(chunk.cx, chunk.cz + 1))?.data ?? null;

    const solid = createEmptyBuffers();
    const mask = this.greedyMask;

    const shouldRender = (blockId: BlockId, neighbor: BlockId): boolean => {
      return blockId !== BlockId.AIR && neighbor === BlockId.AIR;
    };

    const emitSlice = (
      uSize: number,
      vSize: number,
      onQuad: (u: number, v: number, w: number, h: number, blockId: BlockId) => void,
    ) => {
      for (let v = 0; v < vSize; v++) {
        for (let u = 0; u < uSize; ) {
          const val = mask[u + v * uSize];
          if (val === 0) {
            u++;
            continue;
          }
          let w = 1;
          while (u + w < uSize && mask[u + w + v * uSize] === val) {
            w++;
          }
          let h = 1;
          outer: while (v + h < vSize) {
            for (let k = 0; k < w; k++) {
              if (mask[u + k + (v + h) * uSize] !== val) {
                break outer;
              }
            }
            h++;
          }
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              mask[u + dx + (v + dy) * uSize] = 0;
            }
          }
          onQuad(u, v, w, h, val as BlockId);
          u += w;
        }
      }
    };

    // 1. Top (+Y) & Bottom (-Y)
    for (let y = minBuildY; y < maxBuildY; y++) {
      const yOffset = y * LAYER_STRIDE;
      const aboveOffset = (y + 1) * LAYER_STRIDE;

      mask.fill(0, 0, LAYER_STRIDE);
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const rowOffset = lz * CHUNK_SIZE;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const b = data[yOffset + rowOffset + lx] as BlockId;
          if (b === BlockId.AIR) continue;
          const neighbor =
            y + 1 < CHUNK_HEIGHT ? (data[aboveOffset + rowOffset + lx] as BlockId) : BlockId.AIR;
          if (shouldRender(b, neighbor)) {
            mask[lx + rowOffset] = b;
          }
        }
      }
      emitSlice(CHUNK_SIZE, CHUNK_SIZE, (u, v, w, h, b) => {
        this.emitGreedyQuad(
          solid,
          'top',
          1.0,
          0,
          1,
          0,
          baseX + u,
          y,
          baseZ + v,
          w,
          h,
          b,
        );
      });

      if (y > 0) {
        const belowOffset = (y - 1) * LAYER_STRIDE;
        mask.fill(0, 0, LAYER_STRIDE);
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const rowOffset = lz * CHUNK_SIZE;
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const b = data[yOffset + rowOffset + lx] as BlockId;
            if (b === BlockId.AIR) continue;
            const neighbor = data[belowOffset + rowOffset + lx] as BlockId;
            if (shouldRender(b, neighbor)) {
              mask[lx + rowOffset] = b;
            }
          }
        }
        emitSlice(CHUNK_SIZE, CHUNK_SIZE, (u, v, w, h, b) => {
          this.emitGreedyQuad(
            solid,
            'bottom',
            0.52,
            0,
            -1,
            0,
            baseX + u,
            y,
            baseZ + v,
            w,
            h,
            b,
          );
        });
      }
    }

    const maskXZSize = CHUNK_SIZE * heightSpan;

    // 2. Left (-X) & Right (+X)
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      mask.fill(0, 0, maskXZSize);
      for (let y = minBuildY; y < maxBuildY; y++) {
        const yOffset = y * LAYER_STRIDE;
        const mRow = (y - minBuildY) * CHUNK_SIZE;
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const b = data[yOffset + lz * CHUNK_SIZE + lx] as BlockId;
          if (b === BlockId.AIR) continue;
          const neighbor =
            lx > 0
              ? (data[yOffset + lz * CHUNK_SIZE + (lx - 1)] as BlockId)
              : leftData
                ? (leftData[yOffset + lz * CHUNK_SIZE + (CHUNK_SIZE - 1)] as BlockId)
                : BlockId.AIR;
          if (shouldRender(b, neighbor)) {
            mask[lz + mRow] = b;
          }
        }
      }
      emitSlice(CHUNK_SIZE, heightSpan, (u, v, w, h, b) => {
        this.emitGreedyQuad(
          solid,
          'left',
          0.78,
          -1,
          0,
          0,
          baseX + lx,
          v + minBuildY,
          baseZ + u,
          w,
          h,
          b,
        );
      });

      mask.fill(0, 0, maskXZSize);
      for (let y = minBuildY; y < maxBuildY; y++) {
        const yOffset = y * LAYER_STRIDE;
        const mRow = (y - minBuildY) * CHUNK_SIZE;
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const b = data[yOffset + lz * CHUNK_SIZE + lx] as BlockId;
          if (b === BlockId.AIR) continue;
          const neighbor =
            lx + 1 < CHUNK_SIZE
              ? (data[yOffset + lz * CHUNK_SIZE + (lx + 1)] as BlockId)
              : rightData
                ? (rightData[yOffset + lz * CHUNK_SIZE] as BlockId)
                : BlockId.AIR;
          if (shouldRender(b, neighbor)) {
            mask[lz + mRow] = b;
          }
        }
      }
      emitSlice(CHUNK_SIZE, heightSpan, (u, v, w, h, b) => {
        this.emitGreedyQuad(
          solid,
          'right',
          0.82,
          1,
          0,
          0,
          baseX + lx,
          v + minBuildY,
          baseZ + u,
          w,
          h,
          b,
        );
      });
    }

    // 3. Back (-Z) & Front (+Z)
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      mask.fill(0, 0, maskXZSize);
      for (let y = minBuildY; y < maxBuildY; y++) {
        const yOffset = y * LAYER_STRIDE;
        const mRow = (y - minBuildY) * CHUNK_SIZE;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const b = data[yOffset + lz * CHUNK_SIZE + lx] as BlockId;
          if (b === BlockId.AIR) continue;
          const neighbor =
            lz > 0
              ? (data[yOffset + (lz - 1) * CHUNK_SIZE + lx] as BlockId)
              : backData
                ? (backData[yOffset + (CHUNK_SIZE - 1) * CHUNK_SIZE + lx] as BlockId)
                : BlockId.AIR;
          if (shouldRender(b, neighbor)) {
            mask[lx + mRow] = b;
          }
        }
      }
      emitSlice(CHUNK_SIZE, heightSpan, (u, v, w, h, b) => {
        this.emitGreedyQuad(
          solid,
          'back',
          0.72,
          0,
          0,
          -1,
          baseX + u,
          v + minBuildY,
          baseZ + lz,
          w,
          h,
          b,
        );
      });

      mask.fill(0, 0, maskXZSize);
      for (let y = minBuildY; y < maxBuildY; y++) {
        const yOffset = y * LAYER_STRIDE;
        const mRow = (y - minBuildY) * CHUNK_SIZE;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const b = data[yOffset + lz * CHUNK_SIZE + lx] as BlockId;
          if (b === BlockId.AIR) continue;
          const neighbor =
            lz + 1 < CHUNK_SIZE
              ? (data[yOffset + (lz + 1) * CHUNK_SIZE + lx] as BlockId)
              : frontData
                ? (frontData[yOffset + lx] as BlockId)
                : BlockId.AIR;
          if (shouldRender(b, neighbor)) {
            mask[lx + mRow] = b;
          }
        }
      }
      emitSlice(CHUNK_SIZE, heightSpan, (u, v, w, h, b) => {
        this.emitGreedyQuad(
          solid,
          'front',
          0.9,
          0,
          0,
          1,
          baseX + u,
          v + minBuildY,
          baseZ + lz,
          w,
          h,
          b,
        );
      });
    }

    chunk.solidMesh = this.buildMeshFromBuffers(solid, this.solidMaterial);
  }

  disposeChunkMeshes(chunk: Chunk): void {
    if (chunk.solidMesh) {
      this.scene.remove(chunk.solidMesh);
      chunk.solidMesh.geometry.dispose();
      chunk.solidMesh = null;
    }
    if (chunk.groundMesh) {
      this.scene.remove(chunk.groundMesh);
      chunk.groundMesh.geometry.dispose();
      chunk.groundMesh = null;
    }
  }

  prewarmAround(playerX: number, playerZ: number, renderDistance: number): void {
    const playerCx = Math.floor(playerX / CHUNK_SIZE);
    const playerCz = Math.floor(playerZ / CHUNK_SIZE);

    for (let dx = -renderDistance; dx <= renderDistance; dx++) {
      for (let dz = -renderDistance; dz <= renderDistance; dz++) {
        if (dx * dx + dz * dz <= renderDistance * renderDistance + 1) {
          this.generateChunkData(playerCx + dx, playerCz + dz, false);
        }
      }
    }

    for (const key of Array.from(this.dirtyChunks)) {
      this.dirtyChunks.delete(key);
      const chunk = this.chunks.get(key);
      if (chunk) {
        this.buildChunkMesh(chunk);
      }
    }

    this.lastPlayerCx = playerCx;
    this.lastPlayerCz = playerCz;
    this.lastRenderDistance = renderDistance;
    this.pendingCoords = [];
  }

  updateChunksAroundPlayer(playerX: number, playerZ: number, renderDistance: number): void {
    const playerCx = Math.floor(playerX / CHUNK_SIZE);
    const playerCz = Math.floor(playerZ / CHUNK_SIZE);

    const movedChunk =
      playerCx !== this.lastPlayerCx ||
      playerCz !== this.lastPlayerCz ||
      renderDistance !== this.lastRenderDistance;

    if (movedChunk) {
      this.lastPlayerCx = playerCx;
      this.lastPlayerCz = playerCz;
      this.lastRenderDistance = renderDistance;

      const unloadDistSq = (renderDistance + 2) * (renderDistance + 2);
      for (const [key, chunk] of this.chunks.entries()) {
        const dx = chunk.cx - playerCx;
        const dz = chunk.cz - playerCz;
        if (dx * dx + dz * dz > unloadDistSq) {
          this.disposeChunkMeshes(chunk);
          this.trees.removeTreesForChunk(key);
          this.grass.removeGrassForChunk(key);
          this.chunks.delete(key);
          this.dirtyChunks.delete(key);
        }
      }

      const missing: Array<{ cx: number; cz: number; distSq: number }> = [];
      for (let dx = -renderDistance; dx <= renderDistance; dx++) {
        for (let dz = -renderDistance; dz <= renderDistance; dz++) {
          if (dx * dx + dz * dz <= renderDistance * renderDistance + 1) {
            const cx = playerCx + dx;
            const cz = playerCz + dz;
            if (!this.chunks.has(this.getChunkKey(cx, cz))) {
              missing.push({ cx, cz, distSq: dx * dx + dz * dz });
            }
          }
        }
      }
      missing.sort((a, b) => a.distSq - b.distSq);
      this.pendingCoords = missing;
    }

    if (this.pendingCoords.length > 0) {
      let generatedThisFrame = 0;
      while (this.pendingCoords.length > 0 && generatedThisFrame < 4) {
        const item = this.pendingCoords.shift()!;
        if (!this.chunks.has(this.getChunkKey(item.cx, item.cz))) {
          this.generateChunkData(item.cx, item.cz, true);
          generatedThisFrame++;
        }
      }
    }

    if (this.dirtyChunks.size > 0) {
      const sortedDirty = Array.from(this.dirtyChunks).sort((k1, k2) => {
        const c1 = this.chunks.get(k1);
        const c2 = this.chunks.get(k2);
        if (!c1 || !c2) return 0;
        const d1 = (c1.cx - playerCx) ** 2 + (c1.cz - playerCz) ** 2;
        const d2 = (c2.cx - playerCx) ** 2 + (c2.cz - playerCz) ** 2;
        return d1 - d2;
      });

      let rebuiltCount = 0;
      for (const key of sortedDirty) {
        this.dirtyChunks.delete(key);
        const chunk = this.chunks.get(key);
        if (chunk) {
          this.buildChunkMesh(chunk);
          rebuiltCount++;
          if (rebuiltCount >= 6) break;
        }
      }
    }
  }

  disposeAll(): void {
    for (const chunk of this.chunks.values()) {
      this.disposeChunkMeshes(chunk);
    }
    this.trees.disposeAll();
    this.grass.disposeAll();
    this.citadelMesh.dispose();
    this.cashier.dispose();
    this.weaponShop.dispose();
    this.outfitShop.dispose();
    this.craftingStation.dispose();
    this.slimes.dispose();
    this.mushrooms.dispose();
    this.dragon.dispose();
    this.monsterDrops.dispose();
    this.chunks.clear();
    this.dirtyChunks.clear();
    this.pendingCoords = [];
  }
}
