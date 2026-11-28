import * as THREE from 'three';
import {
  createKatanaMeshGroup,
  ICE_KATANA_SLOW_MULTIPLIER,
  KatanaAssetHandles,
} from './katana';
import { OutsideGenerator } from './outside';
import {
  createParabolicEllipsoidGeometry,
  createParabolicLatheGeometry,
  createParabolicLimbXGeometry,
  createParabolicPlateGeometry,
} from './parabolic';
import { DRAGON_ZONE_SPEC } from './slimeZones';
import { createDragonScaleTexture, createSoftShadowTexture } from './textures';

export type DragonSkillId = 1 | 2 | 3;

export interface DragonAttackResult {
  hit: boolean;
  killed: boolean;
  blockedByLevel: boolean;
  xpReward: number;
  remainingHp: number;
  maxHp: number;
}

export interface DragonBossHudState {
  visible: boolean;
  alive: boolean;
  level: number;
  hp: number;
  maxHp: number;
  activeSkill: DragonSkillId | null;
  phase: 'idle' | 'telegraph' | 'execute' | 'recover';
  warningLabel: string | null;
  warningProgress: number;
  dropAvailable: boolean;
}

export interface DragonUpdateCallbacks {
  onPlayerHit?: (
    damage: number,
    skillId: DragonSkillId,
    shieldMitigated: boolean,
    dirX: number,
    dirZ: number,
  ) => void;
  onSkillWarning?: (skillId: DragonSkillId) => void;
  onSkillExecute?: (skillId: DragonSkillId) => void;
  canCollectIceKatana?: () => boolean;
  onIceKatanaBlocked?: () => void;
  onCollectIceKatana?: () => void;
}

export const DRAGON_MAX_HP = 10000;
export const DRAGON_LEVEL = 15;
export const DRAGON_MIN_ATTACK_LEVEL = 10;
const DRAGON_XP_REWARD = 5000;
const DRAGON_RESPAWN_SECONDS = 300.0;

const SKILL_TELEGRAPH_SECONDS = 1.0;
const SKILL1_TELEGRAPH_SECONDS = 2.0;
const SKILL1_RADIUS = 10.0;
const SKILL2_LENGTH = 21.0;
const SKILL2_HALF_WIDTH = 2.6;
const SKILL3_LENGTH = 26.0;
const SKILL3_HALF_WIDTH = 1.9;

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class DragonBossManager {
  private readonly scene: THREE.Scene;
  private readonly outside: OutsideGenerator;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];

  private readonly zoneRoot = new THREE.Group();
  private readonly dragonRoot = new THREE.Group();
  private readonly vfxRoot = new THREE.Group();
  private readonly dropRoot = new THREE.Group();

  // Bộ phận cấu trúc con rồng băng
  private readonly bodyGroup = new THREE.Group();
  private readonly neckGroup = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly jawGroup = new THREE.Group();
  private readonly mouthAnchor = new THREE.Object3D();
  private readonly leftWingGroup = new THREE.Group();
  private readonly rightWingGroup = new THREE.Group();
  private readonly leftOuterWing = new THREE.Group();
  private readonly rightOuterWing = new THREE.Group();
  private readonly tailSegments: THREE.Group[] = [];
  private readonly legs: THREE.Group[] = [];
  private readonly auraWisps: THREE.Group[] = [];
  private readonly tailFlames: THREE.Mesh[] = [];

  private readonly hitMeshes: THREE.Object3D[] = [];
  private readonly bodyColorMeshes: Array<{ mesh: THREE.Mesh; origMat: THREE.Material }> = [];
  private readonly hitFlashMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  private readonly dragonAuraLight: THREE.PointLight;
  private readonly contactShadowMesh: THREE.Mesh;
  private readonly labelSprite: THREE.Sprite;
  private readonly labelMaterials = new Map<string, THREE.SpriteMaterial>();

  // Vùng cảnh báo đỏ & hiệu ứng chiêu thức
  private readonly warnCircleFillMesh: THREE.Mesh;
  private readonly warnCircleBorderMesh: THREE.Mesh;
  private readonly warnCircleProgressMesh: THREE.Mesh;
  private readonly warnStripFillMesh: THREE.Mesh;
  private readonly warnStripBorderMesh: THREE.Mesh;
  private readonly shockwaveMesh: THREE.Mesh;
  private readonly breathGroup = new THREE.Group();
  private readonly breathOuterBeam: THREE.Mesh;
  private readonly breathInnerBeam: THREE.Mesh;
  private readonly breathShards: THREE.Mesh[] = [];

  // Vật phẩm Katana Băng rơi ra sau khi hạ rồng
  private readonly dropAssets: KatanaAssetHandles = { geometries: [], materials: [], textures: [] };
  private readonly dropKatanaGroup: THREE.Group;
  private readonly dropRingMesh: THREE.Mesh;
  private readonly dropHitSphere: THREE.Mesh;
  private dropActive = false;
  private dropState: 'idle' | 'flying' = 'idle';
  private dropX = DRAGON_ZONE_SPEC.x;
  private dropY = 4;
  private dropZ = DRAGON_ZONE_SPEC.z;
  private dropAge = 0;

  // Hiệu ứng đóng băng làm chậm (20%) khi trúng Katana Băng
  private readonly frostGroup = new THREE.Group();
  private readonly frostCrystals: THREE.Mesh[] = [];
  private slowTimer = 0;
  private frostAnimTime = 0;

  // Trạng thái Boss
  private alive = true;
  private hp = DRAGON_MAX_HP;
  private respawnTimer = 0;
  private x = DRAGON_ZONE_SPEC.x;
  private y = 4.0;
  private z = DRAGON_ZONE_SPEC.z;
  private yaw = 0; // hướng +Z mặc định của model
  private animTime = 0;
  private hitFlashTimer = 0;

  // Chu kỳ kỹ năng xen kẽ 1 -> 2 -> 3
  private nextSkillId: DragonSkillId = 1;
  private activeSkill: DragonSkillId | null = null;
  private skillPhase: 'idle' | 'telegraph' | 'execute' | 'recover' = 'idle';
  private skillTimer = 0;
  private skillCooldown = 1.6;

  private skillStartX = DRAGON_ZONE_SPEC.x;
  private skillStartZ = DRAGON_ZONE_SPEC.z;
  private skillTargetX = DRAGON_ZONE_SPEC.x;
  private skillTargetZ = DRAGON_ZONE_SPEC.z;
  private skillDirX = 0;
  private skillDirZ = 1;
  private skillHitDealt = false;
  private skillDuration = 0;

  private readonly raycaster = new THREE.Raycaster();
  private readonly tempVec = new THREE.Vector3();
  private readonly mouthWorldPos = new THREE.Vector3();
  private readonly breathTargetVec = new THREE.Vector3();

  constructor(scene: THREE.Scene, outside: OutsideGenerator, maxAnisotropy = 4) {
    this.scene = scene;
    this.outside = outside;

    this.materials.push(this.hitFlashMat);

    this.dragonAuraLight = new THREE.PointLight('#38bdf8', 5.5, 19, 1.4);
    this.dragonAuraLight.position.set(0, 3.2, 0.8);
    this.dragonRoot.add(this.dragonAuraLight);

    const shadowTex = createSoftShadowTexture();
    this.textures.push(shadowTex);
    const contactShadowGeo = new THREE.PlaneGeometry(7.2, 7.6);
    contactShadowGeo.rotateX(-Math.PI / 2);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.geometries.push(contactShadowGeo);
    this.materials.push(contactShadowMat);
    this.contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    this.vfxRoot.add(this.contactShadowMesh);

    const frostRingGeo = new THREE.RingGeometry(2.6, 3.15, 32);
    frostRingGeo.rotateX(-Math.PI / 2);
    const frostCrystalGeo = new THREE.OctahedronGeometry(0.42, 0);
    const frostRingMat = new THREE.MeshBasicMaterial({
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const frostCrystalMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: '#38bdf8',
      emissiveIntensity: 1.25,
      roughness: 0.14,
      metalness: 0.18,
      transparent: true,
      opacity: 0.88,
    });
    this.geometries.push(frostRingGeo, frostCrystalGeo);
    this.materials.push(frostRingMat, frostCrystalMat);

    const frostRingMesh = new THREE.Mesh(frostRingGeo, frostRingMat);
    frostRingMesh.position.y = 0.25;
    this.frostGroup.add(frostRingMesh);
    for (let fc = 0; fc < 6; fc++) {
      const ang = (fc / 6) * Math.PI * 2;
      const crystal = new THREE.Mesh(frostCrystalGeo, frostCrystalMat);
      crystal.position.set(Math.cos(ang) * 2.9, 1.9, Math.sin(ang) * 2.9);
      crystal.scale.set(0.72, 1.85, 0.72);
      this.frostGroup.add(crystal);
      this.frostCrystals.push(crystal);
    }
    this.frostGroup.visible = false;
    this.dragonRoot.add(this.frostGroup);

    this.buildBlueZone();
    this.buildDragonModel(maxAnisotropy);

    this.labelSprite = new THREE.Sprite(this.getLabelMaterial(DRAGON_MAX_HP));
    this.labelSprite.position.set(0, 6.45, 0);
    this.labelSprite.scale.set(4.9, 1.38, 1);
    this.labelSprite.visible = false;
    this.dragonRoot.add(this.labelSprite);

    const warnFillMat = new THREE.MeshBasicMaterial({
      color: '#ef4444',
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const warnBorderMat = new THREE.MeshBasicMaterial({
      color: '#ff2e2e',
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const warnProgMat = new THREE.MeshBasicMaterial({
      color: '#fca5a5',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shockMat = new THREE.MeshBasicMaterial({
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials.push(warnFillMat, warnBorderMat, warnProgMat, shockMat);

    this.warnCircleFillMesh = this.createDynamicGridMesh(8, 36, warnFillMat);
    this.warnCircleBorderMesh = this.createDynamicGridMesh(2, 40, warnBorderMat);
    this.warnCircleProgressMesh = this.createDynamicGridMesh(4, 36, warnProgMat);
    this.warnStripFillMesh = this.createDynamicStripMesh(10, 4, warnFillMat);
    this.warnStripBorderMesh = this.createDynamicStripMesh(10, 4, warnBorderMat);
    this.shockwaveMesh = this.createDynamicGridMesh(2, 42, shockMat);

    this.warnCircleFillMesh.visible = false;
    this.warnCircleBorderMesh.visible = false;
    this.warnCircleProgressMesh.visible = false;
    this.warnStripFillMesh.visible = false;
    this.warnStripBorderMesh.visible = false;
    this.shockwaveMesh.visible = false;

    this.vfxRoot.add(
      this.warnCircleFillMesh,
      this.warnCircleBorderMesh,
      this.warnCircleProgressMesh,
      this.warnStripFillMesh,
      this.warnStripBorderMesh,
      this.shockwaveMesh,
    );

    // Chùm tia lửa băng cho Skill 3
    const breathOuterMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const breathInnerMat = new THREE.MeshBasicMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const shardMat = new THREE.MeshBasicMaterial({ color: '#bae6fd' });
    this.materials.push(breathOuterMat, breathInnerMat, shardMat);

    const outerGeo = new THREE.CylinderGeometry(1.15, 0.45, SKILL3_LENGTH, 10, 1, true);
    outerGeo.rotateX(Math.PI / 2);
    outerGeo.translate(0, 0, SKILL3_LENGTH * 0.5);
    const innerGeo = new THREE.CylinderGeometry(0.55, 0.22, SKILL3_LENGTH, 8, 1, true);
    innerGeo.rotateX(Math.PI / 2);
    innerGeo.translate(0, 0, SKILL3_LENGTH * 0.5);
    const shardGeo = new THREE.OctahedronGeometry(0.38, 0);
    this.geometries.push(outerGeo, innerGeo, shardGeo);

    this.breathOuterBeam = new THREE.Mesh(outerGeo, breathOuterMat);
    this.breathInnerBeam = new THREE.Mesh(innerGeo, breathInnerMat);
    this.breathGroup.add(this.breathOuterBeam, this.breathInnerBeam);

    for (let i = 0; i < 14; i++) {
      const shard = new THREE.Mesh(shardGeo, shardMat);
      this.breathShards.push(shard);
      this.breathGroup.add(shard);
    }
    this.breathGroup.visible = false;
    this.vfxRoot.add(this.breathGroup);

    // Tạo sẵn vật phẩm Katana Băng rơi ra (ẩn đến khi boss chết)
    this.dropKatanaGroup = createKatanaMeshGroup(this.dropAssets, true);
    this.dropKatanaGroup.scale.set(1.55, 1.55, 1.55);
    this.dropKatanaGroup.rotation.set(0.35, 0, -0.45);
    this.dropRoot.add(this.dropKatanaGroup);

    const dropRingGeo = new THREE.RingGeometry(0.75, 1.15, 28);
    dropRingGeo.rotateX(-Math.PI / 2);
    const dropRingMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.geometries.push(dropRingGeo);
    this.materials.push(dropRingMat);
    this.dropRingMesh = new THREE.Mesh(dropRingGeo, dropRingMat);
    this.dropRingMesh.position.set(0, -0.7, 0);
    this.dropRoot.add(this.dropRingMesh);

    const dropHitGeo = new THREE.SphereGeometry(1.15, 10, 10);
    const dropHitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.geometries.push(dropHitGeo);
    this.materials.push(dropHitMat);
    this.dropHitSphere = new THREE.Mesh(dropHitGeo, dropHitMat);
    this.dropHitSphere.userData.isIceKatanaDrop = true;
    this.dropRoot.add(this.dropHitSphere);

    const dropLabelMat = this.createDropLabelMaterial();
    const dropLabel = new THREE.Sprite(dropLabelMat);
    dropLabel.position.set(0, 1.55, 0);
    dropLabel.scale.set(3.4, 0.85, 1);
    this.dropRoot.add(dropLabel);

    this.dropRoot.visible = false;

    this.y = this.outside.getHeightAt(this.x, this.z);
    this.dragonRoot.position.set(this.x, this.y, this.z);

    this.scene.add(this.zoneRoot);
    this.scene.add(this.dragonRoot);
    this.scene.add(this.vfxRoot);
    this.scene.add(this.dropRoot);
  }

  private buildBlueZone(): void {
    const fillMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials.push(fillMat, ringMat);

    const disc = this.buildTerrainDiscMesh(
      DRAGON_ZONE_SPEC.x,
      DRAGON_ZONE_SPEC.z,
      0,
      DRAGON_ZONE_SPEC.radius,
      14,
      64,
      0.05,
      fillMat,
    );
    const ring = this.buildTerrainDiscMesh(
      DRAGON_ZONE_SPEC.x,
      DRAGON_ZONE_SPEC.z,
      DRAGON_ZONE_SPEC.radius - 0.7,
      DRAGON_ZONE_SPEC.radius + 0.35,
      2,
      72,
      0.1,
      ringMat,
    );
    this.zoneRoot.add(disc, ring);

    this.buildGlacialIcebergs();
  }

  private buildGlacialIcebergs(): void {
    const iceCrystalMat = new THREE.MeshPhysicalMaterial({
      color: '#7dd3fc',
      emissive: '#0c4a6e',
      emissiveIntensity: 0.22,
      roughness: 0.16,
      metalness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.14,
      flatShading: true,
    });
    const deepIceMat = new THREE.MeshPhysicalMaterial({
      color: '#38bdf8',
      emissive: '#075985',
      emissiveIntensity: 0.25,
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 0.95,
      flatShading: true,
    });
    const frostBaseMat = new THREE.MeshStandardMaterial({
      color: '#e6f6ff',
      roughness: 0.78,
      metalness: 0.02,
    });
    this.materials.push(iceCrystalMat, deepIceMat, frostBaseMat);

    // Hình học dùng chung cho các cụm tảng băng đa diện (không dùng khối hộp 90 độ)
    const spireGeo6 = new THREE.CylinderGeometry(0.08, 1.0, 1.0, 6);
    spireGeo6.translate(0, 0.5, 0);
    const spireGeo5 = new THREE.CylinderGeometry(0.14, 0.95, 1.0, 5);
    spireGeo5.translate(0, 0.5, 0);
    const slabGeo = new THREE.CylinderGeometry(0.55, 1.05, 1.0, 7);
    slabGeo.translate(0, 0.5, 0);
    const moundGeo = new THREE.SphereGeometry(1.0, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.52);
    this.geometries.push(spireGeo6, spireGeo5, slabGeo, moundGeo);

    const addIceCluster = (
      wx: number,
      wz: number,
      mainRadius: number,
      mainHeight: number,
      seedAngle: number,
      subCount: number,
    ) => {
      const groundY = this.outside.getHeightAt(wx, wz);
      const cluster = new THREE.Group();
      cluster.position.set(wx, groundY - 0.32, wz);

      // Gò tuyết/băng đệm hình parabol mượt ở chân tảng băng
      const mound = new THREE.Mesh(moundGeo, frostBaseMat);
      mound.scale.set(mainRadius * 1.48, Math.max(0.65, mainRadius * 0.44), mainRadius * 1.42);
      mound.rotation.y = seedAngle;
      mound.receiveShadow = true;
      cluster.add(mound);

      // Mũi băng pha lê chính hơi nghiêng tự nhiên
      const mainSpire = new THREE.Mesh(spireGeo6, iceCrystalMat);
      mainSpire.scale.set(mainRadius, mainHeight, mainRadius * 0.88);
      mainSpire.rotation.set(
        Math.sin(seedAngle) * 0.14,
        seedAngle,
        Math.cos(seedAngle) * 0.12,
      );
      mainSpire.castShadow = true;
      mainSpire.receiveShadow = true;
      cluster.add(mainSpire);

      // Các tinh thể băng phụ xung quanh tạo khối nhô cao nhiều tầng
      for (let i = 0; i < subCount; i++) {
        const a = seedAngle + (i / subCount) * Math.PI * 2 + (i % 2 === 0 ? 0.25 : -0.2);
        const offsetDist = mainRadius * (0.62 + (i % 3) * 0.16);
        const subR = mainRadius * (0.48 + ((i * 37) % 10) * 0.03);
        const subH = mainHeight * (0.42 + ((i * 53) % 10) * 0.045);
        const geo = i % 3 === 0 ? slabGeo : spireGeo5;
        const mat = i % 2 === 0 ? deepIceMat : iceCrystalMat;
        const sub = new THREE.Mesh(geo, mat);
        sub.position.set(Math.cos(a) * offsetDist, 0, Math.sin(a) * offsetDist);
        sub.scale.set(subR, subH, subR * 0.86);
        sub.rotation.set(Math.sin(a) * 0.24, a + 0.4, -Math.cos(a) * 0.22);
        sub.castShadow = true;
        sub.receiveShadow = true;
        cluster.add(sub);
      }

      this.zoneRoot.add(cluster);
    };

    // Vành đai tảng băng lớn bao quanh viền Lãnh Địa Rồng Băng (chừa lối vào phía Nam z > +24 hướng từ thành đi tới)
    const outerClusters = 18;
    for (let i = 0; i < outerClusters; i++) {
      const theta = (i / outerClusters) * Math.PI * 2;
      // Chừa cổng vào phía +Z (theta gần PI/2)
      const angleDiffSouth = Math.abs(Math.atan2(Math.sin(theta - Math.PI / 2), Math.cos(theta - Math.PI / 2)));
      if (angleDiffSouth < 0.36) continue;

      const r = DRAGON_ZONE_SPEC.radius - 1.2 + (i % 3) * 1.45;
      const wx = DRAGON_ZONE_SPEC.x + Math.cos(theta) * r;
      const wz = DRAGON_ZONE_SPEC.z + Math.sin(theta) * r;
      const mainR = 1.55 + (i % 4) * 0.36;
      const mainH = 4.6 + (i % 5) * 1.35;
      addIceCluster(wx, wz, mainR, mainH, theta + i * 0.7, 3);
    }

    // Các cụm mỏm băng nhô cao bên trong vùng (gắn sát rìa các gò băng cao, tránh vùng chiến đấu trung tâm)
    const innerClusters: Array<[number, number, number, number]> = [
      [-18.5, -9.5, 1.35, 3.8],
      [19.2, -8.2, 1.3, 3.6],
      [-23.5, 7.5, 1.45, 4.1],
      [23.8, 8.0, 1.4, 3.9],
      [-4.2, -23.0, 1.65, 5.2],
      [4.8, -22.5, 1.55, 4.8],
      [-15.8, 15.8, 1.2, 3.2],
      [16.5, 16.0, 1.2, 3.3],
    ];
    for (let i = 0; i < innerClusters.length; i++) {
      const [dx, dz, rad, h] = innerClusters[i];
      addIceCluster(
        DRAGON_ZONE_SPEC.x + dx,
        DRAGON_ZONE_SPEC.z + dz,
        rad,
        h,
        i * 1.15,
        2,
      );
    }
  }

  private buildTerrainDiscMesh(
    cx: number,
    cz: number,
    innerR: number,
    outerR: number,
    radialSteps: number,
    angularSteps: number,
    yOffset: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const rings = radialSteps + 1;
    const cols = angularSteps + 1;
    const positions = new Float32Array(rings * cols * 3);
    const indices: number[] = [];

    let ptr = 0;
    for (let rIdx = 0; rIdx < rings; rIdx++) {
      const r = innerR + ((outerR - innerR) * rIdx) / radialSteps;
      for (let aIdx = 0; aIdx < cols; aIdx++) {
        const theta = (aIdx / angularSteps) * Math.PI * 2;
        const wx = cx + Math.cos(theta) * r;
        const wz = cz + Math.sin(theta) * r;
        const wy = this.outside.getHeightAt(wx, wz) + yOffset;
        positions[ptr++] = wx;
        positions[ptr++] = wy;
        positions[ptr++] = wz;
      }
    }

    for (let rIdx = 0; rIdx < radialSteps; rIdx++) {
      for (let aIdx = 0; aIdx < angularSteps; aIdx++) {
        const a = rIdx * cols + aIdx;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    this.geometries.push(geo);

    const mesh = new THREE.Mesh(geo, material);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }

  private createDynamicGridMesh(
    radialSteps: number,
    angularSteps: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const rings = radialSteps + 1;
    const cols = angularSteps + 1;
    const positions = new Float32Array(rings * cols * 3);
    const indices: number[] = [];

    for (let rIdx = 0; rIdx < radialSteps; rIdx++) {
      for (let aIdx = 0; aIdx < angularSteps; aIdx++) {
        const a = rIdx * cols + aIdx;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    this.geometries.push(geo);

    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.userData.radialSteps = radialSteps;
    mesh.userData.angularSteps = angularSteps;
    return mesh;
  }

  private updateTerrainCircle(
    mesh: THREE.Mesh,
    cx: number,
    cz: number,
    innerR: number,
    outerR: number,
    yOffset: number,
  ): void {
    const radialSteps = mesh.userData.radialSteps as number;
    const angularSteps = mesh.userData.angularSteps as number;
    const rings = radialSteps + 1;
    const cols = angularSteps + 1;
    const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    let ptr = 0;
    for (let rIdx = 0; rIdx < rings; rIdx++) {
      const r = innerR + ((outerR - innerR) * rIdx) / radialSteps;
      for (let aIdx = 0; aIdx < cols; aIdx++) {
        const theta = (aIdx / angularSteps) * Math.PI * 2;
        const wx = cx + Math.cos(theta) * r;
        const wz = cz + Math.sin(theta) * r;
        const wy = this.outside.getHeightAt(wx, wz) + yOffset;
        arr[ptr++] = wx;
        arr[ptr++] = wy;
        arr[ptr++] = wz;
      }
    }
    posAttr.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }

  private createDynamicStripMesh(
    lengthSteps: number,
    widthSteps: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const rows = lengthSteps + 1;
    const cols = widthSteps + 1;
    const positions = new Float32Array(rows * cols * 3);
    const indices: number[] = [];

    for (let l = 0; l < lengthSteps; l++) {
      for (let w = 0; w < widthSteps; w++) {
        const a = l * cols + w;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    this.geometries.push(geo);

    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.userData.lengthSteps = lengthSteps;
    mesh.userData.widthSteps = widthSteps;
    return mesh;
  }

  private updateTerrainStrip(
    mesh: THREE.Mesh,
    startX: number,
    startZ: number,
    dirX: number,
    dirZ: number,
    length: number,
    halfWidth: number,
    yOffset: number,
  ): void {
    const lengthSteps = mesh.userData.lengthSteps as number;
    const widthSteps = mesh.userData.widthSteps as number;
    const rows = lengthSteps + 1;
    const cols = widthSteps + 1;
    const perpX = -dirZ;
    const perpZ = dirX;

    const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    let ptr = 0;

    for (let l = 0; l < rows; l++) {
      const along = (l / lengthSteps) * length;
      const cx = startX + dirX * along;
      const cz = startZ + dirZ * along;
      for (let w = 0; w < cols; w++) {
        const across = ((w / widthSteps) * 2 - 1) * halfWidth;
        const wx = cx + perpX * across;
        const wz = cz + perpZ * across;
        const wy = this.outside.getHeightAt(wx, wz) + yOffset;
        arr[ptr++] = wx;
        arr[ptr++] = wy;
        arr[ptr++] = wz;
      }
    }
    posAttr.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }

  private addDragonPart(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    registerHit = true,
    castShadow = true,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (registerHit) {
      mesh.userData.isDragon = true;
      this.hitMeshes.push(mesh);
      this.bodyColorMeshes.push({ mesh, origMat: mat });
    }
    return mesh;
  }

  private buildDragonModel(maxAnisotropy = 4): void {
    // Vảy rồng procedurally textured + vật liệu PBR ánh kim băng giá + tinh thể phát sáng
    const navyScaleTex = createDragonScaleTexture('#09294a', '#041427', '#2678b8', maxAnisotropy);
    const azureScaleTex = createDragonScaleTexture('#0d5084', '#062c4d', '#54c5f8', maxAnisotropy);
    this.textures.push(navyScaleTex, azureScaleTex);

    const deepNavyMat = new THREE.MeshStandardMaterial({
      map: navyScaleTex,
      roughness: 0.44,
      metalness: 0.24,
    });
    const scaleAzureMat = new THREE.MeshStandardMaterial({
      map: azureScaleTex,
      roughness: 0.36,
      metalness: 0.28,
    });
    const brightBlueMat = new THREE.MeshStandardMaterial({
      color: '#0284c7',
      roughness: 0.34,
      metalness: 0.24,
    });
    const electricCyanMat = new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      emissive: '#0284c7',
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0.35,
    });
    const silverScaleMat = new THREE.MeshPhysicalMaterial({
      color: '#dbeafe',
      roughness: 0.26,
      metalness: 0.28,
      clearcoat: 0.75,
      clearcoatRoughness: 0.15,
    });
    const frostWhiteMat = new THREE.MeshPhysicalMaterial({
      color: '#f0f9ff',
      roughness: 0.22,
      metalness: 0.22,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
    });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: '#7dd3fc',
      emissive: '#38bdf8',
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.3,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      emissive: '#38bdf8',
      emissiveIntensity: 1.8,
      roughness: 0.1,
    });
    const wingMembraneMat = new THREE.MeshPhysicalMaterial({
      color: '#075985',
      emissive: '#0284c7',
      emissiveIntensity: 0.28,
      roughness: 0.28,
      metalness: 0.1,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const flameMat = new THREE.MeshBasicMaterial({
      color: '#00a8ff',
      transparent: true,
      opacity: 0.88,
    });
    const flameCoreMat = new THREE.MeshBasicMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.95,
    });
    this.materials.push(
      deepNavyMat,
      scaleAzureMat,
      brightBlueMat,
      electricCyanMat,
      silverScaleMat,
      frostWhiteMat,
      crystalMat,
      eyeMat,
      wingMembraneMat,
      flameMat,
      flameCoreMat,
    );

    // 1. Thân rồng parabol uốn lượn + giáp vai + vảy bụng trắng bạc cong mượt + bờm gai sống lưng băng phát sáng
    const torsoGeo = createParabolicEllipsoidGeometry(2.2, 1.78, 3.9, 20, 14);
    const chestGeo = createParabolicEllipsoidGeometry(2.56, 1.92, 2.25, 20, 14);
    const pauldronGeo = createParabolicPlateGeometry(0.92, 0.72, 1.42);
    const waistGeo = createParabolicEllipsoidGeometry(1.82, 1.46, 1.56, 18, 12);
    const bellyPlateGeo = createParabolicPlateGeometry(1.74, 0.36, 0.78);
    const dorsalBladeGeo = createParabolicLatheGeometry(
      1.26,
      0.24,
      (t) => Math.pow(Math.max(0, 1 - t), 0.72),
      10,
      10,
      true,
    );
    this.geometries.push(torsoGeo, chestGeo, pauldronGeo, waistGeo, bellyPlateGeo, dorsalBladeGeo);

    this.addDragonPart(this.bodyGroup, torsoGeo, deepNavyMat, 0, 2.45, -0.1, -0.06, 0, 0);
    this.addDragonPart(this.bodyGroup, chestGeo, scaleAzureMat, 0, 2.75, 1.25, -0.18, 0, 0);
    this.addDragonPart(this.bodyGroup, pauldronGeo, silverScaleMat, -1.24, 3.15, 1.15, -0.15, 0, 0.28);
    this.addDragonPart(this.bodyGroup, pauldronGeo, silverScaleMat, 1.24, 3.15, 1.15, -0.15, 0, -0.28);
    this.addDragonPart(this.bodyGroup, waistGeo, deepNavyMat, 0, 2.15, -1.75, 0.1, 0, 0);

    // Các đốt vảy bụng trắng bạc xếp lớp dưới ngực & bụng
    for (let i = 0; i < 6; i++) {
      this.addDragonPart(
        this.bodyGroup,
        bellyPlateGeo,
        i % 2 === 0 ? frostWhiteMat : silverScaleMat,
        0,
        1.52 + i * 0.14,
        -1.5 + i * 0.62,
        -0.18,
        0,
        0,
      );
    }

    // Sống gai băng dọc lưng hướng ngược ra sau
    for (let i = 0; i < 6; i++) {
      this.addDragonPart(
        this.bodyGroup,
        dorsalBladeGeo,
        i < 2 ? silverScaleMat : electricCyanMat,
        0,
        3.62 - i * 0.1,
        1.6 - i * 0.68,
        -0.65,
        Math.PI / 4,
        0,
      );
    }

    // 2. Bốn chân mạnh mẽ với đùi gân guốc parabol + 3 móng vuốt sắc cong
    const thighGeo = createParabolicEllipsoidGeometry(0.82, 1.32, 0.9, 14, 10);
    const shinGeo = createParabolicEllipsoidGeometry(0.56, 1.22, 0.62, 14, 10);
    const palmGeo = createParabolicPlateGeometry(0.78, 0.34, 0.82);
    const talonGeo = createParabolicLatheGeometry(
      0.62,
      0.11,
      (t) => Math.pow(Math.max(0, 1 - t), 0.7),
      10,
      8,
      true,
    );
    this.geometries.push(thighGeo, shinGeo, palmGeo, talonGeo);

    const legConfigs: Array<{ x: number; y: number; z: number; isFront: boolean }> = [
      { x: -1.18, y: 2.15, z: 1.5, isFront: true },
      { x: 1.18, y: 2.15, z: 1.5, isFront: true },
      { x: -1.06, y: 1.95, z: -1.45, isFront: false },
      { x: 1.06, y: 1.95, z: -1.45, isFront: false },
    ];
    for (const cfg of legConfigs) {
      const legPivot = new THREE.Group();
      legPivot.position.set(cfg.x, cfg.y, cfg.z);
      this.addDragonPart(
        legPivot,
        thighGeo,
        scaleAzureMat,
        0,
        -0.45,
        cfg.isFront ? 0.12 : -0.1,
        cfg.isFront ? -0.25 : 0.25,
        0,
        0,
      );
      this.addDragonPart(
        legPivot,
        shinGeo,
        deepNavyMat,
        0,
        -1.22,
        cfg.isFront ? 0.28 : 0.08,
        0.22,
        0,
        0,
      );
      this.addDragonPart(
        legPivot,
        palmGeo,
        silverScaleMat,
        0,
        -1.82,
        cfg.isFront ? 0.42 : 0.28,
      );
      // 3 móng vuốt cong vươn ra trước
      for (const tx of [-0.24, 0, 0.24]) {
        this.addDragonPart(
          legPivot,
          talonGeo,
          frostWhiteMat,
          tx,
          -1.88,
          (cfg.isFront ? 0.42 : 0.28) + 0.52,
          Math.PI * 0.56,
          0,
          0,
        );
      }
      this.legs.push(legPivot);
      this.bodyGroup.add(legPivot);
    }

    // 3. Cổ chữ S vươn cao + Đầu rồng parabol mượt với sừng phân nhánh & bờm xanh lam
    this.neckGroup.position.set(0, 3.1, 1.95);
    const neckLowerGeo = createParabolicEllipsoidGeometry(1.38, 1.46, 1.34, 16, 12);
    const neckMidGeo = createParabolicEllipsoidGeometry(1.18, 1.42, 1.24, 16, 12);
    const neckPlateGeo = createParabolicPlateGeometry(1.1, 0.32, 0.76);
    const manePlumeGeo = createParabolicLatheGeometry(
      1.3,
      0.22,
      (t) => Math.pow(Math.max(0, 1 - t), 0.75),
      10,
      8,
      true,
    );
    this.geometries.push(neckLowerGeo, neckMidGeo, neckPlateGeo, manePlumeGeo);

    this.addDragonPart(this.neckGroup, neckLowerGeo, deepNavyMat, 0, 0.52, 0.45, -0.28, 0, 0);
    this.addDragonPart(this.neckGroup, neckMidGeo, scaleAzureMat, 0, 1.52, 0.85, 0.22, 0, 0);
    // Vảy cổ trắng bạc giống mẫu
    for (let i = 0; i < 4; i++) {
      this.addDragonPart(
        this.neckGroup,
        neckPlateGeo,
        frostWhiteMat,
        0,
        0.38 + i * 0.48,
        0.82 + i * 0.14,
        -0.75 + i * 0.12,
        0,
        0,
      );
      this.addDragonPart(
        this.neckGroup,
        manePlumeGeo,
        i % 2 === 0 ? electricCyanMat : deepNavyMat,
        0,
        0.55 + i * 0.46,
        -0.12 + i * 0.18,
        -0.9,
        Math.PI / 4,
        0,
      );
    }

    // Đầu rồng chi tiết: hộp sọ parabol thuôn mượt, mõm dài có nanh, râu cằm, 4 sừng lớn & mắt xanh phát sáng
    this.headGroup.position.set(0, 2.15, 1.05);
    const headSkullGeo = createParabolicEllipsoidGeometry(1.54, 1.12, 1.58, 18, 12);
    const browRidgeGeo = createParabolicPlateGeometry(1.64, 0.3, 1.14);
    const snoutGeo = createParabolicEllipsoidGeometry(1.04, 0.64, 1.48, 16, 12);
    const snoutTipGeo = createParabolicEllipsoidGeometry(0.82, 0.5, 0.62, 14, 10);
    const jawGeo = createParabolicPlateGeometry(0.92, 0.34, 1.32);
    const mainHornGeo = createParabolicLatheGeometry(
      2.2,
      0.22,
      (t) => Math.pow(Math.max(0, 1 - t), 0.72),
      12,
      10,
      true,
    );
    const sideHornGeo = createParabolicLatheGeometry(
      1.45,
      0.15,
      (t) => Math.pow(Math.max(0, 1 - t), 0.72),
      10,
      8,
      true,
    );
    const fangGeo = createParabolicLatheGeometry(
      0.34,
      0.08,
      (t) => Math.pow(Math.max(0, 1 - t), 0.7),
      10,
      6,
      true,
    );
    const beardGeo = createParabolicLatheGeometry(
      0.65,
      0.14,
      (t) => Math.pow(Math.max(0, 1 - t), 0.7),
      10,
      8,
      true,
    );
    const eyeGeo = createParabolicEllipsoidGeometry(0.24, 0.22, 0.42, 12, 10);
    this.geometries.push(
      headSkullGeo,
      browRidgeGeo,
      snoutGeo,
      snoutTipGeo,
      jawGeo,
      mainHornGeo,
      sideHornGeo,
      fangGeo,
      beardGeo,
      eyeGeo,
    );

    this.addDragonPart(this.headGroup, headSkullGeo, deepNavyMat, 0, 0.15, 0.45);
    this.addDragonPart(this.headGroup, browRidgeGeo, silverScaleMat, 0, 0.56, 0.68, 0.12, 0, 0);
    this.addDragonPart(this.headGroup, snoutGeo, scaleAzureMat, 0, 0.12, 1.55);
    this.addDragonPart(this.headGroup, snoutTipGeo, silverScaleMat, 0, 0.18, 2.25);

    // Sừng chính dài vươn ra sau + sừng phụ chẻ nhánh + sừng mũi uy lực
    this.addDragonPart(this.headGroup, mainHornGeo, silverScaleMat, -0.5, 1.15, -0.25, -0.95, 0, 0.24);
    this.addDragonPart(this.headGroup, mainHornGeo, silverScaleMat, 0.5, 1.15, -0.25, -0.95, 0, -0.24);
    this.addDragonPart(this.headGroup, sideHornGeo, electricCyanMat, -0.72, 0.62, -0.15, -1.1, 0, 0.52);
    this.addDragonPart(this.headGroup, sideHornGeo, electricCyanMat, 0.72, 0.62, -0.15, -1.1, 0, -0.52);
    this.addDragonPart(this.headGroup, sideHornGeo, crystalMat, 0, 0.85, -0.35, -1.0, 0, 0);
    const nasalHornGeo = new THREE.ConeGeometry(0.11, 0.55, 5);
    this.geometries.push(nasalHornGeo);
    this.addDragonPart(this.headGroup, nasalHornGeo, crystalMat, 0, 0.55, 2.24, 0.55, 0, 0);

    // Mắt xanh phát sáng + răng nanh
    this.addDragonPart(this.headGroup, eyeGeo, eyeMat, -0.72, 0.32, 0.88);
    this.addDragonPart(this.headGroup, eyeGeo, eyeMat, 0.72, 0.32, 0.88);
    this.addDragonPart(this.headGroup, fangGeo, frostWhiteMat, -0.34, -0.18, 2.08, Math.PI, 0, 0);
    this.addDragonPart(this.headGroup, fangGeo, frostWhiteMat, 0.34, -0.18, 2.08, Math.PI, 0, 0);

    this.jawGroup.position.set(0, -0.2, 0.85);
    this.addDragonPart(this.jawGroup, jawGeo, silverScaleMat, 0, -0.08, 0.68);
    this.addDragonPart(this.jawGroup, beardGeo, electricCyanMat, 0, -0.32, 1.08, 2.55, 0, 0);
    this.mouthAnchor.position.set(0, -0.06, 1.92);
    this.headGroup.add(this.mouthAnchor);
    this.headGroup.add(this.jawGroup);
    this.neckGroup.add(this.headGroup);
    this.bodyGroup.add(this.neckGroup);

    // 4. Đôi cánh lông vũ & màng cánh băng giá 2 tầng bo cong parabol
    const innerBoneGeo = createParabolicLimbXGeometry(2.9, 0.16, 0.12, 0.9, 1.05);
    const outerBoneGeo = createParabolicLimbXGeometry(3.2, 0.12, 0.08, 0.9, 1.05);
    const innerMembraneGeo = new THREE.PlaneGeometry(2.75, 2.15);
    innerMembraneGeo.rotateX(-Math.PI / 2);
    innerMembraneGeo.translate(1.45, -0.02, -1.15);
    const outerMembraneGeo = new THREE.PlaneGeometry(2.95, 2.45);
    outerMembraneGeo.rotateX(-Math.PI / 2);
    outerMembraneGeo.translate(1.5, -0.02, -1.35);
    const innerFeatherGeo = createParabolicLatheGeometry(
      3.1,
      0.42,
      (t) => Math.pow(Math.max(0, 1 - t), 0.72),
      12,
      10,
      true,
    );
    innerFeatherGeo.rotateX(-Math.PI / 2);
    innerFeatherGeo.translate(0, 0, -1.55);
    const outerFeatherGeo = createParabolicLatheGeometry(
      3.8,
      0.38,
      (t) => Math.pow(Math.max(0, 1 - t), 0.72),
      12,
      10,
      true,
    );
    outerFeatherGeo.rotateX(-Math.PI / 2);
    outerFeatherGeo.translate(0, 0, -1.9);
    this.geometries.push(
      innerBoneGeo,
      outerBoneGeo,
      innerMembraneGeo,
      outerMembraneGeo,
      innerFeatherGeo,
      outerFeatherGeo,
    );

    const buildWingFeathers = (wingInner: THREE.Group, wingOuter: THREE.Group) => {
      // Khung xương cánh trắng bạc + màng cánh phát sáng xanh băng
      this.addDragonPart(wingInner, innerBoneGeo, frostWhiteMat, 0, 0, 0, 0, -0.12, 0);
      this.addDragonPart(wingInner, innerMembraneGeo, wingMembraneMat, 0, 0, 0, 0, -0.12, 0, false, false);
      // 4 lông cánh tầng trong xanh lam đậm xen xanh sáng
      for (let f = 0; f < 4; f++) {
        const fx = 0.55 + f * 0.72;
        const angleY = -0.15 - f * 0.14;
        this.addDragonPart(
          wingInner,
          innerFeatherGeo,
          f % 2 === 0 ? deepNavyMat : brightBlueMat,
          fx,
          -0.02,
          -0.1 - f * 0.08,
          0,
          angleY,
          0,
        );
      }

      wingOuter.position.set(2.85, 0, -0.34);
      this.addDragonPart(wingOuter, outerBoneGeo, silverScaleMat, 0, 0, 0, 0, -0.18, 0);
      this.addDragonPart(wingOuter, outerMembraneGeo, wingMembraneMat, 0, 0, 0, 0, -0.22, 0, false, false);
      // 5 mũi cánh nhọn vươn dài ra sau như đôi cánh phượng rồng
      for (let f = 0; f < 5; f++) {
        const fx = 0.4 + f * 0.68;
        const angleY = -0.32 - f * 0.18;
        const fMesh = this.addDragonPart(
          wingOuter,
          outerFeatherGeo,
          f === 4 ? electricCyanMat : f % 2 === 0 ? scaleAzureMat : deepNavyMat,
          fx,
          0,
          -0.08 - f * 0.1,
          0,
          angleY,
          0,
        );
        fMesh.scale.set(0.95, 0.28, 0.85 + f * 0.12);
      }
      wingInner.add(wingOuter);
    };

    this.rightWingGroup.position.set(1.05, 3.35, 0.85);
    buildWingFeathers(this.rightWingGroup, this.rightOuterWing);
    this.bodyGroup.add(this.rightWingGroup);

    this.leftWingGroup.position.set(-1.05, 3.35, 0.85);
    this.leftWingGroup.scale.x = -1;
    buildWingFeathers(this.leftWingGroup, this.leftOuterWing);
    this.bodyGroup.add(this.leftWingGroup);

    // 5. Đuôi dài 6 đốt uốn lượn kết thúc bằng chùm lửa xanh lam rực sáng
    let tailParent: THREE.Object3D = this.bodyGroup;
    const segSizes: Array<[number, number, number]> = [
      [1.4, 1.15, 1.4],
      [1.15, 0.96, 1.35],
      [0.9, 0.78, 1.3],
      [0.68, 0.6, 1.25],
      [0.48, 0.44, 1.2],
      [0.32, 0.3, 1.15],
    ];
    segSizes.forEach(([w, h, l], idx) => {
      const segGeo = createParabolicEllipsoidGeometry(w * 1.04, h * 1.04, l * 1.12, 14, 10);
      segGeo.translate(0, 0, -l * 0.5);
      const bellyGeo = createParabolicPlateGeometry(w * 0.78, 0.2, l * 0.9);
      bellyGeo.translate(0, -h * 0.45, -l * 0.5);
      this.geometries.push(segGeo, bellyGeo);

      const segGroup = new THREE.Group();
      if (idx === 0) {
        segGroup.position.set(0, 2.0, -2.35);
      } else {
        segGroup.position.set(0, 0, -segSizes[idx - 1][2] + 0.12);
      }
      this.addDragonPart(segGroup, segGeo, idx % 2 === 0 ? deepNavyMat : scaleAzureMat, 0, 0, 0);
      this.addDragonPart(segGroup, bellyGeo, silverScaleMat, 0, 0, 0);
      this.addDragonPart(
        segGroup,
        dorsalBladeGeo,
        idx >= 4 ? electricCyanMat : crystalMat,
        0,
        h * 0.5 + 0.22,
        -l * 0.5,
        -0.55,
        Math.PI / 4,
        0,
      );

      // Chùm lửa xanh lam bùng cháy ở chóp đuôi
      if (idx === segSizes.length - 1) {
        const tailPlumeGeo = new THREE.ConeGeometry(0.32, 1.75, 4);
        tailPlumeGeo.rotateX(-Math.PI / 2);
        tailPlumeGeo.translate(0, 0, -0.85);
        this.geometries.push(tailPlumeGeo);

        const plumeCenter = this.addDragonPart(
          segGroup,
          tailPlumeGeo,
          flameCoreMat,
          0,
          0.12,
          -l,
          0.35,
          0,
          0,
        );
        const plumeLeft = this.addDragonPart(
          segGroup,
          tailPlumeGeo,
          flameMat,
          -0.25,
          0.08,
          -l + 0.15,
          0.25,
          0.35,
          0,
        );
        const plumeRight = this.addDragonPart(
          segGroup,
          tailPlumeGeo,
          flameMat,
          0.25,
          0.08,
          -l + 0.15,
          0.25,
          -0.35,
          0,
        );
        this.tailFlames.push(plumeCenter, plumeLeft, plumeRight);
      }

      tailParent.add(segGroup);
      this.tailSegments.push(segGroup);
      tailParent = segGroup;
    });

    // 6. Các đốm lửa băng xanh lam lượn quanh rồng tạo khí thế như hình minh họa
    const wispOuterGeo = new THREE.ConeGeometry(0.28, 1.1, 4);
    const wispCoreGeo = new THREE.OctahedronGeometry(0.22, 0);
    this.geometries.push(wispOuterGeo, wispCoreGeo);
    for (let i = 0; i < 6; i++) {
      const wisp = new THREE.Group();
      const outer = new THREE.Mesh(wispOuterGeo, flameMat);
      outer.position.y = 0.35;
      const core = new THREE.Mesh(wispCoreGeo, flameCoreMat);
      wisp.add(outer, core);
      this.dragonRoot.add(wisp);
      this.auraWisps.push(wisp);
    }

    this.dragonRoot.add(this.bodyGroup);
  }

  private getLabelMaterial(hp: number): THREE.SpriteMaterial {
    const key = String(hp);
    const existing = this.labelMaterials.get(key);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 84;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(8, 22, 42, 0.88)';
    ctx.fillRect(6, 6, 308, 72);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 308, 72);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 23px monospace';
    ctx.fillText(`Rồng Băng Lv.${DRAGON_LEVEL}`, 160, 28);

    const barX = 24;
    const barY = 48;
    const barW = 272;
    const barH = 18;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(barX, barY, barW, barH);
    const fillW = Math.max(0, (hp / DRAGON_MAX_HP) * barW);
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(1, '#67e8f9');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, fillW, barH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(
      `${hp.toLocaleString('vi-VN')} / ${DRAGON_MAX_HP.toLocaleString('vi-VN')}`,
      160,
      barY + barH / 2 + 1,
    );

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    this.materials.push(mat);
    this.labelMaterials.set(key, mat);
    return mat;
  }

  private createDropLabelMaterial(): THREE.SpriteMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 340;
    canvas.height = 76;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(8, 25, 48, 0.9)';
    ctx.fillRect(6, 6, 328, 64);
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 328, 64);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Katana Băng', 170, 26);

    ctx.fillStyle = '#e0f2fe';
    ctx.font = '16px sans-serif';
    ctx.fillText('Lại gần hoặc Chuột phải để nhận', 170, 52);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    this.materials.push(mat);
    return mat;
  }

  private setDragonFlash(flashing: boolean): void {
    for (const item of this.bodyColorMeshes) {
      item.mesh.material = flashing ? this.hitFlashMat : item.origMat;
    }
  }

  private hideAllVfx(): void {
    this.warnCircleFillMesh.visible = false;
    this.warnCircleBorderMesh.visible = false;
    this.warnCircleProgressMesh.visible = false;
    this.warnStripFillMesh.visible = false;
    this.warnStripBorderMesh.visible = false;
    this.shockwaveMesh.visible = false;
    this.breathGroup.visible = false;
  }

  private clampPointInsideBlueZone(
    wx: number,
    wz: number,
    margin = 3.8,
  ): { x: number; z: number } {
    const maxR = Math.max(4, DRAGON_ZONE_SPEC.radius - margin);
    const dx = wx - DRAGON_ZONE_SPEC.x;
    const dz = wz - DRAGON_ZONE_SPEC.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > maxR * maxR) {
      const dist = Math.sqrt(distSq);
      return {
        x: DRAGON_ZONE_SPEC.x + (dx / dist) * maxR,
        z: DRAGON_ZONE_SPEC.z + (dz / dist) * maxR,
      };
    }
    return { x: wx, z: wz };
  }

  raycastDragon(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 8.0,
  ): { point: THREE.Vector3; hp: number; maxHp: number } | null {
    if (!this.alive) return null;
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    if (hits.length > 0) {
      return { point: hits[0].point, hp: this.hp, maxHp: DRAGON_MAX_HP };
    }
    return null;
  }

  raycastDroppedIceKatana(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 6.5,
  ): { point: THREE.Vector3 } | null {
    if (!this.dropActive) return null;
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObject(this.dropHitSphere, false);
    if (hits.length > 0) {
      return { point: hits[0].point };
    }
    return null;
  }

  tryCollectIceKatana(callbacks?: DragonUpdateCallbacks): boolean {
    if (!this.dropActive) return false;
    if (callbacks?.canCollectIceKatana && !callbacks.canCollectIceKatana()) {
      callbacks.onIceKatanaBlocked?.();
      return false;
    }
    this.dropState = 'flying';
    this.dropRingMesh.visible = false;
    return true;
  }

  attackWithKatana(
    cameraPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    damage = 100,
    maxRange = 5.4,
    playerLevel = 1,
    frostSlowDuration = 0,
  ): DragonAttackResult {
    if (!this.alive) {
      return {
        hit: false,
        killed: false,
        blockedByLevel: false,
        xpReward: 0,
        remainingHp: 0,
        maxHp: DRAGON_MAX_HP,
      };
    }

    let hit = false;
    const rayHit = this.raycastDragon(cameraPos, forwardDir, maxRange);
    if (rayHit) {
      hit = true;
    } else {
      // Hỗ trợ chém tầm gần vào thân rồng to lớn
      this.tempVec.set(this.x - cameraPos.x, this.y + 2.2 - cameraPos.y, this.z - cameraPos.z);
      const dist = this.tempVec.length();
      const horizDist = Math.hypot(this.x - cameraPos.x, this.z - cameraPos.z);
      if (horizDist <= maxRange + 2.8 && dist <= maxRange + 3.2) {
        this.tempVec.normalize();
        if (this.tempVec.dot(forwardDir) > 0.45) {
          hit = true;
        }
      }
    }

    if (!hit) {
      return {
        hit: false,
        killed: false,
        blockedByLevel: false,
        xpReward: 0,
        remainingHp: this.hp,
        maxHp: DRAGON_MAX_HP,
      };
    }

    if (playerLevel < DRAGON_MIN_ATTACK_LEVEL || damage <= 0) {
      return {
        hit: true,
        killed: false,
        blockedByLevel: true,
        xpReward: 0,
        remainingHp: this.hp,
        maxHp: DRAGON_MAX_HP,
      };
    }

    this.hp = Math.max(0, this.hp - damage);
    this.hitFlashTimer = 0.11;
    this.setDragonFlash(true);

    if (this.hp > 0 && frostSlowDuration > 0) {
      this.slowTimer = Math.max(this.slowTimer, frostSlowDuration);
    }

    if (this.hp <= 0) {
      this.alive = false;
      this.activeSkill = null;
      this.skillPhase = 'idle';
      this.slowTimer = 0;
      this.frostGroup.visible = false;
      this.respawnTimer = DRAGON_RESPAWN_SECONDS;
      this.dragonRoot.visible = false;
      this.contactShadowMesh.visible = false;
      this.dragonAuraLight.intensity = 0;
      this.setDragonFlash(false);
      this.hideAllVfx();

      // Rơi Katana Băng ngay vị trí hạ rồng
      this.dropX = this.x;
      this.dropZ = this.z;
      this.dropY = this.outside.getHeightAt(this.dropX, this.dropZ) + 1.05;
      this.dropAge = 0;
      this.dropActive = true;
      this.dropState = 'idle';
      this.dropRingMesh.visible = true;
      this.dropKatanaGroup.scale.setScalar(1);
      this.dropRoot.position.set(this.dropX, this.dropY, this.dropZ);
      this.dropRoot.visible = true;

      return {
        hit: true,
        killed: true,
        blockedByLevel: false,
        xpReward: DRAGON_XP_REWARD,
        remainingHp: 0,
        maxHp: DRAGON_MAX_HP,
      };
    }

    this.labelSprite.material = this.getLabelMaterial(this.hp);
    return {
      hit: true,
      killed: false,
      blockedByLevel: false,
      xpReward: 0,
      remainingHp: this.hp,
      maxHp: DRAGON_MAX_HP,
    };
  }

  private getTelegraphSeconds(skillId: DragonSkillId | null): number {
    return skillId === 1 ? SKILL1_TELEGRAPH_SECONDS : SKILL_TELEGRAPH_SECONDS;
  }

  getBossHudState(playerX: number, playerZ: number): DragonBossHudState {
    const distFromZoneCenter = Math.hypot(
      playerX - DRAGON_ZONE_SPEC.x,
      playerZ - DRAGON_ZONE_SPEC.z,
    );
    const nearOrInside = distFromZoneCenter <= DRAGON_ZONE_SPEC.radius + 10;

    let warningLabel: string | null = null;
    let warningProgress = 0;
    if (this.alive && this.skillPhase === 'telegraph' && this.activeSkill) {
      warningProgress = Math.min(
        1,
        this.skillTimer / this.getTelegraphSeconds(this.activeSkill),
      );
      if (this.activeSkill === 1) {
        warningLabel = 'Rồng sắp Dậm Xung Kích! Chạy khỏi vòng đỏ (Khiên giảm còn 1 tim)';
      } else if (this.activeSkill === 2) {
        warningLabel = 'Rồng sắp Lao Tới! Né khỏi vạch đỏ (Khiên vô hiệu)';
      } else {
        warningLabel = 'Rồng sắp Phun Lửa Băng! Né khỏi đường đỏ (Khiên vô hiệu)';
      }
    }

    return {
      visible: nearOrInside && (this.alive || this.dropActive),
      alive: this.alive,
      level: DRAGON_LEVEL,
      hp: this.hp,
      maxHp: DRAGON_MAX_HP,
      activeSkill: this.activeSkill,
      phase: this.skillPhase,
      warningLabel,
      warningProgress,
      dropAvailable: this.dropActive,
    };
  }

  private startNextSkill(
    playerX: number,
    playerZ: number,
    callbacks?: DragonUpdateCallbacks,
  ): void {
    const skillId = this.nextSkillId;
    this.nextSkillId = skillId === 1 ? 2 : skillId === 2 ? 3 : 1;

    this.activeSkill = skillId;
    this.skillPhase = 'telegraph';
    this.skillTimer = 0;
    this.skillHitDealt = false;
    this.hideAllVfx();

    if (skillId === 1) {
      // Skill 1: nhảy lên dậm xung kích xung quanh mục tiêu gần người chơi
      const clamped = this.clampPointInsideBlueZone(
        this.x + (playerX - this.x) * 0.45,
        this.z + (playerZ - this.z) * 0.45,
        6.0,
      );
      this.skillStartX = this.x;
      this.skillStartZ = this.z;
      this.skillTargetX = clamped.x;
      this.skillTargetZ = clamped.z;
      this.warnCircleFillMesh.visible = true;
      this.warnCircleBorderMesh.visible = true;
      this.warnCircleProgressMesh.visible = true;
      this.updateTerrainCircle(
        this.warnCircleFillMesh,
        this.skillTargetX,
        this.skillTargetZ,
        0,
        SKILL1_RADIUS,
        0.1,
      );
      this.updateTerrainCircle(
        this.warnCircleBorderMesh,
        this.skillTargetX,
        this.skillTargetZ,
        SKILL1_RADIUS - 0.55,
        SKILL1_RADIUS + 0.15,
        0.14,
      );
    } else if (skillId === 2) {
      // Skill 2: khóa đường thẳng lao tới người chơi
      let dx = playerX - this.x;
      let dz = playerZ - this.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;

      this.skillStartX = this.x;
      this.skillStartZ = this.z;
      this.skillDirX = dx;
      this.skillDirZ = dz;
      const clampedEnd = this.clampPointInsideBlueZone(
        this.x + dx * SKILL2_LENGTH,
        this.z + dz * SKILL2_LENGTH,
        3.5,
      );
      this.skillTargetX = clampedEnd.x;
      this.skillTargetZ = clampedEnd.z;

      const actualLen = Math.max(
        6,
        Math.hypot(this.skillTargetX - this.skillStartX, this.skillTargetZ - this.skillStartZ),
      );
      this.warnStripFillMesh.visible = true;
      this.warnStripBorderMesh.visible = true;
      this.updateTerrainStrip(
        this.warnStripFillMesh,
        this.skillStartX,
        this.skillStartZ,
        this.skillDirX,
        this.skillDirZ,
        actualLen,
        SKILL2_HALF_WIDTH,
        0.1,
      );
      this.updateTerrainStrip(
        this.warnStripBorderMesh,
        this.skillStartX,
        this.skillStartZ,
        this.skillDirX,
        this.skillDirZ,
        actualLen,
        SKILL2_HALF_WIDTH + 0.25,
        0.08,
      );
    } else {
      // Skill 3: khóa 1 đường thẳng phun lửa băng
      let dx = playerX - this.x;
      let dz = playerZ - this.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;

      this.skillStartX = this.x + dx * 3.6;
      this.skillStartZ = this.z + dz * 3.6;
      this.skillDirX = dx;
      this.skillDirZ = dz;

      this.warnStripFillMesh.visible = true;
      this.warnStripBorderMesh.visible = true;
      this.updateTerrainStrip(
        this.warnStripFillMesh,
        this.skillStartX,
        this.skillStartZ,
        this.skillDirX,
        this.skillDirZ,
        SKILL3_LENGTH,
        SKILL3_HALF_WIDTH,
        0.1,
      );
      this.updateTerrainStrip(
        this.warnStripBorderMesh,
        this.skillStartX,
        this.skillStartZ,
        this.skillDirX,
        this.skillDirZ,
        SKILL3_LENGTH,
        SKILL3_HALF_WIDTH + 0.22,
        0.08,
      );
    }

    callbacks?.onSkillWarning?.(skillId);
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerYaw: number,
    shieldRaised: boolean,
    callbacks?: DragonUpdateCallbacks,
  ): void {
    // Hoạt ảnh xoay nhẹ của Katana Băng khi rơi trên mặt đất + bay vào ô balo khi người chơi nhặt
    if (this.dropActive) {
      this.dropAge += dt;
      if (this.dropState === 'idle') {
        this.dropKatanaGroup.rotation.y += dt * 1.8;
        this.dropKatanaGroup.position.y = Math.sin(this.dropAge * 2.8) * 0.14;
        const pulse = 1 + Math.sin(this.dropAge * 4.5) * 0.12;
        this.dropRingMesh.scale.set(pulse, 1, pulse);

        const distToDrop = Math.hypot(playerX - this.dropX, playerZ - this.dropZ);
        if (this.dropAge >= 0.75 && distToDrop <= 4.4) {
          if (!callbacks?.canCollectIceKatana || callbacks.canCollectIceKatana()) {
            this.dropState = 'flying';
            this.dropRingMesh.visible = false;
          } else if (distToDrop <= 2.1) {
            callbacks.onIceKatanaBlocked?.();
          }
        }
      } else {
        const targetY = playerY + 0.95;
        const dx = playerX - this.dropX;
        const dy = targetY - this.dropY;
        const dz = playerZ - this.dropZ;
        const dist = Math.hypot(dx, dy, dz);
        const speed = 15.0;
        if (dist <= Math.max(0.45, speed * dt)) {
          if (!callbacks?.canCollectIceKatana || callbacks.canCollectIceKatana()) {
            this.dropActive = false;
            this.dropState = 'idle';
            this.dropRoot.visible = false;
            this.dropKatanaGroup.scale.setScalar(1);
            callbacks?.onCollectIceKatana?.();
          } else {
            this.dropState = 'idle';
            this.dropRingMesh.visible = true;
            this.dropKatanaGroup.scale.setScalar(1);
            this.dropY = this.outside.getHeightAt(this.dropX, this.dropZ) + 1.05;
            this.dropRoot.position.set(this.dropX, this.dropY, this.dropZ);
            callbacks?.onIceKatanaBlocked?.();
          }
        } else {
          const step = (speed * dt) / dist;
          this.dropX += dx * step;
          this.dropY += dy * step;
          this.dropZ += dz * step;
          this.dropRoot.position.set(this.dropX, this.dropY, this.dropZ);
          this.dropKatanaGroup.rotation.y += dt * 7.5;
          const shrink = Math.max(0.4, Math.min(1, dist / 2.6));
          this.dropKatanaGroup.scale.setScalar(shrink);
        }
      }
    }

    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.hp = DRAGON_MAX_HP;
        this.x = DRAGON_ZONE_SPEC.x;
        this.z = DRAGON_ZONE_SPEC.z;
        this.y = this.outside.getHeightAt(this.x, this.z);
        this.yaw = 0;
        this.alive = true;
        this.activeSkill = null;
        this.skillPhase = 'idle';
        this.skillCooldown = 1.6;
        this.nextSkillId = 1;
        this.hitFlashTimer = 0;
        this.slowTimer = 0;
        this.frostGroup.visible = false;
        this.setDragonFlash(false);
        this.bodyGroup.rotation.x = 0;
        this.headGroup.rotation.x = 0;
        this.jawGroup.rotation.x = 0.08;
        this.labelSprite.material = this.getLabelMaterial(this.hp);
        this.dragonRoot.position.set(this.x, this.y, this.z);
        this.dragonRoot.rotation.y = this.yaw;
        this.dragonRoot.visible = true;
        this.contactShadowMesh.visible = true;
        this.dragonAuraLight.intensity = 5.5;
      }
      return;
    }

    if (this.slowTimer > 0) {
      this.slowTimer = Math.max(0, this.slowTimer - dt);
    }
    const isSlowed = this.slowTimer > 0;
    const effDt = isSlowed ? dt * ICE_KATANA_SLOW_MULTIPLIER : dt;
    this.animTime += effDt;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) {
        this.setDragonFlash(false);
      }
    }

    const playerDistFromCenterSq =
      (playerX - DRAGON_ZONE_SPEC.x) * (playerX - DRAGON_ZONE_SPEC.x) +
      (playerZ - DRAGON_ZONE_SPEC.z) * (playerZ - DRAGON_ZONE_SPEC.z);
    const playerInsideBlueZone =
      playerDistFromCenterSq <= DRAGON_ZONE_SPEC.radius * DRAGON_ZONE_SPEC.radius;
    const showLabelRadius = DRAGON_ZONE_SPEC.radius + 10.0;
    this.labelSprite.visible = playerDistFromCenterSq <= showLabelRadius * showLabelRadius;

    const playerFwdX = -Math.sin(playerYaw);
    const playerFwdZ = -Math.cos(playerYaw);

    let jumpOffsetY = 0;
    let wingFlapSpeed = 3.6;
    let wingAmp = 0.28;
    let jawOpen = 0.08;
    let bodyPitch = 0;
    let headPitch = Math.sin(this.animTime * 2.2) * 0.05;

    if (!playerInsideBlueZone) {
      // Người chơi ra khỏi vùng xanh -> rồng ngừng tung chiêu và quay lại tuần tra vùng xanh
      if (this.skillPhase !== 'idle') {
        this.skillPhase = 'idle';
        this.activeSkill = null;
        this.hideAllVfx();
      }
      this.skillCooldown = 1.0;

      const toCenterX = DRAGON_ZONE_SPEC.x - this.x;
      const toCenterZ = DRAGON_ZONE_SPEC.z - this.z;
      const distC = Math.hypot(toCenterX, toCenterZ);
      if (distC > 2.0) {
        const moveX = toCenterX / distC;
        const moveZ = toCenterZ / distC;
        this.x += moveX * 4.2 * effDt;
        this.z += moveZ * 4.2 * effDt;
        const targetYaw = Math.atan2(moveX, moveZ);
        this.yaw += normalizeAngle(targetYaw - this.yaw) * Math.min(1, 5 * effDt);
      }
    } else if (this.skillPhase === 'idle' || this.skillPhase === 'recover') {
      // Tiến về phía người chơi và chuẩn bị tung chiêu kế tiếp
      const toPlayerX = playerX - this.x;
      const toPlayerZ = playerZ - this.z;
      const distP = Math.hypot(toPlayerX, toPlayerZ);
      if (distP > 0.05) {
        const dirX = toPlayerX / distP;
        const dirZ = toPlayerZ / distP;
        const targetYaw = Math.atan2(dirX, dirZ);
        this.yaw += normalizeAngle(targetYaw - this.yaw) * Math.min(1, 6.5 * effDt);

        if (distP > 5.8) {
          this.x += dirX * 4.6 * effDt;
          this.z += dirZ * 4.6 * effDt;
          const clamped = this.clampPointInsideBlueZone(this.x, this.z);
          this.x = clamped.x;
          this.z = clamped.z;
        }
      }

      if (this.skillPhase === 'recover') {
        this.skillTimer -= effDt;
        if (this.skillTimer <= 0) {
          this.skillPhase = 'idle';
          this.activeSkill = null;
        }
      } else {
        this.skillCooldown -= effDt;
        if (this.skillCooldown <= 0) {
          this.startNextSkill(playerX, playerZ, callbacks);
        }
      }
    } else if (this.skillPhase === 'telegraph' && this.activeSkill) {
      // Thời gian cảnh báo đỏ trước khi tung chiêu (Skill 1: 2.0s, Skill 2 & 3: 1.0s)
      const telegraphSeconds = this.getTelegraphSeconds(this.activeSkill);
      this.skillTimer += effDt;
      const progress = Math.min(1, this.skillTimer / telegraphSeconds);

      if (this.activeSkill === 1) {
        const targetYaw = Math.atan2(
          this.skillTargetX - this.skillStartX,
          this.skillTargetZ - this.skillStartZ,
        );
        if (Math.hypot(this.skillTargetX - this.skillStartX, this.skillTargetZ - this.skillStartZ) > 0.2) {
          this.yaw += normalizeAngle(targetYaw - this.yaw) * Math.min(1, 8 * effDt);
        }
        this.updateTerrainCircle(
          this.warnCircleProgressMesh,
          this.skillTargetX,
          this.skillTargetZ,
          0,
          Math.max(0.4, SKILL1_RADIUS * progress),
          0.12,
        );
        // Nhún chân trước khi nhảy vọt lên cao ở nửa sau pha cảnh báo
        if (progress < 0.28) {
          bodyPitch = 0.22 * (progress / 0.28);
          wingFlapSpeed = 5.5;
        } else {
          const airT = (progress - 0.28) / 0.72;
          jumpOffsetY = Math.sin(airT * Math.PI) * 7.8;
          this.x = this.skillStartX + (this.skillTargetX - this.skillStartX) * airT;
          this.z = this.skillStartZ + (this.skillTargetZ - this.skillStartZ) * airT;
          bodyPitch = airT < 0.6 ? -0.35 : 0.45;
          wingFlapSpeed = 10.5;
          wingAmp = 0.52;
        }
      } else if (this.activeSkill === 2) {
        const targetYaw = Math.atan2(this.skillDirX, this.skillDirZ);
        this.yaw += normalizeAngle(targetYaw - this.yaw) * Math.min(1, 14 * effDt);
        bodyPitch = -0.22;
        wingFlapSpeed = 9.0;
        wingAmp = 0.44;
      } else {
        const targetYaw = Math.atan2(this.skillDirX, this.skillDirZ);
        this.yaw += normalizeAngle(targetYaw - this.yaw) * Math.min(1, 14 * effDt);
        jawOpen = 0.15 + progress * 0.62;
        bodyPitch = -0.18;
        wingFlapSpeed = 6.5;
      }

      if (this.skillTimer >= telegraphSeconds) {
        // Chuyển sang pha tung chiêu thực tế
        this.skillPhase = 'execute';
        this.skillTimer = 0;
        this.skillHitDealt = false;
        this.warnCircleFillMesh.visible = false;
        this.warnCircleBorderMesh.visible = false;
        this.warnCircleProgressMesh.visible = false;
        this.warnStripFillMesh.visible = false;
        this.warnStripBorderMesh.visible = false;

        if (this.activeSkill === 1) {
          this.skillDuration = 0.55;
          this.x = this.skillTargetX;
          this.z = this.skillTargetZ;
          this.shockwaveMesh.visible = true;
          callbacks?.onSkillExecute?.(1);

          // Kiểm tra sát thương dậm xung kích ngay tại khoảnh khắc chạm đất
          const dImpact = Math.hypot(playerX - this.skillTargetX, playerZ - this.skillTargetZ);
          const impactGroundY = this.outside.getHeightAt(this.skillTargetX, this.skillTargetZ);
          if (dImpact <= SKILL1_RADIUS && Math.abs(playerY - impactGroundY) < 5.8) {
            let dirX = -playerFwdX;
            let dirZ = -playerFwdZ;
            if (dImpact > 0.001) {
              dirX = (playerX - this.skillTargetX) / dImpact;
              dirZ = (playerZ - this.skillTargetZ) / dImpact;
            }
            const dirToImpactX = -dirX;
            const dirToImpactZ = -dirZ;
            const frontDot = dirToImpactX * playerFwdX + dirToImpactZ * playerFwdZ;

            if (shieldRaised && frontDot > 0.15) {
              // Đỡ khiên kịp vẫn mất 1 tim
              callbacks?.onPlayerHit?.(1.0, 1, true, dirX, dirZ);
            } else {
              // Dính trọn xung kích mất 3 tim
              callbacks?.onPlayerHit?.(3.0, 1, false, dirX, dirZ);
            }
          }
        } else if (this.activeSkill === 2) {
          this.skillDuration = 0.38;
          callbacks?.onSkillExecute?.(2);
        } else {
          this.skillDuration = 0.62;
          this.breathGroup.visible = true;
          callbacks?.onSkillExecute?.(3);
        }
      }
    } else if (this.skillPhase === 'execute' && this.activeSkill) {
      this.skillTimer += effDt;
      const t = Math.min(1, this.skillTimer / this.skillDuration);

      if (this.activeSkill === 1) {
        // Sóng xung kích lan tỏa ra ngoài
        const outerR = Math.max(0.8, SKILL1_RADIUS * t);
        const innerR = Math.max(0, outerR - 1.4);
        this.updateTerrainCircle(
          this.shockwaveMesh,
          this.skillTargetX,
          this.skillTargetZ,
          innerR,
          outerR,
          0.18,
        );
        bodyPitch = 0.3 * (1 - t);
      } else if (this.activeSkill === 2) {
        // Lao nhanh dọc theo hành lang đỏ đã khóa (khiên vô hiệu, 2 tim)
        this.x = this.skillStartX + (this.skillTargetX - this.skillStartX) * t;
        this.z = this.skillStartZ + (this.skillTargetZ - this.skillStartZ) * t;
        bodyPitch = 0.28;
        wingFlapSpeed = 12.0;

        if (!this.skillHitDealt) {
          const distToDragon = Math.hypot(playerX - this.x, playerZ - this.z);
          if (distToDragon <= SKILL2_HALF_WIDTH + 0.65 && Math.abs(playerY - this.y) < 4.8) {
            this.skillHitDealt = true;
            const perpX = -this.skillDirZ;
            const perpZ = this.skillDirX;
            const sideSign =
              (playerX - this.x) * perpX + (playerZ - this.z) * perpZ >= 0 ? 1 : -1;
            const pushX = (this.skillDirX * 0.5 + perpX * sideSign * 0.85);
            const pushZ = (this.skillDirZ * 0.5 + perpZ * sideSign * 0.85);
            callbacks?.onPlayerHit?.(2.0, 2, false, pushX, pushZ);
          }
        }
      } else {
        // Phun chùm tia lửa băng trực tiếp từ miệng rồng dọc theo đường đỏ (khiên vô hiệu, 2 tim)
        jawOpen = 0.78;
        bodyPitch = 0.06;
        headPitch = 0.16;

        for (let sIdx = 0; sIdx < this.breathShards.length; sIdx++) {
          const shard = this.breathShards[sIdx];
          const flow = ((t * 2.4 + sIdx / this.breathShards.length) % 1) * SKILL3_LENGTH;
          const jitterX = Math.sin(this.animTime * 18 + sIdx * 2.1) * 0.68;
          const jitterY = Math.cos(this.animTime * 15 + sIdx * 1.7) * 0.55;
          shard.position.set(jitterX, jitterY, flow);
          shard.rotation.set(this.animTime * 6 + sIdx, this.animTime * 5, 0);
        }

        if (!this.skillHitDealt) {
          const relX = playerX - this.skillStartX;
          const relZ = playerZ - this.skillStartZ;
          const along = relX * this.skillDirX + relZ * this.skillDirZ;
          const perp = Math.abs(relX * -this.skillDirZ + relZ * this.skillDirX);
          if (
            along >= -1.4 &&
            along <= SKILL3_LENGTH &&
            perp <= SKILL3_HALF_WIDTH + 0.2 &&
            Math.abs(playerY - this.y) < 5.0
          ) {
            this.skillHitDealt = true;
            callbacks?.onPlayerHit?.(2.0, 3, false, this.skillDirX, this.skillDirZ);
          }
        }
      }

      if (this.skillTimer >= this.skillDuration) {
        this.hideAllVfx();
        this.skillPhase = 'recover';
        this.skillTimer = 1.65;
        this.skillCooldown = 0.65;
      }
    }

    // Cập nhật vị trí mặt đất, bóng tiếp xúc, hào quang băng & hoạt ảnh vỗ cánh
    const groundY = this.outside.getHeightAt(this.x, this.z);
    this.y = groundY + jumpOffsetY;
    this.dragonRoot.position.set(this.x, this.y, this.z);
    this.dragonRoot.rotation.y = this.yaw;

    this.frostGroup.visible = isSlowed;
    if (isSlowed) {
      this.frostAnimTime += dt;
      this.frostGroup.rotation.y += dt * 1.25;
      for (let fc = 0; fc < this.frostCrystals.length; fc++) {
        const crystal = this.frostCrystals[fc];
        crystal.position.y = 1.9 + Math.sin(this.frostAnimTime * 3.8 + fc * 1.1) * 0.35;
        crystal.rotation.y += dt * 2.0;
      }
    }

    const shadowScale = Math.max(0.45, 1 - jumpOffsetY * 0.06);
    this.contactShadowMesh.visible = true;
    this.contactShadowMesh.position.set(this.x, groundY + 0.05, this.z);
    this.contactShadowMesh.scale.set(shadowScale, 1, shadowScale);

    const auraBoost = this.skillPhase === 'telegraph' || this.skillPhase === 'execute' ? 3.2 : 0;
    this.dragonAuraLight.intensity = 5.2 + auraBoost + Math.sin(this.animTime * 4.5) * 0.8;

    this.bodyGroup.rotation.x = bodyPitch;
    const flap = Math.sin(this.animTime * wingFlapSpeed) * wingAmp;
    this.rightWingGroup.rotation.z = 0.2 + flap;
    this.rightOuterWing.rotation.z = -0.25 + flap * 0.7;
    this.leftWingGroup.rotation.z = -0.2 - flap;
    this.leftOuterWing.rotation.z = -0.25 + flap * 0.7;

    this.jawGroup.rotation.x = jawOpen;
    this.headGroup.rotation.x = headPitch;

    // Đặt chùm lửa băng xuất phát đúng từ vị trí miệng rồng trong không gian thế giới
    if (this.breathGroup.visible) {
      this.dragonRoot.updateMatrixWorld(true);
      this.mouthAnchor.getWorldPosition(this.mouthWorldPos);

      const endX = this.skillStartX + this.skillDirX * SKILL3_LENGTH;
      const endZ = this.skillStartZ + this.skillDirZ * SKILL3_LENGTH;
      const endY = this.outside.getHeightAt(endX, endZ) + 0.85;

      this.breathGroup.position.copy(this.mouthWorldPos);
      this.breathTargetVec.set(endX, endY, endZ);
      this.breathGroup.lookAt(this.breathTargetVec);

      const beamLen = Math.max(4, this.mouthWorldPos.distanceTo(this.breathTargetVec));
      const beamLenScale = beamLen / SKILL3_LENGTH;
      const beamPulse = 0.88 + Math.sin(this.animTime * 36) * 0.16;
      this.breathOuterBeam.scale.set(beamPulse, beamPulse, beamLenScale);
      this.breathInnerBeam.scale.set(beamPulse * 0.92, beamPulse * 0.92, beamLenScale);
    }

    for (let tIdx = 0; tIdx < this.tailSegments.length; tIdx++) {
      this.tailSegments[tIdx].rotation.y = Math.sin(this.animTime * 3.4 - tIdx * 0.68) * 0.22;
      this.tailSegments[tIdx].rotation.x = 0.06 + Math.cos(this.animTime * 2.5 - tIdx * 0.55) * 0.07;
    }

    for (let fIdx = 0; fIdx < this.tailFlames.length; fIdx++) {
      const flame = this.tailFlames[fIdx];
      const pulse = 0.88 + Math.sin(this.animTime * 11 + fIdx * 1.9) * 0.22;
      flame.scale.set(pulse, pulse, 0.9 + Math.cos(this.animTime * 9 + fIdx) * 0.24);
    }

    for (let wIdx = 0; wIdx < this.auraWisps.length; wIdx++) {
      const wisp = this.auraWisps[wIdx];
      const angle = this.animTime * 1.35 + (wIdx / this.auraWisps.length) * Math.PI * 2;
      const radius = 3.2 + Math.sin(this.animTime * 2.2 + wIdx) * 0.45;
      wisp.position.set(
        Math.cos(angle) * radius,
        2.3 + Math.sin(this.animTime * 2.8 + wIdx * 1.4) * 1.15,
        Math.sin(angle) * radius,
      );
      const s = 0.8 + Math.sin(this.animTime * 6 + wIdx) * 0.25;
      wisp.scale.set(s, s, s);
      wisp.rotation.y = -angle;
    }

    const stride = playerInsideBlueZone && this.skillPhase === 'idle' ? Math.sin(this.animTime * 5.2) * 0.24 : 0;
    this.legs.forEach((leg, idx) => {
      leg.rotation.x = idx % 2 === 0 ? stride : -stride;
    });
  }

  dispose(): void {
    this.scene.remove(this.zoneRoot);
    this.scene.remove(this.dragonRoot);
    this.scene.remove(this.vfxRoot);
    this.scene.remove(this.dropRoot);

    for (const geo of this.geometries) {
      geo.dispose();
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
    for (const tex of this.textures) {
      tex.dispose();
    }
    for (const geo of this.dropAssets.geometries) {
      geo.dispose();
    }
    for (const mat of this.dropAssets.materials) {
      mat.dispose();
    }
    if (this.dropAssets.textures) {
      for (const tex of this.dropAssets.textures) {
        tex.dispose();
      }
      this.dropAssets.textures.length = 0;
    }
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    this.dropAssets.geometries.length = 0;
    this.dropAssets.materials.length = 0;
    this.labelMaterials.clear();
    this.hitMeshes.length = 0;
    this.bodyColorMeshes.length = 0;
  }
}
