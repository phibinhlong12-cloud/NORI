import * as THREE from 'three';

export interface ShieldAssetHandles {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  textures: THREE.Texture[];
}

function createShieldTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#4f3a27');
  grad.addColorStop(0.55, '#3b2b1d');
  grad.addColorStop(1, '#261b12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Vệt xước và độ sần kim loại tối màu giống mẫu khiên đồng/sắt cũ
  for (let i = 0; i < 650; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
    const px = Math.abs(x) * 256;
    const py = Math.abs(y) * 256;
    const shade = i % 3 === 0 ? 'rgba(130, 96, 58, 0.14)' : 'rgba(20, 14, 9, 0.18)';
    ctx.fillStyle = shade;
    ctx.fillRect(px, py, 3 + (i % 6), 2 + (i % 4));
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildHeaterShieldShape(scale: number): THREE.Shape {
  const s = new THREE.Shape();
  const w = 0.36 * scale;
  const topY = 0.43 * scale;
  const midDipY = 0.39 * scale;
  const botY = -0.44 * scale;

  s.moveTo(-w, topY);
  s.quadraticCurveTo(0, midDipY, w, topY);
  s.bezierCurveTo(w * 1.02, 0.04 * scale, w * 0.78, -0.22 * scale, 0, botY);
  s.bezierCurveTo(-w * 0.78, -0.22 * scale, -w * 1.02, 0.04 * scale, -w, topY);
  return s;
}

export function createShieldMeshGroup(handles: ShieldAssetHandles): THREE.Group {
  const group = new THREE.Group();

  const faceTex = createShieldTexture();
  handles.textures.push(faceTex);

  const bodyMat = new THREE.MeshLambertMaterial({ map: faceTex });
  const rimMat = new THREE.MeshLambertMaterial({ color: '#785530' });
  const rivetMat = new THREE.MeshLambertMaterial({ color: '#a8814c' });
  const handleMat = new THREE.MeshLambertMaterial({ color: '#2b1e14' });
  handles.materials.push(bodyMat, rimMat, rivetMat, handleMat);

  // 1. Thân khiên chính (dáng khiên vát nhọn đáy, hơi võng nhẹ cạnh trên)
  const bodyShape = buildHeaterShieldShape(1.0);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.036,
    bevelEnabled: false,
    curveSegments: 14,
  });
  bodyGeo.translate(0, 0, -0.018);
  handles.geometries.push(bodyGeo);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(bodyMesh);

  // 2. Viền khung nổi mặt trước quanh mép khiên
  const outerRim = buildHeaterShieldShape(1.03);
  const innerCut = buildHeaterShieldShape(0.86);
  outerRim.holes.push(innerCut);
  const rimGeo = new THREE.ExtrudeGeometry(outerRim, {
    depth: 0.022,
    bevelEnabled: false,
    curveSegments: 14,
  });
  rimGeo.translate(0, 0, 0.014);
  handles.geometries.push(rimGeo);
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  group.add(rimMesh);

  // Thanh viền ngang phía trên của khiên (nổi nhẹ như mẫu)
  const topBarShape = new THREE.Shape();
  topBarShape.moveTo(-0.37, 0.44);
  topBarShape.quadraticCurveTo(0, 0.4, 0.37, 0.44);
  topBarShape.lineTo(0.365, 0.37);
  topBarShape.quadraticCurveTo(0, 0.335, -0.365, 0.37);
  topBarShape.closePath();
  const topBarGeo = new THREE.ExtrudeGeometry(topBarShape, {
    depth: 0.024,
    bevelEnabled: false,
    curveSegments: 10,
  });
  topBarGeo.translate(0, 0, 0.014);
  handles.geometries.push(topBarGeo);
  const topBarMesh = new THREE.Mesh(topBarGeo, rimMat);
  group.add(topBarMesh);

  // 3. Đinh tán dọc theo viền trên và hai bên mép khiên
  const rivetGeo = new THREE.SphereGeometry(0.014, 7, 6);
  handles.geometries.push(rivetGeo);

  const rivetCoords: Array<[number, number]> = [
    [-0.31, 0.405],
    [-0.19, 0.39],
    [-0.06, 0.38],
    [0.06, 0.38],
    [0.19, 0.39],
    [0.31, 0.405],
    [-0.34, 0.25],
    [0.34, 0.25],
    [-0.325, 0.1],
    [0.325, 0.1],
    [-0.285, -0.05],
    [0.285, -0.05],
    [-0.215, -0.19],
    [0.215, -0.19],
    [-0.12, -0.31],
    [0.12, -0.31],
    [0, -0.405],
  ];

  for (const [rx, ry] of rivetCoords) {
    const rivet = new THREE.Mesh(rivetGeo, rivetMat);
    rivet.position.set(rx, ry, 0.038);
    group.add(rivet);
  }

  // 4. Quai cầm mặt sau khiên
  const gripGeo = new THREE.BoxGeometry(0.18, 0.045, 0.06);
  handles.geometries.push(gripGeo);
  const grip = new THREE.Mesh(gripGeo, handleMat);
  grip.position.set(0, 0.04, -0.045);
  group.add(grip);

  return group;
}

export class ShieldViewModel {
  private readonly scene: THREE.Scene;
  private readonly group: THREE.Group;
  private readonly assets: ShieldAssetHandles = {
    geometries: [],
    materials: [],
    textures: [],
  };

  private readonly frontOffset = new THREE.Vector3(-0.34, -0.16, -0.64);
  private readonly backOffset = new THREE.Vector3(-0.18, -0.18, 0.42);
  private readonly currentOffset = new THREE.Vector3(-0.18, -0.18, 0.42);
  private readonly tempLocalPos = new THREE.Vector3();

  private readonly frontQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0.06, 0.22, -0.06, 'YXZ'),
  );
  private readonly backQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0.05, Math.PI, 0.25, 'YXZ'),
  );
  private readonly currentLocalQuat = new THREE.Quaternion().copy(this.backQuat);

  private deployProgress = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = createShieldMeshGroup(this.assets);
    this.group.scale.set(0.76, 0.76, 0.76);
    this.group.visible = false;
    this.scene.add(this.group);
  }

  update(camera: THREE.Camera, dt: number, owned: boolean, raised: boolean): void {
    if (!owned) {
      this.group.visible = false;
      this.deployProgress = 0;
      return;
    }

    const target = raised ? 1 : 0;
    const speed = 10 * dt;
    if (this.deployProgress < target) {
      this.deployProgress = Math.min(1, this.deployProgress + speed);
    } else if (this.deployProgress > target) {
      this.deployProgress = Math.max(0, this.deployProgress - speed);
    }

    // Khi đã cất hoàn toàn sau lưng thì ẩn khỏi camera để không vướng tầm nhìn
    if (this.deployProgress <= 0.01 && !raised) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    const t = this.deployProgress * this.deployProgress * (3 - 2 * this.deployProgress);
    this.currentOffset.lerpVectors(this.backOffset, this.frontOffset, t);
    this.currentLocalQuat.slerpQuaternions(this.backQuat, this.frontQuat, t);

    this.tempLocalPos
      .copy(this.currentOffset)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);
    this.group.position.copy(this.tempLocalPos);
    this.group.quaternion.copy(camera.quaternion).multiply(this.currentLocalQuat);
  }

  dispose(): void {
    this.scene.remove(this.group);
    for (const geo of this.assets.geometries) {
      geo.dispose();
    }
    for (const mat of this.assets.materials) {
      mat.dispose();
    }
    for (const tex of this.assets.textures) {
      tex.dispose();
    }
    this.assets.geometries.length = 0;
    this.assets.materials.length = 0;
    this.assets.textures.length = 0;
  }
}
