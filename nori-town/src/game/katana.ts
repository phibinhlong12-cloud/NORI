import * as THREE from 'three';

export interface KatanaAssetHandles {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

export function createKatanaMeshGroup(
  handles: KatanaAssetHandles,
  isIce = false,
): THREE.Group {
  const group = new THREE.Group();

  const hiltMat = new THREE.MeshLambertMaterial({
    color: isIce ? '#0c4a6e' : '#1e293b',
  });
  const wrapMat = new THREE.MeshLambertMaterial({
    color: isIce ? '#0284c7' : '#7f1d1d',
  });
  const goldMat = new THREE.MeshLambertMaterial({
    color: isIce ? '#7dd3fc' : '#f59e0b',
  });
  const bladeMat = isIce
    ? new THREE.MeshBasicMaterial({ color: '#bae6fd' })
    : new THREE.MeshLambertMaterial({ color: '#e2e8f0' });
  const spineMat = new THREE.MeshLambertMaterial({
    color: isIce ? '#0ea5e9' : '#94a3b8',
  });
  handles.materials.push(hiltMat, wrapMat, goldMat, bladeMat, spineMat);

  // Tay cầm (Tsuka)
  const hiltGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.24, 8);
  hiltGeo.translate(0, 0.12, 0);
  handles.geometries.push(hiltGeo);
  const hilt = new THREE.Mesh(hiltGeo, hiltMat);
  group.add(hilt);

  // Đai trang trí ở chuôi kiếm
  const pommelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.025, 8);
  handles.geometries.push(pommelGeo);
  const pommel = new THREE.Mesh(pommelGeo, goldMat);
  pommel.position.set(0, 0.012, 0);
  group.add(pommel);

  const collarGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.16, 8);
  handles.geometries.push(collarGeo);
  const collar = new THREE.Mesh(collarGeo, wrapMat);
  collar.position.set(0, 0.12, 0);
  collar.scale.set(1.04, 1, 1.04);
  group.add(collar);

  // Chắn tay (Tsuba)
  const guardGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.016, 12);
  handles.geometries.push(guardGeo);
  const guard = new THREE.Mesh(guardGeo, goldMat);
  guard.position.set(0, 0.245, 0);
  group.add(guard);

  // Lưỡi kiếm (Nagasa)
  const bladeGeo = new THREE.BoxGeometry(0.012, 0.68, 0.036);
  bladeGeo.translate(0, 0.34, 0);
  handles.geometries.push(bladeGeo);
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.set(0, 0.252, 0);
  group.add(blade);

  const spineGeo = new THREE.BoxGeometry(0.014, 0.66, 0.014);
  spineGeo.translate(0, 0.33, 0);
  handles.geometries.push(spineGeo);
  const spine = new THREE.Mesh(spineGeo, spineMat);
  spine.position.set(0, 0.252, 0.012);
  group.add(spine);

  // Mũi kiếm vát (Kissaki)
  const tipGeo = new THREE.ConeGeometry(0.02, 0.1, 4);
  tipGeo.rotateY(Math.PI / 4);
  tipGeo.translate(0, 0.05, 0);
  handles.geometries.push(tipGeo);
  const tip = new THREE.Mesh(tipGeo, bladeMat);
  tip.position.set(0, 0.93, 0);
  tip.scale.set(0.42, 1, 1.1);
  group.add(tip);

  // Tinh thể băng phát sáng trên chắn kiếm & sống kiếm cho phiên bản Katana Băng
  if (isIce) {
    const frostMat = new THREE.MeshBasicMaterial({ color: '#e0f2fe' });
    handles.materials.push(frostMat);

    const crystalGeo = new THREE.OctahedronGeometry(0.036, 0);
    handles.geometries.push(crystalGeo);
    const crystal = new THREE.Mesh(crystalGeo, frostMat);
    crystal.position.set(0, 0.255, 0.045);
    crystal.scale.set(0.75, 1.3, 0.75);
    group.add(crystal);

    const edgeGlowGeo = new THREE.BoxGeometry(0.006, 0.66, 0.012);
    edgeGlowGeo.translate(0, 0.33, 0);
    handles.geometries.push(edgeGlowGeo);
    const edgeGlow = new THREE.Mesh(edgeGlowGeo, frostMat);
    edgeGlow.position.set(0, 0.252, -0.017);
    group.add(edgeGlow);
  }

  return group;
}

export class KatanaViewModel {
  private readonly scene: THREE.Scene;
  private group: THREE.Group;
  private assets: KatanaAssetHandles = { geometries: [], materials: [] };
  private isIce = false;

  private readonly idleOffset = new THREE.Vector3(0.42, -0.34, -0.62);
  private readonly slashOffset = new THREE.Vector3();
  private readonly tempLocalPos = new THREE.Vector3();
  private readonly tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly tempLocalQuat = new THREE.Quaternion();

  private isSlashing = false;
  private slashElapsed = 0;
  private readonly slashDuration = 0.28;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = createKatanaMeshGroup(this.assets, false);
    this.group.scale.set(0.85, 0.85, 0.85);
    this.group.visible = false;
    this.scene.add(this.group);
  }

  setIceVariant(enabled: boolean): void {
    if (this.isIce === enabled) return;
    this.isIce = enabled;
    const wasVisible = this.group.visible;
    this.disposeMeshOnly();
    this.group = createKatanaMeshGroup(this.assets, enabled);
    this.group.scale.set(0.85, 0.85, 0.85);
    this.group.visible = wasVisible;
    this.scene.add(this.group);
  }

  private disposeMeshOnly(): void {
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

  triggerSlash(): void {
    if (this.isSlashing && this.slashElapsed < this.slashDuration * 0.55) {
      return;
    }
    this.isSlashing = true;
    this.slashElapsed = 0;
  }

  update(
    camera: THREE.Camera,
    dt: number,
    visible: boolean,
    motion?: { lagY: number; strideX: number; strideY: number },
  ): void {
    this.group.visible = visible;
    if (!visible) {
      this.isSlashing = false;
      return;
    }

    const lagY = motion?.lagY ?? 0;
    const strideX = motion?.strideX ?? 0;
    const strideY = motion?.strideY ?? 0;

    let pitch = -0.65 + lagY * 1.1;
    let yaw = 0.18;
    let roll = 0.25 - strideX * 1.6;
    this.slashOffset.set(strideX, lagY + strideY, 0);

    if (this.isSlashing) {
      this.slashElapsed += dt;
      const t = Math.min(1, this.slashElapsed / this.slashDuration);

      if (t < 0.2) {
        // Vung kiếm lên nhẹ
        const k = t / 0.2;
        pitch += 0.28 * k;
        roll -= 0.45 * k;
        this.slashOffset.set(strideX + 0.06 * k, lagY + strideY + 0.08 * k, 0.04 * k);
      } else if (t < 0.55) {
        // Chém chéo từ phải-trên xuống trái-dưới
        const k = (t - 0.2) / 0.35;
        const swing = k * k * (3 - 2 * k);
        pitch = -0.37 - 1.15 * swing + lagY * 0.6;
        yaw = 0.18 + 0.95 * swing;
        roll = -0.2 + 1.35 * swing;
        this.slashOffset.set(
          strideX + 0.06 - 0.44 * swing,
          lagY + strideY + 0.08 - 0.22 * swing,
          0.04 - 0.18 * swing,
        );
      } else {
        // Thu kiếm về vị trí ban đầu
        const k = (t - 0.55) / 0.45;
        const ease = 1 - (1 - k) * (1 - k);
        pitch = -1.52 + (-0.65 - -1.52) * ease + lagY * 0.9;
        yaw = 1.13 + (0.18 - 1.13) * ease;
        roll = 1.15 + (0.25 - 1.15) * ease;
        this.slashOffset.set(
          strideX + -0.38 * (1 - ease),
          lagY + strideY + -0.14 * (1 - ease),
          -0.14 * (1 - ease),
        );
      }

      if (t >= 1) {
        this.isSlashing = false;
      }
    }

    this.tempLocalPos
      .copy(this.idleOffset)
      .add(this.slashOffset)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);
    this.group.position.copy(this.tempLocalPos);

    this.tempEuler.set(pitch, yaw, roll, 'YXZ');
    this.tempLocalQuat.setFromEuler(this.tempEuler);
    this.group.quaternion.copy(camera.quaternion).multiply(this.tempLocalQuat);
  }

  dispose(): void {
    this.disposeMeshOnly();
  }
}
