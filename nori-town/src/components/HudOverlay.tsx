import { memo, ReactNode, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, Settings } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';

interface HudOverlayProps {
  engine: VoxelEngine | null;
  isPlaying: boolean;
  isFullscreen: boolean;
  touchMode?: boolean;
  onToggleFullscreen: () => void;
  onPause: () => void;
  moneySlot?: ReactNode;
  xpSlot?: ReactNode;
  leftSlot?: ReactNode;
}

const SHOW_DEBUG_HUD = false;
const SHOW_CONTROLS_HINT = false;

export const HudOverlay = memo(function HudOverlay({
  engine,
  isPlaying,
  isFullscreen,
  touchMode = false,
  onToggleFullscreen,
  onPause,
  moneySlot,
  xpSlot,
  leftSlot,
}: HudOverlayProps) {
  const coordsRef = useRef<HTMLSpanElement | null>(null);
  const fpsRef = useRef<HTMLElement | null>(null);
  const chunksRef = useRef<HTMLElement | null>(null);
  const targetRef = useRef<HTMLSpanElement | null>(null);
  const chopBoxRef = useRef<HTMLDivElement | null>(null);
  const chopBarRef = useRef<HTMLDivElement | null>(null);
  const chopTextRef = useRef<HTMLSpanElement | null>(null);
  const crosshairRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!engine) return;
    return engine.subscribeStats((stats: HudStats) => {
      if (SHOW_DEBUG_HUD) {
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
      }

      const modalOpen =
        stats.shopOpen || stats.outfitShopOpen || stats.characterWindowOpen;

      if (crosshairRef.current) {
        crosshairRef.current.style.display = modalOpen ? 'none' : 'block';
      }

      if (chopBoxRef.current && chopBarRef.current && chopTextRef.current) {
        if (!modalOpen && stats.chopProgress > 0) {
          chopBoxRef.current.style.display = 'flex';
          chopBarRef.current.style.width = `${Math.round(stats.chopProgress * 100)}%`;
          chopTextRef.current.textContent = `${(stats.chopProgress * 3).toFixed(1)} / 3.0s`;
        } else {
          chopBoxRef.current.style.display = 'none';
        }
      }
    });
  }, [engine]);

  return (
    <>
      {isPlaying && (
        <>
          {!touchMode && (
            <div
              ref={crosshairRef}
              aria-hidden="true"
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none z-20"
            >
              <svg
                viewBox="0 0 24 24"
                className="block w-6 h-6 drop-shadow-[0_0_1.5px_rgba(0,0,0,0.75)]"
                fill="none"
              >
                <circle cx="12" cy="12" r="9.2" stroke="#ef1c24" strokeWidth="3.2" />
                <circle cx="12" cy="12" r="2.1" stroke="#2c4de0" strokeWidth="1.7" />
              </svg>
            </div>
          )}

          <div
            ref={chopBoxRef}
            style={{ display: 'none' }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 translate-y-5 z-20 pointer-events-none flex-col items-center gap-1 bg-slate-950/85 border border-amber-400/40 px-3 py-1.5 rounded-xl shadow-lg min-w-[146px]"
          >
            <div className="w-full flex items-center justify-between gap-2 text-[10px] font-semibold text-amber-200">
              <span>Đang chặt cây...</span>
              <span ref={chopTextRef} className="font-mono-tech text-emerald-300">
                0.0 / 3.0s
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                ref={chopBarRef}
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full"
                style={{ width: '0%' }}
              />
            </div>
          </div>
        </>
      )}

      <div className="fixed top-2.5 left-2.5 sm:top-4 sm:left-4 z-20 flex flex-col items-start gap-1.5 sm:gap-2.5 pointer-events-none">
        <div className="flex flex-row sm:flex-col items-center sm:items-start gap-1.5 sm:gap-2.5">
          <div className="bg-slate-950/80 border border-white/15 text-white px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl shadow-lg text-xs sm:text-sm space-y-1.5">
            <div className="font-bold text-emerald-300 tracking-wide text-[11px] sm:text-xs whitespace-nowrap">
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

          {moneySlot}
        </div>

        {xpSlot}

        {leftSlot}
      </div>

      {isPlaying && (
        <div className="fixed top-2.5 right-2.5 sm:top-4 sm:right-4 z-20 flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Thu nhỏ màn hình' : 'Phóng toàn màn hình'}
              className="bg-slate-950/80 border border-white/15 hover:bg-slate-800/90 active:scale-95 text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm font-medium shadow-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
              )}
              <span className="sm:hidden">{isFullscreen ? 'Thu' : 'Full'}</span>
            </button>

            <button
              type="button"
              onClick={onPause}
              className="bg-slate-950/80 border border-white/15 hover:bg-slate-800/90 active:scale-95 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium shadow-lg transition flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
              <span className="sm:hidden">Menu</span>
              <span className="hidden sm:inline">Menu (ESC)</span>
            </button>
          </div>

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
      )}
    </>
  );
});
