import * as THREE from 'three';
import { createParabolicEllipsoidGeometry, createParabolicLatheGeometry } from './parabolic';

export type CharacterGender = 'male' | 'female';

export interface FirstPersonArmHandles {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

export type ArmHoldMode = 'katana' | 'shield' | 'potion';

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
 * Tạo cánh tay + cổ tay + bàn tay góc nhìn thứ nhất khớp giới tính nhân vật:
 * - Nam ('male'): Cánh tay cứng cáp, cơ bắp khỏe khoắn, bàn tay rộng cầm chắc chắn, tay áo kimono ngà viền đỏ.
 * - Nữ ('female'): Cánh tay mềm mỏng, thon gọn thanh thoát, găng tay hở ngón tối màu, tay áo kimono trắng rộng viền đỏ.
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

  // 1. Cẳng tay parabol (trục Y từ khuỷu y = -forearmLen lên cổ tay y = 0)
  const forearmGeo = createParabolicLatheGeometry(
    forearmLen,
    1,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      const base = elbowRadius + (wristRadius - elbowRadius) * (t * t * (3 - 2 * t));
      const muscleBulge = isMale ? Math.sin(t * Math.PI) * 0.007 : Math.sin(t * Math.PI) * 0.002;
      return base + muscleBulge;
    },
    16,
    12,
    false,
  );
  forearmGeo.translate(0, -forearmLen, 0);
  handles.geometries.push(forearmGeo);

  const forearmMesh = new THREE.Mesh(forearmGeo, skinMat);
  armGroup.add(forearmMesh);

  // 2. Tay áo kimono phủ phần cẳng tay sau gọn gàng với viền lót đỏ
  const sleeveLen = isMale ? 0.22 : 0.24;
  const sleeveFlare = isMale ? 1.15 : 1.38;
  const sleeveGeo = createParabolicLatheGeometry(
    sleeveLen,
    1,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      const mouthR = (wristRadius + (isMale ? 0.016 : 0.024)) * (1 + (1 - t) * (sleeveFlare - 1));
      return mouthR;
    },
    16,
    10,
    false,
  );
  sleeveGeo.translate(0, -forearmLen - 0.02, 0);
  handles.geometries.push(sleeveGeo);
  const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveOuterMat);
  armGroup.add(sleeveMesh);

  const cuffTrimGeo = new THREE.TorusGeometry(
    wristRadius + (isMale ? 0.016 : 0.024),
    isMale ? 0.006 : 0.0055,
    8,
    18,
  );
  cuffTrimGeo.rotateX(Math.PI / 2);
  handles.geometries.push(cuffTrimGeo);
  const cuffTrim = new THREE.Mesh(cuffTrimGeo, sleeveInnerMat);
  cuffTrim.position.set(0, -forearmLen + sleeveLen - 0.022, 0);
  armGroup.add(cuffTrim);

  // 3. Bàn tay & các ngón tay ôm quanh vật phẩm
  const handPivot = new THREE.Group();
  handPivot.position.set(0, 0.01, 0);
  armGroup.add(handPivot);

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

  // Căn chỉnh hướng cánh tay theo từng loại vật phẩm cầm trên tay
  if (mode === 'katana') {
    // Nắm quanh tsuka (y từ ~0.04 đến 0.16) với cẳng tay hướng chéo từ góc phải-dưới lên
    armGroup.position.set(0.012, 0.095, -0.006);
    armGroup.rotation.set(0.42, 0.18, -0.34);
  } else if (mode === 'shield') {
    // Tay trái giữ mặt sau khiên (z < -0.04)
    armGroup.position.set(-0.04, 0.01, -0.058);
    armGroup.rotation.set(-0.48, -0.26, 0.42);
  } else {
    // Tay phải nâng bình thuốc hồi máu
    armGroup.position.set(0.02, 0.12, 0.015);
    armGroup.rotation.set(0.46, 0.14, -0.28);
  }

  return armGroup;
}
