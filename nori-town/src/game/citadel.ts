import { BlockId, CHUNK_SIZE } from './constants';

export const CITADEL_SURFACE_Y = 3;
export const WALL_MIN = -25;
export const WALL_MAX = 24; // -25..24 = 50 blocks
export const WALL_THICKNESS = 2;
export const WALL_HEIGHT = 50;
export const WALL_TOP_Y = CITADEL_SURFACE_Y + WALL_HEIGHT; // y = 4..53 (50 blocks tall)

// Cổng 6x6x6 ở bức tường phía Bắc (-Z), chính diện hướng nhìn khi vừa vào game
export const GATE_OPEN_MIN_X = -3;
export const GATE_OPEN_MAX_X = 2; // 6 blocks wide (-3..2)
export const GATE_OPEN_MIN_Y = CITADEL_SURFACE_Y + 1; // y = 4
export const GATE_OPEN_MAX_Y = CITADEL_SURFACE_Y + 6; // y = 9 (6 blocks high)
export const GATE_MIN_Z = -27;
export const GATE_MAX_Z = -22; // 6 blocks deep (-27..-22)

// Viền đá bao quanh rìa cổng (trái, phải, trên)
export const GATE_BORDER_MIN_X = GATE_OPEN_MIN_X - 1; // -4
export const GATE_BORDER_MAX_X = GATE_OPEN_MAX_X + 1; // 3
export const GATE_BORDER_TOP_Y = GATE_OPEN_MAX_Y + 1; // 10

const LAYER_STRIDE = CHUNK_SIZE * CHUNK_SIZE;

export type WorldZone = 'inside' | 'gate' | 'wall' | 'outside';

export function getCitadelZoneAt(wx: number, wz: number): WorldZone {
  const inGateX = wx >= GATE_OPEN_MIN_X && wx <= GATE_OPEN_MAX_X;
  const inGateZ = wz >= GATE_MIN_Z && wz <= GATE_MAX_Z;
  if (inGateX && inGateZ) return 'gate';

  const inInner =
    wx >= WALL_MIN + WALL_THICKNESS &&
    wx <= WALL_MAX - WALL_THICKNESS &&
    wz >= WALL_MIN + WALL_THICKNESS &&
    wz <= WALL_MAX - WALL_THICKNESS;
  if (inInner) return 'inside';

  const inWall = wx >= WALL_MIN && wx <= WALL_MAX && wz >= WALL_MIN && wz <= WALL_MAX;
  if (inWall) return 'wall';

  return 'outside';
}

/**
 * Module Trong Thành:
 * - Xây dựng tường thành 50x50x50 (y = 4..53) trên nền cỏ phẳng thống nhất.
 * - Đục cổng 6x6x6 trên 1 bức tường và ốp viền đá ở rìa cổng.
 * - Trả về thông tin chunk có công trình thành hay không và chiều cao maxSolidY.
 */
export function applyCitadelToChunk(
  data: Uint8Array,
  cx: number,
  cz: number,
): { hasStructures: boolean; minSolidY: number; maxSolidY: number } {
  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;
  const chunkMaxX = baseX + CHUNK_SIZE - 1;
  const chunkMaxZ = baseZ + CHUNK_SIZE - 1;

  const minBoundX = Math.min(WALL_MIN, GATE_BORDER_MIN_X);
  const maxBoundX = Math.max(WALL_MAX, GATE_BORDER_MAX_X);
  const minBoundZ = Math.min(WALL_MIN, GATE_MIN_Z);
  const maxBoundZ = Math.max(WALL_MAX, GATE_MAX_Z);

  if (
    chunkMaxX < minBoundX ||
    baseX > maxBoundX ||
    chunkMaxZ < minBoundZ ||
    baseZ > maxBoundZ
  ) {
    return { hasStructures: false, minSolidY: 0, maxSolidY: 0 };
  }

  let hasStructures = false;
  let maxSolidY = 0;

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    const wz = baseZ + lz;
    if (wz < minBoundZ || wz > maxBoundZ) continue;
    const rowOffset = lz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseX + lx;
      if (wx < minBoundX || wx > maxBoundX) continue;

      const colOffset = rowOffset + lx;

      // 1. Dựng tường thành chính 50x50x50
      const inOuterWall =
        wx >= WALL_MIN && wx <= WALL_MAX && wz >= WALL_MIN && wz <= WALL_MAX;
      const inInnerCourtyard =
        wx >= WALL_MIN + WALL_THICKNESS &&
        wx <= WALL_MAX - WALL_THICKNESS &&
        wz >= WALL_MIN + WALL_THICKNESS &&
        wz <= WALL_MAX - WALL_THICKNESS;

      if (inOuterWall && !inInnerCourtyard) {
        hasStructures = true;
        for (let y = CITADEL_SURFACE_Y + 1; y <= WALL_TOP_Y; y++) {
          data[colOffset + y * LAYER_STRIDE] = BlockId.STONE;
        }
        if (WALL_TOP_Y + 1 > maxSolidY) {
          maxSolidY = WALL_TOP_Y + 1;
        }
      }

      // 2. Xử lý khu vực cổng 6x6x6 và viền đá ở rìa cổng
      const inGateDepth = wz >= GATE_MIN_Z && wz <= GATE_MAX_Z;
      const inGateFrameX = wx >= GATE_BORDER_MIN_X && wx <= GATE_BORDER_MAX_X;

      if (inGateDepth && inGateFrameX) {
        hasStructures = true;
        const inOpeningX = wx >= GATE_OPEN_MIN_X && wx <= GATE_OPEN_MAX_X;

        if (inOpeningX) {
          for (let y = GATE_OPEN_MIN_Y; y <= GATE_OPEN_MAX_Y; y++) {
            data[colOffset + y * LAYER_STRIDE] = BlockId.AIR;
          }
          data[colOffset + GATE_BORDER_TOP_Y * LAYER_STRIDE] = BlockId.STONE_BORDER;
        } else {
          for (let y = GATE_OPEN_MIN_Y; y <= GATE_BORDER_TOP_Y; y++) {
            data[colOffset + y * LAYER_STRIDE] = BlockId.STONE_BORDER;
          }
        }

        if (GATE_BORDER_TOP_Y + 1 > maxSolidY) {
          maxSolidY = GATE_BORDER_TOP_Y + 1;
        }
      }
    }
  }

  return {
    hasStructures,
    minSolidY: CITADEL_SURFACE_Y + 1,
    maxSolidY,
  };
}
