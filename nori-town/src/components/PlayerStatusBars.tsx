import { memo, useEffect, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';
import { getXpForNextLevel, MAX_LEVEL, MAX_PLAYER_HP } from '../game/slimeZones';

interface PlayerStatusBarsProps {
  engine: VoxelEngine | null;
}

interface StatusState {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
}

const INITIAL_STATUS: StatusState = {
  hp: MAX_PLAYER_HP,
  maxHp: MAX_PLAYER_HP,
  level: 1,
  xp: 0,
  xpToNext: getXpForNextLevel(1),
};

export const PlayerStatusBars = memo(function PlayerStatusBars({ engine }: PlayerStatusBarsProps) {
  const [status, setStatus] = useState<StatusState>(INITIAL_STATUS);

  useEffect(() => {
    if (!engine) {
      setStatus(INITIAL_STATUS);
      return;
    }

    return engine.subscribeStats((stats: HudStats) => {
      setStatus((prev) => {
        if (
          prev.hp === stats.hp &&
          prev.maxHp === stats.maxHp &&
          prev.level === stats.level &&
          prev.xp === stats.xp &&
          prev.xpToNext === stats.xpToNext
        ) {
          return prev;
        }
        return {
          hp: stats.hp,
          maxHp: stats.maxHp,
          level: stats.level,
          xp: stats.xp,
          xpToNext: stats.xpToNext,
        };
      });
    });
  }, [engine]);

  const isMaxLevel = status.level >= MAX_LEVEL;
  const xpPercent = isMaxLevel
    ? 100
    : status.xpToNext > 0
      ? Math.min(100, (status.xp / status.xpToNext) * 100)
      : 0;

  const hpDisplay = Number.isInteger(status.hp)
    ? String(status.hp)
    : status.hp.toFixed(1).replace('.', ',');

  return (
    <div className="fixed bottom-44 md:bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-[min(92vw,420px)]">
      <div className="bg-slate-950/90 border border-white/15 rounded-2xl px-3.5 py-2.5 shadow-xl space-y-2">
        {/* Thanh trên: Thanh kinh nghiệm + Level */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono-tech">
            <span className="flex items-center gap-1.5 font-bold text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Level {status.level}</span>
              {isMaxLevel && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-bold">
                  MAX
                </span>
              )}
            </span>
            <span className="text-slate-300 tabular-nums">
              {isMaxLevel
                ? 'Cấp tối đa (30)'
                : `${status.xp.toLocaleString('vi-VN')} / ${status.xpToNext.toLocaleString('vi-VN')} XP`}
            </span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-slate-800 border border-white/10 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-[width] duration-200"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        {/* Thanh dưới: Thanh máu (10 trái tim, hỗ trợ nửa tim 0,5) */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div
            className="flex items-center gap-1 sm:gap-1.5"
            aria-label={`Máu ${hpDisplay} trên ${status.maxHp}`}
          >
            {Array.from({ length: status.maxHp }, (_, idx) => {
              const isFull = status.hp >= idx + 1;
              const isHalf = !isFull && status.hp >= idx + 0.5;
              return (
                <span key={idx} className="relative inline-flex w-4 h-4 sm:w-5 sm:h-5 shrink-0">
                  <Heart
                    className={`w-full h-full transition-colors ${
                      isFull
                        ? 'fill-rose-500 text-rose-400'
                        : 'fill-slate-800 text-slate-600'
                    }`}
                  />
                  {isHalf && (
                    <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                      <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-rose-500 text-rose-400" />
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          <span className="font-mono-tech text-[11px] font-bold text-rose-300 tabular-nums shrink-0">
            {hpDisplay}/{status.maxHp}
          </span>
        </div>
      </div>
    </div>
  );
});
