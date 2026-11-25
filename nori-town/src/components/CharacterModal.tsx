import { memo, useEffect, useState } from 'react';
import { Crown, Footprints, Shield, ShieldHalf, Shirt, Sword, User, X } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';
import { CharacterGender } from '../game/firstPersonArms';
import { Character3DViewport } from './Character3DViewport';

interface CharacterModalProps {
  engine: VoxelEngine | null;
}

interface CharacterWindowState {
  open: boolean;
  gender: CharacterGender;
  level: number;
  hasKatana: boolean;
  hasIceKatana: boolean;
  hasShield: boolean;
}

const INITIAL_STATE: CharacterWindowState = {
  open: false,
  gender: 'male',
  level: 1,
  hasKatana: false,
  hasIceKatana: false,
  hasShield: false,
};

export const CharacterModal = memo(function CharacterModal({ engine }: CharacterModalProps) {
  const [state, setState] = useState<CharacterWindowState>(INITIAL_STATE);

  useEffect(() => {
    if (!engine) {
      setState(INITIAL_STATE);
      return;
    }

    return engine.subscribeStats((stats: HudStats) => {
      setState((prev) => {
        if (
          prev.open === stats.characterWindowOpen &&
          prev.gender === stats.gender &&
          prev.level === stats.level &&
          prev.hasKatana === stats.hasKatana &&
          prev.hasIceKatana === stats.hasIceKatana &&
          prev.hasShield === stats.hasShield
        ) {
          return prev;
        }
        return {
          open: stats.characterWindowOpen,
          gender: stats.gender,
          level: stats.level,
          hasKatana: stats.hasKatana,
          hasIceKatana: stats.hasIceKatana,
          hasShield: stats.hasShield,
        };
      });
    });
  }, [engine]);

  if (!state.open) return null;

  const isMale = state.gender === 'male';
  const armorSlots = [
    { id: 'hat', label: 'Nón', Icon: Crown },
    { id: 'armor', label: 'Giáp', Icon: Shirt },
    { id: 'pants', label: 'Quần', Icon: ShieldHalf },
    { id: 'shoes', label: 'Giày', Icon: Footprints },
  ] as const;

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-5 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative w-full max-w-3xl max-h-[92dvh] overflow-y-auto touch-pan-y bg-slate-900 border border-white/20 rounded-3xl p-4 sm:p-6 text-white shadow-2xl space-y-4">
        {/* Thanh tiêu đề cửa sổ nhân vật */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                isMale
                  ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
                  : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
              }`}
            >
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                Nhân Vật · {isMale ? 'Nam' : 'Nữ'} (Lv.{state.level})
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Kéo xoay mô hình 3D ·{' '}
                <span className="hidden sm:inline">Ấn B, ESC hoặc nút X để đóng</span>
                <span className="sm:hidden">Chạm nút X góc phải để đóng</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => engine?.closeCharacterWindow()}
            aria-label="Đóng cửa sổ nhân vật"
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-500/25 border border-white/15 hover:border-rose-400/50 text-slate-200 hover:text-rose-200 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bố cục 3 cột giống mẫu: Trái (Kiếm, Khiên) · Giữa (Hình ảnh nhân vật 3D) · Phải (Nón, Giáp, Quần, Giày) */}
        <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_180px] gap-4 items-center">
          {/* Cột trái: Hình thanh kiếm + Hình tấm khiên */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
            <div
              className={`rounded-2xl border p-3.5 flex flex-col items-center justify-center gap-2 text-center min-h-[112px] ${
                state.hasKatana
                  ? state.hasIceKatana
                    ? 'bg-cyan-950/35 border-cyan-400/45'
                    : 'bg-sky-950/35 border-sky-400/45'
                  : 'bg-slate-800/65 border-white/10'
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-slate-950/85 border border-white/15 flex items-center justify-center">
                <Sword
                  className={`w-6 h-6 ${
                    state.hasKatana
                      ? state.hasIceKatana
                        ? 'text-cyan-300'
                        : 'text-sky-300'
                      : 'text-slate-500'
                  }`}
                />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Thanh Kiếm</div>
                <div
                  className={`text-[11px] mt-0.5 font-semibold ${
                    state.hasKatana
                      ? state.hasIceKatana
                        ? 'text-cyan-300'
                        : 'text-emerald-300'
                      : 'text-slate-500'
                  }`}
                >
                  {state.hasKatana
                    ? state.hasIceKatana
                      ? 'Katana Băng'
                      : 'Katana'
                    : 'Trống'}
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-3.5 flex flex-col items-center justify-center gap-2 text-center min-h-[112px] ${
                state.hasShield
                  ? 'bg-amber-950/30 border-amber-400/45'
                  : 'bg-slate-800/65 border-white/10'
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-slate-950/85 border border-white/15 flex items-center justify-center">
                <Shield
                  className={`w-6 h-6 ${state.hasShield ? 'text-amber-300' : 'text-slate-500'}`}
                />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Tấm Khiên</div>
                <div
                  className={`text-[11px] mt-0.5 font-semibold ${
                    state.hasShield ? 'text-emerald-300' : 'text-slate-500'
                  }`}
                >
                  {state.hasShield ? 'Khiên chắn' : 'Trống'}
                </div>
              </div>
            </div>
          </div>

          {/* Cột giữa: Hình ảnh nhân vật 3D sống động */}
          <div className="h-72 sm:h-88 w-full rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-950/95 border border-white/15 overflow-hidden">
            <Character3DViewport
              gender={state.gender}
              hasKatana={state.hasKatana}
              hasIceKatana={state.hasIceKatana}
              hasShield={state.hasShield}
              interactiveRotate
              initialYaw={0.2}
            />
          </div>

          {/* Cột phải: 4 ô Nón, Giáp, Quần, Giày tạm thời để trống */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2.5">
            {armorSlots.map(({ id, label, Icon }) => (
              <div
                key={id}
                className="rounded-2xl border border-white/10 bg-slate-800/65 px-3 py-2.5 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-200">{label}</div>
                  <div className="text-[11px] text-slate-500">Trống</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
