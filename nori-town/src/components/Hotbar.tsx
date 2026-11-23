import { memo } from 'react';
import { BLOCK_COLORS, HOTBAR_BLOCKS } from '../game/constants';

interface HotbarProps {
  selectedSlot: number;
  onSelectSlot: (index: number) => void;
}

export const Hotbar = memo(function Hotbar({
  selectedSlot,
  onSelectSlot,
}: HotbarProps) {
  const currentBlock = HOTBAR_BLOCKS[selectedSlot] ?? HOTBAR_BLOCKS[0];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
      <div className="bg-slate-950/85 border border-white/15 text-white text-xs sm:text-sm font-semibold px-3.5 py-1 rounded-lg shadow-md tracking-wide whitespace-nowrap">
        {currentBlock.key}. {currentBlock.name}
      </div>

      <div className="bg-slate-950/85 border border-white/15 p-2 rounded-2xl flex items-center gap-2 sm:gap-2.5 shadow-2xl">
        {HOTBAR_BLOCKS.map((item, index) => {
          const isActive = index === selectedSlot;
          const swatchColor = BLOCK_COLORS[item.id];

          return (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSlot(index);
              }}
              title={`${item.key}. ${item.name}`}
              className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 transition-transform duration-150 flex items-center justify-center cursor-pointer overflow-hidden ${
                isActive
                  ? '-translate-y-1 scale-105 border-white bg-white/25 shadow-lg'
                  : 'border-white/20 bg-slate-900/80 hover:border-white/50'
              }`}
            >
              <span className="absolute top-0.5 left-1.5 text-[10px] font-mono-tech font-bold text-white drop-shadow">
                {item.key}
              </span>
              <span
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-sm shadow border border-black/20"
                style={{ backgroundColor: swatchColor }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
});
