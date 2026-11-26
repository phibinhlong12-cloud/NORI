import * as THREE from 'three';

export const CONVEYOR_MIN_X = -14.0;
export const CONVEYOR_MAX_X = -7.6;
export const CONVEYOR_MIN_Z = -21.35;
export const CONVEYOR_MAX_Z = -19.65;
export const CONVEYOR_TOP_Y = 4.74;

export const COUNTER_MIN_X = -7.6;
export const COUNTER_MAX_X = -5.0;
export const COUNTER_MIN_Z = -21.55;
export const COUNTER_MAX_Z = -19.25;
export const COUNTER_TOP_Y = 5.18;

// Vùng đứng trước băng tải & quầy thu ngân (từ đầu trái băng tải tới mép đường đá cuội)
export const SELL_ZONE_MIN_X = -15.0;
export const SELL_ZONE_MAX_X = -3.0;
export const SELL_ZONE_MIN_Z = -22.8;
export const SELL_ZONE_MAX_Z = -13.6;

export function isPlayerInSellZone(x: number, z: number): boolean {
  return (
    x >= SELL_ZONE_MIN_X &&
    x <= SELL_ZONE_MAX_X &&
    z >= SELL_ZONE_MIN_Z &&
    z <= SELL_ZONE_MAX_Z
  );
}

export const VND_PER_BLOCK = 50;

const BELT_SPEED = 2.8;
const INTAKE_X = -7.55;
const SLAT_COUNT = 10;
const SLAT_START_X = -13.75;
const SLAT_END_X = -7.85;
const SLAT_SPAN = SLAT_END_X - SLAT_START_X;

interface ConveyorItem {
  group: THREE.Group;
  length: number;
  radius: number;
  x: number;
  feedProgress: number;
  phase: 'riding' | 'feeding';
}

/**
 * Module Quầy Thu Ngân & Băng Tải đặt ở góc trái bên trong cổng thành.
 * Nhận các đoạn thân cây, chạy băng tải đưa vào quầy và cộng tiền (50 VNĐ / 1 block chiều dài).
 */
export class CashierStation {
  private readonly scene: THREE.Scene;
  private readonly rootGroup = new THREE.Group();
  private readonly hitMeshes: THREE.Object3D[] = [];
  private readonly slats: THREE.Mesh[] = [];
  private readonly items: ConveyorItem[] = [];

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly scannerLightMat: THREE.MeshBasicMaterial;
  private readonly raycaster = new THREE.Raycaster();
  private readonly beltOrientationQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    Math.PI / 2,
  );

  private slatOffset = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const frameMat = new THREE.MeshLambertMaterial({ color: '#334155' });
    const railMat = new THREE.MeshLambertMaterial({ color: '#475569' });
    const beltMat = new THREE.MeshLambertMaterial({ color: '#1e293b' });
    const slatMat = new THREE.MeshLambertMaterial({ color: '#64748b' });
    const woodMat = new THREE.MeshLambertMaterial({ color: '#7c5836' });
    const counterTopMat = new THREE.MeshLambertMaterial({ color: '#1f2937' });
    const terminalMat = new THREE.MeshLambertMaterial({ color: '#0f172a' });
    const screenMat = new THREE.MeshBasicMaterial({ color: '#34d399' });
    this.scannerLightMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });

    this.materials.push(
      frameMat,
      railMat,
      beltMat,
      slatMat,
      woodMat,
      counterTopMat,
      terminalMat,
      screenMat,
      this.scannerLightMat,
    );

    const addBox = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      isConveyorHit = false,
    ): THREE.Mesh => {
      const geo = new THREE.BoxGeometry(w, h, d);
      this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.rootGroup.add(mesh);
      if (isConveyorHit) {
        mesh.userData.isConveyor = true;
        this.hitMeshes.push(mesh);
      }
      return mesh;
    };

    const beltCenterX = (CONVEYOR_MIN_X + CONVEYOR_MAX_X) * 0.5;
    const beltCenterZ = (CONVEYOR_MIN_Z + CONVEYOR_MAX_Z) * 0.5;
    const beltLen = CONVEYOR_MAX_X - CONVEYOR_MIN_X;
    const beltWidth = CONVEYOR_MAX_Z - CONVEYOR_MIN_Z;

    // 1. Băng tải (chân đỡ, thân băng tải, thành ray 2 bên và các thanh gạt chuyển động)
    const legH = 0.56;
    const legY = 4.0 + legH * 0.5;
    for (const lx of [CONVEYOR_MIN_X + 0.35, -10.8, CONVEYOR_MAX_X - 0.35]) {
      addBox(0.18, legH, 0.18, lx, legY, CONVEYOR_MIN_Z + 0.16, frameMat);
      addBox(0.18, legH, 0.18, lx, legY, CONVEYOR_MAX_Z - 0.16, frameMat);
    }

    // Đế khung băng tải & mặt dây chuyền
    addBox(beltLen, 0.16, beltWidth, beltCenterX, 4.62, beltCenterZ, frameMat, true);
    addBox(beltLen - 0.08, 0.06, beltWidth - 0.22, beltCenterX, 4.71, beltCenterZ, beltMat, true);

    // Thành ray 2 bên băng tải
    addBox(beltLen, 0.14, 0.11, beltCenterX, 4.76, CONVEYOR_MIN_Z + 0.055, railMat, true);
    addBox(beltLen, 0.14, 0.11, beltCenterX, 4.76, CONVEYOR_MAX_Z - 0.055, railMat, true);

    // Các thanh gạt trên mặt băng tải chuyển động liên tục về phía quầy
    const slatGeo = new THREE.BoxGeometry(0.12, 0.03, beltWidth - 0.28);
    this.geometries.push(slatGeo);
    for (let i = 0; i < SLAT_COUNT; i++) {
      const slat = new THREE.Mesh(slatGeo, slatMat);
      const sx = SLAT_START_X + (i / SLAT_COUNT) * SLAT_SPAN;
      slat.position.set(sx, 4.745, beltCenterZ);
      slat.userData.isConveyor = true;
      this.hitMeshes.push(slat);
      this.slats.push(slat);
      this.rootGroup.add(slat);
    }

    // Khung cổng quét đầu vào băng tải (nơi nối vào quầy thu ngân)
    addBox(0.16, 1.35, 0.14, INTAKE_X, 5.4, CONVEYOR_MIN_Z + 0.1, frameMat, true);
    addBox(0.16, 1.35, 0.14, INTAKE_X, 5.4, CONVEYOR_MAX_Z - 0.1, frameMat, true);
    addBox(0.2, 0.16, beltWidth, INTAKE_X, 6.08, beltCenterZ, frameMat, true);
    addBox(0.22, 0.07, beltWidth - 0.36, INTAKE_X, 5.98, beltCenterZ, this.scannerLightMat, true);

    // 2. Quầy thu ngân (chỉ là quầy, chưa có NPC)
    const counterW = COUNTER_MAX_X - COUNTER_MIN_X;
    const counterD = COUNTER_MAX_Z - COUNTER_MIN_Z;
    const counterCenterX = (COUNTER_MIN_X + COUNTER_MAX_X) * 0.5;
    const counterCenterZ = (COUNTER_MIN_Z + COUNTER_MAX_Z) * 0.5;

    // Thân quầy gỗ + mặt bàn đá tối màu
    addBox(counterW, 1.06, counterD, counterCenterX, 4.53, counterCenterZ, woodMat);
    addBox(counterW + 0.08, 0.12, counterD + 0.08, counterCenterX, 5.12, counterCenterZ, counterTopMat);
    // Viền mặt trước quầy hướng ra sân thành (+Z)
    addBox(counterW - 0.18, 0.24, 0.06, counterCenterX, 4.86, COUNTER_MAX_Z + 0.02, railMat);

    // Máy tính tiền tối giản đặt trên mặt quầy
    const posX = counterCenterX + 0.25;
    const posZ = counterCenterZ + 0.35;
    addBox(0.56, 0.14, 0.44, posX, 5.25, posZ, terminalMat);
    addBox(0.46, 0.34, 0.08, posX, 5.47, posZ - 0.12, terminalMat);
    addBox(0.38, 0.24, 0.03, posX, 5.48, posZ - 0.07, screenMat);

    // 3. Bảng thông báo gắn tường phía trên băng tải: "Chặt gỗ để vào đây"
    const signX = beltCenterX - 0.1;
    const signY = 6.62;
    const signZ = -21.95;
    const signFrameMat = new THREE.MeshStandardMaterial({
      color: '#3b2416',
      roughness: 0.78,
      metalness: 0.06,
    });
    const signTrimMat = new THREE.MeshStandardMaterial({
      color: '#b45309',
      roughness: 0.42,
      metalness: 0.55,
    });
    const signTex = this.createNoticeSignTexture();
    const signFaceMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: '#ffffff',
      emissiveIntensity: 0.24,
      roughness: 0.42,
      metalness: 0.08,
    });
    this.materials.push(signFrameMat, signTrimMat, signFaceMat);

    // Thanh đỡ gắn chặt bảng vào mặt tường đá phía sau (-Z)
    addBox(0.18, 0.2, 0.92, signX - 2.1, signY, signZ - 0.46, frameMat);
    addBox(0.18, 0.2, 0.92, signX + 2.1, signY, signZ - 0.46, frameMat);

    // Khung gỗ & viền trên dưới của bảng
    addBox(5.9, 1.12, 0.16, signX, signY, signZ, signFrameMat);
    addBox(6.04, 0.09, 0.2, signX, signY + 0.58, signZ, signTrimMat);
    addBox(6.04, 0.09, 0.2, signX, signY - 0.58, signZ, signTrimMat);

    const signGeo = new THREE.PlaneGeometry(5.68, 0.94);
    this.geometries.push(signGeo);
    const signMesh = new THREE.Mesh(signGeo, signFaceMat);
    signMesh.position.set(signX, signY, signZ + 0.09);
    signMesh.matrixAutoUpdate = false;
    signMesh.updateMatrix();
    this.rootGroup.add(signMesh);

    this.scene.add(this.rootGroup);
  }

  private createNoticeSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Hai mũi tên chỉ xuống băng tải
    const drawDownArrow = (cx: number, cy: number) => {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy - 12);
      ctx.lineTo(cx + 18, cy - 12);
      ctx.lineTo(cx, cy + 16);
      ctx.closePath();
      ctx.fill();
    };
    drawDownArrow(84, canvas.height / 2 + 2);
    drawDownArrow(canvas.width - 84, canvas.height / 2 + 2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillText('Chặt gỗ để vào đây', canvas.width / 2, canvas.height / 2 + 6);
    ctx.fillStyle = '#fef3c7';
    ctx.fillText('Chặt gỗ để vào đây', canvas.width / 2, canvas.height / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.textures.push(tex);
    return tex;
  }

  static computeWoodValue(lengthInBlocks: number): number {
    return Math.max(10, Math.round(lengthInBlocks * VND_PER_BLOCK));
  }

  getConveyorDropBounds(): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  } {
    return {
      minX: CONVEYOR_MIN_X - 0.15,
      maxX: CONVEYOR_MAX_X + 0.15,
      minY: 4.4,
      maxY: 5.5,
      minZ: CONVEYOR_MIN_Z - 0.25,
      maxZ: CONVEYOR_MAX_Z + 0.25,
    };
  }

  raycastConveyor(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance = 7.0,
  ): { point: THREE.Vector3 } | null {
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0.1;
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    if (hits.length === 0) return null;
    return { point: hits[0].point };
  }

  acceptLog(group: THREE.Group, length: number, radius: number): void {
    group.scale.set(1, 1, 1);
    group.quaternion.copy(this.beltOrientationQuat);

    // Đặt đầu gốc khúc gỗ trên băng tải (đuôi hướng -X, tịnh tiến dần theo +X vào quầy)
    const startX = Math.max(
      CONVEYOR_MIN_X + 0.8,
      Math.min(INTAKE_X - 1.2, CONVEYOR_MIN_X + length),
    );
    const centerZ = (CONVEYOR_MIN_Z + CONVEYOR_MAX_Z) * 0.5;
    const beltY = CONVEYOR_TOP_Y + radius;

    group.position.set(startX, beltY, centerZ);
    this.scene.add(group);

    this.items.push({
      group,
      length,
      radius,
      x: startX,
      feedProgress: 0,
      phase: 'riding',
    });
  }

  update(dt: number, onEarnMoney: (earned: number, lengthBlocks: number) => void): void {
    // 1. Chuyển động thanh gạt băng tải về hướng +X
    this.slatOffset = (this.slatOffset + BELT_SPEED * dt) % SLAT_SPAN;
    for (let i = 0; i < SLAT_COUNT; i++) {
      const rawX = SLAT_START_X + ((i / SLAT_COUNT) * SLAT_SPAN + this.slatOffset) % SLAT_SPAN;
      this.slats[i].position.x = rawX;
    }

    // Đổi màu đèn quét khi đang xử lý gỗ
    this.scannerLightMat.color.setHex(this.items.length > 0 ? 0x34d399 : 0xf59e0b);

    // 2. Di chuyển các khúc gỗ trên băng tải vào quầy thu ngân để tính tiền
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.phase === 'riding') {
        item.x += BELT_SPEED * dt;
        item.group.position.x = item.x;
        if (item.x >= INTAKE_X) {
          item.x = INTAKE_X;
          item.group.position.x = INTAKE_X;
          item.phase = 'feeding';
        }
      } else {
        const feedRate = BELT_SPEED / Math.max(0.8, item.length);
        item.feedProgress = Math.min(1, item.feedProgress + feedRate * dt);
        const remainScale = Math.max(0.01, 1 - item.feedProgress);
        const crossScale = item.feedProgress > 0.9 ? Math.max(0.01, (1 - item.feedProgress) * 10) : 1;
        item.group.scale.set(crossScale, remainScale, crossScale);

        if (item.feedProgress >= 1) {
          this.scene.remove(item.group);
          this.items.splice(i, 1);
          const earned = CashierStation.computeWoodValue(item.length);
          onEarnMoney(earned, item.length);
        }
      }
    }
  }

  getObstacleTopY(
    px: number,
    py: number,
    pz: number,
    playerHalfWidth: number,
    playerHeight = 1.75,
  ): number | null {
    let highestTop: number | null = null;

    const boxes: Array<[number, number, number, number, number, number]> = [
      [CONVEYOR_MIN_X, CONVEYOR_MAX_X, 4.0, CONVEYOR_TOP_Y, CONVEYOR_MIN_Z, CONVEYOR_MAX_Z],
      [COUNTER_MIN_X, COUNTER_MAX_X, 4.0, COUNTER_TOP_Y, COUNTER_MIN_Z, COUNTER_MAX_Z],
    ];

    for (const [minX, maxX, minY, maxY, minZ, maxZ] of boxes) {
      if (
        px + playerHalfWidth > minX &&
        px - playerHalfWidth < maxX &&
        pz + playerHalfWidth > minZ &&
        pz - playerHalfWidth < maxZ &&
        py < maxY - 0.02 &&
        py + playerHeight > minY
      ) {
        if (highestTop === null || maxY > highestTop) {
          highestTop = maxY;
        }
      }
    }

    return highestTop;
  }

  dispose(): void {
    for (const item of this.items) {
      this.scene.remove(item.group);
    }
    this.items.length = 0;
    this.scene.remove(this.rootGroup);

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
