import * as THREE from 'three';
import {
  GATE_BORDER_MAX_X,
  GATE_BORDER_MIN_X,
  GATE_MIN_Z,
  WALL_MAX,
  WALL_MIN,
} from './citadel';
import { BLOCK_COLORS, BlockId, CHUNK_SIZE } from './constants';
import {
  DRAGON_ZONE_SPEC,
  isInsideDragonZone,
  isInsideMushroomZone,
  isInsideSlimeZone,
} from './slimeZones';

export const FLAT_GROUND_Y = 4.0;

// Vùng đệm phẳng quanh tường thành và cửa cổng để mặt đất chuyển tiếp mượt ra đồi parabol
const FLAT_PAD_MIN_X = WALL_MIN - 3;
const FLAT_PAD_MAX_X = WALL_MAX + 3;
const FLAT_PAD_MIN_Z = GATE_MIN_Z - 4;
const FLAT_PAD_MAX_Z = WALL_MAX + 3;

const MACRO_CELL = 20;
const DETAIL_CELL = 11;

const baseGrassColor = new THREE.Color('#4f9e2b');
const sunlitGrassColor = new THREE.Color('#73c43c');
const hollowMossColor = new THREE.Color('#397d22');
const slopeEarthColor = new THREE.Color('#6a8530');

const deepIceColor = new THREE.Color('#2b6cb0');
const midIceColor = new THREE.Color('#7dd3fc');
const frostIceColor = new THREE.Color('#d8f1ff');
const snowCapColor = new THREE.Color('#f4fbff');
const tempBlendedColor = new THREE.Color();
const tempIceColor = new THREE.Color();

interface IceShelfSpec {
  dx: number;
  dz: number;
  rx: number;
  rz: number;
  rot: number;
  height: number;
}

// Các khoảng nhô cao của tảng băng phân bố quanh Lãnh Địa Rồng Băng (chừa lối trung tâm cho giao tranh)
const DRAGON_ICE_SHELVES: IceShelfSpec[] = [
  { dx: -15.5, dz: -6.0, rx: 7.5, rz: 5.5, rot: 0.45, height: 2.8 },
  { dx: 16.0, dz: -4.5, rx: 7.2, rz: 5.8, rot: -0.35, height: 2.6 },
  { dx: -13.5, dz: 12.5, rx: 6.8, rz: 5.2, rot: -0.5, height: 2.3 },
  { dx: 14.5, dz: 13.0, rx: 6.6, rz: 5.4, rot: 0.55, height: 2.4 },
  { dx: 0.0, dz: -20.5, rx: 11.0, rz: 6.5, rot: 0.08, height: 3.9 },
  { dx: -21.0, dz: -15.0, rx: 6.5, rz: 6.0, rot: 0.8, height: 3.4 },
  { dx: 21.5, dz: -15.5, rx: 6.5, rz: 5.8, rot: -0.75, height: 3.5 },
  { dx: -23.0, dz: 4.5, rx: 6.2, rz: 6.4, rot: 0.2, height: 3.1 },
  { dx: 23.0, dz: 5.5, rx: 6.4, rz: 6.0, rot: -0.25, height: 3.0 },
  { dx: -7.5, dz: 21.5, rx: 5.4, rz: 4.5, rot: 0.3, height: 1.75 },
  { dx: 8.5, dz: 21.0, rx: 5.2, rz: 4.6, rot: -0.3, height: 1.75 },
  { dx: -8.5, dz: -13.0, rx: 4.6, rz: 3.8, rot: 0.6, height: 1.45 },
  { dx: 9.0, dz: -12.5, rx: 4.5, rz: 3.8, rot: -0.6, height: 1.45 },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash2D(ix: number, iz: number, seed: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + seed * 17.13) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(wx: number, wz: number, seed: number): number {
  const ix = Math.floor(wx);
  const iz = Math.floor(wz);
  const fx = wx - ix;
  const fz = wz - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz, seed);
  const b = hash2D(ix + 1, iz, seed);
  const c = hash2D(ix, iz + 1, seed);
  const d = hash2D(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/**
 * Module Ngoài Thành:
 * - Địa hình đồng cỏ gồ ghề dạng parabol liên tục (không có cạnh vuông 90 độ).
 * - Chuyển tiếp mượt từ nền phẳng trong thành/cổng (y = 4.0) ra các gò parabol bên ngoài.
 * - Riêng Lãnh Địa Rồng Băng được tạo hình thành vùng tảng băng nhô cao nhiều tầng.
 */
export class OutsideGenerator {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  resetSeed(newSeed: number): void {
    this.seed = newSeed;
  }

  private sampleParabolicLayer(
    wx: number,
    wz: number,
    cellSize: number,
    minRadius: number,
    maxRadius: number,
    minAmp: number,
    maxAmp: number,
    seedOffset: number,
  ): number {
    const gx = Math.floor(wx / cellSize);
    const gz = Math.floor(wz / cellSize);
    const s = this.seed + seedOffset;
    let total = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = gx + dx;
        const cz = gz + dz;
        const r1 = hash2D(cx, cz, s);
        const r2 = hash2D(cx + 19, cz - 37, s);
        const r3 = hash2D(cx - 53, cz + 71, s);
        const r4 = hash2D(cx + 97, cz + 13, s);

        const centerX = (cx + 0.15 + r1 * 0.7) * cellSize;
        const centerZ = (cz + 0.15 + r2 * 0.7) * cellSize;
        const radius = minRadius + r3 * (maxRadius - minRadius);
        const distSq = (wx - centerX) * (wx - centerX) + (wz - centerZ) * (wz - centerZ);
        const radSq = radius * radius;

        if (distSq < radSq) {
          // Hàm parabol trơn (1 - u^2)^2 tạo đỉnh parabol tự nhiên và tiếp tuyến bằng 0 ở chân đồi
          const k = 1 - distSq / radSq;
          const amp = minAmp + r4 * (maxAmp - minAmp);
          total += amp * k * k;
        }
      }
    }

    return total;
  }

  private sampleDragonIceFieldHeight(wx: number, wz: number): number {
    const rx = wx - DRAGON_ZONE_SPEC.x;
    const rz = wz - DRAGON_ZONE_SPEC.z;

    // Nền băng chính gợn sóng nhẹ
    const ripple = (valueNoise2D(wx * 0.12, wz * 0.12, this.seed + 901) - 0.5) * 0.75;
    const fineIce = (valueNoise2D(wx * 0.34, wz * 0.34, this.seed + 955) - 0.5) * 0.28;
    let height = FLAT_GROUND_Y + 0.2 + ripple + fineIce;

    // Cộng dồn các khối tảng băng nhô cao (dạng gò/bậc băng mượt đi lên được)
    for (const shelf of DRAGON_ICE_SHELVES) {
      const ox = rx - shelf.dx;
      const oz = rz - shelf.dz;
      const cosR = Math.cos(shelf.rot);
      const sinR = Math.sin(shelf.rot);
      const lx = (ox * cosR + oz * sinR) / shelf.rx;
      const lz = (-ox * sinR + oz * cosR) / shelf.rz;
      const u = lx * lx + lz * lz;
      if (u < 1.0) {
        const ridge = smoothstep(1.0, 0.22, u);
        height += shelf.height * ridge;
      }
    }

    return height;
  }

  getDistanceOutsideFlatApron(wx: number, wz: number): number {
    let dx = 0;
    if (wx < FLAT_PAD_MIN_X) dx = FLAT_PAD_MIN_X - wx;
    else if (wx > FLAT_PAD_MAX_X) dx = wx - FLAT_PAD_MAX_X;

    let dz = 0;
    if (wz < FLAT_PAD_MIN_Z) dz = FLAT_PAD_MIN_Z - wz;
    else if (wz > FLAT_PAD_MAX_Z) dz = wz - FLAT_PAD_MAX_Z;

    return Math.hypot(dx, dz);
  }

  getHeightAt(wx: number, wz: number): number {
    const dist = this.getDistanceOutsideFlatApron(wx, wz);
    if (dist <= 0) return FLAT_GROUND_Y;

    const blend = smoothstep(0, 10, dist);
    const macro = this.sampleParabolicLayer(wx, wz, MACRO_CELL, 9, 15, -1.2, 5.8, 101);
    const detail = this.sampleParabolicLayer(wx, wz, DETAIL_CELL, 4.5, 8.0, -0.6, 2.2, 409);
    const meadowH = Math.max(1.5, FLAT_GROUND_Y + blend * (macro + detail));

    const dragonDist = Math.hypot(wx - DRAGON_ZONE_SPEC.x, wz - DRAGON_ZONE_SPEC.z);
    if (dragonDist >= DRAGON_ZONE_SPEC.radius + 3.0) {
      return meadowH;
    }

    const iceWeight = smoothstep(DRAGON_ZONE_SPEC.radius + 3.0, DRAGON_ZONE_SPEC.radius - 4.0, dragonDist);
    const iceH = this.sampleDragonIceFieldHeight(wx, wz);
    return meadowH * (1 - iceWeight) + iceH * iceWeight;
  }

  isTreeAllowedAt(wx: number, wz: number): boolean {
    // Không mọc cây bên trong thành, trên tường thành hoặc chắn lối cổng
    if (
      wx >= WALL_MIN - 4.5 &&
      wx <= WALL_MAX + 4.5 &&
      wz >= GATE_MIN_Z - 6 &&
      wz <= WALL_MAX + 4.5
    ) {
      return false;
    }
    if (
      wx >= GATE_BORDER_MIN_X - 4 &&
      wx <= GATE_BORDER_MAX_X + 4 &&
      wz >= GATE_MIN_Z - 21 &&
      wz <= GATE_MIN_Z
    ) {
      return false;
    }
    if (
      isInsideSlimeZone(wx, wz, 1.8) ||
      isInsideMushroomZone(wx, wz, 1.8) ||
      isInsideDragonZone(wx, wz, 3.0)
    ) {
      return false;
    }
    return true;
  }

  isGrassAllowedAt(wx: number, wz: number): boolean {
    // Không mọc cỏ bên trong thành, trên nền tường thành, tháp cổng, đường đá cuội hoặc vùng tảng băng Rồng Băng
    if (
      wx >= WALL_MIN - 2.5 &&
      wx <= WALL_MAX + 2.5 &&
      wz >= GATE_MIN_Z - 3.0 &&
      wz <= WALL_MAX + 2.5
    ) {
      return false;
    }
    if (
      wx >= -4.2 &&
      wx <= 4.2 &&
      wz >= GATE_MIN_Z - 20 &&
      wz <= GATE_MIN_Z
    ) {
      return false;
    }
    if (isInsideDragonZone(wx, wz, 2.2)) {
      return false;
    }
    return true;
  }

  buildChunkGroundMesh(
    cx: number,
    cz: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const grid = CHUNK_SIZE;
    const vertsPerSide = grid + 1;
    const vertCount = vertsPerSide * vertsPerSide;

    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const indices = new Uint16Array(grid * grid * 6);

    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    const eps = 0.35;

    let vPtr = 0;
    for (let lz = 0; lz <= grid; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx <= grid; lx++) {
        const wx = baseX + lx;
        const h = this.getHeightAt(wx, wz);

        const hL = this.getHeightAt(wx - eps, wz);
        const hR = this.getHeightAt(wx + eps, wz);
        const hD = this.getHeightAt(wx, wz - eps);
        const hU = this.getHeightAt(wx, wz + eps);

        let nx = hL - hR;
        let ny = 2 * eps;
        let nz = hD - hU;
        const invLen = 1 / Math.hypot(nx, ny, nz);
        nx *= invLen;
        ny *= invLen;
        nz *= invLen;

        const idx3 = vPtr * 3;
        positions[idx3] = wx;
        positions[idx3 + 1] = h;
        positions[idx3 + 2] = wz;

        normals[idx3] = nx;
        normals[idx3 + 1] = ny;
        normals[idx3 + 2] = nz;

        // Pha màu cỏ hữu cơ theo độ cao đồi, độ dốc và thảm rêu tự nhiên
        const outsideDist = this.getDistanceOutsideFlatApron(wx, wz);
        const outsideBlend = smoothstep(0, 6, outsideDist);
        const meadowNoise = valueNoise2D(wx * 0.085, wz * 0.085, this.seed + 77);
        const patchNoise = valueNoise2D(wx * 0.24, wz * 0.24, this.seed + 211);

        tempBlendedColor.copy(baseGrassColor);
        if (outsideBlend > 0.01) {
          const sunMix = smoothstep(0.42, 0.85, meadowNoise) * 0.58 + smoothstep(4.2, 8.2, h) * 0.35;
          const mossMix = smoothstep(0.55, 0.9, 1 - patchNoise) * 0.42 + smoothstep(4.0, 2.3, h) * 0.45;
          const slopeMix = smoothstep(0.92, 0.72, ny) * 0.55;

          tempBlendedColor.lerp(sunlitGrassColor, Math.min(0.82, sunMix) * outsideBlend);
          tempBlendedColor.lerp(hollowMossColor, Math.min(0.68, mossMix) * outsideBlend);
          tempBlendedColor.lerp(slopeEarthColor, Math.min(0.6, slopeMix) * outsideBlend);
        } else {
          // Sân cỏ trong thành giữ sắc xanh đều sạch mắt, điểm gợn cỏ rất nhẹ
          tempBlendedColor.set(BLOCK_COLORS[BlockId.GRASS]).lerp(sunlitGrassColor, patchNoise * 0.14);
        }

        // Vùng tảng băng Lãnh Địa Rồng Băng (không còn đồng cỏ xanh)
        const dragonDist = Math.hypot(wx - DRAGON_ZONE_SPEC.x, wz - DRAGON_ZONE_SPEC.z);
        if (dragonDist < DRAGON_ZONE_SPEC.radius + 2.5) {
          const iceBlend = smoothstep(
            DRAGON_ZONE_SPEC.radius + 2.5,
            DRAGON_ZONE_SPEC.radius - 2.5,
            dragonDist,
          );
          const veinNoise = valueNoise2D(wx * 0.19, wz * 0.19, this.seed + 883);
          const heightFactor = smoothstep(4.0, 7.2, h);
          const slopeBlue = smoothstep(0.94, 0.65, ny);

          tempIceColor.copy(midIceColor);
          tempIceColor.lerp(deepIceColor, Math.min(0.85, veinNoise * 0.55 + slopeBlue * 0.65));
          tempIceColor.lerp(frostIceColor, Math.min(0.92, heightFactor * 0.78 + (1 - veinNoise) * 0.22));
          if (h > 5.4 && ny > 0.84) {
            tempIceColor.lerp(snowCapColor, smoothstep(5.4, 7.5, h) * 0.75);
          }

          tempBlendedColor.lerp(tempIceColor, iceBlend);
        }

        colors[idx3] = tempBlendedColor.r;
        colors[idx3 + 1] = tempBlendedColor.g;
        colors[idx3 + 2] = tempBlendedColor.b;

        vPtr++;
      }
    }

    let iPtr = 0;
    for (let lz = 0; lz < grid; lz++) {
      for (let lx = 0; lx < grid; lx++) {
        const a = lz * vertsPerSide + lx;
        const b = a + 1;
        const c = a + vertsPerSide;
        const d = c + 1;

        indices[iPtr++] = a;
        indices[iPtr++] = c;
        indices[iPtr++] = b;

        indices[iPtr++] = b;
        indices[iPtr++] = c;
        indices[iPtr++] = d;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }
}
