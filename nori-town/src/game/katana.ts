import * as THREE from 'three';
import {
  CharacterGender,
  createFirstPersonArmGroup,
  FirstPersonArmHandles,
  FirstPersonArmRig,
} from './firstPersonArms';
import { isOutfitCompatibleWithGender, OutfitId, OUTFITS } from './outfits';

export interface KatanaAssetHandles extends FirstPersonArmHandles {}

export type KatanaVisualVariant = 'normal' | 'ice' | 'crimson' | 'leaf';

export const BASE_KATANA_DAMAGE = 100;

export function getKatanaDamage(variant: KatanaVisualVariant | null): number {
  switch (variant) {
    case 'leaf':
      return Math.round(BASE_KATANA_DAMAGE * 1.2); // 120 (+20% so với kiếm thường)
    case 'ice':
      return Math.round(BASE_KATANA_DAMAGE * 2.0); // 200 (giữ sức mạnh x2 tạm thời cho đến khi cập nhật sau)
    case 'crimson':
    case 'normal':
      return BASE_KATANA_DAMAGE;
    default:
      return 0;
  }
}

export function getKatanaMoveSpeedMultiplier(variant: KatanaVisualVariant | null): number {
  return variant === 'leaf' ? 1.2 : 1.0;
}

export function getKatanaDisplayName(variant: KatanaVisualVariant): string {
  switch (variant) {
    case 'ice':
      return 'Katana Băng';
    case 'leaf':
      return 'Kiếm Lá';
    case 'crimson':
      return 'Katana Huyết';
    default:
      return 'Katana';
  }
}

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
  sheathed = false,
): THREE.Group {
  const resolvedVariant: KatanaVisualVariant = variant ?? (isIce ? 'ice' : 'normal');
  const iceMode = resolvedVariant === 'ice';
  const crimsonMode = resolvedVariant === 'crimson';
  const leafMode = resolvedVariant === 'leaf';

  const group = new THREE.Group();

  const hiltMat = new THREE.MeshStandardMaterial({
    color: iceMode ? '#0c4a6e' : leafMode ? '#e7dfd0' : '#18181b',
    roughness: 0.74,
    metalness: 0.14,
  });
  const wrapMat = new THREE.MeshStandardMaterial({
    color: iceMode ? '#0284c7' : crimsonMode || leafMode ? '#991b1b' : '#b45309',
    roughness: 0.78,
    metalness: 0.12,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: iceMode ? '#7dd3fc' : leafMode ? '#d4af37' : '#eab308',
    roughness: 0.24,
    metalness: 0.88,
  });
  const guardMat = leafMode
    ? new THREE.MeshStandardMaterial({
        color: '#27272a',
        roughness: 0.36,
        metalness: 0.78,
      })
    : goldMat;
  handles.materials.push(hiltMat, wrapMat, goldMat);
  if (guardMat !== goldMat) {
    handles.materials.push(guardMat);
  }

  // Tay cầm (Tsuka) bo tròn không góc 90 độ
  const hiltGeo = new THREE.CapsuleGeometry(0.021, 0.21, 6, 12);
  hiltGeo.translate(0, 0.12, 0);
  handles.geometries.push(hiltGeo);
  const hilt = new THREE.Mesh(hiltGeo, hiltMat);
  group.add(hilt);

  // Chụp chuôi kiếm (Kashira)
  const pommelGeo = new THREE.CylinderGeometry(0.025, 0.023, 0.024, 14);
  handles.geometries.push(pommelGeo);
  const pommel = new THREE.Mesh(pommelGeo, guardMat);
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
  const guard = new THREE.Mesh(guardGeo, guardMat);
  guard.position.set(0, 0.245, 0);
  group.add(guard);

  if (leafMode) {
    // Khâu đồng vàng (Habaki) ôm sát gốc lưỡi Kiếm Lá
    const habakiGeo = new THREE.CylinderGeometry(0.019, 0.021, 0.036, 12);
    handles.geometries.push(habakiGeo);
    const habaki = new THREE.Mesh(habakiGeo, goldMat);
    habaki.position.set(0, 0.27, 0);
    habaki.scale.set(0.7, 1, 1.35);
    group.add(habaki);
  }

  if (!sheathed) {
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
      : leafMode
        ? new THREE.MeshPhysicalMaterial({
            color: '#15803d',
            emissive: '#052e16',
            emissiveIntensity: 0.28,
            roughness: 0.16,
            metalness: 0.56,
            clearcoat: 0.92,
            clearcoatRoughness: 0.1,
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
      color: iceMode ? '#0ea5e9' : leafMode ? '#14532d' : crimsonMode ? '#27272a' : '#64748b',
      roughness: 0.28,
      metalness: 0.78,
    });
    handles.materials.push(bladeMat, spineMat);

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

    if (leafMode) {
      // Mép lưỡi cắt bạc sáng (Hamon) đặc trưng của Kiếm Lá
      const silverEdgeMat = new THREE.MeshStandardMaterial({
        color: '#f1f5f9',
        emissive: '#86efac',
        emissiveIntensity: 0.22,
        roughness: 0.12,
        metalness: 0.9,
      });
      handles.materials.push(silverEdgeMat);
      const silverEdgeGeo = createCurvedBladeGeometry(0.69, 0.011, 0.0045, -0.044);
      handles.geometries.push(silverEdgeGeo);
      const silverEdge = new THREE.Mesh(silverEdgeGeo, silverEdgeMat);
      silverEdge.position.set(0, 0.254, -0.014);
      group.add(silverEdge);
    }
  }

  // Hiệu ứng tinh thể/ánh sáng cho Katana Băng hoặc Crimson
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

    if (!sheathed) {
      const edgeGlowGeo = createCurvedBladeGeometry(0.66, 0.012, 0.004, -0.042);
      handles.geometries.push(edgeGlowGeo);
      const edgeGlow = new THREE.Mesh(edgeGlowGeo, glowMat);
      edgeGlow.position.set(0, 0.252, -0.016);
      group.add(edgeGlow);
    }
  }

  return group;
}

function createSlashCrescentGeometry(): THREE.BufferGeometry {
  const segments = 26;
  const arcSpan = Math.PI * 0.72;
  const startAngle = -arcSpan * 0.5;
  const innerR = 0.44;
  const maxWidth = 0.145;

  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + arcSpan * t;
    const taper = Math.sin(t * Math.PI);
    const width = maxWidth * Math.pow(taper, 0.7);
    const rOut = innerR + width;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const vBase = i * 2;
    positions[vBase * 3] = cosA * innerR;
    positions[vBase * 3 + 1] = sinA * innerR;
    positions[vBase * 3 + 2] = 0;

    positions[(vBase + 1) * 3] = cosA * rOut;
    positions[(vBase + 1) * 3 + 1] = sinA * rOut;
    positions[(vBase + 1) * 3 + 2] = 0;

    uvs[vBase * 2] = t;
    uvs[vBase * 2 + 1] = 0;
    uvs[(vBase + 1) * 2] = t;
    uvs[(vBase + 1) * 2 + 1] = 1;

    if (i < segments) {
      const a = vBase;
      const b = vBase + 1;
      const c = vBase + 2;
      const d = vBase + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export class KatanaViewModel {
  private readonly scene: THREE.Scene;
  private group: THREE.Group;
  private armRig: FirstPersonArmRig | null = null;
  private leftArmGroup: THREE.Group | null = null;
  private leftArmRig: FirstPersonArmRig | null = null;
  private slashArcMesh: THREE.Mesh | null = null;
  private slashArcMat: THREE.MeshBasicMaterial | null = null;

  private assets: KatanaAssetHandles = { geometries: [], materials: [], skeletons: [] };
  private variant: KatanaVisualVariant = 'normal';
  private gender: CharacterGender = 'male';
  private outfit: OutfitId = 'default';

  private readonly idleOffset = new THREE.Vector3(0.04, -0.32, -0.52);
  private readonly slashOffset = new THREE.Vector3();
  private readonly tempLocalPos = new THREE.Vector3();
  private readonly tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly tempLocalQuat = new THREE.Quaternion();
  private readonly tempArcOffset = new THREE.Vector3(0, -0.04, -0.78);
  private readonly tempArcEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly tempArcQuat = new THREE.Quaternion();

  private isSlashing = false;
  private slashElapsed = 0;
  private readonly slashDuration = 0.36;
  private comboIndex = 0;
  private nextComboIndex = 0;
  private comboResetTimer = 0;
  private idleTime = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = this.buildViewGroup();
    this.scene.add(this.group);
  }

  private buildViewGroup(): THREE.Group {
    const viewRoot = new THREE.Group();
    const arm = createFirstPersonArmGroup(
      this.gender,
      'right',
      this.assets,
      'katana',
      this.outfit,
    );
    const rig = (arm.userData.armRig as FirstPersonArmRig | undefined) ?? null;
    this.armRig = rig;

    const leftArm = createFirstPersonArmGroup(
      this.gender,
      'left',
      this.assets,
      'katana',
      this.outfit,
    );
    const leftRig = (leftArm.userData.armRig as FirstPersonArmRig | undefined) ?? null;
    this.leftArmGroup = leftArm;
    this.leftArmRig = leftRig;

    const katana = createKatanaMeshGroup(this.assets, this.variant === 'ice', this.variant);
    katana.add(leftArm);
    if (rig) {
      // Đặt katana vào trực tiếp trong xương cổ tay theo ma trận nghịch đảo của tay ở tư thế nghỉ
      const armLocalMat = new THREE.Matrix4().compose(
        rig.basePosition,
        new THREE.Quaternion().setFromEuler(rig.baseRotation),
        new THREE.Vector3(1, 1, 1),
      );
      armLocalMat.invert();
      armLocalMat.decompose(katana.position, katana.quaternion, katana.scale);
      rig.wristBone.add(katana);
      viewRoot.add(arm);
    } else {
      viewRoot.add(katana, arm);
    }

    const activeOutfit: OutfitId = isOutfitCompatibleWithGender(this.outfit, this.gender)
      ? this.outfit
      : 'default';
    const arcColor =
      this.variant === 'ice'
        ? '#7dd3fc'
        : this.variant === 'leaf'
          ? '#4ade80'
          : OUTFITS[activeOutfit]?.slashArcColor ?? '#f8fafc';
    const arcGeo = createSlashCrescentGeometry();
    const arcMat = new THREE.MeshBasicMaterial({
      color: arcColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.assets.geometries.push(arcGeo);
    this.assets.materials.push(arcMat);
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.visible = false;
    arcMesh.frustumCulled = false;
    this.scene.add(arcMesh);
    this.slashArcMesh = arcMesh;
    this.slashArcMat = arcMat;

    viewRoot.scale.set(0.88, 0.88, 0.88);
    viewRoot.visible = false;
    return viewRoot;
  }

  setGender(gender: CharacterGender): void {
    if (this.gender === gender) return;
    this.gender = gender;
    this.rebuildGroup();
  }

  setOutfit(outfit: OutfitId): void {
    if (this.outfit === outfit) return;
    this.outfit = outfit;
    this.rebuildGroup();
  }

  setVariant(variant: KatanaVisualVariant): void {
    if (this.variant === variant) return;
    this.variant = variant;
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
    if (this.slashArcMesh) {
      this.scene.remove(this.slashArcMesh);
      this.slashArcMesh = null;
      this.slashArcMat = null;
    }
    this.armRig = null;
    this.leftArmGroup = null;
    this.leftArmRig = null;
    if (this.assets.skeletons) {
      for (const skel of this.assets.skeletons) {
        skel.dispose();
      }
      this.assets.skeletons.length = 0;
    }
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
    if (this.isSlashing && this.slashElapsed < this.slashDuration * 0.56) {
      return;
    }
    this.comboIndex = this.nextComboIndex;
    this.nextComboIndex = (this.comboIndex + 1) % 3;
    this.comboResetTimer = 0.95;
    this.isSlashing = true;
    this.slashElapsed = 0;
  }

  private resetBonesToIdle(lagY: number, strideX: number): void {
    const breath = Math.sin(this.idleTime * 2.1);
    const sway = Math.cos(this.idleTime * 1.45);
    const elbowPhase = Math.sin(this.idleTime * 2.1 - 0.55);
    const wristPhase = Math.sin(this.idleTime * 2.1 - 1.1);

    const rig = this.armRig;
    if (rig) {
      rig.shoulderBone.rotation.set(breath * 0.015 + lagY * 0.25, 0, sway * 0.012);
      rig.elbowBone.rotation.set(0.03 + elbowPhase * 0.024 + lagY * 0.42, 0, -strideX * 0.45);
      rig.forearmBone.rotation.set(0, Math.sin(this.idleTime * 1.7) * 0.035, 0);
      rig.wristBone.rotation.set(
        wristPhase * 0.024 + lagY * 0.72,
        -strideX * 0.4,
        strideX * 0.6,
      );
    }

    const leftRig = this.leftArmRig;
    if (leftRig) {
      leftRig.shoulderBone.rotation.set(-breath * 0.012, 0, -sway * 0.01);
      leftRig.elbowBone.rotation.set(0.02 - elbowPhase * 0.018, 0, strideX * 0.25);
      leftRig.forearmBone.rotation.set(0, -Math.sin(this.idleTime * 1.7) * 0.02, 0);
      leftRig.wristBone.rotation.set(0, 0, 0);
    }
  }

  update(
    camera: THREE.Camera,
    dt: number,
    visible: boolean,
    motion?: { lagY: number; strideX: number; strideY: number },
    shieldRaised = false,
  ): void {
    this.group.visible = visible;
    if (!visible) {
      this.isSlashing = false;
      this.nextComboIndex = 0;
      if (this.slashArcMesh) this.slashArcMesh.visible = false;
      return;
    }

    if (this.leftArmGroup) {
      this.leftArmGroup.visible = !shieldRaised;
    }

    this.idleTime += dt;
    if (!this.isSlashing && this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) {
        this.nextComboIndex = 0;
      }
    }

    const lagY = motion?.lagY ?? 0;
    const strideX = motion?.strideX ?? 0;
    const strideY = motion?.strideY ?? 0;

    // Dáng thủ katana chéo hướng tới trước-phải như ảnh mẫu (hai tay ôm chuôi, lưỡi vát chéo)
    const basePitch = this.gender === 'male' ? -0.58 : -0.54;
    const baseYaw = this.gender === 'male' ? -0.22 : -0.18;
    const baseRoll = this.gender === 'male' ? -0.46 : -0.42;

    let pitch = basePitch + lagY * 0.85;
    let yaw = baseYaw;
    let roll = baseRoll - strideX * 1.1;
    this.slashOffset.set(strideX, lagY + strideY, 0);

    const rig = this.armRig;
    this.resetBonesToIdle(lagY, strideX);

    let arcOpacity = 0;
    let arcPlaneRoll = -0.45;
    let arcSweepZ = 0;
    let arcPitch = 0.18;

    if (this.isSlashing) {
      this.slashElapsed += dt;
      const t = Math.min(1, this.slashElapsed / this.slashDuration);

      // Các pha mượt mà với độ trễ vai -> khuỷu -> cổ tay & đàn hồi cuối đòn
      const wEnd = 0.19;
      const sEnd = 0.54;

      if (this.comboIndex === 0) {
        // Đòn 1: Chém chéo phải -> trái (Forehand)
        arcPlaneRoll = -0.46;
        if (t < wEnd) {
          const k = t / wEnd;
          const ease = k * k * (3 - 2 * k);
          pitch += 0.22 * ease;
          roll -= 0.32 * ease;
          this.slashOffset.set(strideX + 0.05 * ease, lagY + strideY + 0.07 * ease, 0.04 * ease);
          if (rig) {
            rig.shoulderBone.rotation.set(0.2 * ease, -0.14 * ease, -0.18 * ease);
            rig.elbowBone.rotation.set(0.24 * ease, 0, -0.12 * ease);
            rig.forearmBone.rotation.set(0, -0.28 * ease, 0);
            rig.wristBone.rotation.set(0.3 * ease, 0.1 * ease, -0.25 * ease);
          }
        } else if (t < sEnd) {
          const k = (t - wEnd) / (sEnd - wEnd);
          const swing = k * k * (3 - 2 * k);
          const wristSnap = Math.min(1, Math.max(0, (k - 0.12) / 0.88));
          const wristEase = wristSnap * wristSnap * (3 - 2 * wristSnap);

          pitch = basePitch + 0.22 - 0.85 * swing + lagY * 0.5;
          yaw = baseYaw + 0.72 * swing;
          roll = baseRoll - 0.32 + 0.96 * swing;
          this.slashOffset.set(
            strideX + 0.05 - 0.4 * swing,
            lagY + strideY + 0.07 - 0.2 * swing,
            0.04 - 0.16 * swing,
          );
          if (rig) {
            rig.shoulderBone.rotation.set(
              0.2 - 0.62 * swing,
              -0.14 + 0.55 * swing,
              -0.18 + 0.44 * swing,
            );
            rig.elbowBone.rotation.set(0.24 - 0.38 * swing, 0, -0.12 + 0.2 * swing);
            rig.forearmBone.rotation.set(0, -0.28 + 0.82 * wristEase, 0);
            rig.wristBone.rotation.set(
              0.3 - 0.96 * wristEase,
              0.1 + 0.28 * wristEase,
              -0.25 + 0.66 * wristEase,
            );
          }
          arcOpacity = Math.sin(k * Math.PI) * 0.55;
          arcSweepZ = 0.85 - 1.75 * swing;
        } else {
          const k = (t - sEnd) / (1 - sEnd);
          const ease = 1 - Math.pow(1 - k, 3);
          const spring = Math.sin(k * Math.PI) * 0.065;
          pitch = basePitch - 0.63 + 0.63 * ease + lagY * 0.75;
          yaw = baseYaw + 0.72 * (1 - ease);
          roll = baseRoll + 0.64 * (1 - ease);
          this.slashOffset.set(
            strideX - 0.35 * (1 - ease),
            lagY + strideY - 0.13 * (1 - ease),
            -0.12 * (1 - ease),
          );
          if (rig) {
            const inv = 1 - ease;
            rig.shoulderBone.rotation.set(-0.42 * inv, 0.41 * inv, 0.26 * inv);
            rig.elbowBone.rotation.set(-0.14 * inv + spring * 0.5, 0, 0.08 * inv);
            rig.forearmBone.rotation.set(0, 0.54 * inv, 0);
            rig.wristBone.rotation.set(-0.66 * inv - spring, 0.38 * inv, 0.41 * inv + spring * 0.6);
          }
          arcOpacity = (1 - ease) * 0.14;
          arcSweepZ = -0.9 - 0.18 * ease;
        }
      } else if (this.comboIndex === 1) {
        // Đòn 2: Chém chéo ngược trái -> phải (Reverse Backhand)
        arcPlaneRoll = 0.44;
        arcPitch = -0.14;
        if (t < wEnd) {
          const k = t / wEnd;
          const ease = k * k * (3 - 2 * k);
          pitch = basePitch - 0.24 * ease;
          yaw = baseYaw + 0.58 * ease;
          roll = baseRoll + 0.46 * ease;
          this.slashOffset.set(strideX - 0.28 * ease, lagY + strideY - 0.12 * ease, -0.06 * ease);
          if (rig) {
            rig.shoulderBone.rotation.set(-0.18 * ease, 0.45 * ease, 0.24 * ease);
            rig.elbowBone.rotation.set(0.28 * ease, 0, 0.14 * ease);
            rig.forearmBone.rotation.set(0, 0.55 * ease, 0);
            rig.wristBone.rotation.set(0.24 * ease, 0.35 * ease, 0.42 * ease);
          }
        } else if (t < sEnd) {
          const k = (t - wEnd) / (sEnd - wEnd);
          const swing = k * k * (3 - 2 * k);
          const wristSnap = Math.min(1, Math.max(0, (k - 0.1) / 0.9));
          const wristEase = wristSnap * wristSnap * (3 - 2 * wristSnap);

          pitch = basePitch - 0.24 + 0.48 * swing + lagY * 0.5;
          yaw = baseYaw + 0.58 - 1.12 * swing;
          roll = baseRoll + 0.46 - 1.24 * swing;
          this.slashOffset.set(
            strideX - 0.28 + 0.44 * swing,
            lagY + strideY - 0.12 + 0.2 * swing,
            -0.06 - 0.08 * swing,
          );
          if (rig) {
            rig.shoulderBone.rotation.set(
              -0.18 + 0.48 * swing,
              0.45 - 0.92 * swing,
              0.24 - 0.52 * swing,
            );
            rig.elbowBone.rotation.set(0.28 - 0.36 * swing, 0, 0.14 - 0.24 * swing);
            rig.forearmBone.rotation.set(0, 0.55 - 1.18 * wristEase, 0);
            rig.wristBone.rotation.set(
              0.24 - 0.62 * wristEase,
              0.35 - 0.72 * wristEase,
              0.42 - 0.98 * wristEase,
            );
          }
          arcOpacity = Math.sin(k * Math.PI) * 0.52;
          arcSweepZ = -0.82 + 1.68 * swing;
        } else {
          const k = (t - sEnd) / (1 - sEnd);
          const ease = 1 - Math.pow(1 - k, 3);
          const spring = Math.sin(k * Math.PI) * 0.06;
          pitch = basePitch + 0.24 * (1 - ease) + lagY * 0.75;
          yaw = baseYaw - 0.54 * (1 - ease);
          roll = baseRoll - 0.78 * (1 - ease);
          this.slashOffset.set(
            strideX + 0.16 * (1 - ease),
            lagY + strideY + 0.08 * (1 - ease),
            -0.14 * (1 - ease),
          );
          if (rig) {
            const inv = 1 - ease;
            rig.shoulderBone.rotation.set(0.3 * inv, -0.47 * inv, -0.28 * inv);
            rig.elbowBone.rotation.set(-0.08 * inv + spring * 0.4, 0, -0.1 * inv);
            rig.forearmBone.rotation.set(0, -0.63 * inv, 0);
            rig.wristBone.rotation.set(
              -0.38 * inv + spring,
              -0.37 * inv,
              -0.56 * inv - spring * 0.5,
            );
          }
          arcOpacity = (1 - ease) * 0.12;
          arcSweepZ = 0.86 + 0.16 * ease;
        }
      } else {
        // Đòn 3: Chém bổ dọc từ trên xuống (Overhead Crescent Cleave)
        arcPlaneRoll = 1.48;
        arcPitch = 0.06;
        if (t < wEnd) {
          const k = t / wEnd;
          const ease = k * k * (3 - 2 * k);
          pitch = basePitch + 0.44 * ease;
          yaw = baseYaw - 0.22 * ease;
          roll = baseRoll - 0.42 * ease;
          this.slashOffset.set(strideX - 0.08 * ease, lagY + strideY + 0.16 * ease, 0.05 * ease);
          if (rig) {
            rig.shoulderBone.rotation.set(0.46 * ease, -0.1 * ease, -0.12 * ease);
            rig.elbowBone.rotation.set(0.34 * ease, 0, 0);
            rig.forearmBone.rotation.set(0, -0.18 * ease, 0);
            rig.wristBone.rotation.set(0.44 * ease, 0, -0.18 * ease);
          }
        } else if (t < sEnd) {
          const k = (t - wEnd) / (sEnd - wEnd);
          const swing = k * k * (3 - 2 * k);
          const wristSnap = Math.min(1, Math.max(0, (k - 0.12) / 0.88));
          const wristEase = wristSnap * wristSnap * (3 - 2 * wristSnap);

          pitch = basePitch + 0.44 - 1.24 * swing + lagY * 0.5;
          yaw = baseYaw - 0.22 + 0.34 * swing;
          roll = baseRoll - 0.42 + 0.46 * swing;
          this.slashOffset.set(
            strideX - 0.08 - 0.12 * swing,
            lagY + strideY + 0.16 - 0.34 * swing,
            0.05 - 0.2 * swing,
          );
          if (rig) {
            rig.shoulderBone.rotation.set(
              0.46 - 1.06 * swing,
              -0.1 + 0.2 * swing,
              -0.12 + 0.18 * swing,
            );
            rig.elbowBone.rotation.set(0.34 - 0.56 * swing, 0, 0);
            rig.forearmBone.rotation.set(0, -0.18 + 0.34 * wristEase, 0);
            rig.wristBone.rotation.set(
              0.44 - 1.22 * wristEase,
              0.12 * wristEase,
              -0.18 + 0.28 * wristEase,
            );
          }
          arcOpacity = Math.sin(k * Math.PI) * 0.6;
          arcSweepZ = 0.82 - 1.64 * swing;
        } else {
          const k = (t - sEnd) / (1 - sEnd);
          const ease = 1 - Math.pow(1 - k, 3);
          const spring = Math.sin(k * Math.PI) * 0.075;
          pitch = basePitch - 0.8 + 0.8 * ease + lagY * 0.75;
          yaw = baseYaw + 0.12 * (1 - ease);
          roll = baseRoll + 0.04 * (1 - ease);
          this.slashOffset.set(
            strideX - 0.2 * (1 - ease),
            lagY + strideY - 0.18 * (1 - ease),
            -0.15 * (1 - ease),
          );
          if (rig) {
            const inv = 1 - ease;
            rig.shoulderBone.rotation.set(-0.6 * inv, 0.1 * inv, 0.06 * inv);
            rig.elbowBone.rotation.set(-0.22 * inv + spring * 0.4, 0, 0);
            rig.forearmBone.rotation.set(0, 0.16 * inv, 0);
            rig.wristBone.rotation.set(-0.78 * inv - spring, 0.12 * inv, 0.1 * inv);
          }
          arcOpacity = (1 - ease) * 0.14;
          arcSweepZ = -0.82 - 0.16 * ease;
        }
      }

      if (t >= 1) {
        this.isSlashing = false;
      }
    }

    if (this.slashArcMesh && this.slashArcMat) {
      if (arcOpacity > 0.01) {
        this.slashArcMesh.visible = true;
        this.slashArcMat.opacity = arcOpacity;
        this.tempLocalPos
          .copy(this.tempArcOffset)
          .applyQuaternion(camera.quaternion)
          .add(camera.position);
        this.slashArcMesh.position.copy(this.tempLocalPos);
        this.tempArcEuler.set(arcPitch, 0, arcPlaneRoll + arcSweepZ, 'YXZ');
        this.tempArcQuat.setFromEuler(this.tempArcEuler);
        this.slashArcMesh.quaternion.copy(camera.quaternion).multiply(this.tempArcQuat);
      } else {
        this.slashArcMesh.visible = false;
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
