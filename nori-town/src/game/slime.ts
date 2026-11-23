import * as THREE from 'three';
import { OutsideGenerator } from './outside';
import { SLIME_ZONE_SPECS, SlimeZoneSpec } from './slimeZones';

export type SlimeLevel = 1 | 2 | 3;

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
  bodyMeshes: THREE.Mesh[];
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

const SLIME_RESPAWN_SECONDS = 300.0;

function seededRand(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function createSlimeFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  // Nền xanh ngọc mint giống mẫu pixel art
  ctx.fillStyle = '#4ec799';
  ctx.fillRect(0, 0, 16, 16);

  // Viền xanh đậm bao quanh
  ctx.fillStyle = '#0d565e';
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 15, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
  ctx.fillRect(15, 0, 1, 16);

  // Điểm sáng bóng nhẹ phía trên-trái
  ctx.fillStyle = '#8ef0c8';
  ctx.fillRect(2, 2, 2, 2);
  ctx.fillRect(5, 2, 1, 1);
  ctx.fillRect(2, 5, 1, 1);

  // Phần đáy đậm hơn
  ctx.fillStyle = '#1f8a74';
  ctx.fillRect(1, 13, 14, 2);
  ctx.fillStyle = '#7de6bc';
  ctx.fillRect(5, 14, 4, 1);

  // Hai mắt chữ nhật trắng viền xanh đậm
  ctx.fillStyle = '#0d565e';
  ctx.fillRect(6, 3, 4, 4);
  ctx.fillRect(11, 3, 4, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(7, 4, 2, 2);
  ctx.fillRect(12, 4, 2, 2);

  // Miệng gợn sóng chữ W giống mẫu
  ctx.fillStyle = '#0d5c62';
  ctx.fillRect(5, 8, 2, 5);
  ctx.fillRect(7, 11, 3, 2);
  ctx.fillRect(10, 8, 2, 5);
  ctx.fillRect(12, 11, 2, 2);
  ctx.fillRect(13, 8, 2, 5);
  ctx.fillStyle = '#199482';
  ctx.fillRect(8, 9, 2, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function createSlimeSideTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#47ba8e';
  ctx.fillRect(0, 0, 16, 16);

  ctx.fillStyle = '#0d565e';
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 15, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
  ctx.fillRect(15, 0, 1, 16);

  ctx.fillStyle = '#86e8bf';
  ctx.fillRect(3, 3, 2, 2);
  ctx.fillRect(10, 5, 1, 1);

  ctx.fillStyle = '#1f8a74';
  ctx.fillRect(1, 13, 14, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function createSlimeTopTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#56cf9f';
  ctx.fillRect(0, 0, 16, 16);

  ctx.fillStyle = '#0d565e';
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 15, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
  ctx.fillRect(15, 0, 1, 16);

  ctx.fillStyle = '#9cf5d2';
  ctx.fillRect(3, 3, 3, 2);
  ctx.fillRect(4, 6, 1, 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
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

  private readonly sideMat: THREE.MeshLambertMaterial;
  private readonly frontMat: THREE.MeshLambertMaterial;
  private readonly topMat: THREE.MeshLambertMaterial;
  private readonly darkMat: THREE.MeshLambertMaterial;
  private readonly hitFlashMat: THREE.MeshBasicMaterial;
  private readonly bodyMaterials: THREE.Material[];
  private readonly labelMaterials = new Map<string, THREE.SpriteMaterial>();

  private readonly tempVec = new THREE.Vector3();

  constructor(scene: THREE.Scene, outside: OutsideGenerator, seed: number) {
    this.scene = scene;
    this.outside = outside;
    this.seed = seed;

    const faceTex = createSlimeFaceTexture();
    const sideTex = createSlimeSideTexture();
    const topTex = createSlimeTopTexture();
    this.textures.push(faceTex, sideTex, topTex);

    this.sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
    this.frontMat = new THREE.MeshLambertMaterial({ map: faceTex });
    this.topMat = new THREE.MeshLambertMaterial({ map: topTex });
    this.darkMat = new THREE.MeshLambertMaterial({ color: '#0d565e' });
    this.hitFlashMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.materials.push(this.sideMat, this.frontMat, this.topMat, this.darkMat, this.hitFlashMat);

    // Three.js BoxGeometry faces: [+X, -X, +Y, -Y, +Z (front), -Z]
    this.bodyMaterials = [
      this.sideMat,
      this.sideMat,
      this.topMat,
      this.darkMat,
      this.frontMat,
      this.sideMat,
    ];

    this.buildPinkZones();
    this.spawnAllSlimes();

    this.scene.add(this.zoneRoot);
    this.scene.add(this.slimeRoot);
  }

  private buildPinkZones(): void {
    const discMat = new THREE.MeshBasicMaterial({
      color: '#ec4899',
      transparent: true,
      opacity: 0.22,
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
      // 1. Vùng phủ màu hồng bám địa hình parabol
      const discMesh = this.buildTerrainDiscMesh(zone.x, zone.z, 0, zone.radius, 8, 40, 0.05, discMat);
      this.zoneRoot.add(discMesh);

      // 2. Đường viền tròn màu hồng đậm nổi bật ranh giới vùng hoạt động
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
    canvas.width = 160;
    canvas.height = 54;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(6, 4, 148, 46);
    ctx.strokeStyle = level === 3 ? '#f59e0b' : level === 2 ? '#38bdf8' : '#34d399';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 4, 148, 46);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = level === 3 ? '#fcd34d' : level === 2 ? '#7dd3fc' : '#6ee7b7';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`Slime Lv.${level}`, 80, 19);

    // Thanh máu chia vạch theo số lần chém Katana
    const barW = 124;
    const barX = 18;
    const barY = 33;
    const barH = 10;
    const gap = 3;
    const segW = (barW - gap * (maxHp - 1)) / maxHp;

    for (let i = 0; i < maxHp; i++) {
      ctx.fillStyle = i < hp ? '#fb7185' : '#334155';
      ctx.fillRect(barX + i * (segW + gap), barY, segW, barH);
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
    // Geometry dùng chung cho thân slime kiểu dome pixel 3D
    const skirtGeo = new THREE.BoxGeometry(1.06, 0.2, 1.06);
    const bodyGeo = new THREE.BoxGeometry(0.92, 0.56, 0.92);
    const domeGeo = new THREE.BoxGeometry(0.7, 0.2, 0.7);
    const capGeo = new THREE.BoxGeometry(0.44, 0.1, 0.44);
    this.geometries.push(skirtGeo, bodyGeo, domeGeo, capGeo);

    let globalIdx = 0;

    for (const zone of SLIME_ZONE_SPECS) {
      // Mỗi vùng có: 1 con Lv3 (6 chém, 100 XP), 2 con Lv2 (4 chém, 50 XP), 7 con Lv1 (2 chém, 10 XP)
      const levels: SlimeLevel[] = [3, 2, 2, 1, 1, 1, 1, 1, 1, 1];

      levels.forEach((level, idx) => {
        globalIdx++;
        const maxHp = level === 3 ? 6 : level === 2 ? 4 : 2;
        const xpReward = level === 3 ? 100 : level === 2 ? 50 : 10;
        const scale = level === 3 ? 1.48 : level === 2 ? 1.08 : 0.76;
        const radius = 0.52 * scale;
        const moveSpeed = level === 3 ? 3.25 : level === 2 ? 2.95 : 2.65;
        const aggroRadius = level === 3 ? 15.0 : level === 2 ? 13.5 : 12.0;

        const spawnPos = this.pickPointInZone(zone, radius, this.seed + globalIdx * 37);
        const groundY = this.outside.getHeightAt(spawnPos.x, spawnPos.z);

        const group = new THREE.Group();
        group.position.set(spawnPos.x, groundY, spawnPos.z);

        const bodyGroup = new THREE.Group();
        bodyGroup.scale.set(scale, scale, scale);

        const skirtMesh = new THREE.Mesh(skirtGeo, this.darkMat);
        skirtMesh.position.set(0, 0.1, 0);

        const mainMesh = new THREE.Mesh(bodyGeo, this.bodyMaterials);
        mainMesh.position.set(0, 0.42, 0);

        const domeMesh = new THREE.Mesh(domeGeo, this.topMat);
        domeMesh.position.set(0, 0.78, 0);

        const capMesh = new THREE.Mesh(capGeo, this.topMat);
        capMesh.position.set(0, 0.92, 0);

        bodyGroup.add(skirtMesh, mainMesh, domeMesh, capMesh);
        group.add(bodyGroup);

        const labelMat = this.getLabelMaterial(level, maxHp, maxHp);
        const labelSprite = new THREE.Sprite(labelMat);
        labelSprite.position.set(0, 1.18 * scale + 0.32, 0);
        labelSprite.scale.set(1.35, 0.46, 1);
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
          bodyMeshes: [skirtMesh, mainMesh, domeMesh, capMesh],
          labelSprite,
        };

        for (const m of slime.bodyMeshes) {
          m.userData.slime = slime;
          this.hitMeshes.push(m);
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
    const [skirt, main, dome, cap] = slime.bodyMeshes;
    if (flashing) {
      skirt.material = this.hitFlashMat;
      main.material = this.hitFlashMat;
      dome.material = this.hitFlashMat;
      cap.material = this.hitFlashMat;
    } else {
      skirt.material = this.darkMat;
      main.material = this.bodyMaterials;
      dome.material = this.topMat;
      cap.material = this.topMat;
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
    // 1. Ưu tiên tia nhìn trực tiếp
    let target: SlimeEntity | null = null;
    const rayHit = this.raycastSlime(cameraPos, forwardDir, maxRange);
    if (rayHit) {
      target = rayHit.slime;
    } else {
      // 2. Hỗ trợ tầm chém vòng cung phía trước mặt để dễ trúng Slime thấp ở gần chân
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

    // Đẩy lùi slime đúng 0.5 block khi bị chém (vẫn giữ chặt trong vòng màu hồng)
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

      // Kiểm tra người chơi có nằm trong vùng màu hồng của slime hay không
      const pZoneDistSq =
        (playerX - slime.zone.x) * (playerX - slime.zone.x) +
        (playerZ - slime.zone.z) * (playerZ - slime.zone.z);
      const playerInsidePinkZone = pZoneDistSq <= slime.zone.radius * slime.zone.radius;

      const toPlayerX = playerX - slime.x;
      const toPlayerZ = playerZ - slime.z;
      const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

      // Khi người chơi ở trong vòng màu hồng và bước vào vòng an toàn của slime -> dí theo;
      // hễ ra khỏi vòng màu hồng -> ngừng dí ngay lập tức.
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

      // Tách nhẹ các con slime gần nhau để không dồn chồng 1 điểm
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

      // Hiệu ứng nhún dẻo khi nhảy
      const squash = 1 + Math.sin(slime.hopPhase * 2) * 0.06;
      const bodyGroup = slime.group.children[0];
      if (bodyGroup) {
        bodyGroup.scale.set(
          slime.scale / Math.sqrt(squash),
          slime.scale * squash,
          slime.scale / Math.sqrt(squash),
        );
      }

      // Kiểm tra va chạm tấn công người chơi (chỉ khi người chơi vẫn trong vùng màu hồng)
      if (
        playerInsidePinkZone &&
        slime.attackCooldown <= 0 &&
        distToPlayer <= slime.radius + 0.65 &&
        Math.abs(playerY - groundY) < 2.2
      ) {
        slime.attackCooldown = 1.15;

        // Sát thương theo cấp slime: Lv1 = 0.5 tim, Lv2 = 1 tim, Lv3 = 1.5 tim
        const damage = slime.level === 3 ? 1.5 : slime.level === 2 ? 1.0 : 0.5;
        let dirToSlimeX = -playerFwdX;
        let dirToSlimeZ = -playerFwdZ;
        if (distToPlayer > 0.001) {
          dirToSlimeX = (slime.x - playerX) / distToPlayer;
          dirToSlimeZ = (slime.z - playerZ) / distToPlayer;
        }
        const frontDot = dirToSlimeX * playerFwdX + dirToSlimeZ * playerFwdZ;

        if (shieldRaised && frontDot > 0.15) {
          // Đỡ được phía trước bằng khiên: đẩy lùi slime 1 block
          slime.knockRemX = dirToSlimeX * 1.0;
          slime.knockRemZ = dirToSlimeZ * 1.0;
          slime.knockTimer = 0.14;
          callbacks?.onShieldBlocked?.(slime.level);
        } else {
          // Bị đánh (kể cả lúc lo đỡ phía trước mà hở sau lưng): đẩy người chơi đi 0.5 block theo hướng đòn đánh
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
