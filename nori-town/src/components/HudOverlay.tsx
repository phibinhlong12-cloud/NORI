import { memo, ReactNode, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';

interface HudOverlayProps {
  engine: VoxelEngine | null;
  isPlaying: boolean;
  onPause: () => void;
  leftSlot?: ReactNode;
}

const SHOW_DEBUG_HUD = false;
const SHOW_CONTROLS_HINT = false;

export const HudOverlay = memo(function HudOverlay({
  engine,
  isPlaying,
  onPause,
  leftSlot,
}: HudOverlayProps) {
  const coordsRef = useRef<HTMLSpanElement | null>(null);
  const fpsRef = useRef<HTMLElement | null>(null);
  const chunksRef = useRef<HTMLElement | null>(null);
  const targetRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!engine || !SHOW_DEBUG_HUD) return;
    return engine.subscribeStats((stats: HudStats) => {
      if (coordsRef.current) {
        coordsRef.current.textContent = `X: ${stats.x.toFixed(1)} | Y: ${stats.y.toFixed(1)} | Z: ${stats.z.toFixed(1)}`;
      }
      if (fpsRef.current) {
        fpsRef.current.textContent = String(stats.fps);
        fpsRef.current.className =
          stats.fps >= 45
            ? 'text-emerald-400'
            : stats.fps >= 25
              ? 'text-amber-300'
              : 'text-rose-400';
      }
      if (chunksRef.current) {
        chunksRef.current.textContent = String(stats.chunkCount);
      }
      if (targetRef.current) {
        if (stats.targetName && stats.targetCoords) {
          targetRef.current.textContent = `${stats.targetName} (${stats.targetCoords[0]}, ${stats.targetCoords[1]}, ${stats.targetCoords[2]})`;
          targetRef.current.className = 'text-emerald-300 font-semibold';
        } else {
          targetRef.current.textContent = 'Không có';
          targetRef.current.className = 'text-slate-400';
        }
      }
    });
  }, [engine]);

  return (
    <>
      {isPlaying && (
        <div
          aria-hidden="true"
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none z-20"
        >
          <span className="absolute top-[9px] left-0 w-5 h-0.5 bg-white/90 shadow-[0_0_3px_rgba(0,0,0,0.85)]" />
          <span className="absolute top-0 left-[9px] w-0.5 h-5 bg-white/90 shadow-[0_0_3px_rgba(0,0,0,0.85)]" />
        </div>
      )}

      <div className="fixed top-4 left-4 z-20 flex flex-col items-start gap-2.5 pointer-events-none">
        <div className="bg-slate-950/80 border border-white/15 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs sm:text-sm space-y-1.5">
          <div className="font-bold text-emerald-300 tracking-wide text-xs">
            Nori Town
          </div>
          {SHOW_DEBUG_HUD && (
            <>
              <div className="font-mono-tech text-slate-100">
                Tọa độ:{' '}
                <span ref={coordsRef} className="text-amber-300 font-semibold">
                  X: 0.5 | Y: 4.1 | Z: 0.5
                </span>
              </div>
              <div className="font-mono-tech text-slate-200 flex items-center gap-4">
                <span>
                  FPS: <strong ref={fpsRef} className="text-emerald-400">60</strong>
                </span>
                <span>
                  Chunk: <strong ref={chunksRef} className="text-sky-300">0</strong>
                </span>
              </div>
              <div className="font-mono-tech text-xs text-slate-300 pt-1 border-t border-white/10">
                Đang nhìn:{' '}
                <span ref={targetRef} className="text-slate-400">
                  Không có
                </span>
              </div>
            </>
          )}
        </div>

        {leftSlot}
      </div>

      <div className="fixed top-4 right-4 z-20 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={onPause}
          className="bg-slate-950/80 border border-white/15 hover:bg-slate-800/90 active:scale-95 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-lg transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Settings className="w-4 h-4 text-amber-300" />
          <span>Menu (ESC)</span>
        </button>

        {SHOW_CONTROLS_HINT && (
          <div className="hidden md:block bg-slate-950/80 border border-white/15 text-slate-200 px-3.5 py-2.5 rounded-xl text-xs space-y-1 pointer-events-none shadow-lg">
            <div>
              <span className="text-amber-300 font-semibold">WASD</span>: Di chuyển ·{' '}
              <span className="text-amber-300 font-semibold">Shift</span>: Chạy nhanh
            </div>
            <div>
              <span className="text-amber-300 font-semibold">Space</span>: Nhảy
            </div>
            <div>
              <span className="text-amber-300 font-semibold">Chuột trái</span>: Chặt cây / Chém ·{' '}
              <span className="text-amber-300 font-semibold">Chuột phải</span>: Khiêng / Bán / Mua đồ
            </div>
            <div>
              <span className="text-amber-300 font-semibold">E</span>: Balo (1–9 chọn ô) ·{' '}
              <span className="text-amber-300 font-semibold">F</span>: Cất/Lấy nhanh ·{' '}
              <span className="text-amber-300 font-semibold">Q</span>: Katana ·{' '}
              <span className="text-amber-300 font-semibold">R</span>: Khiên
            </div>
          </div>
        )}
      </div>
    </>
  );
});
