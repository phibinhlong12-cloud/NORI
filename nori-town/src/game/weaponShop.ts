import * as THREE from 'three';
import { createKatanaMeshGroup, KatanaAssetHandles } from './katana';
import { createShieldMeshGroup } from './shield';

export type ShopItemId = 'backpack' | 'katana' | 'shield';

export const SHOP_ITEM_PRICES: Record<ShopItemId, number> = {
  backpack: 500,
  katana: 1000,
  shield: 600,
};

export const SHOP_ITEM_NAMES: Record<ShopItemId, string> = {
  backpack: 'Balo (9 ô)',
  katana: 'Katana',
  shield: 'Khiên chắn',
};

export const SHOP_MIN_X = 5.2;
export const SHOP_MAX_X = 15.3;
export const SHOP_MIN_Z = -21.55;
export const SHOP_MAX_Z = -19.25;
export const SHOP_TOP_Y = 5.18;

/**
 * Module Quầy Bán Vũ Khí đặt đối diện quầy thu ngân (góc phải bên trong cổng thành).
 * Không có NPC, gồm 3 khung vật phẩm:
 * Khung 1 (Balo - 500 VNĐ), Khung 2 (Katana - 1.000 VNĐ), Khung 3 (Khiên chắn - 600 VNĐ).
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
  private readonly backpackSignMat: THREE.MeshBasicMaterial;
  private readonly katanaSignMat: THREE.MeshBasicMaterial;
  private readonly shieldSignMat: THREE.MeshBasicMaterial;

  private backpackOwned = false;
  private katanaOwned = false;
  private shieldOwned = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const woodMat = new THREE.MeshLambertMaterial({ color: '#6d4c33' });
    const topMat = new THREE.MeshLambertMaterial({ color: '#1e293b' });
    const frameMat = new THREE.MeshLambertMaterial({ color: '#334155' });
    const pedestalMat = new THREE.MeshLambertMaterial({ color: '#475569' });
    const trimMat = new THREE.MeshLambertMaterial({ color: '#d97706' });
    const packBodyMat = new THREE.MeshLambertMaterial({ color: '#b45309' });
    const packPocketMat = new THREE.MeshLambertMaterial({ color: '#92400e' });
    const buckleMat = new THREE.MeshLambertMaterial({ color: '#fbbf24' });

    this.assets.materials.push(
      woodMat,
      topMat,
      frameMat,
      pedestalMat,
      trimMat,
      packBodyMat,
      packPocketMat,
      buckleMat,
    );

    const addBox = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      shopItem?: ShopItemId,
    ): THREE.Mesh => {
      const geo = new THREE.BoxGeometry(w, h, d);
      this.assets.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.rootGroup.add(mesh);
      if (shopItem) {
        mesh.userData.shopItem = shopItem;
        this.hitMeshes.push(mesh);
      }
      return mesh;
    };

    const centerX = (SHOP_MIN_X + SHOP_MAX_X) * 0.5;
    const centerZ = (SHOP_MIN_Z + SHOP_MAX_Z) * 0.5;
    const width = SHOP_MAX_X - SHOP_MIN_X;
    const depth = SHOP_MAX_Z - SHOP_MIN_Z;

    // 1. Thân quầy gỗ + mặt bàn đá tối màu
    addBox(width, 1.06, depth, centerX, 4.53, centerZ, woodMat);
    addBox(width + 0.08, 0.12, depth + 0.08, centerX, 5.12, centerZ, topMat);
    addBox(width - 0.24, 0.18, 0.06, centerX, 4.9, SHOP_MAX_Z + 0.02, trimMat);

    // 2. Tạo 3 khung trưng bày
    const buildFrame = (fx: number, shopItem: ShopItemId) => {
      const fw = 2.4;
      const fh = 1.65;
      const fd = 1.45;
      const baseTop = SHOP_TOP_Y;

      addBox(fw, 0.1, fd, fx, baseTop + 0.05, centerZ, pedestalMat, shopItem);
      addBox(fw, fh, 0.12, fx, baseTop + 0.1 + fh * 0.5, centerZ - fd * 0.5 + 0.06, frameMat, shopItem);
      addBox(0.12, fh, 0.16, fx - fw * 0.5 + 0.06, baseTop + 0.1 + fh * 0.5, centerZ - fd * 0.5 + 0.08, trimMat, shopItem);
      addBox(0.12, fh, 0.16, fx + fw * 0.5 - 0.06, baseTop + 0.1 + fh * 0.5, centerZ - fd * 0.5 + 0.08, trimMat, shopItem);
      addBox(fw, 0.12, 0.18, fx, baseTop + 0.1 + fh + 0.06, centerZ - fd * 0.5 + 0.08, trimMat, shopItem);
    };

    const frame1X = 7.15;
    const frame2X = 10.25;
    const frame3X = 13.35;
    buildFrame(frame1X, 'backpack');
    buildFrame(frame2X, 'katana');
    buildFrame(frame3X, 'shield');

    // 3. Vật phẩm khung 1: Balo 3D
    this.backpackDisplay = new THREE.Group();
    this.backpackDisplay.position.set(frame1X, SHOP_TOP_Y + 0.52, centerZ - 0.05);

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
      mesh.userData.shopItem = 'backpack';
      this.hitMeshes.push(mesh);
      this.backpackDisplay.add(mesh);
    };

    addPackPart(0.68, 0.82, 0.42, 0, 0, 0, packBodyMat);
    addPackPart(0.52, 0.36, 0.16, 0, -0.15, 0.25, packPocketMat);
    addPackPart(0.7, 0.14, 0.45, 0, 0.36, 0.02, packPocketMat);
    addPackPart(0.14, 0.1, 0.06, 0, 0.25, 0.25, buckleMat);
    addPackPart(0.1, 0.65, 0.08, -0.2, 0.02, -0.24, packPocketMat);
    addPackPart(0.1, 0.65, 0.08, 0.2, 0.02, -0.24, packPocketMat);
    this.rootGroup.add(this.backpackDisplay);

    // 4. Vật phẩm khung 2: Katana 3D đặt trên giá đỡ
    this.katanaDisplay = new THREE.Group();
    this.katanaDisplay.position.set(frame2X - 0.65, SHOP_TOP_Y + 0.62, centerZ + 0.05);
    const katanaMesh = createKatanaMeshGroup(this.assets);
    katanaMesh.scale.set(1.45, 1.45, 1.45);
    katanaMesh.rotation.set(0, 0, -Math.PI / 2 + 0.14);
    katanaMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.userData.shopItem = 'katana';
        this.hitMeshes.push(obj);
      }
    });
    this.katanaDisplay.add(katanaMesh);
    this.rootGroup.add(this.katanaDisplay);

    addBox(0.1, 0.42, 0.24, frame2X - 0.45, SHOP_TOP_Y + 0.31, centerZ + 0.05, trimMat, 'katana');
    addBox(0.1, 0.42, 0.24, frame2X + 0.45, SHOP_TOP_Y + 0.31, centerZ + 0.05, trimMat, 'katana');

    // 5. Vật phẩm khung 3: Khiên chắn 3D đặt trên giá đỡ
    this.shieldDisplay = new THREE.Group();
    this.shieldDisplay.position.set(frame3X, SHOP_TOP_Y + 0.64, centerZ + 0.04);
    const shieldMesh = createShieldMeshGroup({
      geometries: this.assets.geometries,
      materials: this.assets.materials,
      textures: this.textures,
    });
    shieldMesh.scale.set(1.05, 1.05, 1.05);
    shieldMesh.rotation.set(-0.18, 0, 0);
    shieldMesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.userData.shopItem = 'shield';
        this.hitMeshes.push(obj);
      }
    });
    this.shieldDisplay.add(shieldMesh);
    this.rootGroup.add(this.shieldDisplay);

    addBox(0.6, 0.18, 0.36, frame3X, SHOP_TOP_Y + 0.19, centerZ + 0.04, trimMat, 'shield');

    // 6. Bảng tên & giá tiền trên mỗi khung vật phẩm
    const sign1Tex = this.createPriceTexture('Khung 1 · Balo', '500 VNĐ', false);
    const sign2Tex = this.createPriceTexture('Khung 2 · Katana', '1.000 VNĐ', false);
    const sign3Tex = this.createPriceTexture('Khung 3 · Khiên chắn', '600 VNĐ', false);
    this.backpackSignMat = new THREE.MeshBasicMaterial({ map: sign1Tex });
    this.katanaSignMat = new THREE.MeshBasicMaterial({ map: sign2Tex });
    this.shieldSignMat = new THREE.MeshBasicMaterial({ map: sign3Tex });
    this.assets.materials.push(this.backpackSignMat, this.katanaSignMat, this.shieldSignMat);

    const signGeo = new THREE.PlaneGeometry(1.9, 0.68);
    this.assets.geometries.push(signGeo);

    const sign1 = new THREE.Mesh(signGeo, this.backpackSignMat);
    sign1.position.set(frame1X, SHOP_TOP_Y + 1.48, centerZ - 0.56);
    sign1.userData.shopItem = 'backpack';
    this.hitMeshes.push(sign1);
    this.rootGroup.add(sign1);

    const sign2 = new THREE.Mesh(signGeo, this.katanaSignMat);
    sign2.position.set(frame2X, SHOP_TOP_Y + 1.48, centerZ - 0.56);
    sign2.userData.shopItem = 'katana';
    this.hitMeshes.push(sign2);
    this.rootGroup.add(sign2);

    const sign3 = new THREE.Mesh(signGeo, this.shieldSignMat);
    sign3.position.set(frame3X, SHOP_TOP_Y + 1.48, centerZ - 0.56);
    sign3.userData.shopItem = 'shield';
    this.hitMeshes.push(sign3);
    this.rootGroup.add(sign3);

    // Bảng giá mặt trước quầy để dễ đọc từ xa
    const frontSignGeo = new THREE.PlaneGeometry(1.75, 0.62);
    this.assets.geometries.push(frontSignGeo);

    const frontSign1 = new THREE.Mesh(frontSignGeo, this.backpackSignMat);
    frontSign1.position.set(frame1X, 4.5, SHOP_MAX_Z + 0.02);
    frontSign1.userData.shopItem = 'backpack';
    this.hitMeshes.push(frontSign1);
    this.rootGroup.add(frontSign1);

    const frontSign2 = new THREE.Mesh(frontSignGeo, this.katanaSignMat);
    frontSign2.position.set(frame2X, 4.5, SHOP_MAX_Z + 0.02);
    frontSign2.userData.shopItem = 'katana';
    this.hitMeshes.push(frontSign2);
    this.rootGroup.add(frontSign2);

    const frontSign3 = new THREE.Mesh(frontSignGeo, this.shieldSignMat);
    frontSign3.position.set(frame3X, 4.5, SHOP_MAX_Z + 0.02);
    frontSign3.userData.shopItem = 'shield';
    this.hitMeshes.push(frontSign3);
    this.rootGroup.add(frontSign3);

    this.scene.add(this.rootGroup);
  }

  private createPriceTexture(
    title: string,
    priceLabel: string,
    owned: boolean,
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = owned ? '#0f172a' : '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = owned ? '#34d399' : '#f59e0b';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(title, canvas.width / 2, 62);

    ctx.fillStyle = owned ? '#34d399' : '#fbbf24';
    ctx.font = 'bold 52px monospace';
    ctx.fillText(owned ? 'ĐÃ SỞ HỮU' : priceLabel, canvas.width / 2, 132);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    return tex;
  }

  raycastItem(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.0,
  ): { itemId: ShopItemId; point: THREE.Vector3 } | null {
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    if (hits.length === 0) return null;

    const itemId = hits[0].object.userData.shopItem as ShopItemId | undefined;
    if (!itemId) return null;
    return { itemId, point: hits[0].point };
  }

  isOwned(itemId: ShopItemId): boolean {
    if (itemId === 'backpack') return this.backpackOwned;
    if (itemId === 'katana') return this.katanaOwned;
    return this.shieldOwned;
  }

  markOwned(itemId: ShopItemId): void {
    if (itemId === 'backpack' && !this.backpackOwned) {
      this.backpackOwned = true;
      this.backpackDisplay.visible = false;
      this.backpackSignMat.map = this.createPriceTexture('Khung 1 · Balo', '500 VNĐ', true);
      this.backpackSignMat.needsUpdate = true;
    } else if (itemId === 'katana' && !this.katanaOwned) {
      this.katanaOwned = true;
      this.katanaDisplay.visible = false;
      this.katanaSignMat.map = this.createPriceTexture('Khung 2 · Katana', '1.000 VNĐ', true);
      this.katanaSignMat.needsUpdate = true;
    } else if (itemId === 'shield' && !this.shieldOwned) {
      this.shieldOwned = true;
      this.shieldDisplay.visible = false;
      this.shieldSignMat.map = this.createPriceTexture('Khung 3 · Khiên chắn', '600 VNĐ', true);
      this.shieldSignMat.needsUpdate = true;
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
