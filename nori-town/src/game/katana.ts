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
export const ICE_KATANA_SLOW_MULTIPLIER = 0.8; // Giảm 20% tốc độ di chuyển & hoạt ảnh kẻ địch
export const ICE_KATANA_SLOW_DURATION = 4.0; // Thời gian duy trì hiệu ứng làm chậm (giây)

export interface KatanaStatInfo {
  variant: KatanaVisualVariant;
  name: string;
  damage: number;
  damageBonusText: string;
  summaryText: string;
  effects: string[];
}

export function getKatanaDamage(variant: KatanaVisualVariant | null): number {
  switch (variant) {
    case 'leaf':
      return Math.round(BASE_KATANA_DAMAGE * 1.2); // 120 (+20% so với kiếm thường)
    case 'ice':
      return Math.round(BASE_KATANA_DAMAGE * 1.5); // 150 (+50% so với kiếm thường)
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

export function getKatanaStatInfo(variant: KatanaVisualVariant): KatanaStatInfo {
  const damage = getKatanaDamage(variant);
  switch (variant) {
    case 'ice':
      return {
        variant,
        name: 'Katana Băng',
        damage,
        damageBonusText: '+50% sát thương',
        summaryText: `${damage} sát thương (+50%) · Làm chậm kẻ địch 20%`,
        effects: [
          `Sát thương: ${damage} (+50% so với Katana thường)`,
          'Khi đánh trúng kẻ địch: làm chậm 20% tốc độ di chuyển & hoạt ảnh trong 4 giây',
          'Chặt đổ cây chỉ với 1 nhát chém',
        ],
      };
    case 'leaf':
      return {
        variant,
        name: 'Kiếm Lá',
        damage,
        damageBonusText: '+20% sát thương',
        summaryText: `${damage} sát thương (+20%) · +20% tốc chạy`,
        effects: [
          `Sát thương: ${damage} (+20% so với Katana thường)`,
          'Tăng +20% tốc độ di chuyển khi trang bị',
          'Chặt đổ cây chỉ với 1 nhát chém',
        ],
      };
    case 'crimson':
      return {
        variant,
        name: 'Katana Huyết',
        damage,
        damageBonusText: 'Sát thương chuẩn',
        summaryText: `${damage} sát thương · Kiếm tiêu chuẩn`,
        effects: [
          `Sát thương: ${damage} (tiêu chuẩn)`,
          'Chặt đổ cây chỉ với 1 nhát chém',
        ],
      };
    default:
      return {
        variant: 'normal',
        name: 'Katana',
        damage,
        damageBonusText: 'Sát thương chuẩn',
        summaryText: `${damage} sát thương · Kiếm tiêu chuẩn`,
        effects: [
          `Sát thương: ${damage} (tiêu chuẩn)`,
          'Chặt đổ cây chỉ với 1 nhát chém',
        ],
      };
  }
}

function drawSixPointSnowflake(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  lineWidth = 1.4,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cos * radius, sin * radius);
    ctx.stroke();

    const bx = cos * radius * 0.56;
    const by = sin * radius * 0.56;
    const branchLen = radius * 0.34;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(angle + 0.65) * branchLen, by + Math.sin(angle + 0.65) * branchLen);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(angle - 0.65) * branchLen, by + Math.sin(angle - 0.65) * branchLen);
    ctx.stroke();
  }
  ctx.restore();
}

function createIceBladeTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Nền lưỡi băng chuyển sắc xanh lam pha lê -> trắng tuyết ở mép cắt
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1d6fb8');
  grad.addColorStop(0.45, '#4ebef7');
  grad.addColorStop(0.82, '#a8e3ff');
  grad.addColorStop(1, '#e8f8ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Vệt sáng cạnh lưỡi sắc bén ở mép trên/dưới
  const edgeGrad = ctx.createLinearGradient(0, 0, 0, h);
  edgeGrad.addColorStop(0, 'rgba(224, 247, 255, 0.85)');
  edgeGrad.addColorStop(0.28, 'rgba(56, 189, 248, 0.15)');
  edgeGrad.addColorStop(0.75, 'rgba(14, 116, 194, 0.28)');
  edgeGrad.addColorStop(1, 'rgba(240, 251, 255, 0.92)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, w, h);

  // Vết nứt băng pha lê dọc theo sống lưỡi
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.lineWidth = 1.4;
  const cracks: Array<Array<[number, number]>> = [
    [[26, 22], [58, 30], [92, 19], [128, 34], [164, 23], [202, 31], [238, 21]],
    [[48, 44], [84, 33], [116, 46], [154, 32], [190, 44], [224, 33]],
    [[72, 26], [90, 40], [108, 49]],
    [[140, 14], [158, 28], [176, 42]],
    [[188, 18], [206, 36]],
  ];
  for (const pts of cracks) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();
  }

  // Hoa văn băng & ký tự rune cổ gần gốc lưỡi
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.86)';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 4; i++) {
    const rx = 20 + i * 16;
    ctx.beginPath();
    ctx.moveTo(rx, 24);
    ctx.lineTo(rx + 4, 36);
    ctx.lineTo(rx + 8, 26);
    ctx.moveTo(rx + 4, 21);
    ctx.lineTo(rx + 4, 41);
    ctx.stroke();
  }

  // Bông tuyết tinh thể dọc nửa ngoài lưỡi kiếm
  drawSixPointSnowflake(ctx, 132, 32, 8.5, 'rgba(240, 249, 255, 0.9)', 1.2);
  drawSixPointSnowflake(ctx, 186, 28, 7.5, 'rgba(255, 255, 255, 0.92)', 1.1);
  drawSixPointSnowflake(ctx, 224, 34, 6.5, 'rgba(255, 255, 255, 0.95)', 1.0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createIceHiltWrapTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Nền lớp lót trắng bạc mờ bên dưới dây quấn
  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(0, 0, w, h);

  // Vẩy lấm tấm ánh băng trên lớp lót
  ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  for (let y = 4; y < h; y += 8) {
    for (let x = 4; x < w; x += 8) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Dải quấn Tsuka-ito xanh navy đậm đan chéo tạo các ô hình thoi trắng băng
  ctx.strokeStyle = '#132a57';
  ctx.lineWidth = 10;
  for (let offset = -h; offset <= w + h; offset += 24) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + h, h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset + h, 0);
    ctx.lineTo(offset, h);
    ctx.stroke();
  }

  // Viền chỉ sáng mảnh dọc mép dây quấn
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
  ctx.lineWidth = 1.5;
  for (let offset = -h; offset <= w + h; offset += 24) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + h, h);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  return tex;
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

  // Chuẩn hóa UV dọc theo chiều dài lưỡi (u: 0..1) và chiều rộng lưỡi (v: 0..1)
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute;
  if (posAttr && uvAttr) {
    for (let i = 0; i < posAttr.count; i++) {
      const py = posAttr.getY(i);
      const pz = posAttr.getZ(i);
      const u = THREE.MathUtils.clamp(py / Math.max(0.01, length + 0.06), 0, 1);
      const v = THREE.MathUtils.clamp((pz + width * 0.55) / Math.max(0.01, width * 1.25), 0, 1);
      uvAttr.setXY(i, u, v);
    }
    uvAttr.needsUpdate = true;
  }

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

  const iceWrapTex = iceMode ? createIceHiltWrapTexture() : null;
  if (iceWrapTex && handles.textures) {
    handles.textures.push(iceWrapTex);
  }

  const hiltMat = new THREE.MeshStandardMaterial({
    color: iceMode ? '#ffffff' : leafMode ? '#e7dfd0' : '#18181b',
    map: iceWrapTex ?? undefined,
    roughness: iceMode ? 0.62 : 0.74,
    metalness: 0.14,
  });
  const wrapMat = new THREE.MeshStandardMaterial({
    color: iceMode ? '#1e3a8a' : crimsonMode || leafMode ? '#991b1b' : '#b45309',
    roughness: 0.74,
    metalness: 0.14,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: iceMode ? '#cbd5e1' : leafMode ? '#d4af37' : '#eab308',
    emissive: iceMode ? '#0284c7' : '#000000',
    emissiveIntensity: iceMode ? 0.22 : 0,
    roughness: iceMode ? 0.22 : 0.24,
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

  if (iceMode) {
    // Đỉnh chuôi kiếm vương miện tinh thể băng + các nhũ băng rủ dưới chuôi giống mẫu
    const icicleMat = new THREE.MeshPhysicalMaterial({
      color: '#bae6fd',
      emissive: '#38bdf8',
      emissiveIntensity: 0.48,
      roughness: 0.1,
      metalness: 0.15,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
    });
    handles.materials.push(icicleMat);

    const crownSpikeGeo = new THREE.ConeGeometry(0.0085, 0.042, 5);
    handles.geometries.push(crownSpikeGeo);
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(crownSpikeGeo, icicleMat);
      spike.position.set(Math.cos(a) * 0.016, -0.014, Math.sin(a) * 0.016);
      spike.rotation.set(Math.PI + Math.sin(a) * 0.48, 0, -Math.cos(a) * 0.48);
      group.add(spike);
    }
    const centerCrown = new THREE.Mesh(crownSpikeGeo, icicleMat);
    centerCrown.position.set(0, -0.022, 0);
    centerCrown.rotation.x = Math.PI;
    centerCrown.scale.set(1.15, 1.35, 1.15);
    group.add(centerCrown);

    // Nhũ băng rủ dọc mép dưới tay cầm
    const hiltIcicleGeo = new THREE.ConeGeometry(0.0055, 0.048, 5);
    handles.geometries.push(hiltIcicleGeo);
    const icicleOffsets = [0.035, 0.085, 0.16];
    icicleOffsets.forEach((iy, idx) => {
      const icicle = new THREE.Mesh(hiltIcicleGeo, icicleMat);
      icicle.position.set(0, iy, -0.036);
      icicle.rotation.x = -Math.PI * 0.56;
      const sc = idx === 0 ? 1.25 : idx === 1 ? 0.95 : 0.8;
      icicle.scale.set(sc, sc, sc);
      group.add(icicle);
    });

    // Dây đan nổi xanh navy đậm ôm tay cầm
    const ringGeo = new THREE.TorusGeometry(0.0225, 0.0038, 6, 14);
    ringGeo.rotateX(Math.PI / 2);
    handles.geometries.push(ringGeo);
    for (let i = 0; i < 6; i++) {
      const wrapRing = new THREE.Mesh(ringGeo, wrapMat);
      wrapRing.position.set(0, 0.048 + i * 0.032, 0);
      wrapRing.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.25;
      group.add(wrapRing);
    }

    // Chắn tay (Tsuba) hình bông tuyết 6 cánh bằng tinh thể băng + nhũ băng rủ
    const guardCoreGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.014, 12);
    const snowflakeArmGeo = new THREE.OctahedronGeometry(0.028, 0);
    const snowflakeTipGeo = new THREE.ConeGeometry(0.008, 0.032, 5);
    handles.geometries.push(guardCoreGeo, snowflakeArmGeo, snowflakeTipGeo);

    const guardCore = new THREE.Mesh(guardCoreGeo, guardMat);
    guardCore.position.set(0, 0.245, 0);
    group.add(guardCore);

    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const arm = new THREE.Mesh(snowflakeArmGeo, icicleMat);
      arm.position.set(Math.cos(ang) * 0.048, 0.245, Math.sin(ang) * 0.048);
      arm.rotation.y = -ang;
      arm.scale.set(1.18, 0.34, 0.52);
      group.add(arm);

      const tip = new THREE.Mesh(snowflakeTipGeo, icicleMat);
      tip.position.set(Math.cos(ang) * 0.072, 0.245, Math.sin(ang) * 0.072);
      tip.rotation.set(0, -ang, -Math.PI / 2);
      group.add(tip);
    }

    // Nhũ băng rủ dưới chắn tay
    const guardDropLeft = new THREE.Mesh(hiltIcicleGeo, icicleMat);
    guardDropLeft.position.set(0.018, 0.24, -0.068);
    guardDropLeft.rotation.x = -Math.PI * 0.52;
    guardDropLeft.scale.set(1.2, 1.35, 1.2);
    group.add(guardDropLeft);

    const guardDropRight = new THREE.Mesh(hiltIcicleGeo, icicleMat);
    guardDropRight.position.set(-0.018, 0.24, -0.062);
    guardDropRight.rotation.x = -Math.PI * 0.52;
    guardDropRight.scale.set(1.0, 1.1, 1.0);
    group.add(guardDropRight);

    // Khâu kiếm (Habaki) chạm bạc băng với viên ngọc thoi xanh phát sáng chính giữa
    const habakiGeo = new THREE.BoxGeometry(0.018, 0.044, 0.042);
    const gemGeo = new THREE.OctahedronGeometry(0.011, 0);
    const gemMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: '#38bdf8',
      emissiveIntensity: 1.65,
      roughness: 0.08,
      metalness: 0.2,
    });
    handles.geometries.push(habakiGeo, gemGeo);
    handles.materials.push(gemMat);

    const habaki = new THREE.Mesh(habakiGeo, guardMat);
    habaki.position.set(0, 0.273, 0);
    group.add(habaki);

    const gemL = new THREE.Mesh(gemGeo, gemMat);
    gemL.position.set(0.01, 0.273, 0);
    gemL.scale.set(0.35, 1.2, 0.72);
    group.add(gemL);

    const gemR = new THREE.Mesh(gemGeo, gemMat);
    gemR.position.set(-0.01, 0.273, 0);
    gemR.scale.set(0.35, 1.2, 0.72);
    group.add(gemR);
  } else {
    // Dải quấn tsuka hình thoi mềm mại cho các kiếm khác
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
  }

  if (!sheathed) {
    const iceBladeTex = iceMode ? createIceBladeTexture() : null;
    if (iceBladeTex && handles.textures) {
      handles.textures.push(iceBladeTex);
    }

    const bladeMat = iceMode
      ? new THREE.MeshPhysicalMaterial({
          color: '#d8f3ff',
          map: iceBladeTex ?? undefined,
          emissive: '#38bdf8',
          emissiveMap: iceBladeTex ?? undefined,
          emissiveIntensity: 0.72,
          roughness: 0.08,
          metalness: 0.35,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
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
      color: iceMode ? '#7dd3fc' : leafMode ? '#14532d' : crimsonMode ? '#27272a' : '#64748b',
      emissive: iceMode ? '#0284c7' : '#000000',
      emissiveIntensity: iceMode ? 0.35 : 0,
      roughness: 0.22,
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

  // Hiệu ứng tinh thể & luồng sương băng phát sáng cho Katana Băng hoặc Crimson
  if (iceMode || crimsonMode) {
    const glowMat = new THREE.MeshStandardMaterial({
      color: iceMode ? '#e0f2fe' : '#ffe4e6',
      emissive: iceMode ? '#7dd3fc' : '#fb7185',
      emissiveIntensity: iceMode ? 1.45 : 1.25,
      roughness: 0.12,
      metalness: 0.2,
    });
    handles.materials.push(glowMat);

    if (crimsonMode) {
      const crystalGeo = new THREE.OctahedronGeometry(0.032, 1);
      handles.geometries.push(crystalGeo);
      const crystal = new THREE.Mesh(crystalGeo, glowMat);
      crystal.position.set(0, 0.255, 0.044);
      crystal.scale.set(0.72, 1.25, 0.72);
      group.add(crystal);
    }

    if (!sheathed) {
      const edgeGlowGeo = createCurvedBladeGeometry(0.68, 0.011, 0.004, -0.044);
      handles.geometries.push(edgeGlowGeo);
      const edgeGlow = new THREE.Mesh(edgeGlowGeo, glowMat);
      edgeGlow.position.set(0, 0.254, -0.016);
      group.add(edgeGlow);

      if (iceMode) {
        // Màn sương băng mờ bao quanh lưỡi kiếm giống mẫu
        const mistMat = new THREE.MeshBasicMaterial({
          color: '#7dd3fc',
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        handles.materials.push(mistMat);
        const mistGeo = createCurvedBladeGeometry(0.71, 0.056, 0.016, -0.046);
        handles.geometries.push(mistGeo);
        const mist = new THREE.Mesh(mistGeo, mistMat);
        mist.position.set(0, 0.252, -0.002);
        group.add(mist);
      }
    }
  }

  return group;
}

function createSlashCrescentGeometry(): THREE.BufferGeometry {
  const segments = 32;
  const arcSpan = Math.PI * 0.98;
  const startAngle = -arcSpan * 0.5;
  const innerR = 0.48;
  const maxWidth = 0.19;

  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + arcSpan * t;
    const taper = Math.sin(t * Math.PI);
    const width = maxWidth * Math.pow(taper, 0.65);
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

interface SmoothedArmPose {
  shoulder: THREE.Vector3;
  elbow: THREE.Vector3;
  forearm: THREE.Vector3;
  wrist: THREE.Vector3;
  fingerCurl: number;
}

function createEmptyArmPose(): SmoothedArmPose {
  return {
    shoulder: new THREE.Vector3(),
    elbow: new THREE.Vector3(),
    forearm: new THREE.Vector3(),
    wrist: new THREE.Vector3(),
    fingerCurl: 0,
  };
}

function quinticEase(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

export class KatanaViewModel {
  private readonly scene: THREE.Scene;
  private group: THREE.Group;
  private armRig: FirstPersonArmRig | null = null;
  private leftArmGroup: THREE.Group | null = null;
  private leftArmRig: FirstPersonArmRig | null = null;
  private slashArcMesh: THREE.Mesh | null = null;
  private slashArcMat: THREE.MeshBasicMaterial | null = null;

  private assets: KatanaAssetHandles = { geometries: [], materials: [], textures: [], skeletons: [] };
  private variant: KatanaVisualVariant = 'normal';
  private gender: CharacterGender = 'male';
  private outfit: OutfitId = 'default';

  private readonly idleOffset = new THREE.Vector3(0.05, -0.34, -0.49);
  private readonly slashOffset = new THREE.Vector3();
  private readonly currentViewOffset = new THREE.Vector3();
  private readonly currentViewRot = new THREE.Vector3();
  private readonly rightPose = createEmptyArmPose();
  private readonly targetRightPose = createEmptyArmPose();
  private readonly leftPose = createEmptyArmPose();
  private readonly targetLeftPose = createEmptyArmPose();

  private readonly tempLocalPos = new THREE.Vector3();
  private readonly tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly tempLocalQuat = new THREE.Quaternion();
  private readonly tempArcOffset = new THREE.Vector3(0, -0.04, -0.78);
  private readonly tempArcEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly tempArcQuat = new THREE.Quaternion();

  private isSlashing = false;
  private slashElapsed = 0;
  private readonly slashDuration = 0.39;
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
      // Gắn cả tay phải lẫn tay trái vào viewRoot (neo chặt tại vai) để tay trái không bị kéo rời khỏi vai khi vung rộng
      viewRoot.add(arm, leftArm);
    } else {
      viewRoot.add(katana, arm, leftArm);
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
    if (this.assets.textures) {
      for (const tex of this.assets.textures) {
        tex.dispose();
      }
      this.assets.textures.length = 0;
    }
    this.assets.geometries.length = 0;
    this.assets.materials.length = 0;
  }

  triggerSlash(): void {
    if (this.isSlashing && this.slashElapsed < this.slashDuration * 0.52) {
      return;
    }
    this.comboIndex = this.nextComboIndex;
    this.nextComboIndex = (this.comboIndex + 1) % 3;
    this.comboResetTimer = 1.05;
    this.isSlashing = true;
    this.slashElapsed = 0;
  }

  private computeIdleBoneTargets(lagY: number, strideX: number): void {
    const breath = Math.sin(this.idleTime * 2.1);
    const sway = Math.cos(this.idleTime * 1.45);
    const elbowPhase = Math.sin(this.idleTime * 2.1 - 0.55);
    const wristPhase = Math.sin(this.idleTime * 2.1 - 1.1);

    this.targetRightPose.shoulder.set(breath * 0.016 + lagY * 0.22, 0, sway * 0.014);
    this.targetRightPose.elbow.set(0.03 + elbowPhase * 0.026 + lagY * 0.36, 0, -strideX * 0.35);
    this.targetRightPose.forearm.set(0, Math.sin(this.idleTime * 1.7) * 0.035, 0);
    this.targetRightPose.wrist.set(
      wristPhase * 0.026 + lagY * 0.58,
      -strideX * 0.32,
      strideX * 0.48,
    );
    this.targetRightPose.fingerCurl = breath * 0.03;

    this.targetLeftPose.shoulder.set(-breath * 0.014 + lagY * 0.16, 0, -sway * 0.012);
    this.targetLeftPose.elbow.set(0.02 - elbowPhase * 0.02 + lagY * 0.24, 0, strideX * 0.22);
    this.targetLeftPose.forearm.set(0, -Math.sin(this.idleTime * 1.7) * 0.024, 0);
    this.targetLeftPose.wrist.set(wristPhase * 0.016, 0, 0);
    this.targetLeftPose.fingerCurl = breath * 0.025;
  }

  private dampVec3(
    cur: THREE.Vector3,
    target: THREE.Vector3,
    lx: number,
    ly: number,
    lz: number,
    dt: number,
  ): void {
    cur.x = THREE.MathUtils.damp(cur.x, target.x, lx, dt);
    cur.y = THREE.MathUtils.damp(cur.y, target.y, ly, dt);
    cur.z = THREE.MathUtils.damp(cur.z, target.z, lz, dt);
  }

  private applyPoseToRig(rig: FirstPersonArmRig | null, pose: SmoothedArmPose): void {
    if (!rig) return;
    rig.shoulderBone.rotation.set(pose.shoulder.x, pose.shoulder.y, pose.shoulder.z);
    rig.elbowBone.rotation.set(pose.elbow.x, pose.elbow.y, pose.elbow.z);
    rig.forearmBone.rotation.set(pose.forearm.x, pose.forearm.y, pose.forearm.z);
    rig.wristBone.rotation.set(pose.wrist.x, pose.wrist.y, pose.wrist.z);
    rig.fingerGroup.rotation.set(pose.fingerCurl, 0, 0);
  }

  private resetSmoothedState(basePitch: number, baseYaw: number, baseRoll: number): void {
    this.currentViewOffset.set(0, 0, 0);
    this.currentViewRot.set(basePitch, baseYaw, baseRoll);
    this.rightPose.shoulder.set(0, 0, 0);
    this.rightPose.elbow.set(0, 0, 0);
    this.rightPose.forearm.set(0, 0, 0);
    this.rightPose.wrist.set(0, 0, 0);
    this.rightPose.fingerCurl = 0;
    this.leftPose.shoulder.set(0, 0, 0);
    this.leftPose.elbow.set(0, 0, 0);
    this.leftPose.forearm.set(0, 0, 0);
    this.leftPose.wrist.set(0, 0, 0);
    this.leftPose.fingerCurl = 0;
  }

  update(
    camera: THREE.Camera,
    dt: number,
    visible: boolean,
    motion?: { lagY: number; strideX: number; strideY: number },
    shieldRaised = false,
  ): void {
    const basePitch = this.gender === 'male' ? -0.58 : -0.54;
    const baseYaw = this.gender === 'male' ? -0.22 : -0.18;
    const baseRoll = this.gender === 'male' ? -0.46 : -0.42;

    if (!visible) {
      if (this.group.visible) {
        this.resetSmoothedState(basePitch, baseYaw, baseRoll);
      }
      this.group.visible = false;
      this.isSlashing = false;
      this.nextComboIndex = 0;
      if (this.slashArcMesh) this.slashArcMesh.visible = false;
      return;
    }

    const wasHidden = !this.group.visible;
    this.group.visible = true;
    if (wasHidden) {
      this.resetSmoothedState(basePitch, baseYaw, baseRoll);
    }

    if (this.leftArmGroup) {
      this.leftArmGroup.visible = !shieldRaised;
    }

    const safeDt = Math.min(dt, 0.05);
    this.idleTime += safeDt;
    if (!this.isSlashing && this.comboResetTimer > 0) {
      this.comboResetTimer -= safeDt;
      if (this.comboResetTimer <= 0) {
        this.nextComboIndex = 0;
      }
    }

    const lagY = motion?.lagY ?? 0;
    const strideX = motion?.strideX ?? 0;
    const strideY = motion?.strideY ?? 0;

    // Giữ viewRoot neo gọn quanh vai/ngực để cánh tay không bao giờ rời khỏi thân người
    let targetPitch = basePitch + lagY * 0.65;
    let targetYaw = baseYaw;
    let targetRoll = baseRoll - strideX * 0.85;
    this.slashOffset.set(strideX, lagY + strideY, 0);

    this.computeIdleBoneTargets(lagY, strideX);

    let arcOpacity = 0;
    let arcPlaneRoll = -0.45;
    let arcSweepZ = 0;
    let arcPitch = 0.16;

    if (this.isSlashing) {
      this.slashElapsed += safeDt;
      const t = Math.min(1, this.slashElapsed / this.slashDuration);

      const wEnd = 0.2;
      const sEnd = 0.56;

      if (this.comboIndex === 0) {
        // Đòn 1: Chém chéo phải -> trái biên độ rộng (xương vai dẫn động, tay bám sát vai)
        arcPlaneRoll = -0.42;
        if (t < wEnd) {
          const ease = quinticEase(t / wEnd);
          targetPitch += 0.12 * ease;
          targetYaw -= 0.1 * ease;
          targetRoll -= 0.12 * ease;
          this.slashOffset.set(strideX + 0.03 * ease, lagY + strideY + 0.035 * ease, 0.025 * ease);

          this.targetRightPose.shoulder.set(0.32 * ease, -0.3 * ease, -0.42 * ease);
          this.targetRightPose.elbow.set(0.38 * ease, 0, -0.16 * ease);
          this.targetRightPose.forearm.set(0, -0.46 * ease, 0);
          this.targetRightPose.wrist.set(0.36 * ease, 0.16 * ease, -0.34 * ease);
          this.targetRightPose.fingerCurl = 0.12 * ease;

          this.targetLeftPose.shoulder.set(0.14 * ease, -0.18 * ease, -0.14 * ease);
          this.targetLeftPose.elbow.set(0.24 * ease, 0, -0.1 * ease);
          this.targetLeftPose.forearm.set(0, -0.18 * ease, 0);
          this.targetLeftPose.wrist.set(0.16 * ease, 0, -0.12 * ease);
          this.targetLeftPose.fingerCurl = 0.1 * ease;
        } else if (t < sEnd) {
          const k = (t - wEnd) / (sEnd - wEnd);
          const swing = quinticEase(k);
          const wristEase = quinticEase((k - 0.1) / 0.9);

          targetPitch = basePitch + 0.12 - 0.34 * swing + lagY * 0.45;
          targetYaw = baseYaw - 0.1 + 0.26 * swing;
          targetRoll = baseRoll - 0.12 + 0.28 * swing;
          this.slashOffset.set(
            strideX + 0.03 - 0.09 * swing,
            lagY + strideY + 0.035 - 0.06 * swing,
            0.025 - 0.075 * swing,
          );

          this.targetRightPose.shoulder.set(
            0.32 - 0.86 * swing,
            -0.3 + 1.12 * swing,
            -0.42 + 0.98 * swing,
          );
          this.targetRightPose.elbow.set(0.38 - 0.72 * swing, 0, -0.16 + 0.42 * swing);
          this.targetRightPose.forearm.set(0, -0.46 + 1.38 * wristEase, 0);
          this.targetRightPose.wrist.set(
            0.36 - 1.32 * wristEase,
            0.16 + 0.26 * wristEase,
            -0.34 + 1.1 * wristEase,
          );
          this.targetRightPose.fingerCurl = 0.22 * Math.sin(k * Math.PI);

          // Tay trái thu về giữ thăng bằng bên vai trái
          this.targetLeftPose.shoulder.set(-0.18 * swing, -0.22 * swing, -0.26 * swing);
          this.targetLeftPose.elbow.set(0.32 * swing, 0, -0.14 * swing);
          this.targetLeftPose.forearm.set(0, 0.24 * swing, 0);
          this.targetLeftPose.wrist.set(-0.22 * swing, -0.14 * swing, 0.22 * swing);
          this.targetLeftPose.fingerCurl = -0.08 * swing;

          arcOpacity = Math.sin(k * Math.PI) * 0.58;
          arcSweepZ = 1.14 - 2.32 * swing;
        } else {
          const k = (t - sEnd) / (1 - sEnd);
          const ease = 1 - Math.pow(1 - k, 3);
          const spring = Math.sin(k * Math.PI) * 0.07;
          const inv = 1 - ease;

          targetPitch = basePitch - 0.22 * inv + lagY * 0.65;
          targetYaw = baseYaw + 0.16 * inv;
          targetRoll = baseRoll + 0.16 * inv;
          this.slashOffset.set(
            strideX - 0.06 * inv,
            lagY + strideY - 0.025 * inv,
            -0.05 * inv,
          );

          this.targetRightPose.shoulder.set(-0.54 * inv, 0.82 * inv, 0.56 * inv);
          this.targetRightPose.elbow.set(-0.34 * inv + spring * 0.5, 0, 0.26 * inv);
          this.targetRightPose.forearm.set(0, 0.92 * inv, 0);
          this.targetRightPose.wrist.set(-0.96 * inv - spring, 0.42 * inv, 0.76 * inv + spring * 0.6);
          this.targetRightPose.fingerCurl = -0.05 * Math.sin(k * Math.PI);

          this.targetLeftPose.shoulder.set(-0.18 * inv, -0.22 * inv, -0.26 * inv);
          this.targetLeftPose.elbow.set(0.32 * inv, 0, -0.14 * inv);
          this.targetLeftPose.forearm.set(0, 0.24 * inv, 0);
          this.targetLeftPose.wrist.set(-0.22 * inv, -0.14 * inv, 0.22 * inv);
          this.targetLeftPose.fingerCurl = -0.08 * inv;

          arcOpacity = inv * 0.14;
          arcSweepZ = -1.18 - 0.18 * ease;
        }
      } else if (this.comboIndex === 1) {
        // Đòn 2: Chém chéo ngược trái -> phải biên độ rộng
        arcPlaneRoll = 0.42;
        arcPitch = -0.14;
        if (t < wEnd) {
          const ease = quinticEase(t / wEnd);
          targetPitch = basePitch - 0.1 * ease;
          targetYaw = baseYaw + 0.16 * ease;
          targetRoll = baseRoll + 0.14 * ease;
          this.slashOffset.set(strideX - 0.05 * ease, lagY + strideY - 0.03 * ease, -0.02 * ease);

          this.targetRightPose.shoulder.set(-0.28 * ease, 0.76 * ease, 0.48 * ease);
          this.targetRightPose.elbow.set(0.42 * ease, 0, 0.24 * ease);
          this.targetRightPose.forearm.set(0, 0.76 * ease, 0);
          this.targetRightPose.wrist.set(0.32 * ease, 0.44 * ease, 0.56 * ease);
          this.targetRightPose.fingerCurl = 0.12 * ease;

          this.targetLeftPose.shoulder.set(-0.12 * ease, 0.18 * ease, 0.16 * ease);
          this.targetLeftPose.elbow.set(0.22 * ease, 0, 0.12 * ease);
          this.targetLeftPose.forearm.set(0, 0.18 * ease, 0);
          this.targetLeftPose.wrist.set(0.14 * ease, 0.1 * ease, 0.16 * ease);
          this.targetLeftPose.fingerCurl = 0.08 * ease;
        } else if (t < sEnd) {
          const k = (t - wEnd) / (sEnd - wEnd);
          const swing = quinticEase(k);
          const wristEase = quinticEase((k - 0.08) / 0.92);

          targetPitch = basePitch - 0.1 + 0.22 * swing + lagY * 0.45;
          targetYaw = baseYaw + 0.16 - 0.34 * swing;
          targetRoll = baseRoll + 0.14 - 0.34 * swing;
          this.slashOffset.set(
            strideX - 0.05 + 0.1 * swing,
            lagY + strideY - 0.03 + 0.065 * swing,
            -0.02 - 0.045 * swing,
          );

          this.targetRightPose.shoulder.set(
            -0.28 + 0.7 * swing,
            0.76 - 1.62 * swing,
            0.48 - 1.0 * swing,
          );
          this.targetRightPose.elbow.set(0.42 - 0.74 * swing, 0, 0.24 - 0.48 * swing);
          this.targetRightPose.forearm.set(0, 0.76 - 1.8 * wristEase, 0);
          this.targetRightPose.wrist.set(
            0.32 - 0.84 * wristEase,
            0.44 - 1.02 * wristEase,
            0.56 - 1.38 * wristEase,
          );
          this.targetRightPose.fingerCurl = 0.2 * Math.sin(k * Math.PI);

          this.targetLeftPose.shoulder.set(-0.12 + 0.28 * swing, -0.16 * swing, -0.22 * swing);
          this.targetLeftPose.elbow.set(0.22 + 0.12 * swing, 0, -0.14 * swing);
          this.targetLeftPose.forearm.set(0, -0.18 * swing, 0);
          this.targetLeftPose.wrist.set(-0.14 * swing, -0.12 * swing, 0.18 * swing);
          this.targetLeftPose.fingerCurl = -0.06 * swing;

          arcOpacity = Math.sin(k * Math.PI) * 0.56;
          arcSweepZ = -1.12 + 2.24 * swing;
        } else {
          const k = (t - sEnd) / (1 - sEnd);
          const ease = 1 - Math.pow(1 - k, 3);
          const spring = Math.sin(k * Math.PI) * 0.065;
          const inv = 1 - ease;

          targetPitch = basePitch + 0.12 * inv + lagY * 0.65;
          targetYaw = baseYaw - 0.18 * inv;
          targetRoll = baseRoll - 0.2 * inv;
          this.slashOffset.set(
            strideX + 0.05 * inv,
            lagY + strideY + 0.035 * inv,
            -0.065 * inv,
          );

          this.targetRightPose.shoulder.set(0.42 * inv, -0.86 * inv, -0.52 * inv);
          this.targetRightPose.elbow.set(-0.32 * inv + spring * 0.4, 0, -0.24 * inv);
          this.targetRightPose.forearm.set(0, -1.04 * inv, 0);
          this.targetRightPose.wrist.set(-0.52 * inv + spring, -0.58 * inv, -0.82 * inv - spring * 0.5);
          this.targetRightPose.fingerCurl = -0.04 * Math.sin(k * Math.PI);

          this.targetLeftPose.shoulder.set(0.16 * inv, -0.16 * inv, -0.22 * inv);
          this.targetLeftPose.elbow.set(0.34 * inv, 0, -0.14 * inv);
          this.targetLeftPose.forearm.set(0, -0.18 * inv, 0);
          this.targetLeftPose.wrist.set(-0.14 * inv, -0.12 * inv, 0.18 * inv);
          this.targetLeftPose.fingerCurl = -0.06 * inv;

          arcOpacity = inv * 0.12;
          arcSweepZ = 1.12 + 0.18 * ease;
        }
      } else {
        // Đòn 3: Chém bổ dọc từ trên cao xuống với biên độ vung lớn
        arcPlaneRoll = 1.48;
        arcPitch = 0.06;
        if (t < wEnd) {
          const ease = quinticEase(t / wEnd);
          targetPitch = basePitch + 0.18 * ease;
          targetYaw = baseYaw - 0.06 * ease;
          targetRoll = baseRoll - 0.12 * ease;
          this.slashOffset.set(strideX - 0.02 * ease, lagY + strideY + 0.055 * ease, 0.025 * ease);

          this.targetRightPose.shoulder.set(0.66 * ease, -0.16 * ease, -0.22 * ease);
          this.targetRightPose.elbow.set(0.46 * ease, 0, -0.06 * ease);
          this.targetRightPose.forearm.set(0, -0.26 * ease, 0);
          this.targetRightPose.wrist.set(0.54 * ease, 0.08 * ease, -0.24 * ease);
          this.targetRightPose.fingerCurl = 0.14 * ease;

          this.targetLeftPose.shoulder.set(0.32 * ease, 0.08 * ease, 0.1 * ease);
          this.targetLeftPose.elbow.set(0.3 * ease, 0, 0.04 * ease);
          this.targetLeftPose.forearm.set(0, 0.14 * ease, 0);
          this.targetLeftPose.wrist.set(0.24 * ease, 0, 0.12 * ease);
          this.targetLeftPose.fingerCurl = 0.12 * ease;
        } else if (t < sEnd) {
          const k = (t - wEnd) / (sEnd - wEnd);
          const swing = quinticEase(k);
          const wristEase = quinticEase((k - 0.1) / 0.9);

          targetPitch = basePitch + 0.18 - 0.42 * swing + lagY * 0.45;
          targetYaw = baseYaw - 0.06 + 0.14 * swing;
          targetRoll = baseRoll - 0.12 + 0.18 * swing;
          this.slashOffset.set(
            strideX - 0.02 - 0.03 * swing,
            lagY + strideY + 0.055 - 0.115 * swing,
            0.025 - 0.09 * swing,
          );

          this.targetRightPose.shoulder.set(
            0.66 - 1.44 * swing,
            -0.16 + 0.4 * swing,
            -0.22 + 0.44 * swing,
          );
          this.targetRightPose.elbow.set(0.46 - 0.86 * swing, 0, -0.06 + 0.14 * swing);
          this.targetRightPose.forearm.set(0, -0.26 + 0.72 * wristEase, 0);
          this.targetRightPose.wrist.set(
            0.54 - 1.66 * wristEase,
            0.08 + 0.14 * wristEase,
            -0.24 + 0.52 * wristEase,
          );
          this.targetRightPose.fingerCurl = 0.24 * Math.sin(k * Math.PI);

          this.targetLeftPose.shoulder.set(0.32 - 0.62 * swing, -0.14 * swing, -0.18 * swing);
          this.targetLeftPose.elbow.set(0.3 - 0.12 * swing, 0, -0.08 * swing);
          this.targetLeftPose.forearm.set(0, -0.16 * swing, 0);
          this.targetLeftPose.wrist.set(-0.28 * swing, -0.1 * swing, 0.16 * swing);
          this.targetLeftPose.fingerCurl = -0.06 * swing;

          arcOpacity = Math.sin(k * Math.PI) * 0.64;
          arcSweepZ = 1.08 - 2.16 * swing;
        } else {
          const k = (t - sEnd) / (1 - sEnd);
          const ease = 1 - Math.pow(1 - k, 3);
          const spring = Math.sin(k * Math.PI) * 0.08;
          const inv = 1 - ease;

          targetPitch = basePitch - 0.24 * inv + lagY * 0.65;
          targetYaw = baseYaw + 0.08 * inv;
          targetRoll = baseRoll + 0.06 * inv;
          this.slashOffset.set(
            strideX - 0.05 * inv,
            lagY + strideY - 0.06 * inv,
            -0.065 * inv,
          );

          this.targetRightPose.shoulder.set(-0.78 * inv, 0.24 * inv, 0.22 * inv);
          this.targetRightPose.elbow.set(-0.4 * inv + spring * 0.45, 0, 0.08 * inv);
          this.targetRightPose.forearm.set(0, 0.46 * inv, 0);
          this.targetRightPose.wrist.set(-1.12 * inv - spring, 0.22 * inv, 0.28 * inv);
          this.targetRightPose.fingerCurl = -0.06 * Math.sin(k * Math.PI);

          this.targetLeftPose.shoulder.set(-0.3 * inv, -0.14 * inv, -0.18 * inv);
          this.targetLeftPose.elbow.set(0.18 * inv, 0, -0.08 * inv);
          this.targetLeftPose.forearm.set(0, -0.16 * inv, 0);
          this.targetLeftPose.wrist.set(-0.28 * inv, -0.1 * inv, 0.16 * inv);
          this.targetLeftPose.fingerCurl = -0.06 * inv;

          arcOpacity = inv * 0.15;
          arcSweepZ = -1.08 - 0.18 * ease;
        }
      }

      if (t >= 1) {
        this.isSlashing = false;
      }
    }

    // Giảm chấn liên tục theo từng khớp (vai dẫn đầu -> khuỷu -> cẳng tay -> cổ tay -> ngón tay)
    const activeSlash = this.isSlashing;
    const bodyRate = activeSlash ? 20 : 12;
    const shoulderRate = activeSlash ? 22 : 11;
    const elbowRate = activeSlash ? 18 : 10;
    const forearmRate = activeSlash ? 24 : 12;
    const wristRate = activeSlash ? 28 : 14;
    const leftRate = activeSlash ? 16 : 10;

    this.dampVec3(this.currentViewOffset, this.slashOffset, bodyRate, bodyRate, bodyRate, safeDt);
    this.currentViewRot.x = THREE.MathUtils.damp(this.currentViewRot.x, targetPitch, bodyRate, safeDt);
    this.currentViewRot.y = THREE.MathUtils.damp(this.currentViewRot.y, targetYaw, bodyRate, safeDt);
    this.currentViewRot.z = THREE.MathUtils.damp(this.currentViewRot.z, targetRoll, bodyRate, safeDt);

    this.dampVec3(
      this.rightPose.shoulder,
      this.targetRightPose.shoulder,
      shoulderRate,
      shoulderRate,
      shoulderRate,
      safeDt,
    );
    this.dampVec3(
      this.rightPose.elbow,
      this.targetRightPose.elbow,
      elbowRate,
      elbowRate,
      elbowRate,
      safeDt,
    );
    this.dampVec3(
      this.rightPose.forearm,
      this.targetRightPose.forearm,
      forearmRate,
      forearmRate,
      forearmRate,
      safeDt,
    );
    this.dampVec3(
      this.rightPose.wrist,
      this.targetRightPose.wrist,
      wristRate,
      wristRate,
      wristRate,
      safeDt,
    );
    this.rightPose.fingerCurl = THREE.MathUtils.damp(
      this.rightPose.fingerCurl,
      this.targetRightPose.fingerCurl,
      20,
      safeDt,
    );

    this.dampVec3(this.leftPose.shoulder, this.targetLeftPose.shoulder, leftRate, leftRate, leftRate, safeDt);
    this.dampVec3(this.leftPose.elbow, this.targetLeftPose.elbow, leftRate * 0.9, leftRate * 0.9, leftRate * 0.9, safeDt);
    this.dampVec3(this.leftPose.forearm, this.targetLeftPose.forearm, leftRate * 1.1, leftRate * 1.1, leftRate * 1.1, safeDt);
    this.dampVec3(this.leftPose.wrist, this.targetLeftPose.wrist, leftRate * 1.2, leftRate * 1.2, leftRate * 1.2, safeDt);
    this.leftPose.fingerCurl = THREE.MathUtils.damp(
      this.leftPose.fingerCurl,
      this.targetLeftPose.fingerCurl,
      16,
      safeDt,
    );

    this.applyPoseToRig(this.armRig, this.rightPose);
    this.applyPoseToRig(this.leftArmRig, this.leftPose);

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
      .add(this.currentViewOffset)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);
    this.group.position.copy(this.tempLocalPos);

    this.tempEuler.set(
      this.currentViewRot.x,
      this.currentViewRot.y,
      this.currentViewRot.z,
      'YXZ',
    );
    this.tempLocalQuat.setFromEuler(this.tempEuler);
    this.group.quaternion.copy(camera.quaternion).multiply(this.tempLocalQuat);
  }

  dispose(): void {
    this.disposeMeshOnly();
  }
}
