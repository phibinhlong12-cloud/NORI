import * as THREE from 'three';
import {
  CharacterGender,
  createFirstPersonArmGroup,
  FirstPersonArmHandles,
} from './firstPersonArms';

export interface KatanaAssetHandles extends FirstPersonArmHandles {}

export type KatanaVisualVariant = 'normal' | 'ice' | 'crimson';

function createCurvedBladeGeometry(
  length: number,
  width: number,
  thickness: number,
  curveAmount: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  // Mép lưng cong parabol (Sori) từ y=0 đến y=length
  shape.moveTo(-width * 0.5, 0);
  shape.quadraticCurveTo(curveAmount * 0.55 - width * 0.5, length * 0.55, curveAmount - width * 0.42, length);
  // Mũi kiếm vát cong Kissaki
  shape.quadraticCurveTo(curveAmount + width * 0.08, length + 0.09, curveAmount + width * 0.48, length - 0.02);
  // Lưỡi cắt sắc bén
  shape.quadraticCurveTo(curveAmount * 0.55 + width * 0.5, length * 0.55, width * 0.5, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.35,
    bevelSize: thickness * 0.25,
    bevelSegments: 2,
    curveSegments: 14,
  });
  // Căn giữa theo độ dày Z rồi xoay sao cho lưỡi hướng dọc trục Y và bản rộng dọc trục Z
  geo.translate(0, 0, -thickness * 0.5);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function createKatanaMeshGroup(
  handles: KatanaAssetHandles,
  isIce = false,
  variant?: KatanaVisualVariant,
): THREE.Group {
  const resolvedVariant: KatanaVisualVariant = variant ?? (isIce ? 'ice' : 'normal');
  const iceMode = resolvedVariant === 'ice';
  const crimsonMode = resolvedVariant === 'crimson';

  const group = new THREE.Group();

  const hiltMat = new THREE.MeshStandardMaterial({
    color: iceMode ? '#0c4a6e' : '#18181b',
    roughness: 0.74,
    metalness: 0.14,
  });
  const wrapMat = new THREE.MeshStandardMaterial({
    color: iceMode ? '#0284c7' : crimsonMode ? '#991b1b' : '#b45309',
    roughness: 0.78,
    metalness: 0.12,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: iceMode ? '#7dd3fc' : '#eab308',
    roughness: 0.24,
    metalness: 0.88,
  });
  const bladeMat = iceMode
    ? new THREE.MeshPhysicalMaterial({
        color: '#bae6fd',
        emissive: '#0284c7',
        emissiveIntensity: 0.45,
        roughness: 0.1,
        metalness: 0.72,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      })
    : crimsonMode
      ? new THREE.MeshPhysicalMaterial({
          color: '#fecdd3',
          emissive: '#e11d48',
          emissiveIntensity: 0.7,
          roughness: 0.14,
          metalness: 0.65,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
        })
      : new THREE.MeshStandardMaterial({
          color: '#e2e8f0',
          roughness: 0.14,
          metalness: 0.92,
        });
  const spineMat = new THREE.MeshStandardMaterial({
    color: iceMode ? '#0ea5e9' : crimsonMode ? '#27272a' : '#64748b',
    roughness: 0.28,
    metalness: 0.78,
  });
  handles.materials.push(hiltMat, wrapMat, goldMat, bladeMat, spineMat);

  // Tay cầm (Tsuka) bo tròn không góc 90 độ
  const hiltGeo = new THREE.CapsuleGeometry(0.021, 0.21, 6, 12);
  hiltGeo.translate(0, 0.12, 0);
  handles.geometries.push(hiltGeo);
  const hilt = new THREE.Mesh(hiltGeo, hiltMat);
  group.add(hilt);

  // Chụp chuôi kiếm (Kashira)
  const pommelGeo = new THREE.CylinderGeometry(0.025, 0.023, 0.024, 14);
  handles.geometries.push(pommelGeo);
  const pommel = new THREE.Mesh(pommelGeo, goldMat);
  pommel.position.set(0, 0.014, 0);
  group.add(pommel);

  // Dải quấn tsuka hình thoi mềm mại
  const ringGeo = new THREE.TorusGeometry(0.022, 0.0045, 6, 14);
  ringGeo.rotateX(Math.PI / 2);
  handles.geometries.push(ringGeo);
  for (let i = 0; i < 6; i++) {
    const wrapRing = new THREE.Mesh(ringGeo, wrapMat);
    wrapRing.position.set(0, 0.052 + i * 0.032, 0);
    wrapRing.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.22;
    group.add(wrapRing);
  }

  // Chắn tay (Tsuba) bo tròn cạnh
  const guardGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.015, 20);
  handles.geometries.push(guardGeo);
  const guard = new THREE.Mesh(guardGeo, goldMat);
  guard.position.set(0, 0.245, 0);
  group.add(guard);

  // Lưỡi kiếm cong parabol (Nagasa) thay cho BoxGeometry
  const bladeGeo = createCurvedBladeGeometry(0.7, 0.036, 0.008, -0.045);
  handles.geometries.push(bladeGeo);
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.set(0, 0.252, 0);
  group.add(blade);

  // Sống kiếm cong ôm sát lưng lưỡi
  const spineGeo = createCurvedBladeGeometry(0.67, 0.014, 0.011, -0.042);
  handles.geometries.push(spineGeo);
  const spine = new THREE.Mesh(spineGeo, spineMat);
  spine.position.set(0, 0.252, 0.012);
  group.add(spine);

  // Hiệu ứng tinh thể/ánh sáng dọc lưỡi cho Katana Băng hoặc Crimson
  if (iceMode || crimsonMode) {
    const glowMat = new THREE.MeshStandardMaterial({
      color: iceMode ? '#e0f2fe' : '#ffe4e6',
      emissive: iceMode ? '#38bdf8' : '#fb7185',
      emissiveIntensity: 1.25,
      roughness: 0.12,
      metalness: 0.2,
    });
    handles.materials.push(glowMat);

    const crystalGeo = new THREE.OctahedronGeometry(0.032, 1);
    handles.geometries.push(crystalGeo);
    const crystal = new THREE.Mesh(crystalGeo, glowMat);
    crystal.position.set(0, 0.255, 0.044);
    crystal.scale.set(0.72, 1.25, 0.72);
    group.add(crystal);

    const edgeGlowGeo = createCurvedBladeGeometry(0.66, 0.012, 0.004, -0.042);
    handles.geometries.push(edgeGlowGeo);
    const edgeGlow = new THREE.Mesh(edgeGlowGeo, glowMat);
    edgeGlow.position.set(0, 0.252, -0.016);
    group.add(edgeGlow);
  }

  return group;
}

export class KatanaViewModel {
  private readonly scene: THREE.Scene;
  private group: THREE.Group;
  private assets: KatanaAssetHandles = { geometries: [], materials: [] };
  private isIce = false;
  private gender: CharacterGender = 'male';

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
    this.group = this.buildViewGroup();
    this.scene.add(this.group);
  }

  private buildViewGroup(): THREE.Group {
    const root = createKatanaMeshGroup(this.assets, this.isIce);
    const arm = createFirstPersonArmGroup(this.gender, 'right', this.assets, 'katana');
    root.add(arm);
    root.scale.set(0.85, 0.85, 0.85);
    root.visible = false;
    return root;
  }

  setGender(gender: CharacterGender): void {
    if (this.gender === gender) return;
    this.gender = gender;
    this.rebuildGroup();
  }

  setIceVariant(enabled: boolean): void {
    if (this.isIce === enabled) return;
    this.isIce = enabled;
    this.rebuildGroup();
  }

  private rebuildGroup(): void {
    const wasVisible = this.group.visible;
    this.disposeMeshOnly();
    this.group = this.buildViewGroup();
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

    // Nữ giữ kiếm hơi nghiêng mềm mại hơn, Nam giữ vững chãi chắc chắn
    const basePitch = this.gender === 'male' ? -0.65 : -0.6;
    const baseYaw = this.gender === 'male' ? 0.18 : 0.24;
    const baseRoll = this.gender === 'male' ? 0.25 : 0.32;

    let pitch = basePitch + lagY * 1.1;
    let yaw = baseYaw;
    let roll = baseRoll - strideX * 1.6;
    this.slashOffset.set(strideX, lagY + strideY, 0);

    if (this.isSlashing) {
      this.slashElapsed += dt;
      const t = Math.min(1, this.slashElapsed / this.slashDuration);

      if (t < 0.2) {
        const k = t / 0.2;
        pitch += 0.28 * k;
        roll -= 0.45 * k;
        this.slashOffset.set(strideX + 0.06 * k, lagY + strideY + 0.08 * k, 0.04 * k);
      } else if (t < 0.55) {
        const k = (t - 0.2) / 0.35;
        const swing = k * k * (3 - 2 * k);
        pitch = basePitch + 0.28 - 1.15 * swing + lagY * 0.6;
        yaw = baseYaw + 0.95 * swing;
        roll = baseRoll - 0.45 + 1.35 * swing;
        this.slashOffset.set(
          strideX + 0.06 - 0.44 * swing,
          lagY + strideY + 0.08 - 0.22 * swing,
          0.04 - 0.18 * swing,
        );
      } else {
        const k = (t - 0.55) / 0.45;
        const ease = 1 - (1 - k) * (1 - k);
        pitch = basePitch - 0.87 + 0.87 * ease + lagY * 0.9;
        yaw = baseYaw + 0.95 * (1 - ease);
        roll = baseRoll + 0.9 * (1 - ease);
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
