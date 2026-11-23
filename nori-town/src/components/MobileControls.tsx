import { memo } from 'react';

interface MobileControlsProps {
  onVirtualKey: (code: string, pressed: boolean) => void;
  onBreak: () => void;
  onPlace: () => void;
}

export const MobileControls = memo(function MobileControls({
  onVirtualKey,
  onBreak,
  onPlace,
}: MobileControlsProps) {
  const bindKeyProps = (code: string) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      onVirtualKey(code, true);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      onVirtualKey(code, false);
    },
    onTouchCancel: () => onVirtualKey(code, false),
  });

  return (
    <div className="md:hidden fixed inset-x-0 bottom-6 z-20 px-4 flex justify-between items-end pointer-events-none">
      <div className="grid grid-cols-3 gap-1.5 pointer-events-auto">
        <div />
        <button
          type="button"
          {...bindKeyProps('KeyW')}
          className="w-12 h-12 bg-slate-950/80 border border-white/15 rounded-xl text-white font-bold flex items-center justify-center active:bg-white/30"
          aria-label="Tiến lên"
        >
          ▲
        </button>
        <div />
        <button
          type="button"
          {...bindKeyProps('KeyA')}
          className="w-12 h-12 bg-slate-950/80 border border-white/15 rounded-xl text-white font-bold flex items-center justify-center active:bg-white/30"
          aria-label="Sang trái"
        >
          ◀
        </button>
        <button
          type="button"
          {...bindKeyProps('KeyS')}
          className="w-12 h-12 bg-slate-950/80 border border-white/15 rounded-xl text-white font-bold flex items-center justify-center active:bg-white/30"
          aria-label="Lùi lại"
        >
          ▼
        </button>
        <button
          type="button"
          {...bindKeyProps('KeyD')}
          className="w-12 h-12 bg-slate-950/80 border border-white/15 rounded-xl text-white font-bold flex items-center justify-center active:bg-white/30"
          aria-label="Sang phải"
        >
          ▶
        </button>
      </div>

      <div className="flex flex-col gap-2 items-end pointer-events-auto">
        <div className="flex gap-2">
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              onBreak();
            }}
            className="min-h-11 px-4 py-2.5 bg-slate-950/80 border border-white/15 rounded-xl text-rose-300 font-semibold text-xs active:bg-rose-500/30"
          >
            Chặt
          </button>
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              onPlace();
            }}
            className="min-h-11 px-4 py-2.5 bg-slate-950/80 border border-white/15 rounded-xl text-emerald-300 font-semibold text-xs active:bg-emerald-500/30"
          >
            Khiêng / Đặt
          </button>
        </div>
        <button
          type="button"
          {...bindKeyProps('Space')}
          className="w-24 h-12 bg-slate-950/80 border border-white/15 rounded-xl text-amber-300 font-bold text-sm flex items-center justify-center active:bg-white/30"
        >
          NHẢY
        </button>
      </div>
    </div>
  );
});
