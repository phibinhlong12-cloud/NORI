import { memo, useState } from 'react';
import { BookOpen, ChevronDown, Smartphone } from 'lucide-react';

interface PauseMenuProps {
  visible: boolean;
  hasStarted: boolean;
  renderDistance: number;
  sensitivity: number;
  touchControlsEnabled: boolean;
  onRenderDistanceChange: (value: number) => void;
  onSensitivityChange: (value: number) => void;
  onToggleTouchControls: () => void;
  onPlay: () => void;
}

const GUIDE_ITEMS: Array<{ label: string; keys: string }> = [
  { label: 'Di chuyển / Chạy', keys: 'WASD + Shift' },
  { label: 'Nhảy', keys: 'Space' },
  { label: 'Chặt cây (giữ 5s) / Katana (1 click)', keys: 'Chuột Trái' },
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
  touchControlsEnabled,
  onRenderDistanceChange,
  onSensitivityChange,
  onToggleTouchControls,
  onPlay,
}: PauseMenuProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/85 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-lg w-full max-h-[92dvh] overflow-y-auto bg-slate-900 border border-white/15 rounded-3xl p-5 sm:p-8 text-white shadow-2xl space-y-4 sm:space-y-5">
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

          <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/10">
            <div className="flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-white">
                  Nút điều khiển cảm ứng (Mobile)
                </div>
                <div className="text-xs text-slate-400">
                  Hiện phím ảo &amp; bố cục gọn cho điện thoại
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleTouchControls}
              aria-pressed={touchControlsEnabled}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                touchControlsEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                  : 'bg-slate-900/80 border-white/15 text-slate-300'
              }`}
            >
              {touchControlsEnabled ? 'Đang bật' : 'Đang tắt'}
            </button>
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
            <div className="px-4 pb-3.5 pt-2 border-t border-white/10 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
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
              {touchControlsEnabled && (
                <div className="bg-emerald-950/50 border border-emerald-400/25 rounded-xl px-3 py-2 text-[11px] text-emerald-200 leading-relaxed">
                  <strong>Mẹo điện thoại:</strong> Kéo cần tròn góc trái để di chuyển mọi hướng, vuốt vùng trống để xoay góc nhìn. Chạm giữ vào thân cây 5s (hoặc chạm 1 lần khi cầm Katana) để chặt cây, chạm lên quái để chém, và chạm trực tiếp vào ô Balo để chọn đồ.
                </div>
              )}
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
