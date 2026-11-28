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
    <div className="bg-slate-950/85 border border-emerald-400/25 text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg shadow-md pointer-events-none flex items-center gap-1.5">
      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
        <Banknote className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-300" />
      </div>
      <div className="leading-tight">
        <div className="hidden sm:block text-[8px] uppercase tracking-wider text-slate-400 font-medium leading-none">
          Tiền kiếm được
        </div>
        <div className="flex items-baseline gap-1">
          <span
            ref={moneyRef}
            className="font-mono-tech text-[10px] sm:text-[11px] font-bold text-amber-300 tabular-nums whitespace-nowrap leading-tight"
          >
            0 VNĐ
          </span>
          <span
            ref={deltaRef}
            className="font-mono-tech text-[9px] font-semibold text-emerald-300 transition-opacity duration-300 opacity-0 tabular-nums whitespace-nowrap leading-tight"
          />
        </div>
      </div>
    </div>
  );
});
