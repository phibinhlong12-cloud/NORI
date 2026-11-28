import * as THREE from 'three';
import recallCircleVfxUrl from '../assets/recall-circle-vfx.png';

function createFallbackMagicCircleTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    const glow = ctx.createRadialGradient(cx, cy, 18, cx, cy, 240);
    glow.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
    glow.addColorStop(0.35, 'rgba(56, 189, 248, 0.35)');
    glow.addColorStop(0.72, 'rgba(168, 85, 247, 0.25)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 212, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 186, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 134, 0, Math.PI * 2);
    ctx.stroke();

    // Hai hình vuông đan chéo tạo sao 8 cánh
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.9)';
    ctx.lineWidth = 2.5;
    for (let s = 0; s < 2; s++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((s * Math.PI) / 4);
      ctx.strokeRect(-95, -95, 190, 190);
      ctx.restore();
    }

    // 8 vòng ấn nhỏ quanh viền
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const sx = cx + Math.cos(a) * 199;
      const sy = cy + Math.sin(a) * 199;
      ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createOuterRuneRingTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    ctx.strokeStyle = 'rgba(103, 232, 249, 0.92)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 232, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 206, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      const r1 = 210;
      const r2 = i % 3 === 0 ? 229 : 222;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(253, 224, 71, 0.95)' : 'rgba(56, 189, 248, 0.95)';
      ctx.lineWidth = i % 3 === 0 ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createAuraVeilTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.72)');
    grad.addColorStop(0.35, 'rgba(192, 132, 252, 0.34)');
    grad.addColorStop(0.75, 'rgba(253, 224, 71, 0.14)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Các dải sáng dọc xoay quanh chân
    for (let i = 0; i < 12; i++) {
      const x = (i / 12) * w;
      const stripGrad = ctx.createLinearGradient(0, h, 0, 0);
      stripGrad.addColorStop(0, i % 2 === 0 ? 'rgba(253, 224, 71, 0.55)' : 'rgba(103, 232, 249, 0.55)');
      stripGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = stripGrad;
      ctx.fillRect(x, 0, 4, h);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export class RecallVfx {
  private readonly root = new THREE.Group();
  private readonly sigilMesh: THREE.Mesh;
  private readonly sigilMat: THREE.MeshBasicMaterial;
  private readonly outerRingMesh: THREE.Mesh;
  private readonly outerRingMat: THREE.MeshBasicMaterial;
  private readonly veilMesh: THREE.Mesh;
  private readonly veilMat: THREE.MeshBasicMaterial;
  private readonly motesPoints: THREE.Points;
  private readonly motesMat: THREE.PointsMaterial;
  private readonly motesPositions: Float32Array;
  private readonly moteAngles: Float32Array;
  private readonly moteRadii: Float32Array;
  private readonly moteHeights: Float32Array;
  private readonly light: THREE.PointLight;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];

  private burstTimer = 0;
  private readonly burstDuration = 0.85;
  private spinPhase = 0;
  private disposed = false;

  constructor(private readonly scene: THREE.Scene) {
    this.root.visible = false;
    this.scene.add(this.root);

    const fallbackTex = createFallbackMagicCircleTexture();
    const outerTex = createOuterRuneRingTexture();
    const veilTex = createAuraVeilTexture();
    this.textures.push(fallbackTex, outerTex, veilTex);

    // Đĩa phép thuật chính xoay dưới chân (cắt hình tròn nên loại bỏ hoàn toàn góc ảnh)
    const sigilGeo = new THREE.CircleGeometry(1.65, 48);
    sigilGeo.rotateX(-Math.PI / 2);
    // Thu gọn UV vào vùng giữa 0.44 quanh tâm để cắt sát vòng phép trong ảnh mẫu
    const uvAttr = sigilGeo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uvAttr.count; i++) {
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      uvAttr.setXY(i, 0.5 + (u - 0.5) * 0.88, 0.5 + (v - 0.5) * 0.88);
    }
    uvAttr.needsUpdate = true;

    this.sigilMat = new THREE.MeshBasicMaterial({
      map: fallbackTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.geometries.push(sigilGeo);
    this.materials.push(this.sigilMat);
    this.sigilMesh = new THREE.Mesh(sigilGeo, this.sigilMat);
    this.sigilMesh.position.y = 0.05;
    this.sigilMesh.renderOrder = 3;
    this.root.add(this.sigilMesh);

    // Nạp ảnh vòng tròn phép thuật mẫu nếu tải được
    const loader = new THREE.TextureLoader();
    loader.load(
      recallCircleVfxUrl,
      (loadedTex) => {
        if (this.disposed) {
          loadedTex.dispose();
          return;
        }
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        this.textures.push(loadedTex);
        this.sigilMat.map = loadedTex;
        this.sigilMat.needsUpdate = true;
      },
      undefined,
      () => {
        // Giữ texture dự phòng nếu không tải được ảnh
      },
    );

    // Vòng ngoài xoay ngược chiều tạo chiều sâu ma pháp
    const outerGeo = new THREE.CircleGeometry(1.92, 48);
    outerGeo.rotateX(-Math.PI / 2);
    this.outerRingMat = new THREE.MeshBasicMaterial({
      map: outerTex,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.geometries.push(outerGeo);
    this.materials.push(this.outerRingMat);
    this.outerRingMesh = new THREE.Mesh(outerGeo, this.outerRingMat);
    this.outerRingMesh.position.y = 0.07;
    this.outerRingMesh.renderOrder = 3;
    this.root.add(this.outerRingMesh);

    // Màn sáng trụ xoay bao quanh người chơi (nhìn rõ ngay cả khi nhìn thẳng góc thứ nhất)
    const veilGeo = new THREE.CylinderGeometry(1.36, 1.56, 1.55, 36, 1, true);
    this.veilMat = new THREE.MeshBasicMaterial({
      map: veilTex,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.geometries.push(veilGeo);
    this.materials.push(this.veilMat);
    this.veilMesh = new THREE.Mesh(veilGeo, this.veilMat);
    this.veilMesh.position.y = 0.8;
    this.veilMesh.renderOrder = 3;
    this.root.add(this.veilMesh);

    // Hạt ánh sáng xoắn ốc bay lên quanh vòng phép
    const moteCount = 36;
    this.motesPositions = new Float32Array(moteCount * 3);
    this.moteAngles = new Float32Array(moteCount);
    this.moteRadii = new Float32Array(moteCount);
    this.moteHeights = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i++) {
      this.moteAngles[i] = (i / moteCount) * Math.PI * 2;
      this.moteRadii[i] = 1.15 + (i % 5) * 0.1;
      this.moteHeights[i] = (i / moteCount) * 1.9;
    }
    const motesGeo = new THREE.BufferGeometry();
    motesGeo.setAttribute('position', new THREE.BufferAttribute(this.motesPositions, 3));
    this.motesMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.12,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.geometries.push(motesGeo);
    this.materials.push(this.motesMat);
    this.motesPoints = new THREE.Points(motesGeo, this.motesMat);
    this.motesPoints.frustumCulled = false;
    this.root.add(this.motesPoints);

    this.light = new THREE.PointLight(0x38bdf8, 0, 7.5, 1.8);
    this.light.position.y = 0.7;
    this.root.add(this.light);
  }

  triggerBurst(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z);
    this.burstTimer = this.burstDuration;
    this.root.visible = true;
  }

  update(
    dt: number,
    playerX: number,
    groundY: number,
    playerZ: number,
    channelActive: boolean,
    progress: number,
  ): void {
    if (channelActive) {
      this.burstTimer = 0;
      this.root.visible = true;
      this.root.position.set(playerX, groundY, playerZ);

      const spinSpeed = 1.6 + progress * 3.4;
      this.spinPhase += dt * spinSpeed;

      this.sigilMesh.rotation.y = this.spinPhase;
      this.outerRingMesh.rotation.y = -this.spinPhase * 0.72;
      this.veilMesh.rotation.y = this.spinPhase * 0.55;

      const scalePulse = 0.88 + progress * 0.18 + Math.sin(this.spinPhase * 2.2) * 0.03;
      this.sigilMesh.scale.setScalar(scalePulse);
      this.outerRingMesh.scale.setScalar(0.92 + progress * 0.16);
      this.veilMesh.scale.set(1, 0.75 + progress * 0.45, 1);

      this.sigilMat.opacity = 0.72 + progress * 0.28;
      this.outerRingMat.opacity = 0.55 + progress * 0.42;
      this.veilMat.opacity = 0.25 + progress * 0.35;
      this.motesMat.opacity = 0.65 + progress * 0.35;
      this.light.intensity = 1.2 + progress * 2.8;

      const posAttr = this.motesPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.moteAngles.length; i++) {
        this.moteAngles[i] += dt * (1.8 + progress * 2.5);
        this.moteHeights[i] += dt * (0.95 + progress * 1.1);
        if (this.moteHeights[i] > 1.95) {
          this.moteHeights[i] -= 1.9;
        }
        const r = this.moteRadii[i] * (1 - this.moteHeights[i] * 0.12);
        this.motesPositions[i * 3] = Math.cos(this.moteAngles[i]) * r;
        this.motesPositions[i * 3 + 1] = this.moteHeights[i];
        this.motesPositions[i * 3 + 2] = Math.sin(this.moteAngles[i]) * r;
      }
      posAttr.needsUpdate = true;
      return;
    }

    if (this.burstTimer > 0) {
      this.burstTimer = Math.max(0, this.burstTimer - dt);
      const t = 1 - this.burstTimer / this.burstDuration;
      const fade = Math.pow(1 - t, 1.5);
      this.spinPhase += dt * 4.2;

      this.root.position.set(playerX, groundY, playerZ);
      this.sigilMesh.rotation.y = this.spinPhase;
      this.outerRingMesh.rotation.y = -this.spinPhase * 0.8;
      this.veilMesh.rotation.y = this.spinPhase * 0.65;

      const expand = 1.0 + t * 0.65;
      this.sigilMesh.scale.setScalar(expand);
      this.outerRingMesh.scale.setScalar(expand * 1.05);
      this.veilMesh.scale.set(expand, 1.25 + t * 0.5, expand);

      this.sigilMat.opacity = 0.9 * fade;
      this.outerRingMat.opacity = 0.85 * fade;
      this.veilMat.opacity = 0.48 * fade;
      this.motesMat.opacity = 0.9 * fade;
      this.light.intensity = 3.6 * fade;

      const posAttr = this.motesPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.moteAngles.length; i++) {
        this.moteAngles[i] += dt * 3.2;
        this.moteHeights[i] = Math.min(2.2, this.moteHeights[i] + dt * 2.1);
        const r = this.moteRadii[i] * (1 + t * 0.35);
        this.motesPositions[i * 3] = Math.cos(this.moteAngles[i]) * r;
        this.motesPositions[i * 3 + 1] = this.moteHeights[i];
        this.motesPositions[i * 3 + 2] = Math.sin(this.moteAngles[i]) * r;
      }
      posAttr.needsUpdate = true;

      if (this.burstTimer <= 0) {
        this.root.visible = false;
      }
      return;
    }

    if (this.root.visible) {
      this.root.visible = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.scene.remove(this.root);
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
