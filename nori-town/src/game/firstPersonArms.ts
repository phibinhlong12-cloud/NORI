import * as THREE from 'three';
import { isOutfitCompatibleWithGender, OutfitId, OUTFITS } from './outfits';
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
  fingerGroup: THREE.Group;
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

const cachedFemaleFloralSleeveTextures = new Map<OutfitId, THREE.CanvasTexture>();
function getFemaleFloralSleeveTexture(outfit: OutfitId): THREE.CanvasTexture {
  const existing = cachedFemaleFloralSleeveTextures.get(outfit);
  if (existing) return existing;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const bg =
      outfit === 'female_black'
        ? '#161720'
        : outfit === 'female_red'
          ? '#b91c24'
          : '#f8fafc';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    const primaryFlower =
      outfit === 'female_black'
        ? '#e11d48'
        : outfit === 'female_red'
          ? '#f8fafc'
          : '#dc2626';
    const secondaryFlower =
      outfit === 'female_black'
        ? '#f8fafc'
        : outfit === 'female_red'
          ? '#fde047'
          : '#eab308';

    const blossoms: Array<[number, number, number, string]> = [
      [28, 30, 11, primaryFlower],
      [88, 26, 9, secondaryFlower],
      [62, 68, 12, primaryFlower],
      [22, 98, 9, secondaryFlower],
      [102, 94, 11, primaryFlower],
    ];
    for (const [bx, by, r, col] of blossoms) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = col;
      for (let p = 0; p < 5; p++) {
        ctx.rotate((Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(0, r * 0.56, r * 0.34, r * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cachedFemaleFloralSleeveTextures.set(outfit, tex);
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
  outfit: OutfitId = 'default',
): THREE.Group {
  const armGroup = new THREE.Group();
  const isMale = gender === 'male';
  const activeOutfitId: OutfitId = isOutfitCompatibleWithGender(outfit, gender)
    ? outfit
    : 'default';
  const isCustomOutfit = activeOutfitId !== 'default';
  const outfitInfo = OUTFITS[activeOutfitId] ?? OUTFITS.default;
  const isFemaleFloral =
    !isMale &&
    (activeOutfitId === 'female_black' ||
      activeOutfitId === 'female_red' ||
      activeOutfitId === 'female_white');

  const skinMat = new THREE.MeshStandardMaterial({
    color: isMale ? '#f3dfd0' : '#fcebe3',
    roughness: isMale ? 0.56 : 0.42,
    metalness: 0.02,
  });
  const sleeveOuterMat = new THREE.MeshPhysicalMaterial({
    map: isFemaleFloral
      ? getFemaleFloralSleeveTexture(activeOutfitId)
      : getSleeveWeaveTexture(),
    color: isFemaleFloral
      ? '#ffffff'
      : isMale
        ? outfitInfo.sleeveColor
        : '#f472b6',
    roughness: isFemaleFloral ? 0.45 : 0.68,
    metalness: 0.04,
    sheen: 0.48,
    sheenRoughness: 0.52,
    sheenColor: new THREE.Color(
      isCustomOutfit || isMale ? outfitInfo.sleeveSheen : '#fce7f3',
    ),
  });
  const sleeveInnerMat = new THREE.MeshPhysicalMaterial({
    color: isCustomOutfit || isMale ? outfitInfo.cuffColor : '#dc2626',
    roughness: 0.42,
    metalness: 0.08,
    sheen: 0.5,
    sheenColor: new THREE.Color(
      isCustomOutfit || isMale ? outfitInfo.cuffSheen : '#fca5a5',
    ),
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#1f1b24',
    roughness: 0.62,
    metalness: 0.08,
  });
  handles.materials.push(skinMat, sleeveOuterMat, sleeveInnerMat, gloveMat);

  // Tỷ lệ cứng cáp (Nam) vs mềm mỏng (Nữ) + bắp tay trên nối dài tới vai để không bị hở khi vung rộng
  const forearmLen = isMale ? 0.36 : 0.34;
  const upperArmLen = isMale ? 0.34 : 0.32;
  const wristRadius = isMale ? 0.036 : 0.023;
  const elbowRadius = isMale ? 0.052 : 0.034;
  const shoulderRadius = isMale ? 0.064 : 0.044;
  const sleeveFrontOffset = isMale ? 0.2 : 0.22;
  const totalSleeveLen = upperArmLen + sleeveFrontOffset + 0.1;
  const sleeveFlare = isMale ? 1.16 : 1.38;

  // Chuỗi 4 xương thực: Vai (gắn thân) -> Khuỷu -> Giữa cẳng tay (xoắn cổ tay) -> Cổ tay
  const shoulderBone = new THREE.Bone();
  shoulderBone.name = 'arm_shoulder';
  shoulderBone.position.set(0, -forearmLen - upperArmLen, -0.04);

  const elbowBone = new THREE.Bone();
  elbowBone.name = 'arm_elbow';
  elbowBone.position.set(0, upperArmLen, 0.04); // Ở tư thế nghỉ: (0, -forearmLen, 0)

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

  // 1a. Bắp tay trên nối liền từ vai tới qua khuỷu tay để khi vung rộng không bao giờ lộ đầu cụt
  const upperArmSpan = upperArmLen + 0.12;
  const upperArmGeo = createParabolicLatheGeometry(
    upperArmSpan,
    1,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      const smooth = t * t * (3 - 2 * t);
      return shoulderRadius + (elbowRadius * 0.96 - shoulderRadius) * smooth;
    },
    20,
    24,
    false,
  );
  upperArmGeo.translate(0, -forearmLen - upperArmLen - 0.08, -0.02);
  applyAxisSkinWeights(upperArmGeo, 'y', [
    { boneIndex: 0, pos: -forearmLen - upperArmLen, blendWidth: 0.2 },
    { boneIndex: 1, pos: -forearmLen + 0.01, blendWidth: 0.16 },
  ]);
  handles.geometries.push(upperArmGeo);
  bindSkinnedMeshToSkeleton(upperArmGeo, skinMat, skeleton, armGroup, false);

  // 1b. Cẳng tay parabol chia dày vòng dọc (30 segments) + skinWeight rộng mượt qua khuỷu & cổ tay
  const forearmSpan = forearmLen + 0.05;
  const forearmGeo = createParabolicLatheGeometry(
    forearmSpan,
    1,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      const base = elbowRadius + (wristRadius - elbowRadius) * (t * t * (3 - 2 * t));
      const muscleBulge = isMale ? Math.sin(t * Math.PI) * 0.007 : Math.sin(t * Math.PI) * 0.0025;
      return base + muscleBulge;
    },
    22,
    30,
    false,
  );
  forearmGeo.translate(0, -forearmLen - 0.05, 0);
  applyAxisSkinWeights(forearmGeo, 'y', [
    { boneIndex: 0, pos: -forearmLen - 0.14, blendWidth: 0.14 },
    { boneIndex: 1, pos: -forearmLen, blendWidth: 0.16 },
    { boneIndex: 2, pos: -forearmLen * 0.5, blendWidth: 0.18 },
    { boneIndex: 3, pos: 0, blendWidth: 0.12 },
  ]);
  handles.geometries.push(forearmGeo);
  bindSkinnedMeshToSkeleton(forearmGeo, skinMat, skeleton, armGroup, false);

  // 2. Tay áo kimono phủ liền từ vai qua khuỷu tới cẳng tay, skin mềm mượt không gãy góc
  const sleeveStartY = -forearmLen - upperArmLen - 0.1;
  const sleeveEndY = -forearmLen + sleeveFrontOffset;
  const elbowRatio = (-forearmLen - sleeveStartY) / totalSleeveLen;
  const sleeveGeo = createParabolicLatheGeometry(
    totalSleeveLen,
    1,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      const mouthBase = wristRadius + (isMale ? 0.017 : 0.025);
      if (t >= elbowRatio) {
        const frontT = (t - elbowRatio) / Math.max(0.01, 1 - elbowRatio);
        return mouthBase * (1 + (1 - frontT) * (sleeveFlare - 1));
      }
      const backT = t / Math.max(0.01, elbowRatio);
      const backSmooth = backT * backT * (3 - 2 * backT);
      const shoulderSleeveR = shoulderRadius + (isMale ? 0.022 : 0.026);
      const elbowSleeveR = mouthBase * sleeveFlare;
      return shoulderSleeveR + (elbowSleeveR - shoulderSleeveR) * backSmooth;
    },
    22,
    28,
    false,
  );
  sleeveGeo.translate(0, sleeveStartY, 0);
  applyAxisSkinWeights(sleeveGeo, 'y', [
    { boneIndex: 0, pos: -forearmLen - upperArmLen + 0.02, blendWidth: 0.2 },
    { boneIndex: 1, pos: -forearmLen + 0.01, blendWidth: 0.18 },
    { boneIndex: 2, pos: sleeveEndY - 0.02, blendWidth: 0.14 },
  ]);
  handles.geometries.push(sleeveGeo);
  bindSkinnedMeshToSkeleton(sleeveGeo, sleeveOuterMat, skeleton, armGroup, false);

  const cuffTrimGeo = new THREE.TorusGeometry(
    wristRadius + (isMale ? 0.017 : 0.024),
    isCustomOutfit ? 0.009 : isMale ? 0.006 : 0.0055,
    10,
    22,
  );
  cuffTrimGeo.rotateX(Math.PI / 2);
  cuffTrimGeo.translate(0, sleeveEndY - 0.004, 0);
  applyAxisSkinWeights(cuffTrimGeo, 'y', [
    { boneIndex: 1, pos: -forearmLen + 0.01, blendWidth: 0.14 },
    { boneIndex: 2, pos: sleeveEndY - 0.02, blendWidth: 0.14 },
  ]);
  handles.geometries.push(cuffTrimGeo);
  bindSkinnedMeshToSkeleton(cuffTrimGeo, sleeveInnerMat, skeleton, armGroup, false);

  if (isCustomOutfit) {
    const accentTrimMat = new THREE.MeshStandardMaterial({
      color: outfitInfo.accentTrimColor,
      roughness: 0.42,
      metalness: outfitInfo.accentTrimColor === '#eab308' || outfitInfo.accentTrimColor === '#facc15' ? 0.65 : 0.1,
    });
    handles.materials.push(accentTrimMat);

    const accentTrimGeo = new THREE.TorusGeometry(
      wristRadius + (isMale ? 0.018 : 0.0255),
      0.005,
      10,
      22,
    );
    accentTrimGeo.rotateX(Math.PI / 2);
    accentTrimGeo.translate(0, sleeveEndY - 0.018, 0);
    applyAxisSkinWeights(accentTrimGeo, 'y', [
      { boneIndex: 1, pos: -forearmLen + 0.01, blendWidth: 0.14 },
      { boneIndex: 2, pos: sleeveEndY - 0.02, blendWidth: 0.14 },
    ]);
    handles.geometries.push(accentTrimGeo);
    bindSkinnedMeshToSkeleton(accentTrimGeo, accentTrimMat, skeleton, armGroup, false);
  }

  // 3. Bàn tay & các ngón tay gắn trực tiếp vào xương cổ tay (wristBone)
  const handPivot = new THREE.Group();
  handPivot.position.set(0, 0.01, 0);
  wristBone.add(handPivot);

  const palmW = isMale ? 0.078 : 0.056;
  const palmH = isMale ? 0.088 : 0.074;
  const palmD = isMale ? 0.046 : 0.032;
  const palmGeo = createParabolicEllipsoidGeometry(palmW, palmH, palmD, 14, 10);
  handles.geometries.push(palmGeo);

  const palmMesh = new THREE.Mesh(palmGeo, isMale ? skinMat : gloveMat);
  palmMesh.position.set(0, 0.036, mode === 'katana' ? 0.014 : 0.006);
  handPivot.add(palmMesh);

  // 4 ngón tay cong ôm vào tay cầm + ngón cái giữ phía trên
  const fingerGroup = new THREE.Group();
  handPivot.add(fingerGroup);

  const fingerLen = mode === 'katana' ? (isMale ? 0.076 : 0.064) : isMale ? 0.068 : 0.056;
  const fingerR = isMale ? 0.0115 : 0.0078;
  const fingerGeo = new THREE.CapsuleGeometry(fingerR, fingerLen * 0.56, 4, 8);
  const thumbGeo = new THREE.CapsuleGeometry(fingerR * 1.15, fingerLen * 0.44, 4, 8);
  handles.geometries.push(fingerGeo, thumbGeo);

  const sideSign = side === 'right' ? 1 : -1;
  if (mode === 'katana') {
    for (let i = 0; i < 4; i++) {
      const fMesh = new THREE.Mesh(fingerGeo, skinMat);
      const offsetY = 0.006 + i * (isMale ? 0.02 : 0.016);
      fMesh.position.set(-sideSign * (palmW * 0.24), offsetY, -palmD * 0.56);
      fMesh.rotation.set(0.32, 0, -sideSign * 1.32);
      fingerGroup.add(fMesh);
    }

    const thumbMesh = new THREE.Mesh(thumbGeo, skinMat);
    thumbMesh.position.set(sideSign * (palmW * 0.34), 0.064, -palmD * 0.42);
    thumbMesh.rotation.set(-0.32, 0, sideSign * 0.42);
    fingerGroup.add(thumbMesh);
  } else {
    for (let i = 0; i < 4; i++) {
      const fMesh = new THREE.Mesh(fingerGeo, skinMat);
      const offsetY = 0.006 + i * (isMale ? 0.02 : 0.0155);
      fMesh.position.set(sideSign * (palmW * 0.42), offsetY, -palmD * 0.55);
      fMesh.rotation.set(0.45, 0, sideSign * 1.15);
      fingerGroup.add(fMesh);
    }

    const thumbMesh = new THREE.Mesh(thumbGeo, skinMat);
    thumbMesh.position.set(-sideSign * (palmW * 0.36), 0.066, -palmD * 0.45);
    thumbMesh.rotation.set(-0.55, 0, -sideSign * 0.72);
    fingerGroup.add(thumbMesh);
  }

  // Căn chỉnh hướng cánh tay theo từng loại vật phẩm cầm trên tay (SAU khi đã bind Skeleton ở tư thế nghỉ)
  if (mode === 'katana') {
    if (side === 'right') {
      armGroup.position.set(0.032, 0.155, 0.018);
      armGroup.rotation.set(-0.28, -0.45, 0.52);
      handPivot.position.set(-0.008, 0.004, -0.006);
      handPivot.rotation.set(0.16, 0.24, -0.42);
    } else {
      armGroup.position.set(-0.026, 0.048, 0.018);
      armGroup.rotation.set(-0.34, 0.48, -0.58);
      handPivot.position.set(0.008, 0.004, -0.006);
      handPivot.rotation.set(0.18, -0.26, 0.44);
    }
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
    fingerGroup,
    skeleton,
    basePosition: armGroup.position.clone(),
    baseRotation: armGroup.rotation.clone(),
  };
  armGroup.userData.armRig = armRig;

  return armGroup;
}
