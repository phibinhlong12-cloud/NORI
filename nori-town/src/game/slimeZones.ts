export interface SlimeZoneSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
}

export const SLIME_ZONE_SPECS: SlimeZoneSpec[] = [
  {
    id: 'zone-west',
    name: 'Vùng Slime Tây',
    x: -24,
    z: -48,
    radius: 14.5,
  },
  {
    id: 'zone-east',
    name: 'Vùng Slime Đông',
    x: 25,
    z: -48,
    radius: 14.5,
  },
  {
    id: 'zone-north',
    name: 'Vùng Slime Bắc',
    x: 0.5,
    z: -74,
    radius: 15.5,
  },
];

export const DRAGON_ZONE_SPEC: SlimeZoneSpec = {
  id: 'dragon-ice-zone',
  name: 'Lãnh Địa Rồng Băng',
  x: 0.5,
  z: -138,
  radius: 34,
};

export const MUSHROOM_ZONE_SPECS: SlimeZoneSpec[] = [
  {
    id: 'mushroom-west',
    name: 'Vùng Nấm Độc Tây',
    x: -51,
    z: 0,
    radius: 17.5,
  },
  {
    id: 'mushroom-east',
    name: 'Vùng Nấm Độc Đông',
    x: 50,
    z: 0,
    radius: 17.5,
  },
];

export function isInsideSlimeZone(wx: number, wz: number, padding = 0): boolean {
  for (const zone of SLIME_ZONE_SPECS) {
    const r = zone.radius + padding;
    const dx = wx - zone.x;
    const dz = wz - zone.z;
    if (dx * dx + dz * dz <= r * r) {
      return true;
    }
  }
  return false;
}

export function isInsideMushroomZone(wx: number, wz: number, padding = 0): boolean {
  for (const zone of MUSHROOM_ZONE_SPECS) {
    const r = zone.radius + padding;
    const dx = wx - zone.x;
    const dz = wz - zone.z;
    if (dx * dx + dz * dz <= r * r) {
      return true;
    }
  }
  return false;
}

export function isInsideDragonZone(wx: number, wz: number, padding = 0): boolean {
  const r = DRAGON_ZONE_SPEC.radius + padding;
  const dx = wx - DRAGON_ZONE_SPEC.x;
  const dz = wz - DRAGON_ZONE_SPEC.z;
  return dx * dx + dz * dz <= r * r;
}

export const MAX_PLAYER_HP = 100;
export const MAX_LEVEL = 30;

/**
 * Level 1 cần 100 điểm kinh nghiệm, mỗi level tiếp theo cần +50% so với level trước.
 * Max level = 30.
 */
export function getXpForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  let required = 100;
  for (let i = 1; i < level; i++) {
    required = Math.round(required * 1.5);
  }
  return required;
}
