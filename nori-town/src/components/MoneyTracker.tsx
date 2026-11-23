import { memo, useEffect, useRef } from 'react';
import { Banknote } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';

interface MoneyTrackerProps {
  engine: VoxelEngine | null;
}

export const MoneyTracker = memo(function MoneyTracker({ engine }: MoneyTrackerProps) {
  const moneyRef = useRef<HTMLSpanElement | null>(null);
  const deltaRef = useRef<HTMLSpanElement | null>(null);
  const prevMoneyRef = useRef<number>(0);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!engine) return;
    return engine.subscribeStats((stats: HudStats) => {
      if (moneyRef.current) {
        moneyRef.current.textContent = `${stats.money.toLocaleString('vi-VN')} VNĐ`;
      }

      const diff = stats.money - prevMoneyRef.current;
      if (diff > 0 && deltaRef.current) {
        deltaRef.current.textContent = `+${diff.toLocaleString('vi-VN')} VNĐ`;
        deltaRef.current.style.opacity = '1';
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = window.setTimeout(() => {
          if (deltaRef.current) {
            deltaRef.current.style.opacity = '0';
          }
          hideTimerRef.current = null;
        }, 1600);
      }
      prevMoneyRef.current = stats.money;
    });
  }, [engine]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-slate-950/85 border border-emerald-400/25 text-white px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl shadow-lg pointer-events-none flex items-center gap-2 sm:gap-3">
      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
        <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
      </div>
      <div className="leading-tight">
        <div className="hidden sm:block text-[11px] uppercase tracking-wider text-slate-400 font-medium">
          Tiền kiếm được
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span
            ref={moneyRef}
            className="font-mono-tech text-xs sm:text-base font-bold text-amber-300 tabular-nums whitespace-nowrap"
          >
            0 VNĐ
          </span>
          <span
            ref={deltaRef}
            className="font-mono-tech text-[10px] sm:text-xs font-semibold text-emerald-300 transition-opacity duration-300 opacity-0 tabular-nums whitespace-nowrap"
          />
        </div>
      </div>
    </div>
  );
});
