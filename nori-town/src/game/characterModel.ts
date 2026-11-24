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
 * Tạo một lọn tóc cong parabol thuôn nhọn dần theo đường cong CatmullRomCurve3 (không góc 90 độ).
 */
function createTaperedHairStrandGeometry(
  curvePoints: THREE.Vector3[],
  baseRadius: number,
  tubularSegments = 14,
  radialSegments = 8,
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
        ? 0.0008
        : baseRadius * Math.sin(Math.pow(1 - t, 0.72) * (Math.PI * 0.5)) * (0.38 + 0.62 * Math.sin(Math.min(1, t * 4) * (Math.PI * 0.5)));

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);

      // Hơi dẹt nhẹ để lọn tóc trông thanh thoát tự nhiên
      normal.x = cos * normalVec.x + sin * binormalVec.x;
      normal.y = cos * normalVec.y + sin * binormalVec.y;
      normal.z = cos * normalVec.z + sin * binormalVec.z;
      normal.normalize();

      N.copy(normal).multiplyScalar(r);
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
  s.lineTo(width, -0.02);
  s.quadraticCurveTo(width * 1.03, -dropLength * 0.65, width * 0.88, -dropLength);
  s.quadraticCurveTo(width * 0.45, -dropLength * 1.04, width * 0.08, -dropLength * 0.88);
  s.quadraticCurveTo(-0.03, -dropLength * 0.48, 0, 0);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.42,
    bevelSize: thickness * 0.36,
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
    roughness: 0.22,
    metalness: 0.35,
    clearcoat: 0.9,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: isIce ? '#7dd3fc' : '#eab308',
    roughness: 0.22,
    metalness: 0.85,
  });
  const cordMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.68,
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
  const petalMat = new THREE.MeshStandardMaterial({
    color: '#fbcfe8',
    emissive: '#f472b6',
    emissiveIntensity: 0.25,
    roughness: 0.36,
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: '#fb7185',
    roughness: 0.35,
  });
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: '#dc2626',
    roughness: 0.58,
  });
  handles.materials.push(petalMat, centerMat, ribbonMat);

  const petalGeo = createParabolicEllipsoidGeometry(0.048, 0.072, 0.02, 12, 8);
  const centerGeo = new THREE.SphereGeometry(0.022, 10, 8);
  const ribbonGeo = createTaperedHairStrandGeometry(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.02, -0.1, -0.02),
      new THREE.Vector3(0.05, -0.22, -0.04),
      new THREE.Vector3(0.09, -0.31, -0.03),
    ],
    0.018,
    12,
    8,
  );
  handles.geometries.push(petalGeo, centerGeo, ribbonGeo);

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.set(Math.cos(angle) * 0.038, Math.sin(angle) * 0.038, 0);
    petal.rotation.z = angle - Math.PI / 2;
    flower.add(petal);
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
 * Tạo hình mẫu nhân vật 3D mượt mà bằng đường cong Parabol (tạm ẩn mắt để bổ sung mẫu mắt sau):
 * - Nam: Tóc trắng bạc tầng lớp nhiều lọn, haori & kimono kem cổ đỏ, dây tua đỏ, hakama xếp nếp đen, Katana dựng vai.
 * - Nữ: Tóc đen đuôi ngựa cao đa lọn kèm hoa anh đào & ruy băng đỏ, kimono trắng cổ V viền đỏ,
 *       váy xếp ly trắng lót đỏ, nơ obi đỏ, tay áo kimono rủ thanh thoát, găng tay hở ngón tối màu, Katana đỏ.
 */
export function createCharacterMeshGroup(
  gender: CharacterGender,
  handles: CharacterAssetHandles,
  options: CharacterBuildOptions = {},
): THREE.Group {
  const root = new THREE.Group();
  const isMale = gender === 'male';
  const showKatana = Boolean(options.hasKatana || options.previewWeapon);
  const showIceKatana = Boolean(options.hasIceKatana && options.hasKatana);
  const showShield = Boolean(options.hasShield);

  const skinMat = new THREE.MeshStandardMaterial({
    color: isMale ? '#f5e3d6' : '#fcece4',
    roughness: isMale ? 0.52 : 0.42,
    metalness: 0.02,
  });
  const kimonoMainMat = new THREE.MeshStandardMaterial({
    color: isMale ? '#ebe4d6' : '#f8fafc',
    roughness: 0.72,
    metalness: 0.04,
  });
  const haoriOuterMat = new THREE.MeshStandardMaterial({
    color: '#ded6c5',
    roughness: 0.76,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const redCollarMat = new THREE.MeshStandardMaterial({
    color: isMale ? '#b91c1c' : '#dc2626',
    roughness: 0.56,
    metalness: 0.08,
  });
  const obiMat = new THREE.MeshStandardMaterial({
    color: '#18181b',
    roughness: 0.62,
    metalness: 0.14,
  });
  const hairMat = new THREE.MeshPhysicalMaterial({
    color: isMale ? '#f1f5f9' : '#16141d',
    roughness: isMale ? 0.34 : 0.26,
    metalness: 0.06,
    clearcoat: isMale ? 0.24 : 0.52,
    clearcoatRoughness: 0.28,
  });
  const hairShadowMat = new THREE.MeshStandardMaterial({
    color: isMale ? '#cbd5e1' : '#0d0c12',
    roughness: 0.45,
    metalness: 0.05,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#eab308',
    roughness: 0.24,
    metalness: 0.85,
  });
  const sandalMat = new THREE.MeshStandardMaterial({
    color: '#1c1917',
    roughness: 0.72,
    metalness: 0.08,
  });
  const sockMat = new THREE.MeshStandardMaterial({
    color: isMale ? '#f1f5f9' : '#18181b',
    roughness: 0.72,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#1e1b18',
    roughness: 0.66,
    metalness: 0.08,
  });
  handles.materials.push(
    skinMat,
    kimonoMainMat,
    haoriOuterMat,
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
  const shadowGeo = new THREE.PlaneGeometry(1.2, 1.2);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  handles.geometries.push(shadowGeo);
  handles.materials.push(shadowMat);
  const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
  groundShadow.position.y = 0.01;
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
      24,
      14,
      false,
    );
    // Tạo nếp gấp dọc đặc trưng của quần Hakama
    const hPos = hakamaLegGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < hPos.count; i++) {
      const hx = hPos.getX(i);
      const hz = hPos.getZ(i);
      if (Math.hypot(hx, hz) > 0.02) {
        const ang = Math.atan2(hz, hx);
        const pleat = 1 + Math.sin(ang * 8) * 0.045;
        hPos.setX(i, hx * pleat);
        hPos.setZ(i, hz * pleat);
      }
    }
    hakamaLegGeo.computeVertexNormals();
    handles.geometries.push(hakamaLegGeo);

    for (const sx of [-0.115, 0.115]) {
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
    const thighGeo = new THREE.CapsuleGeometry(0.061, 0.32, 6, 12);
    const calfGeo = new THREE.CapsuleGeometry(0.046, 0.34, 6, 12);
    handles.geometries.push(thighGeo, calfGeo);

    for (const sx of [-0.095, 0.095]) {
      const thigh = new THREE.Mesh(thighGeo, skinMat);
      thigh.position.set(sx, 0.62, 0);
      thigh.castShadow = true;
      root.add(thigh);

      const calf = new THREE.Mesh(calfGeo, sockMat);
      calf.position.set(sx, 0.27, 0);
      calf.castShadow = true;
      root.add(calf);

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
      0.45,
      0.34,
      (t) => {
        if (t >= 0.998) return 0;
        const flare = 1.0 - t * 0.48;
        return flare * (0.94 + 0.06 * Math.sin(t * Math.PI));
      },
      32,
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
        const pleat = 1 + Math.sin(ang * 16) * 0.065 * (1 - py / 0.46);
        pos.setX(i, px * pleat);
        pos.setZ(i, pz * pleat);
      }
    }
    outerSkirtGeo.computeVertexNormals();

    const innerSkirtGeo = createParabolicLatheGeometry(
      0.42,
      0.315,
      (t) => (t >= 0.998 ? 0 : 1.02 - t * 0.48),
      24,
      10,
      false,
    );
    handles.geometries.push(outerSkirtGeo, innerSkirtGeo);

    const outerSkirt = new THREE.Mesh(outerSkirtGeo, kimonoMainMat);
    outerSkirt.position.set(0, 0.56, 0);
    outerSkirt.castShadow = true;
    root.add(outerSkirt);

    const innerSkirt = new THREE.Mesh(innerSkirtGeo, redCollarMat);
    innerSkirt.position.set(0, 0.542, 0);
    root.add(innerSkirt);
  }

  // 2. Thân trên parabol mượt + Cổ áo V-lapel viền đỏ + Áo Haori (Nam) + Đai Obi
  const torsoH = isMale ? 0.54 : 0.48;
  const torsoY = isMale ? 0.88 : 0.93;
  const torsoGeo = createParabolicLatheGeometry(
    torsoH,
    isMale ? 0.215 : 0.168,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      if (isMale) {
        return 0.76 + 0.24 * Math.sin(t * Math.PI * 0.88);
      }
      return 0.66 + 0.3 * Math.sin(Math.pow(t, 0.84) * Math.PI * 0.9);
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
  root.add(torsoMesh);

  // Nẹp cổ chữ V Kimono bắt chéo ôm ngực (trắng + viền đỏ trong)
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
  );
  handles.geometries.push(lapelLeftGeo, lapelRightGeo);
  root.add(new THREE.Mesh(lapelLeftGeo, redCollarMat));
  root.add(new THREE.Mesh(lapelRightGeo, redCollarMat));

  // Cổ sau màu đỏ ôm gáy
  const backCollarGeo = new THREE.TorusGeometry(isMale ? 0.095 : 0.076, 0.017, 10, 18, Math.PI * 1.15);
  backCollarGeo.rotateX(Math.PI * 0.5);
  backCollarGeo.rotateZ(-Math.PI * 0.08);
  handles.geometries.push(backCollarGeo);
  const backCollar = new THREE.Mesh(backCollarGeo, redCollarMat);
  backCollar.position.set(0, torsoY + torsoH - 0.015, 0.005);
  root.add(backCollar);

  // Đai Obi đen thắt eo
  const obiGeo = createParabolicLatheGeometry(
    isMale ? 0.125 : 0.12,
    isMale ? 0.186 : 0.136,
    (t) => 0.96 + 0.04 * Math.sin(t * Math.PI),
    22,
    8,
    false,
  );
  obiGeo.scale(1.08, 1, 0.74);
  handles.geometries.push(obiGeo);
  const obiMesh = new THREE.Mesh(obiGeo, obiMat);
  obiMesh.position.set(0, torsoY - 0.01, 0);
  obiMesh.castShadow = true;
  root.add(obiMesh);

  if (isMale) {
    // Áo khoác Haori phủ vai và lưng hở ngực chữ V + dây haori-himo đỏ có tua rua ở ngực Nam
    const haoriPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const r = 0.228 * (0.88 + 0.12 * Math.sin(t * Math.PI));
      haoriPts.push(new THREE.Vector2(r, t * 0.48));
    }
    const haoriShoulderGeo = new THREE.LatheGeometry(
      haoriPts,
      18,
      Math.PI * 0.22,
      Math.PI * 1.56,
    );
    haoriShoulderGeo.scale(1.08, 1, 0.74);
    haoriShoulderGeo.computeVertexNormals();
    handles.geometries.push(haoriShoulderGeo);
    const haoriBack = new THREE.Mesh(haoriShoulderGeo, haoriOuterMat);
    haoriBack.position.set(0, torsoY + 0.05, -0.01);
    haoriBack.castShadow = true;
    root.add(haoriBack);

    const cordGeo = new THREE.TorusGeometry(0.056, 0.007, 8, 16, Math.PI);
    cordGeo.rotateZ(Math.PI);
    const tasselGeo = createParabolicLatheGeometry(
      0.13,
      0.013,
      (t) => 0.35 + 0.65 * (1 - t),
      8,
      6,
      false,
    );
    handles.geometries.push(cordGeo, tasselGeo);

    const chestCord = new THREE.Mesh(cordGeo, redCollarMat);
    chestCord.position.set(0, torsoY + 0.33, 0.155);
    root.add(chestCord);

    const tasselL = new THREE.Mesh(tasselGeo, redCollarMat);
    tasselL.position.set(-0.028, torsoY + 0.18, 0.162);
    const tasselR = new THREE.Mesh(tasselGeo, redCollarMat);
    tasselR.position.set(0.028, torsoY + 0.17, 0.162);
    root.add(tasselL, tasselR);
  } else {
    // Nơ Obi đỏ thắt sau lưng & dây cột vàng nhỏ trước eo Nữ
    const bowWingGeo = createParabolicEllipsoidGeometry(0.155, 0.095, 0.048, 12, 8);
    const bowCenterGeo = createParabolicEllipsoidGeometry(0.065, 0.065, 0.048, 10, 8);
    const bowTailGeo = createTaperedHairStrandGeometry(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.03, -0.11, -0.025),
        new THREE.Vector3(0.055, -0.23, -0.04),
      ],
      0.024,
      10,
      8,
    );
    const obijimeGeo = new THREE.TorusGeometry(0.138, 0.007, 8, 20);
    obijimeGeo.rotateX(Math.PI / 2);
    obijimeGeo.scale(1.08, 0.74, 1);
    handles.geometries.push(bowWingGeo, bowCenterGeo, bowTailGeo, obijimeGeo);

    const obijime = new THREE.Mesh(obijimeGeo, redCollarMat);
    obijime.position.set(0, torsoY + 0.05, 0);
    root.add(obijime);

    const obidomeGeo = new THREE.SphereGeometry(0.018, 10, 8);
    handles.geometries.push(obidomeGeo);
    const obidome = new THREE.Mesh(obidomeGeo, goldMat);
    obidome.position.set(0, torsoY + 0.05, 0.106);
    root.add(obidome);

    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, torsoY + 0.055, -0.112);
    const wingL = new THREE.Mesh(bowWingGeo, redCollarMat);
    wingL.position.set(-0.08, 0.02, 0);
    wingL.rotation.z = 0.34;
    const wingR = new THREE.Mesh(bowWingGeo, redCollarMat);
    wingR.position.set(0.08, 0.02, 0);
    wingR.rotation.z = -0.34;
    const bowCenter = new THREE.Mesh(bowCenterGeo, redCollarMat);
    const tailL = new THREE.Mesh(bowTailGeo, redCollarMat);
    tailL.position.set(-0.02, -0.02, -0.01);
    tailL.scale.x = -1;
    const tailR = new THREE.Mesh(bowTailGeo, redCollarMat);
    tailR.position.set(0.02, -0.02, -0.01);
    bowGroup.add(wingL, wingR, bowCenter, tailL, tailR);
    root.add(bowGroup);
  }

  // 3. Cổ & Đầu parabol thanh tú + Mái tóc nhiều tầng lớp (tạm bỏ mắt theo yêu cầu)
  const neckY = torsoY + torsoH - 0.02;
  const neckGeo = new THREE.CapsuleGeometry(isMale ? 0.056 : 0.044, 0.055, 6, 12);
  handles.geometries.push(neckGeo);
  const neckMesh = new THREE.Mesh(neckGeo, skinMat);
  neckMesh.position.set(0, neckY + 0.04, 0.01);
  root.add(neckMesh);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, neckY + (isMale ? 0.21 : 0.195), 0.015);
  root.add(headGroup);

  // Khuôn mặt parabol thon gọn tự nhiên (không mắt - sẽ thêm mẫu mắt sau)
  const headGeo = createParabolicLatheGeometry(
    0.295,
    isMale ? 0.136 : 0.13,
    (t) => {
      if (t <= 0.002 || t >= 0.998) return 0;
      if (t < 0.36) {
        return Math.pow(t / 0.36, 0.56) * 0.92;
      }
      const u = (t - 0.36) / 0.64;
      return 0.92 + 0.08 * Math.sin(u * Math.PI) - Math.pow(Math.max(0, u - 0.32) / 0.68, 2) * 0.92;
    },
    24,
    18,
    true,
  );
  headGeo.scale(0.94, 1, 1.0);
  handles.geometries.push(headGeo);

  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Hai tai nhỏ tinh tế
  const earGeo = createParabolicEllipsoidGeometry(0.022, 0.048, 0.03, 10, 8);
  handles.geometries.push(earGeo);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, skinMat);
    ear.position.set(side * 0.125, -0.01, -0.005);
    ear.rotation.z = side * -0.15;
    headGroup.add(ear);
  }

  // Mũ tóc gốc ôm sát đỉnh đầu & sau gáy
  const hairBaseR = isMale ? 0.146 : 0.141;
  const hairCapGeo = new THREE.SphereGeometry(
    hairBaseR,
    24,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.66,
  );
  const hairBackShellGeo = createParabolicEllipsoidGeometry(
    hairBaseR * 1.95,
    0.25,
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

  // Tạo các lọn tóc mái cong parabol tự nhiên phủ trán & 2 bên má
  const bangPresets: Array<{ pts: THREE.Vector3[]; r: number }> = [
    {
      pts: [
        new THREE.Vector3(0, 0.14, 0.04),
        new THREE.Vector3(-0.02, 0.095, 0.135),
        new THREE.Vector3(-0.042, 0.015, 0.145),
      ],
      r: 0.028,
    },
    {
      pts: [
        new THREE.Vector3(0.01, 0.145, 0.045),
        new THREE.Vector3(0.032, 0.095, 0.136),
        new THREE.Vector3(0.05, 0.01, 0.144),
      ],
      r: 0.027,
    },
    {
      pts: [
        new THREE.Vector3(-0.04, 0.13, 0.03),
        new THREE.Vector3(-0.088, 0.08, 0.115),
        new THREE.Vector3(-0.105, -0.01, 0.116),
      ],
      r: 0.026,
    },
    {
      pts: [
        new THREE.Vector3(0.045, 0.13, 0.03),
        new THREE.Vector3(0.092, 0.075, 0.112),
        new THREE.Vector3(0.108, -0.015, 0.112),
      ],
      r: 0.026,
    },
    {
      // Lọn tóc mai bên trái ôm cằm
      pts: [
        new THREE.Vector3(-0.08, 0.1, 0.01),
        new THREE.Vector3(-0.128, 0.01, 0.068),
        new THREE.Vector3(-0.118, isMale ? -0.1 : -0.15, 0.078),
      ],
      r: isMale ? 0.025 : 0.022,
    },
    {
      // Lọn tóc mai bên phải ôm cằm
      pts: [
        new THREE.Vector3(0.08, 0.1, 0.01),
        new THREE.Vector3(0.128, 0.01, 0.068),
        new THREE.Vector3(0.118, isMale ? -0.1 : -0.15, 0.078),
      ],
      r: isMale ? 0.025 : 0.022,
    },
  ];

  for (const preset of bangPresets) {
    const strandGeo = createTaperedHairStrandGeometry(preset.pts, preset.r, 12, 8);
    handles.geometries.push(strandGeo);
    const strandMesh = new THREE.Mesh(strandGeo, hairMat);
    strandMesh.castShadow = true;
    headGroup.add(strandMesh);
  }

  if (isMale) {
    // Các lọn tóc gáy tỉa nhọn kiểu samurai bạch phát (che mượt gáy từ mọi góc)
    for (let i = -3; i <= 3; i++) {
      const ang = i * 0.34;
      const backLockGeo = createTaperedHairStrandGeometry(
        [
          new THREE.Vector3(Math.sin(ang) * 0.06, 0.1, -0.06),
          new THREE.Vector3(Math.sin(ang) * 0.12, 0.0, -0.135 + Math.abs(i) * 0.01),
          new THREE.Vector3(Math.sin(ang) * 0.13, -0.125, -0.115 + Math.abs(i) * 0.012),
        ],
        0.032,
        10,
        8,
      );
      handles.geometries.push(backLockGeo);
      const backLock = new THREE.Mesh(backLockGeo, i % 2 === 0 ? hairMat : hairShadowMat);
      backLock.castShadow = true;
      headGroup.add(backLock);
    }
  } else {
    // Đuôi ngựa cao nhiều lọn tóc uốn S mềm mại + hoa anh đào & ruy băng đỏ cho Nữ
    const ponytailKnot = new THREE.Group();
    ponytailKnot.position.set(0.02, 0.095, -0.135);
    headGroup.add(ponytailKnot);

    const sakura = createSakuraOrnament(handles);
    sakura.position.set(0.055, 0.01, -0.01);
    sakura.rotation.set(-0.18, 0.45, 0.12);
    ponytailKnot.add(sakura);

    const tailConfigs: Array<{ pts: THREE.Vector3[]; r: number }> = [
      {
        pts: [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.02, -0.14, -0.09),
          new THREE.Vector3(0.035, -0.38, -0.14),
          new THREE.Vector3(0.06, -0.62, -0.09),
        ],
        r: 0.056,
      },
      {
        pts: [
          new THREE.Vector3(-0.02, -0.01, 0),
          new THREE.Vector3(-0.065, -0.16, -0.075),
          new THREE.Vector3(-0.095, -0.39, -0.12),
          new THREE.Vector3(-0.07, -0.58, -0.07),
        ],
        r: 0.038,
      },
      {
        pts: [
          new THREE.Vector3(0.02, -0.01, 0),
          new THREE.Vector3(0.085, -0.17, -0.07),
          new THREE.Vector3(0.11, -0.37, -0.115),
          new THREE.Vector3(0.13, -0.55, -0.06),
        ],
        r: 0.036,
      },
      {
        pts: [
          new THREE.Vector3(0, -0.02, -0.01),
          new THREE.Vector3(0.0, -0.2, -0.11),
          new THREE.Vector3(-0.02, -0.45, -0.165),
          new THREE.Vector3(0.01, -0.68, -0.12),
        ],
        r: 0.034,
      },
    ];

    for (let idx = 0; idx < tailConfigs.length; idx++) {
      const cfg = tailConfigs[idx];
      const strandGeo = createTaperedHairStrandGeometry(cfg.pts, cfg.r, 16, 10);
      handles.geometries.push(strandGeo);
      const strand = new THREE.Mesh(strandGeo, idx === 3 ? hairShadowMat : hairMat);
      strand.castShadow = true;
      ponytailKnot.add(strand);
    }
  }

  // 4. Vai bo tròn khớp liền + Tay áo kimono rủ xuống (không trồi lên trên vai) + Cánh tay
  const shoulderY = torsoY + torsoH - 0.065;
  const shoulderX = isMale ? 0.228 : 0.172;
  const armR = isMale ? 0.052 : 0.035;

  const shoulderCapGeo = new THREE.SphereGeometry(isMale ? 0.082 : 0.064, 14, 10);
  const upperArmGeo = new THREE.CapsuleGeometry(armR * 1.18, 0.2, 6, 12);
  const forearmGeo = new THREE.CapsuleGeometry(armR * 0.86, 0.2, 6, 12);
  const handGeo = createParabolicEllipsoidGeometry(armR * 1.38, armR * 1.55, armR * 1.1, 10, 8);
  const sleeveDrapeGeo = createDrapedKimonoSleeveGeometry(
    isMale ? 0.17 : 0.19,
    isMale ? 0.26 : 0.31,
    isMale ? 0.075 : 0.065,
  );
  const sleeveTrimGeo = new THREE.TorusGeometry(armR * 1.24, 0.008, 8, 16);
  sleeveTrimGeo.rotateX(Math.PI / 2);
  handles.geometries.push(
    shoulderCapGeo,
    upperArmGeo,
    forearmGeo,
    handGeo,
    sleeveDrapeGeo,
    sleeveTrimGeo,
  );

  const upperMat = isMale ? haoriOuterMat : kimonoMainMat;

  // Tay phải (cầm Katana)
  const rightArm = new THREE.Group();
  rightArm.position.set(shoulderX, shoulderY, 0);

  const rShoulder = new THREE.Mesh(shoulderCapGeo, upperMat);
  const rUpper = new THREE.Mesh(upperArmGeo, upperMat);
  rUpper.position.set(0.025, -0.11, 0.02);
  rUpper.rotation.set(-0.32, 0, 0.22);

  // Tay áo kimono rủ tự nhiên xuống dưới khuỷu tay
  const rDrape = new THREE.Mesh(sleeveDrapeGeo, upperMat);
  rDrape.position.set(0.01, -0.02, 0.015);
  rDrape.rotation.set(-0.18, -0.22, 0.18);
  rDrape.castShadow = true;

  const rTrim = new THREE.Mesh(sleeveTrimGeo, redCollarMat);
  rTrim.position.set(0.048, -0.21, 0.055);
  rTrim.rotation.set(-0.32, 0, 0.22);

  const rForearm = new THREE.Mesh(forearmGeo, skinMat);
  rForearm.position.set(0.05, -0.21, 0.145);
  rForearm.rotation.set(isMale ? -1.42 : -1.78, 0, 0.16);

  const rHand = new THREE.Mesh(handGeo, isMale ? skinMat : gloveMat);
  rHand.position.set(0.032, isMale ? -0.175 : -0.125, 0.245);
  rightArm.add(rShoulder, rUpper, rDrape, rTrim, rForearm, rHand);

  if (showKatana) {
    const katanaVariant = showIceKatana ? 'ice' : isMale ? 'normal' : 'crimson';
    const katana = createKatanaMeshGroup(handles, showIceKatana, katanaVariant);
    katana.scale.setScalar(0.92);
    if (isMale) {
      katana.position.set(0.032, -0.23, 0.255);
      katana.rotation.set(0.32, 0.1, 0.34);
    } else {
      katana.position.set(0.032, -0.135, 0.255);
      katana.rotation.set(0.55, -0.18, 0.24);
    }
    rightArm.add(katana);
  }
  root.add(rightArm);

  // Tay trái (đeo khiên nếu có + vỏ kiếm bên hông)
  const leftArm = new THREE.Group();
  leftArm.position.set(-shoulderX, shoulderY, 0);

  const lShoulder = new THREE.Mesh(shoulderCapGeo, upperMat);
  const lUpper = new THREE.Mesh(upperArmGeo, upperMat);
  lUpper.position.set(-0.025, -0.11, 0.02);
  lUpper.rotation.set(-0.26, 0, -0.2);

  const lDrape = new THREE.Mesh(sleeveDrapeGeo, upperMat);
  lDrape.scale.x = -1;
  lDrape.position.set(-0.01, -0.02, 0.015);
  lDrape.rotation.set(-0.14, 0.22, -0.16);
  lDrape.castShadow = true;

  const lTrim = new THREE.Mesh(sleeveTrimGeo, redCollarMat);
  lTrim.position.set(-0.048, -0.21, 0.048);
  lTrim.rotation.set(-0.26, 0, -0.2);

  const lForearm = new THREE.Mesh(forearmGeo, skinMat);
  lForearm.position.set(-0.048, -0.26, 0.1);
  lForearm.rotation.set(-0.92, 0, -0.1);

  const lHand = new THREE.Mesh(handGeo, isMale ? skinMat : gloveMat);
  lHand.position.set(-0.056, -0.3, 0.195);
  leftArm.add(lShoulder, lUpper, lDrape, lTrim, lForearm, lHand);

  if (showShield) {
    const shield = createShieldMeshGroup(handles);
    shield.scale.setScalar(isMale ? 0.68 : 0.56);
    shield.position.set(-0.125, -0.27, 0.21);
    shield.rotation.set(0.08, -Math.PI * 0.38, 0.08);
    leftArm.add(shield);
  }
  root.add(leftArm);

  // Vỏ kiếm bên hông trái hướng ra sau tự nhiên
  if (showKatana) {
    const scabbard = createScabbardGroup(
      handles,
      isMale ? '#b91c1c' : '#dc2626',
      showIceKatana,
    );
    scabbard.position.set(-shoulderX * 0.88, torsoY + 0.04, 0.08);
    scabbard.rotation.set(-2.15, -0.14, 0.2);
    root.add(scabbard);
  }

  return root;
}
