import * as THREE from 'three';
import { CharacterGender } from './firstPersonArms';
import { createKatanaMeshGroup } from './katana';
import { createParabolicEllipsoidGeometry, createParabolicLatheGeometry } from './parabolic';
import { createShieldMeshGroup } from './shield';
import { createSoftShadowTexture } from './textures';

export interface CharacterAssetHandles {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  textures: THREE.Texture[];
}

export interface CharacterBuildOptions {
  hasKatana?: boolean;
  hasIceKatana?: boolean;
  hasShield?: boolean;
  previewWeapon?: boolean;
  maxAnisotropy?: number;
}

interface CharacterAnimRig {
  isMale: boolean;
  upperRig: THREE.Group;
  headGroup: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  ponytailKnot: THREE.Group | null;
  sakuraOrnament: THREE.Group | null;
  baseHeadRot: THREE.Euler;
  baseRightArmRot: THREE.Euler;
  baseLeftArmRot: THREE.Euler;
}

export function disposeCharacterAssets(handles: CharacterAssetHandles): void {
  for (const geo of handles.geometries) {
    geo.dispose();
  }
  for (const mat of handles.materials) {
    mat.dispose();
  }
  for (const tex of handles.textures) {
    tex.dispose();
  }
  handles.geometries.length = 0;
  handles.materials.length = 0;
  handles.textures.length = 0;
}

/**
 * Cập nhật hoạt ảnh thở nhẹ, đung đưa đuôi tóc & tư thế tự nhiên (zero-GC mỗi frame).
 */
export function animateCharacterIdle(root: THREE.Group, elapsed: number): void {
  const rig = root.userData.animRig as CharacterAnimRig | undefined;
  if (!rig) return;

  const breath = Math.sin(elapsed * 2.1);
  const sway = Math.sin(elapsed * 1.45);

  rig.upperRig.position.y = breath * 0.0055;
  rig.headGroup.rotation.x = rig.baseHeadRot.x + breath * 0.018;
  rig.headGroup.rotation.y = rig.baseHeadRot.y + Math.sin(elapsed * 0.9) * 0.032;
  rig.headGroup.rotation.z = rig.baseHeadRot.z + sway * 0.015;

  rig.rightArm.rotation.x = rig.baseRightArmRot.x + breath * 0.022;
  rig.rightArm.rotation.z = rig.baseRightArmRot.z + sway * 0.014;
  rig.leftArm.rotation.x = rig.baseLeftArmRot.x - breath * 0.018;
  rig.leftArm.rotation.z = rig.baseLeftArmRot.z - sway * 0.014;

  if (rig.ponytailKnot) {
    rig.ponytailKnot.rotation.x = 0.05 + Math.sin(elapsed * 2.2 - 0.6) * 0.045;
    rig.ponytailKnot.rotation.z = Math.cos(elapsed * 1.5) * 0.04;
  }
  if (rig.sakuraOrnament) {
    rig.sakuraOrnament.rotation.z = 0.12 + Math.sin(elapsed * 2.6) * 0.035;
  }
}

/**
 * Tạo texture vải Kimono / Haori dệt mịn kèm hoa văn tinh tế (seigaiha sóng nước cho Nam, cánh anh đào mờ cho Nữ).
 */
function createKimonoFabricTexture(
  baseHex: string,
  accentHex: string,
  pattern: 'waves' | 'sakura',
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, baseHex);
    grad.addColorStop(0.65, baseHex);
    grad.addColorStop(1, accentHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Sợi vải dệt mịn chéo nhau
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 4) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < size; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
    }

    if (pattern === 'waves') {
      // Họa tiết sóng Seigaiha nhẹ sang trọng cho Nam
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.09)';
      ctx.lineWidth = 1.2;
      const step = 32;
      for (let y = 16; y <= size + 16; y += 16) {
        const xOff = (Math.floor(y / 16) % 2) * 16;
        for (let x = -16; x <= size + 16; x += step) {
          for (const r of [14, 9, 4.5]) {
            ctx.beginPath();
            ctx.arc(x + xOff, y, r, Math.PI, 0);
            ctx.stroke();
          }
        }
      }
    } else {
      // Họa tiết cánh hoa anh đào phớt nhẹ trên nền Kimono Nữ
      const petals: Array<[number, number, number, number]> = [
        [36, 44, 0.4, 9],
        [118, 28, -0.5, 8],
        [196, 62, 1.1, 10],
        [72, 134, -0.3, 11],
        [164, 152, 0.7, 9],
        [224, 198, -0.8, 10],
        [44, 212, 0.9, 8],
        [136, 224, -0.2, 9],
      ];
      for (const [px, py, rot, rad] of petals) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        for (let p = 0; p < 5; p++) {
          ctx.rotate((Math.PI * 2) / 5);
          ctx.fillStyle = 'rgba(244, 114, 182, 0.14)';
          ctx.beginPath();
          ctx.ellipse(0, rad * 0.58, rad * 0.28, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(251, 113, 133, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Tạo texture gấm lụa cho đai Obi tối màu.
 */
function createObiSilkTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#18181f';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(234, 179, 8, 0.14)';
    ctx.lineWidth = 1;
    const step = 16;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + step * 0.5, y + 2);
        ctx.lineTo(x + step - 2, y + step * 0.5);
        ctx.lineTo(x + step * 0.5, y + step - 2);
        ctx.lineTo(x + 2, y + step * 0.5);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Tạo texture sợi tóc mượt với dải highlight anime ("angel ring") chạy ngang và chuyển sắc gốc-ngọn.
 */
function createHairHighlightTexture(isMale: boolean, maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    if (isMale) {
      grad.addColorStop(0, '#0d0f15');
      grad.addColorStop(0.26, '#171b24');
      grad.addColorStop(0.43, '#333b4d');
      grad.addColorStop(0.57, '#161922');
      grad.addColorStop(1, '#0d0f14');
    } else {
      grad.addColorStop(0, '#0f0e15');
      grad.addColorStop(0.26, '#1b1826');
      grad.addColorStop(0.42, '#3a344c');
      grad.addColorStop(0.55, '#191622');
      grad.addColorStop(1, '#100e17');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Các sọc sợi tóc mảnh dọc theo chiều dài lọn tóc
    for (let i = 0; i < 84; i++) {
      const x = (i / 84) * size;
      const alpha = isMale
        ? 0.04 + ((i * 19) % 7) * 0.012
        : 0.045 + ((i * 23) % 7) * 0.014;
      ctx.strokeStyle = isMale
        ? `rgba(203, 213, 225, ${alpha})`
        : `rgba(226, 232, 240, ${alpha})`;
      ctx.lineWidth = i % 3 === 0 ? 1.6 : 0.9;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.sin(i) * 3, size);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Tạo texture làn da mịn có chuyển sắc cằm nhẹ & má hồng phớt (không vẽ mắt theo yêu cầu tạm bỏ mắt).
 */
function createSkinShadingTexture(isMale: boolean, maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const base = isMale ? '#f5e2d5' : '#fdece5';
    const shade = isMale ? '#e6c9b8' : '#f3d1c7';
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, shade);
    grad.addColorStop(0.25, base);
    grad.addColorStop(0.85, base);
    grad.addColorStop(1, shade);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Phớt má hồng cực nhẹ ở nửa trước khuôn mặt (chừa phần mắt hoàn toàn trống)
    const blushColor = isMale ? 'rgba(244, 143, 137, 0.14)' : 'rgba(251, 113, 133, 0.22)';
    for (const cx of [size * 0.36, size * 0.64]) {
      const cy = size * 0.56;
      const rGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
      rGrad.addColorStop(0, blushColor);
      rGrad.addColorStop(1, 'rgba(251, 113, 133, 0)');
      ctx.fillStyle = rGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Tạo một lọn tóc cong parabol thuôn nhọn dần theo đường cong CatmullRomCurve3 (có độ dẹt tự nhiên như lọn tóc anime).
 */
function createTaperedHairStrandGeometry(
  curvePoints: THREE.Vector3[],
  baseRadius: number,
  tubularSegments = 14,
  radialSegments = 8,
  flatness = 0.68,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const frames = curve.computeFrenetFrames(tubularSegments, false);

  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, P);
    const normalVec = frames.normals[i];
    const binormalVec = frames.binormals[i];

    // Thuôn mượt parabol từ gốc đến ngọn nhọn
    const r =
      t >= 0.995
        ? 0.0007
        : baseRadius *
          Math.sin(Math.pow(1 - t, 0.72) * (Math.PI * 0.5)) *
          (0.38 + 0.62 * Math.sin(Math.min(1, t * 4) * (Math.PI * 0.5)));

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v) * flatness;
      const cos = -Math.cos(v);

      normal.x = cos * normalVec.x + sin * binormalVec.x;
      normal.y = cos * normalVec.y + sin * binormalVec.y;
      normal.z = cos * normalVec.z + sin * binormalVec.z;
      normal.normalize();

      N.set(
        (cos * normalVec.x + sin * binormalVec.x) * r,
        (cos * normalVec.y + sin * binormalVec.y) * r,
        (cos * normalVec.z + sin * binormalVec.z) * r,
      );
      vertex.copy(P).add(N);
      vertices.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(j / radialSegments, t);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = (radialSegments + 1) * i + j;
      const b = (radialSegments + 1) * (i + 1) + j;
      const c = (radialSegments + 1) * (i + 1) + (j + 1);
      const d = (radialSegments + 1) * i + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Tạo tay áo kimono rủ xuống mềm mại (tamoto) bằng ExtrudeGeometry bo tròn parabol.
 */
function createDrapedKimonoSleeveGeometry(
  width: number,
  dropLength: number,
  thickness: number,
): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(width * 0.92, -0.025);
  s.quadraticCurveTo(width * 0.96, -dropLength * 0.62, width * 0.72, -dropLength);
  s.quadraticCurveTo(width * 0.36, -dropLength * 1.03, width * 0.06, -dropLength * 0.86);
  s.quadraticCurveTo(-0.02, -dropLength * 0.46, 0, 0);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.34,
    bevelSize: thickness * 0.24,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function createScabbardGroup(
  handles: CharacterAssetHandles,
  accentColor: string,
  isIce: boolean,
): THREE.Group {
  const scabbard = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: isIce ? '#082f49' : '#111827',
    roughness: 0.2,
    metalness: 0.35,
    clearcoat: 0.95,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: isIce ? '#7dd3fc' : '#eab308',
    roughness: 0.2,
    metalness: 0.88,
  });
  const cordMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.62,
    metalness: 0.08,
  });
  handles.materials.push(bodyMat, trimMat, cordMat);

  const sayaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.26, -0.015),
    new THREE.Vector3(0, 0.54, -0.044),
    new THREE.Vector3(0, 0.78, -0.08),
  ]);
  const sayaGeo = new THREE.TubeGeometry(sayaCurve, 16, 0.021, 10, false);
  const mouthGeo = new THREE.TorusGeometry(0.023, 0.0055, 8, 16);
  mouthGeo.rotateX(Math.PI / 2);
  const capGeo = new THREE.SphereGeometry(0.021, 10, 8);
  const cordRingGeo = new THREE.TorusGeometry(0.024, 0.005, 8, 16);
  cordRingGeo.rotateX(Math.PI / 2);
  const tasselGeo = createParabolicLatheGeometry(
    0.15,
    0.016,
    (t) => Math.sin(Math.pow(1 - t, 0.7) * Math.PI * 0.5) + 0.14 * (1 - t),
    10,
    8,
    false,
  );
  handles.geometries.push(sayaGeo, mouthGeo, capGeo, cordRingGeo, tasselGeo);

  const sayaMesh = new THREE.Mesh(sayaGeo, bodyMat);
  sayaMesh.castShadow = true;
  scabbard.add(sayaMesh);

  const mouth = new THREE.Mesh(mouthGeo, trimMat);
  scabbard.add(mouth);

  const tipCap = new THREE.Mesh(capGeo, trimMat);
  tipCap.position.set(0, 0.78, -0.08);
  scabbard.add(tipCap);

  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(cordRingGeo, cordMat);
    ring.position.set(0, 0.12 + i * 0.026, -0.006 - i * 0.0015);
    scabbard.add(ring);
  }

  const tassel = new THREE.Mesh(tasselGeo, cordMat);
  tassel.position.set(0.022, 0.02, -0.015);
  tassel.rotation.z = 0.18;
  scabbard.add(tassel);

  return scabbard;
}

function createSakuraOrnament(handles: CharacterAssetHandles): THREE.Group {
  const flower = new THREE.Group();
  const petalMat = new THREE.MeshPhysicalMaterial({
    color: '#fbcfe8',
    emissive: '#f472b6',
    emissiveIntensity: 0.28,
    roughness: 0.34,
    sheen: 0.45,
    sheenColor: new THREE.Color('#fff1f2'),
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: '#fb7185',
    roughness: 0.32,
  });
  const stamenMat = new THREE.MeshStandardMaterial({
    color: '#fde047',
    roughness: 0.3,
    metalness: 0.5,
  });
  const ribbonMat = new THREE.MeshPhysicalMaterial({
    color: '#dc2626',
    roughness: 0.48,
    sheen: 0.55,
    sheenColor: new THREE.Color('#fca5a5'),
  });
  handles.materials.push(petalMat, centerMat, stamenMat, ribbonMat);

  const petalGeo = createParabolicEllipsoidGeometry(0.05, 0.075, 0.02, 12, 8);
  const centerGeo = new THREE.SphereGeometry(0.021, 10, 8);
  const stamenGeo = new THREE.SphereGeometry(0.007, 6, 6);
  const ribbonGeo = createTaperedHairStrandGeometry(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.025, -0.11, -0.02),
      new THREE.Vector3(0.055, -0.24, -0.045),
      new THREE.Vector3(0.095, -0.34, -0.03),
    ],
    0.019,
    14,
    8,
    0.55,
  );
  handles.geometries.push(petalGeo, centerGeo, stamenGeo, ribbonGeo);

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.set(Math.cos(angle) * 0.038, Math.sin(angle) * 0.038, 0);
    petal.rotation.z = angle - Math.PI / 2;
    flower.add(petal);

    const stamen = new THREE.Mesh(stamenGeo, stamenMat);
    stamen.position.set(Math.cos(angle) * 0.018, Math.sin(angle) * 0.018, 0.018);
    flower.add(stamen);
  }
  const core = new THREE.Mesh(centerGeo, centerMat);
  core.position.z = 0.012;
  flower.add(core);

  const ribL = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribL.rotation.z = -0.15;
  const ribR = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribR.rotation.z = 0.35;
  ribR.scale.x = -0.9;
  flower.add(ribL, ribR);

  return flower;
}

/**
 * Tạo bàn tay chi tiết hơn với các ngón cong nhẹ tự nhiên (cứng cáp cho Nam, mảnh mai găng tay hở ngón cho Nữ).
 */
function createArticulatedHandGroup(
  isMale: boolean,
  side: 'left' | 'right',
  armR: number,
  handles: CharacterAssetHandles,
  skinMat: THREE.Material,
  gloveMat: THREE.Material,
): THREE.Group {
  const handGroup = new THREE.Group();
  const palmMat = isMale ? skinMat : gloveMat;

  const palmGeo = createParabolicEllipsoidGeometry(
    armR * 1.28,
    armR * 1.42,
    armR * 0.96,
    12,
    10,
  );
  const fingerGeo = new THREE.CapsuleGeometry(armR * 0.24, armR * 0.62, 4, 8);
  const thumbGeo = new THREE.CapsuleGeometry(armR * 0.27, armR * 0.45, 4, 8);
  handles.geometries.push(palmGeo, fingerGeo, thumbGeo);

  const palm = new THREE.Mesh(palmGeo, palmMat);
  handGroup.add(palm);

  const dir = side === 'right' ? 1 : -1;
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(fingerGeo, skinMat);
    const yOff = -armR * 0.32 + i * (armR * 0.24);
    f.position.set(-dir * armR * 0.16, yOff, armR * 0.56);
    f.rotation.set(0.65, 0, dir * 0.85);
    handGroup.add(f);
  }

  const thumb = new THREE.Mesh(thumbGeo, skinMat);
  thumb.position.set(dir * armR * 0.34, armR * 0.38, armR * 0.32);
  thumb.rotation.set(0.45, 0, -dir * 0.52);
  handGroup.add(thumb);

  return handGroup;
}

/**
 * Tạo hình mẫu nhân vật 3D mượt mà bằng đường cong Parabol (tạm ẩn mắt để bổ sung mẫu mắt sau):
 * - Nam: Tóc đen tầng lớp nhiều lọn óng mượt, haori dài phủ eo & kimono dệt sóng seigaiha cổ đỏ/trắng,
 *        dây tua đỏ khóa vàng, hakama xếp nếp đen, Katana dựng vai.
 * - Nữ: Tóc đen đuôi ngựa cao đa lọn ánh lụa kèm hoa anh đào & ruy băng đỏ, kimono trắng họa tiết sakura ẩn viền cổ 2 lớp,
 *       váy xếp ly trắng lót đỏ viền chỉ mảnh, nơ obi lụa đỏ, tay áo kimono rủ thanh thoát, găng tay hở ngón, Katana đỏ.
 */
export function createCharacterMeshGroup(
  gender: CharacterGender,
  handles: CharacterAssetHandles,
  options: CharacterBuildOptions = {},
): THREE.Group {
  const root = new THREE.Group();
  const isMale = gender === 'male';
  const maxAniso = options.maxAnisotropy ?? 4;
  const showKatana = Boolean(options.hasKatana || options.previewWeapon);
  const showIceKatana = Boolean(options.hasIceKatana && options.hasKatana);
  const showShield = Boolean(options.hasShield);

  const kimonoTex = createKimonoFabricTexture(
    isMale ? '#eee8dc' : '#fafbfd',
    isMale ? '#d9d0be' : '#f1eef6',
    isMale ? 'waves' : 'sakura',
    maxAniso,
  );
  const haoriTex = createKimonoFabricTexture('#e2dac9', '#cfc4af', 'waves', maxAniso);
  const sleeveTex = createKimonoFabricTexture(
    isMale ? '#f97316' : '#f472b6',
    isMale ? '#ea580c' : '#ec4899',
    isMale ? 'waves' : 'sakura',
    maxAniso,
  );
  const obiTex = createObiSilkTexture(maxAniso);
  const hairTex = createHairHighlightTexture(isMale, maxAniso);
  const skinTex = createSkinShadingTexture(isMale, maxAniso);
  handles.textures.push(kimonoTex, haoriTex, sleeveTex, obiTex, hairTex, skinTex);

  const skinMat = new THREE.MeshStandardMaterial({
    map: skinTex,
    color: '#ffffff',
    roughness: isMale ? 0.48 : 0.38,
    metalness: 0.02,
  });
  const plainSkinMat = new THREE.MeshStandardMaterial({
    color: isMale ? '#f4e0d2' : '#fcebe3',
    roughness: isMale ? 0.5 : 0.4,
    metalness: 0.02,
  });
  const kimonoMainMat = new THREE.MeshPhysicalMaterial({
    map: kimonoTex,
    color: '#ffffff',
    roughness: 0.72,
    metalness: 0.03,
    sheen: 0.42,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(isMale ? '#fff8eb' : '#ffe4ec'),
  });
  const haoriOuterMat = new THREE.MeshPhysicalMaterial({
    map: haoriTex,
    color: '#ffffff',
    roughness: 0.75,
    metalness: 0.03,
    sheen: 0.36,
    sheenRoughness: 0.68,
    sheenColor: new THREE.Color('#f5efe2'),
    side: THREE.DoubleSide,
  });
  const sleeveMat = new THREE.MeshPhysicalMaterial({
    map: sleeveTex,
    color: '#ffffff',
    roughness: 0.66,
    metalness: 0.04,
    sheen: 0.48,
    sheenRoughness: 0.56,
    sheenColor: new THREE.Color(isMale ? '#fed7aa' : '#fce7f3'),
    side: THREE.DoubleSide,
  });
  const innerWhiteCollarMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.58,
    metalness: 0.02,
  });
  const redCollarMat = new THREE.MeshPhysicalMaterial({
    color: isMale ? '#b91c1c' : '#dc2626',
    roughness: 0.48,
    metalness: 0.06,
    sheen: 0.55,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#fca5a5'),
  });
  const obiMat = new THREE.MeshPhysicalMaterial({
    map: obiTex,
    color: '#ffffff',
    roughness: 0.55,
    metalness: 0.14,
    sheen: 0.45,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#64748b'),
  });
  const hairMat = new THREE.MeshPhysicalMaterial({
    map: hairTex,
    color: '#ffffff',
    roughness: isMale ? 0.25 : 0.22,
    metalness: 0.06,
    clearcoat: isMale ? 0.52 : 0.65,
    clearcoatRoughness: 0.22,
    sheen: isMale ? 0.35 : 0.4,
    sheenColor: new THREE.Color(isMale ? '#93c5fd' : '#c4b5fd'),
  });
  const hairShadowMat = new THREE.MeshStandardMaterial({
    color: isMale ? '#0d0f15' : '#0f0d16',
    roughness: 0.42,
    metalness: 0.05,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    roughness: 0.2,
    metalness: 0.88,
  });
  const sandalMat = new THREE.MeshStandardMaterial({
    color: '#1c1917',
    roughness: 0.68,
    metalness: 0.08,
  });
  const sockMat = new THREE.MeshStandardMaterial({
    color: isMale ? '#f8fafc' : '#18181f',
    roughness: 0.68,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#1f1b24',
    roughness: 0.6,
    metalness: 0.08,
  });
  handles.materials.push(
    skinMat,
    plainSkinMat,
    kimonoMainMat,
    haoriOuterMat,
    sleeveMat,
    innerWhiteCollarMat,
    redCollarMat,
    obiMat,
    hairMat,
    hairShadowMat,
    goldMat,
    sandalMat,
    sockMat,
    gloveMat,
  );

  // Bóng tiếp xúc mềm dưới chân
  const shadowTex = createSoftShadowTexture();
  handles.textures.push(shadowTex);
  const shadowGeo = new THREE.PlaneGeometry(1.25, 1.25);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });
  handles.geometries.push(shadowGeo);
  handles.materials.push(shadowMat);
  const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
  groundShadow.position.y = 0.008;
  root.add(groundShadow);

  // 1. Đôi chân & Hakama xếp nếp (Nam) / Váy xếp ly lót đỏ (Nữ)
  const shoeGeo = createParabolicEllipsoidGeometry(0.105, 0.062, 0.205, 14, 10);
  const strapGeo = new THREE.TorusGeometry(0.055, 0.008, 8, 14, Math.PI);
  handles.geometries.push(shoeGeo, strapGeo);

  if (isMale) {
    const hakamaLegGeo = createParabolicLatheGeometry(
      0.86,
      0.168,
      (t) => {
        if (t <= 0.002 || t >= 0.998) return 0;
        return 0.7 + 0.3 * Math.sin(t * Math.PI * 0.86);
      },
      26,
      14,
      false,
    );
    const hPos = hakamaLegGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < hPos.count; i++) {
      const hx = hPos.getX(i);
      const hz = hPos.getZ(i);
      if (Math.hypot(hx, hz) > 0.02) {
        const ang = Math.atan2(hz, hx);
        const pleat = 1 + Math.sin(ang * 8) * 0.048;
        hPos.setX(i, hx * pleat);
        hPos.setZ(i, hz * pleat);
      }
    }
    hakamaLegGeo.computeVertexNormals();
    handles.geometries.push(hakamaLegGeo);

    for (const sx of [-0.112, 0.112]) {
      const leg = new THREE.Mesh(hakamaLegGeo, obiMat);
      leg.position.set(sx, 0.06, 0);
      leg.castShadow = true;
      root.add(leg);

      const shoe = new THREE.Mesh(shoeGeo, sandalMat);
      shoe.position.set(sx, 0.031, 0.036);
      shoe.castShadow = true;
      root.add(shoe);

      const strap = new THREE.Mesh(strapGeo, redCollarMat);
      strap.position.set(sx, 0.056, 0.055);
      strap.rotation.x = 0.6;
      root.add(strap);

      const tabi = new THREE.Mesh(
        createParabolicEllipsoidGeometry(0.086, 0.068, 0.148, 12, 8),
        sockMat,
      );
      handles.geometries.push(tabi.geometry);
      tabi.position.set(sx, 0.056, 0.02);
      root.add(tabi);
    }
  } else {
    const thighGeo = new THREE.CapsuleGeometry(0.059, 0.32, 6, 12);
    const calfGeo = new THREE.CapsuleGeometry(0.044, 0.34, 6, 12);
    handles.geometries.push(thighGeo, calfGeo);

    for (const sx of [-0.09, 0.09]) {
      const thigh = new THREE.Mesh(thighGeo, plainSkinMat);
      thigh.position.set(sx, 0.62, 0);
      thigh.castShadow = true;
      root.add(thigh);

      const calf = new THREE.Mesh(calfGeo, sockMat);
      calf.position.set(sx, 0.27, 0);
      calf.castShadow = true;
      root.add(calf);

      // Viền miệng tất cao cổ tinh tế
      const sockTopGeo = new THREE.TorusGeometry(0.046, 0.0045, 6, 16);
      sockTopGeo.rotateX(Math.PI / 2);
      handles.geometries.push(sockTopGeo);
      const sockTop = new THREE.Mesh(sockTopGeo, redCollarMat);
      sockTop.position.set(sx, 0.44, 0);
      root.add(sockTop);

      const shoe = new THREE.Mesh(shoeGeo, sandalMat);
      shoe.scale.set(0.84, 0.88, 0.88);
      shoe.position.set(sx, 0.03, 0.03);
      shoe.castShadow = true;
      root.add(shoe);

      const strap = new THREE.Mesh(strapGeo, redCollarMat);
      strap.scale.setScalar(0.84);
      strap.position.set(sx, 0.052, 0.046);
      strap.rotation.x = 0.6;
      root.add(strap);
    }

    const outerSkirtGeo = createParabolicLatheGeometry(
      0.46,
      0.348,
      (t) => {
        if (t >= 0.998) return 0;
        const flare = 1.0 - t * 0.49;
        return flare * (0.94 + 0.06 * Math.sin(t * Math.PI));
      },
      36,
      14,
      false,
    );
    const pos = outerSkirtGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      if (Math.hypot(px, pz) > 0.01) {
        const ang = Math.atan2(pz, px);
        const pleat = 1 + Math.sin(ang * 16) * 0.068 * (1 - py / 0.47);
        pos.setX(i, px * pleat);
        pos.setZ(i, pz * pleat);
      }
    }
    outerSkirtGeo.computeVertexNormals();

    const innerSkirtGeo = createParabolicLatheGeometry(
      0.425,
      0.322,
      (t) => (t >= 0.998 ? 0 : 1.02 - t * 0.48),
      24,
      10,
      false,
    );
    const hemTrimGeo = new THREE.TorusGeometry(0.345, 0.0065, 8, 36);
    hemTrimGeo.rotateX(Math.PI / 2);
    handles.geometries.push(outerSkirtGeo, innerSkirtGeo, hemTrimGeo);

    const outerSkirt = new THREE.Mesh(outerSkirtGeo, kimonoMainMat);
    outerSkirt.position.set(0, 0.555, 0);
    outerSkirt.castShadow = true;
    root.add(outerSkirt);

    const innerSkirt = new THREE.Mesh(innerSkirtGeo, redCollarMat);
    innerSkirt.position.set(0, 0.54, 0);
    root.add(innerSkirt);

    const hemTrim = new THREE.Mesh(hemTrimGeo, redCollarMat);
    hemTrim.position.set(0, 0.562, 0);
    root.add(hemTrim);
  }

  // Nhóm thân trên để thở & cử động tự nhiên
  const upperRig = new THREE.Group();
  root.add(upperRig);

  // 2. Thân trên parabol mượt + Cổ áo 2 lớp V-lapel + Áo Haori phủ hông (Nam) + Đai Obi
  const torsoH = isMale ? 0.54 : 0.48;
  const torsoY = isMale ? 0.88 : 0.93;
  const torsoGeo = createParabolicLatheGeometry(
    torsoH,
    isMale ? 0.215 : 0.166,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      if (isMale) {
        return 0.76 + 0.24 * Math.sin(t * Math.PI * 0.88);
      }
      return 0.65 + 0.31 * Math.sin(Math.pow(t, 0.84) * Math.PI * 0.9);
    },
    24,
    14,
    false,
  );
  torsoGeo.scale(1.06, 1, 0.7);
  handles.geometries.push(torsoGeo);

  const torsoMesh = new THREE.Mesh(torsoGeo, kimonoMainMat);
  torsoMesh.position.set(0, torsoY, 0);
  torsoMesh.castShadow = true;
  upperRig.add(torsoMesh);

  // Cổ áo 2 lớp: nẹp đỏ ngoài + cổ lót trắng (haneri) ôm sát bên trong
  const lapelRadius = isMale ? 0.019 : 0.015;
  const lapelLeftGeo = createTaperedHairStrandGeometry(
    [
      new THREE.Vector3(-0.078, torsoY + torsoH - 0.02, 0.03),
      new THREE.Vector3(-0.048, torsoY + torsoH - 0.12, isMale ? 0.145 : 0.122),
      new THREE.Vector3(0.022, torsoY + 0.16, isMale ? 0.148 : 0.122),
    ],
    lapelRadius,
    12,
    8,
    0.72,
  );
  const lapelRightGeo = createTaperedHairStrandGeometry(
    [
      new THREE.Vector3(0.078, torsoY + torsoH - 0.02, 0.03),
      new THREE.Vector3(0.048, torsoY + torsoH - 0.12, isMale ? 0.145 : 0.122),
      new THREE.Vector3(-0.022, torsoY + 0.16, isMale ? 0.148 : 0.122),
    ],
    lapelRadius,
    12,
    8,
    0.72,
  );
  const innerHaneriLeftGeo = createTaperedHairStrandGeometry(
    [
      new THREE.Vector3(-0.06, torsoY + torsoH - 0.015, 0.034),
      new THREE.Vector3(-0.036, torsoY + torsoH - 0.11, isMale ? 0.136 : 0.114),
      new THREE.Vector3(0.014, torsoY + 0.22, isMale ? 0.14 : 0.115),
    ],
    lapelRadius * 0.68,
    10,
    8,
    0.72,
  );
  const innerHaneriRightGeo = createTaperedHairStrandGeometry(
    [
      new THREE.Vector3(0.06, torsoY + torsoH - 0.015, 0.034),
      new THREE.Vector3(0.036, torsoY + torsoH - 0.11, isMale ? 0.136 : 0.114),
      new THREE.Vector3(-0.014, torsoY + 0.22, isMale ? 0.14 : 0.115),
    ],
    lapelRadius * 0.68,
    10,
    8,
    0.72,
  );
  handles.geometries.push(
    lapelLeftGeo,
    lapelRightGeo,
    innerHaneriLeftGeo,
    innerHaneriRightGeo,
  );
  upperRig.add(
    new THREE.Mesh(lapelLeftGeo, redCollarMat),
    new THREE.Mesh(lapelRightGeo, redCollarMat),
    new THREE.Mesh(innerHaneriLeftGeo, innerWhiteCollarMat),
    new THREE.Mesh(innerHaneriRightGeo, innerWhiteCollarMat),
  );

  // Cổ sau màu đỏ ôm gáy
  const backCollarGeo = new THREE.TorusGeometry(
    isMale ? 0.095 : 0.076,
    0.017,
    10,
    18,
    Math.PI * 1.15,
  );
  backCollarGeo.rotateX(Math.PI * 0.5);
  backCollarGeo.rotateZ(-Math.PI * 0.08);
  handles.geometries.push(backCollarGeo);
  const backCollar = new THREE.Mesh(backCollarGeo, redCollarMat);
  backCollar.position.set(0, torsoY + torsoH - 0.015, 0.005);
  upperRig.add(backCollar);

  // Đai Obi lụa đen thắt eo
  const obiGeo = createParabolicLatheGeometry(
    isMale ? 0.125 : 0.12,
    isMale ? 0.186 : 0.136,
    (t) => 0.96 + 0.04 * Math.sin(t * Math.PI),
    24,
    8,
    false,
  );
  obiGeo.scale(1.08, 1, 0.74);
  handles.geometries.push(obiGeo);
  const obiMesh = new THREE.Mesh(obiGeo, obiMat);
  obiMesh.position.set(0, torsoY - 0.01, 0);
  obiMesh.castShadow = true;
  upperRig.add(obiMesh);

  if (isMale) {
    // Áo khoác Haori phủ vai, lưng & tà dưới rủ qua hông + dây haori-himo đỏ khóa vàng
    const haoriPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const r = 0.23 * (0.94 + 0.08 * Math.sin(t * Math.PI) + (1 - t) * 0.08);
      haoriPts.push(new THREE.Vector2(r, t * 0.64));
    }
    const haoriShoulderGeo = new THREE.LatheGeometry(
      haoriPts,
      20,
      Math.PI * 0.22,
      Math.PI * 1.56,
    );
    haoriShoulderGeo.scale(1.08, 1, 0.75);
    haoriShoulderGeo.computeVertexNormals();
    handles.geometries.push(haoriShoulderGeo);
    const haoriBack = new THREE.Mesh(haoriShoulderGeo, haoriOuterMat);
    haoriBack.position.set(0, torsoY - 0.11, -0.012);
    haoriBack.castShadow = true;
    upperRig.add(haoriBack);

    const cordGeo = new THREE.TorusGeometry(0.056, 0.007, 8, 16, Math.PI);
    cordGeo.rotateZ(Math.PI);
    const claspGeo = new THREE.SphereGeometry(0.013, 8, 8);
    const tasselGeo = createParabolicLatheGeometry(
      0.135,
      0.013,
      (t) => 0.35 + 0.65 * (1 - t),
      8,
      6,
      false,
    );
    handles.geometries.push(cordGeo, claspGeo, tasselGeo);

    const chestCord = new THREE.Mesh(cordGeo, redCollarMat);
    chestCord.position.set(0, torsoY + 0.33, 0.155);
    upperRig.add(chestCord);

    for (const cx of [-0.048, 0.048]) {
      const clasp = new THREE.Mesh(claspGeo, goldMat);
      clasp.position.set(cx, torsoY + 0.33, 0.155);
      upperRig.add(clasp);
    }

    const tasselL = new THREE.Mesh(tasselGeo, redCollarMat);
    tasselL.position.set(-0.028, torsoY + 0.18, 0.162);
    const tasselR = new THREE.Mesh(tasselGeo, redCollarMat);
    tasselR.position.set(0.028, torsoY + 0.17, 0.162);
    upperRig.add(tasselL, tasselR);
  } else {
    // Nơ Obi đỏ lụa thắt sau lưng & dây obijime kèm ngọc vàng trước eo Nữ
    const bowWingGeo = createParabolicEllipsoidGeometry(0.16, 0.098, 0.046, 14, 10);
    const bowCenterGeo = createParabolicEllipsoidGeometry(0.064, 0.064, 0.048, 12, 8);
    const bowTailGeo = createTaperedHairStrandGeometry(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.032, -0.12, -0.025),
        new THREE.Vector3(0.06, -0.25, -0.045),
      ],
      0.024,
      12,
      8,
      0.52,
    );
    const obijimeGeo = new THREE.TorusGeometry(0.138, 0.0072, 8, 22);
    obijimeGeo.rotateX(Math.PI / 2);
    obijimeGeo.scale(1.08, 0.74, 1);
    handles.geometries.push(bowWingGeo, bowCenterGeo, bowTailGeo, obijimeGeo);

    const obijime = new THREE.Mesh(obijimeGeo, redCollarMat);
    obijime.position.set(0, torsoY + 0.05, 0);
    upperRig.add(obijime);

    const obidomeGeo = createParabolicEllipsoidGeometry(0.042, 0.034, 0.022, 12, 8);
    handles.geometries.push(obidomeGeo);
    const obidome = new THREE.Mesh(obidomeGeo, goldMat);
    obidome.position.set(0, torsoY + 0.05, 0.106);
    upperRig.add(obidome);

    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, torsoY + 0.055, -0.112);
    const wingL = new THREE.Mesh(bowWingGeo, redCollarMat);
    wingL.position.set(-0.082, 0.02, 0);
    wingL.rotation.z = 0.34;
    const wingR = new THREE.Mesh(bowWingGeo, redCollarMat);
    wingR.position.set(0.082, 0.02, 0);
    wingR.rotation.z = -0.34;
    const bowCenter = new THREE.Mesh(bowCenterGeo, redCollarMat);
    const tailL = new THREE.Mesh(bowTailGeo, redCollarMat);
    tailL.position.set(-0.02, -0.02, -0.01);
    tailL.scale.x = -1;
    const tailR = new THREE.Mesh(bowTailGeo, redCollarMat);
    tailR.position.set(0.02, -0.02, -0.01);
    bowGroup.add(wingL, wingR, bowCenter, tailL, tailR);
    upperRig.add(bowGroup);
  }

  // 3. Cổ & Đầu parabol thanh tú + Mái tóc nhiều tầng lớp dẹt mượt (tạm bỏ mắt theo yêu cầu)
  const neckY = torsoY + torsoH - 0.02;
  const neckGeo = new THREE.CapsuleGeometry(isMale ? 0.055 : 0.042, 0.058, 6, 12);
  handles.geometries.push(neckGeo);
  const neckMesh = new THREE.Mesh(neckGeo, plainSkinMat);
  neckMesh.position.set(0, neckY + 0.04, 0.01);
  upperRig.add(neckMesh);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, neckY + (isMale ? 0.21 : 0.195), 0.015);
  const baseHeadRot = new THREE.Euler(0.03, isMale ? -0.045 : 0.045, isMale ? -0.02 : 0.025);
  headGroup.rotation.copy(baseHeadRot);
  upperRig.add(headGroup);

  // Khuôn mặt parabol thon gọn tự nhiên (không mắt - giữ nguyên yêu cầu tạm bỏ mắt)
  const headGeo = createParabolicLatheGeometry(
    0.295,
    isMale ? 0.134 : 0.128,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      if (t < 0.36) {
        return Math.pow(t / 0.36, 0.56) * 0.92;
      }
      const u = (t - 0.36) / 0.64;
      return (
        0.92 +
        0.08 * Math.sin(u * Math.PI) -
        Math.pow(Math.max(0, u - 0.32) / 0.68, 2) * 0.92
      );
    },
    26,
    20,
    true,
  );
  headGeo.scale(0.94, 1, 1.0);
  handles.geometries.push(headGeo);

  const headMesh = new THREE.Mesh(headGeo, skinMat);
  // Xoay UV khuôn mặt để má hồng nằm đúng phía +Z
  headMesh.rotation.y = -Math.PI / 2;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Sống mũi nhỏ thanh thoát ở chính giữa khuôn mặt (tạo chiều sâu ánh sáng mà không vẽ mắt)
  const noseGeo = createParabolicEllipsoidGeometry(0.016, 0.026, 0.018, 8, 6);
  handles.geometries.push(noseGeo);
  const noseMesh = new THREE.Mesh(noseGeo, plainSkinMat);
  noseMesh.position.set(0, -0.028, isMale ? 0.129 : 0.124);
  noseMesh.rotation.x = -0.25;
  headGroup.add(noseMesh);

  // Hai tai nhỏ tinh tế
  const earGeo = createParabolicEllipsoidGeometry(0.02, 0.046, 0.028, 10, 8);
  handles.geometries.push(earGeo);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, plainSkinMat);
    ear.position.set(side * 0.123, -0.01, -0.005);
    ear.rotation.z = side * -0.15;
    headGroup.add(ear);
  }

  // Mũ tóc gốc ôm sát đỉnh đầu & sau gáy
  const hairBaseR = isMale ? 0.145 : 0.14;
  const hairCapGeo = new THREE.SphereGeometry(
    hairBaseR,
    26,
    18,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.66,
  );
  const hairBackShellGeo = createParabolicEllipsoidGeometry(
    hairBaseR * 1.96,
    0.255,
    0.19,
    18,
    12,
  );
  handles.geometries.push(hairCapGeo, hairBackShellGeo);

  const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
  hairCap.position.set(0, 0.024, -0.008);
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  const hairBackShell = new THREE.Mesh(hairBackShellGeo, hairShadowMat);
  hairBackShell.position.set(0, -0.005, -0.068);
  hairBackShell.castShadow = true;
  headGroup.add(hairBackShell);

  // Các lọn tóc mái nhiều lớp dẹt mềm mại phủ trán & 2 bên má
  const bangPresets: Array<{ pts: THREE.Vector3[]; r: number; flat?: number }> = [
    {
      pts: [
        new THREE.Vector3(0, 0.145, 0.042),
        new THREE.Vector3(-0.018, 0.098, 0.136),
        new THREE.Vector3(-0.036, 0.012, 0.146),
      ],
      r: 0.027,
      flat: 0.58,
    },
    {
      pts: [
        new THREE.Vector3(0.012, 0.148, 0.045),
        new THREE.Vector3(0.028, 0.098, 0.137),
        new THREE.Vector3(0.045, 0.006, 0.145),
      ],
      r: 0.026,
      flat: 0.58,
    },
    {
      // Lọn mái chéo mảnh ở giữa trán
      pts: [
        new THREE.Vector3(-0.006, 0.15, 0.048),
        new THREE.Vector3(0.004, 0.09, 0.143),
        new THREE.Vector3(-0.008, 0.018, 0.148),
      ],
      r: 0.017,
      flat: 0.52,
    },
    {
      pts: [
        new THREE.Vector3(-0.04, 0.132, 0.03),
        new THREE.Vector3(-0.088, 0.08, 0.116),
        new THREE.Vector3(-0.105, -0.012, 0.118),
      ],
      r: 0.025,
      flat: 0.62,
    },
    {
      pts: [
        new THREE.Vector3(0.045, 0.132, 0.03),
        new THREE.Vector3(0.092, 0.075, 0.114),
        new THREE.Vector3(0.108, -0.016, 0.114),
      ],
      r: 0.025,
      flat: 0.62,
    },
    {
      // Lọn tóc mai dài bên trái ôm cằm
      pts: [
        new THREE.Vector3(-0.082, 0.105, 0.01),
        new THREE.Vector3(-0.128, 0.01, 0.07),
        new THREE.Vector3(-0.115, isMale ? -0.11 : -0.165, 0.082),
      ],
      r: isMale ? 0.023 : 0.02,
      flat: 0.62,
    },
    {
      // Lọn tóc mai dài bên phải ôm cằm
      pts: [
        new THREE.Vector3(0.082, 0.105, 0.01),
        new THREE.Vector3(0.128, 0.01, 0.07),
        new THREE.Vector3(0.115, isMale ? -0.11 : -0.165, 0.082),
      ],
      r: isMale ? 0.023 : 0.02,
      flat: 0.62,
    },
    {
      // Tóc mai phụ mảnh tạo độ bồng tự nhiên
      pts: [
        new THREE.Vector3(-0.068, 0.125, 0.018),
        new THREE.Vector3(-0.118, 0.04, 0.095),
        new THREE.Vector3(-0.122, -0.065, 0.095),
      ],
      r: 0.015,
      flat: 0.55,
    },
    {
      pts: [
        new THREE.Vector3(0.068, 0.125, 0.018),
        new THREE.Vector3(0.118, 0.04, 0.095),
        new THREE.Vector3(0.122, -0.065, 0.095),
      ],
      r: 0.015,
      flat: 0.55,
    },
  ];

  for (const preset of bangPresets) {
    const strandGeo = createTaperedHairStrandGeometry(
      preset.pts,
      preset.r,
      14,
      8,
      preset.flat ?? 0.62,
    );
    handles.geometries.push(strandGeo);
    const strandMesh = new THREE.Mesh(strandGeo, hairMat);
    strandMesh.castShadow = true;
    headGroup.add(strandMesh);
  }

  let ponytailKnot: THREE.Group | null = null;
  let sakuraOrnament: THREE.Group | null = null;

  if (isMale) {
    // Các lọn tóc gáy tỉa nhọn kiểu samurai bạch phát + lọn đỉnh tóc nhẹ
    for (let i = -3; i <= 3; i++) {
      const ang = i * 0.34;
      const backLockGeo = createTaperedHairStrandGeometry(
        [
          new THREE.Vector3(Math.sin(ang) * 0.06, 0.1, -0.06),
          new THREE.Vector3(Math.sin(ang) * 0.12, 0.0, -0.135 + Math.abs(i) * 0.01),
          new THREE.Vector3(Math.sin(ang) * 0.132, -0.135, -0.115 + Math.abs(i) * 0.012),
        ],
        0.03,
        12,
        8,
        0.6,
      );
      handles.geometries.push(backLockGeo);
      const backLock = new THREE.Mesh(backLockGeo, i % 2 === 0 ? hairMat : hairShadowMat);
      backLock.castShadow = true;
      headGroup.add(backLock);
    }
  } else {
    // Đuôi ngựa cao 6 lọn uốn S mềm mại + hoa anh đào nhụy vàng & ruy băng đỏ cho Nữ
    ponytailKnot = new THREE.Group();
    ponytailKnot.position.set(0.02, 0.095, -0.135);
    headGroup.add(ponytailKnot);

    sakuraOrnament = createSakuraOrnament(handles);
    sakuraOrnament.position.set(0.055, 0.01, -0.01);
    sakuraOrnament.rotation.set(-0.18, 0.45, 0.12);
    ponytailKnot.add(sakuraOrnament);

    const tailConfigs: Array<{ pts: THREE.Vector3[]; r: number; shadow?: boolean }> = [
      {
        pts: [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.02, -0.14, -0.09),
          new THREE.Vector3(0.035, -0.38, -0.14),
          new THREE.Vector3(0.06, -0.64, -0.09),
        ],
        r: 0.054,
      },
      {
        pts: [
          new THREE.Vector3(-0.02, -0.01, 0),
          new THREE.Vector3(-0.065, -0.16, -0.075),
          new THREE.Vector3(-0.095, -0.39, -0.12),
          new THREE.Vector3(-0.07, -0.6, -0.07),
        ],
        r: 0.037,
      },
      {
        pts: [
          new THREE.Vector3(0.02, -0.01, 0),
          new THREE.Vector3(0.085, -0.17, -0.07),
          new THREE.Vector3(0.11, -0.37, -0.115),
          new THREE.Vector3(0.13, -0.56, -0.06),
        ],
        r: 0.035,
      },
      {
        pts: [
          new THREE.Vector3(0, -0.02, -0.01),
          new THREE.Vector3(0.0, -0.2, -0.11),
          new THREE.Vector3(-0.02, -0.45, -0.165),
          new THREE.Vector3(0.01, -0.7, -0.12),
        ],
        r: 0.033,
        shadow: true,
      },
      {
        // Hai lọn tóc bay mỏng bên rìa tăng độ mượt
        pts: [
          new THREE.Vector3(-0.03, -0.02, 0.01),
          new THREE.Vector3(-0.11, -0.19, -0.05),
          new THREE.Vector3(-0.145, -0.41, -0.09),
          new THREE.Vector3(-0.12, -0.56, -0.03),
        ],
        r: 0.02,
      },
      {
        pts: [
          new THREE.Vector3(0.03, -0.02, 0.01),
          new THREE.Vector3(0.115, -0.21, -0.045),
          new THREE.Vector3(0.155, -0.42, -0.085),
          new THREE.Vector3(0.14, -0.55, -0.02),
        ],
        r: 0.019,
      },
    ];

    for (const cfg of tailConfigs) {
      const strandGeo = createTaperedHairStrandGeometry(cfg.pts, cfg.r, 16, 10, 0.66);
      handles.geometries.push(strandGeo);
      const strand = new THREE.Mesh(strandGeo, cfg.shadow ? hairShadowMat : hairMat);
      strand.castShadow = true;
      ponytailKnot.add(strand);
    }
  }

  // 4. Vai bo tròn gọn gàng + Tay áo kimono thu nhỏ (Nam màu cam, Nữ màu hồng) + Cánh tay & Bàn tay chi tiết
  const shoulderY = torsoY + torsoH - 0.065;
  const shoulderX = isMale ? 0.205 : 0.155;
  const armR = isMale ? 0.042 : 0.03;

  const shoulderCapGeo = new THREE.SphereGeometry(isMale ? 0.06 : 0.046, 14, 10);
  const upperArmGeo = new THREE.CapsuleGeometry(armR * 1.05, 0.165, 6, 12);
  const forearmGeo = new THREE.CapsuleGeometry(armR * 0.88, 0.185, 6, 12);
  const sleeveDrapeGeo = createDrapedKimonoSleeveGeometry(
    isMale ? 0.082 : 0.09,
    isMale ? 0.165 : 0.185,
    isMale ? 0.036 : 0.032,
  );
  const sleeveTrimGeo = new THREE.TorusGeometry(armR * 1.12, 0.0065, 8, 16);
  sleeveTrimGeo.rotateX(Math.PI / 2);
  handles.geometries.push(
    shoulderCapGeo,
    upperArmGeo,
    forearmGeo,
    sleeveDrapeGeo,
    sleeveTrimGeo,
  );

  // Tay phải (buông tự nhiên dọc bên thân)
  const rightArm = new THREE.Group();
  rightArm.position.set(shoulderX, shoulderY, 0);
  const baseRightArmRot = new THREE.Euler(0, 0, isMale ? -0.04 : -0.06);
  rightArm.rotation.copy(baseRightArmRot);

  const rShoulder = new THREE.Mesh(shoulderCapGeo, sleeveMat);
  const rUpper = new THREE.Mesh(upperArmGeo, sleeveMat);
  rUpper.position.set(0.014, -0.095, 0.014);
  rUpper.rotation.set(-0.24, 0, 0.14);

  const rDrape = new THREE.Mesh(sleeveDrapeGeo, sleeveMat);
  rDrape.position.set(0.002, -0.015, 0.008);
  rDrape.rotation.set(-0.14, -0.18, 0.1);
  rDrape.castShadow = true;

  const rTrim = new THREE.Mesh(sleeveTrimGeo, redCollarMat);
  rTrim.position.set(0.032, -0.175, 0.036);
  rTrim.rotation.set(-0.24, 0, 0.14);

  const rForearm = new THREE.Mesh(forearmGeo, plainSkinMat);
  rForearm.position.set(0.038, -0.245, 0.072);
  rForearm.rotation.set(-0.56, 0, 0.06);

  const rHand = createArticulatedHandGroup(
    isMale,
    'right',
    armR,
    handles,
    plainSkinMat,
    gloveMat,
  );
  rHand.position.set(0.044, -0.325, 0.132);
  rHand.rotation.set(0.32, -0.18, 0);
  rightArm.add(rShoulder, rUpper, rDrape, rTrim, rForearm, rHand);
  upperRig.add(rightArm);

  // Tay trái (đeo khiên nếu có + thả nhẹ gần chuôi kiếm bên hông)
  const leftArm = new THREE.Group();
  leftArm.position.set(-shoulderX, shoulderY, 0);
  const baseLeftArmRot = new THREE.Euler(0, 0, isMale ? 0.04 : 0.06);
  leftArm.rotation.copy(baseLeftArmRot);

  const lShoulder = new THREE.Mesh(shoulderCapGeo, sleeveMat);
  const lUpper = new THREE.Mesh(upperArmGeo, sleeveMat);
  lUpper.position.set(-0.014, -0.095, 0.016);
  lUpper.rotation.set(-0.26, 0, -0.14);

  const lDrape = new THREE.Mesh(sleeveDrapeGeo, sleeveMat);
  lDrape.scale.x = -1;
  lDrape.position.set(-0.002, -0.015, 0.008);
  lDrape.rotation.set(-0.14, 0.18, -0.1);
  lDrape.castShadow = true;

  const lTrim = new THREE.Mesh(sleeveTrimGeo, redCollarMat);
  lTrim.position.set(-0.032, -0.175, 0.038);
  lTrim.rotation.set(-0.26, 0, -0.14);

  const lForearm = new THREE.Mesh(forearmGeo, plainSkinMat);
  lForearm.position.set(-0.036, -0.24, 0.08);
  lForearm.rotation.set(-0.72, 0, -0.08);

  const lHand = createArticulatedHandGroup(
    isMale,
    'left',
    armR,
    handles,
    plainSkinMat,
    gloveMat,
  );
  lHand.position.set(-0.042, -0.312, 0.15);
  lHand.rotation.set(0.25, 0.18, 0);
  leftArm.add(lShoulder, lUpper, lDrape, lTrim, lForearm, lHand);

  if (showShield) {
    const shield = createShieldMeshGroup(handles);
    shield.scale.setScalar(isMale ? 0.68 : 0.56);
    shield.position.set(-0.105, -0.27, 0.175);
    shield.rotation.set(0.08, -Math.PI * 0.38, 0.08);
    leftArm.add(shield);
  }
  upperRig.add(leftArm);

  // Thanh kiếm Katana cất gọn trong vỏ đeo bên hông trái (chuôi & chắn tay hướng ra trước, vỏ kiếm chếch ra sau)
  if (showKatana) {
    const scabbard = createScabbardGroup(
      handles,
      isMale ? '#b91c1c' : '#dc2626',
      showIceKatana,
    );
    const katanaVariant = showIceKatana ? 'ice' : isMale ? 'normal' : 'crimson';
    const sheathedKatana = createKatanaMeshGroup(handles, showIceKatana, katanaVariant, true);
    sheathedKatana.scale.setScalar(0.92);
    sheathedKatana.position.set(0, -0.228, 0);
    scabbard.add(sheathedKatana);

    scabbard.position.set(-shoulderX * 0.94, torsoY + 0.02, 0.065);
    scabbard.rotation.set(-2.02, -0.12, 0.16);
    upperRig.add(scabbard);
  }

  const animRig: CharacterAnimRig = {
    isMale,
    upperRig,
    headGroup,
    rightArm,
    leftArm,
    ponytailKnot,
    sakuraOrnament,
    baseHeadRot,
    baseRightArmRot,
    baseLeftArmRot,
  };
  root.userData.animRig = animRig;

  return root;
}
