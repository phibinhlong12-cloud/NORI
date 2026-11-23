import * as THREE from 'three';
import {
  GATE_BORDER_MAX_X,
  GATE_BORDER_MIN_X,
  GATE_MIN_Z,
  WALL_MAX,
  WALL_MIN,
} from './citadel';
import { BLOCK_COLORS, BlockId, CHUNK_SIZE } from './constants';
import { isInsideSlimeZone } from './slimeZones';

export const FLAT_GROUND_Y = 4.0;

// Vùng đệm phẳng quanh tường thành và cửa cổng để mặt đất chuyển tiếp mượt ra đồi parabol
const FLAT_PAD_MIN_X = WALL_MIN - 3;
const FLAT_PAD_MAX_X = WALL_MAX + 3;
const FLAT_PAD_MIN_Z = GATE_MIN_Z - 4;
const FLAT_PAD_MAX_Z = WALL_MAX + 3;

const MACRO_CELL = 20;
const DETAIL_CELL = 11;

const tempGrassColor = new THREE.Color(BLOCK_COLORS[BlockId.GRASS]);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash2D(ix: number, iz: number, seed: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + seed * 17.13) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Module Ngoài Thành:
 * - Địa hình đồng cỏ gồ ghề dạng parabol liên tục (không có cạnh vuông 90 độ).
 * - Chuyển tiếp mượt từ nền phẳng trong thành/cổng (y = 4.0) ra các gò parabol bên ngoài.
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

    return Math.max(1.5, FLAT_GROUND_Y + blend * (macro + detail));
  }

  isTreeAllowedAt(wx: number, wz: number): boolean {
    // Không mọc cây bên trong thành, trên tường thành hoặc chắn lối cổng
    if (
      wx >= WALL_MIN - 4 &&
      wx <= WALL_MAX + 4 &&
      wz >= GATE_MIN_Z - 6 &&
      wz <= WALL_MAX + 4
    ) {
      return false;
    }
    if (
      wx >= GATE_BORDER_MIN_X - 5 &&
      wx <= GATE_BORDER_MAX_X + 5 &&
      wz >= GATE_MIN_Z - 14 &&
      wz <= GATE_MIN_Z
    ) {
      return false;
    }
    if (isInsideSlimeZone(wx, wz, 1.8)) {
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

    const gr = tempGrassColor.r;
    const gg = tempGrassColor.g;
    const gb = tempGrassColor.b;

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

        colors[idx3] = gr;
        colors[idx3 + 1] = gg;
        colors[idx3 + 2] = gb;

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
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }
}
