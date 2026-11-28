import * as THREE from 'three';
import { OutsideGenerator } from './outside';
import { createParabolicEllipsoidGeometry, createParabolicLatheGeometry } from './parabolic';
import { DRAGON_ZONE_SPEC } from './slimeZones';

export const STAGE_CAVE_X = DRAGON_ZONE_SPEC.x;
export const STAGE_CAVE_Z = DRAGON_ZONE_SPEC.z - 11.5;
export const CAVE_EMERGE_DURATION = 15.0;
export const STAGE1_CLEAR_BANNER_DURATION = 15.0;
export const PORTAL_REQUIRED_LEVEL = 15;

export type StageCavePhase = 'hidden' | 'emerging' | 'open';

export interface StageCaveStatus {
  phase: StageCavePhase;
  emergeProgress: number;
  emergeRemainingSec: number;
  clearBannerRemainingSec: number;
}

function createFallbackPortalTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    const bg = ctx.createRadialGradient(cx, cy, 12, cx, cy, 245);
    bg.addColorStop(0, '#020617');
    bg.addColorStop(0.22, '#1e1b4b');
    bg.addColorStop(0.48, '#0284c7');
    bg.addColorStop(0.72, '#a855f7');
    bg.addColorStop(0.88, '#fde047');
    bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Các vòng xoáy năng lượng
    for (let arm = 0; arm < 6; arm++) {
      const baseAngle = (arm / 6) * Math.PI * 2;
      ctx.beginPath();
      for (let step = 0; step <= 48; step++) {
        const t = step / 48;
        const r = 18 + t * 185;
        const a = baseAngle + t * 3.1;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (step === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle =
        arm % 3 === 0
          ? 'rgba(103, 232, 249, 0.85)'
          : arm % 3 === 1
            ? 'rgba(253, 224, 71, 0.72)'
            : 'rgba(192, 132, 252, 0.8)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Vòng cổ ngữ phát sáng bên ngoài
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, 212, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 194, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPortalSwirlOverlayTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    for (let arm = 0; arm < 5; arm++) {
      const base = (arm / 5) * Math.PI * 2;
      ctx.beginPath();
      for (let i = 0; i <= 42; i++) {
        const t = i / 42;
        const r = 14 + t * 195;
        const a = base + t * 3.8;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = arm % 2 === 0 ? 'rgba(125, 211, 252, 0.38)' : 'rgba(250, 204, 21, 0.28)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createOuterRuneHaloTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    ctx.strokeStyle = 'rgba(103, 232, 249, 0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 236, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 206, 0, Math.PI * 2);
    ctx.stroke();

    const runes = ['✦', '❖', '◈', '✧', '⟐', '⊹', '⟡', '✺'];
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rx = cx + Math.cos(a) * 221;
      const ry = cy + Math.sin(a) * 221;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = i % 3 === 0 ? '#fde047' : i % 2 === 0 ? '#7dd3fc' : '#e879f9';
      ctx.fillText(runes[i % runes.length], 0, 0);
      ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCaveSignSpriteMaterial(): {
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(6, 18, 38, 0.9)';
  ctx.fillRect(8, 8, 496, 112);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 112);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 31px sans-serif';
  ctx.fillText('Ải 2: Hang Động Chết', 256, 44);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`Cổng Dịch Chuyển · Yêu cầu Cấp ${PORTAL_REQUIRED_LEVEL}`, 256, 88);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  return { material, texture };
}

export class StagePortalCave {
  private readonly scene: THREE.Scene;
  private readonly outside: OutsideGenerator;

  private readonly root = new THREE.Group();
  private readonly caveGroup = new THREE.Group();
  private readonly portalGroup = new THREE.Group();
  private readonly portalDiscMesh: THREE.Mesh;
  private readonly portalDiscMat: THREE.MeshBasicMaterial;
  private readonly portalSwirlMesh: THREE.Mesh;
  private readonly portalSwirlMat: THREE.MeshBasicMaterial;
  private readonly portalHaloMesh: THREE.Mesh;
  private readonly portalHaloMat: THREE.MeshBasicMaterial;
  private readonly portalHitMesh: THREE.Mesh;
  private readonly portalLight: THREE.PointLight;
  private readonly signSprite: THREE.Sprite;

  private readonly lightningRing: THREE.Line;
  private readonly lightningPositions: Float32Array;
  private readonly lightningMat: THREE.LineBasicMaterial;

  private readonly vortexMotes: THREE.Points;
  private readonly vortexMotePositions: Float32Array;
  private readonly vortexMoteAngles: Float32Array;
  private readonly vortexMoteRadii: Float32Array;
  private readonly vortexMotesMat: THREE.PointsMaterial;

  private readonly eruptPoints: THREE.Points;
  private readonly eruptPositions: Float32Array;
  private readonly eruptVelocities: Float32Array;
  private readonly eruptMat: THREE.PointsMaterial;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];

  private phase: StageCavePhase = 'hidden';
  private emergeElapsed = 0;
  private animTime = 0;
  private clearBannerRemaining = 0;
  private readonly baseGroundY: number;
  private currentRootY: number;
  private readonly buriedDepth = 11.2;

  private readonly raycaster = new THREE.Raycaster();
  private disposed = false;

  // Vị trí cục bộ cổng dịch chuyển trong hang
  private readonly portalLocalX = 0;
  private readonly portalLocalY = 3.2;
  private readonly portalLocalZ = -1.1;

  constructor(scene: THREE.Scene, outside: OutsideGenerator, maxAnisotropy = 4) {
    this.scene = scene;
    this.outside = outside;

    // Lấy chiều cao nền băng cao nhất dọc hành lang hang để mặt sàn hang không bị đồi chọc lên
    let maxCorridorY = this.outside.getHeightAt(STAGE_CAVE_X, STAGE_CAVE_Z + 5.2);
    for (let lx = -3.0; lx <= 3.0; lx += 1.5) {
      for (let lz = -3.0; lz <= 5.5; lz += 1.5) {
        const hy = this.outside.getHeightAt(STAGE_CAVE_X + lx, STAGE_CAVE_Z + lz);
        if (hy > maxCorridorY) maxCorridorY = hy;
      }
    }
    this.baseGroundY = maxCorridorY + 0.08;
    this.currentRootY = this.baseGroundY - this.buriedDepth;

    this.root.position.set(STAGE_CAVE_X, this.currentRootY, STAGE_CAVE_Z);
    this.root.visible = false;
    this.scene.add(this.root);

    this.root.add(this.caveGroup);
    this.buildCaveArchitecture(maxAnisotropy);

    // Cụm cổng dịch chuyển xoay xoắn ốc phát sáng ở chính giữa hang
    this.portalGroup.position.set(this.portalLocalX, this.portalLocalY, this.portalLocalZ);
    this.root.add(this.portalGroup);

    const fallbackPortalTex = createFallbackPortalTexture();
    const swirlOverlayTex = createPortalSwirlOverlayTexture();
    const haloTex = createOuterRuneHaloTexture();
    fallbackPortalTex.anisotropy = maxAnisotropy;
    swirlOverlayTex.anisotropy = maxAnisotropy;
    haloTex.anisotropy = maxAnisotropy;
    this.textures.push(fallbackPortalTex, swirlOverlayTex, haloTex);

    // Đĩa cổng dịch chuyển chính (mặt trước và sau)
    const portalGeo = new THREE.CircleGeometry(2.68, 56);
    // Tạo UV riêng cho texture mẫu 16:9 (tròn hoàn hảo ở tâm, cắt bỏ hoàn toàn viền và góc ảnh)
    const defaultUvAttr = portalGeo.getAttribute('uv') as THREE.BufferAttribute;
    const centeredUvs = new Float32Array(defaultUvAttr.count * 2);
    for (let i = 0; i < defaultUvAttr.count; i++) {
      const u = defaultUvAttr.getX(i);
      const v = defaultUvAttr.getY(i);
      centeredUvs[i * 2] = 0.5 + (u - 0.5) * 0.46;
      centeredUvs[i * 2 + 1] = 0.49 + (v - 0.5) * 0.82;
    }

    this.portalDiscMat = new THREE.MeshBasicMaterial({
      map: fallbackPortalTex,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.geometries.push(portalGeo);
    this.materials.push(this.portalDiscMat);
    this.portalDiscMesh = new THREE.Mesh(portalGeo, this.portalDiscMat);
    this.portalDiscMesh.renderOrder = 4;
    this.portalGroup.add(this.portalDiscMesh);

    const loader = new THREE.TextureLoader();
    loader.load(
      '/assets/aistudio/image_aa33cec6.png',
      (loadedTex) => {
        if (this.disposed) {
          loadedTex.dispose();
          return;
        }
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.anisotropy = maxAnisotropy;
        this.textures.push(loadedTex);
        // Áp dụng UV cắt đúng tâm hình tròn từ ảnh mẫu 16:9
        portalGeo.setAttribute('uv', new THREE.BufferAttribute(centeredUvs, 2));
        this.portalDiscMat.map = loadedTex;
        this.portalDiscMat.needsUpdate = true;
      },
      undefined,
      () => {
        // Giữ texture dự phòng nếu không tải được ảnh mẫu
      },
    );

    // Lớp xoáy năng lượng xoay liên tục phía trước đĩa cổng
    const swirlGeo = new THREE.CircleGeometry(2.58, 48);
    this.portalSwirlMat = new THREE.MeshBasicMaterial({
      map: swirlOverlayTex,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.geometries.push(swirlGeo);
    this.materials.push(this.portalSwirlMat);
    this.portalSwirlMesh = new THREE.Mesh(swirlGeo, this.portalSwirlMat);
    this.portalSwirlMesh.position.z = 0.08;
    this.portalSwirlMesh.renderOrder = 5;
    this.portalGroup.add(this.portalSwirlMesh);

    // Vòng cổ ngữ xoay ngược chiều bao quanh cổng
    const haloGeo = new THREE.RingGeometry(2.35, 2.9, 56);
    this.portalHaloMat = new THREE.MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.geometries.push(haloGeo);
    this.materials.push(this.portalHaloMat);
    this.portalHaloMesh = new THREE.Mesh(haloGeo, this.portalHaloMat);
    this.portalHaloMesh.position.z = 0.14;
    this.portalHaloMesh.renderOrder = 5;
    this.portalGroup.add(this.portalHaloMesh);

    // Vòng tia sét xanh lam giật quanh viền cổng dịch chuyển
    const lightningVerts = 48;
    this.lightningPositions = new Float32Array((lightningVerts + 1) * 3);
    const lightningGeo = new THREE.BufferGeometry();
    lightningGeo.setAttribute('position', new THREE.BufferAttribute(this.lightningPositions, 3));
    this.lightningMat = new THREE.LineBasicMaterial({
      color: '#bae6fd',
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.geometries.push(lightningGeo);
    this.materials.push(this.lightningMat);
    this.lightningRing = new THREE.Line(lightningGeo, this.lightningMat);
    this.lightningRing.position.z = 0.18;
    this.portalGroup.add(this.lightningRing);

    // Hạt ánh sáng xoắn vào tâm cổng
    const moteCount = 48;
    this.vortexMotePositions = new Float32Array(moteCount * 3);
    this.vortexMoteAngles = new Float32Array(moteCount);
    this.vortexMoteRadii = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i++) {
      this.vortexMoteAngles[i] = (i / moteCount) * Math.PI * 2;
      this.vortexMoteRadii[i] = 0.4 + ((i * 37) % 100) / 100 * 2.4;
    }
    const motesGeo = new THREE.BufferGeometry();
    motesGeo.setAttribute('position', new THREE.BufferAttribute(this.vortexMotePositions, 3));
    this.vortexMotesMat = new THREE.PointsMaterial({
      color: '#7dd3fc',
      size: 0.14,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.geometries.push(motesGeo);
    this.materials.push(this.vortexMotesMat);
    this.vortexMotes = new THREE.Points(motesGeo, this.vortexMotesMat);
    this.vortexMotes.position.z = 0.22;
    this.vortexMotes.frustumCulled = false;
    this.portalGroup.add(this.vortexMotes);

    // Khối cầu ẩn dùng để raycast khi người chơi nhìn vào cổng
    const hitGeo = new THREE.SphereGeometry(2.7, 10, 10);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.geometries.push(hitGeo);
    this.materials.push(hitMat);
    this.portalHitMesh = new THREE.Mesh(hitGeo, hitMat);
    this.portalGroup.add(this.portalHitMesh);

    this.portalLight = new THREE.PointLight('#38bdf8', 0, 22, 1.4);
    this.portalLight.position.set(0, 0, 1.4);
    this.portalGroup.add(this.portalLight);

    // Bụi tuyết & đá bắn lên quanh chân hang trong 15 giây trồi lên
    const eruptCount = 60;
    this.eruptPositions = new Float32Array(eruptCount * 3);
    this.eruptVelocities = new Float32Array(eruptCount * 3);
    for (let i = 0; i < eruptCount; i++) {
      this.resetEruptParticle(i, true);
    }
    const eruptGeo = new THREE.BufferGeometry();
    eruptGeo.setAttribute('position', new THREE.BufferAttribute(this.eruptPositions, 3));
    this.eruptMat = new THREE.PointsMaterial({
      color: '#bae6fd',
      size: 0.24,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.geometries.push(eruptGeo);
    this.materials.push(this.eruptMat);
    this.eruptPoints = new THREE.Points(eruptGeo, this.eruptMat);
    this.eruptPoints.frustumCulled = false;
    this.scene.add(this.eruptPoints);

    // Biển hiệu nổi trên vòm cửa hang
    const signParts = createCaveSignSpriteMaterial();
    this.textures.push(signParts.texture);
    this.materials.push(signParts.material);
    this.signSprite = new THREE.Sprite(signParts.material);
    this.signSprite.position.set(0, 7.35, 5.1);
    this.signSprite.scale.set(6.2, 1.55, 1);
    this.signSprite.visible = false;
    this.root.add(this.signSprite);
  }

  private resetEruptParticle(idx: number, randomizeY = false): void {
    const angle = Math.random() * Math.PI * 2;
    const rx = 3.2 + Math.random() * 3.8;
    const rz = 3.8 + Math.random() * 4.5;
    this.eruptPositions[idx * 3] = STAGE_CAVE_X + Math.cos(angle) * rx;
    this.eruptPositions[idx * 3 + 1] =
      this.baseGroundY + (randomizeY ? Math.random() * 2.2 : 0.05);
    this.eruptPositions[idx * 3 + 2] = STAGE_CAVE_Z + Math.sin(angle) * rz;

    this.eruptVelocities[idx * 3] = Math.cos(angle) * (0.5 + Math.random() * 1.1);
    this.eruptVelocities[idx * 3 + 1] = 1.8 + Math.random() * 2.6;
    this.eruptVelocities[idx * 3 + 2] = Math.sin(angle) * (0.5 + Math.random() * 1.1);
  }

  private buildCaveArchitecture(maxAnisotropy: number): void {
    const caveRockMat = new THREE.MeshStandardMaterial({
      color: '#334e68',
      roughness: 0.84,
      metalness: 0.08,
      flatShading: true,
    });
    const deepCavernMat = new THREE.MeshStandardMaterial({
      color: '#172a42',
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });
    const iceCrystalMat = new THREE.MeshPhysicalMaterial({
      color: '#7dd3fc',
      emissive: '#0c4a6e',
      emissiveIntensity: 0.25,
      roughness: 0.16,
      metalness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      flatShading: true,
    });
    const icicleMat = new THREE.MeshPhysicalMaterial({
      color: '#bae6fd',
      emissive: '#0284c7',
      emissiveIntensity: 0.22,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
      flatShading: true,
    });
    const frostBankMat = new THREE.MeshStandardMaterial({
      color: '#e2f2fc',
      roughness: 0.78,
      metalness: 0.02,
      flatShading: true,
    });
    const floorIceMat = new THREE.MeshPhysicalMaterial({
      color: '#67b8e8',
      emissive: '#082f49',
      emissiveIntensity: 0.22,
      roughness: 0.18,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });

    // Vảy băng nhẹ cho sàn phản chiếu
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 256;
    floorCanvas.height = 256;
    const fctx = floorCanvas.getContext('2d');
    if (fctx) {
      fctx.fillStyle = '#7ec8f2';
      fctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 45; i++) {
        fctx.strokeStyle = i % 2 === 0 ? 'rgba(224,242,254,0.45)' : 'rgba(14,116,144,0.35)';
        fctx.lineWidth = 1.5;
        fctx.beginPath();
        const x1 = (i * 53) % 256;
        const y1 = (i * 97) % 256;
        fctx.moveTo(x1, y1);
        fctx.lineTo((x1 + 42) % 256, (y1 + 29) % 256);
        fctx.stroke();
      }
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(3, 4);
    floorTex.anisotropy = maxAnisotropy;
    floorIceMat.map = floorTex;
    this.textures.push(floorTex);

    this.materials.push(
      caveRockMat,
      deepCavernMat,
      iceCrystalMat,
      icicleMat,
      frostBankMat,
      floorIceMat,
    );

    const boulderGeo = createParabolicEllipsoidGeometry(1.0, 1.0, 1.0, 10, 8);
    const slabGeo = new THREE.CylinderGeometry(0.68, 1.0, 1.0, 7);
    slabGeo.translate(0, 0.5, 0);
    const icicleGeo = createParabolicLatheGeometry(
      1.0,
      0.16,
      (t) => Math.pow(Math.max(0, 1 - t), 0.72),
      9,
      6,
      true,
    );
    const floorGeo = new THREE.BoxGeometry(8.8, 0.45, 11.4);
    const skirtGeo = new THREE.CylinderGeometry(6.8, 7.8, 4.2, 12);
    const backWallGeo = createParabolicEllipsoidGeometry(5.6, 5.2, 2.8, 12, 10);
    const rampGeo = new THREE.BoxGeometry(7.0, 0.35, 3.2);
    this.geometries.push(boulderGeo, slabGeo, icicleGeo, floorGeo, skirtGeo, backWallGeo, rampGeo);

    // 1. Sàn băng phản chiếu bên trong hang + chân đá ăn sâu xuống lòng đất
    const floorMesh = new THREE.Mesh(floorGeo, floorIceMat);
    floorMesh.position.set(0, -0.14, 0.4);
    floorMesh.receiveShadow = true;
    this.caveGroup.add(floorMesh);

    const rampMesh = new THREE.Mesh(rampGeo, frostBankMat);
    rampMesh.position.set(0, -0.45, 6.8);
    rampMesh.rotation.x = 0.24;
    rampMesh.receiveShadow = true;
    this.caveGroup.add(rampMesh);

    const skirtMesh = new THREE.Mesh(skirtGeo, deepCavernMat);
    skirtMesh.position.set(0, -2.2, 0.2);
    skirtMesh.scale.set(1.18, 1.0, 1.12);
    this.caveGroup.add(skirtMesh);

    // 2. Vách hậu hang động sâu thẳm sau cổng dịch chuyển
    const backDome = new THREE.Mesh(backWallGeo, deepCavernMat);
    backDome.position.set(0, 3.3, -4.6);
    backDome.castShadow = true;
    backDome.receiveShadow = true;
    this.caveGroup.add(backDome);

    // 3. Các vòm đá & tinh thể băng xếp lớp tạo thành cửa hang mái vòm giống ảnh mẫu
    const ribZPositions = [-3.4, -1.7, 0.1, 1.9, 3.6, 5.1];
    ribZPositions.forEach((zPos, rIdx) => {
      const archCount = 9;
      for (let aIdx = 0; aIdx < archCount; aIdx++) {
        const t = aIdx / (archCount - 1);
        const angle = Math.PI * (0.04 + t * 0.92); // 0 -> PI từ chân phải vòng qua đỉnh sang chân trái
        const archRx = 4.25 + (rIdx % 2) * 0.35 + (rIdx === 5 ? 0.45 : 0);
        const archRy = 5.45 + (rIdx === 5 ? 0.3 : 0);
        const cx = Math.cos(angle) * archRx;
        const cy = 0.55 + Math.sin(angle) * archRy;

        const block = new THREE.Mesh(
          boulderGeo,
          (aIdx + rIdx) % 3 === 0 ? iceCrystalMat : (aIdx + rIdx) % 2 === 0 ? caveRockMat : deepCavernMat,
        );
        const sx = 1.65 + ((aIdx * 17 + rIdx * 13) % 5) * 0.22;
        const sy = 1.55 + ((aIdx * 23 + rIdx * 7) % 5) * 0.2;
        const sz = 1.5 + ((aIdx + rIdx) % 3) * 0.28;
        block.position.set(cx, cy, zPos);
        block.scale.set(sx, sy, sz);
        block.rotation.set(
          ((rIdx % 3) - 1) * 0.18,
          ((aIdx % 4) - 1.5) * 0.25,
          angle - Math.PI / 2,
        );
        block.castShadow = true;
        block.receiveShadow = true;
        this.caveGroup.add(block);
      }

      // Gò tuyết & vai băng hai bên chân vòm cửa hang
      for (const side of [-1, 1]) {
        const bank = new THREE.Mesh(boulderGeo, rIdx >= 3 ? frostBankMat : caveRockMat);
        bank.position.set(side * (4.15 + (rIdx % 2) * 0.4), 0.75, zPos + 0.2);
        bank.scale.set(1.85, 1.35, 1.65);
        bank.rotation.set(0.1 * side, rIdx * 0.4, -0.25 * side);
        bank.castShadow = true;
        bank.receiveShadow = true;
        this.caveGroup.add(bank);

        // Mũi tinh thể băng nhô lên hai bên vai cửa hang
        if (rIdx >= 3) {
          const spire = new THREE.Mesh(slabGeo, iceCrystalMat);
          spire.position.set(side * (4.7 + (rIdx - 3) * 0.45), 0.6, zPos + 0.4);
          spire.scale.set(0.85, 2.8 + (rIdx % 2) * 0.9, 0.85);
          spire.rotation.set(0.18, rIdx * 0.6, -side * 0.28);
          spire.castShadow = true;
          spire.receiveShadow = true;
          this.caveGroup.add(spire);
        }
      }
    });

    // 4. Các nhũ băng nhọn rủ xuống từ trần hang và vòm cửa
    const icicleConfigs: Array<[number, number, number, number]> = [
      // [x, y, z, length]
      [-2.8, 4.9, 5.2, 1.55],
      [-2.05, 5.6, 5.3, 1.95],
      [-1.15, 6.05, 5.25, 1.25],
      [-0.35, 6.2, 5.3, 0.95],
      [0.55, 6.18, 5.25, 1.15],
      [1.45, 5.9, 5.3, 1.75],
      [2.3, 5.45, 5.2, 2.05],
      [3.0, 4.75, 5.15, 1.4],

      [-2.6, 4.95, 3.5, 1.6],
      [-1.5, 5.7, 3.6, 1.35],
      [0.1, 6.0, 3.55, 1.05],
      [1.6, 5.65, 3.6, 1.5],
      [2.65, 4.85, 3.45, 1.7],

      [-2.4, 4.8, 1.8, 1.45],
      [-1.2, 5.6, 1.85, 1.2],
      [1.3, 5.55, 1.9, 1.3],
      [2.45, 4.75, 1.8, 1.55],

      [-2.5, 4.7, 0.0, 1.5],
      [2.5, 4.7, 0.0, 1.5],
      [-2.1, 4.9, -1.8, 1.65],
      [2.1, 4.9, -1.8, 1.65],
    ];
    icicleConfigs.forEach(([ix, iy, iz, len], idx) => {
      const icicle = new THREE.Mesh(icicleGeo, icicleMat);
      const radiusScale = 0.72 + (idx % 4) * 0.16;
      icicle.position.set(ix, iy, iz);
      // Lathe nhũ băng hướng lên -> lật ngược mũi nhọn hướng xuống dưới
      icicle.rotation.x = Math.PI;
      icicle.rotation.z = ((idx % 3) - 1) * 0.06;
      icicle.scale.set(radiusScale, len, radiusScale);
      icicle.castShadow = true;
      this.caveGroup.add(icicle);
    });
  }

  startEmergence(): boolean {
    if (this.phase !== 'hidden') {
      return false;
    }
    this.phase = 'emerging';
    this.emergeElapsed = 0;
    this.currentRootY = this.baseGroundY - this.buriedDepth;
    this.root.position.set(STAGE_CAVE_X, this.currentRootY, STAGE_CAVE_Z);
    this.root.visible = true;
    this.portalGroup.scale.setScalar(0.05);
    this.portalLight.intensity = 0;
    this.eruptMat.opacity = 0.78;
    this.signSprite.visible = false;
    return true;
  }

  getStatus(): StageCaveStatus {
    const emergeProgress =
      this.phase === 'hidden'
        ? 0
        : this.phase === 'open'
          ? 1
          : Math.min(1, Math.max(0, this.emergeElapsed / CAVE_EMERGE_DURATION));
    const emergeRemainingSec =
      this.phase === 'emerging' ? Math.max(0, CAVE_EMERGE_DURATION - this.emergeElapsed) : 0;
    return {
      phase: this.phase,
      emergeProgress,
      emergeRemainingSec,
      clearBannerRemainingSec: Math.max(0, this.clearBannerRemaining),
    };
  }

  isInsidePortalTrigger(px: number, py: number, pz: number): boolean {
    if (this.phase !== 'open') return false;
    const dx = px - STAGE_CAVE_X;
    const dz = pz - (STAGE_CAVE_Z + this.portalLocalZ);
    const dy = py - this.baseGroundY;
    return Math.abs(dx) <= 2.35 && Math.abs(dz) <= 1.55 && dy >= -1.0 && dy <= 5.2;
  }

  raycastPortal(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 12.0,
  ): { point: THREE.Vector3 } | null {
    if (this.phase !== 'open') return null;
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObject(this.portalHitMesh, false);
    if (hits.length > 0) {
      return { point: hits[0].point };
    }
    return null;
  }

  getObstacleTopY(
    px: number,
    py: number,
    pz: number,
    playerHalfWidth: number,
    playerHeight = 1.75,
  ): number | null {
    if (this.phase === 'hidden') return null;
    const emergeProgress =
      this.phase === 'open' ? 1 : Math.min(1, this.emergeElapsed / CAVE_EMERGE_DURATION);
    if (emergeProgress < 0.12) return null;

    const lx = px - STAGE_CAVE_X;
    const lz = pz - STAGE_CAVE_Z;
    // Chỉ kiểm tra khi ở gần phạm vi hang
    if (Math.abs(lx) > 6.8 || lz < -6.2 || lz > 7.8) {
      return null;
    }

    let highestTop: number | null = null;
    const floorTop = this.currentRootY + 0.08;
    const roofTop = this.currentRootY + 8.5;
    const minBottomY = this.currentRootY - 3.5;

    // Mặt sàn băng đi lại bên trong hang
    if (
      lx + playerHalfWidth > -4.2 &&
      lx - playerHalfWidth < 4.2 &&
      lz + playerHalfWidth > -4.2 &&
      lz - playerHalfWidth < 6.0 &&
      py < floorTop - 0.02 &&
      py + playerHeight > minBottomY
    ) {
      highestTop = floorTop;
    }

    // Dốc tuyết ngắn phía cửa trước nối mặt đất ngoài với sàn hang
    if (
      lx + playerHalfWidth > -3.5 &&
      lx - playerHalfWidth < 3.5 &&
      lz >= 5.6 &&
      lz <= 8.2
    ) {
      const rampT = Math.max(0, Math.min(1, (8.2 - lz) / 2.6));
      const rampTop = this.baseGroundY - 0.35 + rampT * 0.43;
      if (py < rampTop - 0.02 && py + playerHeight > minBottomY) {
        if (highestTop === null || rampTop > highestTop) {
          highestTop = rampTop;
        }
      }
    }

    // Hai vách đá hai bên và vách hậu phía sau cổng
    const wallBoxes: Array<[number, number, number, number]> = [
      [-6.0, -3.15, -5.2, 5.6], // Vách trái
      [3.15, 6.0, -5.2, 5.6], // Vách phải
      [-5.5, 5.5, -5.8, -2.5], // Vách sau lưng cổng
    ];

    for (const [minX, maxX, minZ, maxZ] of wallBoxes) {
      if (
        lx + playerHalfWidth > minX &&
        lx - playerHalfWidth < maxX &&
        lz + playerHalfWidth > minZ &&
        lz - playerHalfWidth < maxZ &&
        py < roofTop - 0.02 &&
        py + playerHeight > minBottomY
      ) {
        if (highestTop === null || roofTop > highestTop) {
          highestTop = roofTop;
        }
      }
    }

    return highestTop;
  }

  update(
    dt: number,
    callbacks?: {
      onRumblePulse?: () => void;
      onEmergeComplete?: () => void;
    },
  ): void {
    this.animTime += dt;

    if (this.clearBannerRemaining > 0) {
      this.clearBannerRemaining = Math.max(0, this.clearBannerRemaining - dt);
    }

    if (this.phase === 'hidden') return;

    let emergeT = 1;
    if (this.phase === 'emerging') {
      const prevPulse = Math.floor(this.emergeElapsed / 1.25);
      this.emergeElapsed += dt;
      const nextPulse = Math.floor(this.emergeElapsed / 1.25);
      if (nextPulse > prevPulse && this.emergeElapsed < CAVE_EMERGE_DURATION - 0.5) {
        callbacks?.onRumblePulse?.();
      }

      emergeT = Math.min(1, this.emergeElapsed / CAVE_EMERGE_DURATION);
      const easedRise = 1 - Math.pow(1 - emergeT, 1.85);
      const rumbleX = Math.sin(this.animTime * 29) * 0.075 * (1 - emergeT * 0.6);
      const rumbleZ = Math.cos(this.animTime * 23) * 0.065 * (1 - emergeT * 0.6);
      this.currentRootY = this.baseGroundY - this.buriedDepth * (1 - easedRise);
      this.root.position.set(STAGE_CAVE_X + rumbleX, this.currentRootY, STAGE_CAVE_Z + rumbleZ);

      // Bụi đất & băng bắn lên quanh chân hang khi đang trồi lên
      const eruptAttr = this.eruptPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.eruptVelocities.length / 3; i++) {
        this.eruptPositions[i * 3] += this.eruptVelocities[i * 3] * dt;
        this.eruptPositions[i * 3 + 1] += this.eruptVelocities[i * 3 + 1] * dt;
        this.eruptPositions[i * 3 + 2] += this.eruptVelocities[i * 3 + 2] * dt;
        this.eruptVelocities[i * 3 + 1] -= 5.2 * dt;
        if (this.eruptPositions[i * 3 + 1] < this.baseGroundY - 0.2) {
          this.resetEruptParticle(i, false);
        }
      }
      eruptAttr.needsUpdate = true;
      this.eruptMat.opacity = Math.sin(Math.min(1, emergeT) * Math.PI) * 0.85;

      if (this.emergeElapsed >= CAVE_EMERGE_DURATION) {
        this.phase = 'open';
        this.currentRootY = this.baseGroundY;
        this.root.position.set(STAGE_CAVE_X, this.baseGroundY, STAGE_CAVE_Z);
        this.eruptMat.opacity = 0;
        this.eruptPoints.visible = false;
        this.signSprite.visible = true;
        this.clearBannerRemaining = STAGE1_CLEAR_BANNER_DURATION;
        callbacks?.onEmergeComplete?.();
      }
    }

    // Hoạt ảnh cổng dịch chuyển xoay xoắn ốc & tia sét
    const portalReveal =
      this.phase === 'open' ? 1 : Math.max(0, Math.min(1, (emergeT - 0.3) / 0.7));
    const pulse = 1 + Math.sin(this.animTime * 2.8) * 0.035;
    this.portalGroup.scale.setScalar(Math.max(0.05, portalReveal * pulse));

    this.portalSwirlMesh.rotation.z = -this.animTime * 1.45;
    this.portalHaloMesh.rotation.z = this.animTime * 0.72;
    this.portalDiscMat.opacity = 0.94 * portalReveal;
    this.portalSwirlMat.opacity = (0.55 + Math.sin(this.animTime * 4.1) * 0.14) * portalReveal;
    this.portalHaloMat.opacity = 0.88 * portalReveal;
    this.portalLight.intensity = (4.2 + Math.sin(this.animTime * 3.6) * 1.1) * portalReveal;

    // Tia sét chạy quanh vành cổng dịch chuyển
    const lAttr = this.lightningRing.geometry.getAttribute('position') as THREE.BufferAttribute;
    const segs = this.lightningPositions.length / 3 - 1;
    for (let i = 0; i <= segs; i++) {
      const idx = i % segs;
      const angle = (idx / segs) * Math.PI * 2 + this.animTime * 1.9;
      const jitter =
        Math.sin(idx * 5.7 + this.animTime * 28) * 0.14 +
        Math.cos(idx * 3.1 - this.animTime * 19) * 0.09;
      const r = 2.52 + jitter;
      this.lightningPositions[i * 3] = Math.cos(angle) * r;
      this.lightningPositions[i * 3 + 1] = Math.sin(angle) * r;
      this.lightningPositions[i * 3 + 2] = Math.sin(idx * 4.3 + this.animTime * 20) * 0.12;
    }
    lAttr.needsUpdate = true;
    this.lightningMat.opacity = (0.55 + Math.sin(this.animTime * 14) * 0.3) * portalReveal;

    // Hạt năng lượng xoắn vào tâm cổng
    const mAttr = this.vortexMotes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.vortexMoteAngles.length; i++) {
      this.vortexMoteAngles[i] -= dt * (1.4 + (2.8 - this.vortexMoteRadii[i]) * 0.8);
      this.vortexMoteRadii[i] -= dt * 0.75;
      if (this.vortexMoteRadii[i] < 0.25) {
        this.vortexMoteRadii[i] = 2.65;
      }
      const r = this.vortexMoteRadii[i];
      const a = this.vortexMoteAngles[i];
      this.vortexMotePositions[i * 3] = Math.cos(a) * r;
      this.vortexMotePositions[i * 3 + 1] = Math.sin(a) * r;
      this.vortexMotePositions[i * 3 + 2] = (2.7 - r) * 0.08;
    }
    mAttr.needsUpdate = true;
    this.vortexMotesMat.opacity = 0.85 * portalReveal;
  }

  dispose(): void {
    this.disposed = true;
    this.scene.remove(this.root);
    this.scene.remove(this.eruptPoints);
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
