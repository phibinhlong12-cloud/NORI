import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Backpack, Coins, FlaskConical, Shield, Sword, TreePine, User, Zap } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';
import { BACKPACK_CAPACITY, BackpackKatanaVariant } from '../game/trees';

interface MobileControlsProps {
  visible: boolean;
  engine: VoxelEngine | null;
  onVirtualKey: (code: string, pressed: boolean) => void;
  onJoystickMove: (x: number, y: number) => void;
}

interface MobileHudState {
  hasBackpack: boolean;
  hasKatana: boolean;
  equippedKatana: BackpackKatanaVariant | null;
  hasShield: boolean;
  backpackOpen: boolean;
  shopOpen: boolean;
  outfitShopOpen: boolean;
  craftingOpen: boolean;
  characterWindowOpen: boolean;
  holdingKatana: boolean;
  holdingPotionSlot: number | null;
  holdingPotionCount: number;
  shieldRaised: boolean;
  carryingLog: boolean;
  inSellZone: boolean;
  carriedLogValue: number;
  isShopTarget: boolean;
  isConveyorTarget: boolean;
  backpackUsed: number;
  inCastle: boolean;
  recallActive: boolean;
  recallProgress: number;
  hasRecallReturnPoint: boolean;
}

const INITIAL_MOBILE_HUD: MobileHudState = {
  hasBackpack: false,
  hasKatana: false,
  equippedKatana: null,
  hasShield: false,
  backpackOpen: false,
  shopOpen: false,
  outfitShopOpen: false,
  craftingOpen: false,
  characterWindowOpen: false,
  holdingKatana: false,
  holdingPotionSlot: null,
  holdingPotionCount: 0,
  shieldRaised: false,
  carryingLog: false,
  inSellZone: false,
  carriedLogValue: 0,
  isShopTarget: false,
  isConveyorTarget: false,
  backpackUsed: 0,
  inCastle: true,
  recallActive: false,
  recallProgress: 0,
  hasRecallReturnPoint: false,
};

const JOYSTICK_DEADZONE = 0.12;

export const MobileControls = memo(function MobileControls({
  visible,
  engine,
  onVirtualKey,
  onJoystickMove,
}: MobileControlsProps) {
  const [hud, setHud] = useState<MobileHudState>(INITIAL_MOBILE_HUD);
  const [sprinting, setSprinting] = useState(false);
  const [joystickActive, setJoystickActive] = useState(false);

  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);

  const resetJoystick = useCallback(() => {
    joyPointerIdRef.current = null;
    setJoystickActive(false);
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
    onJoystickMove(0, 0);
  }, [onJoystickMove]);

  const updateJoystickFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const baseEl = joyBaseRef.current;
      if (!baseEl) return;
      const rect = baseEl.getBoundingClientRect();
      const centerX = rect.left + rect.width * 0.5;
      const centerY = rect.top + rect.height * 0.5;
      const maxRadius = Math.max(20, rect.width * 0.36);

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, maxRadius);

      const angle = dist > 0.0001 ? Math.atan2(dy, dx) : 0;
      const knobX = dist > 0.0001 ? Math.cos(angle) * clampedDist : 0;
      const knobY = dist > 0.0001 ? Math.sin(angle) * clampedDist : 0;

      if (joyKnobRef.current) {
        joyKnobRef.current.style.transform = `translate3d(${knobX.toFixed(1)}px, ${knobY.toFixed(1)}px, 0px)`;
      }

      const normMag = clampedDist / maxRadius;
      if (normMag < JOYSTICK_DEADZONE) {
        onJoystickMove(0, 0);
        return;
      }

      const scaledMag = (normMag - JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE);
      const nx = Math.cos(angle) * scaledMag;
      const ny = -Math.sin(angle) * scaledMag;
      onJoystickMove(nx, ny);
    },
    [onJoystickMove],
  );

  useEffect(() => {
    if (!engine) {
      setHud(INITIAL_MOBILE_HUD);
      return;
    }

    return engine.subscribeStats((stats: HudStats) => {
      const used = stats.backpackItems.reduce((acc, item) => (item ? acc + 1 : acc), 0);
      setHud((prev) => {
        if (
          prev.hasBackpack === stats.hasBackpack &&
          prev.hasKatana === stats.hasKatana &&
          prev.equippedKatana === stats.equippedKatana &&
          prev.hasShield === stats.hasShield &&
          prev.backpackOpen === stats.backpackOpen &&
          prev.shopOpen === stats.shopOpen &&
          prev.outfitShopOpen === stats.outfitShopOpen &&
          prev.craftingOpen === stats.craftingOpen &&
          prev.characterWindowOpen === stats.characterWindowOpen &&
          prev.holdingKatana === stats.holdingKatana &&
          prev.holdingPotionSlot === stats.holdingPotionSlot &&
          prev.holdingPotionCount === stats.holdingPotionCount &&
          prev.shieldRaised === stats.shieldRaised &&
          prev.carryingLog === stats.carryingLog &&
          prev.inSellZone === stats.inSellZone &&
          prev.carriedLogValue === stats.carriedLogValue &&
          prev.isShopTarget === stats.isShopTarget &&
          prev.isConveyorTarget === stats.isConveyorTarget &&
          prev.backpackUsed === used &&
          prev.inCastle === stats.inCastle &&
          prev.recallActive === stats.recallActive &&
          Math.abs(prev.recallProgress - stats.recallProgress) < 0.01 &&
          prev.hasRecallReturnPoint === stats.hasRecallReturnPoint
        ) {
          return prev;
        }
        return {
          hasBackpack: stats.hasBackpack,
          hasKatana: stats.hasKatana,
          equippedKatana: stats.equippedKatana,
          hasShield: stats.hasShield,
          backpackOpen: stats.backpackOpen,
          shopOpen: stats.shopOpen,
          outfitShopOpen: stats.outfitShopOpen,
          craftingOpen: stats.craftingOpen,
          characterWindowOpen: stats.characterWindowOpen,
          holdingKatana: stats.holdingKatana,
          holdingPotionSlot: stats.holdingPotionSlot,
          holdingPotionCount: stats.holdingPotionCount,
          shieldRaised: stats.shieldRaised,
          carryingLog: stats.carryingLog,
          inSellZone: stats.inSellZone,
          carriedLogValue: stats.carriedLogValue,
          isShopTarget: stats.isShopTarget,
          isConveyorTarget: stats.isConveyorTarget,
          backpackUsed: used,
          inCastle: stats.inCastle,
          recallActive: stats.recallActive,
          recallProgress: stats.recallProgress,
          hasRecallReturnPoint: stats.hasRecallReturnPoint,
        };
      });
    });
  }, [engine]);

  useEffect(() => {
    if (!visible || hud.shopOpen || hud.outfitShopOpen || hud.craftingOpen || hud.characterWindowOpen) {
      if (sprinting) {
        setSprinting(false);
        onVirtualKey('ShiftLeft', false);
      }
      resetJoystick();
    }
  }, [
    visible,
    hud.shopOpen,
    hud.outfitShopOpen,
    hud.craftingOpen,
    hud.characterWindowOpen,
    sprinting,
    onVirtualKey,
    resetJoystick,
  ]);

  useEffect(() => {
    return () => {
      onVirtualKey('ShiftLeft', false);
      onJoystickMove(0, 0);
    };
  }, [onVirtualKey, onJoystickMove]);

  if (!visible || hud.shopOpen || hud.outfitShopOpen || hud.craftingOpen || hud.characterWindowOpen) return null;

  const bindKeyProps = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onVirtualKey(code, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onVirtualKey(code, false);
    },
    onPointerCancel: () => onVirtualKey(code, false),
    onPointerLeave: () => onVirtualKey(code, false),
  });

  const toggleSprint = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !sprinting;
    setSprinting(next);
    onVirtualKey('ShiftLeft', next);
  };

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (joyPointerIdRef.current !== null) return;
    joyPointerIdRef.current = e.pointerId;
    setJoystickActive(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Bỏ qua nếu trình duyệt không hỗ trợ capture
    }
    updateJoystickFromClient(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateJoystickFromClient(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Bỏ qua nếu đã nhả capture
    }
    resetJoystick();
  };

  const holdingPotion = hud.holdingPotionSlot !== null && hud.holdingPotionCount > 0;
  const recallDisabledInCastle = hud.inCastle && !hud.hasRecallReturnPoint;
  const recallReturnReady = hud.inCastle && hud.hasRecallReturnPoint;
  const recallRemainingSec = Math.max(0, (1 - hud.recallProgress) * 3).toFixed(1);
  const recallRingRadius = 26;
  const recallRingCircumference = 2 * Math.PI * recallRingRadius;
  const recallStrokeOffset =
    recallRingCircumference * (1 - Math.min(1, Math.max(0, hud.recallProgress)));

  return (
    <div className="fixed inset-x-0 bottom-3 z-20 px-3 flex justify-between items-end pointer-events-none touch-none select-none">
      {/* Cụm bên trái: Chạy nhanh + Cần gạt tròn 360 độ + Nút Biến về tròn bên cạnh */}
      <div className="flex items-end gap-2.5 pointer-events-auto">
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onPointerDown={toggleSprint}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition active:scale-95 ${
              sprinting
                ? 'bg-emerald-500/90 border-emerald-300 text-slate-950 shadow-lg'
                : 'bg-slate-950/75 border-white/20 text-slate-200'
            }`}
            aria-pressed={sprinting}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{sprinting ? 'Đang chạy' : 'Chạy nhanh'}</span>
          </button>

          <div
            ref={joyBaseRef}
            role="slider"
            aria-label="Cần điều khiển di chuyển 360 độ"
            aria-valuetext="Di chuyển"
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickPointerMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerUp}
            onLostPointerCapture={resetJoystick}
            className={`relative w-[126px] h-[126px] sm:w-36 sm:h-36 rounded-full border-2 flex items-center justify-center transition-colors touch-none ${
              joystickActive
                ? 'bg-slate-950/75 border-emerald-400/70 shadow-[0_0_24px_rgba(52,211,153,0.25)]'
                : 'bg-slate-950/55 border-white/25 shadow-lg'
            }`}
          >
            {/* Vòng tròn chỉ hướng bên trong */}
            <div className="absolute inset-[13px] rounded-full border border-white/10 pointer-events-none" />
            <span className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/25 pointer-events-none" />
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/25 pointer-events-none" />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/25 pointer-events-none" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/25 pointer-events-none" />

            {/* Núm tâm kéo mọi hướng */}
            <div
              ref={joyKnobRef}
              className={`w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] rounded-full border-2 flex items-center justify-center pointer-events-none will-change-transform ${
                joystickActive
                  ? 'bg-emerald-400/90 border-white shadow-[0_0_16px_rgba(52,211,153,0.65)]'
                  : 'bg-white/25 border-white/60 shadow-md'
              }`}
            >
              <div
                className={`w-[18px] h-[18px] rounded-full ${
                  joystickActive ? 'bg-slate-950/70' : 'bg-white/60'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Nút Biến về / Trở lại hình tròn ngay cạnh cần điều khiển */}
        <div className="flex flex-col items-center gap-1 pb-1">
          <button
            type="button"
            aria-label={
              recallReturnReady
                ? 'Biến trở lại vị trí trước khi biến về'
                : recallDisabledInCastle
                  ? 'Đang ở trong tòa thành, không thể biến về'
                  : 'Biến về vị trí ban đầu'
            }
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              engine?.triggerRecallAction();
            }}
            className={`relative w-14 h-14 rounded-full p-[2.5px] transition active:scale-95 flex items-center justify-center ${
              hud.recallActive
                ? 'bg-gradient-to-tr from-cyan-400 via-amber-300 to-violet-400 shadow-[0_0_20px_rgba(56,189,248,0.75)]'
                : recallReturnReady
                  ? 'bg-gradient-to-tr from-amber-400 via-fuchsia-500 to-cyan-400 shadow-[0_0_18px_rgba(244,114,182,0.65)]'
                  : recallDisabledInCastle
                    ? 'bg-slate-700/70 opacity-50 grayscale'
                    : 'bg-gradient-to-tr from-sky-400 via-indigo-400 to-amber-300 shadow-[0_0_14px_rgba(56,189,248,0.45)]'
            }`}
          >
            <span className="w-full h-full rounded-full overflow-hidden bg-slate-950 flex items-center justify-center">
              <img
                src="/assets/aistudio/image_c493d6fb.png"
                alt="Biến về"
                draggable={false}
                className={`w-full h-full object-cover scale-[1.16] pointer-events-none select-none ${
                  hud.recallActive ? 'animate-spin' : ''
                }`}
                style={hud.recallActive ? { animationDuration: '2.4s' } : undefined}
              />
            </span>

            {hud.recallActive && (
              <svg
                viewBox="0 0 60 60"
                className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                aria-hidden="true"
              >
                <circle
                  cx="30"
                  cy="30"
                  r={recallRingRadius}
                  fill="none"
                  stroke="rgba(15, 23, 42, 0.55)"
                  strokeWidth="3.5"
                />
                <circle
                  cx="30"
                  cy="30"
                  r={recallRingRadius}
                  fill="none"
                  stroke="#fde047"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={recallRingCircumference}
                  strokeDashoffset={recallStrokeOffset}
                />
              </svg>
            )}
          </button>

          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none whitespace-nowrap shadow ${
              hud.recallActive
                ? recallReturnReady
                  ? 'bg-fuchsia-950/90 border border-fuchsia-300/60 text-fuchsia-200 font-mono-tech'
                  : 'bg-cyan-950/90 border border-cyan-300/60 text-cyan-200 font-mono-tech'
                : recallReturnReady
                  ? 'bg-fuchsia-950/90 border border-fuchsia-300/60 text-fuchsia-200'
                  : recallDisabledInCastle
                    ? 'bg-slate-950/75 border border-white/10 text-slate-400'
                    : 'bg-slate-950/85 border border-sky-400/35 text-sky-200'
            }`}
          >
            {hud.recallActive
              ? `${recallRemainingSec}s`
              : recallReturnReady
                ? 'Trở lại'
                : recallDisabledInCastle
                  ? 'Trong thành'
                  : 'Biến về'}
          </span>
        </div>
      </div>

      {/* Cụm bên phải: Dòng 1 (Nhân vật & Ba lô) -> Dòng 2 (Hành động) -> Dòng 3 (Nút Nhảy tròn) */}
      <div className="flex flex-col gap-2 items-end pointer-events-auto">
        {/* Dòng 1: Nhân vật & Ba lô */}
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              engine?.toggleCharacterWindow();
            }}
            className="h-9 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 active:scale-95 transition bg-slate-950/80 border-cyan-400/35 text-cyan-200"
          >
            <User className="w-3.5 h-3.5" />
            <span>Nhân vật</span>
          </button>

          {hud.hasBackpack && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                engine?.toggleBackpack();
              }}
              className={`h-9 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 active:scale-95 transition ${
                hud.backpackOpen
                  ? 'bg-amber-500/90 border-amber-300 text-slate-950'
                  : 'bg-slate-950/80 border-amber-400/35 text-amber-200'
              }`}
            >
              <Backpack className="w-3.5 h-3.5" />
              <span>
                Ba lô {hud.backpackUsed}/{BACKPACK_CAPACITY}
              </span>
            </button>
          )}
        </div>

        {/* Dòng 2: Các nút hành động (Kiếm, Khiên, Hồi máu, Cất/Lấy gỗ, Bán đồ) */}
        {(hud.hasKatana ||
          hud.hasShield ||
          (holdingPotion && !hud.carryingLog) ||
          hud.hasBackpack ||
          hud.inSellZone) && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {hud.hasKatana && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engine?.toggleKatana();
                }}
                className={`h-9 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 active:scale-95 transition ${
                  hud.equippedKatana === 'leaf'
                    ? hud.holdingKatana
                      ? 'bg-emerald-400/90 border-emerald-200 text-slate-950'
                      : 'bg-emerald-950/85 border-emerald-400/50 text-emerald-200'
                    : hud.equippedKatana === 'ice'
                      ? hud.holdingKatana
                        ? 'bg-cyan-400/90 border-cyan-200 text-slate-950'
                        : 'bg-sky-950/85 border-cyan-400/50 text-cyan-200'
                      : hud.holdingKatana
                        ? 'bg-sky-500/90 border-sky-300 text-slate-950'
                        : 'bg-slate-950/80 border-white/20 text-slate-200'
                }`}
              >
                <Sword className="w-3.5 h-3.5" />
                <span>
                  {hud.equippedKatana === 'leaf'
                    ? 'Lá'
                    : hud.equippedKatana === 'ice'
                      ? 'Băng'
                      : 'Kiếm'}
                </span>
              </button>
            )}

            {hud.hasShield && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engine?.toggleShield();
                }}
                className={`h-9 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 active:scale-95 transition ${
                  hud.shieldRaised
                    ? 'bg-amber-400/90 border-amber-200 text-slate-950'
                    : 'bg-slate-950/80 border-white/20 text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Khiên</span>
              </button>
            )}

            {holdingPotion && !hud.carryingLog && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engine?.drinkHeldPotion();
                }}
                className="h-9 px-2.5 rounded-xl border text-[11px] font-bold active:scale-95 transition flex items-center gap-1 bg-rose-950/90 border-rose-400 text-rose-200 active:bg-rose-500/40"
              >
                <FlaskConical className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                <span>Hồi máu</span>
              </button>
            )}

            {hud.hasBackpack && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engine?.interactBackpackWood();
                }}
                className={`h-9 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 active:scale-95 transition ${
                  hud.carryingLog
                    ? 'bg-emerald-500/85 border-emerald-300 text-slate-950'
                    : 'bg-slate-950/80 border-white/20 text-amber-200'
                }`}
              >
                <TreePine className="w-3.5 h-3.5" />
                <span>{hud.carryingLog ? 'Cất gỗ' : 'Lấy gỗ'}</span>
              </button>
            )}

            {hud.inSellZone && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engine?.sellCarriedLog();
                }}
                className={`h-9 px-2.5 rounded-xl border font-bold text-[11px] active:scale-95 transition flex items-center gap-1 shadow-lg ${
                  hud.carryingLog
                    ? 'bg-emerald-500/95 border-emerald-200 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.45)]'
                    : 'bg-slate-950/85 border-emerald-400/45 text-emerald-200'
                }`}
              >
                <Coins className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {hud.carryingLog && hud.carriedLogValue > 0
                    ? `Bán (${hud.carriedLogValue.toLocaleString('vi-VN')}đ)`
                    : 'Bán đồ'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Dòng 3: Nút Nhảy hình tròn chỉ hiển thị icon */}
        <button
          type="button"
          aria-label="Nhảy"
          {...bindKeyProps('Space')}
          className="relative w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-sky-400 via-violet-500 to-fuchsia-400 shadow-[0_0_16px_rgba(192,132,252,0.45)] active:scale-95 transition flex items-center justify-center"
        >
          <span className="w-full h-full rounded-full bg-slate-900/85 flex items-center justify-center">
            <svg
              viewBox="0 0 64 64"
              className="w-9 h-9 text-slate-100"
              fill="currentColor"
              aria-hidden="true"
            >
              {/* Đầu */}
              <circle cx="23.5" cy="16" r="4.5" />
              {/* Thân & tư thế nhảy bật trên không */}
              <path d="M22.8 21.8c2.6-.9 5.5.2 7.6 1.9l9.2 1.7c1.2.2 2 1.3 1.8 2.5-.2 1.1-1.2 1.8-2.3 1.7l-7.2-.9 2.9 6.6 5 8.1c.7 1.1.3 2.5-.8 3.2-1 .6-2.3.3-3-.6l-5.7-7.7-4.5 2.4 3.4 6.5c.6 1.1.2 2.4-.9 3-1 .6-2.3.2-2.9-.8l-4.8-8.3c-.7-1.2-.3-2.7.9-3.4l5.4-3.1-3.1-5.6-3.7 3.7c-.9.9-2.4.9-3.2 0-.8-.8-.8-2.2 0-3l5.5-5.8c.9-.9 2.2-2.7 3.4-3.1z" />
              {/* Thanh kiếm gọn sau tay */}
              <path d="M44.2 16.5l2.5.8-3.8 18.2-2.2-.5 3.5-18.5z" opacity="0.92" />
              <rect x="40.3" y="25.2" width="6.2" height="1.8" rx="0.8" transform="rotate(14 43.4 26.1)" opacity="0.92" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
});
