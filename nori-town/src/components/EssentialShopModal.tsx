import { memo, useEffect, useState } from 'react';
import {
  Backpack,
  Check,
  Coins,
  FlaskConical,
  Shield,
  ShoppingBag,
  Sword,
  X,
} from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';
import { BackpackKatanaVariant, MAX_POTION_STACK } from '../game/trees';
import {
  SHOP_ITEM_DESCRIPTIONS,
  SHOP_ITEM_NAMES,
  SHOP_ITEM_ORDER,
  SHOP_ITEM_PRICES,
  ShopItemId,
} from '../game/weaponShop';

interface EssentialShopModalProps {
  engine: VoxelEngine | null;
}

interface ShopModalState {
  open: boolean;
  money: number;
  hasBackpack: boolean;
  ownsBaseKatana: boolean;
  equippedKatana: BackpackKatanaVariant | null;
  hasShield: boolean;
  potionCount: number;
}

const INITIAL_SHOP_STATE: ShopModalState = {
  open: false,
  money: 0,
  hasBackpack: false,
  ownsBaseKatana: false,
  equippedKatana: null,
  hasShield: false,
  potionCount: 0,
};

function renderItemIcon(itemId: ShopItemId, equippedKatana: BackpackKatanaVariant | null) {
  switch (itemId) {
    case 'backpack':
      return <Backpack className="w-6 h-6 text-amber-300" />;
    case 'katana':
      return (
        <Sword
          className={`w-6 h-6 ${
            equippedKatana === 'leaf'
              ? 'text-emerald-300'
              : equippedKatana === 'ice'
                ? 'text-cyan-300'
                : 'text-sky-300'
          }`}
        />
      );
    case 'shield':
      return <Shield className="w-6 h-6 text-yellow-300" />;
    case 'potion':
      return <FlaskConical className="w-6 h-6 text-rose-400" />;
  }
}

export const EssentialShopModal = memo(function EssentialShopModal({
  engine,
}: EssentialShopModalProps) {
  const [state, setState] = useState<ShopModalState>(INITIAL_SHOP_STATE);

  useEffect(() => {
    if (!engine) {
      setState(INITIAL_SHOP_STATE);
      return;
    }

    return engine.subscribeStats((stats: HudStats) => {
      const potionCount = stats.backpackItems.reduce(
        (sum, item) => (item?.kind === 'potion' ? sum + item.count : sum),
        0,
      );

      setState((prev) => {
        if (
          prev.open === stats.shopOpen &&
          prev.money === stats.money &&
          prev.hasBackpack === stats.hasBackpack &&
          prev.ownsBaseKatana === stats.ownsBaseKatana &&
          prev.equippedKatana === stats.equippedKatana &&
          prev.hasShield === stats.hasShield &&
          prev.potionCount === potionCount
        ) {
          return prev;
        }
        return {
          open: stats.shopOpen,
          money: stats.money,
          hasBackpack: stats.hasBackpack,
          ownsBaseKatana: stats.ownsBaseKatana,
          equippedKatana: stats.equippedKatana,
          hasShield: stats.hasShield,
          potionCount,
        };
      });
    });
  }, [engine]);

  if (!state.open) return null;

  const isOwned = (itemId: ShopItemId): boolean => {
    if (itemId === 'backpack') return state.hasBackpack;
    if (itemId === 'katana') return state.ownsBaseKatana;
    if (itemId === 'shield') return state.hasShield;
    return false;
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/75 flex items-center justify-center p-3 sm:p-5 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-slate-900 border border-amber-400/35 rounded-3xl p-4 sm:p-6 text-white shadow-2xl space-y-4">
        {/* Thanh tiêu đề + nút thoát X trên góc phải */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-amber-200 tracking-wide">
                Cửa hàng thiết yếu
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Chọn vật phẩm để mua ·{' '}
                <span className="hidden sm:inline">Nhấn ESC hoặc nút X để thoát</span>
                <span className="sm:hidden">Chạm nút X góc phải để thoát</span>
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
              onClick={() => engine?.closeShop()}
              aria-label="Đóng cửa hàng"
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-500/25 border border-white/15 hover:border-rose-400/50 text-slate-200 hover:text-rose-200 flex items-center justify-center transition active:scale-95 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Danh sách 4 vật phẩm thiết yếu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SHOP_ITEM_ORDER.map((itemId) => {
            const owned = isOwned(itemId);
            const price = SHOP_ITEM_PRICES[itemId];
            const canAfford = state.money >= price;
            const needsBackpackForPotion = itemId === 'potion' && !state.hasBackpack;
            const title = SHOP_ITEM_NAMES[itemId];

            return (
              <div
                key={itemId}
                className={`rounded-2xl border p-3.5 sm:p-4 flex flex-col justify-between gap-3 transition ${
                  owned
                    ? 'bg-emerald-950/25 border-emerald-400/35'
                    : 'bg-slate-800/75 border-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-center shrink-0">
                    {renderItemIcon(itemId, state.equippedKatana)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-white truncate">
                        {title}
                      </h3>
                      {itemId === 'potion' && state.potionCount > 0 && (
                        <span className="font-mono-tech text-[11px] font-bold text-rose-300 bg-rose-500/15 border border-rose-400/30 px-2 py-0.5 rounded-lg shrink-0">
                          Có: {state.potionCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed">
                      {SHOP_ITEM_DESCRIPTIONS[itemId]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="font-mono-tech text-xs sm:text-sm font-bold text-amber-300">
                    {price.toLocaleString('vi-VN')} VNĐ
                    {itemId === 'potion' && (
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        (tối đa {MAX_POTION_STACK}/ô)
                      </span>
                    )}
                  </div>

                  {owned ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                      <Check className="w-3.5 h-3.5" />
                      Đã sở hữu
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => engine?.buyShopItem(itemId)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                        needsBackpackForPotion
                          ? 'bg-slate-700/80 border border-amber-400/30 text-amber-200 hover:bg-slate-700'
                          : canAfford
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
                            : 'bg-slate-700/70 border border-white/10 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {itemId === 'potion' ? 'Mua 1 lọ' : 'Mua ngay'}
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
