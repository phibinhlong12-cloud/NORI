import * as THREE from 'three';

export interface PotionAssetHandles {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

export function createPotionMeshGroup(handles: PotionAssetHandles): THREE.Group {
  const group = new THREE.Group();

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#e0f2fe',
    transparent: true,
    opacity: 0.42,
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    depthWrite: false,
  });
  const liquidMat = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 0.55,
    roughness: 0.2,
    metalness: 0.05,
  });
  const liquidGlowMat = new THREE.MeshStandardMaterial({
    color: '#fda4af',
    emissive: '#fb7185',
    emissiveIntensity: 1.15,
    roughness: 0.15,
  });
  const collarMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    roughness: 0.24,
    metalness: 0.86,
  });
  const corkMat = new THREE.MeshStandardMaterial({
    color: '#92400e',
    roughness: 0.88,
    metalness: 0.02,
  });
  handles.materials.push(glassMat, liquidMat, liquidGlowMat, collarMat, corkMat);

  // Thân bình thủy tinh bầu tròn 8 cạnh
  const bodyGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.2, 8);
  const baseGeo = new THREE.CylinderGeometry(0.12, 0.085, 0.05, 8);
  const shoulderGeo = new THREE.CylinderGeometry(0.052, 0.11, 0.07, 8);
  const neckGeo = new THREE.CylinderGeometry(0.048, 0.052, 0.085, 8);
  const rimGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.025, 8);
  const corkGeo = new THREE.CylinderGeometry(0.042, 0.038, 0.055, 8);

  // Phần dung dịch máu đỏ phát sáng bên trong
  const liquidGeo = new THREE.CylinderGeometry(0.092, 0.1, 0.155, 8);
  const coreGeo = new THREE.OctahedronGeometry(0.048, 0);

  handles.geometries.push(
    bodyGeo,
    baseGeo,
    shoulderGeo,
    neckGeo,
    rimGeo,
    corkGeo,
    liquidGeo,
    coreGeo,
  );

  const base = new THREE.Mesh(baseGeo, glassMat);
  base.position.set(0, 0.025, 0);
  const body = new THREE.Mesh(bodyGeo, glassMat);
  body.position.set(0, 0.15, 0);
  const shoulder = new THREE.Mesh(shoulderGeo, glassMat);
  shoulder.position.set(0, 0.285, 0);
  const neck = new THREE.Mesh(neckGeo, glassMat);
  neck.position.set(0, 0.36, 0);

  const rim = new THREE.Mesh(rimGeo, collarMat);
  rim.position.set(0, 0.405, 0);
  const cork = new THREE.Mesh(corkGeo, corkMat);
  cork.position.set(0, 0.435, 0);

  const liquid = new THREE.Mesh(liquidGeo, liquidMat);
  liquid.position.set(0, 0.145, 0);
  const core = new THREE.Mesh(coreGeo, liquidGlowMat);
  core.position.set(0, 0.155, 0);

  group.add(base, body, shoulder, neck, rim, cork, liquid, core);
  return group;
}

export class PotionViewModel {
  private readonly scene: THREE.Scene;
  private readonly group: THREE.Group;
  private readonly assets: PotionAssetHandles = { geometries: [], materials: [] };

  private readonly idleOffset = new THREE.Vector3(0.38, -0.32, -0.58);
  private readonly animOffset = new THREE.Vector3();
  private readonly tempLocalPos = new THREE.Vector3();
  private readonly tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly tempLocalQuat = new THREE.Quaternion();

  private isDrinking = false;
  private drinkElapsed = 0;
  private readonly drinkDuration = 0.34;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = createPotionMeshGroup(this.assets);
    this.group.scale.set(0.95, 0.95, 0.95);
    this.group.visible = false;
    this.scene.add(this.group);
  }

  triggerDrink(): void {
    this.isDrinking = true;
    this.drinkElapsed = 0;
  }

  update(
    camera: THREE.Camera,
    dt: number,
    visible: boolean,
    motion?: { lagY: number; strideX: number; strideY: number },
  ): void {
    this.group.visible = visible;
    if (!visible) {
      this.isDrinking = false;
      return;
    }

    const lagY = motion?.lagY ?? 0;
    const strideX = motion?.strideX ?? 0;
    const strideY = motion?.strideY ?? 0;

    let pitch = 0.08 + lagY * 0.9;
    let yaw = -0.22;
    let roll = 0.12 - strideX * 1.4;
    this.animOffset.set(strideX, lagY + strideY, 0);

    if (this.isDrinking) {
      this.drinkElapsed += dt;
      const t = Math.min(1, this.drinkElapsed / this.drinkDuration);
      const wave = Math.sin(t * Math.PI);
      pitch += wave * 0.92;
      roll += wave * 0.35;
      this.animOffset.x -= wave * 0.16;
      this.animOffset.y += wave * 0.14;
      this.animOffset.z += wave * 0.12;
      if (t >= 1) {
        this.isDrinking = false;
      }
    }

    this.tempLocalPos
      .copy(this.idleOffset)
      .add(this.animOffset)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);
    this.group.position.copy(this.tempLocalPos);

    this.tempEuler.set(pitch, yaw, roll, 'YXZ');
    this.tempLocalQuat.setFromEuler(this.tempEuler);
    this.group.quaternion.copy(camera.quaternion).multiply(this.tempLocalQuat);
  }

  dispose(): void {
    this.scene.remove(this.group);
    for (const geo of this.assets.geometries) {
      geo.dispose();
    }
    for (const mat of this.assets.materials) {
      mat.dispose();
    }
    this.assets.geometries.length = 0;
    this.assets.materials.length = 0;
  }
}
