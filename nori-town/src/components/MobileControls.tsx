import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Backpack, FlaskConical, Shield, Sword, TreePine, User, Zap } from 'lucide-react';
import { HudStats, VoxelEngine } from '../game/engine';
import { BACKPACK_CAPACITY } from '../game/trees';

interface MobileControlsProps {
  visible: boolean;
  engine: VoxelEngine | null;
  onVirtualKey: (code: string, pressed: boolean) => void;
  onJoystickMove: (x: number, y: number) => void;
  onPlace: () => void;
}

interface MobileHudState {
  hasBackpack: boolean;
  hasKatana: boolean;
  hasIceKatana: boolean;
  hasShield: boolean;
  backpackOpen: boolean;
  shopOpen: boolean;
  characterWindowOpen: boolean;
  holdingKatana: boolean;
  holdingPotionSlot: number | null;
  holdingPotionCount: number;
  shieldRaised: boolean;
  carryingLog: boolean;
  isShopTarget: boolean;
  isConveyorTarget: boolean;
  backpackUsed: number;
}

const INITIAL_MOBILE_HUD: MobileHudState = {
  hasBackpack: false,
  hasKatana: false,
  hasIceKatana: false,
  hasShield: false,
  backpackOpen: false,
  shopOpen: false,
  characterWindowOpen: false,
  holdingKatana: false,
  holdingPotionSlot: null,
  holdingPotionCount: 0,
  shieldRaised: false,
  carryingLog: false,
  isShopTarget: false,
  isConveyorTarget: false,
  backpackUsed: 0,
};

const JOYSTICK_DEADZONE = 0.12;

export const MobileControls = memo(function MobileControls({
  visible,
  engine,
  onVirtualKey,
  onJoystickMove,
  onPlace,
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
      const maxRadius = Math.max(24, rect.width * 0.36);

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
          prev.hasIceKatana === stats.hasIceKatana &&
          prev.hasShield === stats.hasShield &&
          prev.backpackOpen === stats.backpackOpen &&
          prev.shopOpen === stats.shopOpen &&
          prev.characterWindowOpen === stats.characterWindowOpen &&
          prev.holdingKatana === stats.holdingKatana &&
          prev.holdingPotionSlot === stats.holdingPotionSlot &&
          prev.holdingPotionCount === stats.holdingPotionCount &&
          prev.shieldRaised === stats.shieldRaised &&
          prev.carryingLog === stats.carryingLog &&
          prev.isShopTarget === stats.isShopTarget &&
          prev.isConveyorTarget === stats.isConveyorTarget &&
          prev.backpackUsed === used
        ) {
          return prev;
        }
        return {
          hasBackpack: stats.hasBackpack,
          hasKatana: stats.hasKatana,
          hasIceKatana: stats.hasIceKatana,
          hasShield: stats.hasShield,
          backpackOpen: stats.backpackOpen,
          shopOpen: stats.shopOpen,
          characterWindowOpen: stats.characterWindowOpen,
          holdingKatana: stats.holdingKatana,
          holdingPotionSlot: stats.holdingPotionSlot,
          holdingPotionCount: stats.holdingPotionCount,
          shieldRaised: stats.shieldRaised,
          carryingLog: stats.carryingLog,
          isShopTarget: stats.isShopTarget,
          isConveyorTarget: stats.isConveyorTarget,
          backpackUsed: used,
        };
      });
    });
  }, [engine]);

  useEffect(() => {
    if (!visible || hud.shopOpen || hud.characterWindowOpen) {
      if (sprinting) {
        setSprinting(false);
        onVirtualKey('ShiftLeft', false);
      }
      resetJoystick();
    }
  }, [visible, hud.shopOpen, hud.characterWindowOpen, sprinting, onVirtualKey, resetJoystick]);

  useEffect(() => {
    return () => {
      onVirtualKey('ShiftLeft', false);
      onJoystickMove(0, 0);
    };
  }, [onVirtualKey, onJoystickMove]);

  if (!visible || hud.shopOpen || hud.characterWindowOpen) return null;

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
  const placeLabel =
    holdingPotion && !hud.carryingLog && !hud.isShopTarget
      ? 'Uống (+2)'
      : hud.isConveyorTarget
        ? 'Bán gỗ'
        : hud.carryingLog
          ? 'Đặt gỗ'
          : hud.isShopTarget
            ? 'Mở shop'
            : 'Khiêng / Nhận';

  return (
    <div className="fixed inset-x-0 bottom-3 z-20 px-3 flex justify-between items-end pointer-events-none touch-none select-none">
      {/* Cụm bên trái: Chạy nhanh + Cần gạt tròn 360 độ kiểu Minecraft / Liên Quân */}
      <div className="flex flex-col items-start gap-2 pointer-events-auto">
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
          className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 flex items-center justify-center transition-colors touch-none ${
            joystickActive
              ? 'bg-slate-950/75 border-emerald-400/70 shadow-[0_0_20px_rgba(52,211,153,0.22)]'
              : 'bg-slate-950/55 border-white/25 shadow-lg'
          }`}
        >
          {/* Vòng tròn chỉ hướng bên trong */}
          <div className="absolute inset-3 rounded-full border border-white/10 pointer-events-none" />
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/25 pointer-events-none" />
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/25 pointer-events-none" />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/25 pointer-events-none" />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/25 pointer-events-none" />

          {/* Núm tâm kéo mọi hướng */}
          <div
            ref={joyKnobRef}
            className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full border-2 flex items-center justify-center pointer-events-none will-change-transform ${
              joystickActive
                ? 'bg-emerald-400/90 border-white shadow-[0_0_14px_rgba(52,211,153,0.65)]'
                : 'bg-white/25 border-white/60 shadow-md'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full ${
                joystickActive ? 'bg-slate-950/70' : 'bg-white/60'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Cụm bên phải: Hàng trang bị nhanh + Nhân vật + Hành động chính & Nhảy */}
      <div className="flex flex-col gap-2 items-end pointer-events-auto">
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
              <>
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
                    {hud.backpackUsed}/{BACKPACK_CAPACITY}
                  </span>
                </button>
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
                  <span>{hud.carryingLog ? 'Cất' : 'Gỗ'}</span>
                </button>
              </>
            )}

            {hud.hasKatana && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engine?.toggleKatana();
                }}
                className={`h-9 px-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 active:scale-95 transition ${
                  hud.hasIceKatana
                    ? hud.holdingKatana
                      ? 'bg-cyan-400/90 border-cyan-200 text-slate-950'
                      : 'bg-sky-950/85 border-cyan-400/50 text-cyan-200'
                    : hud.holdingKatana
                      ? 'bg-sky-500/90 border-sky-300 text-slate-950'
                      : 'bg-slate-950/80 border-white/20 text-slate-200'
                }`}
              >
                <Sword className="w-3.5 h-3.5" />
                <span>{hud.hasIceKatana ? 'Băng' : 'Kiếm'}</span>
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
        </div>

        <div className="flex items-end gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlace();
            }}
            className={`h-12 px-3.5 rounded-xl border font-bold text-xs active:scale-95 transition flex items-center gap-1 ${
              holdingPotion && !hud.carryingLog && !hud.isShopTarget
                ? 'bg-rose-950/90 border-rose-400 text-rose-200 active:bg-rose-500/40'
                : 'bg-slate-950/80 border-emerald-400/40 text-emerald-300 active:bg-emerald-500/35'
            }`}
          >
            {holdingPotion && !hud.carryingLog && !hud.isShopTarget && (
              <FlaskConical className="w-3.5 h-3.5 text-rose-300 shrink-0" />
            )}
            <span>{placeLabel}</span>
          </button>

          <button
            type="button"
            {...bindKeyProps('Space')}
            className="w-16 h-12 bg-slate-950/80 border border-amber-400/45 rounded-xl text-amber-300 font-bold text-xs flex items-center justify-center active:bg-amber-400/30 active:scale-95 transition"
          >
            NHẢY
          </button>
        </div>
      </div>
    </div>
  );
});
