import * as THREE from 'three';
import { VoxelAudio } from './audio';
import { getCitadelZoneAt } from './citadel';
import {
  BLOCK_NAMES,
  BlockId,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  HOTBAR_BLOCKS,
} from './constants';
import { CashierStation } from './counter';
import { DragonBossHudState } from './dragon';
import { KatanaViewModel } from './katana';
import { FirstPersonPlayer } from './player';
import { PotionViewModel } from './potion';
import { RaycastHit, voxelRaycast } from './raycast';
import { ShieldViewModel } from './shield';
import { SlimeEntity } from './slime';
import { getXpForNextLevel, MAX_LEVEL, MAX_PLAYER_HP } from './slimeZones';
import { createSolidVoxelMaterial } from './textures';
import { BackpackItem, DetachedLog, InteractiveTree } from './trees';
import { SHOP_ITEM_NAMES, SHOP_ITEM_PRICES, ShopItemId } from './weaponShop';
import { WorldManager } from './world';

export interface HudStats {
  x: number;
  y: number;
  z: number;
  fps: number;
  chunkCount: number;
  money: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  hasBackpack: boolean;
  hasKatana: boolean;
  hasIceKatana: boolean;
  hasShield: boolean;
  backpackOpen: boolean;
  holdingKatana: boolean;
  holdingPotionSlot: number | null;
  holdingPotionCount: number;
  shieldRaised: boolean;
  backpackItems: Array<BackpackItem | null>;
  bossHud: DragonBossHudState;
  targetName: string | null;
  targetCoords: [number, number, number] | null;
}

export interface VoxelEngineCallbacks {
  onPlayingChange: (isPlaying: boolean, hasStarted: boolean) => void;
  onSlotChange: (slotIndex: number) => void;
  onToast: (message: string) => void;
  onWebGLError?: (message: string) => void;
}

interface TreeTarget {
  tree: InteractiveTree;
  point: THREE.Vector3;
  cutLocalY: number;
}

interface DetachedLogTarget {
  log: DetachedLog;
  point: THREE.Vector3;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class VoxelEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: VoxelEngineCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: WorldManager;
  private readonly player: FirstPersonPlayer;
  private readonly audio: VoxelAudio;
  private readonly katanaView: KatanaViewModel;
  private readonly shieldView: ShieldViewModel;
  private readonly potionView: PotionViewModel;

  private readonly solidMaterial: THREE.MeshLambertMaterial;
  private readonly selectionBox: THREE.LineSegments;
  private readonly treeCutIndicator: THREE.Mesh;
  private readonly skyColor = new THREE.Color(0x82b6ff);
  private readonly rayDir = new THREE.Vector3();
  private readonly wallCheckDir = new THREE.Vector3();
  private readonly isSoftwareGl: boolean;
  private readonly statsListeners = new Set<(stats: HudStats) => void>();

  private renderDistance = 4;
  private selectedSlotIndex = 0;
  private interactionEnabled = false;
  private isPlaying = false;
  private hasStarted = false;
  private isMouseDragging = false;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private isDisposed = false;
  private isContextLost = false;
  private readonly isTouchDevice: boolean;

  private frameId = 0;
  private lastTime = performance.now();
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 60;
  private hudSyncTimer = 0;
  private money = 0;
  private hp = MAX_PLAYER_HP;
  private level = 1;
  private xp = 0;
  private hurtInvulnTimer = 0;
  private safeHealTimer = 0;
  private backpackOpen = false;
  private holdingKatana = false;
  private holdingPotionSlot: number | null = null;
  private hasIceKatana = false;
  private shieldRaised = false;
  private currentTarget: RaycastHit | null = null;
  private currentTreeTarget: TreeTarget | null = null;
  private currentLogTarget: DetachedLogTarget | null = null;
  private currentConveyorTarget: { point: THREE.Vector3 } | null = null;
  private currentShopTarget: { itemId: ShopItemId; point: THREE.Vector3 } | null = null;
  private currentSlimeTarget: { slime: SlimeEntity; point: THREE.Vector3 } | null = null;
  private currentDragonTarget: { point: THREE.Vector3; hp: number; maxHp: number } | null = null;
  private currentIceKatanaDropTarget: { point: THREE.Vector3 } | null = null;
  private latestStats: HudStats = {
    x: 0.5,
    y: 4.05,
    z: 0.5,
    fps: 60,
    chunkCount: 0,
    money: 0,
    hp: MAX_PLAYER_HP,
    maxHp: MAX_PLAYER_HP,
    level: 1,
    xp: 0,
    xpToNext: getXpForNextLevel(1),
    hasBackpack: false,
    hasKatana: false,
    hasIceKatana: false,
    hasShield: false,
    backpackOpen: false,
    holdingKatana: false,
    holdingPotionSlot: null,
    holdingPotionCount: 0,
    shieldRaised: false,
    backpackItems: Array.from({ length: 9 }, () => null),
    bossHud: {
      visible: false,
      alive: true,
      level: 30,
      hp: 100,
      maxHp: 100,
      activeSkill: null,
      phase: 'idle',
      warningLabel: null,
      warningProgress: 0,
      dropAvailable: false,
    },
    targetName: null,
    targetCoords: null,
  };

  constructor(container: HTMLElement, callbacks: VoxelEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5),
    );
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = this.skyColor.clone();
    this.scene.fog = new THREE.Fog(
      this.skyColor.getHex(),
      this.renderDistance * CHUNK_SIZE * 0.45,
      this.renderDistance * CHUNK_SIZE * 0.98,
    );

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      72,
      width / height,
      0.1,
      Math.max(128, this.renderDistance * CHUNK_SIZE * 1.4),
    );

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x5c6e58, 0.85);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e0, 0.45);
    sunLight.position.set(60, 120, 40);
    this.scene.add(sunLight);

    this.solidMaterial = createSolidVoxelMaterial();

    this.world = new WorldManager(this.scene, this.solidMaterial);
    this.player = new FirstPersonPlayer(this.camera, this.world);
    this.player.spawnAtSafeHeight(0.5, 0.5);
    this.world.prewarmAround(this.player.position.x, this.player.position.z, this.renderDistance);
    this.audio = new VoxelAudio();
    this.katanaView = new KatanaViewModel(this.scene);
    this.shieldView = new ShieldViewModel(this.scene);
    this.potionView = new PotionViewModel(this.scene);

    const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    const boxMat = new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 2 });
    this.selectionBox = new THREE.LineSegments(boxGeo, boxMat);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

    const ringGeo = new THREE.TorusGeometry(1.0, 0.06, 6, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    this.treeCutIndicator = new THREE.Mesh(ringGeo, ringMat);
    this.treeCutIndicator.visible = false;
    this.scene.add(this.treeCutIndicator);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitStats();
    this.scheduleNextFrame();
  }

  subscribeStats(listener: (stats: HudStats) => void): () => void {
    this.statsListeners.add(listener);
    listener(this.latestStats);
    return () => {
      this.statsListeners.delete(listener);
    };
  }

  enterGame(): void {
    this.hasStarted = true;
    this.isPlaying = true;
    this.callbacks.onPlayingChange(true, true);

    const canvas = this.renderer.domElement;
    if (!this.isTouchDevice && canvas.requestPointerLock) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Fallback nếu môi trường nhúng hạn chế Pointer Lock
      }
    }
  }

  pauseGame(): void {
    this.isPlaying = false;
    this.player.keys = {};
    this.isMouseDragging = false;
    this.callbacks.onPlayingChange(false, this.hasStarted);

    const canvas = this.renderer.domElement;
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  setRenderDistance(distance: number): void {
    this.renderDistance = distance;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = distance * CHUNK_SIZE * 0.45;
      this.scene.fog.far = distance * CHUNK_SIZE * 0.98;
    }
    this.camera.far = Math.max(128, distance * CHUNK_SIZE * 1.4);
    this.camera.updateProjectionMatrix();
  }

  setSensitivity(level: number): void {
    this.player.sensitivity = 0.0005 + level * 0.00035;
  }

  selectSlot(index: number): void {
    const total = HOTBAR_BLOCKS.length;
    this.selectedSlotIndex = ((index % total) + total) % total;
    this.callbacks.onSlotChange(this.selectedSlotIndex);
  }

  setVirtualKey(code: string, pressed: boolean): void {
    this.player.keys[code] = pressed;
  }

  breakTargetBlock(): void {
    if (this.holdingKatana && !this.world.isCarryingLog()) {
      this.katanaView.triggerSlash();
      this.audio.playSlashSound();

      this.camera.getWorldDirection(this.rayDir);
      const atk = this.world.attackSlimeWithKatana(this.camera.position, this.rayDir, 3.8);
      if (atk.hit) {
        this.audio.playSlimeHitSound();
        if (atk.killed) {
          const prevLevel = this.level;
          this.grantXp(atk.xpReward);
          if (this.level === prevLevel && this.level < MAX_LEVEL) {
            this.callbacks.onToast(`Hạ Slime Lv.${atk.level} (+${atk.xpReward} XP)`);
          }
        } else {
          this.emitStats();
        }
        return;
      }

      const dragonDmg = this.hasIceKatana ? 2 : 1;
      const dragonAtk = this.world.attackDragonWithKatana(
        this.camera.position,
        this.rayDir,
        dragonDmg,
        5.4,
        this.level,
      );
      if (dragonAtk.hit) {
        if (dragonAtk.blockedByLevel) {
          this.audio.playShieldBlockSound();
          this.callbacks.onToast('Cần đạt Level 20 trở lên mới có thể gây sát thương cho Rồng Băng!');
          return;
        }
        this.audio.playSlimeHitSound();
        if (dragonAtk.killed) {
          this.audio.playDragonDefeatSound();
          this.grantXp(dragonAtk.xpReward);
          this.callbacks.onToast(
            'Hạ Rồng Băng Lv.30! (+5.000 XP) Katana Băng đã rơi ra!',
          );
        } else {
          this.emitStats();
        }
        return;
      }
    } else if (
      this.currentSlimeTarget &&
      this.currentSlimeTarget.point.distanceTo(this.camera.position) <= 4.2
    ) {
      this.callbacks.onToast('Cần mua và cầm Katana (phím Q) để chém Slime!');
      return;
    } else if (
      this.currentDragonTarget &&
      this.currentDragonTarget.point.distanceTo(this.camera.position) <= 5.6
    ) {
      this.callbacks.onToast('Cần mua và cầm Katana (phím Q) để chém Rồng Băng!');
      return;
    }

    if (this.currentTreeTarget) {
      const { tree, cutLocalY } = this.currentTreeTarget;
      if (this.world.cutTree(tree, cutLocalY, this.player.position.x, this.player.position.z)) {
        this.audio.playBlockSound('break');
        this.currentTreeTarget = null;
        this.treeCutIndicator.visible = false;
      }
      return;
    }

    if (!this.interactionEnabled || !this.currentTarget) return;
    const [bx, by, bz] = this.currentTarget.blockPos;
    if (by === 0) {
      this.callbacks.onToast('Không thể phá hủy Đá Nền ở đáy thế giới!');
      return;
    }
    if (this.world.setBlockAt(bx, by, bz, BlockId.AIR)) {
      this.audio.playBlockSound('break');
    }
  }

  placeTargetBlock(): void {
    if (this.currentIceKatanaDropTarget) {
      if (
        this.world.tryCollectIceKatana({
          onCollectIceKatana: () => this.handleCollectIceKatana(),
        })
      ) {
        this.currentIceKatanaDropTarget = null;
        return;
      }
    }

    if (this.currentShopTarget) {
      const { itemId } = this.currentShopTarget;
      if (itemId === 'potion') {
        if (!this.world.isShopItemOwned('backpack')) {
          this.callbacks.onToast('Cần mua Balo (500 VNĐ) trước để chứa Lọ thuốc hồi máu!');
          return;
        }
        const price = SHOP_ITEM_PRICES.potion;
        if (this.money < price) {
          this.callbacks.onToast(
            `Chưa đủ ${price.toLocaleString('vi-VN')} VNĐ để mua ${SHOP_ITEM_NAMES.potion}!`,
          );
          return;
        }
        const res = this.world.addPotionToBackpack();
        if (!res.added) {
          this.callbacks.onToast('Balo đã đầy (tối đa 50 lọ/ô)! Không thể mua thêm thuốc.');
          return;
        }
        this.money -= price;
        this.audio.playCashSound();
        this.emitStats();
        this.callbacks.onToast(
          `Đã mua ${SHOP_ITEM_NAMES.potion} (Ô ${res.slotIndex + 1}: ${res.count}/50 · -${price.toLocaleString('vi-VN')} VNĐ)!`,
        );
        return;
      }

      const owned = this.world.isShopItemOwned(itemId);
      if (!owned) {
        const price = SHOP_ITEM_PRICES[itemId];
        if (this.money < price) {
          this.callbacks.onToast(
            `Chưa đủ ${price.toLocaleString('vi-VN')} VNĐ để mua ${SHOP_ITEM_NAMES[itemId]}!`,
          );
          return;
        }
        this.money -= price;
        this.world.markShopItemOwned(itemId);
        this.audio.playCashSound();
        this.emitStats();
        this.callbacks.onToast(
          `Đã mua ${SHOP_ITEM_NAMES[itemId]} (-${price.toLocaleString('vi-VN')} VNĐ)!`,
        );
        return;
      }
      if (!this.world.isCarryingLog()) {
        this.callbacks.onToast(`Bạn đã sở hữu ${SHOP_ITEM_NAMES[itemId]}!`);
        return;
      }
    }

    if (this.holdingPotionSlot !== null && !this.world.isCarryingLog()) {
      if (this.drinkHeldPotion()) {
        return;
      }
    }

    if (this.world.isCarryingLog()) {
      if (this.currentConveyorTarget) {
        if (this.world.placeCarriedOnConveyor()) {
          this.audio.playBlockSound('place');
          this.currentConveyorTarget = null;
          this.emitStats();
        }
        return;
      }

      const fwdX = -Math.sin(this.player.yaw);
      const fwdZ = -Math.cos(this.player.yaw);
      let placeDist = 2.4;

      this.camera.getWorldDirection(this.wallCheckDir);
      const wallHit = voxelRaycast(this.world, this.camera.position, this.wallCheckDir, 3.2);
      if (wallHit) {
        const wallHorizDist = Math.hypot(
          wallHit.blockPos[0] + 0.5 - this.camera.position.x,
          wallHit.blockPos[2] + 0.5 - this.camera.position.z,
        );
        placeDist = Math.max(1.1, Math.min(placeDist, wallHorizDist - 0.8));
      }

      const placeX = this.player.position.x + fwdX * placeDist;
      const placeZ = this.player.position.z + fwdZ * placeDist;
      if (this.world.placeCarriedLog(placeX, placeZ, fwdX, fwdZ)) {
        this.audio.playBlockSound('place');
        this.currentLogTarget = null;
        this.emitStats();
      }
      return;
    }

    if (this.currentLogTarget) {
      if (this.world.pickUpLog(this.currentLogTarget.log)) {
        this.holdingKatana = false;
        this.holdingPotionSlot = null;
        this.audio.playBlockSound('place');
        this.currentLogTarget = null;
        this.emitStats();
      }
      return;
    }

    if (!this.interactionEnabled || !this.currentTarget) return;
    const [px, py, pz] = this.currentTarget.placePos;
    if (py >= CHUNK_HEIGHT) {
      this.callbacks.onToast('Đã đạt giới hạn chiều cao xây dựng!');
      return;
    }
    if (this.player.intersectsBlock(px, py, pz)) {
      return;
    }
    const blockToPlace = HOTBAR_BLOCKS[this.selectedSlotIndex].id;
    if (this.world.setBlockAt(px, py, pz, blockToPlace)) {
      this.audio.playBlockSound('place');
    }
  }

  toggleBackpack(): void {
    if (!this.world.isShopItemOwned('backpack')) {
      this.callbacks.onToast('Cần mua Balo (500 VNĐ) tại quầy vũ khí trước!');
      return;
    }
    this.backpackOpen = !this.backpackOpen;
    this.audio.playStowSound();
    this.emitStats();
  }

  interactBackpackWood(): void {
    if (!this.world.isShopItemOwned('backpack')) {
      this.callbacks.onToast('Cần mua Balo (500 VNĐ) tại quầy vũ khí trước!');
      return;
    }

    if (this.world.isCarryingLog()) {
      if (this.world.storeCarriedLogToBackpack()) {
        this.audio.playStowSound();
        this.emitStats();
      } else {
        this.callbacks.onToast('Balo đã đầy (9/9)! Không thể cất thêm gỗ.');
      }
      return;
    }

    if (this.world.retrieveLogFromBackpack()) {
      this.holdingKatana = false;
      this.holdingPotionSlot = null;
      this.audio.playStowSound();
      this.emitStats();
    } else {
      this.callbacks.onToast('Balo không có khúc gỗ nào!');
    }
  }

  retrieveBackpackSlot(slotIndex: number): void {
    if (!this.world.isShopItemOwned('backpack') || !this.backpackOpen) return;
    if (slotIndex < 0 || slotIndex >= 9) return;

    const slotKind = this.world.getBackpackSlotKind(slotIndex);
    if (slotKind === 'potion') {
      if (this.world.isCarryingLog()) {
        this.callbacks.onToast('Tay đang khiêng gỗ! Đặt xuống hoặc ấn F để cất trước.');
        return;
      }
      if (this.holdingPotionSlot === slotIndex) {
        this.holdingPotionSlot = null;
        this.audio.playStowSound();
        this.emitStats();
        return;
      }
      this.holdingKatana = false;
      this.holdingPotionSlot = slotIndex;
      this.audio.playStowSound();
      this.emitStats();
      const count = this.world.getPotionCountAtSlot(slotIndex);
      this.callbacks.onToast(
        `Đang cầm Lọ thuốc hồi máu (x${count}) · Chuột phải để uống (+2 tim)!`,
      );
      return;
    }

    if (this.world.isCarryingLog()) {
      this.callbacks.onToast('Tay đang khiêng gỗ! Đặt xuống hoặc ấn F để cất trước.');
      return;
    }

    if (this.world.retrieveLogFromBackpackSlot(slotIndex)) {
      this.holdingKatana = false;
      this.holdingPotionSlot = null;
      this.audio.playStowSound();
      this.emitStats();
    } else {
      this.callbacks.onToast(`Ô ${slotIndex + 1} đang trống!`);
    }
  }

  private drinkHeldPotion(): boolean {
    if (this.holdingPotionSlot === null) return false;
    const count = this.world.getPotionCountAtSlot(this.holdingPotionSlot);
    if (count <= 0) {
      this.holdingPotionSlot = null;
      this.emitStats();
      return false;
    }
    if (this.hp >= MAX_PLAYER_HP) {
      this.callbacks.onToast('Máu đã đầy (10/10 tim), chưa cần uống thuốc!');
      return true;
    }
    const remaining = this.world.consumePotionFromSlot(this.holdingPotionSlot);
    this.hp = Math.min(MAX_PLAYER_HP, Math.round((this.hp + 2.0) * 2) / 2);
    this.potionView.triggerDrink();
    this.audio.playPotionDrinkSound();
    if (remaining <= 0) {
      this.holdingPotionSlot = null;
    }
    this.emitStats();
    this.callbacks.onToast(
      remaining > 0
        ? `Đã uống Lọ thuốc hồi máu (+2 tim) · Còn ${remaining} lọ`
        : 'Đã uống Lọ thuốc hồi máu (+2 tim) · Đã hết lọ trong ô!',
    );
    return true;
  }

  toggleKatana(): void {
    if (!this.world.isShopItemOwned('katana')) {
      this.callbacks.onToast('Cần mua Katana (1.000 VNĐ) tại quầy vũ khí trước!');
      return;
    }

    if (this.holdingKatana) {
      this.holdingKatana = false;
      this.audio.playStowSound();
      this.emitStats();
      return;
    }

    if (this.world.isCarryingLog()) {
      if (!this.world.isShopItemOwned('backpack')) {
        this.callbacks.onToast('Cần có Balo hoặc đặt gỗ xuống trước khi đổi sang Katana!');
        return;
      }
      if (this.world.isBackpackFull()) {
        this.callbacks.onToast('Balo đã đầy (9/9), không thể cất gỗ để đổi qua Katana!');
        return;
      }
      this.world.storeCarriedLogToBackpack();
    }

    this.holdingKatana = true;
    this.holdingPotionSlot = null;
    this.audio.playStowSound();
    this.emitStats();
  }

  toggleShield(): void {
    if (!this.world.isShopItemOwned('shield')) {
      this.callbacks.onToast('Cần mua Khiên chắn (600 VNĐ) tại quầy vũ khí trước!');
      return;
    }
    this.shieldRaised = !this.shieldRaised;
    this.audio.playStowSound();
    this.emitStats();
  }

  private grantXp(amount: number): void {
    if (amount <= 0) return;
    if (this.level >= MAX_LEVEL) {
      this.xp = 0;
      this.emitStats();
      return;
    }

    this.xp += amount;
    let leveledUp = false;
    while (this.level < MAX_LEVEL) {
      const required = getXpForNextLevel(this.level);
      if (this.xp < required) break;
      this.xp -= required;
      this.level += 1;
      leveledUp = true;
    }

    if (this.level >= MAX_LEVEL) {
      this.xp = 0;
    }

    if (leveledUp) {
      this.audio.playLevelUpSound();
      this.callbacks.onToast(
        this.level >= MAX_LEVEL
          ? `Chúc mừng! Đạt cấp tối đa Level ${MAX_LEVEL}!`
          : `Lên cấp! Level ${this.level}`,
      );
    }

    this.emitStats();
  }

  private handleCollectIceKatana(): void {
    this.hasIceKatana = true;
    this.world.markShopItemOwned('katana');
    this.katanaView.setIceVariant(true);
    if (!this.world.isCarryingLog()) {
      this.holdingKatana = true;
      this.holdingPotionSlot = null;
    }
    this.audio.playLevelUpSound();
    this.emitStats();
    this.callbacks.onToast('Đã nhận Katana Băng! Đã thay thế Katana ban đầu.');
  }

  private emitStats(): void {
    this.latestStats.x = this.player.position.x;
    this.latestStats.y = this.player.position.y;
    this.latestStats.z = this.player.position.z;
    this.latestStats.fps = this.currentFps;
    this.latestStats.chunkCount = this.world.chunks.size;
    this.latestStats.money = this.money;
    this.latestStats.hp = this.hp;
    this.latestStats.maxHp = MAX_PLAYER_HP;
    this.latestStats.level = this.level;
    this.latestStats.xp = this.xp;
    this.latestStats.xpToNext = getXpForNextLevel(this.level);
    this.latestStats.hasBackpack = this.world.isShopItemOwned('backpack');
    this.latestStats.hasKatana = this.world.isShopItemOwned('katana');
    this.latestStats.hasIceKatana = this.hasIceKatana;
    this.latestStats.hasShield = this.world.isShopItemOwned('shield');
    this.latestStats.backpackOpen = this.backpackOpen;
    this.latestStats.holdingKatana = this.holdingKatana;
    if (
      this.holdingPotionSlot !== null &&
      this.world.getPotionCountAtSlot(this.holdingPotionSlot) <= 0
    ) {
      this.holdingPotionSlot = null;
    }
    this.latestStats.holdingPotionSlot = this.holdingPotionSlot;
    this.latestStats.holdingPotionCount =
      this.holdingPotionSlot !== null
        ? this.world.getPotionCountAtSlot(this.holdingPotionSlot)
        : 0;
    this.latestStats.shieldRaised = this.shieldRaised;
    this.latestStats.backpackItems = this.world.getBackpackItems();
    this.latestStats.bossHud = this.world.getBossHudState(
      this.player.position.x,
      this.player.position.z,
    );

    if (this.currentIceKatanaDropTarget) {
      const p = this.currentIceKatanaDropTarget.point;
      this.latestStats.targetName = 'Katana Băng · Chuột phải hoặc lại gần nhận';
      this.latestStats.targetCoords = [
        Math.round(p.x),
        Math.round(p.y * 10) / 10,
        Math.round(p.z),
      ];
    } else if (this.currentDragonTarget) {
      const { point, hp, maxHp } = this.currentDragonTarget;
      this.latestStats.targetName =
        this.level < 20
          ? `Rồng Băng Lv.30 (${hp}/${maxHp} · Cần Lv.20 để gây sát thương)`
          : `Rồng Băng Lv.30 (${hp}/${maxHp} · +5.000 XP)`;
      this.latestStats.targetCoords = [
        Math.round(point.x),
        Math.round(point.y * 10) / 10,
        Math.round(point.z),
      ];
    } else if (
      this.currentShopTarget &&
      (!this.world.isCarryingLog() || !this.world.isShopItemOwned(this.currentShopTarget.itemId))
    ) {
      const { itemId, point } = this.currentShopTarget;
      const owned = this.world.isShopItemOwned(itemId);
      const price = SHOP_ITEM_PRICES[itemId];
      const prefix =
        itemId === 'backpack'
          ? 'Khung 1'
          : itemId === 'katana'
            ? 'Khung 2'
            : itemId === 'shield'
              ? 'Khung 3'
              : 'Khung 4';
      this.latestStats.targetName = owned
        ? `${prefix}: ${SHOP_ITEM_NAMES[itemId]} · Đã sở hữu`
        : `${prefix}: ${SHOP_ITEM_NAMES[itemId]} · ${price.toLocaleString('vi-VN')} VNĐ (Chuột phải mua)`;
      this.latestStats.targetCoords = [
        Math.round(point.x),
        Math.round(point.y * 10) / 10,
        Math.round(point.z),
      ];
    } else if (this.currentSlimeTarget && this.currentSlimeTarget.slime.alive) {
      const { slime, point } = this.currentSlimeTarget;
      this.latestStats.targetName = `Slime Lv.${slime.level} (${slime.hp}/${slime.maxHp} · +${slime.xpReward} XP)`;
      this.latestStats.targetCoords = [
        Math.round(point.x),
        Math.round(point.y * 10) / 10,
        Math.round(point.z),
      ];
    } else if (this.world.isCarryingLog() && this.currentConveyorTarget) {
      const carriedLen = this.world.getCarriedLogLength() ?? 1;
      const previewVnd = CashierStation.computeWoodValue(carriedLen);
      this.latestStats.targetName = `Băng tải · Chuột phải bán (+${previewVnd.toLocaleString('vi-VN')} VNĐ)`;
      this.latestStats.targetCoords = [
        Math.round(this.currentConveyorTarget.point.x),
        Math.round(this.currentConveyorTarget.point.y * 10) / 10,
        Math.round(this.currentConveyorTarget.point.z),
      ];
    } else if (this.world.isCarryingLog()) {
      const fwdX = -Math.sin(this.player.yaw);
      const fwdZ = -Math.cos(this.player.yaw);
      const px = this.player.position.x + fwdX * 2.4;
      const pz = this.player.position.z + fwdZ * 2.4;
      const py = this.world.getGroundHeight(px, pz);
      this.latestStats.targetName = 'Đang khiêng cây · Chuột phải đặt · F cất vào balo';
      this.latestStats.targetCoords = [Math.round(px), Math.round(py * 10) / 10, Math.round(pz)];
    } else if (this.currentLogTarget) {
      this.latestStats.targetName = 'Thân Cây Rời · Chuột phải khiêng';
      this.latestStats.targetCoords = [
        Math.round(this.currentLogTarget.log.x),
        Math.round(this.currentLogTarget.point.y * 10) / 10,
        Math.round(this.currentLogTarget.log.z),
      ];
    } else if (this.currentTreeTarget) {
      this.latestStats.targetName = this.holdingKatana
        ? 'Thân Cây · Chuột trái chém chặt'
        : 'Thân Cây · Chuột trái chặt';
      this.latestStats.targetCoords = [
        Math.round(this.currentTreeTarget.tree.x),
        Math.round(
          (this.currentTreeTarget.tree.baseY + this.currentTreeTarget.cutLocalY) * 10,
        ) / 10,
        Math.round(this.currentTreeTarget.tree.z),
      ];
    } else if (this.currentTarget) {
      this.latestStats.targetName = BLOCK_NAMES[this.currentTarget.blockId];
      this.latestStats.targetCoords = this.currentTarget.blockPos;
    } else {
      this.latestStats.targetName = null;
      this.latestStats.targetCoords = null;
    }

    for (const listener of this.statsListeners) {
      listener(this.latestStats);
    }
  }

  private readonly onPointerLockChange = (): void => {
    const canvas = this.renderer.domElement;
    if (document.pointerLockElement === canvas) {
      this.hasStarted = true;
      this.isPlaying = true;
      this.callbacks.onPlayingChange(true, true);
    } else if (!this.isTouchDevice && this.isPlaying) {
      this.pauseGame();
    }
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.isPlaying) return;
    if (document.pointerLockElement === this.renderer.domElement || this.isMouseDragging) {
      this.player.rotate(e.movementX, e.movementY);
    }
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (!this.isPlaying) return;
    const canvas = this.renderer.domElement;
    if (document.pointerLockElement !== canvas && !this.isTouchDevice) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Fallback kéo chuột
      }
      this.isMouseDragging = true;
    }
    if (e.button === 0) {
      this.breakTargetBlock();
    } else if (e.button === 2) {
      this.placeTargetBlock();
    }
  };

  private readonly onMouseUp = (): void => {
    this.isMouseDragging = false;
  };

  private readonly onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.player.keys[e.code] = true;

    if (!this.backpackOpen && e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 1 && num <= HOTBAR_BLOCKS.length) {
        this.selectSlot(num - 1);
      }
    }

    if (this.isPlaying && !e.repeat) {
      if (e.code === 'KeyE') {
        this.toggleBackpack();
      } else if (e.code === 'KeyF') {
        this.interactBackpackWood();
      } else if (e.code === 'KeyQ') {
        this.toggleKatana();
      } else if (e.code === 'KeyR') {
        this.toggleShield();
      } else if (this.backpackOpen) {
        const digitMatch = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
        if (digitMatch) {
          this.retrieveBackpackSlot(parseInt(digitMatch[1], 10) - 1);
        }
      }
    }

    if (e.code === 'Escape' && this.isPlaying && document.pointerLockElement !== this.renderer.domElement) {
      this.pauseGame();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.player.keys[e.code] = false;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    if (!this.isPlaying) return;
    if (e.deltaY > 0) {
      this.selectSlot(this.selectedSlotIndex + 1);
    } else if (e.deltaY < 0) {
      this.selectSlot(this.selectedSlotIndex - 1);
    }
  };

  private readonly onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 1) {
      this.lastTouchX = e.touches[0].clientX;
      this.lastTouchY = e.touches[0].clientY;
    }
  };

  private readonly onTouchMove = (e: TouchEvent): void => {
    if (!this.isPlaying || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - this.lastTouchX;
    const dy = touch.clientY - this.lastTouchY;
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;
    this.player.rotate(dx * 1.6, dy * 1.6);
  };

  private readonly onResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault();
    this.isContextLost = true;
    this.callbacks.onWebGLError?.('Ngữ cảnh đồ họa WebGL tạm thời bị gián đoạn, đang chờ khôi phục...');
  };

  private readonly onContextRestored = (): void => {
    this.isContextLost = false;
    this.callbacks.onWebGLError?.('');
  };

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('resize', this.onResize);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private unbindEvents(): void {
    const canvas = this.renderer.domElement;
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('touchstart', this.onTouchStart);
    canvas.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('resize', this.onResize);
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDisposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextFrame(): void {
    if (this.isDisposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private readonly tick = (): void => {
    if (this.isDisposed) return;

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.4) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    if (this.isPlaying) {
      const jumpState = this.player.update(dt);
      if (jumpState.jumped) {
        this.audio.playJumpSound();
      }
      if (jumpState.landedImpact > 0) {
        this.audio.playLandSound(jumpState.landedImpact);
      }
    }

    const clampedDt = Math.min(dt, 0.05);
    if (this.hurtInvulnTimer > 0) {
      this.hurtInvulnTimer = Math.max(0, this.hurtInvulnTimer - clampedDt);
    }

    if (
      this.isPlaying &&
      this.hp < MAX_PLAYER_HP &&
      getCitadelZoneAt(this.player.position.x, this.player.position.z) === 'inside'
    ) {
      this.safeHealTimer += clampedDt;
      if (this.safeHealTimer >= 2.5) {
        this.safeHealTimer = 0;
        this.hp = Math.min(MAX_PLAYER_HP, Math.round((this.hp + 1) * 2) / 2);
        this.emitStats();
      }
    } else {
      this.safeHealTimer = 0;
    }

    this.world.update(
      clampedDt,
      this.player.position.x,
      this.player.position.y,
      this.player.position.z,
      this.player.yaw,
      this.shieldRaised,
      () => this.audio.playBlockSound('place'),
      (earned, lengthBlocks) => {
        this.money += earned;
        this.audio.playCashSound();
        this.emitStats();
        this.callbacks.onToast(
          `+${earned.toLocaleString('vi-VN')} VNĐ (${lengthBlocks.toFixed(1)} block gỗ)`,
        );
      },
      {
        onPlayerHit: (damage, _slimeLevel, dirX, dirZ) => {
          if (!this.isPlaying || this.hurtInvulnTimer > 0) return;
          this.hurtInvulnTimer = 0.9;
          this.hp = Math.max(0, Math.round((this.hp - damage) * 2) / 2);
          this.audio.playPlayerHurtSound();
          if (this.hp <= 0) {
            this.hp = MAX_PLAYER_HP;
            this.hurtInvulnTimer = 1.2;
            this.player.respawnAtStart();
            this.callbacks.onToast(
              'Bạn đã hết máu và trở về vị trí ban đầu (đồ đạc được giữ nguyên)!',
            );
          } else {
            this.player.applyKnockback(dirX, dirZ, 0.5);
          }
          this.emitStats();
        },
        onShieldBlocked: (slimeLevel) => {
          if (!this.isPlaying) return;
          this.audio.playShieldBlockSound();
          this.callbacks.onToast(`Khiên đã đỡ đòn Slime Lv.${slimeLevel}!`);
        },
      },
      {
        onSkillWarning: () => {
          if (!this.isPlaying) return;
          this.audio.playDragonWarningSound();
        },
        onSkillExecute: (skillId) => {
          if (!this.isPlaying) return;
          if (skillId === 1) this.audio.playDragonSlamSound();
          else if (skillId === 2) this.audio.playDragonDashSound();
          else this.audio.playDragonBreathSound();
        },
        onPlayerHit: (damage, skillId, shieldMitigated, dirX, dirZ) => {
          if (!this.isPlaying || this.hurtInvulnTimer > 0) return;
          this.hurtInvulnTimer = 0.65;
          this.hp = Math.max(0, Math.round((this.hp - damage) * 2) / 2);
          if (shieldMitigated) {
            this.audio.playShieldBlockSound();
          }
          this.audio.playPlayerHurtSound();
          if (this.hp <= 0) {
            this.hp = MAX_PLAYER_HP;
            this.hurtInvulnTimer = 1.2;
            this.player.respawnAtStart();
            this.callbacks.onToast(
              'Bạn đã hết máu trước Rồng Băng và trở về vị trí ban đầu (đồ đạc được giữ nguyên)!',
            );
          } else {
            const knockDist = skillId === 1 ? 3.0 : 1.0;
            const knockDur = skillId === 1 ? 0.2 : 0.1;
            this.player.applyKnockback(dirX, dirZ, knockDist, knockDur);
            if (skillId === 1 && shieldMitigated) {
              this.callbacks.onToast('Khiên đã giảm sát thương dậm đất (-1 tim · Đẩy lùi 3 block)!');
            } else if (skillId === 1) {
              this.callbacks.onToast('Dính dậm xung kích Rồng Băng (-3 tim · Đẩy lùi 3 block)!');
            } else if (skillId === 2) {
              this.callbacks.onToast('Bị Rồng Băng lao trúng (-2 tim · Khiên vô hiệu)!');
            } else {
              this.callbacks.onToast('Dính lửa băng Rồng (-2 tim · Khiên vô hiệu)!');
            }
          }
          this.emitStats();
        },
        onCollectIceKatana: () => {
          this.handleCollectIceKatana();
        },
      },
    );
    this.world.updateCarried(this.camera);
    const viewMotion = this.player.getViewmodelMotion();
    this.katanaView.update(
      this.camera,
      clampedDt,
      this.holdingKatana && !this.world.isCarryingLog(),
      viewMotion,
    );
    this.shieldView.update(
      this.camera,
      clampedDt,
      this.world.isShopItemOwned('shield'),
      this.shieldRaised,
      viewMotion,
    );
    this.potionView.update(
      this.camera,
      clampedDt,
      this.holdingPotionSlot !== null && !this.holdingKatana && !this.world.isCarryingLog(),
      viewMotion,
    );

    this.world.updateChunksAroundPlayer(
      this.player.position.x,
      this.player.position.z,
      this.renderDistance,
    );

    this.camera.getWorldDirection(this.rayDir);
    const dropHit = this.world.raycastDroppedIceKatana(this.camera.position, this.rayDir, 6.5);
    const shopHit = this.world.raycastShopItem(this.camera.position, this.rayDir, 6.5);
    const shopDist = shopHit ? shopHit.point.distanceTo(this.camera.position) : Infinity;

    if (dropHit) {
      this.currentIceKatanaDropTarget = dropHit;
      this.currentDragonTarget = null;
      this.currentShopTarget = null;
      this.currentSlimeTarget = null;
      this.currentTreeTarget = null;
      this.currentLogTarget = null;
      this.currentConveyorTarget = null;
    } else if (!this.world.isCarryingLog()) {
      this.currentIceKatanaDropTarget = null;
      this.currentConveyorTarget = null;
      const dragonHit = this.world.raycastDragon(this.camera.position, this.rayDir, 8.0);
      const slimeHit = this.world.raycastSlime(this.camera.position, this.rayDir, 6.5);
      const treeHit = this.world.raycastTreeTrunk(this.camera.position, this.rayDir, 7.0);
      const logHit = this.world.raycastDetachedLog(this.camera.position, this.rayDir, 7.0);

      const dragonDist = dragonHit ? dragonHit.point.distanceTo(this.camera.position) : Infinity;
      const slimeDist = slimeHit ? slimeHit.point.distanceTo(this.camera.position) : Infinity;
      const treeDist = treeHit ? treeHit.point.distanceTo(this.camera.position) : Infinity;
      const logDist = logHit ? logHit.point.distanceTo(this.camera.position) : Infinity;

      if (
        shopHit &&
        shopDist <= dragonDist &&
        shopDist <= slimeDist &&
        shopDist <= treeDist &&
        shopDist <= logDist
      ) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, shopDist);
        this.currentShopTarget = wallHit ? null : shopHit;
        this.currentDragonTarget = null;
        this.currentSlimeTarget = null;
        this.currentTreeTarget = null;
        this.currentLogTarget = null;
      } else if (
        dragonHit &&
        dragonDist <= slimeDist &&
        dragonDist <= treeDist &&
        dragonDist <= logDist
      ) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, dragonDist);
        this.currentDragonTarget = wallHit ? null : dragonHit;
        this.currentSlimeTarget = null;
        this.currentTreeTarget = null;
        this.currentLogTarget = null;
        this.currentShopTarget = null;
      } else if (slimeHit && slimeDist <= treeDist && slimeDist <= logDist) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, slimeDist);
        this.currentSlimeTarget = wallHit ? null : slimeHit;
        this.currentDragonTarget = null;
        this.currentTreeTarget = null;
        this.currentLogTarget = null;
        this.currentShopTarget = null;
      } else if (treeHit && treeDist <= logDist) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, treeDist);
        this.currentTreeTarget = wallHit ? null : treeHit;
        this.currentDragonTarget = null;
        this.currentSlimeTarget = null;
        this.currentLogTarget = null;
        this.currentShopTarget = null;
      } else if (logHit) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, logDist);
        this.currentLogTarget = wallHit ? null : logHit;
        this.currentDragonTarget = null;
        this.currentSlimeTarget = null;
        this.currentTreeTarget = null;
        this.currentShopTarget = null;
      } else {
        this.currentDragonTarget = null;
        this.currentSlimeTarget = null;
        this.currentTreeTarget = null;
        this.currentLogTarget = null;
        this.currentShopTarget = null;
      }
    } else {
      this.currentIceKatanaDropTarget = null;
      this.currentDragonTarget = null;
      this.currentSlimeTarget = null;
      this.currentTreeTarget = null;
      this.currentLogTarget = null;
      const convHit = this.world.raycastConveyor(this.camera.position, this.rayDir, 7.0);
      const convDist = convHit ? convHit.point.distanceTo(this.camera.position) : Infinity;

      if (shopHit && !this.world.isShopItemOwned(shopHit.itemId) && shopDist <= convDist) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, shopDist);
        this.currentShopTarget = wallHit ? null : shopHit;
        this.currentConveyorTarget = null;
      } else if (convHit) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, convDist);
        this.currentConveyorTarget = wallHit ? null : convHit;
        this.currentShopTarget = null;
      } else {
        this.currentConveyorTarget = null;
        this.currentShopTarget = null;
      }
    }

    if (this.currentTreeTarget) {
      const { tree, cutLocalY } = this.currentTreeTarget;
      const r = tree.trunkRadius * 1.08;
      this.treeCutIndicator.position.set(tree.x, tree.baseY + Math.max(0.06, cutLocalY), tree.z);
      this.treeCutIndicator.scale.set(r, 1, r);
      this.treeCutIndicator.visible = true;
    } else {
      this.treeCutIndicator.visible = false;
    }

    if (this.interactionEnabled) {
      this.currentTarget = voxelRaycast(this.world, this.camera.position, this.rayDir, 6.5);

      if (this.currentTarget) {
        const [bx, by, bz] = this.currentTarget.blockPos;
        this.selectionBox.position.set(bx + 0.5, by + 0.5, bz + 0.5);
        this.selectionBox.visible = true;
      } else {
        this.selectionBox.visible = false;
      }
    } else if (this.selectionBox.visible) {
      this.currentTarget = null;
      this.selectionBox.visible = false;
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.1) {
      this.hudSyncTimer = 0;
      this.emitStats();
    }

    if (!this.isContextLost) {
      this.renderer.render(this.scene, this.camera);
    }

    this.scheduleNextFrame();
  };

  dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.statsListeners.clear();
    this.unbindEvents();
    this.world.disposeAll();
    this.katanaView.dispose();
    this.shieldView.dispose();
    this.potionView.dispose();
    this.selectionBox.geometry.dispose();
    (this.selectionBox.material as THREE.Material).dispose();
    this.treeCutIndicator.geometry.dispose();
    (this.treeCutIndicator.material as THREE.Material).dispose();
    this.solidMaterial.dispose();
    this.audio.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
