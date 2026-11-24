import * as THREE from 'three';
import { WALL_HEIGHT } from './citadel';
import { createParabolicEllipsoidGeometry, createParabolicLatheGeometry } from './parabolic';

const GROUND_Y = 4.0;
const WALL_CENTER = 24.0; // -25..24 voxel blocks => tâm tường tại ±24.0
const CURTAIN_TOP_Y = GROUND_Y + WALL_HEIGHT; // y = 29.0 (50x50x25)

function seededRand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function scaleGeometryUVs(geo: THREE.BufferGeometry, uvScale: number): void {
  const uv = geo.getAttribute('uv');
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
  }
  uv.needsUpdate = true;
}

/**
 * Tạo texture gạch đá cổ điển nhiều sắc độ xám-nâu-đá phiến (giống mẫu) + bump & roughness map.
 */
function createCastleStoneTextures(maxAnisotropy: number): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Nền vữa tối sâu giữa các khe đá
  cCtx.fillStyle = '#2c2927';
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#1d1d1d';
  bCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#f2f2f2';
  rCtx.fillRect(0, 0, size, size);

  // Phân phối màu gạch đá cổ giống ảnh mẫu (xám ấm, đá phiến lạnh, than sẫm, đá vôi sáng)
  const palette: Array<{ hex: string; weight: number }> = [
    { hex: '#7c756d', weight: 22 },
    { hex: '#888076', weight: 18 },
    { hex: '#6e6861', weight: 16 },
    { hex: '#646a70', weight: 14 },
    { hex: '#737980', weight: 10 },
    { hex: '#55595e', weight: 10 },
    { hex: '#4a4c4f', weight: 5 },
    { hex: '#968d80', weight: 5 },
  ];
  const weightedPalette: string[] = [];
  for (const item of palette) {
    for (let k = 0; k < item.weight; k++) weightedPalette.push(item.hex);
  }

  const rows = 12;
  const rowH = size / rows;
  const gap = 3.2;

  const drawStone = (
    x: number,
    y: number,
    w: number,
    h: number,
    baseHex: string,
    seedVal: number,
  ) => {
    const r0 = seededRand(seedVal + 1.3);
    const r1 = seededRand(seedVal + 7.9);
    const r2 = seededRand(seedVal + 19.1);
    const rad = Math.min(6.5, h * 0.16, w * 0.12);

    const sx = x + gap * 0.5;
    const sy = y + gap * 0.5;
    const sw = Math.max(8, w - gap);
    const sh = Math.max(8, h - gap);

    const traceRoundedStone = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.moveTo(sx + rad, sy);
      ctx.lineTo(sx + sw - rad, sy);
      ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + rad);
      ctx.lineTo(sx + sw, sy + sh - rad);
      ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - rad, sy + sh);
      ctx.lineTo(sx + rad, sy + sh);
      ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - rad);
      ctx.lineTo(sx, sy + rad);
      ctx.quadraticCurveTo(sx, sy, sx + rad, sy);
      ctx.closePath();
    };

    // Màu đá chính + ánh sáng vát cạnh trên/dưới
    const c = new THREE.Color(baseHex);
    const lumShift = (r0 - 0.5) * 0.11;
    c.offsetHSL((r1 - 0.5) * 0.015, (r2 - 0.5) * 0.04, lumShift);

    traceRoundedStone(cCtx);
    const grad = cCtx.createLinearGradient(sx, sy, sx + sw * 0.4, sy + sh);
    const topCol = c.clone().offsetHSL(0, 0, 0.05).getStyle();
    const botCol = c.clone().offsetHSL(0, 0, -0.07).getStyle();
    grad.addColorStop(0, topCol);
    grad.addColorStop(0.55, c.getStyle());
    grad.addColorStop(1, botCol);
    cCtx.fillStyle = grad;
    cCtx.fill();

    // Viền vát nhẹ trên mặt đá
    cCtx.strokeStyle = 'rgba(255,248,236,0.09)';
    cCtx.lineWidth = 1.5;
    cCtx.stroke();

    // Vệt khoáng & rỗ đá tự nhiên bên trong mỗi viên gạch
    for (let s = 0; s < 5; s++) {
      const px = sx + seededRand(seedVal + s * 11.7) * sw;
      const py = sy + seededRand(seedVal + s * 23.3) * sh;
      const pr = 2 + seededRand(seedVal + s * 31.1) * 5;
      cCtx.fillStyle = s % 2 === 0 ? 'rgba(20,20,22,0.14)' : 'rgba(225,220,210,0.09)';
      cCtx.beginPath();
      cCtx.ellipse(px, py, pr * 1.4, pr * 0.8, r1 * Math.PI, 0, Math.PI * 2);
      cCtx.fill();
    }

    // Bump map (viên đá nổi gờ cao hơn vữa)
    const bumpVal = Math.round(165 + r0 * 55);
    traceRoundedStone(bCtx);
    bCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
    bCtx.fill();
    bCtx.strokeStyle = 'rgb(95,95,95)';
    bCtx.lineWidth = 2.5;
    bCtx.stroke();

    // Roughness map (mặt đá mịn hơn chút so với vữa thô)
    const roughVal = Math.round(192 + r2 * 36);
    traceRoundedStone(rCtx);
    rCtx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
    rCtx.fill();
  };

  for (let row = 0; row < rows; row++) {
    const y = row * rowH;
    const rowSeed = row * 97.31;
    let cursor = -((seededRand(rowSeed) * 0.65) * 64);
    let colIdx = 0;

    // Lưu gạch đầu để vẽ lặp seamless ở rìa phải
    const rowBlocks: Array<{ x: number; w: number; hex: string; s: number }> = [];
    while (cursor < size) {
      const s = rowSeed + colIdx * 17.77;
      const w = 42 + seededRand(s + 3.1) * 52;
      const pIdx = Math.floor(seededRand(s + 9.4) * weightedPalette.length);
      rowBlocks.push({ x: cursor, w, hex: weightedPalette[pIdx], s });
      cursor += w;
      colIdx++;
    }

    for (const blk of rowBlocks) {
      drawStone(blk.x, y, blk.w, rowH, blk.hex, blk.s);
      if (blk.x < 0) {
        drawStone(blk.x + size, y, blk.w, rowH, blk.hex, blk.s);
      }
      if (blk.x + blk.w > size) {
        drawStone(blk.x - size, y, blk.w, rowH, blk.hex, blk.s);
      }
    }
  }

  // Hạt nhiễu đá mịn toàn cục
  for (let i = 0; i < 2400; i++) {
    const nx = seededRand(i * 1.13) * size;
    const ny = seededRand(i * 2.71) * size;
    const bright = seededRand(i * 5.17) > 0.5;
    cCtx.fillStyle = bright ? 'rgba(255,250,240,0.06)' : 'rgba(18,16,14,0.08)';
    cCtx.fillRect(nx, ny, 2, 2);

    bCtx.fillStyle = bright ? 'rgba(245,245,245,0.14)' : 'rgba(40,40,40,0.16)';
    bCtx.fillRect(nx, ny, 2, 2);
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { colorMap, bumpMap, roughnessMap };
}

/**
 * Tạo texture đường lát đá cuội bo tròn trước cổng thành giống mẫu.
 */
function createCobbleTextures(maxAnisotropy: number): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const cCtx = cCanvas.getContext('2d')!;

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d')!;

  cCtx.fillStyle = '#332c27';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#181818';
  bCtx.fillRect(0, 0, size, size);

  const cobbleColors = ['#6e645b', '#7b7066', '#5c534c', '#857a70', '#645c56', '#726a62'];
  const rows = 14;
  const cols = 10;
  const cellW = size / cols;
  const cellH = size / rows;

  const drawCobble = (cx: number, cy: number, rx: number, ry: number, rot: number, hex: string, lum: number) => {
    const col = new THREE.Color(hex).offsetHSL(0, 0, lum);
    cCtx.save();
    cCtx.translate(cx, cy);
    cCtx.rotate(rot);
    const grad = cCtx.createRadialGradient(-rx * 0.25, -ry * 0.25, 2, 0, 0, Math.max(rx, ry));
    grad.addColorStop(0, col.clone().offsetHSL(0, 0, 0.08).getStyle());
    grad.addColorStop(0.7, col.getStyle());
    grad.addColorStop(1, col.clone().offsetHSL(0, 0, -0.1).getStyle());
    cCtx.fillStyle = grad;
    cCtx.beginPath();
    cCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.restore();

    bCtx.save();
    bCtx.translate(cx, cy);
    bCtx.rotate(rot);
    const bGrad = bCtx.createRadialGradient(0, 0, 2, 0, 0, Math.max(rx, ry));
    bGrad.addColorStop(0, '#ededed');
    bGrad.addColorStop(0.78, '#a6a6a6');
    bGrad.addColorStop(1, '#262626');
    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    bCtx.fill();
    bCtx.restore();
  };

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : cellW * 0.5;
    for (let c = 0; c < cols; c++) {
      const s = r * 43.1 + c * 17.9;
      const cx = (c * cellW + offset + (seededRand(s) - 0.5) * 8 + size) % size;
      const cy = r * cellH + cellH * 0.5 + (seededRand(s + 2) - 0.5) * 5;
      const rx = cellW * (0.37 + seededRand(s + 4) * 0.11);
      const ry = cellH * (0.36 + seededRand(s + 6) * 0.1);
      const rot = (seededRand(s + 8) - 0.5) * 0.45;
      const hex = cobbleColors[Math.floor(seededRand(s + 10) * cobbleColors.length)];
      const lum = (seededRand(s + 12) - 0.5) * 0.08;

      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const px = cx + ox;
          const py = cy + oy;
          if (px > -cellW && px < size + cellW && py > -cellH && py < size + cellH) {
            drawCobble(px, py, rx, ry, rot, hex, lum);
          }
        }
      }
    }
  }

  const colorMap = new THREE.CanvasTexture(cCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { colorMap, bumpMap };
}

function createLanternGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 240, 190, 1.0)');
  grad.addColorStop(0.24, 'rgba(255, 185, 78, 0.85)');
  grad.addColorStop(0.55, 'rgba(255, 130, 32, 0.34)');
  grad.addColorStop(1, 'rgba(255, 100, 15, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Tạo vật liệu đá thành phong hóa theo thế giới (phân phối rêu ẩm chân thành + vệt sáng tối tự nhiên).
 */
function createWeatheredCastleStoneMaterial(
  colorMap: THREE.CanvasTexture,
  bumpMap: THREE.CanvasTexture,
  roughnessMap: THREE.CanvasTexture,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: colorMap,
    bumpMap,
    bumpScale: 0.085,
    roughnessMap,
    roughness: 0.88,
    metalness: 0.05,
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `varying vec3 vCastleWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vCastleWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader =
      `varying vec3 vCastleWorldPos;
      float hashCastle(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noiseCastle(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hashCastle(i), hashCastle(i + vec2(1.0, 0.0)), u.x),
          mix(hashCastle(i + vec2(0.0, 1.0)), hashCastle(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }\n` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Phân phối sắc độ gạch đá lớn theo tọa độ thế giới để không bị lặp vân
        float macroA = noiseCastle(vCastleWorldPos.xz * 0.14 + vec2(vCastleWorldPos.y * 0.18, 0.0));
        float macroB = noiseCastle(vCastleWorldPos.xy * 0.27 + vCastleWorldPos.zy * 0.21);
        float stoneMottle = 0.85 + macroA * 0.16 + macroB * 0.09;

        // Chân thành hơi sẫm ẩm và ám rêu đất tự nhiên
        float groundAO = mix(0.68, 1.0, smoothstep(4.0, 8.2, vCastleWorldPos.y));
        float mossMask = 1.0 - smoothstep(4.0, 5.8, vCastleWorldPos.y);
        vec3 mossTint = mix(vec3(1.0), vec3(0.84, 0.90, 0.76), mossMask * 0.55);

        // Vệt tối nhẹ dưới phần gờ dầm đỡ trên đỉnh tường
        float corbelShade = 1.0 - 0.18 * exp(-pow((vCastleWorldPos.y - 25.4) * 0.85, 2.0));

        diffuseColor.rgb *= stoneMottle * groundAO * mossTint * corbelShade;`,
      );
  };
  mat.customProgramCacheKey = () => 'citadel-weathered-stone-v1';
  return mat;
}

/**
 * Tạo hình học tháp bát giác vát cạnh mềm thuôn nhẹ lên trên (không có góc cạnh 90 độ).
 */
function createChamferedTowerShaftGeometry(
  height: number,
  radiusBottom: number,
  radiusTop: number,
  radialSegments = 24,
  heightSegments = 16,
): THREE.BufferGeometry {
  const geo = createParabolicLatheGeometry(
    height,
    1,
    (t) => {
      if (t <= 0.001) return radiusBottom * 0.99;
      if (t >= 0.999) return radiusTop * 0.98;
      // Chân tháp xòe nhẹ (battered plinth) từ t = 0..0.14 rồi thuôn thanh thoát lên đỉnh
      if (t < 0.14) {
        const u = t / 0.14;
        const smoothU = u * u * (3 - 2 * u);
        return radiusBottom * (1.12 - 0.12 * smoothU);
      }
      const shaftT = (t - 0.14) / 0.86;
      return radiusBottom + (radiusTop - radiusBottom) * shaftT;
    },
    radialSegments,
    heightSegments,
    false,
  );

  // Điều biến bán kính theo đường cong superellipse mềm (bát giác bo tròn, không góc 90 độ)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const r = Math.hypot(px, pz);
    if (r > 0.001) {
      const ang = Math.atan2(pz, px);
      const octChamfer = 1.0 + 0.045 * Math.cos(ang * 8.0);
      const superSq =
        1.0 /
        Math.pow(
          Math.pow(Math.abs(Math.cos(ang)), 3.2) + Math.pow(Math.abs(Math.sin(ang)), 3.2),
          1 / 3.2,
        );
      const factor = (0.86 * superSq + 0.14) * octChamfer;
      pos.setX(i, px * factor);
      pos.setZ(i, pz * factor);
      if (uv) {
        const circU = ((ang + Math.PI) / (Math.PI * 2)) * ((2 * Math.PI * r) / 5.5);
        uv.setXY(i, circU, py / 5.5);
      }
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Tạo mũ lỗ châu mai / đầu tường bo vát mềm (ExtrudeGeometry vát cạnh, không góc 90 độ).
 */
function createBeveledMerlonGeometry(
  width: number,
  height: number,
  depth: number,
): THREE.ExtrudeGeometry {
  const hw = width * 0.44;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw * 0.94, height * 0.82);
  shape.quadraticCurveTo(hw * 0.85, height, hw * 0.5, height);
  shape.lineTo(-hw * 0.5, height);
  shape.quadraticCurveTo(-hw * 0.85, height, -hw * 0.94, height * 0.82);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth * 0.84,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.08,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.translate(0, 0, -depth * 0.42);
  scaleGeometryUVs(geo, 1 / 5.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Tạo dầm đá đỡ vươn ra dưới bờ tường thành (corbel bracket bo tròn mềm).
 */
function createStoneCorbelGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.28, 0.25, 0.44, 0.72);
  s.lineTo(0.46, 1.32);
  s.lineTo(-0.08, 1.32);
  s.lineTo(-0.08, 0);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.38,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.translate(0, 0, -0.19);
  scaleGeometryUVs(geo, 1 / 5.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Tọa độ đường cong vòm nhọn Gothic của cổng thành (chiều rộng 6.0m, đỉnh cao tại y = 13.65).
 */
function evalGothicArchPoint(side: -1 | 1, t: number): { x: number; y: number } {
  // Quadratic Bezier từ (-3.0 * side, 8.2) -> control (-2.95 * side, 11.75) -> apex (0, 13.65)
  const p0x = 3.0 * side;
  const p0y = 8.2;
  const p1x = 2.95 * side;
  const p1y = 11.75;
  const p2x = 0.0;
  const p2y = 13.65;
  const u = 1 - t;
  return {
    x: u * u * p0x + 2 * u * t * p1x + t * t * p2x,
    y: u * u * p0y + 2 * u * t * p1y + t * t * p2y,
  };
}

interface LanternPlacement {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale?: number;
}

interface BannerRef {
  mesh: THREE.Mesh;
  basePositions: Float32Array;
  phase: number;
}

interface PointLightFlicker {
  light: THREE.PointLight;
  baseIntensity: number;
  phase: number;
}

/**
 * Kiến trúc Thành Cổ 50x50x25:
 * - Gạch đá đa sắc độ phân phối tự nhiên kèm bump map & phong hóa rêu ẩm ở chân tường.
 * - Cổng vòm Gothic bo vát mềm (không có block 90 độ), lưới song sắt kéo lên, hầm vòm có đèn chùm.
 * - Hai tháp cổng bát giác vát cạnh kèm cờ xanh dương bay phấp phới + 4 tháp canh ở 4 góc thành.
 * - Hệ thống đèn lồng sắt rèn ánh vàng ấm gắn quanh cổng, tháp và tường thành.
 */
export class CitadelStructure {
  private readonly scene: THREE.Scene;
  private readonly rootGroup = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly banners: BannerRef[] = [];
  private readonly flickerLights: PointLightFlicker[] = [];
  private elapsed = 0;

  constructor(scene: THREE.Scene, maxAnisotropy = 4) {
    this.scene = scene;

    const stoneTextures = createCastleStoneTextures(maxAnisotropy);
    const cobbleTextures = createCobbleTextures(maxAnisotropy);
    const glowTexture = createLanternGlowTexture();
    this.textures.push(
      stoneTextures.colorMap,
      stoneTextures.bumpMap,
      stoneTextures.roughnessMap,
      cobbleTextures.colorMap,
      cobbleTextures.bumpMap,
      glowTexture,
    );

    const stoneMat = createWeatheredCastleStoneMaterial(
      stoneTextures.colorMap,
      stoneTextures.bumpMap,
      stoneTextures.roughnessMap,
    );
    const trimStoneMat = new THREE.MeshStandardMaterial({
      map: stoneTextures.colorMap,
      bumpMap: stoneTextures.bumpMap,
      bumpScale: 0.06,
      color: '#d8d0c5',
      roughness: 0.82,
      metalness: 0.06,
    });
    const darkRecessMat = new THREE.MeshStandardMaterial({
      color: '#1b1918',
      roughness: 0.94,
      metalness: 0.05,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: '#1e2024',
      roughness: 0.38,
      metalness: 0.82,
    });
    const brassFinialMat = new THREE.MeshStandardMaterial({
      color: '#d4a13e',
      roughness: 0.28,
      metalness: 0.86,
    });
    const lanternFlameMat = new THREE.MeshStandardMaterial({
      color: '#ffedd5',
      emissive: '#ff9e2c',
      emissiveIntensity: 3.1,
      roughness: 0.2,
    });
    const bannerBlueMat = new THREE.MeshStandardMaterial({
      color: '#1e40af',
      roughness: 0.72,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    const cobbleMat = new THREE.MeshStandardMaterial({
      map: cobbleTextures.colorMap,
      bumpMap: cobbleTextures.bumpMap,
      bumpScale: 0.075,
      roughness: 0.88,
      metalness: 0.04,
    });
    const glowSpriteMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: '#ffb347',
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shrubLeafMat = new THREE.MeshStandardMaterial({
      color: '#3f5a29',
      roughness: 0.9,
      metalness: 0.02,
    });

    this.materials.push(
      stoneMat,
      trimStoneMat,
      darkRecessMat,
      ironMat,
      brassFinialMat,
      lanternFlameMat,
      bannerBlueMat,
      cobbleMat,
      glowSpriteMat,
      shrubLeafMat,
    );

    const merlonPositions: Array<{ x: number; y: number; z: number; rotY: number }> = [];
    const corbelPositions: Array<{ x: number; y: number; z: number; rotY: number }> = [];

    // 1. Bốn bức tường thành chính 50x50x25 (vát chân + mái nhô + dãy châu mai)
    this.buildCurtainWallSegment(
      -15.4,
      -WALL_CENTER,
      14.2,
      0,
      stoneMat,
      darkRecessMat,
      merlonPositions,
      corbelPositions,
      true,
    );
    this.buildCurtainWallSegment(
      15.4,
      -WALL_CENTER,
      14.2,
      0,
      stoneMat,
      darkRecessMat,
      merlonPositions,
      corbelPositions,
      true,
    );
    this.buildCurtainWallSegment(
      0,
      WALL_CENTER,
      45.0,
      0,
      stoneMat,
      darkRecessMat,
      merlonPositions,
      corbelPositions,
      true,
    );
    this.buildCurtainWallSegment(
      -WALL_CENTER,
      0,
      45.0,
      Math.PI / 2,
      stoneMat,
      darkRecessMat,
      merlonPositions,
      corbelPositions,
      true,
    );
    this.buildCurtainWallSegment(
      WALL_CENTER,
      0,
      45.0,
      Math.PI / 2,
      stoneMat,
      darkRecessMat,
      merlonPositions,
      corbelPositions,
      true,
    );

    // 2. Cổng thành vòm Gothic mềm mại (không có block 90 độ)
    this.buildGothicGatehouse(
      stoneMat,
      trimStoneMat,
      darkRecessMat,
      ironMat,
      merlonPositions,
      corbelPositions,
    );

    // 3. Hai tháp cổng vát cạnh + cờ xanh dương & 4 tháp góc
    this.buildOctagonalTower(
      -6.65,
      -25.25,
      30.0, // Đạt đỉnh y = 34.0 (cao hơn tường 25m giống mẫu)
      3.15,
      2.62,
      true,
      stoneMat,
      darkRecessMat,
      ironMat,
      brassFinialMat,
      bannerBlueMat,
      merlonPositions,
      corbelPositions,
      0.3,
    );
    this.buildOctagonalTower(
      6.65,
      -25.25,
      30.0,
      3.15,
      2.62,
      true,
      stoneMat,
      darkRecessMat,
      ironMat,
      brassFinialMat,
      bannerBlueMat,
      merlonPositions,
      corbelPositions,
      2.1,
    );

    const cornerCoords: Array<[number, number]> = [
      [-WALL_CENTER, -WALL_CENTER],
      [WALL_CENTER, -WALL_CENTER],
      [-WALL_CENTER, WALL_CENTER],
      [WALL_CENTER, WALL_CENTER],
    ];
    for (const [cx, cz] of cornerCoords) {
      this.buildOctagonalTower(
        cx,
        cz,
        27.5,
        3.2,
        2.68,
        false,
        stoneMat,
        darkRecessMat,
        ironMat,
        brassFinialMat,
        bannerBlueMat,
        merlonPositions,
        corbelPositions,
        0,
      );
    }

    // InstancedMesh cho toàn bộ lỗ châu mai (merlons) & dầm đỡ đá (corbels)
    this.buildInstancedMerlonsAndCorbels(stoneMat, trimStoneMat, merlonPositions, corbelPositions);

    // 4. Hệ thống đèn gắn trên thành + ánh sáng vàng ấm
    this.buildWallLanterns(ironMat, lanternFlameMat, glowSpriteMat);

    // 5. Đường lát đá cuội cong vào cổng & bụi cây nhỏ ở chân hai tháp cổng
    this.buildCobblestoneGateRoad(cobbleMat);
    this.buildGateBaseShrubs(shrubLeafMat);

    this.scene.add(this.rootGroup);
  }

  private buildCurtainWallSegment(
    centerX: number,
    centerZ: number,
    length: number,
    rotY: number,
    stoneMat: THREE.MeshStandardMaterial,
    darkRecessMat: THREE.MeshStandardMaterial,
    merlonPositions: Array<{ x: number; y: number; z: number; rotY: number }>,
    corbelPositions: Array<{ x: number; y: number; z: number; rotY: number }>,
    addArrowSlits: boolean,
  ): void {
    // Mặt cắt ngang tường thành bo vát (không góc 90 độ ở chân & mái tường)
    const mainH = 23.4; // y = 4.0 -> 27.4, thêm merlon 1.6m => 29.0 (25m)
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-1.42, 0);
    wallShape.lineTo(1.42, 0);
    wallShape.lineTo(1.12, 2.2);
    wallShape.lineTo(1.12, mainH - 1.1);
    wallShape.quadraticCurveTo(1.34, mainH - 0.7, 1.34, mainH - 0.15);
    wallShape.quadraticCurveTo(1.34, mainH, 1.18, mainH);
    wallShape.lineTo(-1.18, mainH);
    wallShape.quadraticCurveTo(-1.34, mainH, -1.34, mainH - 0.15);
    wallShape.quadraticCurveTo(-1.34, mainH - 0.7, -1.12, mainH - 1.1);
    wallShape.lineTo(-1.12, 2.2);
    wallShape.closePath();

    const geo = new THREE.ExtrudeGeometry(wallShape, {
      depth: length,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.08,
      bevelSegments: 2,
      curveSegments: 8,
    });
    geo.translate(0, 0, -length * 0.5);
    scaleGeometryUVs(geo, 1 / 5.5);
    geo.computeVertexNormals();
    this.geometries.push(geo);

    const mesh = new THREE.Mesh(geo, stoneMat);
    mesh.position.set(centerX, GROUND_Y, centerZ);
    // Shape nằm trong X-Y, đùn dọc Z; xoay PI/2 để tường nằm dọc trục X hoặc 0 dọc trục Z
    mesh.rotation.y = rotY === 0 ? Math.PI / 2 : 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.rootGroup.add(mesh);

    // Merlons & corbels chạy dọc chiều dài tường thành (hai mặt ngoài & trong)
    const alongX = rotY === 0;
    const merlonStep = 2.4;
    const count = Math.max(2, Math.floor((length - 1.6) / merlonStep));
    const startOffset = -((count - 1) * merlonStep) * 0.5;

    for (let i = 0; i < count; i++) {
      const d = startOffset + i * merlonStep;
      const mx = alongX ? centerX + d : centerX;
      const mz = alongX ? centerZ : centerZ + d;
      for (const side of [-0.95, 0.95]) {
        const sx = alongX ? mx : mx + side;
        const sz = alongX ? mz + side : mz;
        merlonPositions.push({
          x: sx,
          y: GROUND_Y + mainH,
          z: sz,
          rotY: alongX ? 0 : Math.PI / 2,
        });
      }
    }

    const corbelStep = 1.6;
    const cCount = Math.max(2, Math.floor((length - 1.2) / corbelStep));
    const cStart = -((cCount - 1) * corbelStep) * 0.5;
    for (let i = 0; i < cCount; i++) {
      const d = cStart + i * corbelStep;
      const cx = alongX ? centerX + d : centerX;
      const cz = alongX ? centerZ : centerZ + d;
      // Mặt hướng ngoài và mặt hướng sân
      if (alongX) {
        corbelPositions.push({ x: cx, y: GROUND_Y + 21.1, z: cz - 1.12, rotY: Math.PI / 2 });
        corbelPositions.push({ x: cx, y: GROUND_Y + 21.1, z: cz + 1.12, rotY: -Math.PI / 2 });
      } else {
        corbelPositions.push({ x: cx - 1.12, y: GROUND_Y + 21.1, z: cz, rotY: Math.PI });
        corbelPositions.push({ x: cx + 1.12, y: GROUND_Y + 21.1, z: cz, rotY: 0 });
      }
    }

    if (addArrowSlits) {
      const alongX = rotY === 0;
      const slitPositions = length > 20 ? [-12, 0, 12] : [0];
      for (const offset of slitPositions) {
        const sx = alongX ? centerX + offset : centerX + (centerX < 0 ? -1.16 : 1.16);
        const sz = alongX ? centerZ + (centerZ < 0 ? -1.16 : 1.16) : centerZ + offset;
        const sRot = alongX ? (centerZ < 0 ? 0 : Math.PI) : centerX < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        this.addArrowSlit(sx, GROUND_Y + 15.6, sz, sRot, darkRecessMat, stoneMat);
      }
    }
  }

  /**
   * Cổng thành trung tâm: vòm nhọn Gothic mượt mà, không có khối 90 độ, có song sắt & hầm vòm.
   */
  private buildGothicGatehouse(
    stoneMat: THREE.MeshStandardMaterial,
    trimStoneMat: THREE.MeshStandardMaterial,
    darkRecessMat: THREE.MeshStandardMaterial,
    ironMat: THREE.MeshStandardMaterial,
    merlonPositions: Array<{ x: number; y: number; z: number; rotY: number }>,
    corbelPositions: Array<{ x: number; y: number; z: number; rotY: number }>,
  ): void {
    const gateFrontZ = -26.0;
    const gateDepth = 4.0; // -26.0 -> -22.0
    const wallTopLocal = 23.4; // y = 4.0 + 23.4 = 27.4 (+ merlons => 29.0)

    // 1. Thân cổng chính với lỗ vòm Gothic nhọn mềm mại (ExtrudeGeometry + bevel mềm)
    const gateShape = new THREE.Shape();
    gateShape.moveTo(-4.35, 0);
    gateShape.lineTo(-3.0, 0);
    gateShape.lineTo(-3.0, 4.2); // springer y = 4.0 + 4.2 = 8.2
    gateShape.quadraticCurveTo(-2.95, 7.75, 0.0, 9.65); // đỉnh nhọn y = 13.65
    gateShape.quadraticCurveTo(2.95, 7.75, 3.0, 4.2);
    gateShape.lineTo(3.0, 0);
    gateShape.lineTo(4.35, 0);
    gateShape.lineTo(4.35, wallTopLocal - 0.8);
    gateShape.quadraticCurveTo(4.35, wallTopLocal, 3.85, wallTopLocal);
    gateShape.lineTo(-3.85, wallTopLocal);
    gateShape.quadraticCurveTo(-4.35, wallTopLocal, -4.35, wallTopLocal - 0.8);
    gateShape.closePath();

    const gateGeo = new THREE.ExtrudeGeometry(gateShape, {
      depth: gateDepth,
      bevelEnabled: true,
      bevelThickness: 0.16,
      bevelSize: 0.12,
      bevelSegments: 3,
      curveSegments: 26,
    });
    scaleGeometryUVs(gateGeo, 1 / 5.5);
    gateGeo.computeVertexNormals();
    this.geometries.push(gateGeo);

    const gateMesh = new THREE.Mesh(gateGeo, stoneMat);
    gateMesh.position.set(0, GROUND_Y, gateFrontZ);
    gateMesh.castShadow = true;
    gateMesh.receiveShadow = true;
    gateMesh.matrixAutoUpdate = false;
    gateMesh.updateMatrix();
    this.rootGroup.add(gateMesh);

    // Gờ mái nhô trên đỉnh cổng thành
    const crownShape = new THREE.Shape();
    crownShape.moveTo(-4.4, 0);
    crownShape.lineTo(4.4, 0);
    crownShape.quadraticCurveTo(4.65, 0.45, 4.4, 0.9);
    crownShape.lineTo(-4.4, 0.9);
    crownShape.quadraticCurveTo(-4.65, 0.45, -4.4, 0);
    const crownGeo = new THREE.ExtrudeGeometry(crownShape, {
      depth: gateDepth + 0.56,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.1,
      bevelSegments: 2,
      curveSegments: 10,
    });
    scaleGeometryUVs(crownGeo, 1 / 5.5);
    crownGeo.computeVertexNormals();
    this.geometries.push(crownGeo);

    const crownMesh = new THREE.Mesh(crownGeo, trimStoneMat);
    crownMesh.position.set(0, GROUND_Y + wallTopLocal - 0.85, gateFrontZ - 0.28);
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
    crownMesh.matrixAutoUpdate = false;
    crownMesh.updateMatrix();
    this.rootGroup.add(crownMesh);

    // Dãy dầm đá đỡ & lỗ châu mai trên mặt cổng
    for (let i = -3; i <= 3; i++) {
      corbelPositions.push({
        x: i * 1.15,
        y: GROUND_Y + 21.1,
        z: gateFrontZ - 0.18,
        rotY: Math.PI / 2,
      });
      corbelPositions.push({
        x: i * 1.15,
        y: GROUND_Y + 21.1,
        z: gateFrontZ + gateDepth + 0.18,
        rotY: -Math.PI / 2,
      });
    }
    for (let i = -2; i <= 2; i++) {
      merlonPositions.push({
        x: i * 1.85,
        y: GROUND_Y + wallTopLocal,
        z: gateFrontZ + 0.22,
        rotY: 0,
      });
      merlonPositions.push({
        x: i * 1.85,
        y: GROUND_Y + wallTopLocal,
        z: gateFrontZ + gateDepth - 0.22,
        rotY: 0,
      });
    }

    // 2. Viền vòm đá xếp vòng cung mềm (Voussoirs) ở mặt trước & sau cổng + Gân vòm hầm
    const voussoirShape = new THREE.Shape();
    voussoirShape.moveTo(-0.22, -0.24);
    voussoirShape.lineTo(0.22, -0.24);
    voussoirShape.quadraticCurveTo(0.28, 0.22, 0.2, 0.28);
    voussoirShape.lineTo(-0.2, 0.28);
    voussoirShape.quadraticCurveTo(-0.28, 0.22, -0.22, -0.24);
    const voussoirGeo = new THREE.ExtrudeGeometry(voussoirShape, {
      depth: 0.26,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 2,
      curveSegments: 8,
    });
    voussoirGeo.translate(0, 0, -0.13);
    scaleGeometryUVs(voussoirGeo, 1 / 4.5);
    voussoirGeo.computeVertexNormals();
    this.geometries.push(voussoirGeo);

    const archFacesZ = [gateFrontZ - 0.14, gateFrontZ + gateDepth + 0.14];
    for (const fz of archFacesZ) {
      for (const side of [-1, 1] as const) {
        // Trụ đá đứng bo tròn 2 bên vòm
        for (let py = 4.5; py <= 7.9; py += 0.68) {
          const pier = new THREE.Mesh(voussoirGeo, trimStoneMat);
          pier.position.set(side * 3.16, py, fz);
          pier.scale.set(0.95, 1.35, 1.0);
          pier.castShadow = true;
          pier.receiveShadow = true;
          this.rootGroup.add(pier);
        }

        // Các phiến đá vòm xếp dọc đường cong Gothic
        const segs = 7;
        for (let k = 0; k < segs; k++) {
          const t0 = k / segs;
          const t1 = (k + 1) / segs;
          const tMid = (t0 + t1) * 0.5;
          const p0 = evalGothicArchPoint(side, t0);
          const p1 = evalGothicArchPoint(side, t1);
          const pm = evalGothicArchPoint(side, tMid);
          const tangentAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

          const vMesh = new THREE.Mesh(voussoirGeo, trimStoneMat);
          vMesh.position.set(pm.x + side * 0.12, pm.y + 0.14, fz);
          vMesh.rotation.z = tangentAngle;
          vMesh.castShadow = true;
          vMesh.receiveShadow = true;
          this.rootGroup.add(vMesh);
        }
      }

      // Đá khóa vòm trung tâm (Keystone)
      const keystone = new THREE.Mesh(voussoirGeo, trimStoneMat);
      keystone.position.set(0, 13.86, fz - (fz < -24 ? 0.04 : -0.04));
      keystone.scale.set(1.18, 1.36, 1.15);
      keystone.castShadow = true;
      this.rootGroup.add(keystone);
    }

    // 3 gân vòm đá trong lòng hầm cổng thành
    const ribShape = new THREE.Shape();
    ribShape.moveTo(-3.28, 4.15);
    ribShape.quadraticCurveTo(-3.2, 7.95, 0.0, 9.95);
    ribShape.quadraticCurveTo(3.2, 7.95, 3.28, 4.15);
    ribShape.lineTo(2.94, 4.15);
    ribShape.quadraticCurveTo(2.88, 7.65, 0.0, 9.52);
    ribShape.quadraticCurveTo(-2.88, 7.65, -2.94, 4.15);
    ribShape.closePath();

    const ribGeo = new THREE.ExtrudeGeometry(ribShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 2,
      curveSegments: 20,
    });
    ribGeo.translate(0, 0, -0.17);
    scaleGeometryUVs(ribGeo, 1 / 5.5);
    ribGeo.computeVertexNormals();
    this.geometries.push(ribGeo);

    for (const rz of [-25.1, -24.0, -22.9]) {
      const rib = new THREE.Mesh(ribGeo, trimStoneMat);
      rib.position.set(0, GROUND_Y, rz);
      rib.receiveShadow = true;
      this.rootGroup.add(rib);
    }

    // 3. Cửa song sắt kéo lên trong lòng vòm Gothic (để trống phần dưới cho người chơi đi qua)
    const portZ = -25.25;
    const barBottomY = 9.45;
    const tipGeo = createParabolicLatheGeometry(
      0.24,
      0.046,
      (t) => Math.sin(t * Math.PI * 0.5),
      8,
      6,
      false,
    );
    tipGeo.rotateX(Math.PI);
    this.geometries.push(tipGeo);

    for (let bx = -2.4; bx <= 2.41; bx += 0.48) {
      // Tính chiều cao vòm tại bx
      const absX = Math.abs(bx);
      const frac = 1 - absX / 3.0;
      const archY = 8.2 + Math.pow(Math.max(0, frac), 0.72) * 5.35;
      const barH = Math.max(0.5, archY - barBottomY);
      const barGeo = new THREE.CylinderGeometry(0.036, 0.036, barH, 8);
      this.geometries.push(barGeo);
      const bar = new THREE.Mesh(barGeo, ironMat);
      bar.position.set(bx, barBottomY + barH * 0.5, portZ);
      bar.castShadow = true;
      this.rootGroup.add(bar);

      const spike = new THREE.Mesh(tipGeo, ironMat);
      spike.position.set(bx, barBottomY, portZ);
      this.rootGroup.add(spike);
    }

    const crossYs = [9.75, 10.65, 11.55, 12.45];
    for (const cy of crossYs) {
      const spanFrac = Math.max(0.15, 1 - (cy - 8.2) / 5.45);
      const spanW = 5.4 * Math.pow(spanFrac, 0.72);
      const crossGeo = new THREE.CylinderGeometry(0.034, 0.034, spanW, 8);
      crossGeo.rotateZ(Math.PI / 2);
      this.geometries.push(crossGeo);
      const cross = new THREE.Mesh(crossGeo, ironMat);
      cross.position.set(0, cy, portZ);
      this.rootGroup.add(cross);
    }

    // 4. Hai lỗ châu mai dọc phía trên hai bên vòm cổng
    this.addArrowSlit(-3.55, GROUND_Y + 15.6, gateFrontZ - 0.14, 0, darkRecessMat, trimStoneMat);
    this.addArrowSlit(3.55, GROUND_Y + 15.6, gateFrontZ - 0.14, 0, darkRecessMat, trimStoneMat);
  }

  private addArrowSlit(
    x: number,
    y: number,
    z: number,
    rotY: number,
    darkMat: THREE.MeshStandardMaterial,
    trimMat: THREE.MeshStandardMaterial,
  ): void {
    const slitShape = new THREE.Shape();
    slitShape.moveTo(-0.11, -0.85);
    slitShape.lineTo(0.11, -0.85);
    slitShape.quadraticCurveTo(0.14, 0, 0.09, 0.85);
    slitShape.quadraticCurveTo(0, 0.96, -0.09, 0.85);
    slitShape.quadraticCurveTo(-0.14, 0, -0.11, -0.85);

    const slitGeo = new THREE.ExtrudeGeometry(slitShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    slitGeo.translate(0, 0, -0.11);
    this.geometries.push(slitGeo);

    const sillGeo = createParabolicEllipsoidGeometry(0.46, 0.16, 0.34, 10, 8);
    this.geometries.push(sillGeo);

    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;
    const hole = new THREE.Mesh(slitGeo, darkMat);
    const sill = new THREE.Mesh(sillGeo, trimMat);
    sill.position.set(0, -0.92, 0.03);
    group.add(hole, sill);
    this.rootGroup.add(group);
  }

  /**
   * Dựng tháp cổng hoặc tháp góc bát giác vát mềm + dầm đỡ + lỗ châu mai + cờ xanh dương.
   */
  private buildOctagonalTower(
    cx: number,
    cz: number,
    totalHeight: number,
    radiusBottom: number,
    radiusTop: number,
    withBanner: boolean,
    stoneMat: THREE.MeshStandardMaterial,
    darkRecessMat: THREE.MeshStandardMaterial,
    ironMat: THREE.MeshStandardMaterial,
    brassMat: THREE.MeshStandardMaterial,
    bannerBlueMat: THREE.MeshStandardMaterial,
    merlonPositions: Array<{ x: number; y: number; z: number; rotY: number }>,
    corbelPositions: Array<{ x: number; y: number; z: number; rotY: number }>,
    bannerPhase: number,
  ): void {
    const shaftH = totalHeight - 3.6;
    const crownBottomY = GROUND_Y + shaftH;
    const crownH = 2.1;
    const crownTopY = crownBottomY + crownH;

    // 1. Thân tháp thuôn nhẹ với chân vát xòe mềm
    const shaftGeo = createChamferedTowerShaftGeometry(shaftH, radiusBottom, radiusTop, 24, 16);
    this.geometries.push(shaftGeo);
    const shaftMesh = new THREE.Mesh(shaftGeo, stoneMat);
    shaftMesh.position.set(cx, GROUND_Y, cz);
    shaftMesh.castShadow = true;
    shaftMesh.receiveShadow = true;
    shaftMesh.matrixAutoUpdate = false;
    shaftMesh.updateMatrix();
    this.rootGroup.add(shaftMesh);

    // 2. Mũ tháp vươn rộng phía trên dầm đỡ
    const crownGeo = createChamferedTowerShaftGeometry(
      crownH,
      radiusTop * 1.14,
      radiusTop * 1.16,
      24,
      8,
    );
    this.geometries.push(crownGeo);
    const crownMesh = new THREE.Mesh(crownGeo, stoneMat);
    crownMesh.position.set(cx, crownBottomY, cz);
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
    crownMesh.matrixAutoUpdate = false;
    crownMesh.updateMatrix();
    this.rootGroup.add(crownMesh);

    // Mặt sàn đá đỉnh tháp
    const deckGeo = new THREE.CylinderGeometry(radiusTop * 1.05, radiusTop * 1.05, 0.35, 16);
    this.geometries.push(deckGeo);
    const deckMesh = new THREE.Mesh(deckGeo, stoneMat);
    deckMesh.position.set(cx, crownTopY - 0.18, cz);
    deckMesh.receiveShadow = true;
    this.rootGroup.add(deckMesh);

    // 3. Vòng dầm đỡ đá & lỗ châu mai trên đỉnh tháp
    const corbelCount = 12;
    for (let i = 0; i < corbelCount; i++) {
      const ang = (i / corbelCount) * Math.PI * 2;
      const dist = radiusTop * 0.96;
      corbelPositions.push({
        x: cx + Math.cos(ang) * dist,
        y: crownBottomY - 1.12,
        z: cz + Math.sin(ang) * dist,
        rotY: -ang,
      });
    }

    const merlonCount = 8;
    for (let i = 0; i < merlonCount; i++) {
      const ang = (i / merlonCount) * Math.PI * 2 + Math.PI / 8;
      const dist = radiusTop * 1.06;
      merlonPositions.push({
        x: cx + Math.cos(ang) * dist,
        y: crownTopY,
        z: cz + Math.sin(ang) * dist,
        rotY: -ang + Math.PI / 2,
      });
    }

    // 4. Lỗ châu mai mặt trước & hông tháp
    const zFront = cz < 0 ? cz - radiusTop * 1.01 : cz + radiusTop * 1.01;
    const frontRot = cz < 0 ? 0 : Math.PI;
    this.addArrowSlit(cx, GROUND_Y + 12.2, zFront, frontRot, darkRecessMat, stoneMat);
    this.addArrowSlit(cx, GROUND_Y + 19.6, zFront, frontRot, darkRecessMat, stoneMat);

    // 5. Cờ xanh dương đậm bay phấp phới trên đỉnh 2 tháp cổng
    if (withBanner) {
      const poleH = 6.2;
      const poleGeo = new THREE.CylinderGeometry(0.065, 0.085, poleH, 10);
      const finialGeo = new THREE.SphereGeometry(0.16, 12, 10);
      const flagGeo = new THREE.PlaneGeometry(3.8, 1.08, 18, 4);
      // Dịch gốc lá cờ sang sát cột cờ và cắt đuôi én mềm ở rìa phải
      flagGeo.translate(1.9, 0, 0);
      const fPos = flagGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < fPos.count; i++) {
        const fx = fPos.getX(i);
        const fy = fPos.getY(i);
        const u = fx / 3.8;
        if (u > 0.72) {
          const swallowIndent = (1 - Math.abs(fy) / 0.54) * 0.75 * ((u - 0.72) / 0.28);
          fPos.setX(i, fx - swallowIndent);
        }
      }
      flagGeo.computeVertexNormals();
      this.geometries.push(poleGeo, finialGeo, flagGeo);

      const pole = new THREE.Mesh(poleGeo, ironMat);
      pole.position.set(cx, crownTopY + poleH * 0.5 - 0.3, cz);
      pole.castShadow = true;
      this.rootGroup.add(pole);

      const finial = new THREE.Mesh(finialGeo, brassMat);
      finial.position.set(cx, crownTopY + poleH - 0.25, cz);
      this.rootGroup.add(finial);

      const flag = new THREE.Mesh(flagGeo, bannerBlueMat);
      flag.position.set(cx + 0.06, crownTopY + poleH - 1.05, cz);
      flag.rotation.y = Math.PI * 0.92;
      flag.castShadow = true;
      this.rootGroup.add(flag);

      this.banners.push({
        mesh: flag,
        basePositions: new Float32Array(fPos.array),
        phase: bannerPhase,
      });
    }
  }

  private buildInstancedMerlonsAndCorbels(
    stoneMat: THREE.MeshStandardMaterial,
    trimStoneMat: THREE.MeshStandardMaterial,
    merlonPositions: Array<{ x: number; y: number; z: number; rotY: number }>,
    corbelPositions: Array<{ x: number; y: number; z: number; rotY: number }>,
  ): void {
    const dummy = new THREE.Object3D();

    if (merlonPositions.length > 0) {
      const merlonGeo = createBeveledMerlonGeometry(1.42, 1.6, 0.78);
      this.geometries.push(merlonGeo);
      const merlonInst = new THREE.InstancedMesh(merlonGeo, stoneMat, merlonPositions.length);
      merlonInst.castShadow = true;
      merlonInst.receiveShadow = true;

      for (let i = 0; i < merlonPositions.length; i++) {
        const p = merlonPositions[i];
        dummy.position.set(p.x, p.y - 0.06, p.z);
        dummy.rotation.set(0, p.rotY, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        merlonInst.setMatrixAt(i, dummy.matrix);
      }
      merlonInst.instanceMatrix.needsUpdate = true;
      merlonInst.computeBoundingSphere();
      this.rootGroup.add(merlonInst);
    }

    if (corbelPositions.length > 0) {
      const corbelGeo = createStoneCorbelGeometry();
      this.geometries.push(corbelGeo);
      const corbelInst = new THREE.InstancedMesh(corbelGeo, trimStoneMat, corbelPositions.length);
      corbelInst.castShadow = true;
      corbelInst.receiveShadow = true;

      for (let i = 0; i < corbelPositions.length; i++) {
        const p = corbelPositions[i];
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.rotY, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        corbelInst.setMatrixAt(i, dummy.matrix);
      }
      corbelInst.instanceMatrix.needsUpdate = true;
      corbelInst.computeBoundingSphere();
      this.rootGroup.add(corbelInst);
    }
  }

  private buildWallLanterns(
    ironMat: THREE.MeshStandardMaterial,
    flameMat: THREE.MeshStandardMaterial,
    glowSpriteMat: THREE.SpriteMaterial,
  ): void {
    // Danh sách vị trí đèn gắn trên cổng, hai tháp cổng, tường thành & bên trong sân thành giống mẫu
    const placements: LanternPlacement[] = [
      // 2 đèn chính hai bên cổng vòm Gothic
      { x: -3.72, y: 10.2, z: -26.32, yaw: 0, scale: 1.25 },
      { x: 3.72, y: 10.2, z: -26.32, yaw: 0, scale: 1.25 },
      // Đèn phía trên cổng chính
      { x: -3.65, y: 20.8, z: -26.25, yaw: 0, scale: 0.95 },
      { x: 3.65, y: 20.8, z: -26.25, yaw: 0, scale: 0.95 },
      // Đèn so le trên 2 tháp cổng giống mẫu
      { x: -4.95, y: 15.0, z: -27.78, yaw: -0.35, scale: 1.0 },
      { x: -9.58, y: 17.8, z: -25.1, yaw: Math.PI * 0.5, scale: 1.0 },
      { x: -7.55, y: 27.6, z: -28.05, yaw: 0.15, scale: 0.95 },
      { x: 4.95, y: 16.5, z: -27.78, yaw: 0.35, scale: 1.0 },
      { x: 7.45, y: 13.8, z: -28.12, yaw: -0.15, scale: 1.0 },
      { x: 9.58, y: 27.2, z: -25.1, yaw: -Math.PI * 0.5, scale: 0.95 },
      // Đèn dọc cánh tường Bắc trái & phải
      { x: -14.8, y: 12.8, z: -25.25, yaw: 0, scale: 1.0 },
      { x: -18.8, y: 21.4, z: -25.25, yaw: 0, scale: 0.95 },
      { x: 14.8, y: 12.8, z: -25.25, yaw: 0, scale: 1.0 },
      { x: 18.8, y: 21.4, z: -25.25, yaw: 0, scale: 0.95 },
      // Đèn mặt ngoài các tường Tây, Đông, Nam
      { x: -25.25, y: 14.2, z: -10.0, yaw: Math.PI * 0.5, scale: 1.0 },
      { x: -25.25, y: 14.2, z: 8.0, yaw: Math.PI * 0.5, scale: 1.0 },
      { x: 25.25, y: 14.2, z: -10.0, yaw: -Math.PI * 0.5, scale: 1.0 },
      { x: 25.25, y: 14.2, z: 8.0, yaw: -Math.PI * 0.5, scale: 1.0 },
      { x: -10.0, y: 14.2, z: 25.25, yaw: Math.PI, scale: 1.0 },
      { x: 10.0, y: 14.2, z: 25.25, yaw: Math.PI, scale: 1.0 },
      // Đèn mặt trong sân thành & hai bên cổng phía trong
      { x: -3.72, y: 10.2, z: -21.7, yaw: Math.PI, scale: 1.15 },
      { x: 3.72, y: 10.2, z: -21.7, yaw: Math.PI, scale: 1.15 },
      { x: -22.75, y: 11.2, z: 0, yaw: -Math.PI * 0.5, scale: 1.0 },
      { x: 22.75, y: 11.2, z: 0, yaw: Math.PI * 0.5, scale: 1.0 },
      { x: 0, y: 11.2, z: 22.75, yaw: 0, scale: 1.0 },
    ];

    const bracketCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.32, 0.2),
      new THREE.Vector3(0, 0.12, 0.02),
      new THREE.Vector3(0, 0.36, -0.26),
      new THREE.Vector3(0, 0.25, -0.34),
    ]);
    const bracketGeo = new THREE.TubeGeometry(bracketCurve, 10, 0.032, 6, false);
    const capGeo = new THREE.ConeGeometry(0.24, 0.24, 6);
    const flameGeo = new THREE.SphereGeometry(0.115, 10, 8);
    this.geometries.push(bracketGeo, capGeo, flameGeo);

    const bracketInst = new THREE.InstancedMesh(bracketGeo, ironMat, placements.length);
    const capInst = new THREE.InstancedMesh(capGeo, ironMat, placements.length);
    const flameInst = new THREE.InstancedMesh(flameGeo, flameMat, placements.length);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const sc = p.scale ?? 1.0;

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      bracketInst.setMatrixAt(i, dummy.matrix);

      const fwdX = -Math.sin(p.yaw) * 0.34 * sc;
      const fwdZ = -Math.cos(p.yaw) * 0.34 * sc;
      dummy.position.set(p.x + fwdX, p.y + 0.19 * sc, p.z + fwdZ);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      capInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x + fwdX, p.y - 0.03 * sc, p.z + fwdZ);
      dummy.scale.set(sc, sc * 1.32, sc);
      dummy.updateMatrix();
      flameInst.setMatrixAt(i, dummy.matrix);

      const sprite = new THREE.Sprite(glowSpriteMat);
      sprite.position.set(p.x + fwdX, p.y - 0.02 * sc, p.z + fwdZ);
      sprite.scale.setScalar(2.1 * sc);
      this.rootGroup.add(sprite);
    }

    bracketInst.instanceMatrix.needsUpdate = true;
    bracketInst.computeBoundingSphere();
    capInst.instanceMatrix.needsUpdate = true;
    capInst.computeBoundingSphere();
    flameInst.instanceMatrix.needsUpdate = true;
    flameInst.computeBoundingSphere();
    this.rootGroup.add(bracketInst, capInst, flameInst);

    // Đèn treo giữa trần hầm cổng thành (tạo điểm sáng vàng sâu trong đường hầm giống mẫu)
    const hangChainGeo = new THREE.CylinderGeometry(0.026, 0.026, 1.35, 6);
    this.geometries.push(hangChainGeo);
    const hangChain = new THREE.Mesh(hangChainGeo, ironMat);
    hangChain.position.set(0, 12.85, -23.95);
    const hangCap = new THREE.Mesh(capGeo, ironMat);
    hangCap.position.set(0, 12.22, -23.95);
    const hangFlame = new THREE.Mesh(flameGeo, flameMat);
    hangFlame.position.set(0, 12.0, -23.95);
    hangFlame.scale.set(1.2, 1.5, 1.2);
    const hangSprite = new THREE.Sprite(glowSpriteMat);
    hangSprite.position.set(0, 12.0, -23.95);
    hangSprite.scale.setScalar(2.8);
    this.rootGroup.add(hangChain, hangCap, hangFlame, hangSprite);

    // 6 nguồn sáng vàng ấm chiếu sáng chân thực lên tường gạch & mặt đường đá cuội
    const lightConfigs: Array<{ x: number; y: number; z: number; intensity: number; dist: number; phase: number }> = [
      { x: -3.72, y: 10.2, z: -27.0, intensity: 24, dist: 19, phase: 0.4 },
      { x: 3.72, y: 10.2, z: -27.0, intensity: 24, dist: 19, phase: 1.9 },
      { x: 0, y: 11.75, z: -23.95, intensity: 22, dist: 18, phase: 3.1 },
      { x: -6.5, y: 16.5, z: -29.0, intensity: 14, dist: 17, phase: 4.5 },
      { x: 6.5, y: 16.5, z: -29.0, intensity: 14, dist: 17, phase: 5.2 },
      { x: 0, y: 10.2, z: -20.8, intensity: 15, dist: 17, phase: 2.6 },
    ];
    for (const cfg of lightConfigs) {
      const pl = new THREE.PointLight('#ff9c38', cfg.intensity, cfg.dist, 1.6);
      pl.position.set(cfg.x, cfg.y, cfg.z);
      this.rootGroup.add(pl);
      this.flickerLights.push({
        light: pl,
        baseIntensity: cfg.intensity,
        phase: cfg.phase,
      });
    }
  }

  private buildCobblestoneGateRoad(cobbleMat: THREE.MeshStandardMaterial): void {
    // Đường đá cuội uốn mềm dẫn từ ngoài đồng cỏ xuyên qua cổng vào sân thành
    const roadShape = new THREE.Shape();
    roadShape.moveTo(-3.6, -46.5);
    roadShape.quadraticCurveTo(-3.2, -36.0, -2.95, -26.5);
    roadShape.lineTo(-2.95, -21.0);
    roadShape.quadraticCurveTo(-3.3, -15.5, -3.7, -11.5);
    roadShape.quadraticCurveTo(0, -10.8, 3.7, -11.5);
    roadShape.quadraticCurveTo(3.3, -15.5, 2.95, -21.0);
    roadShape.lineTo(2.95, -26.5);
    roadShape.quadraticCurveTo(3.2, -36.0, 3.6, -46.5);
    roadShape.quadraticCurveTo(0, -47.2, -3.6, -46.5);

    const roadGeo = new THREE.ExtrudeGeometry(roadShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.22,
      bevelSegments: 2,
      curveSegments: 16,
    });
    roadGeo.rotateX(Math.PI / 2);
    scaleGeometryUVs(roadGeo, 1 / 4.2);
    roadGeo.computeVertexNormals();
    this.geometries.push(roadGeo);

    const roadMesh = new THREE.Mesh(roadGeo, cobbleMat);
    roadMesh.position.set(0, GROUND_Y + 0.055, 0);
    roadMesh.receiveShadow = true;
    roadMesh.matrixAutoUpdate = false;
    roadMesh.updateMatrix();
    this.rootGroup.add(roadMesh);
  }

  private buildGateBaseShrubs(shrubMat: THREE.MeshStandardMaterial): void {
    const puffGeo = createParabolicEllipsoidGeometry(1.15, 0.85, 1.05, 12, 8);
    this.geometries.push(puffGeo);

    const clusters: Array<[number, number]> = [
      [-10.4, -27.0],
      [-11.4, -26.3],
      [10.4, -27.0],
      [11.4, -26.3],
    ];
    for (let i = 0; i < clusters.length; i++) {
      const [sx, sz] = clusters[i];
      for (let k = 0; k < 3; k++) {
        const puff = new THREE.Mesh(puffGeo, shrubMat);
        const s = 0.72 + seededRand(i * 11 + k * 7) * 0.45;
        puff.scale.set(s * 1.15, s * 0.9, s);
        puff.position.set(
          sx + (k - 1) * 0.65,
          GROUND_Y + 0.34 * s,
          sz + (k % 2 === 0 ? -0.25 : 0.2),
        );
        puff.castShadow = true;
        puff.receiveShadow = true;
        this.rootGroup.add(puff);
      }
    }
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Cờ xanh dương phấp phới nhẹ trên 2 tháp cổng
    for (const banner of this.banners) {
      const pos = banner.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const base = banner.basePositions;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const u = Math.max(0, bx / 3.8);
        const waveZ =
          Math.sin(this.elapsed * 4.2 - u * 4.8 + banner.phase) * 0.26 * u +
          Math.sin(this.elapsed * 7.1 - u * 7.5 + banner.phase) * 0.08 * u;
        const dropY = -0.14 * u * u + Math.sin(this.elapsed * 3.1 - u * 3.0) * 0.05 * u;
        pos.setZ(i, base[i * 3 + 2] + waveZ);
        pos.setY(i, by + dropY);
      }
      pos.needsUpdate = true;
      banner.mesh.geometry.computeVertexNormals();
    }

    // Nhấp nháy nhẹ tự nhiên của ánh sáng đèn tường
    for (const item of this.flickerLights) {
      const flicker =
        0.93 +
        0.045 * Math.sin(this.elapsed * 6.5 + item.phase) +
        0.025 * Math.sin(this.elapsed * 13.7 + item.phase * 1.7);
      item.light.intensity = item.baseIntensity * flicker;
    }
  }

  dispose(): void {
    this.scene.remove(this.rootGroup);
    for (const geo of this.geometries) {
      geo.dispose();
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
    for (const tex of this.textures) {
      tex.dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    this.banners.length = 0;
    this.flickerLights.length = 0;
  }
}
