import { memo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CharacterGender } from '../game/firstPersonArms';
import { Character3DViewport } from './Character3DViewport';

interface GenderSelectModalProps {
  visible: boolean;
  onSelectGender: (gender: CharacterGender) => void;
  onBack: () => void;
}

export const GenderSelectModal = memo(function GenderSelectModal({
  visible,
  onSelectGender,
  onBack,
}: GenderSelectModalProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/88 flex flex-col items-center justify-center p-3 sm:p-6 select-none overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900/95 border border-white/15 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-4 sm:space-y-6 my-auto">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div>
            <h2 className="font-cyber text-xl sm:text-2xl font-extrabold tracking-wide text-white">
              Chọn Giới Tính Nhân Vật
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Click chuột trái trực tiếp vào nhân vật 3D bên dưới để bắt đầu khám phá thế giới
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer transition active:scale-95 shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {/* Nhân vật Nam */}
          <button
            type="button"
            onClick={() => onSelectGender('male')}
            className="group relative flex flex-col items-center rounded-2xl border border-sky-400/35 hover:border-sky-300 bg-gradient-to-b from-slate-800/90 to-slate-950/95 p-3 sm:p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(56,189,248,0.28)] cursor-pointer active:scale-[0.99]"
          >
            <div className="font-cyber text-xl sm:text-2xl font-black tracking-widest text-sky-300 group-hover:text-sky-200 transition-colors mb-3">
              Nam
            </div>

            <div className="w-full h-64 sm:h-80 rounded-xl bg-slate-950/75 border border-white/10 overflow-hidden pointer-events-none">
              <Character3DViewport
                gender="male"
                previewWeapon
                interactiveRotate={false}
                initialYaw={0.28}
              />
            </div>

            <div className="mt-3 w-full py-2 rounded-xl bg-sky-500/20 group-hover:bg-sky-500 border border-sky-400/50 text-sky-200 group-hover:text-slate-950 font-bold text-xs sm:text-sm transition-colors">
              Bắt đầu
            </div>
          </button>

          {/* Nhân vật Nữ */}
          <button
            type="button"
            onClick={() => onSelectGender('female')}
            className="group relative flex flex-col items-center rounded-2xl border border-rose-400/35 hover:border-rose-300 bg-gradient-to-b from-slate-800/90 to-slate-950/95 p-3 sm:p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(251,113,133,0.28)] cursor-pointer active:scale-[0.99]"
          >
            <div className="font-cyber text-xl sm:text-2xl font-black tracking-widest text-rose-300 group-hover:text-rose-200 transition-colors mb-3">
              Nữ
            </div>

            <div className="w-full h-64 sm:h-80 rounded-xl bg-slate-950/75 border border-white/10 overflow-hidden pointer-events-none">
              <Character3DViewport
                gender="female"
                previewWeapon
                interactiveRotate={false}
                initialYaw={-0.28}
              />
            </div>

            <div className="mt-3 w-full py-2 rounded-xl bg-rose-500/20 group-hover:bg-rose-500 border border-rose-400/50 text-rose-200 group-hover:text-slate-950 font-bold text-xs sm:text-sm transition-colors">
              Bắt đầu
            </div>
          </button>
        </div>
      </div>
    </div>
  );
});
