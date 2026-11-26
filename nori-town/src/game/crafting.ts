import * as THREE from 'three';
import { createKatanaMeshGroup, KatanaAssetHandles } from './katana';
import { createParabolicEllipsoidGeometry, createParabolicLatheGeometry } from './parabolic';

export type CraftingRecipeId = 'leaf_katana';

export interface CraftingRecipe {
  id: CraftingRecipeId;
  name: string;
  subtitle: string;
  description: string;
  damageLabel: string;
  requirements: {
    mushrooms: number;
    slimeOrbs: number;
    woods: number;
  };
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'leaf_katana',
    name: 'Kiếm Lá',
    subtitle: '120 sát thương (+20%) · +20% tốc chạy',
    description:
      'Thanh katana rèn từ tinh chất thảo mộc rừng sâu với lưỡi kiếm xanh ngọc sắc bén. Gây 120 sát thương (+20% so với Katana thường) và tăng +20% tốc độ chạy.',
    damageLabel: '120 sát thương · +20% tốc chạy',
    requirements: {
      mushrooms: 3,
      slimeOrbs: 2,
      woods: 1,
    },
  },
];

export const CRAFTING_MIN_X = -14.8;
export const CRAFTING_MAX_X = -8.2;
export const CRAFTING_MIN_Z = -14.8;
export const CRAFTING_MAX_Z = -12.0;
export const CRAFTING_TOP_Y = 4.55;

/**
 * Khu Chế tạo ("Chế tạo") đặt tại bãi cỏ bên trái sân trong thành,
 * đối xứng khu vực Cửa hàng trang phục và thông thoáng 4 mặt.
 */
export class CraftingStation {
  private readonly scene: THREE.Scene;
  private readonly rootGroup = new THREE.Group();
  private readonly hitMeshes: THREE.Object3D[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly katanaAssets: KatanaAssetHandles = {
    geometries: [],
    materials: [],
    skeletons: [],
  };
  private readonly raycaster = new THREE.Raycaster();

  private readonly showcaseSword: THREE.Group;
  private readonly showcaseGlowRing: THREE.Mesh;
  private readonly hearthGlowMesh: THREE.Mesh;
  private elapsed = 0;

  constructor(scene: THREE.Scene, maxAnisotropy = 4) {
    this.scene = scene;

    const stoneBaseMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.86,
      metalness: 0.08,
    });
    const benchWoodMat = new THREE.MeshStandardMaterial({
      color: '#6b442a',
      roughness: 0.78,
      metalness: 0.05,
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: '#18181f',
      roughness: 0.52,
      metalness: 0.38,
    });
    const emeraldTrimMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      roughness: 0.34,
      metalness: 0.48,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      roughness: 0.34,
      metalness: 0.68,
    });
    const roofSlateMat = new THREE.MeshStandardMaterial({
      color: '#1a2e26',
      roughness: 0.68,
      metalness: 0.16,
    });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: '#dcfce7',
      emissive: '#34d399',
      emissiveIntensity: 1.35,
      roughness: 0.24,
    });
    const emberMat = new THREE.MeshStandardMaterial({
      color: '#fb923c',
      emissive: '#f97316',
      emissiveIntensity: 1.55,
      roughness: 0.25,
    });
    const anvilMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      roughness: 0.44,
      metalness: 0.65,
    });

    this.materials.push(
      stoneBaseMat,
      benchWoodMat,
      darkIronMat,
      emeraldTrimMat,
      goldMat,
      roofSlateMat,
      lanternMat,
      emberMat,
      anvilMat,
    );

    const registerHitMesh = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData.isCraftingStation = true;
          child.castShadow = true;
          child.receiveShadow = true;
          this.hitMeshes.push(child);
        }
      });
    };

    const addBox = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
    ): THREE.Mesh => {
      const geo = new THREE.BoxGeometry(w, h, d);
      this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      registerHitMesh(mesh);
      this.rootGroup.add(mesh);
      return mesh;
    };

    const centerX = (CRAFTING_MIN_X + CRAFTING_MAX_X) * 0.5;
    const centerZ = (CRAFTING_MIN_Z + CRAFTING_MAX_Z) * 0.5;
    const width = CRAFTING_MAX_X - CRAFTING_MIN_X;
    const depth = CRAFTING_MAX_Z - CRAFTING_MIN_Z;

    // 1. Sàn đá + gỗ xưởng chế tạo (y = 4.0 .. 4.55)
    addBox(width + 0.34, 0.16, depth + 0.34, centerX, 4.08, centerZ, stoneBaseMat);
    addBox(width, 0.3, depth, centerX, 4.3, centerZ, benchWoodMat);
    addBox(width + 0.08, 0.1, depth + 0.08, centerX, 4.5, centerZ, darkIronMat);
    addBox(width - 0.18, 0.06, 0.06, centerX, 4.42, CRAFTING_MAX_Z + 0.05, emeraldTrimMat);

    // 2. Bàn thợ rèn ở chính giữa-phải & lò rèn đá bên trái
    addBox(2.8, 0.82, 1.18, centerX + 0.35, CRAFTING_TOP_Y + 0.41, centerZ + 0.1, benchWoodMat);
    addBox(2.96, 0.1, 1.32, centerX + 0.35, CRAFTING_TOP_Y + 0.85, centerZ + 0.1, darkIronMat);

    // Lò nung đá nhỏ bên trái
    const forgeX = CRAFTING_MIN_X + 1.25;
    addBox(1.45, 1.35, 1.35, forgeX, CRAFTING_TOP_Y + 0.675, centerZ - 0.05, stoneBaseMat);
    addBox(1.56, 0.14, 1.46, forgeX, CRAFTING_TOP_Y + 1.38, centerZ - 0.05, darkIronMat);
    addBox(0.7, 1.15, 0.7, forgeX, CRAFTING_TOP_Y + 1.98, centerZ - 0.05, stoneBaseMat);
    this.hearthGlowMesh = addBox(
      0.72,
      0.48,
      0.24,
      forgeX,
      CRAFTING_TOP_Y + 0.66,
      centerZ + 0.54,
      emberMat,
    );

    // Đe rèn bên phải
    const anvilX = CRAFTING_MAX_X - 1.05;
    addBox(0.74, 0.24, 0.56, anvilX, CRAFTING_TOP_Y + 0.12, centerZ + 0.15, darkIronMat);
    addBox(0.46, 0.42, 0.34, anvilX, CRAFTING_TOP_Y + 0.44, centerZ + 0.15, anvilMat);
    addBox(0.92, 0.2, 0.42, anvilX, CRAFTING_TOP_Y + 0.72, centerZ + 0.15, anvilMat);

    // 3. 4 cột chống + mái che xưởng ngọc lục bảo
    const postH = 2.95;
    const postY = CRAFTING_TOP_Y + postH * 0.5;
    addBox(0.2, postH, 0.2, CRAFTING_MIN_X + 0.24, postY, CRAFTING_MAX_Z - 0.22, darkIronMat);
    addBox(0.2, postH, 0.2, CRAFTING_MAX_X - 0.24, postY, CRAFTING_MAX_Z - 0.22, darkIronMat);
    addBox(0.2, postH, 0.2, CRAFTING_MIN_X + 0.24, postY, CRAFTING_MIN_Z + 0.22, darkIronMat);
    addBox(0.2, postH, 0.2, CRAFTING_MAX_X - 0.24, postY, CRAFTING_MIN_Z + 0.22, darkIronMat);

    addBox(width + 0.65, 0.18, depth + 0.55, centerX, 7.56, centerZ, roofSlateMat);
    addBox(width - 0.35, 0.24, depth - 0.25, centerX, 7.76, centerZ, roofSlateMat);
    addBox(width + 0.68, 0.08, 0.08, centerX, 7.49, CRAFTING_MAX_Z + 0.26, emeraldTrimMat);

    // Đèn lồng xanh ngọc
    for (const lx of [CRAFTING_MIN_X + 0.24, CRAFTING_MAX_X - 0.24]) {
      addBox(0.1, 0.1, 0.26, lx, 6.76, CRAFTING_MAX_Z - 0.02, goldMat);
      addBox(0.22, 0.28, 0.22, lx, 6.54, CRAFTING_MAX_Z + 0.08, lanternMat);
    }

    // 4. Bảng hiệu "Chế tạo" ở mặt trước mái
    const signTex = this.createSignTexture(
      'Chế tạo',
      '#0f1f1a',
      '#34d399',
      '#ecfdf5',
      1024,
      192,
      78,
      maxAnisotropy,
    );
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.36,
      metalness: 0.12,
    });
    this.materials.push(signMat);

    addBox(5.2, 1.14, 0.16, centerX, 8.26, CRAFTING_MAX_Z - 0.06, darkIronMat);
    addBox(5.36, 0.1, 0.2, centerX, 8.84, CRAFTING_MAX_Z - 0.06, goldMat);
    addBox(5.36, 0.1, 0.2, centerX, 7.68, CRAFTING_MAX_Z - 0.06, goldMat);

    const signGeo = new THREE.PlaneGeometry(4.96, 0.96);
    this.geometries.push(signGeo);
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(centerX, 8.26, CRAFTING_MAX_Z + 0.03);
    registerHitMesh(signMesh);
    this.rootGroup.add(signMesh);

    // 5. Kiếm Lá trưng bày xoay lơ lửng phía trên bàn chế tạo
    const ringGeo = new THREE.RingGeometry(0.46, 0.56, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#4ade80',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    this.geometries.push(ringGeo);
    this.materials.push(ringMat);
    this.showcaseGlowRing = new THREE.Mesh(ringGeo, ringMat);
    this.showcaseGlowRing.position.set(centerX + 0.35, CRAFTING_TOP_Y + 0.92, centerZ + 0.1);
    registerHitMesh(this.showcaseGlowRing);
    this.rootGroup.add(this.showcaseGlowRing);

    this.showcaseSword = createKatanaMeshGroup(this.katanaAssets, false, 'leaf');
    this.showcaseSword.scale.setScalar(1.38);
    this.showcaseSword.position.set(centerX + 0.35, CRAFTING_TOP_Y + 1.48, centerZ + 0.1);
    this.showcaseSword.rotation.z = Math.PI * 0.18;
    registerHitMesh(this.showcaseSword);
    this.rootGroup.add(this.showcaseSword);

    // 6. Vật phẩm mẫu nhỏ trên bàn: Quả cầu slime xanh & Nấm đỏ
    const orbOuterGeo = new THREE.SphereGeometry(0.18, 18, 14);
    const orbOuterMat = new THREE.MeshPhysicalMaterial({
      color: '#bbf7d0',
      emissive: '#22c55e',
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.72,
      roughness: 0.15,
    });
    const orbCoreGeo = new THREE.SphereGeometry(0.1, 14, 12);
    const orbCoreMat = new THREE.MeshStandardMaterial({
      color: '#16a34a',
      emissive: '#15803d',
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });
    this.geometries.push(orbOuterGeo, orbCoreGeo);
    this.materials.push(orbOuterMat, orbCoreMat);
    const sampleOrb = new THREE.Mesh(orbOuterGeo, orbOuterMat);
    sampleOrb.position.set(centerX - 0.55, CRAFTING_TOP_Y + 1.07, centerZ + 0.22);
    sampleOrb.add(new THREE.Mesh(orbCoreGeo, orbCoreMat));
    registerHitMesh(sampleOrb);
    this.rootGroup.add(sampleOrb);

    const stemGeo = createParabolicLatheGeometry(0.2, 0.08, (t) => 1 - t * 0.25, 12, 5);
    const stemMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.75 });
    const capGeo = createParabolicEllipsoidGeometry(0.18, 0.13, 0.18, 16, 8);
    const capMat = new THREE.MeshStandardMaterial({ color: '#ea4326', roughness: 0.45 });
    this.geometries.push(stemGeo, capGeo);
    this.materials.push(stemMat, capMat);
    const sampleMush = new THREE.Group();
    const sMesh = new THREE.Mesh(stemGeo, stemMat);
    sMesh.position.y = 0.08;
    const cMesh = new THREE.Mesh(capGeo, capMat);
    cMesh.position.y = 0.22;
    sampleMush.add(sMesh, cMesh);
    sampleMush.position.set(centerX + 1.25, CRAFTING_TOP_Y + 0.9, centerZ + 0.22);
    registerHitMesh(sampleMush);
    this.rootGroup.add(sampleMush);

    this.scene.add(this.rootGroup);
  }

  private createSignTexture(
    text: string,
    bgHex: string,
    borderHex: string,
    textHex: string,
    width: number,
    height: number,
    fontSize: number,
    maxAnisotropy: number,
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = Math.max(4, Math.round(height * 0.055));
    ctx.strokeRect(8, 8, width - 16, height - 16);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textHex;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillText(text, width / 2, height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(4, maxAnisotropy);
    this.textures.push(tex);
    return tex;
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.showcaseSword.rotation.y += dt * 1.45;
    this.showcaseSword.position.y =
      CRAFTING_TOP_Y + 1.48 + Math.sin(this.elapsed * 2.4) * 0.08;
    const pulse = 1 + Math.sin(this.elapsed * 3.6) * 0.08;
    this.showcaseGlowRing.scale.set(pulse, 1, pulse);
    const emberMat = this.hearthGlowMesh.material as THREE.MeshStandardMaterial;
    emberMat.emissiveIntensity = 1.25 + Math.sin(this.elapsed * 7.2) * 0.32;
  }

  raycastStation(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.5,
  ): { point: THREE.Vector3 } | null {
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    if (hits.length === 0) return null;
    if (!hits[0].object.userData.isCraftingStation) return null;
    return { point: hits[0].point };
  }

  getObstacleTopY(
    px: number,
    py: number,
    pz: number,
    playerHalfWidth: number,
    playerHeight = 1.75,
  ): number | null {
    if (
      px + playerHalfWidth > CRAFTING_MIN_X &&
      px - playerHalfWidth < CRAFTING_MAX_X &&
      pz + playerHalfWidth > CRAFTING_MIN_Z &&
      pz - playerHalfWidth < CRAFTING_MAX_Z &&
      py < CRAFTING_TOP_Y - 0.02 &&
      py + playerHeight > 4.0
    ) {
      return CRAFTING_TOP_Y;
    }
    return null;
  }

  dispose(): void {
    this.scene.remove(this.rootGroup);
    for (const geo of this.katanaAssets.geometries) {
      geo.dispose();
    }
    for (const mat of this.katanaAssets.materials) {
      mat.dispose();
    }
    this.katanaAssets.geometries.length = 0;
    this.katanaAssets.materials.length = 0;
    for (const geo of this.geometries) {
      geo.dispose();
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
    for (const tex of this.textures) {
      tex.dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
  }
}
