import * as THREE from 'three';
import { ICE_KATANA_SLOW_MULTIPLIER } from './katana';
import { OutsideGenerator } from './outside';
import {
  createParabolicEllipsoidGeometry,
  createParabolicLatheGeometry,
  createParabolicLimbXGeometry,
} from './parabolic';
import { MUSHROOM_ZONE_SPECS, SlimeZoneSpec } from './slimeZones';
import { createSoftShadowTexture } from './textures';

export type MushroomLevel = 8 | 10 | 12;

interface MushroomMeshPart {
  mesh: THREE.Mesh;
  origMat: THREE.Material;
}

export interface MushroomEntity {
  id: string;
  zone: SlimeZoneSpec;
  level: MushroomLevel;
  sizeLabel: string;
  maxHp: number;
  hp: number;
  damage: number;
  xpReward: number;
  scale: number;
  radius: number;
  moveSpeed: number;
  aggroRadius: number;
  sprayLength: number;
  sprayHalfWidth: number;
  x: number;
  y: number;
  z: number;
  knockRemX: number;
  knockRemZ: number;
  knockTimer: number;
  yaw: number;
  walkPhase: number;
  wanderAngle: number;
  wanderTimer: number;
  attackCooldown: number;
  skillPhase: 'idle' | 'telegraph' | 'execute';
  skillTimer: number;
  skillHitDealt: boolean;
  sprayStartX: number;
  sprayStartZ: number;
  sprayDirX: number;
  sprayDirZ: number;
  hitFlashTimer: number;
  slowTimer: number;
  frostAnimTime: number;
  alive: boolean;
  respawnTimer: number;
  group: THREE.Group;
  bodyGroup: THREE.Group;
  frostGroup: THREE.Group;
  frostCrystals: THREE.Mesh[];
  mouthAnchor: THREE.Object3D;
  mouthOrbMesh: THREE.Mesh;
  mouthMat: THREE.MeshStandardMaterial;
  shadowMesh: THREE.Mesh;
  bodyParts: MushroomMeshPart[];
  labelSprite: THREE.Sprite;
  warnFillMesh: THREE.Mesh;
  warnBorderMesh: THREE.Mesh;
  warnProgressMesh: THREE.Mesh;
  sprayGroup: THREE.Group;
  sprayBeamOuter: THREE.Mesh;
  sprayBeamInner: THREE.Mesh;
  sprayPuffs: THREE.Mesh[];
}

export interface MushroomAttackResult {
  hit: boolean;
  killed: boolean;
  level: MushroomLevel;
  xpReward: number;
  remainingHp: number;
  maxHp: number;
  x: number;
  y: number;
  z: number;
}

export interface MushroomUpdateCallbacks {
  onPoisonWarning?: (level: MushroomLevel) => void;
  onPoisonSpray?: (level: MushroomLevel) => void;
  onPlayerHit?: (damage: number, level: MushroomLevel, dirX: number, dirZ: number) => void;
  onShieldBlocked?: (level: MushroomLevel) => void;
}

const MUSHROOM_RESPAWN_SECONDS = 180.0; // 3 phút
const POISON_TELEGRAPH_SECONDS = 1.0; // Cảnh báo 1 giây trước khi phun
const POISON_EXECUTE_SECONDS = 0.48; // Thời gian tia khí độc phun ra
const POISON_COOLDOWN_SECONDS = 2.0; // Hồi bắn 2 giây mỗi phát

const STRIP_SEGMENTS = 10;

const _tempVec = new THREE.Vector3();
const _mouthWorldPos = new THREE.Vector3();
const _sprayEndPos = new THREE.Vector3();

function seededRand(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function createMushroomCapTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#dc352e');
  grad.addColorStop(0.58, '#c82924');
  grad.addColorStop(1, '#9e1b18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);

  // Vệt vân hữu cơ nhẹ trên mũ nấm
  ctx.strokeStyle = 'rgba(72, 10, 10, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const x = (i / 18) * 256 + 6;
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.quadraticCurveTo(x + (i % 2 === 0 ? 6 : -6), 68, x, 124);
    ctx.stroke();
  }

  // Các đốm trắng kem đặc trưng trên mũ nấm đỏ
  const spots = [
    [22, 28, 12, 8],
    [64, 22, 10, 7],
    [112, 30, 13, 9],
    [164, 20, 11, 7],
    [216, 29, 12, 8],
    [40, 58, 14, 10],
    [90, 66, 11, 8],
    [142, 54, 15, 10],
    [194, 62, 13, 9],
    [240, 56, 10, 8],
    [18, 92, 11, 8],
    [68, 96, 13, 9],
    [118, 90, 12, 8],
    [172, 95, 14, 9],
    [222, 92, 11, 8],
  ];

  for (const [sx, sy, rx, ry] of spots) {
    ctx.fillStyle = '#4a1c17';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 1.5, rx + 1.5, ry + 1.5, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#efe2c6';
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#faf3e3';
    ctx.beginPath();
    ctx.ellipse(sx - 2, sy - 2, rx * 0.48, ry * 0.42, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createMushroomGillsTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#c8ab72');
  grad.addColorStop(0.65, '#b29055');
  grad.addColorStop(1, '#7c5d32');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);

  // Các nan mang nấm tỏa đều từ cuống ra mép mũ
  for (let i = 0; i < 64; i++) {
    const x = (i / 64) * 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(66, 44, 20, 0.55)' : 'rgba(232, 208, 160, 0.25)';
    ctx.fillRect(x, 0, 2, 128);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createBellyTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e7dcc2';
  ctx.fillRect(0, 0, 128, 128);

  const grad = ctx.createRadialGradient(64, 62, 10, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 250, 240, 0.32)');
  grad.addColorStop(1, 'rgba(176, 152, 118, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  // Đốm nốt nhỏ trên bụng mập giống hình mẫu
  const bumps = [
    [46, 52, 4],
    [66, 48, 3.5],
    [80, 60, 4],
    [54, 72, 4.5],
    [72, 78, 3.5],
    [62, 92, 4],
    [42, 82, 3],
    [84, 84, 3.2],
  ];
  for (const [bx, by, r] of bumps) {
    ctx.strokeStyle = 'rgba(116, 94, 68, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(bx, by + 1.5, r, 0, Math.PI, false);
    ctx.stroke();

    ctx.fillStyle = '#f2e8d2';
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export class PoisonMushroomManager {
  private readonly scene: THREE.Scene;
  private readonly outside: OutsideGenerator;
  private readonly seed: number;
  private readonly maxAnisotropy: number;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];

  private readonly zoneRoot = new THREE.Group();
  private readonly mushroomRoot = new THREE.Group();
  private readonly vfxRoot = new THREE.Group();

  private readonly mushrooms: MushroomEntity[] = [];
  private readonly hitMeshes: THREE.Object3D[] = [];
  private readonly raycaster = new THREE.Raycaster();

  private readonly hitFlashMat: THREE.MeshBasicMaterial;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly warnFillMat: THREE.MeshBasicMaterial;
  private readonly warnBorderMat: THREE.MeshBasicMaterial;
  private readonly warnProgressMat: THREE.MeshBasicMaterial;
  private readonly sprayOuterMat: THREE.MeshBasicMaterial;
  private readonly sprayInnerMat: THREE.MeshBasicMaterial;
  private readonly sprayPuffMat: THREE.MeshStandardMaterial;

  private readonly labelMaterials = new Map<string, THREE.SpriteMaterial>();

  constructor(
    scene: THREE.Scene,
    outside: OutsideGenerator,
    seed: number,
    maxAnisotropy = 4,
  ) {
    this.scene = scene;
    this.outside = outside;
    this.seed = seed;
    this.maxAnisotropy = maxAnisotropy;

    this.hitFlashMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const shadowTex = createSoftShadowTexture();
    this.textures.push(shadowTex);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });

    this.warnFillMat = new THREE.MeshBasicMaterial({
      color: '#ef4444',
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.warnBorderMat = new THREE.MeshBasicMaterial({
      color: '#fb923c',
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.warnProgressMat = new THREE.MeshBasicMaterial({
      color: '#c084fc',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.sprayOuterMat = new THREE.MeshBasicMaterial({
      color: '#a855f7',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.sprayInnerMat = new THREE.MeshBasicMaterial({
      color: '#f3e8ff',
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.sprayPuffMat = new THREE.MeshStandardMaterial({
      color: '#9333ea',
      emissive: '#a855f7',
      emissiveIntensity: 0.95,
      transparent: true,
      opacity: 0.72,
      roughness: 0.4,
      depthWrite: false,
    });

    this.materials.push(
      this.hitFlashMat,
      this.shadowMat,
      this.warnFillMat,
      this.warnBorderMat,
      this.warnProgressMat,
      this.sprayOuterMat,
      this.sprayInnerMat,
      this.sprayPuffMat,
    );

    this.buildOrangeZones();
    this.spawnAllMushrooms();

    this.scene.add(this.zoneRoot);
    this.scene.add(this.mushroomRoot);
    this.scene.add(this.vfxRoot);
  }

  private buildOrangeZones(): void {
    const discMat = new THREE.MeshBasicMaterial({
      color: '#f97316',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#fb923c',
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials.push(discMat, ringMat);

    for (const zone of MUSHROOM_ZONE_SPECS) {
      const discMesh = this.buildTerrainDiscMesh(
        zone.x,
        zone.z,
        0,
        zone.radius,
        8,
        44,
        0.05,
        discMat,
      );
      this.zoneRoot.add(discMesh);

      const ringMesh = this.buildTerrainDiscMesh(
        zone.x,
        zone.z,
        zone.radius - 0.5,
        zone.radius + 0.25,
        2,
        52,
        0.09,
        ringMat,
      );
      this.zoneRoot.add(ringMesh);
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
    mat: THREE.Material,
  ): THREE.Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const stride = angularSteps + 1;

    for (let ir = 0; ir <= radialSteps; ir++) {
      const r = innerR + ((outerR - innerR) * ir) / radialSteps;
      for (let ia = 0; ia <= angularSteps; ia++) {
        const theta = (ia / angularSteps) * Math.PI * 2;
        const wx = cx + Math.cos(theta) * r;
        const wz = cz + Math.sin(theta) * r;
        const wy = this.outside.getHeightAt(wx, wz) + yOffset;
        positions.push(wx, wy, wz);
      }
    }

    for (let ir = 0; ir < radialSteps; ir++) {
      for (let ia = 0; ia < angularSteps; ia++) {
        const a = ir * stride + ia;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    this.geometries.push(geo);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 3;
    return mesh;
  }

  private createTerrainStripMesh(material: THREE.Material, renderOrder: number): THREE.Mesh {
    const vertCount = (STRIP_SEGMENTS + 1) * 2;
    const positions = new Float32Array(vertCount * 3);
    const indices: number[] = [];
    for (let i = 0; i < STRIP_SEGMENTS; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    this.geometries.push(geo);

    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = renderOrder;
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
    const perpX = -dirZ;
    const perpZ = dirX;
    const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i <= STRIP_SEGMENTS; i++) {
      const dist = (i / STRIP_SEGMENTS) * length;
      const cx = startX + dirX * dist;
      const cz = startZ + dirZ * dist;

      const lx = cx - perpX * halfWidth;
      const lz = cz - perpZ * halfWidth;
      const rx = cx + perpX * halfWidth;
      const rz = cz + perpZ * halfWidth;

      posAttr.setXYZ(i * 2, lx, this.outside.getHeightAt(lx, lz) + yOffset, lz);
      posAttr.setXYZ(i * 2 + 1, rx, this.outside.getHeightAt(rx, rz) + yOffset, rz);
    }
    posAttr.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  private getLabelMaterial(level: MushroomLevel, hp: number, maxHp: number): THREE.SpriteMaterial {
    const key = `${level}:${hp}:${maxHp}`;
    const existing = this.labelMaterials.get(key);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 84;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(18, 12, 28, 0.84)';
    ctx.beginPath();
    ctx.roundRect(10, 8, 260, 68, 14);
    ctx.fill();

    const accent = level === 12 ? '#f43f5e' : level === 10 ? '#fb923c' : '#facc15';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Nấm Độc Lv.${level}${level === 12 ? ' ★' : ''}`,
      140,
      34,
    );

    // Thanh máu
    const barX = 34;
    const barY = 47;
    const barW = 212;
    const barH = 14;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();

    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    if (ratio > 0) {
      ctx.fillStyle = level === 12 ? '#a855f7' : level === 10 ? '#f97316' : '#fbbf24';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * ratio, barH, 6);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${hp}/${maxHp}`, 140, 58);

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

  private spawnAllMushrooms(): void {
    const capTex = createMushroomCapTexture(this.maxAnisotropy);
    const gillsTex = createMushroomGillsTexture(this.maxAnisotropy);
    const bellyTex = createBellyTexture(this.maxAnisotropy);
    this.textures.push(capTex, gillsTex, bellyTex);

    // Bộ vật liệu chi tiết lấy cảm hứng trực tiếp từ mẫu Nấm Độc
    const capMat = new THREE.MeshStandardMaterial({
      map: capTex,
      roughness: 0.62,
      metalness: 0.04,
    });
    const gillsMat = new THREE.MeshStandardMaterial({
      map: gillsTex,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const spotMat = new THREE.MeshStandardMaterial({
      color: '#f3e7cb',
      roughness: 0.72,
      metalness: 0.02,
    });
    const stemMat = new THREE.MeshStandardMaterial({
      color: '#ebe0c6',
      roughness: 0.78,
      metalness: 0.02,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      map: bellyTex,
      roughness: 0.8,
      metalness: 0.02,
    });
    const jacketMat = new THREE.MeshStandardMaterial({
      color: '#c92e29',
      roughness: 0.72,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const backpackMat = new THREE.MeshStandardMaterial({
      color: '#a38257',
      roughness: 0.86,
      metalness: 0.04,
    });
    const strapMat = new THREE.MeshStandardMaterial({
      color: '#785a35',
      roughness: 0.82,
      metalness: 0.08,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: '#2e5d66',
      roughness: 0.84,
      metalness: 0.04,
    });
    const cuffMat = new THREE.MeshStandardMaterial({
      color: '#4b8691',
      roughness: 0.82,
      metalness: 0.04,
    });
    const shoeRedMat = new THREE.MeshStandardMaterial({
      color: '#cc312c',
      roughness: 0.65,
      metalness: 0.05,
    });
    const shoeSoleMat = new THREE.MeshStandardMaterial({
      color: '#f2ead7',
      roughness: 0.74,
      metalness: 0.02,
    });

    this.materials.push(
      capMat,
      gillsMat,
      spotMat,
      stemMat,
      bellyMat,
      jacketMat,
      backpackMat,
      strapMat,
      pantsMat,
      cuffMat,
      shoeRedMat,
      shoeSoleMat,
    );

    // Các hình khối parabol mềm mại (không cạnh vuông 90°)
    // 1. Mũ nấm đỏ lớn dạng chuông parabol
    const capGeo = createParabolicLatheGeometry(
      0.72,
      1.04,
      (t) => {
        if (t <= 0.001) return 0.96;
        if (t >= 0.999) return 0;
        if (t < 0.14) {
          // Vành mép mũ nấm cuộn tròn mềm mại
          const k = t / 0.14;
          return 0.96 + Math.sin(k * Math.PI) * 0.07;
        }
        const u = (t - 0.14) / 0.86;
        return Math.max(0, 1.0 * Math.pow(Math.cos(u * Math.PI * 0.5), 0.78));
      },
      26,
      18,
      false,
    );

    // 2. Mặt mang nấm dưới mũ
    const gillsGeo = createParabolicLatheGeometry(
      0.24,
      0.98,
      (t) => {
        if (t <= 0.001) return 0.22;
        if (t >= 0.999) return 0.96;
        return 0.22 + Math.pow(t, 0.72) * 0.74;
      },
      24,
      8,
      false,
    );

    // 3. Đốm kem nổi trên mũ nấm
    const wartGeo = createParabolicEllipsoidGeometry(0.14, 0.065, 0.12, 10, 8);

    // 4. Cổ / cuống nấm rủ xuống như khăn choàng
    const stemGeo = createParabolicLatheGeometry(
      0.46,
      0.34,
      (t) => {
        if (t <= 0.001 || t >= 0.999) return 0;
        const flareBottom = (1 - t) * 0.32;
        return 0.58 + flareBottom + Math.sin(t * Math.PI) * 0.12;
      },
      18,
      12,
      false,
    );

    // 5. Thân bụng mập tròn
    const bellyGeo = createParabolicEllipsoidGeometry(0.76, 0.64, 0.68, 18, 14);

    // 6. Áo khoác đỏ ôm nửa sau và hai bên hông
    const jacketBackGeo = new THREE.SphereGeometry(
      0.42,
      18,
      14,
      Math.PI * 0.72,
      Math.PI * 1.56,
      0.22,
      Math.PI * 0.66,
    );
    jacketBackGeo.scale(1.04, 1.12, 0.98);
    jacketBackGeo.computeVertexNormals();

    // 7. Tay áo đỏ & bàn tay kem
    const sleeveGeo = createParabolicLimbXGeometry(0.32, 0.14, 0.17, 1.0, 1.0, 12);
    const handGeo = createParabolicEllipsoidGeometry(0.16, 0.15, 0.17, 10, 8);

    // 8. Balo phiêu lưu đeo lưng + nắp túi + túi hông + dây đeo
    const packMainGeo = createParabolicEllipsoidGeometry(0.46, 0.52, 0.34, 14, 12);
    const packFlapGeo = createParabolicEllipsoidGeometry(0.48, 0.24, 0.36, 12, 10);
    const packPocketGeo = createParabolicEllipsoidGeometry(0.16, 0.24, 0.16, 10, 8);
    const strapGeo = new THREE.TorusGeometry(0.24, 0.042, 8, 16, Math.PI * 1.1);
    const dangleStrapGeo = createParabolicLimbXGeometry(0.24, 0.032, 0.024, 0.6, 1.2, 8);

    // 9. Quần xanh xắn ống
    const pantLegGeo = createParabolicLatheGeometry(
      0.34,
      0.19,
      (t) => {
        if (t <= 0.001 || t >= 0.999) return 0;
        return 0.75 + Math.sin(t * Math.PI) * 0.24;
      },
      12,
      8,
      false,
    );
    const cuffGeo = new THREE.TorusGeometry(0.15, 0.045, 8, 16);

    // 10. Giày thể thao đỏ + đế trắng
    const shoeUpperGeo = createParabolicEllipsoidGeometry(0.24, 0.18, 0.34, 12, 10);
    const shoeSoleGeo = createParabolicEllipsoidGeometry(0.26, 0.075, 0.36, 12, 8);

    // 11. Quả cầu miệng phát sáng tím + bóng tiếp xúc + tia khí độc
    const mouthOrbGeo = createParabolicEllipsoidGeometry(0.16, 0.09, 0.1, 10, 8);
    const shadowGeo = new THREE.PlaneGeometry(1.75, 1.75);
    shadowGeo.rotateX(-Math.PI / 2);

    const beamOuterGeo = new THREE.CylinderGeometry(0.56, 0.18, 1.0, 12, 1, true);
    beamOuterGeo.rotateX(Math.PI / 2);
    beamOuterGeo.translate(0, 0, 0.5);

    const beamInnerGeo = new THREE.CylinderGeometry(0.25, 0.09, 1.0, 10, 1, true);
    beamInnerGeo.rotateX(Math.PI / 2);
    beamInnerGeo.translate(0, 0, 0.5);

    const puffGeo = createParabolicEllipsoidGeometry(0.48, 0.42, 0.52, 10, 8);

    const frostRingGeo = new THREE.RingGeometry(0.75, 0.96, 24);
    frostRingGeo.rotateX(-Math.PI / 2);
    const frostCrystalGeo = new THREE.OctahedronGeometry(0.13, 0);
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
      emissiveIntensity: 1.15,
      roughness: 0.14,
      metalness: 0.18,
      transparent: true,
      opacity: 0.88,
    });
    this.materials.push(frostRingMat, frostCrystalMat);

    this.geometries.push(
      capGeo,
      gillsGeo,
      wartGeo,
      stemGeo,
      bellyGeo,
      jacketBackGeo,
      sleeveGeo,
      handGeo,
      packMainGeo,
      packFlapGeo,
      packPocketGeo,
      strapGeo,
      dangleStrapGeo,
      pantLegGeo,
      cuffGeo,
      shoeUpperGeo,
      shoeSoleGeo,
      mouthOrbGeo,
      shadowGeo,
      beamOuterGeo,
      beamInnerGeo,
      puffGeo,
      frostRingGeo,
      frostCrystalGeo,
    );

    // Vị trí các đốm kem nổi trên mũ nấm
    const wartSpots: Array<[number, number, number, number]> = [
      [0.0, 1.94, 0.16, 1.15],
      [-0.42, 1.82, 0.28, 1.0],
      [0.44, 1.8, 0.26, 1.05],
      [-0.64, 1.62, -0.18, 1.1],
      [0.62, 1.64, -0.22, 0.95],
      [0.08, 1.78, -0.48, 1.1],
      [-0.24, 1.66, 0.58, 0.92],
      [0.32, 1.64, 0.54, 0.95],
      [-0.78, 1.48, 0.25, 0.85],
      [0.76, 1.48, 0.22, 0.85],
    ];

    let globalIdx = 0;

    for (const zone of MUSHROOM_ZONE_SPECS) {
      // Mỗi khu vực gồm: 8 con nhỏ Lv.8, 5 con trung bình Lv.10, 2 con lớn Lv.12 (15 con/khu)
      const levels: MushroomLevel[] = [
        12, 12,
        10, 10, 10, 10, 10,
        8, 8, 8, 8, 8, 8, 8, 8,
      ];
      const existingPoints: Array<{ x: number; z: number; r: number }> = [];

      levels.forEach((level, idx) => {
        globalIdx++;
        const isLarge = level === 12;
        const isMedium = level === 10;

        const maxHp = isLarge ? 1500 : isMedium ? 1000 : 600;
        const damage = isLarge ? 2.0 : isMedium ? 1.5 : 1.0;
        const xpReward = isLarge ? 500 : isMedium ? 300 : 200;
        const scale = isLarge ? 1.48 : isMedium ? 1.05 : 0.74;
        const radius = 0.65 * scale;
        const moveSpeed = isLarge ? 2.0 : isMedium ? 2.25 : 2.55;
        const aggroRadius = isLarge ? 19.0 : isMedium ? 17.0 : 15.0;
        const sprayLength = isLarge ? 19.0 : isMedium ? 17.0 : 15.0;
        const sprayHalfWidth = isLarge ? 1.38 : isMedium ? 1.15 : 0.95;
        const sizeLabel = isLarge ? 'Lớn' : isMedium ? 'Trung bình' : 'Nhỏ';

        const spawnPos = this.pickPointInZone(
          zone,
          radius,
          this.seed + globalIdx * 43,
          existingPoints,
        );
        existingPoints.push({ x: spawnPos.x, z: spawnPos.z, r: radius });
        const groundY = this.outside.getHeightAt(spawnPos.x, spawnPos.z);

        const group = new THREE.Group();
        group.position.set(spawnPos.x, groundY, spawnPos.z);

        const bodyGroup = new THREE.Group();
        bodyGroup.scale.set(scale, scale, scale);

        const bodyParts: MushroomMeshPart[] = [];
        const addPart = (
          geo: THREE.BufferGeometry,
          mat: THREE.Material,
          px: number,
          py: number,
          pz: number,
          rx = 0,
          ry = 0,
          rz = 0,
          sx = 1,
          sy = 1,
          sz = 1,
          castShadow = true,
        ): THREE.Mesh => {
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(px, py, pz);
          mesh.rotation.set(rx, ry, rz);
          mesh.scale.set(sx, sy, sz);
          mesh.castShadow = castShadow;
          mesh.receiveShadow = true;
          bodyGroup.add(mesh);
          bodyParts.push({ mesh, origMat: mat });
          return mesh;
        };

        // Đôi giày thể thao đỏ-nâu đế trắng chạm đất (y = 0)
        addPart(shoeSoleGeo, shoeSoleMat, -0.2, 0.04, 0.06);
        addPart(shoeSoleGeo, shoeSoleMat, 0.2, 0.04, 0.06);
        addPart(shoeUpperGeo, backpackMat, -0.2, 0.13, 0.01, 0, 0, 0, 1.02, 0.96, 0.84);
        addPart(shoeUpperGeo, backpackMat, 0.2, 0.13, 0.01, 0, 0, 0, 1.02, 0.96, 0.84);
        addPart(shoeUpperGeo, shoeRedMat, -0.2, 0.12, 0.09, 0, 0, 0, 0.95, 0.86, 0.78);
        addPart(shoeUpperGeo, shoeRedMat, 0.2, 0.12, 0.09, 0, 0, 0, 0.95, 0.86, 0.78);

        // Quần xanh xắn ống
        addPart(pantLegGeo, pantsMat, -0.19, 0.18, 0);
        addPart(pantLegGeo, pantsMat, 0.19, 0.18, 0);
        addPart(cuffGeo, cuffMat, -0.19, 0.22, 0.01, Math.PI / 2, 0, 0);
        addPart(cuffGeo, cuffMat, 0.19, 0.22, 0.01, Math.PI / 2, 0, 0);

        // Bụng mập màu kem
        addPart(bellyGeo, bellyMat, 0, 0.72, 0.06);

        // Áo khoác đỏ vòng sau lưng & hai bên
        addPart(jacketBackGeo, jacketMat, 0, 0.78, -0.02);

        // Hai tay áo đỏ & bàn tay kem
        addPart(sleeveGeo, jacketMat, -0.34, 0.94, 0.02, 0, 0.12, -2.15);
        addPart(sleeveGeo, jacketMat, 0.34, 0.94, 0.02, 0, -0.12, -0.99);
        addPart(handGeo, stemMat, -0.49, 0.62, 0.09);
        addPart(handGeo, stemMat, 0.49, 0.62, 0.09);

        // Balo nâu đeo sau lưng & quai đeo
        addPart(packMainGeo, backpackMat, 0, 0.84, -0.37);
        addPart(packFlapGeo, backpackMat, 0, 1.02, -0.39, 0.2, 0, 0);
        addPart(packPocketGeo, strapMat, -0.24, 0.78, -0.42);
        addPart(packPocketGeo, strapMat, 0.24, 0.78, -0.42);
        addPart(strapGeo, strapMat, -0.23, 0.94, -0.12, 0.15, Math.PI / 2, 0);
        addPart(strapGeo, strapMat, 0.23, 0.94, -0.12, 0.15, Math.PI / 2, 0);
        addPart(dangleStrapGeo, strapMat, 0.18, 0.56, -0.48, 0, 0, -1.42);

        // Cổ/cuống nấm kem nối lên mũ
        addPart(stemGeo, stemMat, 0, 0.98, 0);

        // Miệng phun độc màu tím nằm trước cổ
        const mouthMat = new THREE.MeshStandardMaterial({
          color: '#581c87',
          emissive: '#9333ea',
          emissiveIntensity: 0.45,
          roughness: 0.35,
        });
        this.materials.push(mouthMat);
        const mouthOrbMesh = addPart(mouthOrbGeo, mouthMat, 0, 1.08, 0.27, 0, 0, 0, 1, 1, 1, false);

        const mouthAnchor = new THREE.Object3D();
        mouthAnchor.position.set(0, 1.08, 0.33);
        bodyGroup.add(mouthAnchor);

        // Mũ nấm đỏ & mặt mang nấm phía dưới
        addPart(gillsGeo, gillsMat, 0, 1.32, 0);
        addPart(capGeo, capMat, 0, 1.32, 0);

        // Các đốm nổi 3D trên mũ nấm
        for (const [wx, wy, wz, ws] of wartSpots) {
          const dist = Math.hypot(wx, wz);
          const tiltZ = -wx * 0.52;
          const tiltX = wz * 0.52;
          addPart(
            wartGeo,
            spotMat,
            wx,
            wy - dist * 0.04,
            wz,
            tiltX,
            0,
            tiltZ,
            ws,
            ws,
            ws,
            false,
          );
        }

        group.add(bodyGroup);

        // Bóng tiếp xúc mềm dưới chân
        const shadowMesh = new THREE.Mesh(shadowGeo, this.shadowMat);
        shadowMesh.position.set(spawnPos.x, groundY + 0.03, spawnPos.z);
        shadowMesh.scale.set(scale, 1, scale);
        this.mushroomRoot.add(shadowMesh);

        // Bảng tên & máu nổi trên đầu
        const labelMat = this.getLabelMaterial(level, maxHp, maxHp);
        const labelSprite = new THREE.Sprite(labelMat);
        labelSprite.position.set(0, 2.25 * scale + 0.35, 0);
        labelSprite.scale.set(1.75, 0.54, 1);
        labelSprite.visible = false;
        group.add(labelSprite);

        this.mushroomRoot.add(group);

        // Dải cảnh báo nguy hiểm 1 giây trên mặt đất
        const warnFillMesh = this.createTerrainStripMesh(this.warnFillMat, 4);
        const warnBorderMesh = this.createTerrainStripMesh(this.warnBorderMat, 4);
        const warnProgressMesh = this.createTerrainStripMesh(this.warnProgressMat, 5);
        this.vfxRoot.add(warnFillMesh, warnBorderMesh, warnProgressMesh);

        // Luồng khí độc tím phun thẳng từ miệng quái
        const sprayGroup = new THREE.Group();
        sprayGroup.visible = false;
        const sprayBeamOuter = new THREE.Mesh(beamOuterGeo, this.sprayOuterMat);
        const sprayBeamInner = new THREE.Mesh(beamInnerGeo, this.sprayInnerMat);
        sprayGroup.add(sprayBeamOuter, sprayBeamInner);

        const sprayPuffs: THREE.Mesh[] = [];
        for (let p = 0; p < 8; p++) {
          const puff = new THREE.Mesh(puffGeo, this.sprayPuffMat);
          sprayGroup.add(puff);
          sprayPuffs.push(puff);
        }
        this.vfxRoot.add(sprayGroup);

        // Hiệu ứng đóng băng làm chậm quanh nấm độc
        const frostGroup = new THREE.Group();
        frostGroup.scale.setScalar(scale);
        frostGroup.visible = false;
        const frostRing = new THREE.Mesh(frostRingGeo, frostRingMat);
        frostRing.position.y = 0.08;
        frostGroup.add(frostRing);
        const frostCrystals: THREE.Mesh[] = [];
        for (let fc = 0; fc < 4; fc++) {
          const ang = (fc / 4) * Math.PI * 2;
          const crystal = new THREE.Mesh(frostCrystalGeo, frostCrystalMat);
          crystal.position.set(Math.cos(ang) * 0.82, 0.62, Math.sin(ang) * 0.82);
          crystal.scale.set(0.8, 1.7, 0.8);
          frostGroup.add(crystal);
          frostCrystals.push(crystal);
        }
        group.add(frostGroup);

        const entity: MushroomEntity = {
          id: `${zone.id}:mushroom:${idx}`,
          zone,
          level,
          sizeLabel,
          maxHp,
          hp: maxHp,
          damage,
          xpReward,
          scale,
          radius,
          moveSpeed,
          aggroRadius,
          sprayLength,
          sprayHalfWidth,
          x: spawnPos.x,
          y: groundY,
          z: spawnPos.z,
          knockRemX: 0,
          knockRemZ: 0,
          knockTimer: 0,
          yaw: seededRand(globalIdx * 17) * Math.PI * 2,
          walkPhase: seededRand(globalIdx * 23) * Math.PI * 2,
          wanderAngle: seededRand(globalIdx * 37) * Math.PI * 2,
          wanderTimer: 1.2 + seededRand(globalIdx * 59) * 2.5,
          attackCooldown: 0.8 + seededRand(globalIdx * 13) * 0.9,
          skillPhase: 'idle',
          skillTimer: 0,
          skillHitDealt: false,
          sprayStartX: spawnPos.x,
          sprayStartZ: spawnPos.z,
          sprayDirX: 0,
          sprayDirZ: 1,
          hitFlashTimer: 0,
          slowTimer: 0,
          frostAnimTime: 0,
          alive: true,
          respawnTimer: 0,
          group,
          bodyGroup,
          frostGroup,
          frostCrystals,
          mouthAnchor,
          mouthOrbMesh,
          mouthMat,
          shadowMesh,
          bodyParts,
          labelSprite,
          warnFillMesh,
          warnBorderMesh,
          warnProgressMesh,
          sprayGroup,
          sprayBeamOuter,
          sprayBeamInner,
          sprayPuffs,
        };

        for (const part of bodyParts) {
          part.mesh.userData.mushroom = entity;
          this.hitMeshes.push(part.mesh);
        }

        this.mushrooms.push(entity);
      });
    }
  }

  private pickPointInZone(
    zone: SlimeZoneSpec,
    mushroomRadius: number,
    seedVal: number,
    existing: Array<{ x: number; z: number; r: number }>,
  ): { x: number; z: number } {
    const maxDist = Math.max(2, zone.radius - mushroomRadius - 1.6);
    for (let attempt = 0; attempt < 24; attempt++) {
      const s = seedVal + attempt * 131;
      const r = Math.sqrt(seededRand(s)) * maxDist;
      const angle = seededRand(s + 97) * Math.PI * 2;
      const x = zone.x + Math.cos(angle) * r;
      const z = zone.z + Math.sin(angle) * r;

      let crowded = false;
      for (const p of existing) {
        const minGap = p.r + mushroomRadius + 1.4;
        if (Math.hypot(x - p.x, z - p.z) < minGap) {
          crowded = true;
          break;
        }
      }
      if (!crowded) return { x, z };
    }

    const r = Math.sqrt(seededRand(seedVal)) * maxDist;
    const angle = seededRand(seedVal + 97) * Math.PI * 2;
    return {
      x: zone.x + Math.cos(angle) * r,
      z: zone.z + Math.sin(angle) * r,
    };
  }

  private clampInsideZone(m: MushroomEntity): void {
    const maxR = Math.max(1.2, m.zone.radius - m.radius - 0.25);
    const dx = m.x - m.zone.x;
    const dz = m.z - m.zone.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > maxR * maxR) {
      const dist = Math.sqrt(distSq);
      m.x = m.zone.x + (dx / dist) * maxR;
      m.z = m.zone.z + (dz / dist) * maxR;
      m.wanderAngle = Math.atan2(-dz, -dx);
    }
  }

  private hideEntityVfx(m: MushroomEntity): void {
    m.warnFillMesh.visible = false;
    m.warnBorderMesh.visible = false;
    m.warnProgressMesh.visible = false;
    m.sprayGroup.visible = false;
    m.mouthMat.emissiveIntensity = 0.45;
    m.mouthOrbMesh.scale.set(1, 1, 1);
  }

  private setMushroomFlash(m: MushroomEntity, flashing: boolean): void {
    for (const part of m.bodyParts) {
      part.mesh.material = flashing ? this.hitFlashMat : part.origMat;
    }
  }

  raycastMushroom(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 6.5,
  ): { mushroom: MushroomEntity; point: THREE.Vector3 } | null {
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    for (const hit of hits) {
      const mushroom = hit.object.userData.mushroom as MushroomEntity | undefined;
      if (mushroom && mushroom.alive) {
        return { mushroom, point: hit.point };
      }
    }
    return null;
  }

  attackWithKatana(
    cameraPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    damage = 100,
    maxRange = 3.8,
    frostSlowDuration = 0,
  ): MushroomAttackResult {
    let target: MushroomEntity | null = null;
    const rayHit = this.raycastMushroom(cameraPos, forwardDir, maxRange);
    if (rayHit) {
      target = rayHit.mushroom;
    } else {
      let bestScore = Infinity;
      for (const m of this.mushrooms) {
        if (!m.alive) continue;
        _tempVec.set(
          m.x - cameraPos.x,
          m.y + 0.9 * m.scale - cameraPos.y,
          m.z - cameraPos.z,
        );
        const dist = _tempVec.length();
        if (dist > maxRange + m.radius) continue;

        const horizDist = Math.hypot(m.x - cameraPos.x, m.z - cameraPos.z);
        if (horizDist > maxRange + m.radius) continue;

        _tempVec.normalize();
        const dot = _tempVec.dot(forwardDir);
        if (dot > 0.6 && dist < bestScore) {
          bestScore = dist;
          target = m;
        }
      }
    }

    if (!target) {
      return {
        hit: false,
        killed: false,
        level: 8,
        xpReward: 0,
        remainingHp: 0,
        maxHp: 0,
        x: 0,
        y: 0,
        z: 0,
      };
    }

    target.hp = Math.max(0, target.hp - Math.max(1, damage));
    target.hitFlashTimer = 0.14;
    this.setMushroomFlash(target, true);

    if (target.hp > 0 && frostSlowDuration > 0) {
      target.slowTimer = Math.max(target.slowTimer, frostSlowDuration);
    }

    const kx = target.x - cameraPos.x;
    const kz = target.z - cameraPos.z;
    const kLen = Math.hypot(kx, kz) || 1;
    target.knockRemX = (kx / kLen) * 0.85;
    target.knockRemZ = (kz / kLen) * 0.85;
    target.knockTimer = 0.12;

    if (target.hp <= 0) {
      target.alive = false;
      target.skillPhase = 'idle';
      target.slowTimer = 0;
      target.frostGroup.visible = false;
      target.respawnTimer = MUSHROOM_RESPAWN_SECONDS;
      target.group.visible = false;
      target.shadowMesh.visible = false;
      this.setMushroomFlash(target, false);
      this.hideEntityVfx(target);
      return {
        hit: true,
        killed: true,
        level: target.level,
        xpReward: target.xpReward,
        remainingHp: 0,
        maxHp: target.maxHp,
        x: target.x,
        y: target.y,
        z: target.z,
      };
    }

    target.labelSprite.material = this.getLabelMaterial(
      target.level,
      target.hp,
      target.maxHp,
    );

    return {
      hit: true,
      killed: false,
      level: target.level,
      xpReward: 0,
      remainingHp: target.hp,
      maxHp: target.maxHp,
      x: target.x,
      y: target.y,
      z: target.z,
    };
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerYaw: number,
    shieldRaised: boolean,
    callbacks?: MushroomUpdateCallbacks,
  ): void {
    const playerFwdX = -Math.sin(playerYaw);
    const playerFwdZ = -Math.cos(playerYaw);

    for (let i = 0; i < this.mushrooms.length; i++) {
      const m = this.mushrooms[i];

      if (!m.alive) {
        m.respawnTimer -= dt;
        if (m.respawnTimer <= 0) {
          const pos = this.pickPointInZone(
            m.zone,
            m.radius,
            this.seed + Math.floor(performance.now()) + i * 79,
            [],
          );
          m.x = pos.x;
          m.z = pos.z;
          m.y = this.outside.getHeightAt(pos.x, pos.z);
          m.knockRemX = 0;
          m.knockRemZ = 0;
          m.knockTimer = 0;
          m.hp = m.maxHp;
          m.alive = true;
          m.skillPhase = 'idle';
          m.skillTimer = 0;
          m.attackCooldown = 1.0;
          m.hitFlashTimer = 0;
          m.slowTimer = 0;
          m.frostGroup.visible = false;
          this.setMushroomFlash(m, false);
          this.hideEntityVfx(m);
          m.labelSprite.material = this.getLabelMaterial(m.level, m.hp, m.maxHp);
          m.group.position.set(m.x, m.y, m.z);
          m.group.visible = true;
          m.shadowMesh.position.set(m.x, m.y + 0.03, m.z);
          m.shadowMesh.visible = true;
        }
        continue;
      }

      if (m.slowTimer > 0) {
        m.slowTimer = Math.max(0, m.slowTimer - dt);
      }
      const isSlowed = m.slowTimer > 0;
      const effDt = isSlowed ? dt * ICE_KATANA_SLOW_MULTIPLIER : dt;

      if (m.hitFlashTimer > 0) {
        m.hitFlashTimer -= dt;
        if (m.hitFlashTimer <= 0) {
          this.setMushroomFlash(m, false);
        }
      }

      const pZoneDistSq =
        (playerX - m.zone.x) * (playerX - m.zone.x) +
        (playerZ - m.zone.z) * (playerZ - m.zone.z);
      const playerInsideOrangeZone = pZoneDistSq <= m.zone.radius * m.zone.radius;
      const showLabelRadius = m.zone.radius + 9.0;
      m.labelSprite.visible = pZoneDistSq <= showLabelRadius * showLabelRadius;

      const toPlayerX = playerX - m.x;
      const toPlayerZ = playerZ - m.z;
      const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

      let moveDirX = 0;
      let moveDirZ = 0;
      let speed = 0;

      if (m.skillPhase === 'idle') {
        if (m.attackCooldown > 0) {
          m.attackCooldown = Math.max(0, m.attackCooldown - effDt);
        }

        if (playerInsideOrangeZone && distToPlayer <= m.aggroRadius) {
          // Hướng mặt về người chơi và giữ khoảng cách phun độc (không lao vào đánh cận chiến)
          if (distToPlayer > 0.01) {
            const dirX = toPlayerX / distToPlayer;
            const dirZ = toPlayerZ / distToPlayer;
            const targetYaw = Math.atan2(dirX, dirZ);
            m.yaw += normalizeAngle(targetYaw - m.yaw) * Math.min(1, 7.5 * effDt);

            if (distToPlayer > 7.5) {
              moveDirX = dirX;
              moveDirZ = dirZ;
              speed = m.moveSpeed;
            }
          }

          if (m.attackCooldown <= 0 && Math.abs(playerY - m.y) < 4.0) {
            // Khóa vị trí người chơi tại thời điểm phát hiện -> cảnh báo 1 giây trước khi phun
            let dirX = Math.sin(m.yaw);
            let dirZ = Math.cos(m.yaw);
            if (distToPlayer > 0.05) {
              dirX = toPlayerX / distToPlayer;
              dirZ = toPlayerZ / distToPlayer;
            }

            m.skillPhase = 'telegraph';
            m.skillTimer = 0;
            m.skillHitDealt = false;
            m.sprayStartX = m.x + dirX * (0.32 * m.scale);
            m.sprayStartZ = m.z + dirZ * (0.32 * m.scale);
            m.sprayDirX = dirX;
            m.sprayDirZ = dirZ;
            m.yaw = Math.atan2(dirX, dirZ);

            m.warnFillMesh.visible = true;
            m.warnBorderMesh.visible = true;
            m.warnProgressMesh.visible = true;
            this.updateTerrainStrip(
              m.warnFillMesh,
              m.sprayStartX,
              m.sprayStartZ,
              m.sprayDirX,
              m.sprayDirZ,
              m.sprayLength,
              m.sprayHalfWidth,
              0.08,
            );
            this.updateTerrainStrip(
              m.warnBorderMesh,
              m.sprayStartX,
              m.sprayStartZ,
              m.sprayDirX,
              m.sprayDirZ,
              m.sprayLength,
              m.sprayHalfWidth + 0.16,
              0.06,
            );
            this.updateTerrainStrip(
              m.warnProgressMesh,
              m.sprayStartX,
              m.sprayStartZ,
              m.sprayDirX,
              m.sprayDirZ,
              0.5,
              m.sprayHalfWidth * 0.85,
              0.1,
            );

            callbacks?.onPoisonWarning?.(m.level);
          }
        } else {
          // Đi lang thang nhẹ quanh khu vực màu cam
          m.wanderTimer -= effDt;
          if (m.wanderTimer <= 0) {
            m.wanderTimer = 1.8 + seededRand(i * 29 + performance.now() * 0.01) * 2.4;
            const distFromCenter = Math.hypot(m.x - m.zone.x, m.z - m.zone.z);
            if (distFromCenter > m.zone.radius * 0.65) {
              m.wanderAngle = Math.atan2(m.zone.z - m.z, m.zone.x - m.x);
            } else {
              m.wanderAngle += (seededRand(i * 41 + performance.now() * 0.02) - 0.5) * 2.2;
            }
          }
          moveDirX = Math.cos(m.wanderAngle);
          moveDirZ = Math.sin(m.wanderAngle);
          speed = m.moveSpeed * 0.34;
        }
      } else if (m.skillPhase === 'telegraph') {
        if (!playerInsideOrangeZone) {
          m.skillPhase = 'idle';
          m.attackCooldown = 0.6;
          this.hideEntityVfx(m);
        } else {
          m.skillTimer += effDt;
          const progress = Math.min(1, m.skillTimer / POISON_TELEGRAPH_SECONDS);
          const targetYaw = Math.atan2(m.sprayDirX, m.sprayDirZ);
          m.yaw += normalizeAngle(targetYaw - m.yaw) * Math.min(1, 14 * effDt);

          m.mouthMat.emissiveIntensity = 0.7 + progress * 2.4;
          const mouthScale = 1 + progress * 0.65;
          m.mouthOrbMesh.scale.set(mouthScale, mouthScale, mouthScale);

          this.updateTerrainStrip(
            m.warnProgressMesh,
            m.sprayStartX,
            m.sprayStartZ,
            m.sprayDirX,
            m.sprayDirZ,
            Math.max(0.4, m.sprayLength * progress),
            m.sprayHalfWidth * 0.85,
            0.1,
          );

          if (m.skillTimer >= POISON_TELEGRAPH_SECONDS) {
            m.skillPhase = 'execute';
            m.skillTimer = 0;
            m.skillHitDealt = false;
            m.warnFillMesh.visible = false;
            m.warnBorderMesh.visible = false;
            m.warnProgressMesh.visible = false;
            m.sprayGroup.visible = true;
            callbacks?.onPoisonSpray?.(m.level);
          }
        }
      } else if (m.skillPhase === 'execute') {
        m.skillTimer += effDt;
        const t = Math.min(1, m.skillTimer / POISON_EXECUTE_SECONDS);

        m.mouthMat.emissiveIntensity = 3.0 * (1 - t * 0.4);
        m.mouthOrbMesh.scale.set(1.5, 1.5, 1.5);

        // Định vị luồng khí độc màu tím xuất phát thẳng từ miệng quái
        m.group.updateMatrixWorld(true);
        m.mouthAnchor.getWorldPosition(_mouthWorldPos);

        const endX = m.sprayStartX + m.sprayDirX * m.sprayLength;
        const endZ = m.sprayStartZ + m.sprayDirZ * m.sprayLength;
        const endY = Math.max(
          this.outside.getHeightAt(endX, endZ) + 0.9,
          _mouthWorldPos.y - 0.15,
        );

        m.sprayGroup.position.copy(_mouthWorldPos);
        _sprayEndPos.set(endX, endY, endZ);
        m.sprayGroup.lookAt(_sprayEndPos);

        const beamLen = Math.max(2, _mouthWorldPos.distanceTo(_sprayEndPos));
        const pulse = 0.86 + Math.sin(m.walkPhase * 8 + t * 22) * 0.16;
        const widthScale = (m.sprayHalfWidth / 0.95) * pulse;
        m.sprayBeamOuter.scale.set(widthScale, widthScale, beamLen);
        m.sprayBeamInner.scale.set(widthScale * 0.85, widthScale * 0.85, beamLen);

        for (let p = 0; p < m.sprayPuffs.length; p++) {
          const puff = m.sprayPuffs[p];
          const flow = ((t * 1.9 + p / m.sprayPuffs.length) % 1) * beamLen;
          const jx = Math.sin(t * 24 + p * 2.1) * 0.28 * widthScale;
          const jy = Math.cos(t * 20 + p * 1.7) * 0.22 * widthScale;
          puff.position.set(jx, jy, flow);
          const puffSize = (0.55 + (flow / beamLen) * 0.85) * (m.sprayHalfWidth / 0.95);
          puff.scale.set(puffSize, puffSize, puffSize);
        }

        // Kiểm tra trúng người chơi trên đường phun thẳng + hỗ trợ đỡ bằng Khiên
        if (!m.skillHitDealt && playerInsideOrangeZone) {
          const relX = playerX - m.sprayStartX;
          const relZ = playerZ - m.sprayStartZ;
          const along = relX * m.sprayDirX + relZ * m.sprayDirZ;
          const perp = Math.abs(relX * -m.sprayDirZ + relZ * m.sprayDirX);

          if (
            along >= -0.35 &&
            along <= m.sprayLength &&
            perp <= m.sprayHalfWidth + 0.3 &&
            Math.abs(playerY - m.y) < 3.2
          ) {
            m.skillHitDealt = true;

            let dirToMushroomX = -m.sprayDirX;
            let dirToMushroomZ = -m.sprayDirZ;
            if (distToPlayer > 0.001) {
              dirToMushroomX = (m.x - playerX) / distToPlayer;
              dirToMushroomZ = (m.z - playerZ) / distToPlayer;
            }
            const frontDot = dirToMushroomX * playerFwdX + dirToMushroomZ * playerFwdZ;

            if (shieldRaised && frontDot > 0.15) {
              callbacks?.onShieldBlocked?.(m.level);
            } else {
              callbacks?.onPlayerHit?.(m.damage, m.level, m.sprayDirX, m.sprayDirZ);
            }
          }
        }

        if (m.skillTimer >= POISON_EXECUTE_SECONDS) {
          m.skillPhase = 'idle';
          m.skillTimer = 0;
          m.attackCooldown = POISON_COOLDOWN_SECONDS;
          this.hideEntityVfx(m);
        }
      }

      // Giữ khoảng cách nhẹ giữa các quái nấm với nhau
      let sepX = 0;
      let sepZ = 0;
      for (let j = 0; j < this.mushrooms.length; j++) {
        if (i === j) continue;
        const other = this.mushrooms[j];
        if (!other.alive || other.zone !== m.zone) continue;
        const ox = m.x - other.x;
        const oz = m.z - other.z;
        const minGap = m.radius + other.radius + 0.35;
        const dSq = ox * ox + oz * oz;
        if (dSq > 0.0001 && dSq < minGap * minGap) {
          const d = Math.sqrt(dSq);
          const push = (minGap - d) / minGap;
          sepX += (ox / d) * push * 3.0;
          sepZ += (oz / d) * push * 3.0;
        }
      }

      let knockStepX = 0;
      let knockStepZ = 0;
      if (m.knockTimer > 0) {
        const frac = Math.min(1, dt / m.knockTimer);
        knockStepX = m.knockRemX * frac;
        knockStepZ = m.knockRemZ * frac;
        m.knockRemX -= knockStepX;
        m.knockRemZ -= knockStepZ;
        m.knockTimer = Math.max(0, m.knockTimer - dt);
      }

      m.x += (moveDirX * speed + sepX) * effDt + knockStepX;
      m.z += (moveDirZ * speed + sepZ) * effDt + knockStepZ;
      this.clampInsideZone(m);

      const groundY = this.outside.getHeightAt(m.x, m.z);
      const isMoving = speed > 0.1;
      m.walkPhase += effDt * (m.skillPhase === 'telegraph' ? 11.0 : isMoving ? 6.8 : 2.8);

      const bounceY = isMoving ? Math.abs(Math.sin(m.walkPhase)) * 0.09 * m.scale : 0;
      m.y = groundY + bounceY;

      if (m.skillPhase === 'idle' && Math.hypot(moveDirX, moveDirZ) > 0.05) {
        const targetYaw = Math.atan2(moveDirX, moveDirZ);
        m.yaw += normalizeAngle(targetYaw - m.yaw) * Math.min(1, 8.5 * effDt);
      }

      m.group.position.set(m.x, m.y, m.z);
      m.group.rotation.y = m.yaw;

      m.frostGroup.visible = isSlowed;
      if (isSlowed) {
        m.frostAnimTime += dt;
        m.frostGroup.rotation.y += dt * 1.65;
        for (let fc = 0; fc < m.frostCrystals.length; fc++) {
          const crystal = m.frostCrystals[fc];
          crystal.position.y = 0.6 + Math.sin(m.frostAnimTime * 4.2 + fc * 1.6) * 0.11;
          crystal.rotation.y += dt * 2.2;
        }
      }

      // Hoạt ảnh lắc lư dễ thương / tụ lực hít vào trước khi phun
      if (m.skillPhase === 'telegraph') {
        const puffScale = 1 + Math.sin(m.walkPhase) * 0.04;
        m.bodyGroup.scale.set(
          m.scale * (1.06 * puffScale),
          m.scale * 0.94,
          m.scale * (1.06 * puffScale),
        );
        m.bodyGroup.rotation.x = -0.14;
      } else if (m.skillPhase === 'execute') {
        m.bodyGroup.scale.set(m.scale * 0.96, m.scale * 1.05, m.scale * 0.96);
        m.bodyGroup.rotation.x = 0.18;
      } else {
        const breathe = 1 + Math.sin(m.walkPhase) * 0.025;
        m.bodyGroup.scale.set(m.scale, m.scale * breathe, m.scale);
        m.bodyGroup.rotation.x = isMoving ? 0.06 : 0;
        m.bodyGroup.rotation.z = isMoving ? Math.sin(m.walkPhase) * 0.05 : 0;
      }

      m.shadowMesh.position.set(m.x, groundY + 0.03, m.z);
    }
  }

  dispose(): void {
    this.scene.remove(this.zoneRoot);
    this.scene.remove(this.mushroomRoot);
    this.scene.remove(this.vfxRoot);

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
    this.labelMaterials.clear();
    this.hitMeshes.length = 0;
    this.mushrooms.length = 0;
  }
}
