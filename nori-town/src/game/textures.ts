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
): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });
}
