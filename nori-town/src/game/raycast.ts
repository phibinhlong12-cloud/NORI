import * as THREE from 'three';
import { BlockId } from './constants';
import { WorldManager } from './world';

export interface RaycastHit {
  blockPos: [number, number, number];
  placePos: [number, number, number];
  normal: [number, number, number];
  blockId: BlockId;
}

export function voxelRaycast(
  world: WorldManager,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance = 6.5,
): RaycastHit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = direction.x > 0 ? 1 : -1;
  const stepY = direction.y > 0 ? 1 : -1;
  const stepZ = direction.z > 0 ? 1 : -1;

  const tDeltaX = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
  const tDeltaY = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
  const tDeltaZ = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;

  let tMaxX = direction.x > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
  let tMaxY = direction.y > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
  let tMaxZ = direction.z > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;

  let normal: [number, number, number] = [0, 0, 0];
  let distance = 0;

  for (let i = 0; i < 64; i++) {
    const blockId = world.getBlockAt(x, y, z);
    if (blockId !== BlockId.AIR && blockId !== BlockId.WATER) {
      return {
        blockPos: [x, y, z],
        placePos: [x + normal[0], y + normal[1], z + normal[2]],
        normal,
        blockId,
      };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        distance = tMaxX;
        if (distance > maxDistance) break;
        x += stepX;
        tMaxX += tDeltaX;
        normal = [-stepX, 0, 0];
      } else {
        distance = tMaxZ;
        if (distance > maxDistance) break;
        z += stepZ;
        tMaxZ += tDeltaZ;
        normal = [0, 0, -stepZ];
      }
    } else if (tMaxY < tMaxZ) {
      distance = tMaxY;
      if (distance > maxDistance) break;
      y += stepY;
      tMaxY += tDeltaY;
      normal = [0, -stepY, 0];
    } else {
      distance = tMaxZ;
      if (distance > maxDistance) break;
      z += stepZ;
      tMaxZ += tDeltaZ;
      normal = [0, 0, -stepZ];
    }
  }

  return null;
}
