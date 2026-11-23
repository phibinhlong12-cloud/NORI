import { memo, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';

interface PauseMenuProps {
  visible: boolean;
  hasStarted: boolean;
  renderDistance: number;
  sensitivity: number;
  onRenderDistanceChange: (value: number) => void;
  onSensitivityChange: (value: number) => void;
  onPlay: () => void;
}

const GUIDE_ITEMS: Array<{ label: string; keys: string }> = [
  { label: 'Di chuyển / Chạy', keys: 'WASD + Shift' },
  { label: 'Nhảy', keys: 'Space' },
  { label: 'Chặt cây / Chém', keys: 'Chuột Trái' },
  { label: 'Khiêng / Bán / Mua', keys: 'Chuột Phải' },
  { label: 'Mở Balo / Chọn ô', keys: 'E / 1–9' },
  { label: 'Cất / Lấy nhanh (1→9)', keys: 'F' },
  { label: 'Đổi Katana', keys: 'Q' },
  { label: 'Che / Cất Khiên chắn', keys: 'R' },
];

export const PauseMenu = memo(function PauseMenu({
  visible,
  hasStarted,
  renderDistance,
  sensitivity,
  onRenderDistanceChange,
  onSensitivityChange,
  onPlay,
}: PauseMenuProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/85 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-5">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
            Nori Town
          </h1>
        </div>

        <div className="bg-slate-800/80 border border-white/10 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">
                Tầm nhìn tải Chunk (Render Distance)
              </div>
              <div className="text-xs text-slate-400">
                Tăng giá trị để nhìn xa hơn (mặc định: 4)
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="range"
                min={2}
                max={7}
                value={renderDistance}
                onChange={(e) => onRenderDistanceChange(parseInt(e.target.value, 10))}
                className="w-24 accent-emerald-400 cursor-pointer"
                aria-label="Tầm nhìn tải Chunk"
              />
              <span className="font-mono-tech text-sm font-bold text-emerald-400 w-5 text-center">
                {renderDistance}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/10">
            <div>
              <div className="text-sm font-semibold text-white">
                Độ nhạy chuột (Camera)
              </div>
              <div className="text-xs text-slate-400">
                Điều chỉnh tốc độ xoay góc nhìn
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="range"
                min={1}
                max={10}
                value={sensitivity}
                onChange={(e) => onSensitivityChange(parseInt(e.target.value, 10))}
                className="w-24 accent-sky-400 cursor-pointer"
                aria-label="Độ nhạy chuột"
              />
              <span className="font-mono-tech text-sm font-bold text-sky-400 w-5 text-center">
                {sensitivity}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-white/10 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setGuideOpen((prev) => !prev)}
            aria-expanded={guideOpen}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/90 transition cursor-pointer"
          >
            <span className="flex items-center gap-2.5 text-sm font-semibold text-white">
              <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Hướng dẫn người chơi</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                guideOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {guideOpen && (
            <div className="px-4 pb-3.5 pt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              {GUIDE_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="bg-slate-900/70 px-3 py-2 rounded-xl border border-white/10 flex items-center justify-between gap-2"
                >
                  <span>{item.label}</span>
                  <strong className="text-amber-300 font-mono-tech whitespace-nowrap">
                    {item.keys}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={onPlay}
            className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-bold py-3.5 px-6 rounded-2xl shadow-lg transition cursor-pointer text-base whitespace-nowrap"
          >
            {hasStarted ? 'Tiếp Tục Chơi' : 'Bắt Đầu Khám Phá'}
          </button>
        </div>
      </div>
    </div>
  );
});
