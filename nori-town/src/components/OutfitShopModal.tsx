import { memo, useEffect, useState } from 'react';
import { Check, Coins, Lock, RotateCcw, Shirt, Sparkles, X } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';
import { CharacterGender } from '../game/firstPersonArms';
import {
  FEMALE_OUTFIT_ORDER,
  isOutfitCompatibleWithGender,
  MALE_OUTFIT_ORDER,
  OutfitId,
  OUTFITS,
} from '../game/outfits';
import { Character3DViewport } from './Character3DViewport';

interface OutfitShopModalProps {
  engine: VoxelEngine | null;
}

interface OutfitShopState {
  open: boolean;
  money: number;
  gender: CharacterGender;
  ownedOutfits: OutfitId[];
  equippedOutfit: OutfitId;
}

const INITIAL_OUTFIT_SHOP_STATE: OutfitShopState = {
  open: false,
  money: 0,
  gender: 'male',
  ownedOutfits: ['default'],
  equippedOutfit: 'default',
};

export const OutfitShopModal = memo(function OutfitShopModal({
  engine,
}: OutfitShopModalProps) {
  const [state, setState] = useState<OutfitShopState>(INITIAL_OUTFIT_SHOP_STATE);
  const [activeTab, setActiveTab] = useState<CharacterGender>('female');

  useEffect(() => {
    if (!engine) {
      setState(INITIAL_OUTFIT_SHOP_STATE);
      return;
    }

    return engine.subscribeStats((stats: HudStats) => {
      setState((prev) => {
        if (!prev.open && stats.outfitShopOpen) {
          setActiveTab(stats.gender);
        }
        if (
          prev.open === stats.outfitShopOpen &&
          prev.money === stats.money &&
          prev.gender === stats.gender &&
          prev.ownedOutfits === stats.ownedOutfits &&
          prev.equippedOutfit === stats.equippedOutfit
        ) {
          return prev;
        }
        return {
          open: stats.outfitShopOpen,
          money: stats.money,
          gender: stats.gender,
          ownedOutfits: stats.ownedOutfits,
          equippedOutfit: stats.equippedOutfit,
        };
      });
    });
  }, [engine]);

  if (!state.open) return null;

  const isViewingFemale = activeTab === 'female';
  const outfitList = isViewingFemale ? FEMALE_OUTFIT_ORDER : MALE_OUTFIT_ORDER;
  const tabMatchesPlayer = state.gender === activeTab;
  const activeOutfit = isOutfitCompatibleWithGender(state.equippedOutfit, state.gender)
    ? state.equippedOutfit
    : 'default';

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-5 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative w-full max-w-4xl max-h-[92dvh] overflow-y-auto touch-pan-y bg-slate-900 border border-rose-400/35 rounded-3xl p-4 sm:p-6 text-white shadow-2xl space-y-4">
        {/* Thanh tiêu đề + số tiền + nút đóng */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-400/40 flex items-center justify-center shrink-0">
              <Shirt className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-rose-200 tracking-wide">
                Cửa hàng trang phục
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Xoay xem mẫu 3D · Đồng bộ màu tay áo &amp; viền khi cầm Katana ·{' '}
                <span className="hidden sm:inline">Nhấn ESC hoặc X để đóng</span>
                <span className="sm:hidden">Chạm nút X để đóng</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-slate-950/85 border border-emerald-400/35 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="font-mono-tech text-xs sm:text-sm font-bold text-amber-300">
                {state.money.toLocaleString('vi-VN')} VNĐ
              </span>
            </div>

            <button
              type="button"
              onClick={() => engine?.closeOutfitShop()}
              aria-label="Đóng cửa hàng trang phục"
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-500/25 border border-white/15 hover:border-rose-400/50 text-slate-200 hover:text-rose-200 flex items-center justify-center transition active:scale-95 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh chuyển mục Trang phục Nữ / Trang phục Nam */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="inline-flex rounded-2xl bg-slate-950/85 border border-white/10 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('female')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeTab === 'female'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              Trang phục Nữ ({FEMALE_OUTFIT_ORDER.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('male')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeTab === 'male'
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              Trang phục Nam ({MALE_OUTFIT_ORDER.length})
            </button>
          </div>

          {activeOutfit !== 'default' && (
            <div className="flex items-center gap-2 text-xs bg-slate-800/60 border border-white/10 px-3 py-1.5 rounded-xl">
              <span className="text-slate-300">
                Đang mặc:{' '}
                <strong className={OUTFITS[activeOutfit].badgeTextColor}>
                  {OUTFITS[activeOutfit].name}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => engine?.equipOutfit('default')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-700/90 hover:bg-slate-600 border border-white/15 text-slate-100 font-semibold transition active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Mặc định
              </button>
            </div>
          )}
        </div>

        {/* Thông báo giới hạn giới tính khi xem tab khác giới tính nhân vật */}
        {!tabMatchesPlayer && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-950/35 px-3.5 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm text-amber-200">
            <Lock className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              Các bộ trang phục ở mục này chỉ dành cho nhân vật{' '}
              <strong>{isViewingFemale ? 'Nữ' : 'Nam'}</strong>. Nhân vật hiện tại của bạn là{' '}
              <strong>{state.gender === 'female' ? 'Nữ' : 'Nam'}</strong>.
            </span>
          </div>
        )}

        {/* Danh sách trang phục theo tab */}
        <div
          className={`grid grid-cols-1 gap-4 ${
            isViewingFemale ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'
          }`}
        >
          {outfitList.map((outfitId) => {
            const info = OUTFITS[outfitId];
            const owned = tabMatchesPlayer && state.ownedOutfits.includes(outfitId);
            const equipped = tabMatchesPlayer && activeOutfit === outfitId;
            const canAfford = state.money >= info.price;
            const lockLabel = isViewingFemale ? 'Chỉ dành cho Nữ' : 'Chỉ dành cho Nam';

            return (
              <div
                key={outfitId}
                className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition ${
                  equipped
                    ? 'border-emerald-400/55 bg-emerald-950/20 shadow-[0_0_24px_rgba(16,185,129,0.12)]'
                    : info.cardAccentClass
                }`}
              >
                {/* Khung xem trước 3D trực tiếp bộ đồ */}
                <div className="relative h-56 sm:h-64 w-full rounded-2xl bg-gradient-to-b from-slate-800/75 to-slate-950/95 border border-white/15 overflow-hidden">
                  <Character3DViewport
                    gender={activeTab}
                    outfit={outfitId}
                    interactiveRotate
                    initialYaw={0.22}
                  />
                  <div
                    className={`absolute top-2.5 left-2.5 pointer-events-none px-2.5 py-1 rounded-lg bg-slate-950/85 border border-white/15 text-[10px] font-bold uppercase tracking-wider ${
                      isViewingFemale ? 'text-rose-300' : 'text-sky-300'
                    }`}
                  >
                    {isViewingFemale ? 'Trang phục Nữ' : 'Trang phục Nam'}
                  </div>
                  {equipped && (
                    <div className="absolute top-2.5 right-2.5 pointer-events-none px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Đang mặc
                    </div>
                  )}
                </div>

                {/* Tên & mô tả bộ đồ */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-sm sm:text-base font-bold ${info.badgeTextColor}`}>
                      {info.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono-tech font-bold text-amber-300 bg-slate-950/80 border border-amber-400/30 px-2 py-0.5 rounded-lg shrink-0">
                      {info.price.toLocaleString('vi-VN')} VNĐ
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                    {info.description}
                  </p>
                </div>

                {/* Chân thẻ: Màu tay áo + Nút hành động */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1 text-[11px] text-slate-300">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/40 inline-block"
                      style={{ backgroundColor: info.sleeveColor }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/40 inline-block"
                      style={{ backgroundColor: info.cuffColor }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/40 inline-block"
                      style={{ backgroundColor: info.accentTrimColor }}
                    />
                    <span className="ml-0.5 text-slate-400">Tay áo</span>
                  </div>

                  {!tabMatchesPlayer ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-white/10 text-slate-400 text-xs font-bold cursor-not-allowed"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      {lockLabel}
                    </button>
                  ) : equipped ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/45 text-emerald-300 text-xs font-bold">
                      <Check className="w-3.5 h-3.5" />
                      Đang mặc
                    </span>
                  ) : owned ? (
                    <button
                      type="button"
                      onClick={() => engine?.equipOutfit(outfitId)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Mặc ngay
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => engine?.buyOutfit(outfitId)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                        canAfford
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
                          : 'bg-slate-700/70 border border-white/10 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Mua ngay
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
