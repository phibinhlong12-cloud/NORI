import { memo, useEffect, useState } from 'react';
import { Check, Hammer, TreePine, X } from 'lucide-react';
import { CRAFTING_RECIPES, CraftingRecipeId } from '../game/crafting';
import { HudStats, VoxelEngine } from '../game/engine';
import { BackpackKatanaVariant } from '../game/trees';
import { LeafKatanaSvg, RedMushroomSvg, SlimeOrbSvg } from './CraftingIcons';

interface CraftingModalProps {
  engine: VoxelEngine | null;
}

interface CraftingViewState {
  open: boolean;
  hasBackpack: boolean;
  equippedKatana: BackpackKatanaVariant | null;
  mushroomCount: number;
  slimeOrbCount: number;
  woodCount: number;
}

const INITIAL_CRAFTING_STATE: CraftingViewState = {
  open: false,
  hasBackpack: false,
  equippedKatana: null,
  mushroomCount: 0,
  slimeOrbCount: 0,
  woodCount: 0,
};

export const CraftingModal = memo(function CraftingModal({ engine }: CraftingModalProps) {
  const [state, setState] = useState<CraftingViewState>(INITIAL_CRAFTING_STATE);
  const [selectedId, setSelectedId] = useState<CraftingRecipeId>('leaf_katana');

  useEffect(() => {
    if (!engine) {
      setState(INITIAL_CRAFTING_STATE);
      return;
    }

    return engine.subscribeStats((stats: HudStats) => {
      setState((prev) => {
        const counts = stats.craftingMaterialCounts;
        if (
          prev.open === stats.craftingOpen &&
          prev.hasBackpack === stats.hasBackpack &&
          prev.equippedKatana === stats.equippedKatana &&
          prev.mushroomCount === counts.mushroomCount &&
          prev.slimeOrbCount === counts.slimeOrbCount &&
          prev.woodCount === counts.woodCount
        ) {
          return prev;
        }
        return {
          open: stats.craftingOpen,
          hasBackpack: stats.hasBackpack,
          equippedKatana: stats.equippedKatana,
          mushroomCount: counts.mushroomCount,
          slimeOrbCount: counts.slimeOrbCount,
          woodCount: counts.woodCount,
        };
      });
    });
  }, [engine]);

  if (!state.open) return null;

  const selectedRecipe =
    CRAFTING_RECIPES.find((r) => r.id === selectedId) ?? CRAFTING_RECIPES[0];

  const hasMushrooms = state.mushroomCount >= selectedRecipe.requirements.mushrooms;
  const hasSlimeOrbs = state.slimeOrbCount >= selectedRecipe.requirements.slimeOrbs;
  const hasWood = state.woodCount >= selectedRecipe.requirements.woods;
  const allMaterialsReady = hasMushrooms && hasSlimeOrbs && hasWood;
  const canCraft = state.hasBackpack && allMaterialsReady;

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-5 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative w-full max-w-3xl max-h-[90dvh] overflow-y-auto bg-slate-900 border border-emerald-400/40 rounded-3xl p-4 sm:p-6 text-white shadow-2xl space-y-4">
        {/* Tiêu đề & nút đóng */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Hammer className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-emerald-200 tracking-wide">
                Khu Chế tạo
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Chọn vật phẩm bên trái để xem công thức ·{' '}
                <span className="hidden sm:inline">Nhấn ESC hoặc nút X để đóng</span>
                <span className="sm:hidden">Chạm nút X để đóng</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => engine?.closeCrafting()}
            aria-label="Đóng khu chế tạo"
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-500/25 border border-white/15 hover:border-rose-400/50 text-slate-200 hover:text-rose-200 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bố cục 2 cột theo mẫu: Trái (Danh sách chế tạo cuộn) · Phải (Xem trước + 3 Điều kiện + Nút Chế tạo) */}
        <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-4">
          {/* Cột trái: Danh sách vật phẩm chế tạo */}
          <div className="rounded-2xl bg-slate-950/75 border border-white/10 p-3 flex flex-col gap-2 max-h-[240px] md:max-h-[390px] overflow-y-auto">
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 px-1">
              Danh sách chế tạo
            </div>
            {CRAFTING_RECIPES.map((recipe, idx) => {
              const isSelected = recipe.id === selectedRecipe.id;
              return (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => setSelectedId(recipe.id)}
                  className={`w-full text-left rounded-xl border p-3 transition active:scale-[0.98] cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-emerald-950/60 border-emerald-400/70 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-900/70 border-white/10 hover:border-emerald-400/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono-tech uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/25">
                      Vũ khí #{idx + 1}
                    </span>
                    {state.equippedKatana === 'leaf' && (
                      <span className="text-[10px] font-bold text-emerald-300">Đang dùng</span>
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-950/70 border border-white/10 px-2 py-2 flex items-center justify-center">
                    <LeafKatanaSvg className="w-full h-9" />
                  </div>

                  <div>
                    <div className="text-sm font-bold text-white">{recipe.name}</div>
                    <div className="text-[11px] text-emerald-300 font-medium">
                      {recipe.damageLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Cột phải: Khung hiển thị vật phẩm + 3 điều kiện + Nút Chế tạo */}
          <div className="flex flex-col justify-between gap-3.5">
            {/* Trên: Hiển thị vật phẩm muốn chế tạo */}
            <div className="rounded-2xl bg-slate-950/70 border border-emerald-400/30 p-4 flex flex-col items-center text-center gap-2.5">
              <div className="w-full max-w-[300px] rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 px-4 py-3 flex items-center justify-center">
                <LeafKatanaSvg className="w-full h-16" />
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-emerald-300">
                  {selectedRecipe.name}
                </h3>
                <div className="text-[11px] font-semibold text-emerald-200 mt-0.5">
                  {selectedRecipe.subtitle}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-300 mt-1.5 leading-relaxed max-w-md">
                  {selectedRecipe.description}
                </p>
                <p className="text-[11px] text-amber-300/90 mt-1.5 font-medium">
                  Khi chế tạo xong, thanh kiếm mặc định đang dùng (nếu có) sẽ tự động chuyển vào Balo.
                </p>
              </div>
            </div>

            {/* Giữa: 3 ô Điều kiện nguyên liệu */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {/* Điều kiện 1: 3 Nấm */}
              <div
                className={`rounded-xl border p-2.5 flex flex-col items-center text-center gap-1.5 ${
                  hasMushrooms
                    ? 'bg-emerald-950/45 border-emerald-400/60'
                    : 'bg-slate-800/75 border-white/10'
                }`}
              >
                <div className="w-full flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">Điều kiện 1</span>
                  {hasMushrooms && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <RedMushroomSvg className="w-9 h-9" />
                <div className="text-[11px] font-bold text-white leading-tight">Nấm đỏ</div>
                <div
                  className={`font-mono-tech text-xs font-bold ${
                    hasMushrooms ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {state.mushroomCount} / {selectedRecipe.requirements.mushrooms}
                </div>
              </div>

              {/* Điều kiện 2: 2 Quả cầu Slime */}
              <div
                className={`rounded-xl border p-2.5 flex flex-col items-center text-center gap-1.5 ${
                  hasSlimeOrbs
                    ? 'bg-emerald-950/45 border-emerald-400/60'
                    : 'bg-slate-800/75 border-white/10'
                }`}
              >
                <div className="w-full flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">Điều kiện 2</span>
                  {hasSlimeOrbs && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <SlimeOrbSvg className="w-9 h-9" />
                <div className="text-[11px] font-bold text-white leading-tight">Quả cầu Slime</div>
                <div
                  className={`font-mono-tech text-xs font-bold ${
                    hasSlimeOrbs ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {state.slimeOrbCount} / {selectedRecipe.requirements.slimeOrbs}
                </div>
              </div>

              {/* Điều kiện 3: 1 Thanh gỗ bất kỳ độ dài */}
              <div
                className={`rounded-xl border p-2.5 flex flex-col items-center text-center gap-1.5 ${
                  hasWood
                    ? 'bg-emerald-950/45 border-emerald-400/60'
                    : 'bg-slate-800/75 border-white/10'
                }`}
              >
                <div className="w-full flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">Điều kiện 3</span>
                  {hasWood && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
                  <TreePine className="w-5 h-5 text-amber-300" />
                </div>
                <div className="text-[11px] font-bold text-white leading-tight">
                  Gỗ bất kỳ
                </div>
                <div
                  className={`font-mono-tech text-xs font-bold ${
                    hasWood ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {state.woodCount} / {selectedRecipe.requirements.woods}
                </div>
              </div>
            </div>

            {/* Dưới: Nút Chế tạo */}
            <button
              type="button"
              onClick={() => engine?.craftItem(selectedRecipe.id)}
              className={`w-full py-3 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer shadow-lg ${
                canCraft
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
                  : 'bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-300'
              }`}
            >
              <Hammer className="w-4 h-4" />
              <span>
                {!state.hasBackpack
                  ? 'Chế tạo (Cần mua Balo trước)'
                  : allMaterialsReady
                    ? 'Chế tạo'
                    : 'Chế tạo (Chưa đủ nguyên liệu)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
