import { CharacterGender } from './firstPersonArms';

export type OutfitId =
  | 'default'
  | 'black_shinigami'
  | 'red_samurai'
  | 'female_black'
  | 'female_red'
  | 'female_white';

export type MaleOutfitId = OutfitId;
export type PurchasableOutfitId = Exclude<OutfitId, 'default'>;
export type PurchasableMaleOutfitId = PurchasableOutfitId;

export const MALE_OUTFIT_ORDER: PurchasableOutfitId[] = [
  'black_shinigami',
  'red_samurai',
];

export const FEMALE_OUTFIT_ORDER: PurchasableOutfitId[] = [
  'female_black',
  'female_red',
  'female_white',
];

export const OUTFIT_SHOP_ORDER: PurchasableOutfitId[] = [
  ...MALE_OUTFIT_ORDER,
  ...FEMALE_OUTFIT_ORDER,
];

export interface OutfitInfo {
  id: OutfitId;
  gender: CharacterGender | 'all';
  name: string;
  price: number;
  description: string;
  sleeveColor: string;
  sleeveSheen: string;
  cuffColor: string;
  cuffSheen: string;
  accentTrimColor: string;
  slashArcColor: string;
  badgeTextColor: string;
  cardAccentClass: string;
}

export type MaleOutfitInfo = OutfitInfo;

export const OUTFITS: Record<OutfitId, OutfitInfo> = {
  default: {
    id: 'default',
    gender: 'all',
    name: 'Mặc định',
    price: 0,
    description: 'Trang phục truyền thống của Nori Town.',
    sleeveColor: '#f97316',
    sleeveSheen: '#fed7aa',
    cuffColor: '#b91c1c',
    cuffSheen: '#fca5a5',
    accentTrimColor: '#1f1b24',
    slashArcColor: '#f8fafc',
    badgeTextColor: 'text-amber-300',
    cardAccentClass: 'border-amber-400/35 bg-amber-950/20',
  },
  black_shinigami: {
    id: 'black_shinigami',
    gender: 'male',
    name: 'Hắc Y Kiếm Sĩ',
    price: 5000,
    description:
      'Võ phục đen tuyền viền cổ & tay áo trắng tinh khôi cùng đai obi trắng nổi bật (chỉ Nam).',
    sleeveColor: '#181920',
    sleeveSheen: '#64748b',
    cuffColor: '#f1f5f9',
    cuffSheen: '#ffffff',
    accentTrimColor: '#090a0e',
    slashArcColor: '#e2e8f0',
    badgeTextColor: 'text-slate-200',
    cardAccentClass: 'border-slate-400/45 bg-slate-900/60',
  },
  red_samurai: {
    id: 'red_samurai',
    gender: 'male',
    name: 'Huyết Phong Samurai',
    price: 10000,
    description:
      'Kimono đỏ thẫm vai caro kết hợp khăn choàng đỏ rực & hakama đen uy nghiêm (chỉ Nam).',
    sleeveColor: '#8f1d22',
    sleeveSheen: '#fca5a5',
    cuffColor: '#ef4444',
    cuffSheen: '#fecaca',
    accentTrimColor: '#111318',
    slashArcColor: '#fda4af',
    badgeTextColor: 'text-rose-300',
    cardAccentClass: 'border-rose-400/45 bg-rose-950/30',
  },
  female_black: {
    id: 'female_black',
    gender: 'female',
    name: 'Hắc Hoa Kimono',
    price: 5000,
    description:
      'Kimono đen hoa đỏ trắng viền chỉ vàng, đai obi sọc đỏ trắng & tất cao cổ trắng (chỉ Nữ).',
    sleeveColor: '#161720',
    sleeveSheen: '#64748b',
    cuffColor: '#101118',
    cuffSheen: '#94a3b8',
    accentTrimColor: '#eab308',
    slashArcColor: '#cbd5e1',
    badgeTextColor: 'text-slate-200',
    cardAccentClass: 'border-slate-400/45 bg-slate-900/65',
  },
  female_red: {
    id: 'female_red',
    gender: 'female',
    name: 'Hồng Hoa Kimono',
    price: 10000,
    description:
      'Kimono đỏ rực hoa anh đào viền vàng, đai obi sọc đen trắng & tất trắng (chỉ Nữ).',
    sleeveColor: '#b91c24',
    sleeveSheen: '#fecaca',
    cuffColor: '#ef4444',
    cuffSheen: '#fee2e2',
    accentTrimColor: '#facc15',
    slashArcColor: '#fda4af',
    badgeTextColor: 'text-rose-300',
    cardAccentClass: 'border-rose-400/45 bg-rose-950/30',
  },
  female_white: {
    id: 'female_white',
    gender: 'female',
    name: 'Bạch Hoa Kimono',
    price: 15000,
    description:
      'Kimono trắng tinh khôi họa tiết mẫu đơn đỏ vàng, đai obi đỏ rực & tất trắng (chỉ Nữ).',
    sleeveColor: '#f8fafc',
    sleeveSheen: '#ffffff',
    cuffColor: '#ffffff',
    cuffSheen: '#ffffff',
    accentTrimColor: '#dc2626',
    slashArcColor: '#ffffff',
    badgeTextColor: 'text-white',
    cardAccentClass: 'border-white/45 bg-slate-800/60',
  },
};

export const MALE_OUTFITS = OUTFITS;

export function isOutfitCompatibleWithGender(
  id: OutfitId,
  gender: CharacterGender,
): boolean {
  const info = OUTFITS[id];
  if (!info) return false;
  return info.gender === 'all' || info.gender === gender;
}

export function getOutfitName(id: OutfitId): string {
  return OUTFITS[id]?.name ?? 'Mặc định';
}

export function getMaleOutfitName(id: OutfitId): string {
  return getOutfitName(id);
}
