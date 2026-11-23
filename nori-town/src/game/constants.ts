export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const WATER_LEVEL = 18;

export enum BlockId {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD = 4,
  LEAVES = 5,
  SAND = 6,
  WATER = 7,
  BEDROCK = 8,
  STONE_BORDER = 9,
}

export interface HotbarBlock {
  id: BlockId;
  name: string;
  key: string;
}

export const HOTBAR_BLOCKS: HotbarBlock[] = [
  { id: BlockId.GRASS, name: 'Khối Cỏ', key: '1' },
  { id: BlockId.DIRT, name: 'Khối Đất', key: '2' },
  { id: BlockId.STONE, name: 'Khối Đá', key: '3' },
  { id: BlockId.WOOD, name: 'Gỗ Sồi', key: '4' },
  { id: BlockId.LEAVES, name: 'Lá Cây', key: '5' },
  { id: BlockId.SAND, name: 'Khối Cát', key: '6' },
];

export const BLOCK_NAMES: Record<BlockId, string> = {
  [BlockId.AIR]: 'Không khí',
  [BlockId.GRASS]: 'Khối Cỏ',
  [BlockId.DIRT]: 'Khối Đất',
  [BlockId.STONE]: 'Khối Đá',
  [BlockId.WOOD]: 'Gỗ Sồi',
  [BlockId.LEAVES]: 'Lá Cây',
  [BlockId.SAND]: 'Khối Cát',
  [BlockId.WATER]: 'Nước',
  [BlockId.BEDROCK]: 'Đá Nền',
  [BlockId.STONE_BORDER]: 'Viền Đá Cổng',
};

export const BLOCK_COLORS: Record<BlockId, string> = {
  [BlockId.AIR]: '#000000',
  [BlockId.GRASS]: '#59a632',
  [BlockId.DIRT]: '#866043',
  [BlockId.STONE]: '#8c929a',
  [BlockId.WOOD]: '#6b5132',
  [BlockId.LEAVES]: '#3a7d22',
  [BlockId.SAND]: '#dfd39b',
  [BlockId.WATER]: '#2b7de9',
  [BlockId.BEDROCK]: '#3a3d42',
  [BlockId.STONE_BORDER]: '#5a616b',
};

export enum TextureTileIndex {
  GRASS_TOP = 0,
  GRASS_SIDE = 1,
  DIRT = 2,
  STONE = 3,
  WOOD_SIDE = 4,
  WOOD_TOP = 5,
  LEAVES = 6,
  SAND = 7,
  WATER = 8,
  BEDROCK = 9,
}

export type FaceDirection = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';

export interface VoxelFaceCorner {
  pos: [number, number, number];
  uv: [number, number];
}

export interface VoxelFaceDef {
  dir: FaceDirection;
  offset: [number, number, number];
  shade: number;
  corners: [VoxelFaceCorner, VoxelFaceCorner, VoxelFaceCorner, VoxelFaceCorner];
}

export const VOXEL_FACES: VoxelFaceDef[] = [
  {
    dir: 'top',
    offset: [0, 1, 0],
    shade: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [0, 0] },
      { pos: [1, 1, 1], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [0, 1, 0], uv: [0, 1] },
    ],
  },
  {
    dir: 'bottom',
    offset: [0, -1, 0],
    shade: 0.52,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 0] },
      { pos: [1, 0, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [0, 1] },
    ],
  },
  {
    dir: 'left',
    offset: [-1, 0, 0],
    shade: 0.78,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 1, 0], uv: [0, 1] },
    ],
  },
  {
    dir: 'right',
    offset: [1, 0, 0],
    shade: 0.82,
    corners: [
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
    ],
  },
  {
    dir: 'front',
    offset: [0, 0, 1],
    shade: 0.9,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [1, 1, 1], uv: [1, 1] },
      { pos: [0, 1, 1], uv: [0, 1] },
    ],
  },
  {
    dir: 'back',
    offset: [0, 0, -1],
    shade: 0.72,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [0, 1, 0], uv: [1, 1] },
      { pos: [1, 1, 0], uv: [0, 1] },
    ],
  },
];

export function getBlockFaceTexture(blockId: BlockId, faceDir: FaceDirection): TextureTileIndex {
  switch (blockId) {
    case BlockId.GRASS:
      if (faceDir === 'top') return TextureTileIndex.GRASS_TOP;
      if (faceDir === 'bottom') return TextureTileIndex.DIRT;
      return TextureTileIndex.GRASS_SIDE;
    case BlockId.DIRT:
      return TextureTileIndex.DIRT;
    case BlockId.STONE:
      return TextureTileIndex.STONE;
    case BlockId.WOOD:
      if (faceDir === 'top' || faceDir === 'bottom') return TextureTileIndex.WOOD_TOP;
      return TextureTileIndex.WOOD_SIDE;
    case BlockId.LEAVES:
      return TextureTileIndex.LEAVES;
    case BlockId.SAND:
      return TextureTileIndex.SAND;
    case BlockId.WATER:
      return TextureTileIndex.WATER;
    case BlockId.BEDROCK:
      return TextureTileIndex.BEDROCK;
    default:
      return TextureTileIndex.STONE;
  }
}
