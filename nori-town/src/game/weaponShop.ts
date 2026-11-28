import * as THREE from 'three';
import { createKatanaMeshGroup, KatanaAssetHandles } from './katana';
import { createPotionMeshGroup } from './potion';
import { createShieldMeshGroup } from './shield';

export type ShopItemId = 'backpack' | 'katana' | 'shield' | 'potion';

export const SHOP_ITEM_ORDER: ShopItemId[] = ['backpack', 'katana', 'shield', 'potion'];

export const SHOP_ITEM_PRICES: Record<ShopItemId, number> = {
  backpack: 500,
  katana: 1000,
  shield: 600,
  potion: 200,
};

export const SHOP_ITEM_NAMES: Record<ShopItemId, string> = {
  backpack: 'Balo (18 ô)',
  katana: 'Katana',
  shield: 'Khiên chắn',
  potion: 'Lọ thuốc hồi máu',
};

export const SHOP_ITEM_DESCRIPTIONS: Record<ShopItemId, string> = {
  backpack: 'Mở rộng 18 ô chứa gỗ, thuốc hồi máu, nguyên liệu và kiếm (mở bằng phím E).',
  katana: 'Gây 100 sát thương khi chém quái vật & Rồng Băng, chặt đổ cây ngay lập tức với 1 click chuột trái.',
  shield: 'Nhấn R để giơ khiên đỡ đòn Slime và giảm sát thương dậm đất từ Rồng.',
  potion: 'Dùng chuột phải để uống khi cầm trên tay, hồi ngay +20 máu (tối đa 50 lọ/ô).',
};

export const SHOP_MIN_X = 6.2;
export const SHOP_MAX_X = 16.8;
export const SHOP_MIN_Z = -21.8;
export const SHOP_MAX_Z = -19.0;
export const SHOP_TOP_Y = 5.18;

/**
 * Gian hàng "Cửa hàng thiết yếu" đặt trong sân thành (đối diện quầy thu ngân).
 * Click chuột phải vào cửa hàng sẽ mở giao diện mua 4 vật phẩm thiết yếu:
 * Balo, Katana, Khiên chắn, và Lọ thuốc hồi máu.
 */
export class WeaponShop {
  private readonly scene: THREE.Scene;
  private readonly rootGroup = new THREE.Group();
  private readonly hitMeshes: THREE.Object3D[] = [];
  private readonly assets: KatanaAssetHandles = { geometries: [], materials: [] };
  private readonly textures: THREE.Texture[] = [];
  private readonly raycaster = new THREE.Raycaster();

  private readonly backpackDisplay: THREE.Group;
  private readonly katanaDisplay: THREE.Group;
  private readonly shieldDisplay: THREE.Group;
  private readonly potionDisplay: THREE.Group;

  private backpackOwned = false;
  private katanaOwned = false;
  private shieldOwned = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const stoneBaseMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.85,
      metalness: 0.08,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: '#6d4c33',
      roughness: 0.82,
      metalness: 0.04,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: '#4a3120',
      roughness: 0.85,
      metalness: 0.04,
    });
    const topMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.55,
      metalness: 0.2,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.35,
      metalness: 0.65,
    });
    const awningRedMat = new THREE.MeshStandardMaterial({
      color: '#b91c1c',
      roughness: 0.72,
      metalness: 0.05,
    });
    const awningCreamMat = new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      roughness: 0.76,
      metalness: 0.04,
    });
    const roofSlateMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.72,
      metalness: 0.14,
    });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#f59e0b',
      emissiveIntensity: 1.35,
      roughness: 0.25,
    });
    const packBodyMat = new THREE.MeshStandardMaterial({
      color: '#b45309',
      roughness: 0.78,
      metalness: 0.05,
    });
    const packPocketMat = new THREE.MeshStandardMaterial({
      color: '#92400e',
      roughness: 0.8,
      metalness: 0.05,
    });
    const buckleMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      roughness: 0.25,
      metalness: 0.85,
    });

    this.assets.materials.push(
      stoneBaseMat,
      woodMat,
      darkWoodMat,
      topMat,
      trimMat,
      awningRedMat,
      awningCreamMat,
      roofSlateMat,
      lanternMat,
      packBodyMat,
      packPocketMat,
      buckleMat,
    );

    const registerHitMesh = (mesh: THREE.Mesh) => {
      mesh.userData.isEssentialShop = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.hitMeshes.push(mesh);
    };

    const addBox = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      rotX = 0,
    ): THREE.Mesh => {
      const geo = new THREE.BoxGeometry(w, h, d);
      this.assets.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      if (rotX !== 0) {
        mesh.rotation.x = rotX;
      }
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      registerHitMesh(mesh);
      this.rootGroup.add(mesh);
      return mesh;
    };

    const centerX = (SHOP_MIN_X + SHOP_MAX_X) * 0.5;
    const centerZ = (SHOP_MIN_Z + SHOP_MAX_Z) * 0.5;
    const width = SHOP_MAX_X - SHOP_MIN_X;
    const depth = SHOP_MAX_Z - SHOP_MIN_Z;

    // 1. Nền đá + Quầy gỗ chính + Mặt bàn đá tối màu
    addBox(width + 0.4, 0.16, depth + 0.4, centerX, 4.08, centerZ, stoneBaseMat);
    addBox(width, 0.94, depth - 0.15, centerX, 4.63, centerZ, woodMat);
    addBox(width + 0.16, 0.14, depth + 0.12, centerX, 5.15, centerZ + 0.04, topMat);
    addBox(width - 0.3, 0.14, 0.08, centerX, 4.94, SHOP_MAX_Z + 0.02, trimMat);

    // Mặt sau cửa hàng + kệ trưng bày mini bên trong
    addBox(width, 2.75, 0.24, centerX, 5.54, SHOP_MIN_Z + 0.14, darkWoodMat);
    addBox(width - 0.6, 0.1, 0.55, centerX, 5.95, SHOP_MIN_Z + 0.48, woodMat);

    // 4 cột gỗ chống mái ki-ốt
    const postH = 2.65;
    const postY = SHOP_TOP_Y + postH * 0.5;
    addBox(0.24, postH, 0.24, SHOP_MIN_X + 0.22, postY, SHOP_MAX_Z - 0.22, darkWoodMat);
    addBox(0.24, postH, 0.24, SHOP_MAX_X - 0.22, postY, SHOP_MAX_Z - 0.22, darkWoodMat);
    addBox(0.24, postH, 0.24, SHOP_MIN_X + 0.22, postY, SHOP_MIN_Z + 0.22, darkWoodMat);
    addBox(0.24, postH, 0.24, SHOP_MAX_X - 0.22, postY, SHOP_MIN_Z + 0.22, darkWoodMat);

    // Mái che sọc đỏ-kem vươn ra mặt trước + mái ngói xám phía trên
    const stripeCount = 10;
    const stripeW = (width + 0.6) / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      const sx = SHOP_MIN_X - 0.3 + stripeW * (i + 0.5);
      addBox(
        stripeW - 0.01,
        0.1,
        1.18,
        sx,
        7.12,
        SHOP_MAX_Z + 0.35,
        i % 2 === 0 ? awningRedMat : awningCreamMat,
        0.24,
      );
    }
    addBox(width + 0.65, 0.22, depth + 0.55, centerX, 7.62, centerZ, roofSlateMat);
    addBox(width - 0.3, 0.34, depth - 0.2, centerX, 7.88, centerZ, roofSlateMat);

    // 2 đèn lồng ấm ở hai cột trước
    for (const lx of [SHOP_MIN_X + 0.22, SHOP_MAX_X - 0.22]) {
      addBox(0.12, 0.14, 0.32, lx, 6.55, SHOP_MAX_Z + 0.08, trimMat);
      addBox(0.24, 0.3, 0.24, lx, 6.32, SHOP_MAX_Z + 0.2, lanternMat);
    }

    // 2. Bảng tên lớn nổi bật: "CỬA HÀNG THIẾT YẾU"
    const mainSignTex = this.createMainShopSignTexture();
    const mainSignMat = new THREE.MeshStandardMaterial({
      map: mainSignTex,
      roughness: 0.4,
      metalness: 0.12,
    });
    this.assets.materials.push(mainSignMat);

    const signBoardBacking = addBox(7.2, 1.38, 0.18, centerX, 8.32, SHOP_MAX_Z - 0.08, darkWoodMat);
    signBoardBacking.castShadow = true;
    addBox(7.38, 0.12, 0.22, centerX, 9.02, SHOP_MAX_Z - 0.08, trimMat);
    addBox(7.38, 0.12, 0.22, centerX, 7.62, SHOP_MAX_Z - 0.08, trimMat);

    const mainSignGeo = new THREE.PlaneGeometry(6.88, 1.16);
    this.assets.geometries.push(mainSignGeo);
    const mainSignMesh = new THREE.Mesh(mainSignGeo, mainSignMat);
    mainSignMesh.position.set(centerX, 8.32, SHOP_MAX_Z + 0.025);
    registerHitMesh(mainSignMesh);
    this.rootGroup.add(mainSignMesh);

    // Bảng tên nhỏ gắn ngay mặt trước quầy ở tầm mắt người chơi
    const counterSignGeo = new THREE.PlaneGeometry(4.4, 0.66);
    this.assets.geometries.push(counterSignGeo);
    const counterSignTex = this.createCounterPlaqueTexture();
    const counterSignMat = new THREE.MeshStandardMaterial({
      map: counterSignTex,
      roughness: 0.42,
      metalness: 0.1,
    });
    this.assets.materials.push(counterSignMat);
    const counterSignMesh = new THREE.Mesh(counterSignGeo, counterSignMat);
    counterSignMesh.position.set(centerX, 4.62, SHOP_MAX_Z + 0.02);
    registerHitMesh(counterSignMesh);
    this.rootGroup.add(counterSignMesh);

    // 3. Mô hình 4 vật phẩm trưng bày trên quầy & kệ cửa hàng cho sinh động
    const slot1X = SHOP_MIN_X + 1.65;
    const slot2X = SHOP_MIN_X + 4.05;
    const slot3X = SHOP_MIN_X + 6.55;
    const slot4X = SHOP_MIN_X + 8.95;

    // Balo 3D
    this.backpackDisplay = new THREE.Group();
    this.backpackDisplay.position.set(slot1X, SHOP_TOP_Y + 0.45, centerZ - 0.15);
    const addPackPart = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
    ) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      this.assets.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      registerHitMesh(mesh);
      this.backpackDisplay.add(mesh);
    };
    addPackPart(0.56, 0.7, 0.36, 0, 0, 0, packBodyMat);
    addPackPart(0.42, 0.3, 0.14, 0, -0.12, 0.21, packPocketMat);
    addPackPart(0.58, 0.12, 0.38, 0, 0.3, 0.02, packPocketMat);
    addPackPart(0.12, 0.09, 0.06, 0, 0.22, 0.22, buckleMat);
    this.rootGroup.add(this.backpackDisplay);

    // Katana 3D đặt trên giá gỗ
    this.katanaDisplay = new THREE.Group();
    this.katanaDisplay.position.set(slot2X - 0.55, SHOP_TOP_Y + 0.46, centerZ - 0.05);
    const katanaMesh = createKatanaMeshGroup(this.assets);
    katanaMesh.scale.set(1.3, 1.3, 1.3);
    katanaMesh.rotation.set(0, 0, -Math.PI / 2 + 0.12);
    katanaMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) registerHitMesh(obj);
    });
    this.katanaDisplay.add(katanaMesh);
    this.rootGroup.add(this.katanaDisplay);
    addBox(0.08, 0.34, 0.2, slot2X - 0.38, SHOP_TOP_Y + 0.19, centerZ - 0.05, trimMat);
    addBox(0.08, 0.34, 0.2, slot2X + 0.38, SHOP_TOP_Y + 0.19, centerZ - 0.05, trimMat);

    // Khiên chắn 3D
    this.shieldDisplay = new THREE.Group();
    this.shieldDisplay.position.set(slot3X, SHOP_TOP_Y + 0.52, centerZ - 0.08);
    const shieldMesh = createShieldMeshGroup({
      geometries: this.assets.geometries,
      materials: this.assets.materials,
      textures: this.textures,
    });
    shieldMesh.scale.set(0.92, 0.92, 0.92);
    shieldMesh.rotation.set(-0.2, 0, 0);
    shieldMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) registerHitMesh(obj);
    });
    this.shieldDisplay.add(shieldMesh);
    this.rootGroup.add(this.shieldDisplay);
    addBox(0.5, 0.14, 0.3, slot3X, SHOP_TOP_Y + 0.1, centerZ - 0.08, trimMat);

    // Lọ thuốc hồi máu 3D
    this.potionDisplay = new THREE.Group();
    this.potionDisplay.position.set(slot4X, SHOP_TOP_Y + 0.15, centerZ - 0.05);
    const potionMesh = createPotionMeshGroup(this.assets);
    potionMesh.scale.set(1.6, 1.6, 1.6);
    potionMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) registerHitMesh(obj);
    });
    this.potionDisplay.add(potionMesh);
    this.rootGroup.add(this.potionDisplay);
    addBox(0.46, 0.1, 0.46, slot4X, SHOP_TOP_Y + 0.08, centerZ - 0.05, trimMat);

    this.scene.add(this.rootGroup);
  }

  private createMainShopSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('CỬA HÀNG THIẾT YẾU', canvas.width / 2, canvas.height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.textures.push(tex);
    return tex;
  }

  private createCounterPlaqueTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('CỬA HÀNG THIẾT YẾU', canvas.width / 2, canvas.height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.textures.push(tex);
    return tex;
  }

  raycastShop(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.0,
  ): { point: THREE.Vector3 } | null {
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    if (hits.length === 0) return null;
    if (!hits[0].object.userData.isEssentialShop) return null;
    return { point: hits[0].point };
  }

  isOwned(itemId: ShopItemId): boolean {
    if (itemId === 'backpack') return this.backpackOwned;
    if (itemId === 'katana') return this.katanaOwned;
    if (itemId === 'shield') return this.shieldOwned;
    return false;
  }

  markOwned(itemId: ShopItemId): void {
    if (itemId === 'backpack') {
      this.backpackOwned = true;
    } else if (itemId === 'katana') {
      this.katanaOwned = true;
    } else if (itemId === 'shield') {
      this.shieldOwned = true;
    }
  }

  getObstacleTopY(
    px: number,
    py: number,
    pz: number,
    playerHalfWidth: number,
    playerHeight = 1.75,
  ): number | null {
    if (
      px + playerHalfWidth > SHOP_MIN_X &&
      px - playerHalfWidth < SHOP_MAX_X &&
      pz + playerHalfWidth > SHOP_MIN_Z &&
      pz - playerHalfWidth < SHOP_MAX_Z &&
      py < SHOP_TOP_Y - 0.02 &&
      py + playerHeight > 4.0
    ) {
      return SHOP_TOP_Y;
    }
    return null;
  }

  dispose(): void {
    this.scene.remove(this.rootGroup);
    for (const geo of this.assets.geometries) {
      geo.dispose();
    }
    for (const mat of this.assets.materials) {
      mat.dispose();
    }
    for (const tex of this.textures) {
      tex.dispose();
    }
    this.assets.geometries.length = 0;
    this.assets.materials.length = 0;
    this.textures.length = 0;
  }
}
