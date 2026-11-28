import { memo, ReactNode, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, Settings, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';

interface HudOverlayProps {
  engine: VoxelEngine | null;
  isPlaying: boolean;
  isFullscreen: boolean;
  audioMuted?: boolean;
  touchMode?: boolean;
  onToggleFullscreen: () => void;
  onToggleAudioMute?: () => void;
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
  audioMuted = false,
  touchMode = false,
  onToggleFullscreen,
  onToggleAudioMute,
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
  const recallBoxRef = useRef<HTMLDivElement | null>(null);
  const recallLabelRef = useRef<HTMLSpanElement | null>(null);
  const recallBarRef = useRef<HTMLDivElement | null>(null);
  const recallTextRef = useRef<HTMLSpanElement | null>(null);
  const recallReturnHintRef = useRef<HTMLDivElement | null>(null);
  const caveEmergeBoxRef = useRef<HTMLDivElement | null>(null);
  const caveEmergeBarRef = useRef<HTMLDivElement | null>(null);
  const caveEmergeTextRef = useRef<HTMLSpanElement | null>(null);
  const stageClearBoxRef = useRef<HTMLDivElement | null>(null);
  const stageClearTimerRef = useRef<HTMLSpanElement | null>(null);
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
        stats.shopOpen ||
        stats.outfitShopOpen ||
        stats.craftingOpen ||
        stats.characterWindowOpen;

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

      if (recallBoxRef.current && recallBarRef.current && recallTextRef.current) {
        if (!modalOpen && stats.recallActive) {
          recallBoxRef.current.style.display = 'flex';
          if (recallLabelRef.current) {
            recallLabelRef.current.textContent =
              stats.recallMode === 'to_return'
                ? 'Đang biến trở lại... (Bị đánh sẽ ngắt)'
                : 'Đang biến về... (Bị đánh sẽ ngắt)';
          }
          recallBarRef.current.style.width = `${Math.round(stats.recallProgress * 100)}%`;
          const remaining = Math.max(0, (1 - stats.recallProgress) * 3).toFixed(1);
          recallTextRef.current.textContent = `${remaining}s`;
        } else {
          recallBoxRef.current.style.display = 'none';
        }
      }

      if (recallReturnHintRef.current) {
        const showReturnHint =
          !modalOpen && !touchMode && !stats.recallActive && stats.inCastle && stats.hasRecallReturnPoint;
        recallReturnHintRef.current.style.display = showReturnHint ? 'flex' : 'none';
      }

      if (caveEmergeBoxRef.current && caveEmergeBarRef.current && caveEmergeTextRef.current) {
        if (!modalOpen && stats.stageCavePhase === 'emerging') {
          caveEmergeBoxRef.current.style.display = 'flex';
          caveEmergeBarRef.current.style.width = `${Math.round(stats.stageCaveEmergeProgress * 100)}%`;
          caveEmergeTextRef.current.textContent = `${stats.stageCaveEmergeRemaining.toFixed(1)}s`;
        } else {
          caveEmergeBoxRef.current.style.display = 'none';
        }
      }

      if (stageClearBoxRef.current && stageClearTimerRef.current) {
        if (!modalOpen && stats.stage1ClearBannerRemaining > 0) {
          stageClearBoxRef.current.style.display = 'flex';
          stageClearTimerRef.current.textContent = `${Math.ceil(stats.stage1ClearBannerRemaining)}s`;
        } else {
          stageClearBoxRef.current.style.display = 'none';
        }
      }
    });
  }, [engine, touchMode]);

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

          <div
            ref={recallBoxRef}
            style={{ display: 'none' }}
            className={`fixed left-1/2 -translate-x-1/2 z-20 pointer-events-none flex-col items-center gap-1.5 bg-slate-950/90 border border-cyan-400/55 px-4 py-2 rounded-xl shadow-[0_0_24px_rgba(56,189,248,0.3)] min-w-[210px] ${
              touchMode ? 'bottom-[212px] sm:bottom-20' : 'bottom-20'
            }`}
          >
            <div className="w-full flex items-center justify-between gap-3 text-[11px] font-bold text-cyan-200">
              <span ref={recallLabelRef}>Đang biến về... (Bị đánh sẽ ngắt)</span>
              <span ref={recallTextRef} className="font-mono-tech text-amber-300 tabular-nums">
                3.0s
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-white/10">
              <div
                ref={recallBarRef}
                className="h-full bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300 rounded-full transition-[width] duration-75"
                style={{ width: '0%' }}
              />
            </div>
          </div>

          <div
            ref={recallReturnHintRef}
            style={{ display: 'none' }}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none items-center gap-2 bg-slate-950/85 border border-fuchsia-400/45 text-fuchsia-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg"
          >
            <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/25 border border-fuchsia-300/45 text-amber-300 font-mono-tech font-bold">
              Z
            </span>
            <span>Biến trở lại vị trí trước khi biến về</span>
          </div>

          <div
            ref={caveEmergeBoxRef}
            style={{ display: 'none' }}
            className="fixed top-[88px] sm:top-[68px] left-1/2 -translate-x-1/2 z-20 pointer-events-none flex-col items-center gap-1.5 bg-slate-950/92 border border-sky-400/50 px-4 py-2 rounded-xl shadow-[0_8px_24px_rgba(2,132,199,0.28)] w-[min(90vw,310px)]"
          >
            <div className="w-full flex items-center justify-between gap-3 text-[11px] font-bold text-sky-200">
              <span>Hang động bí ẩn đang trồi lên...</span>
              <span ref={caveEmergeTextRef} className="font-mono-tech text-cyan-300 tabular-nums">
                15.0s
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/10">
              <div
                ref={caveEmergeBarRef}
                className="h-full bg-gradient-to-r from-sky-500 via-cyan-300 to-indigo-400 rounded-full transition-[width] duration-75"
                style={{ width: '0%' }}
              />
            </div>
          </div>

          <div
            ref={stageClearBoxRef}
            style={{ display: 'none' }}
            className="fixed top-[88px] sm:top-[68px] left-1/2 -translate-x-1/2 z-30 pointer-events-none flex-col gap-1.5 bg-slate-950/95 border border-cyan-400/55 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-[0_12px_36px_rgba(14,165,233,0.32)] w-[min(92vw,470px)] text-center"
          >
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold text-amber-300 tracking-wide">
              <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>Chúc mừng đã hoàn thành Ải 1 - Khởi đầu!</span>
              <span
                ref={stageClearTimerRef}
                className="ml-1 px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-300/40 font-mono-tech text-[10px] sm:text-[11px] text-cyan-200 tabular-nums"
              >
                15s
              </span>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-cyan-100">
              Lối đi đến <span className="text-sky-300 font-bold">Ải 2 - Hang động chết</span> đã mở!
            </div>
            <div className="text-[11px] sm:text-xs font-medium text-amber-200/95">
              Yêu cầu Cấp 15 để qua ải 2 · Bước vào cổng dịch chuyển trong hang để tiếp tục.
            </div>
          </div>
        </>
      )}

      <div className="fixed top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-20 flex flex-col items-start gap-1 pointer-events-none">
        <div className="flex flex-row sm:flex-col items-center sm:items-start gap-1">
          <div className="bg-slate-950/80 border border-white/15 text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg shadow-md text-[10px] sm:text-[11px] space-y-1">
            <div className="font-bold text-emerald-300 tracking-wide text-[10px] sm:text-[11px] leading-tight whitespace-nowrap">
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
        <div className="fixed top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 z-20 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1">
            {onToggleAudioMute && (
              <button
                type="button"
                onClick={onToggleAudioMute}
                aria-label={audioMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                title={audioMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                className={`bg-slate-950/80 border hover:bg-slate-800/90 active:scale-95 text-white px-1.5 py-1 sm:px-2 sm:py-1 rounded-lg text-[10px] font-medium shadow-md transition flex items-center justify-center cursor-pointer whitespace-nowrap ${
                  audioMuted ? 'border-rose-400/40 text-rose-200' : 'border-white/15'
                }`}
              >
                {audioMuted ? (
                  <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-300" />
                ) : (
                  <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Thu nhỏ màn hình' : 'Phóng toàn màn hình'}
              className="bg-slate-950/80 border border-white/15 hover:bg-slate-800/90 active:scale-95 text-white px-1.5 py-1 sm:px-2 sm:py-1 rounded-lg text-[10px] font-medium shadow-md transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-300" />
              ) : (
                <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-300" />
              )}
              <span className="sm:hidden">{isFullscreen ? 'Thu' : 'Full'}</span>
            </button>

            <button
              type="button"
              onClick={onPause}
              className="bg-slate-950/80 border border-white/15 hover:bg-slate-800/90 active:scale-95 text-white px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-medium shadow-md transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300" />
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
