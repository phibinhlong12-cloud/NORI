import * as THREE from 'three';
import {
  animateCharacterIdle,
  CharacterAssetHandles,
  createCharacterMeshGroup,
  disposeCharacterAssets,
} from './characterModel';
import { CharacterGender } from './firstPersonArms';
import { OutfitId } from './outfits';

export const OUTFIT_SHOP_MIN_X = 8.0;
export const OUTFIT_SHOP_MAX_X = 15.8;
export const OUTFIT_SHOP_MIN_Z = -15.2;
export const OUTFIT_SHOP_MAX_Z = -12.4;
export const OUTFIT_SHOP_TOP_Y = 4.42;

interface MannequinPreset {
  outfit: OutfitId;
  xOffset: number;
  label: string;
  border: string;
  text: string;
  yaw: number;
}

const MALE_MANNEQUINS: MannequinPreset[] = [
  {
    outfit: 'black_shinigami',
    xOffset: -1.85,
    label: 'HẮC Y KIẾM SĨ · 5.000 VNĐ',
    border: '#94a3b8',
    text: '#f8fafc',
    yaw: -0.22,
  },
  {
    outfit: 'red_samurai',
    xOffset: 1.85,
    label: 'HUYẾT PHONG · 10.000 VNĐ',
    border: '#f43f5e',
    text: '#fecdd3',
    yaw: -0.3,
  },
];

const FEMALE_MANNEQUINS: MannequinPreset[] = [
  {
    outfit: 'female_black',
    xOffset: -2.25,
    label: 'HẮC HOA KIMONO · 5.000 VNĐ',
    border: '#94a3b8',
    text: '#f8fafc',
    yaw: -0.18,
  },
  {
    outfit: 'female_red',
    xOffset: 0,
    label: 'HỒNG HOA KIMONO · 10.000 VNĐ',
    border: '#f43f5e',
    text: '#fecdd3',
    yaw: -0.22,
  },
  {
    outfit: 'female_white',
    xOffset: 2.25,
    label: 'BẠCH HOA KIMONO · 15.000 VNĐ',
    border: '#f8fafc',
    text: '#ffffff',
    yaw: -0.26,
  },
];

/**
 * Gian hàng "Cửa hàng trang phục" đặt ở khoảng cỏ phía trước Cửa hàng thiết yếu.
 * Tự động trưng bày 2 bộ trang phục Nam hoặc 3 bộ trang phục Nữ tương ứng nhân vật người chơi chọn.
 */
export class OutfitShop {
  private readonly scene: THREE.Scene;
  private readonly maxAnisotropy: number;
  private readonly rootGroup = new THREE.Group();
  private readonly displayGroup = new THREE.Group();
  private readonly staticHitMeshes: THREE.Object3D[] = [];
  private hitMeshes: THREE.Object3D[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly displayGeometries: THREE.BufferGeometry[] = [];
  private readonly displayMaterials: THREE.Material[] = [];
  private readonly displayTextures: THREE.Texture[] = [];
  private readonly charAssets: CharacterAssetHandles = {
    geometries: [],
    materials: [],
    textures: [],
    skeletons: [],
  };
  private readonly raycaster = new THREE.Raycaster();
  private readonly goldMat: THREE.MeshStandardMaterial;
  private readonly plinthMat: THREE.MeshStandardMaterial;

  private mannequins: THREE.Group[] = [];
  private displayGender: CharacterGender = 'male';
  private elapsed = 0;

  constructor(scene: THREE.Scene, maxAnisotropy = 4, initialGender: CharacterGender = 'male') {
    this.scene = scene;
    this.maxAnisotropy = maxAnisotropy;
    this.displayGender = initialGender;

    const stoneBaseMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.85,
      metalness: 0.08,
    });
    const stageWoodMat = new THREE.MeshStandardMaterial({
      color: '#5b3c28',
      roughness: 0.78,
      metalness: 0.05,
    });
    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: '#18181f',
      roughness: 0.55,
      metalness: 0.25,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#e11d48',
      roughness: 0.36,
      metalness: 0.55,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      roughness: 0.32,
      metalness: 0.7,
    });
    const roofSlateMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.68,
      metalness: 0.16,
    });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: '#ffe4e6',
      emissive: '#fb7185',
      emissiveIntensity: 1.35,
      roughness: 0.25,
    });
    const plinthMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.42,
      metalness: 0.35,
    });

    this.materials.push(
      stoneBaseMat,
      stageWoodMat,
      darkTrimMat,
      brassMat,
      goldMat,
      roofSlateMat,
      lanternMat,
      plinthMat,
    );

    this.goldMat = goldMat;
    this.plinthMat = plinthMat;

    const registerStaticHitMesh = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData.isOutfitShop = true;
          child.castShadow = true;
          child.receiveShadow = true;
          this.staticHitMeshes.push(child);
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
      registerStaticHitMesh(mesh);
      this.rootGroup.add(mesh);
      return mesh;
    };

    const centerX = (OUTFIT_SHOP_MIN_X + OUTFIT_SHOP_MAX_X) * 0.5;
    const centerZ = (OUTFIT_SHOP_MIN_Z + OUTFIT_SHOP_MAX_Z) * 0.5;
    const width = OUTFIT_SHOP_MAX_X - OUTFIT_SHOP_MIN_X;
    const depth = OUTFIT_SHOP_MAX_Z - OUTFIT_SHOP_MIN_Z;

    // 1. Sàn trưng bày thấp thoáng 4 mặt (y = 4.0 .. 4.42)
    addBox(width + 0.3, 0.14, depth + 0.3, centerX, 4.07, centerZ, stoneBaseMat);
    addBox(width, 0.22, depth, centerX, 4.25, centerZ, stageWoodMat);
    addBox(width + 0.08, 0.06, depth + 0.08, centerX, 4.39, centerZ, darkTrimMat);
    addBox(width - 0.2, 0.06, 0.06, centerX, 4.34, OUTFIT_SHOP_MAX_Z + 0.04, goldMat);

    // 2. 4 cột thanh mảnh chống mái che (không có vách sau để không che Cửa hàng thiết yếu)
    const postH = 3.02;
    const postY = OUTFIT_SHOP_TOP_Y + postH * 0.5;
    addBox(0.2, postH, 0.2, OUTFIT_SHOP_MIN_X + 0.24, postY, OUTFIT_SHOP_MAX_Z - 0.24, darkTrimMat);
    addBox(0.2, postH, 0.2, OUTFIT_SHOP_MAX_X - 0.24, postY, OUTFIT_SHOP_MAX_Z - 0.24, darkTrimMat);
    addBox(0.2, postH, 0.2, OUTFIT_SHOP_MIN_X + 0.24, postY, OUTFIT_SHOP_MIN_Z + 0.24, darkTrimMat);
    addBox(0.2, postH, 0.2, OUTFIT_SHOP_MAX_X - 0.24, postY, OUTFIT_SHOP_MIN_Z + 0.24, darkTrimMat);

    // Mái che Nhật Bản viền đỏ-vàng
    addBox(width + 0.65, 0.18, depth + 0.55, centerX, 7.52, centerZ, roofSlateMat);
    addBox(width - 0.4, 0.24, depth - 0.25, centerX, 7.72, centerZ, roofSlateMat);
    addBox(width + 0.68, 0.08, 0.08, centerX, 7.45, OUTFIT_SHOP_MAX_Z + 0.26, brassMat);

    // Đèn lồng hồng-vàng ấm trên 2 cột trước
    for (const lx of [OUTFIT_SHOP_MIN_X + 0.24, OUTFIT_SHOP_MAX_X - 0.24]) {
      addBox(0.1, 0.1, 0.26, lx, 6.72, OUTFIT_SHOP_MAX_Z - 0.02, goldMat);
      addBox(0.22, 0.28, 0.22, lx, 6.5, OUTFIT_SHOP_MAX_Z + 0.08, lanternMat);
    }

    // 3. Bảng tên chính phía trên mái: "CỬA HÀNG TRANG PHỤC"
    const mainSignTex = this.createSignTexture(
      'CỬA HÀNG TRANG PHỤC',
      '#141522',
      '#fb7185',
      '#fff1f2',
      1024,
      192,
      68,
    );
    const mainSignMat = new THREE.MeshStandardMaterial({
      map: mainSignTex,
      roughness: 0.38,
      metalness: 0.12,
    });
    this.materials.push(mainSignMat);

    addBox(6.4, 1.18, 0.16, centerX, 8.22, OUTFIT_SHOP_MAX_Z - 0.06, darkTrimMat);
    addBox(6.56, 0.1, 0.2, centerX, 8.82, OUTFIT_SHOP_MAX_Z - 0.06, goldMat);
    addBox(6.56, 0.1, 0.2, centerX, 7.62, OUTFIT_SHOP_MAX_Z - 0.06, goldMat);

    const mainSignGeo = new THREE.PlaneGeometry(6.14, 0.98);
    this.geometries.push(mainSignGeo);
    const mainSignMesh = new THREE.Mesh(mainSignGeo, mainSignMat);
    mainSignMesh.position.set(centerX, 8.22, OUTFIT_SHOP_MAX_Z + 0.03);
    registerStaticHitMesh(mainSignMesh);
    this.rootGroup.add(mainSignMesh);

    this.rootGroup.add(this.displayGroup);
    this.rebuildDisplayMannequins();

    this.scene.add(this.rootGroup);
  }

  setDisplayGender(gender: CharacterGender): void {
    if (this.displayGender === gender) return;
    this.displayGender = gender;
    this.rebuildDisplayMannequins();
  }

  private disposeDisplayGroup(): void {
    this.displayGroup.clear();
    this.mannequins = [];
    disposeCharacterAssets(this.charAssets);
    for (const geo of this.displayGeometries) {
      geo.dispose();
    }
    for (const mat of this.displayMaterials) {
      mat.dispose();
    }
    for (const tex of this.displayTextures) {
      tex.dispose();
    }
    this.displayGeometries.length = 0;
    this.displayMaterials.length = 0;
    this.displayTextures.length = 0;
  }

  private rebuildDisplayMannequins(): void {
    this.disposeDisplayGroup();

    const centerX = (OUTFIT_SHOP_MIN_X + OUTFIT_SHOP_MAX_X) * 0.5;
    const centerZ = (OUTFIT_SHOP_MIN_Z + OUTFIT_SHOP_MAX_Z) * 0.5;
    const isFemale = this.displayGender === 'female';
    const presets = isFemale ? FEMALE_MANNEQUINS : MALE_MANNEQUINS;

    const plinthRadius = isFemale ? 0.64 : 0.72;
    const plinthGeo = new THREE.CylinderGeometry(plinthRadius, plinthRadius + 0.08, 0.18, 24);
    const plinthRimGeo = new THREE.TorusGeometry(plinthRadius + 0.01, 0.02, 8, 28);
    plinthRimGeo.rotateX(Math.PI / 2);
    const plaqueGeo = new THREE.PlaneGeometry(isFemale ? 1.95 : 2.15, 0.34);
    this.displayGeometries.push(plinthGeo, plinthRimGeo, plaqueGeo);

    const displayHits: THREE.Object3D[] = [];
    const registerDisplayHits = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData.isOutfitShop = true;
          child.castShadow = true;
          child.receiveShadow = true;
          displayHits.push(child);
        }
      });
    };

    for (const cfg of presets) {
      const px = centerX + cfg.xOffset;

      const plinth = new THREE.Mesh(plinthGeo, this.plinthMat);
      plinth.position.set(px, OUTFIT_SHOP_TOP_Y + 0.09, centerZ - 0.05);
      registerDisplayHits(plinth);
      this.displayGroup.add(plinth);

      const rim = new THREE.Mesh(plinthRimGeo, this.goldMat);
      rim.position.set(px, OUTFIT_SHOP_TOP_Y + 0.18, centerZ - 0.05);
      registerDisplayHits(rim);
      this.displayGroup.add(rim);

      const mannequin = createCharacterMeshGroup(this.displayGender, this.charAssets, {
        outfit: cfg.outfit,
        maxAnisotropy: this.maxAnisotropy,
      });
      mannequin.position.set(px, OUTFIT_SHOP_TOP_Y + 0.18, centerZ - 0.05);
      mannequin.rotation.y = cfg.yaw;
      mannequin.scale.setScalar(isFemale ? 1.02 : 1.04);
      registerDisplayHits(mannequin);
      this.displayGroup.add(mannequin);
      this.mannequins.push(mannequin);

      const tex = this.createSignTexture(
        cfg.label,
        '#090d16',
        cfg.border,
        cfg.text,
        512,
        96,
        isFemale ? 29 : 34,
        this.displayTextures,
      );
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.4,
        metalness: 0.1,
      });
      this.displayMaterials.push(mat);

      const plaque = new THREE.Mesh(plaqueGeo, mat);
      plaque.position.set(px, OUTFIT_SHOP_TOP_Y + 0.24, OUTFIT_SHOP_MAX_Z - 0.22);
      plaque.rotation.x = -0.22;
      registerDisplayHits(plaque);
      this.displayGroup.add(plaque);
    }

    this.hitMeshes = [...this.staticHitMeshes, ...displayHits];
  }

  private createSignTexture(
    text: string,
    bgHex: string,
    borderHex: string,
    textHex: string,
    width: number,
    height: number,
    fontSize: number,
    targetTextures: THREE.Texture[] = this.textures,
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = Math.max(4, Math.round(height * 0.05));
    ctx.strokeRect(8, 8, width - 16, height - 16);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textHex;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillText(text, width / 2, height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    targetTextures.push(tex);
    return tex;
  }

  update(dt: number): void {
    this.elapsed += dt;
    for (let i = 0; i < this.mannequins.length; i++) {
      animateCharacterIdle(this.mannequins[i], this.elapsed + i * 1.15);
    }
  }

  raycastShop(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.5,
  ): { point: THREE.Vector3 } | null {
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    if (hits.length === 0) return null;
    if (!hits[0].object.userData.isOutfitShop) return null;
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
      px + playerHalfWidth > OUTFIT_SHOP_MIN_X &&
      px - playerHalfWidth < OUTFIT_SHOP_MAX_X &&
      pz + playerHalfWidth > OUTFIT_SHOP_MIN_Z &&
      pz - playerHalfWidth < OUTFIT_SHOP_MAX_Z &&
      py < OUTFIT_SHOP_TOP_Y - 0.02 &&
      py + playerHeight > 4.0
    ) {
      return OUTFIT_SHOP_TOP_Y;
    }
    return null;
  }

  dispose(): void {
    this.scene.remove(this.rootGroup);
    this.disposeDisplayGroup();
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
