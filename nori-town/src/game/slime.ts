import * as THREE from 'three';
import { OutsideGenerator } from './outside';
import { SLIME_ZONE_SPECS, SlimeZoneSpec } from './slimeZones';
import { createSoftShadowTexture } from './textures';

export type SlimeLevel = 1 | 2 | 3;

interface SlimeMeshPart {
  mesh: THREE.Mesh;
  origMat: THREE.Material | THREE.Material[];
}

export interface SlimeEntity {
  id: string;
  zone: SlimeZoneSpec;
  level: SlimeLevel;
  maxHp: number;
  hp: number;
  xpReward: number;
  scale: number;
  radius: number;
  moveSpeed: number;
  aggroRadius: number;
  x: number;
  y: number;
  z: number;
  knockRemX: number;
  knockRemZ: number;
  knockTimer: number;
  yaw: number;
  hopPhase: number;
  wanderAngle: number;
  wanderTimer: number;
  attackCooldown: number;
  hitFlashTimer: number;
  isChasing: boolean;
  alive: boolean;
  respawnTimer: number;
  group: THREE.Group;
  bodyGroup: THREE.Group;
  shadowMesh: THREE.Mesh;
  bodyParts: SlimeMeshPart[];
  labelSprite: THREE.Sprite;
}

export interface SlimeAttackResult {
  hit: boolean;
  killed: boolean;
  level: SlimeLevel;
  xpReward: number;
  remainingHp: number;
  maxHp: number;
}

export interface SlimeUpdateCallbacks {
  onPlayerHit?: (damage: number, slimeLevel: SlimeLevel, dirX: number, dirZ: number) => void;
  onShieldBlocked?: (slimeLevel: SlimeLevel) => void;
}

interface TierVisualSet {
  outerGelMat: THREE.MeshPhysicalMaterial;
  coreSideMat: THREE.MeshStandardMaterial;
  coreFaceMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  coreMaterials: THREE.Material[];
}

const SLIME_RESPAWN_SECONDS = 300.0;

function seededRand(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function createSlimeCoreFaceTexture(level: SlimeLevel): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const bg = level === 3 ? '#c2410c' : level === 2 ? '#0369a1' : '#047857';
  const dark = level === 3 ? '#431407' : level === 2 ? '#082f49' : '#022c22';
  const glow = level === 3 ? '#fdba74' : level === 2 ? '#7dd3fc' : '#6ee7b7';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 64, 64);

  // Vầng sáng lõi nhẹ bên trong
  const grad = ctx.createRadialGradient(32, 30, 4, 32, 32, 34);
  grad.addColorStop(0, glow);
  grad.addColorStop(1, bg);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  ctx.globalAlpha = 1;

  // Mắt sắc nét có ánh sáng long lanh
  const drawEye = (ex: number, ey: number, slant: number) => {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(ex - 7, ey - 8, 14, 16, 4);
    ctx.fill();

    // Lông mày nghiêng cho Slime cấp cao nhìn ngầu hơn
    if (level >= 2) {
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(ex - 8, ey - 9);
      ctx.lineTo(ex + 8, ey - 9);
      ctx.lineTo(ex + 8, ey - 9 + slant);
      ctx.lineTo(ex - 8, ey - 9 - slant);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(ex - 4, ey - 4, 6, 7, 2);
    ctx.fill();

    ctx.fillStyle = glow;
    ctx.fillRect(ex + 1, ey + 2, 3, 3);
  };

  drawEye(20, 27, level >= 2 ? 3 : 0);
  drawEye(44, 27, level >= 2 ? -3 : 0);

  // Má hồng / ánh sáng nhỏ
  ctx.fillStyle = level === 3 ? 'rgba(253, 224, 71, 0.38)' : 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.ellipse(12, 39, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(52, 39, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Miệng chữ W tinh nghịch / hung dữ theo cấp
  ctx.strokeStyle = dark;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (level === 1) {
    ctx.moveTo(22, 43);
    ctx.quadraticCurveTo(27, 49, 32, 43);
    ctx.quadraticCurveTo(37, 49, 42, 43);
  } else {
    ctx.moveTo(20, 45);
    ctx.lineTo(26, 41);
    ctx.lineTo(32, 46);
    ctx.lineTo(38, 41);
    ctx.lineTo(44, 45);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SlimeManager {
  private readonly scene: THREE.Scene;
  private readonly outside: OutsideGenerator;
  private readonly seed: number;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];

  private readonly zoneRoot = new THREE.Group();
  private readonly slimeRoot = new THREE.Group();
  private readonly slimes: SlimeEntity[] = [];
  private readonly hitMeshes: THREE.Object3D[] = [];
  private readonly raycaster = new THREE.Raycaster();

  private readonly hitFlashMat: THREE.MeshBasicMaterial;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly tierVisuals: Record<SlimeLevel, TierVisualSet>;
  private readonly labelMaterials = new Map<string, THREE.SpriteMaterial>();

  private readonly tempVec = new THREE.Vector3();

  constructor(scene: THREE.Scene, outside: OutsideGenerator, seed: number) {
    this.scene = scene;
    this.outside = outside;
    this.seed = seed;

    this.hitFlashMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const shadowTex = createSoftShadowTexture();
    this.textures.push(shadowTex);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.materials.push(this.hitFlashMat, this.shadowMat);

    const makeTier = (
      level: SlimeLevel,
      outerColor: string,
      coreColor: string,
      emissiveColor: string,
      accentColor: string,
    ): TierVisualSet => {
      const faceTex = createSlimeCoreFaceTexture(level);
      this.textures.push(faceTex);

      const outerGelMat = new THREE.MeshPhysicalMaterial({
        color: outerColor,
        roughness: 0.08,
        metalness: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        ior: 1.38,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      });

      const coreSideMat = new THREE.MeshStandardMaterial({
        color: coreColor,
        emissive: emissiveColor,
        emissiveIntensity: level === 3 ? 0.42 : level === 2 ? 0.34 : 0.24,
        roughness: 0.3,
        metalness: 0.08,
      });

      const coreFaceMat = new THREE.MeshStandardMaterial({
        map: faceTex,
        emissive: emissiveColor,
        emissiveIntensity: 0.22,
        roughness: 0.28,
        metalness: 0.06,
      });

      const accentMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        emissive: accentColor,
        emissiveIntensity: level === 3 ? 0.35 : 0.2,
        roughness: 0.22,
        metalness: level === 3 ? 0.72 : 0.15,
      });

      this.materials.push(outerGelMat, coreSideMat, coreFaceMat, accentMat);

      return {
        outerGelMat,
        coreSideMat,
        coreFaceMat,
        accentMat,
        coreMaterials: [
          coreSideMat,
          coreSideMat,
          coreSideMat,
          coreSideMat,
          coreFaceMat,
          coreSideMat,
        ],
      };
    };

    this.tierVisuals = {
      1: makeTier(1, '#34d399', '#047857', '#10b981', '#a7f3d0'),
      2: makeTier(2, '#38bdf8', '#0369a1', '#0ea5e9', '#7dd3fc'),
      3: makeTier(3, '#fbbf24', '#c2410c', '#f59e0b', '#fde047'),
    };

    this.buildPinkZones();
    this.spawnAllSlimes();

    this.scene.add(this.zoneRoot);
    this.scene.add(this.slimeRoot);
  }

  private buildPinkZones(): void {
    const discMat = new THREE.MeshBasicMaterial({
      color: '#ec4899',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ff4fa3',
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials.push(discMat, ringMat);

    for (const zone of SLIME_ZONE_SPECS) {
      const discMesh = this.buildTerrainDiscMesh(zone.x, zone.z, 0, zone.radius, 8, 40, 0.05, discMat);
      this.zoneRoot.add(discMesh);

      const ringMesh = this.buildTerrainDiscMesh(
        zone.x,
        zone.z,
        zone.radius - 0.45,
        zone.radius + 0.25,
        2,
        48,
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

  private getLabelMaterial(level: SlimeLevel, hp: number, maxHp: number): THREE.SpriteMaterial {
    const key = `${level}:${hp}/${maxHp}`;
    const existing = this.labelMaterials.get(key);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(10, 18, 34, 0.88)';
    ctx.beginPath();
    ctx.roundRect(6, 6, 212, 60, 12);
    ctx.fill();

    ctx.strokeStyle = level === 3 ? '#f59e0b' : level === 2 ? '#38bdf8' : '#34d399';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(6, 6, 212, 60, 12);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = level === 3 ? '#fde68a' : level === 2 ? '#bae6fd' : '#a7f3d0';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(level === 3 ? `★ Slime Lv.${level}` : `Slime Lv.${level}`, 112, 24);

    // Thanh máu chia vạch bo tròn
    const barW = 176;
    const barX = 24;
    const barY = 42;
    const barH = 12;
    const gap = 4;
    const segW = (barW - gap * (maxHp - 1)) / maxHp;

    for (let i = 0; i < maxHp; i++) {
      ctx.fillStyle = i < hp ? '#fb7185' : '#334155';
      ctx.beginPath();
      ctx.roundRect(barX + i * (segW + gap), barY, segW, barH, 3);
      ctx.fill();
    }

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

  private spawnAllSlimes(): void {
    // Vỏ gel trong suốt nhiều tầng + lõi nhân phát sáng + bọt khí + vương miện/sừng theo cấp
    const outerSkirtGeo = new THREE.BoxGeometry(1.06, 0.22, 1.06);
    const outerBodyGeo = new THREE.BoxGeometry(0.94, 0.56, 0.94);
    const outerDomeGeo = new THREE.BoxGeometry(0.74, 0.2, 0.74);
    const outerCapGeo = new THREE.BoxGeometry(0.48, 0.1, 0.48);

    const coreGeo = new THREE.BoxGeometry(0.56, 0.44, 0.56);
    const bubbleGeo = new THREE.IcosahedronGeometry(0.085, 1);
    const finGeo = new THREE.ConeGeometry(0.14, 0.36, 4);
    const crownBandGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.1, 6);
    const crownSpikeGeo = new THREE.ConeGeometry(0.065, 0.2, 4);
    const shadowGeo = new THREE.PlaneGeometry(1.45, 1.45);
    shadowGeo.rotateX(-Math.PI / 2);

    this.geometries.push(
      outerSkirtGeo,
      outerBodyGeo,
      outerDomeGeo,
      outerCapGeo,
      coreGeo,
      bubbleGeo,
      finGeo,
      crownBandGeo,
      crownSpikeGeo,
      shadowGeo,
    );

    let globalIdx = 0;

    for (const zone of SLIME_ZONE_SPECS) {
      // Mỗi vùng có: 1 con Lv3 (6 chém, 100 XP), 2 con Lv2 (4 chém, 50 XP), 7 con Lv1 (2 chém, 10 XP)
      const levels: SlimeLevel[] = [3, 2, 2, 1, 1, 1, 1, 1, 1, 1];

      levels.forEach((level, idx) => {
        globalIdx++;
        const maxHp = level === 3 ? 6 : level === 2 ? 4 : 2;
        const xpReward = level === 3 ? 100 : level === 2 ? 50 : 10;
        const scale = level === 3 ? 1.52 : level === 2 ? 1.12 : 0.78;
        const radius = 0.52 * scale;
        const moveSpeed = level === 3 ? 3.25 : level === 2 ? 2.95 : 2.65;
        const aggroRadius = level === 3 ? 15.0 : level === 2 ? 13.5 : 12.0;

        const spawnPos = this.pickPointInZone(zone, radius, this.seed + globalIdx * 37);
        const groundY = this.outside.getHeightAt(spawnPos.x, spawnPos.z);

        const visuals = this.tierVisuals[level];
        const group = new THREE.Group();
        group.position.set(spawnPos.x, groundY, spawnPos.z);

        const bodyGroup = new THREE.Group();
        bodyGroup.scale.set(scale, scale, scale);

        const bodyParts: SlimeMeshPart[] = [];
        const addPart = (
          geo: THREE.BufferGeometry,
          mat: THREE.Material | THREE.Material[],
          px: number,
          py: number,
          pz: number,
          renderOrder: number,
          castShadow = false,
          rx = 0,
          ry = 0,
          rz = 0,
        ): THREE.Mesh => {
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(px, py, pz);
          mesh.rotation.set(rx, ry, rz);
          mesh.renderOrder = renderOrder;
          mesh.castShadow = castShadow;
          mesh.receiveShadow = true;
          bodyGroup.add(mesh);
          bodyParts.push({ mesh, origMat: mat });
          return mesh;
        };

        // 1. Lõi nhân bên trong kèm khuôn mặt sắc nét
        addPart(coreGeo, visuals.coreMaterials, 0, 0.42, 0.04, 1, true);

        // Bọt khí lơ lửng trong khối thạch
        addPart(bubbleGeo, visuals.accentMat, -0.28, 0.62, 0.18, 1, false);
        addPart(bubbleGeo, visuals.accentMat, 0.25, 0.28, -0.22, 1, false);

        // Chi tiết nhận diện riêng cho Slime cấp 2 và cấp 3
        if (level === 2) {
          addPart(finGeo, visuals.accentMat, -0.34, 0.85, -0.05, 1, true, -0.2, 0, 0.45);
          addPart(finGeo, visuals.accentMat, 0.34, 0.85, -0.05, 1, true, -0.2, 0, -0.45);
        } else if (level === 3) {
          addPart(crownBandGeo, visuals.accentMat, 0, 1.02, 0, 3, true);
          for (let s = 0; s < 4; s++) {
            const ang = (s * Math.PI) / 2;
            addPart(
              crownSpikeGeo,
              visuals.accentMat,
              Math.cos(ang) * 0.18,
              1.15,
              Math.sin(ang) * 0.18,
              3,
              true,
            );
          }
        }

        // 2. Lớp vỏ thạch trong suốt bóng loáng bao bọc bên ngoài
        addPart(outerSkirtGeo, visuals.outerGelMat, 0, 0.11, 0, 2, false);
        addPart(outerBodyGeo, visuals.outerGelMat, 0, 0.43, 0, 2, true);
        addPart(outerDomeGeo, visuals.outerGelMat, 0, 0.78, 0, 2, false);
        addPart(outerCapGeo, visuals.outerGelMat, 0, 0.92, 0, 2, false);

        group.add(bodyGroup);

        // Bóng tiếp xúc mềm dưới chân slime (đứng yên trên mặt đất khi slime nhảy)
        const shadowMesh = new THREE.Mesh(shadowGeo, this.shadowMat);
        shadowMesh.position.set(spawnPos.x, groundY + 0.03, spawnPos.z);
        shadowMesh.scale.set(scale, 1, scale);
        this.slimeRoot.add(shadowMesh);

        const labelMat = this.getLabelMaterial(level, maxHp, maxHp);
        const labelSprite = new THREE.Sprite(labelMat);
        labelSprite.position.set(0, 1.32 * scale + 0.36, 0);
        labelSprite.scale.set(1.5, 0.48, 1);
        group.add(labelSprite);

        this.slimeRoot.add(group);

        const slime: SlimeEntity = {
          id: `${zone.id}:slime:${idx}`,
          zone,
          level,
          maxHp,
          hp: maxHp,
          xpReward,
          scale,
          radius,
          moveSpeed,
          aggroRadius,
          x: spawnPos.x,
          y: groundY,
          z: spawnPos.z,
          knockRemX: 0,
          knockRemZ: 0,
          knockTimer: 0,
          yaw: seededRand(globalIdx * 13) * Math.PI * 2,
          hopPhase: seededRand(globalIdx * 29) * Math.PI * 2,
          wanderAngle: seededRand(globalIdx * 41) * Math.PI * 2,
          wanderTimer: 1 + seededRand(globalIdx * 53) * 2.5,
          attackCooldown: 0,
          hitFlashTimer: 0,
          isChasing: false,
          alive: true,
          respawnTimer: 0,
          group,
          bodyGroup,
          shadowMesh,
          bodyParts,
          labelSprite,
        };

        for (const part of bodyParts) {
          part.mesh.userData.slime = slime;
          this.hitMeshes.push(part.mesh);
        }

        this.slimes.push(slime);
      });
    }
  }

  private pickPointInZone(
    zone: SlimeZoneSpec,
    slimeRadius: number,
    seedVal: number,
  ): { x: number; z: number } {
    const r = Math.sqrt(seededRand(seedVal)) * Math.max(2, zone.radius - slimeRadius - 1.5);
    const angle = seededRand(seedVal + 97) * Math.PI * 2;
    return {
      x: zone.x + Math.cos(angle) * r,
      z: zone.z + Math.sin(angle) * r,
    };
  }

  private clampSlimeInsideZone(slime: SlimeEntity): void {
    const maxR = Math.max(1.0, slime.zone.radius - slime.radius - 0.15);
    const dx = slime.x - slime.zone.x;
    const dz = slime.z - slime.zone.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > maxR * maxR) {
      const dist = Math.sqrt(distSq);
      slime.x = slime.zone.x + (dx / dist) * maxR;
      slime.z = slime.zone.z + (dz / dist) * maxR;
      slime.wanderAngle = Math.atan2(-dz, -dx);
    }
  }

  private setSlimeFlash(slime: SlimeEntity, flashing: boolean): void {
    for (const part of slime.bodyParts) {
      part.mesh.material = flashing ? this.hitFlashMat : part.origMat;
    }
  }

  raycastSlime(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 6.5,
  ): { slime: SlimeEntity; point: THREE.Vector3 } | null {
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    for (const hit of hits) {
      const slime = hit.object.userData.slime as SlimeEntity | undefined;
      if (slime && slime.alive) {
        return { slime, point: hit.point };
      }
    }
    return null;
  }

  attackWithKatana(
    cameraPos: THREE.Vector3,
    forwardDir: THREE.Vector3,
    maxRange = 3.8,
  ): SlimeAttackResult {
    let target: SlimeEntity | null = null;
    const rayHit = this.raycastSlime(cameraPos, forwardDir, maxRange);
    if (rayHit) {
      target = rayHit.slime;
    } else {
      let bestScore = Infinity;
      for (const slime of this.slimes) {
        if (!slime.alive) continue;
        this.tempVec.set(
          slime.x - cameraPos.x,
          slime.y + 0.5 * slime.scale - cameraPos.y,
          slime.z - cameraPos.z,
        );
        const dist = this.tempVec.length();
        if (dist > maxRange + slime.radius) continue;

        const horizDist = Math.hypot(slime.x - cameraPos.x, slime.z - cameraPos.z);
        if (horizDist > maxRange + slime.radius) continue;

        this.tempVec.normalize();
        const dot = this.tempVec.dot(forwardDir);
        if (dot > 0.62 && dist < bestScore) {
          bestScore = dist;
          target = slime;
        }
      }
    }

    if (!target) {
      return {
        hit: false,
        killed: false,
        level: 1,
        xpReward: 0,
        remainingHp: 0,
        maxHp: 0,
      };
    }

    target.hp = Math.max(0, target.hp - 1);
    target.hitFlashTimer = 0.14;
    this.setSlimeFlash(target, true);

    const kx = target.x - cameraPos.x;
    const kz = target.z - cameraPos.z;
    const kLen = Math.hypot(kx, kz) || 1;
    target.knockRemX = (kx / kLen) * 0.5;
    target.knockRemZ = (kz / kLen) * 0.5;
    target.knockTimer = 0.1;

    if (target.hp <= 0) {
      target.alive = false;
      target.isChasing = false;
      target.respawnTimer = SLIME_RESPAWN_SECONDS;
      target.group.visible = false;
      target.shadowMesh.visible = false;
      this.setSlimeFlash(target, false);
      return {
        hit: true,
        killed: true,
        level: target.level,
        xpReward: target.xpReward,
        remainingHp: 0,
        maxHp: target.maxHp,
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
    };
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerYaw: number,
    shieldRaised: boolean,
    callbacks?: SlimeUpdateCallbacks,
  ): void {
    const playerFwdX = -Math.sin(playerYaw);
    const playerFwdZ = -Math.cos(playerYaw);

    for (let i = 0; i < this.slimes.length; i++) {
      const slime = this.slimes[i];

      if (!slime.alive) {
        slime.respawnTimer -= dt;
        if (slime.respawnTimer <= 0) {
          const pos = this.pickPointInZone(
            slime.zone,
            slime.radius,
            this.seed + Math.floor(performance.now()) + i * 71,
          );
          slime.x = pos.x;
          slime.z = pos.z;
          slime.y = this.outside.getHeightAt(pos.x, pos.z);
          slime.knockRemX = 0;
          slime.knockRemZ = 0;
          slime.knockTimer = 0;
          slime.hp = slime.maxHp;
          slime.alive = true;
          slime.isChasing = false;
          slime.attackCooldown = 0.8;
          slime.hitFlashTimer = 0;
          this.setSlimeFlash(slime, false);
          slime.labelSprite.material = this.getLabelMaterial(
            slime.level,
            slime.hp,
            slime.maxHp,
          );
          slime.group.position.set(slime.x, slime.y, slime.z);
          slime.group.visible = true;
          slime.shadowMesh.position.set(slime.x, slime.y + 0.03, slime.z);
          slime.shadowMesh.visible = true;
        }
        continue;
      }

      if (slime.attackCooldown > 0) {
        slime.attackCooldown = Math.max(0, slime.attackCooldown - dt);
      }

      if (slime.hitFlashTimer > 0) {
        slime.hitFlashTimer -= dt;
        if (slime.hitFlashTimer <= 0) {
          this.setSlimeFlash(slime, false);
        }
      }

      const pZoneDistSq =
        (playerX - slime.zone.x) * (playerX - slime.zone.x) +
        (playerZ - slime.zone.z) * (playerZ - slime.zone.z);
      const playerInsidePinkZone = pZoneDistSq <= slime.zone.radius * slime.zone.radius;

      const toPlayerX = playerX - slime.x;
      const toPlayerZ = playerZ - slime.z;
      const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

      if (playerInsidePinkZone && distToPlayer <= slime.aggroRadius) {
        slime.isChasing = true;
      } else if (!playerInsidePinkZone || distToPlayer > slime.aggroRadius + 2.5) {
        slime.isChasing = false;
      }

      let moveDirX = 0;
      let moveDirZ = 0;
      let speed = 0;

      if (slime.isChasing && distToPlayer > 0.01) {
        moveDirX = toPlayerX / distToPlayer;
        moveDirZ = toPlayerZ / distToPlayer;
        speed = slime.moveSpeed;
      } else {
        slime.wanderTimer -= dt;
        if (slime.wanderTimer <= 0) {
          slime.wanderTimer = 1.6 + seededRand(i * 19 + performance.now() * 0.01) * 2.4;
          const distFromCenter = Math.hypot(slime.x - slime.zone.x, slime.z - slime.zone.z);
          if (distFromCenter > slime.zone.radius * 0.68) {
            slime.wanderAngle = Math.atan2(slime.zone.z - slime.z, slime.zone.x - slime.x);
          } else {
            slime.wanderAngle += (seededRand(i * 31 + performance.now() * 0.03) - 0.5) * 2.4;
          }
        }
        moveDirX = Math.cos(slime.wanderAngle);
        moveDirZ = Math.sin(slime.wanderAngle);
        speed = slime.moveSpeed * 0.34;
      }

      let sepX = 0;
      let sepZ = 0;
      for (let j = 0; j < this.slimes.length; j++) {
        if (i === j) continue;
        const other = this.slimes[j];
        if (!other.alive || other.zone !== slime.zone) continue;
        const ox = slime.x - other.x;
        const oz = slime.z - other.z;
        const minGap = slime.radius + other.radius + 0.15;
        const dSq = ox * ox + oz * oz;
        if (dSq > 0.0001 && dSq < minGap * minGap) {
          const d = Math.sqrt(dSq);
          const push = (minGap - d) / minGap;
          sepX += (ox / d) * push * 3.5;
          sepZ += (oz / d) * push * 3.5;
        }
      }

      let knockStepX = 0;
      let knockStepZ = 0;
      if (slime.knockTimer > 0) {
        const frac = Math.min(1, dt / slime.knockTimer);
        knockStepX = slime.knockRemX * frac;
        knockStepZ = slime.knockRemZ * frac;
        slime.knockRemX -= knockStepX;
        slime.knockRemZ -= knockStepZ;
        slime.knockTimer = Math.max(0, slime.knockTimer - dt);
      }

      slime.x += (moveDirX * speed + sepX) * dt + knockStepX;
      slime.z += (moveDirZ * speed + sepZ) * dt + knockStepZ;
      this.clampSlimeInsideZone(slime);

      const groundY = this.outside.getHeightAt(slime.x, slime.z);
      slime.hopPhase += dt * (slime.isChasing ? 8.5 : 4.2);
      const hopHeight = Math.abs(Math.sin(slime.hopPhase)) * (slime.isChasing ? 0.32 : 0.12);
      slime.y = groundY + hopHeight;

      if (Math.hypot(moveDirX, moveDirZ) > 0.05) {
        const targetYaw = Math.atan2(moveDirX, moveDirZ);
        let diff = targetYaw - slime.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        slime.yaw += diff * Math.min(1, 10 * dt);
      }

      slime.group.position.set(slime.x, slime.y, slime.z);
      slime.group.rotation.y = slime.yaw;

      const shadowScale = slime.scale * (1 - Math.min(0.32, hopHeight * 0.7));
      slime.shadowMesh.position.set(slime.x, groundY + 0.03, slime.z);
      slime.shadowMesh.scale.set(shadowScale, 1, shadowScale);

      const squash = 1 + Math.sin(slime.hopPhase * 2) * 0.075;
      slime.bodyGroup.scale.set(
        slime.scale / Math.sqrt(squash),
        slime.scale * squash,
        slime.scale / Math.sqrt(squash),
      );

      if (
        playerInsidePinkZone &&
        slime.attackCooldown <= 0 &&
        distToPlayer <= slime.radius + 0.65 &&
        Math.abs(playerY - groundY) < 2.2
      ) {
        slime.attackCooldown = 1.15;

        const damage = slime.level === 3 ? 1.5 : slime.level === 2 ? 1.0 : 0.5;
        let dirToSlimeX = -playerFwdX;
        let dirToSlimeZ = -playerFwdZ;
        if (distToPlayer > 0.001) {
          dirToSlimeX = (slime.x - playerX) / distToPlayer;
          dirToSlimeZ = (slime.z - playerZ) / distToPlayer;
        }
        const frontDot = dirToSlimeX * playerFwdX + dirToSlimeZ * playerFwdZ;

        if (shieldRaised && frontDot > 0.15) {
          slime.knockRemX = dirToSlimeX * 1.0;
          slime.knockRemZ = dirToSlimeZ * 1.0;
          slime.knockTimer = 0.14;
          callbacks?.onShieldBlocked?.(slime.level);
        } else {
          callbacks?.onPlayerHit?.(damage, slime.level, -dirToSlimeX, -dirToSlimeZ);
        }
      }
    }
  }

  dispose(): void {
    this.scene.remove(this.zoneRoot);
    this.scene.remove(this.slimeRoot);

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
    this.slimes.length = 0;
  }
}
