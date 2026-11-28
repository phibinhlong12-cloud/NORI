import { memo, useEffect, useState } from 'react';
import { ArrowLeftRight, Shield, Shirt, Sword, User, X } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';
import { CharacterGender } from '../game/firstPersonArms';
import { getKatanaDisplayName, getKatanaStatInfo } from '../game/katana';
import {
  getOutfitName,
  isOutfitCompatibleWithGender,
  OutfitId,
  OUTFITS,
} from '../game/outfits';
import { BackpackKatanaVariant } from '../game/trees';
import { Character3DViewport } from './Character3DViewport';
import { KatanaVariantSvg, OutfitItemSvg, ShieldItemSvg } from './CraftingIcons';

interface CharacterModalProps {
  engine: VoxelEngine | null;
}

interface CharacterWindowState {
  open: boolean;
  gender: CharacterGender;
  level: number;
  hasKatana: boolean;
  equippedKatana: BackpackKatanaVariant | null;
  hasShield: boolean;
  ownedOutfits: OutfitId[];
  equippedOutfit: OutfitId;
}

const INITIAL_STATE: CharacterWindowState = {
  open: false,
  gender: 'male',
  level: 1,
  hasKatana: false,
  equippedKatana: null,
  hasShield: false,
  ownedOutfits: ['default'],
  equippedOutfit: 'default',
};

export const CharacterModal = memo(function CharacterModal({ engine }: CharacterModalProps) {
  const [state, setState] = useState<CharacterWindowState>(INITIAL_STATE);
  const [showWeaponInfo, setShowWeaponInfo] = useState(false);

  useEffect(() => {
    if (!engine) {
      setState(INITIAL_STATE);
      return;
    }

    return engine.subscribeStats((stats: HudStats) => {
      setState((prev) => {
        if (
          prev.open === stats.characterWindowOpen &&
          prev.gender === stats.gender &&
          prev.level === stats.level &&
          prev.hasKatana === stats.hasKatana &&
          prev.equippedKatana === stats.equippedKatana &&
          prev.hasShield === stats.hasShield &&
          prev.ownedOutfits === stats.ownedOutfits &&
          prev.equippedOutfit === stats.equippedOutfit
        ) {
          return prev;
        }
        return {
          open: stats.characterWindowOpen,
          gender: stats.gender,
          level: stats.level,
          hasKatana: stats.hasKatana,
          equippedKatana: stats.equippedKatana,
          hasShield: stats.hasShield,
          ownedOutfits: stats.ownedOutfits,
          equippedOutfit: stats.equippedOutfit,
        };
      });
    });
  }, [engine]);

  useEffect(() => {
    if (!state.open || !state.hasKatana || !state.equippedKatana) {
      setShowWeaponInfo(false);
    }
  }, [state.open, state.hasKatana, state.equippedKatana]);

  if (!state.open) return null;

  const isMale = state.gender === 'male';
  const activeOutfit: OutfitId = isOutfitCompatibleWithGender(
    state.equippedOutfit,
    state.gender,
  )
    ? state.equippedOutfit
    : 'default';
  const compatibleOutfits = state.ownedOutfits.filter((id) =>
    isOutfitCompatibleWithGender(id, state.gender),
  );
  const hasMultipleOutfits = compatibleOutfits.length > 1;
  const hasCustomOutfitEquipped = activeOutfit !== 'default';
  const outfitInfo = OUTFITS[activeOutfit];
  const outfitDisplayName = getOutfitName(activeOutfit);

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-5 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative w-full max-w-3xl max-h-[92dvh] overflow-y-auto touch-pan-y bg-slate-900 border border-white/20 rounded-3xl p-4 sm:p-6 text-white shadow-2xl space-y-4">
        {/* Thanh tiêu đề cửa sổ nhân vật */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                isMale
                  ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
                  : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
              }`}
            >
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                Nhân Vật · {isMale ? 'Nam' : 'Nữ'} (Lv.{state.level})
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Kéo xoay mô hình 3D ·{' '}
                <span className="hidden sm:inline">Ấn B, ESC hoặc nút X để đóng</span>
                <span className="sm:hidden">Chạm nút X góc phải để đóng</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => engine?.closeCharacterWindow()}
            aria-label="Đóng cửa sổ nhân vật"
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-500/25 border border-white/15 hover:border-rose-400/50 text-slate-200 hover:text-rose-200 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bố cục 3 cột giống mẫu: Trái (Kiếm, Khiên) · Giữa (Hình ảnh nhân vật 3D) · Phải (Nón, Giáp, Quần, Giày) */}
        <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_180px] gap-4 items-center">
          {/* Cột trái: Hình thanh kiếm + Hình tấm khiên */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
            {state.hasKatana && state.equippedKatana ? (
              <button
                type="button"
                onClick={() => setShowWeaponInfo((prev) => !prev)}
                className={`rounded-2xl border p-3.5 flex flex-col items-center justify-center gap-2 text-center min-h-[112px] transition active:scale-95 cursor-pointer ${
                  state.equippedKatana === 'leaf'
                    ? 'bg-emerald-950/35 hover:bg-emerald-950/55 border-emerald-400/50'
                    : state.equippedKatana === 'ice'
                      ? 'bg-cyan-950/35 hover:bg-cyan-950/55 border-cyan-400/50'
                      : 'bg-sky-950/35 hover:bg-sky-950/55 border-sky-400/50'
                } ${showWeaponInfo ? 'ring-2 ring-amber-300 border-amber-300' : ''}`}
              >
                <div className="w-full max-w-[136px] h-11 rounded-xl bg-slate-950/85 border border-white/15 flex items-center justify-center px-2">
                  <KatanaVariantSvg variant={state.equippedKatana} className="w-full h-8" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">Thanh Kiếm</div>
                  <div
                    className={`text-[11px] mt-0.5 font-semibold ${
                      state.equippedKatana === 'leaf'
                        ? 'text-emerald-300'
                        : state.equippedKatana === 'ice'
                          ? 'text-cyan-300'
                          : 'text-sky-300'
                    }`}
                  >
                    {getKatanaDisplayName(state.equippedKatana)}
                  </div>
                  <div className="text-[10px] text-amber-300/90 mt-0.5">
                    {showWeaponInfo ? 'Ấn để ẩn thông tin' : 'Ấn xem sức mạnh'}
                  </div>
                </div>
              </button>
            ) : (
              <div className="rounded-2xl border p-3.5 flex flex-col items-center justify-center gap-2 text-center min-h-[112px] bg-slate-800/65 border-white/10">
                <div className="w-11 h-11 rounded-xl bg-slate-950/85 border border-white/15 flex items-center justify-center">
                  <Sword className="w-6 h-6 text-slate-500" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">Thanh Kiếm</div>
                  <div className="text-[11px] mt-0.5 font-semibold text-slate-500">Trống</div>
                </div>
              </div>
            )}

            <div
              className={`rounded-2xl border p-3.5 flex flex-col items-center justify-center gap-2 text-center min-h-[112px] ${
                state.hasShield
                  ? 'bg-amber-950/30 border-amber-400/45'
                  : 'bg-slate-800/65 border-white/10'
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-slate-950/85 border border-white/15 flex items-center justify-center">
                {state.hasShield ? (
                  <ShieldItemSvg className="w-8 h-8" />
                ) : (
                  <Shield className="w-6 h-6 text-slate-500" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Tấm Khiên</div>
                <div
                  className={`text-[11px] mt-0.5 font-semibold ${
                    state.hasShield ? 'text-emerald-300' : 'text-slate-500'
                  }`}
                >
                  {state.hasShield ? 'Khiên chắn' : 'Trống'}
                </div>
              </div>
            </div>
          </div>

          {/* Cột giữa: Hình ảnh nhân vật 3D sống động */}
          <div className="h-72 sm:h-88 w-full rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950/95 border border-white/15 overflow-hidden">
            <Character3DViewport
              gender={state.gender}
              outfit={activeOutfit}
              hasKatana={state.hasKatana}
              katanaVariant={state.equippedKatana}
              hasShield={state.hasShield}
              interactiveRotate
              initialYaw={0.2}
            />
          </div>

          {/* Cột phải: Ô Bộ đồ và ô Thay đổi đồ (hiện khi có > 1 bộ đồ) */}
          <div
            className={`grid gap-3 ${
              hasMultipleOutfits ? 'grid-cols-2 md:grid-cols-1' : 'grid-cols-1'
            }`}
          >
            <div
              className={`rounded-2xl border p-3.5 flex flex-col items-center justify-center gap-2 text-center min-h-[112px] ${
                hasCustomOutfitEquipped
                  ? outfitInfo.cardAccentClass
                  : 'bg-slate-800/65 border-white/10'
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-slate-950/85 border border-white/15 flex items-center justify-center">
                {hasCustomOutfitEquipped ? (
                  <OutfitItemSvg
                    outfit={activeOutfit}
                    gender={state.gender}
                    className="w-9 h-9"
                  />
                ) : (
                  <Shirt className="w-6 h-6 text-slate-500" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Bộ đồ</div>
                <div
                  className={`text-[11px] mt-0.5 font-semibold ${
                    hasCustomOutfitEquipped ? outfitInfo.badgeTextColor : 'text-slate-500'
                  }`}
                >
                  {hasCustomOutfitEquipped ? outfitDisplayName : 'Trống'}
                </div>
              </div>
            </div>

            {hasMultipleOutfits && (
              <button
                type="button"
                onClick={() => engine?.cycleOutfit()}
                className="rounded-2xl border border-cyan-400/40 bg-cyan-950/35 hover:bg-cyan-900/45 active:scale-95 transition p-3.5 flex flex-col items-center justify-center gap-2 text-center min-h-[112px] cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-950/85 border border-cyan-400/30 flex items-center justify-center">
                  <ArrowLeftRight className="w-6 h-6 text-cyan-300" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100">Thay đổi đồ</div>
                  <div className="text-[11px] mt-0.5 font-semibold text-cyan-300">
                    {outfitDisplayName}
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

        {showWeaponInfo && state.hasKatana && state.equippedKatana && (() => {
          const stat = getKatanaStatInfo(state.equippedKatana);
          const panelClasses =
            state.equippedKatana === 'ice'
              ? 'bg-cyan-950/45 border-cyan-400/45'
              : state.equippedKatana === 'leaf'
                ? 'bg-emerald-950/45 border-emerald-400/45'
                : 'bg-sky-950/40 border-sky-400/40';
          return (
            <div className={`rounded-2xl border p-3.5 sm:p-4 space-y-2.5 ${panelClasses}`}>
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-24 h-10 rounded-xl bg-slate-950/85 border border-white/15 flex items-center justify-center px-2 shrink-0">
                    <KatanaVariantSvg variant={state.equippedKatana} className="w-full h-7" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{stat.name}</div>
                    <div className="text-[11px] font-semibold text-amber-300">
                      Sát thương: {stat.damage} ({stat.damageBonusText})
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWeaponInfo(false)}
                  aria-label="Đóng thông tin kiếm"
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <ul className="space-y-1 text-xs text-slate-200">
                {stat.effects.map((effect) => (
                  <li key={effect}>• {effect}</li>
                ))}
              </ul>
            </div>
          );
        })()}
      </div>
    </div>
  );
});
