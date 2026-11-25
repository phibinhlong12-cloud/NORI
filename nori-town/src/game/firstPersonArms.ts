import * as THREE from 'three';
import { createParabolicEllipsoidGeometry, createParabolicLatheGeometry } from './parabolic';
import { applyAxisSkinWeights, bindSkinnedMeshToSkeleton } from './skeletonUtils';

export type CharacterGender = 'male' | 'female';

export interface FirstPersonArmHandles {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  skeletons?: THREE.Skeleton[];
}

export type ArmHoldMode = 'katana' | 'shield' | 'potion';

export interface FirstPersonArmRig {
  shoulderBone: THREE.Bone;
  elbowBone: THREE.Bone;
  forearmBone: THREE.Bone;
  wristBone: THREE.Bone;
  handPivot: THREE.Group;
  skeleton: THREE.Skeleton;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Euler;
}

let cachedSleeveTexture: THREE.CanvasTexture | null = null;
function getSleeveWeaveTexture(): THREE.CanvasTexture {
  if (cachedSleeveTexture) return cachedSleeveTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 4) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cachedSleeveTexture = tex;
  return tex;
}

/**
 * Tạo cánh tay + cổ tay + bàn tay góc nhìn thứ nhất gắn hệ xương thật (THREE.Bone + THREE.SkinnedMesh):
 * - Chuỗi xương Vai → Khuỷu tay → Cẳng tay (xoay cổ tay) → Cổ tay/Bàn tay.
 * - Da cẳng tay và tay áo kimono được skin mượt để uốn cong liền mạch khi vung kiếm / đỡ khiên / uống thuốc.
 */
export function createFirstPersonArmGroup(
  gender: CharacterGender,
  side: 'right' | 'left',
  handles: FirstPersonArmHandles,
  mode: ArmHoldMode,
): THREE.Group {
  const armGroup = new THREE.Group();
  const isMale = gender === 'male';

  const skinMat = new THREE.MeshStandardMaterial({
    color: isMale ? '#f3dfd0' : '#fcebe3',
    roughness: isMale ? 0.56 : 0.42,
    metalness: 0.02,
  });
  const sleeveOuterMat = new THREE.MeshPhysicalMaterial({
    map: getSleeveWeaveTexture(),
    color: isMale ? '#f97316' : '#f472b6',
    roughness: 0.68,
    metalness: 0.04,
    sheen: 0.45,
    sheenRoughness: 0.58,
    sheenColor: new THREE.Color(isMale ? '#fed7aa' : '#fce7f3'),
  });
  const sleeveInnerMat = new THREE.MeshPhysicalMaterial({
    color: isMale ? '#b91c1c' : '#dc2626',
    roughness: 0.52,
    metalness: 0.06,
    sheen: 0.5,
    sheenColor: new THREE.Color('#fca5a5'),
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#1f1b24',
    roughness: 0.62,
    metalness: 0.08,
  });
  handles.materials.push(skinMat, sleeveOuterMat, sleeveInnerMat, gloveMat);

  // Tỷ lệ cứng cáp (Nam) vs mềm mỏng (Nữ)
  const forearmLen = isMale ? 0.36 : 0.34;
  const wristRadius = isMale ? 0.036 : 0.023;
  const elbowRadius = isMale ? 0.052 : 0.034;
  const sleeveLen = isMale ? 0.22 : 0.24;
  const sleeveFlare = isMale ? 1.15 : 1.38;

  // Chuỗi 4 xương thực: Vai -> Khuỷu -> Giữa cẳng tay (xoắn cổ tay) -> Cổ tay
  const shoulderBone = new THREE.Bone();
  shoulderBone.name = 'arm_shoulder';
  shoulderBone.position.set(0, -forearmLen - 0.14, -0.02);

  const elbowBone = new THREE.Bone();
  elbowBone.name = 'arm_elbow';
  elbowBone.position.set(0, 0.14, 0.02); // Ở tư thế nghỉ: (0, -forearmLen, 0)

  const forearmBone = new THREE.Bone();
  forearmBone.name = 'arm_forearm_twist';
  forearmBone.position.set(0, forearmLen * 0.5, 0);

  const wristBone = new THREE.Bone();
  wristBone.name = 'arm_wrist';
  wristBone.position.set(0, forearmLen * 0.5, 0); // Ở tư thế nghỉ: (0, 0, 0)

  shoulderBone.add(elbowBone);
  elbowBone.add(forearmBone);
  forearmBone.add(wristBone);
  armGroup.add(shoulderBone);

  const bones = [shoulderBone, elbowBone, forearmBone, wristBone];
  armGroup.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  handles.skeletons?.push(skeleton);

  // 1. Cẳng tay parabol chia dày vòng dọc (24 segments) + skinWeight mượt qua khuỷu & cổ tay
  const forearmGeo = createParabolicLatheGeometry(
    forearmLen,
    1,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      const base = elbowRadius + (wristRadius - elbowRadius) * (t * t * (3 - 2 * t));
      const muscleBulge = isMale ? Math.sin(t * Math.PI) * 0.007 : Math.sin(t * Math.PI) * 0.002;
      return base + muscleBulge;
    },
    18,
    24,
    false,
  );
  forearmGeo.translate(0, -forearmLen, 0);
  applyAxisSkinWeights(forearmGeo, 'y', [
    { boneIndex: 0, pos: -forearmLen - 0.05, blendWidth: 0.08 },
    { boneIndex: 1, pos: -forearmLen, blendWidth: 0.12 },
    { boneIndex: 2, pos: -forearmLen * 0.5, blendWidth: 0.15 },
    { boneIndex: 3, pos: 0, blendWidth: 0.09 },
  ]);
  handles.geometries.push(forearmGeo);
  bindSkinnedMeshToSkeleton(forearmGeo, skinMat, skeleton, armGroup, false);

  // 2. Tay áo kimono phủ phần cẳng tay sau được skin mềm để uốn theo khuỷu tay
  const sleeveGeo = createParabolicLatheGeometry(
    sleeveLen,
    1,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      const mouthR = (wristRadius + (isMale ? 0.016 : 0.024)) * (1 + (1 - t) * (sleeveFlare - 1));
      return mouthR;
    },
    18,
    20,
    false,
  );
  sleeveGeo.translate(0, -forearmLen - 0.02, 0);
  applyAxisSkinWeights(sleeveGeo, 'y', [
    { boneIndex: 0, pos: -forearmLen - 0.03, blendWidth: 0.07 },
    { boneIndex: 1, pos: -forearmLen + 0.02, blendWidth: 0.11 },
    { boneIndex: 2, pos: -forearmLen + sleeveLen - 0.02, blendWidth: 0.12 },
  ]);
  handles.geometries.push(sleeveGeo);
  bindSkinnedMeshToSkeleton(sleeveGeo, sleeveOuterMat, skeleton, armGroup, false);

  const cuffTrimGeo = new THREE.TorusGeometry(
    wristRadius + (isMale ? 0.016 : 0.024),
    isMale ? 0.006 : 0.0055,
    8,
    18,
  );
  cuffTrimGeo.rotateX(Math.PI / 2);
  cuffTrimGeo.translate(0, -forearmLen + sleeveLen - 0.022, 0);
  applyAxisSkinWeights(cuffTrimGeo, 'y', [
    { boneIndex: 1, pos: -forearmLen + 0.02, blendWidth: 0.1 },
    { boneIndex: 2, pos: -forearmLen + sleeveLen - 0.02, blendWidth: 0.1 },
  ]);
  handles.geometries.push(cuffTrimGeo);
  bindSkinnedMeshToSkeleton(cuffTrimGeo, sleeveInnerMat, skeleton, armGroup, false);

  // 3. Bàn tay & các ngón tay gắn trực tiếp vào xương cổ tay (wristBone)
  const handPivot = new THREE.Group();
  handPivot.position.set(0, 0.01, 0);
  wristBone.add(handPivot);

  const palmW = isMale ? 0.078 : 0.054;
  const palmH = isMale ? 0.088 : 0.072;
  const palmD = isMale ? 0.046 : 0.03;
  const palmGeo = createParabolicEllipsoidGeometry(palmW, palmH, palmD, 14, 10);
  handles.geometries.push(palmGeo);

  const palmMesh = new THREE.Mesh(palmGeo, isMale ? skinMat : gloveMat);
  palmMesh.position.set(0, 0.036, 0.006);
  handPivot.add(palmMesh);

  // 4 ngón tay cong ôm vào tay cầm + ngón cái giữ phía trên
  const fingerLen = isMale ? 0.068 : 0.056;
  const fingerR = isMale ? 0.011 : 0.0074;
  const fingerGeo = new THREE.CapsuleGeometry(fingerR, fingerLen * 0.55, 4, 8);
  const thumbGeo = new THREE.CapsuleGeometry(fingerR * 1.12, fingerLen * 0.42, 4, 8);
  handles.geometries.push(fingerGeo, thumbGeo);

  const fingerWrapDir = side === 'right' ? 1 : -1;
  for (let i = 0; i < 4; i++) {
    const fMesh = new THREE.Mesh(fingerGeo, skinMat);
    const offsetY = 0.006 + i * (isMale ? 0.02 : 0.0155);
    fMesh.position.set(fingerWrapDir * (palmW * 0.42), offsetY, -palmD * 0.55);
    fMesh.rotation.set(0.45, 0, fingerWrapDir * 1.15);
    handPivot.add(fMesh);
  }

  const thumbMesh = new THREE.Mesh(thumbGeo, skinMat);
  thumbMesh.position.set(-fingerWrapDir * (palmW * 0.36), 0.066, -palmD * 0.45);
  thumbMesh.rotation.set(-0.55, 0, -fingerWrapDir * 0.72);
  handPivot.add(thumbMesh);

  // Căn chỉnh hướng cánh tay theo từng loại vật phẩm cầm trên tay (SAU khi đã bind Skeleton ở tư thế nghỉ)
  if (mode === 'katana') {
    armGroup.position.set(0.012, 0.095, -0.006);
    armGroup.rotation.set(0.42, 0.18, -0.34);
  } else if (mode === 'shield') {
    armGroup.position.set(-0.04, 0.01, -0.058);
    armGroup.rotation.set(-0.48, -0.26, 0.42);
  } else {
    armGroup.position.set(0.02, 0.12, 0.015);
    armGroup.rotation.set(0.46, 0.14, -0.28);
  }

  const armRig: FirstPersonArmRig = {
    shoulderBone,
    elbowBone,
    forearmBone,
    wristBone,
    handPivot,
    skeleton,
    basePosition: armGroup.position.clone(),
    baseRotation: armGroup.rotation.clone(),
  };
  armGroup.userData.armRig = armRig;

  return armGroup;
}
