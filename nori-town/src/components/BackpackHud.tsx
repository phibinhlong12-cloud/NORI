import { memo, useEffect, useState } from 'react';
import { Backpack, Trash2, TreePine, X } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';
import { getKatanaDisplayName } from '../game/katana';
import {
  BACKPACK_CAPACITY,
  BackpackItem,
  BackpackKatanaVariant,
  MAX_MATERIAL_STACK,
  MAX_POTION_STACK,
} from '../game/trees';
import {
  BackpackItemSvg,
  KatanaVariantSvg,
  PotionItemSvg,
  RedMushroomSvg,
  ShieldItemSvg,
  SlimeOrbSvg,
} from './CraftingIcons';

interface BackpackHudProps {
  engine: VoxelEngine | null;
  touchMode?: boolean;
}

interface BackpackViewState {
  hasBackpack: boolean;
  hasKatana: boolean;
  equippedKatana: BackpackKatanaVariant | null;
  hasShield: boolean;
  backpackOpen: boolean;
  holdingKatana: boolean;
  holdingPotionSlot: number | null;
  holdingPotionCount: number;
  shieldRaised: boolean;
  items: Array<BackpackItem | null>;
}

const INITIAL_STATE: BackpackViewState = {
  hasBackpack: false,
  hasKatana: false,
  equippedKatana: null,
  hasShield: false,
  backpackOpen: false,
  holdingKatana: false,
  holdingPotionSlot: null,
  holdingPotionCount: 0,
  shieldRaised: false,
  items: Array.from({ length: BACKPACK_CAPACITY }, () => null),
};

function getItemSummary(item: BackpackItem): {
  title: string;
  subtitle: string;
  useLabel: string;
  canUseDirectly: boolean;
} {
  switch (item.kind) {
    case 'wood':
      return {
        title: `Thanh gỗ (${item.length.toFixed(1)}m)`,
        subtitle: `Giá trị: ${item.valueVnd.toLocaleString('vi-VN')} VNĐ · Dùng để bán hoặc chế tạo`,
        useLabel: 'Sử dụng (Lấy ra cầm)',
        canUseDirectly: true,
      };
    case 'potion':
      return {
        title: `Thuốc hồi máu (x${item.count})`,
        subtitle: 'Cầm lên tay và bấm chuột phải / Uống để hồi +2 tim',
        useLabel: 'Sử dụng',
        canUseDirectly: true,
      };
    case 'slime_orb':
      return {
        title: `Quả cầu Slime (x${item.count})`,
        subtitle: 'Nguyên liệu rèn Kiếm Lá tại khu Chế tạo (cần 2 quả)',
        useLabel: 'Sử dụng',
        canUseDirectly: false,
      };
    case 'mushroom_item':
      return {
        title: `Nấm đỏ (x${item.count})`,
        subtitle: 'Nguyên liệu rèn Kiếm Lá tại khu Chế tạo (cần 3 nấm)',
        useLabel: 'Sử dụng',
        canUseDirectly: false,
      };
    case 'katana':
      return {
        title: getKatanaDisplayName(item.variant),
        subtitle:
          item.variant === 'leaf'
            ? 'Kiếm Lá đặc biệt (120 sát thương · +20% tốc chạy)'
            : item.variant === 'ice'
              ? 'Katana Băng (200 sát thương · Sức mạnh sẽ cập nhật sau)'
              : 'Kiếm Katana tiêu chuẩn (100 sát thương)',
        useLabel: 'Sử dụng (Trang bị kiếm)',
        canUseDirectly: true,
      };
  }
}

export const BackpackHud = memo(function BackpackHud({
  engine,
  touchMode = false,
}: BackpackHudProps) {
  const [state, setState] = useState<BackpackViewState>(INITIAL_STATE);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  useEffect(() => {
    if (!engine) {
      setState(INITIAL_STATE);
      return;
    }

    return engine.subscribeStats((stats: HudStats) => {
      setState((prev) => {
        if (
          prev.hasBackpack === stats.hasBackpack &&
          prev.hasKatana === stats.hasKatana &&
          prev.equippedKatana === stats.equippedKatana &&
          prev.hasShield === stats.hasShield &&
          prev.backpackOpen === stats.backpackOpen &&
          prev.holdingKatana === stats.holdingKatana &&
          prev.holdingPotionSlot === stats.holdingPotionSlot &&
          prev.holdingPotionCount === stats.holdingPotionCount &&
          prev.shieldRaised === stats.shieldRaised &&
          prev.items === stats.backpackItems
        ) {
          return prev;
        }
        return {
          hasBackpack: stats.hasBackpack,
          hasKatana: stats.hasKatana,
          equippedKatana: stats.equippedKatana,
          hasShield: stats.hasShield,
          backpackOpen: stats.backpackOpen,
          holdingKatana: stats.holdingKatana,
          holdingPotionSlot: stats.holdingPotionSlot,
          holdingPotionCount: stats.holdingPotionCount,
          shieldRaised: stats.shieldRaised,
          items: stats.backpackItems,
        };
      });
    });
  }, [engine]);

  useEffect(() => {
    if (!state.backpackOpen) {
      setSelectedSlot(null);
      return;
    }
    if (selectedSlot !== null && !state.items[selectedSlot]) {
      setSelectedSlot(null);
    }
  }, [state.backpackOpen, state.items, selectedSlot]);

  if (!state.hasBackpack && !state.hasKatana && !state.hasShield) {
    return null;
  }

  const count = state.items.reduce((acc, item) => (item ? acc + 1 : acc), 0);
  const isFull = count >= BACKPACK_CAPACITY;
  const firstWoodIndex = state.items.findIndex((item) => item?.kind === 'wood');
  const activeKatana = state.equippedKatana;
  const selectedItem = selectedSlot !== null ? state.items[selectedSlot] : null;
  const selectedInfo = selectedItem ? getItemSummary(selectedItem) : null;

  const katanaCardClasses =
    activeKatana === 'leaf'
      ? state.holdingKatana
        ? 'bg-emerald-950/95 border-emerald-400 text-white'
        : 'bg-slate-950/90 border-emerald-400/45 text-emerald-100'
      : activeKatana === 'ice'
        ? state.holdingKatana
          ? 'bg-sky-950/95 border-cyan-300 text-white'
          : 'bg-slate-950/90 border-cyan-400/40 text-cyan-100'
        : state.holdingKatana
          ? 'bg-slate-900/95 border-sky-400/60 text-white'
          : 'bg-slate-950/85 border-white/15 text-slate-200';

  const katanaBadgeClasses =
    activeKatana === 'leaf'
      ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
      : activeKatana === 'ice'
        ? 'bg-cyan-400/25 border-cyan-300/60 text-cyan-200'
        : state.holdingKatana
          ? 'bg-sky-500/25 border-sky-400/50 text-sky-300'
          : 'bg-slate-800 border-white/15 text-slate-400';

  const katanaTitle = activeKatana
    ? `${getKatanaDisplayName(activeKatana)} (Q)`
    : 'Katana (Q)';

  const katanaTitleTextClass =
    activeKatana === 'leaf'
      ? 'text-emerald-300'
      : activeKatana === 'ice'
        ? 'text-cyan-300'
        : 'text-slate-400';

  const katanaStatusTextClass =
    activeKatana === 'leaf'
      ? state.holdingKatana
        ? 'text-emerald-200'
        : 'text-emerald-300/80'
      : activeKatana === 'ice'
        ? state.holdingKatana
          ? 'text-cyan-200'
          : 'text-cyan-300/80'
        : state.holdingKatana
          ? 'text-sky-300'
          : 'text-slate-300';

  return (
    <>
      <div className="flex flex-col items-start gap-1.5 sm:gap-2 pointer-events-none">
        {!touchMode && state.hasBackpack && (
          <div
            className={`px-3.5 py-2 rounded-xl shadow-lg border flex items-center gap-3 transition-colors ${
              isFull
                ? 'bg-rose-950/95 border-rose-500 text-rose-100'
                : 'bg-slate-950/85 border-amber-400/25 text-white'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                isFull
                  ? 'bg-rose-500/30 border-rose-400 text-rose-200'
                  : 'bg-amber-500/20 border-amber-400/35 text-amber-300'
              }`}
            >
              <BackpackItemSvg className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-medium text-slate-300">
                  Balo (E)
                </span>
                {isFull && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white tracking-wide">
                    ĐẦY
                  </span>
                )}
              </div>
              <div
                className={`font-mono-tech text-sm font-bold tabular-nums ${
                  isFull ? 'text-rose-300' : 'text-amber-300'
                }`}
              >
                {count} / {BACKPACK_CAPACITY} ô
              </div>
            </div>
          </div>
        )}

        {state.holdingPotionSlot !== null && state.holdingPotionCount > 0 && (
          <div className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl shadow-lg border bg-rose-950/90 border-rose-400/70 text-white flex items-center gap-2 sm:gap-3 transition-colors">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg border bg-rose-500/25 border-rose-400/60 text-rose-300 flex items-center justify-center shrink-0">
              <PotionItemSvg className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-medium text-rose-200">
                Thuốc máu (Ô {state.holdingPotionSlot + 1})
              </div>
              <div className="text-[11px] sm:text-xs font-semibold text-rose-300">
                {touchMode
                  ? `Cầm x${state.holdingPotionCount} · Bấm Hồi máu (+2 tim)`
                  : `Đang cầm (x${state.holdingPotionCount}) · Chuột phải uống (+2 tim)`}
              </div>
            </div>
          </div>
        )}

        {!touchMode && state.hasKatana && (
          <div
            className={`px-3.5 py-2 rounded-xl shadow-lg border flex items-center gap-3 transition-colors ${katanaCardClasses}`}
          >
            <div
              className={`w-11 h-8 rounded-lg border flex items-center justify-center shrink-0 px-1 ${katanaBadgeClasses}`}
            >
              <KatanaVariantSvg
                variant={activeKatana ?? 'normal'}
                className="w-full h-4"
              />
            </div>
            <div className="leading-tight">
              <div
                className={`text-[11px] uppercase tracking-wider font-medium ${katanaTitleTextClass}`}
              >
                {katanaTitle}
              </div>
              <div className={`text-xs font-semibold ${katanaStatusTextClass}`}>
                {state.holdingKatana ? 'Đang cầm · Chuột trái chém' : 'Đang cất'}
              </div>
            </div>
          </div>
        )}

        {!touchMode && state.hasShield && (
          <div
            className={`px-3.5 py-2 rounded-xl shadow-lg border flex items-center gap-3 transition-colors ${
              state.shieldRaised
                ? 'bg-slate-900/95 border-amber-400/60 text-white'
                : 'bg-slate-950/85 border-white/15 text-slate-200'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                state.shieldRaised
                  ? 'bg-amber-500/25 border-amber-400/50 text-amber-300'
                  : 'bg-slate-800 border-white/15 text-slate-400'
              }`}
            >
              <ShieldItemSvg className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wider font-medium text-slate-400">
                Khiên chắn (R)
              </div>
              <div
                className={`text-xs font-semibold ${
                  state.shieldRaised ? 'text-amber-300' : 'text-slate-300'
                }`}
              >
                {state.shieldRaised ? 'Đang che trước mặt' : 'Đang chắn sau lưng'}
              </div>
            </div>
          </div>
        )}
      </div>

      {state.hasBackpack && state.backpackOpen && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[min(94vw,600px)] ${
            touchMode ? 'bottom-[230px] sm:bottom-24' : 'bottom-20'
          }`}
        >
          <div
            className={`rounded-2xl border p-3 sm:p-4 shadow-2xl max-h-[62dvh] overflow-y-auto ${
              isFull
                ? 'bg-rose-950/95 border-rose-500/80 text-white'
                : 'bg-slate-950/95 border-white/15 text-white'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Backpack className={`w-4 h-4 ${isFull ? 'text-rose-300' : 'text-amber-300'}`} />
                <span className="text-xs sm:text-sm font-bold tracking-wide">
                  Balo ({count}/{BACKPACK_CAPACITY})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] sm:text-[11px] font-mono-tech font-semibold px-2 py-0.5 rounded ${
                    isFull
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-slate-300 border border-white/10'
                  }`}
                >
                  {touchMode
                    ? 'Chạm ô chọn · Dùng / Xóa'
                    : isFull
                      ? 'BALO ĐẦY · Chọn ô xử lý'
                      : 'Chọn ô để Sử dụng / Xóa · E đóng'}
                </span>
                <button
                  type="button"
                  onClick={() => engine?.toggleBackpack()}
                  aria-label="Đóng Balo"
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 border border-white/15 flex items-center justify-center text-slate-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
              {Array.from({ length: BACKPACK_CAPACITY }, (_, index) => {
                const item = state.items[index];
                const isNextQuickWood = index === firstWoodIndex && item?.kind === 'wood';
                const isHeldPotion =
                  item?.kind === 'potion' && state.holdingPotionSlot === index;
                const isSelected = selectedSlot === index;

                let slotStyle = 'bg-slate-900/75 border-white/10 text-slate-500';
                if (item?.kind === 'potion') {
                  slotStyle = isHeldPotion
                    ? 'bg-rose-950/95 border-rose-400 text-rose-100'
                    : 'bg-rose-950/70 border-rose-500/45 text-rose-100 hover:border-rose-400';
                } else if (item?.kind === 'slime_orb') {
                  slotStyle =
                    'bg-emerald-950/70 border-emerald-400/50 text-emerald-100 hover:border-emerald-300';
                } else if (item?.kind === 'mushroom_item') {
                  slotStyle =
                    'bg-orange-950/70 border-red-400/50 text-red-100 hover:border-red-300';
                } else if (item?.kind === 'katana') {
                  slotStyle =
                    item.variant === 'leaf'
                      ? 'bg-emerald-950/85 border-emerald-400/75 text-emerald-100 hover:border-emerald-300'
                      : item.variant === 'ice'
                        ? 'bg-cyan-950/85 border-cyan-400/75 text-cyan-100 hover:border-cyan-300'
                        : 'bg-sky-950/80 border-sky-400/60 text-sky-100 hover:border-sky-300';
                } else if (item?.kind === 'wood') {
                  slotStyle = isNextQuickWood
                    ? 'bg-amber-950/85 border-emerald-400/80 text-amber-100 hover:border-emerald-300'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-100 hover:border-amber-400';
                }

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      if (!item) {
                        setSelectedSlot(null);
                        return;
                      }
                      setSelectedSlot((prev) => (prev === index ? null : index));
                    }}
                    className={`relative h-[62px] sm:h-[68px] rounded-xl border flex flex-col items-center justify-center px-1 text-center transition active:scale-95 cursor-pointer ${slotStyle} ${
                      isSelected ? 'ring-2 ring-amber-300 border-amber-300' : ''
                    }`}
                  >
                    <span className="absolute top-1 left-1.5 text-[10px] font-mono-tech font-bold px-1 rounded bg-slate-800/90 text-amber-300 border border-white/10 leading-tight">
                      {index + 1}
                    </span>

                    {isNextQuickWood && (
                      <span className="absolute top-1 right-1 text-[9px] font-bold px-1 rounded bg-emerald-500 text-slate-950 leading-tight">
                        F
                      </span>
                    )}

                    {isHeldPotion && (
                      <span className="absolute top-1 right-1 text-[9px] font-bold px-1 rounded bg-rose-400 text-slate-950 leading-tight">
                        CẦM
                      </span>
                    )}

                    {item ? (
                      item.kind === 'potion' ? (
                        <>
                          <PotionItemSvg className="w-5 h-5 mt-3 shrink-0" />
                          <span className="text-[10px] font-bold text-white leading-tight mt-0.5">
                            Thuốc máu
                          </span>
                          <span className="font-mono-tech text-[9px] text-rose-300 leading-none">
                            x{item.count}/{MAX_POTION_STACK}
                          </span>
                        </>
                      ) : item.kind === 'slime_orb' ? (
                        <>
                          <SlimeOrbSvg className="w-5 h-5 mt-3 shrink-0" />
                          <span className="text-[10px] font-bold text-white leading-tight mt-0.5 truncate max-w-full">
                            Cầu Slime
                          </span>
                          <span className="font-mono-tech text-[9px] text-emerald-300 leading-none">
                            x{item.count}/{MAX_MATERIAL_STACK}
                          </span>
                        </>
                      ) : item.kind === 'mushroom_item' ? (
                        <>
                          <RedMushroomSvg className="w-5 h-5 mt-3 shrink-0" />
                          <span className="text-[10px] font-bold text-white leading-tight mt-0.5 truncate max-w-full">
                            Nấm đỏ
                          </span>
                          <span className="font-mono-tech text-[9px] text-amber-200 leading-none">
                            x{item.count}/{MAX_MATERIAL_STACK}
                          </span>
                        </>
                      ) : item.kind === 'katana' ? (
                        <>
                          <KatanaVariantSvg
                            variant={item.variant}
                            className="w-14 h-4 mt-3 shrink-0"
                          />
                          <span className="text-[10px] font-bold text-white leading-tight mt-0.5 truncate max-w-full">
                            {getKatanaDisplayName(item.variant)}
                          </span>
                          <span className="text-[9px] text-slate-300 leading-none">
                            Đổi kiếm
                          </span>
                        </>
                      ) : (
                        <>
                          <TreePine className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 mt-3 shrink-0" />
                          <span className="font-mono-tech text-[10px] font-bold text-white leading-tight mt-0.5">
                            {item.length.toFixed(1)}m
                          </span>
                          <span className="font-mono-tech text-[9px] text-emerald-300 leading-none">
                            {item.valueVnd.toLocaleString('vi-VN')}đ
                          </span>
                        </>
                      )
                    ) : (
                      <span className="text-[10px] text-slate-600 mt-2">Trống</span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedSlot !== null && selectedItem && selectedInfo && (
              <div className="mt-3 rounded-xl bg-slate-900/95 border border-amber-400/35 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                    Ô {selectedSlot + 1}: {selectedInfo.title}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    {selectedInfo.subtitle}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => engine?.useBackpackSlot(selectedSlot)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                      selectedInfo.canUseDirectly
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-white/15'
                    }`}
                  >
                    {selectedInfo.useLabel}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      engine?.deleteBackpackSlot(selectedSlot);
                      setSelectedSlot(null);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa bỏ vĩnh viễn</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});
