import { memo, useEffect, useState } from 'react';
import { Backpack, FlaskConical, Shield, Sword, TreePine, X } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';
import { BACKPACK_CAPACITY, BackpackItem, MAX_POTION_STACK } from '../game/trees';

interface BackpackHudProps {
  engine: VoxelEngine | null;
  touchMode?: boolean;
}

interface BackpackViewState {
  hasBackpack: boolean;
  hasKatana: boolean;
  hasIceKatana: boolean;
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
  hasIceKatana: false,
  hasShield: false,
  backpackOpen: false,
  holdingKatana: false,
  holdingPotionSlot: null,
  holdingPotionCount: 0,
  shieldRaised: false,
  items: Array.from({ length: BACKPACK_CAPACITY }, () => null),
};

export const BackpackHud = memo(function BackpackHud({
  engine,
  touchMode = false,
}: BackpackHudProps) {
  const [state, setState] = useState<BackpackViewState>(INITIAL_STATE);

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
          prev.hasIceKatana === stats.hasIceKatana &&
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
          hasIceKatana: stats.hasIceKatana,
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

  if (!state.hasBackpack && !state.hasKatana && !state.hasShield) {
    return null;
  }

  const count = state.items.reduce((acc, item) => (item ? acc + 1 : acc), 0);
  const isFull = count >= BACKPACK_CAPACITY;
  const firstWoodIndex = state.items.findIndex((item) => item?.kind === 'wood');

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
              <Backpack className="w-4 h-4" />
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
              <FlaskConical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-medium text-rose-200">
                Thuốc máu (Ô {state.holdingPotionSlot + 1})
              </div>
              <div className="text-[11px] sm:text-xs font-semibold text-rose-300">
                {touchMode
                  ? `Cầm x${state.holdingPotionCount} · Bấm Uống (+2 tim)`
                  : `Đang cầm (x${state.holdingPotionCount}) · Chuột phải uống (+2 tim)`}
              </div>
            </div>
          </div>
        )}

        {!touchMode && state.hasKatana && (
          <div
            className={`px-3.5 py-2 rounded-xl shadow-lg border flex items-center gap-3 transition-colors ${
              state.hasIceKatana
                ? state.holdingKatana
                  ? 'bg-sky-950/95 border-cyan-300 text-white'
                  : 'bg-slate-950/90 border-cyan-400/40 text-cyan-100'
                : state.holdingKatana
                  ? 'bg-slate-900/95 border-sky-400/60 text-white'
                  : 'bg-slate-950/85 border-white/15 text-slate-200'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                state.hasIceKatana
                  ? 'bg-cyan-400/25 border-cyan-300/60 text-cyan-200'
                  : state.holdingKatana
                    ? 'bg-sky-500/25 border-sky-400/50 text-sky-300'
                    : 'bg-slate-800 border-white/15 text-slate-400'
              }`}
            >
              <Sword className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <div
                className={`text-[11px] uppercase tracking-wider font-medium ${
                  state.hasIceKatana ? 'text-cyan-300' : 'text-slate-400'
                }`}
              >
                {state.hasIceKatana ? 'Katana Băng (Q)' : 'Katana (Q)'}
              </div>
              <div
                className={`text-xs font-semibold ${
                  state.hasIceKatana
                    ? state.holdingKatana
                      ? 'text-cyan-200'
                      : 'text-cyan-300/80'
                    : state.holdingKatana
                      ? 'text-sky-300'
                      : 'text-slate-300'
                }`}
              >
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
              <Shield className="w-4 h-4" />
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
          className={`fixed left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-[min(94vw,640px)] ${
            touchMode ? 'bottom-[238px] sm:bottom-24' : 'bottom-24'
          }`}
        >
          <div
            className={`rounded-2xl border p-3 sm:p-4 shadow-2xl max-h-[54dvh] overflow-y-auto ${
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
                    ? 'Chạm ô 1–9 để chọn/cầm'
                    : isFull
                      ? 'BALO ĐẦY · Phím 1–9 chọn ô'
                      : 'Phím 1–9: Cầm/Lấy ô · F: Lấy gỗ nhanh'}
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

            <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 sm:gap-2">
              {Array.from({ length: BACKPACK_CAPACITY }, (_, index) => {
                const item = state.items[index];
                const isNextQuickWood = index === firstWoodIndex && item?.kind === 'wood';
                const isHeldPotion =
                  item?.kind === 'potion' && state.holdingPotionSlot === index;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => engine?.retrieveBackpackSlot(index)}
                    className={`relative h-14 sm:h-[70px] rounded-xl border flex flex-col items-center justify-center px-1 text-center transition active:scale-95 cursor-pointer ${
                      item?.kind === 'potion'
                        ? isHeldPotion
                          ? 'bg-rose-950/95 border-rose-400 text-rose-100 ring-1 ring-rose-400/50'
                          : 'bg-rose-950/70 border-rose-500/45 text-rose-100 hover:border-rose-400'
                        : item
                          ? isNextQuickWood
                            ? 'bg-amber-950/85 border-emerald-400/80 text-amber-100 hover:border-emerald-300'
                            : 'bg-amber-950/60 border-amber-500/40 text-amber-100 hover:border-amber-400'
                          : 'bg-slate-900/75 border-white/10 text-slate-500'
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
                          <FlaskConical className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 mt-3 shrink-0" />
                          <span className="text-[10px] font-bold text-white leading-tight mt-0.5">
                            Thuốc máu
                          </span>
                          <span className="font-mono-tech text-[9px] text-rose-300 leading-none">
                            x{item.count}/{MAX_POTION_STACK}
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
          </div>
        </div>
      )}
    </>
  );
});
