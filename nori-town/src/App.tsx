import { useCallback, useEffect, useRef, useState } from 'react';
import { BackpackHud } from './components/BackpackHud';
import { BossHealthBar } from './components/BossHealthBar';
import { CharacterModal } from './components/CharacterModal';
import { EssentialShopModal } from './components/EssentialShopModal';
import { GenderSelectModal } from './components/GenderSelectModal';
import { HudOverlay } from './components/HudOverlay';
import { MobileControls } from './components/MobileControls';
import { MoneyTracker } from './components/MoneyTracker';
import { PauseMenu } from './components/PauseMenu';
import { PlayerStatusBars } from './components/PlayerStatusBars';
import { VoxelEngine } from './game/engine';
import { CharacterGender } from './game/firstPersonArms';
import {
  isFullscreenActive,
  isStandaloneDisplayMode,
  subscribeFullscreenChange,
  toggleFullscreen,
} from './utils/fullscreen';

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 768
  );
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [engineInstance, setEngineInstance] = useState<VoxelEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [choosingGender, setChoosingGender] = useState(false);
  const [renderDistance, setRenderDistance] = useState(4);
  const [sensitivity, setSensitivity] = useState(5);
  const [touchControlsEnabled, setTouchControlsEnabled] = useState<boolean>(() =>
    detectTouchDevice()
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isFullscreenActive());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string>('');

  const showToast = useCallback((message: string, durationMs = 2200) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return subscribeFullscreenChange(setIsFullscreen);
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
    if (!hasStarted) {
      setChoosingGender(true);
      return;
    }
    engineRef.current?.enterGame();
  }, [hasStarted]);

  const handleSelectGender = useCallback((gender: CharacterGender) => {
    setChoosingGender(false);
    engineRef.current?.setGender(gender);
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

  const handleToggleTouchControls = useCallback(() => {
    setTouchControlsEnabled((prev) => !prev);
  }, []);

  const handleVirtualKey = useCallback((code: string, pressed: boolean) => {
    engineRef.current?.setVirtualKey(code, pressed);
  }, []);

  const handleJoystickMove = useCallback((x: number, y: number) => {
    engineRef.current?.setVirtualJoystick(x, y);
  }, []);

  const handlePlace = useCallback(() => {
    engineRef.current?.placeTargetBlock();
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (isStandaloneDisplayMode()) {
      showToast('Bạn đang ở chế độ toàn màn hình rồi!');
      return;
    }
    const result = await toggleFullscreen();
    setIsFullscreen(result.active);
    if (!result.supported) {
      const isIos =
        typeof navigator !== 'undefined' &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
      if (isIos) {
        showToast(
          'iPhone/iPad: Bấm nút Chia sẻ → "Thêm vào MH chính" (hoặc aA → Ẩn thanh công cụ) để chơi full màn hình!',
          4200,
        );
      } else {
        showToast(
          'Không phóng full được trong khung xem trước. Hãy mở link trực tiếp bằng Chrome hoặc Thêm vào màn hình chính!',
          3800,
        );
      }
    }
  }, [showToast]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#82b6ff]">
      <div ref={canvasMountRef} className="w-full h-full" />

      <HudOverlay
        engine={engineInstance}
        isPlaying={isPlaying}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onPause={handlePause}
        moneySlot={<MoneyTracker engine={engineInstance} />}
        leftSlot={
          <BackpackHud
            engine={engineInstance}
            touchMode={touchControlsEnabled}
          />
        }
      />

      <BossHealthBar engine={engineInstance} />

      <PlayerStatusBars
        engine={engineInstance}
        touchMode={touchControlsEnabled}
      />

      <MobileControls
        visible={isPlaying && touchControlsEnabled}
        engine={engineInstance}
        onVirtualKey={handleVirtualKey}
        onJoystickMove={handleJoystickMove}
        onPlace={handlePlace}
      />

      <EssentialShopModal engine={engineInstance} />
      <CharacterModal engine={engineInstance} />

      <GenderSelectModal
        visible={!isPlaying && !hasStarted && choosingGender}
        onSelectGender={handleSelectGender}
        onBack={() => setChoosingGender(false)}
      />

      <PauseMenu
        visible={!isPlaying && !choosingGender}
        hasStarted={hasStarted}
        renderDistance={renderDistance}
        sensitivity={sensitivity}
        touchControlsEnabled={touchControlsEnabled}
        isFullscreen={isFullscreen}
        onRenderDistanceChange={handleRenderDistanceChange}
        onSensitivityChange={handleSensitivityChange}
        onToggleTouchControls={handleToggleTouchControls}
        onToggleFullscreen={handleToggleFullscreen}
        onPlay={handlePlay}
      />

      {toastMessage && (
        <div className="fixed top-24 sm:top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-950/90 border border-white/15 text-white text-xs sm:text-sm font-medium px-3.5 sm:px-4 py-2 rounded-lg shadow-xl pointer-events-none max-w-[92vw] text-center whitespace-normal sm:whitespace-nowrap">
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
