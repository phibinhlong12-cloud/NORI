import * as THREE from 'three';
import { BLOCK_COLORS, BlockId } from './constants';

export type BlockRgbTable = Record<BlockId, [number, number, number]>;

export function createBlockRgbTable(): BlockRgbTable {
  const table = {} as BlockRgbTable;
  const temp = new THREE.Color();

  for (const key of Object.keys(BLOCK_COLORS)) {
    const id = Number(key) as BlockId;
    temp.set(BLOCK_COLORS[id]);
    table[id] = [temp.r, temp.g, temp.b];
  }

  return table;
}

export function createSolidVoxelMaterial(
  options: {
    transparent?: boolean;
    opacity?: number;
    side?: THREE.Side;
  } = {},
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.04,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `varying vec3 vTerrainWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader =
      `varying vec3 vTerrainWorldPos;
      float hashTerrain2D(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float valueNoiseTerrain(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hashTerrain2D(i);
        float b = hashTerrain2D(i + vec2(1.0, 0.0));
        float c = hashTerrain2D(i + vec2(0.0, 1.0));
        float d = hashTerrain2D(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }\n` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 triCoord = vTerrainWorldPos.xz + vec2(vTerrainWorldPos.y * 0.73, vTerrainWorldPos.y * 0.41);
        float fineGrain = valueNoiseTerrain(triCoord * 4.2);
        float microGrain = valueNoiseTerrain(triCoord * 13.5);
        float detailFactor = 0.91 + fineGrain * 0.11 + microGrain * 0.05;
        diffuseColor.rgb *= detailFactor;`,
      );
  };
  mat.customProgramCacheKey = () => 'solid-voxel-micrograin-v1';

  return mat;
}

export function createBarkTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#5c4228';
  ctx.fillRect(0, 0, 256, 256);

  // Các đường rãnh vỏ cây sồi sắc nét theo chiều dọc
  for (let i = 0; i < 420; i++) {
    const rx = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const ry = ((Math.sin(i * 78.233) * 43758.5453) % 1 + 1) % 1;
    const rw = ((Math.sin(i * 45.164) * 43758.5453) % 1 + 1) % 1;
    const x = rx * 256;
    const y = ry * 256;
    const w = 2 + rw * 5;
    const h = 18 + rw * 44;

    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(42, 27, 14, 0.55)'
        : i % 3 === 1
          ? 'rgba(128, 95, 58, 0.34)'
          : 'rgba(64, 46, 28, 0.45)';
    ctx.fillRect(x, y, w, h);
    if (y + h > 256) {
      ctx.fillRect(x, y - 256, w, h);
    }
  }

  // Điểm mắt gỗ tự nhiên
  for (let k = 0; k < 14; k++) {
    const kx = (((Math.sin(k * 91.7) * 43758.5453) % 1 + 1) % 1) * 230 + 12;
    const ky = (((Math.sin(k * 37.3) * 43758.5453) % 1 + 1) % 1) * 230 + 12;
    ctx.fillStyle = 'rgba(34, 21, 11, 0.55)';
    ctx.beginPath();
    ctx.ellipse(kx, ky, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

export function createHeartwoodTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#d6b47e';
  ctx.fillRect(0, 0, 128, 128);

  const cx = 64;
  const cy = 64;
  for (let r = 56; r >= 6; r -= 7) {
    ctx.strokeStyle = r % 14 === 0 ? 'rgba(138, 96, 52, 0.42)' : 'rgba(176, 134, 82, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = '#5a3f24';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

export function createLeafCanopyTexture(
  baseHex: string,
  highlightHex: string,
  shadowHex: string,
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Các cụm lá đan xen sắc nét tạo chiều sâu tán cây
  for (let i = 0; i < 620; i++) {
    const rx = ((Math.sin(i * 19.31) * 43758.5453) % 1 + 1) % 1;
    const ry = ((Math.sin(i * 73.17) * 43758.5453) % 1 + 1) % 1;
    const rs = ((Math.sin(i * 41.89) * 43758.5453) % 1 + 1) % 1;
    const ra = ((Math.sin(i * 67.43) * 43758.5453) % 1 + 1) % 1;
    const x = rx * 256;
    const y = ry * 256;
    const radiusX = 5 + rs * 9;
    const radiusY = 3 + rs * 5.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ra * Math.PI);
    ctx.fillStyle = i % 3 === 0 ? highlightHex : i % 3 === 1 ? shadowHex : baseHex;
    ctx.globalAlpha = i % 3 === 0 ? 0.58 : 0.48;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

export function createDragonScaleTexture(
  baseHex: string,
  edgeHex: string,
  highlightHex: string,
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  const rows = 10;
  const cols = 8;
  const cellW = 256 / cols;
  const cellH = 256 / rows;

  for (let r = -1; r <= rows; r++) {
    const offsetX = r % 2 === 0 ? 0 : cellW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const cx = c * cellW + offsetX;
      const cy = r * cellH;

      ctx.fillStyle = edgeHex;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + cellW * 0.5, cy + cellH * 0.85);
      ctx.lineTo(cx + cellW, cy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = baseHex;
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy + 2);
      ctx.lineTo(cx + cellW * 0.5, cy + cellH * 0.72);
      ctx.lineTo(cx + cellW - 2, cy + 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = highlightHex;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy + 3);
      ctx.lineTo(cx + cellW * 0.5, cy + cellH * 0.65);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

export function createSoftShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(6, 14, 24, 0.58)');
  grad.addColorStop(0.55, 'rgba(6, 14, 24, 0.28)');
  grad.addColorStop(1, 'rgba(6, 14, 24, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
