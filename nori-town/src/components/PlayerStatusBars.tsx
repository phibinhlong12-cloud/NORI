import { memo, useEffect, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';
import { getXpForNextLevel, MAX_LEVEL, MAX_PLAYER_HP } from '../game/slimeZones';

interface PlayerStatusBarsProps {
  engine: VoxelEngine | null;
  touchMode?: boolean;
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

function useStatusState(engine: VoxelEngine | null): StatusState {
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

  return status;
}

export const XpBar = memo(function XpBar({ engine }: { engine: VoxelEngine | null }) {
  const status = useStatusState(engine);
  const isMaxLevel = status.level >= MAX_LEVEL;
  const xpPercent = isMaxLevel
    ? 100
    : status.xpToNext > 0
      ? Math.min(100, (status.xp / status.xpToNext) * 100)
      : 0;

  return (
    <div className="bg-slate-950/85 border border-emerald-400/25 text-white px-2 py-1 rounded-lg shadow-md pointer-events-none w-[128px] sm:w-[144px] space-y-0.5">
      <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[10px] font-mono-tech leading-tight">
        <span className="flex items-center gap-0.5 font-bold text-emerald-300 whitespace-nowrap">
          <Sparkles className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
          <span>Lv.{status.level}</span>
          {isMaxLevel && (
            <span className="px-1 py-0.5 rounded bg-amber-500 text-slate-950 text-[7px] font-bold leading-none">
              MAX
            </span>
          )}
        </span>
        <span className="text-slate-300 tabular-nums whitespace-nowrap">
          {isMaxLevel
            ? 'Tối đa (30)'
            : `${status.xp.toLocaleString('vi-VN')} / ${status.xpToNext.toLocaleString('vi-VN')} XP`}
        </span>
      </div>

      <div className="h-1 w-full rounded-full bg-slate-800 border border-white/10 overflow-hidden">
        <div
          className="h-full bg-emerald-400 transition-[width] duration-200"
          style={{ width: `${xpPercent}%` }}
        />
      </div>
    </div>
  );
});

export const PlayerStatusBars = memo(function PlayerStatusBars({
  engine,
  touchMode = false,
}: PlayerStatusBarsProps) {
  const status = useStatusState(engine);

  const hpValue = Math.max(0, Math.round(status.hp));
  const maxHpValue = Math.max(1, Math.round(status.maxHp));
  const hpPercent = Math.min(100, Math.max(0, (hpValue / maxHpValue) * 100));
  const barGradientClass =
    hpPercent <= 25
      ? 'from-red-600 to-rose-500'
      : hpPercent <= 50
        ? 'from-amber-500 to-orange-400'
        : 'from-rose-600 via-rose-500 to-pink-400';

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-20 pointer-events-none ${
        touchMode
          ? 'bottom-[166px] w-[min(86vw,300px)] sm:bottom-3 sm:w-[min(32vw,240px)]'
          : 'bottom-3 w-[min(90vw,340px)]'
      }`}
    >
      <div
        className="bg-slate-950/90 border border-white/15 rounded-2xl px-3 py-1.5 sm:px-3.5 sm:py-2 shadow-xl"
        aria-label={`Máu ${hpValue} trên ${maxHpValue}`}
      >
        <div className="flex items-center gap-2 sm:gap-2.5">
          <Heart className="w-4 h-4 sm:w-[18px] sm:h-[18px] fill-rose-500 text-rose-400 shrink-0" />
          <div className="flex-1 h-3 sm:h-3.5 rounded-full bg-slate-800/95 border border-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${barGradientClass} transition-[width] duration-200`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
          <span className="font-mono-tech text-xs sm:text-[13px] font-bold text-rose-200 tabular-nums shrink-0 whitespace-nowrap">
            {hpValue}/{maxHpValue}
          </span>
        </div>
      </div>
    </div>
  );
});
