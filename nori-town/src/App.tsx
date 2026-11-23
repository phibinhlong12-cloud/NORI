import { useCallback, useEffect, useRef, useState } from 'react';
import { BackpackHud } from './components/BackpackHud';
import { BossHealthBar } from './components/BossHealthBar';
import { HudOverlay } from './components/HudOverlay';
import { MobileControls } from './components/MobileControls';
import { MoneyTracker } from './components/MoneyTracker';
import { PauseMenu } from './components/PauseMenu';
import { PlayerStatusBars } from './components/PlayerStatusBars';
import { VoxelEngine } from './game/engine';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [engineInstance, setEngineInstance] = useState<VoxelEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [renderDistance, setRenderDistance] = useState(4);
  const [sensitivity, setSensitivity] = useState(5);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string>('');

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new VoxelEngine(mountEl, {
      onPlayingChange: (playing, started) => {
        setIsPlaying(playing);
        setHasStarted(started);
      },
      onSlotChange: () => {},
      onToast: showToast,
      onWebGLError: setWebglError,
    });

    engineRef.current = engine;
    setEngineInstance(engine);

    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      engine.dispose();
      engineRef.current = null;
      setEngineInstance(null);
    };
  }, [showToast]);

  const handlePlay = useCallback(() => {
    engineRef.current?.enterGame();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleRenderDistanceChange = useCallback((value: number) => {
    setRenderDistance(value);
    engineRef.current?.setRenderDistance(value);
  }, []);

  const handleSensitivityChange = useCallback((value: number) => {
    setSensitivity(value);
    engineRef.current?.setSensitivity(value);
  }, []);

  const handleVirtualKey = useCallback((code: string, pressed: boolean) => {
    engineRef.current?.setVirtualKey(code, pressed);
  }, []);

  const handleBreak = useCallback(() => {
    engineRef.current?.breakTargetBlock();
  }, []);

  const handlePlace = useCallback(() => {
    engineRef.current?.placeTargetBlock();
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#82b6ff]">
      <div ref={canvasMountRef} className="w-full h-full" />

      <HudOverlay
        engine={engineInstance}
        isPlaying={isPlaying}
        onPause={handlePause}
        leftSlot={
          <>
            <MoneyTracker engine={engineInstance} />
            <BackpackHud engine={engineInstance} />
          </>
        }
      />

      <BossHealthBar engine={engineInstance} />

      <PlayerStatusBars engine={engineInstance} />

      <MobileControls
        onVirtualKey={handleVirtualKey}
        onBreak={handleBreak}
        onPlace={handlePlace}
      />

      <PauseMenu
        visible={!isPlaying}
        hasStarted={hasStarted}
        renderDistance={renderDistance}
        sensitivity={sensitivity}
        onRenderDistanceChange={handleRenderDistanceChange}
        onSensitivityChange={handleSensitivityChange}
        onPlay={handlePlay}
      />

      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-slate-950/90 border border-white/15 text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-lg shadow-xl pointer-events-none whitespace-nowrap">
          {toastMessage}
        </div>
      )}

      {webglError && (
        <div className="fixed inset-x-4 bottom-28 z-50 mx-auto max-w-md bg-rose-950/95 border border-rose-400/30 text-rose-100 text-xs sm:text-sm px-4 py-3 rounded-xl text-center shadow-xl">
          {webglError}
        </div>
      )}
    </div>
  );
}
