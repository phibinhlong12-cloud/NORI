import { memo, useEffect, useState } from 'react';
import { Snowflake } from 'lucide-react';
import {
  DRAGON_LEVEL,
  DRAGON_MAX_HP,
  DRAGON_MIN_ATTACK_LEVEL,
  DragonBossHudState,
} from '../game/dragon';
import { HudStats, VoxelEngine } from '../game/engine';

interface BossHealthBarProps {
  engine: VoxelEngine | null;
}

interface BossViewState {
  boss: DragonBossHudState;
  playerLevel: number;
}

const INITIAL_BOSS_HUD: DragonBossHudState = {
  visible: false,
  alive: true,
  level: DRAGON_LEVEL,
  hp: DRAGON_MAX_HP,
  maxHp: DRAGON_MAX_HP,
  activeSkill: null,
  phase: 'idle',
  warningLabel: null,
  warningProgress: 0,
  dropAvailable: false,
};

const INITIAL_STATE: BossViewState = {
  boss: INITIAL_BOSS_HUD,
  playerLevel: 1,
};

export const BossHealthBar = memo(function BossHealthBar({ engine }: BossHealthBarProps) {
  const [state, setState] = useState<BossViewState>(INITIAL_STATE);

  useEffect(() => {
    if (!engine) {
      setState(INITIAL_STATE);
      return;
    }

    return engine.subscribeStats((stats: HudStats) => {
      setState((prev) => {
        const next = stats.bossHud;
        if (
          prev.playerLevel === stats.level &&
          prev.boss.visible === next.visible &&
          prev.boss.alive === next.alive &&
          prev.boss.hp === next.hp &&
          prev.boss.dropAvailable === next.dropAvailable
        ) {
          return prev;
        }
        return {
          boss: { ...next },
          playerLevel: stats.level,
        };
      });
    });
  }, [engine]);

  const { boss, playerLevel } = state;
  if (!boss.visible) return null;

  const hpPct = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));

  return (
    <div className="fixed top-12 sm:top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-[min(92vw,420px)] flex flex-col items-center gap-1.5">
      {boss.alive && (
        <div className="w-full bg-slate-950/88 border border-sky-400/45 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-xl">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold mb-1 sm:mb-1.5">
            <div className="flex items-center gap-1.5 text-sky-300">
              <Snowflake className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
              <span>Rồng Băng · LV.{boss.level}</span>
              {playerLevel < DRAGON_MIN_ATTACK_LEVEL && (
                <span className="text-[10px] font-semibold text-amber-300 ml-1">
                  (Cần Lv.{DRAGON_MIN_ATTACK_LEVEL})
                </span>
              )}
            </div>
            <span className="font-mono-tech text-cyan-200 tabular-nums">
              {boss.hp.toLocaleString('vi-VN')} / {boss.maxHp.toLocaleString('vi-VN')}
            </span>
          </div>
          <div className="w-full h-2.5 sm:h-3 rounded-md bg-slate-900 border border-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-600 via-sky-400 to-cyan-200 transition-all duration-100"
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>
      )}

      {!boss.alive && boss.dropAvailable && (
        <div className="bg-sky-950/90 border border-cyan-300/70 text-cyan-100 rounded-xl px-3.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-semibold shadow-xl text-center">
          Katana Băng đã rơi ra! Lại gần hoặc bấm Nhận để trang bị.
        </div>
      )}
    </div>
  );
});
