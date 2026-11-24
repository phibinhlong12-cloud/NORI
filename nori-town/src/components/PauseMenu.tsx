import {
  CSSProperties,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { BookOpen, ChevronDown, Maximize2, Minimize2, Smartphone } from 'lucide-react';

interface PauseMenuProps {
  visible: boolean;
  hasStarted: boolean;
  renderDistance: number;
  sensitivity: number;
  touchControlsEnabled: boolean;
  isFullscreen: boolean;
  onRenderDistanceChange: (value: number) => void;
  onSensitivityChange: (value: number) => void;
  onToggleTouchControls: () => void;
  onToggleFullscreen: () => void;
  onPlay: () => void;
}

type ElementThemeKey = 'lightning' | 'fire' | 'sakura' | 'rainbow';

interface ElementThemeConfig {
  label: string;
  name: string;
  kanji: string;
  primary: string;
  secondary: string;
  accent: string;
  bgGlow: string;
  bgGlow2: string;
  particles: string[];
  power: string;
  rainbow: boolean;
  dotClass: string;
}

const ELEMENT_THEMES: Record<ElementThemeKey, ElementThemeConfig> = {
  lightning: {
    label: 'HỆ LÔI',
    name: 'RAI-JIN // LÔI THẦN KIẾM',
    kanji: '雷',
    primary: '#ff007f',
    secondary: '#00f3ff',
    accent: '#b829ff',
    bgGlow: 'rgba(184, 41, 255, 0.38)',
    bgGlow2: 'rgba(0, 243, 255, 0.32)',
    particles: ['#00f3ff', '#ff007f', '#b829ff', '#ffffff'],
    power: '94%',
    rainbow: false,
    dotClass: 'bg-cyan-400 shadow-[0_0_8px_#00f3ff]',
  },
  fire: {
    label: 'HỆ HỎA',
    name: 'KAGU-TSUCHI // HỎA NGỤC ĐAO',
    kanji: '炎',
    primary: '#ff2a00',
    secondary: '#ffae00',
    accent: '#ffe600',
    bgGlow: 'rgba(255, 42, 0, 0.42)',
    bgGlow2: 'rgba(255, 174, 0, 0.32)',
    particles: ['#ff2a00', '#ffae00', '#ffe600', '#ff7700'],
    power: '98%',
    rainbow: false,
    dotClass: 'bg-orange-500 shadow-[0_0_8px_#ff5500]',
  },
  sakura: {
    label: 'ANH ĐÀO',
    name: 'SENBON-ZAKURA // THIÊN ANH ĐÀO',
    kanji: '桜',
    primary: '#ff4da6',
    secondary: '#ffd1eb',
    accent: '#ff0066',
    bgGlow: 'rgba(255, 77, 166, 0.42)',
    bgGlow2: 'rgba(255, 209, 235, 0.28)',
    particles: ['#ff4da6', '#ff99cc', '#ffffff', '#ff1a8c'],
    power: '90%',
    rainbow: false,
    dotClass: 'bg-pink-400 shadow-[0_0_8px_#ff66b2]',
  },
  rainbow: {
    label: 'CẦU VỒNG RGB',
    name: 'GOKUSAI // CỰC SẮC VÔ CỰC',
    kanji: '極',
    primary: '#ff007f',
    secondary: '#00f3ff',
    accent: '#ffe600',
    bgGlow: 'rgba(255, 0, 127, 0.4)',
    bgGlow2: 'rgba(0, 243, 255, 0.4)',
    particles: ['#ff0055', '#ffaa00', '#00ff88', '#00f3ff', '#aa00ff', '#ffffff'],
    power: '100%',
    rainbow: true,
    dotClass: 'bg-gradient-to-tr from-pink-500 via-yellow-300 to-cyan-400',
  },
};

const THEME_ORDER: ElementThemeKey[] = ['lightning', 'fire', 'sakura', 'rainbow'];

const GUIDE_ITEMS: Array<{ label: string; keys: string }> = [
  { label: 'Di chuyển / Chạy', keys: 'WASD + Shift' },
  { label: 'Nhảy', keys: 'Space' },
  { label: 'Chặt cây (giữ 5s) / Katana (1 click)', keys: 'Chuột Trái' },
  { label: 'Khiêng / Bán / Mua', keys: 'Chuột Phải' },
  { label: 'Mở Balo / Chọn ô', keys: 'E / 1–9' },
  { label: 'Cất / Lấy nhanh (1→9)', keys: 'F' },
  { label: 'Đổi Katana', keys: 'Q' },
  { label: 'Che / Cất Khiên chắn', keys: 'R' },
  { label: 'Mở cửa sổ nhân vật', keys: 'B' },
];

interface Petal {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotSpeed: number;
  flip: number;
  flipSpeed: number;
  colorIndex: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
  color: string;
}

interface SlashArc {
  x: number;
  y: number;
  angle: number;
  length: number;
  life: number;
  color1: string;
  color2: string;
}

function createPetal(w: number, h: number, initial: boolean): Petal {
  return {
    x: Math.random() * w,
    y: initial ? Math.random() * h : -20,
    size: 4 + Math.random() * 6.5,
    speedX: -1.1 - Math.random() * 1.6,
    speedY: 0.9 + Math.random() * 1.9,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.06,
    flip: Math.random() * Math.PI,
    flipSpeed: 0.03 + Math.random() * 0.04,
    colorIndex: Math.floor(Math.random() * 6),
  };
}

export const PauseMenu = memo(function PauseMenu({
  visible,
  hasStarted,
  renderDistance,
  sensitivity,
  touchControlsEnabled,
  isFullscreen,
  onRenderDistanceChange,
  onSensitivityChange,
  onToggleTouchControls,
  onToggleFullscreen,
  onPlay,
}: PauseMenuProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [themeKey, setThemeKey] = useState<ElementThemeKey>('lightning');
  const [soundEnabled, setSoundEnabled] = useState(false);

  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const katanaWrapperRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const themeRef = useRef<ElementThemeConfig>(ELEMENT_THEMES.lightning);
  const soundEnabledRef = useRef(false);

  const particlesRef = useRef<{
    petals: Petal[];
    sparks: Spark[];
    trail: TrailPoint[];
    slashes: SlashArc[];
    width: number;
    height: number;
  }>({
    petals: [],
    sparks: [],
    trail: [],
    slashes: [],
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  themeRef.current = ELEMENT_THEMES[themeKey];
  soundEnabledRef.current = soundEnabled;

  const ensureAudioContext = useCallback((): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        void audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playKatanaSound = useCallback(
    (type: 'slash' | 'draw' = 'slash', forcePlay = false) => {
      if (!soundEnabledRef.current && !forcePlay) return;
      const audioCtx = ensureAudioContext();
      if (!audioCtx) return;

      try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type === 'draw' ? 'triangle' : 'sine';

        const startFreq = type === 'draw' ? 2400 : 1600 + Math.random() * 600;
        const endFreq = type === 'draw' ? 4200 : 320;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.22);

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);

        const bufferSize = Math.floor(audioCtx.sampleRate * 0.18);
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = audioCtx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.18);
        filter.Q.value = 1.8;

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.2, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        whiteNoise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        whiteNoise.start(now);
      } catch {
        // Bỏ qua lỗi autoplay audio
      }
    },
    [ensureAudioContext],
  );

  const spawnSlashAt = useCallback(
    (x: number, y: number) => {
      const theme = themeRef.current;
      const store = particlesRef.current;
      const randomAngle = (Math.random() - 0.5) * Math.PI * 0.85;
      store.slashes.push({
        x,
        y,
        angle: randomAngle,
        length: Math.min(store.width * 0.75, 640),
        life: 1.0,
        color1: theme.primary,
        color2: theme.secondary,
      });

      for (let i = 0; i < 22; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 8.5;
        store.sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 0.026 + Math.random() * 0.032,
          size: 2 + Math.random() * 3.2,
          color: theme.particles[i % theme.particles.length],
        });
      }

      playKatanaSound('slash');
    },
    [playKatanaSound],
  );

  const handleSelectTheme = useCallback(
    (nextKey: ElementThemeKey) => {
      setThemeKey(nextKey);
      themeRef.current = ELEMENT_THEMES[nextKey];
      const store = particlesRef.current;
      spawnSlashAt(store.width * 0.62, store.height * 0.48);
      playKatanaSound('draw');
    },
    [playKatanaSound, spawnSlashAt],
  );

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundEnabledRef.current = next;
      if (next) {
        playKatanaSound('draw', true);
      }
      return next;
    });
  }, [playKatanaSound]);

  useEffect(() => {
    if (!visible) return;
    const canvas = fxCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const store = particlesRef.current;
    const syncSize = () => {
      const w = (canvas.width = window.innerWidth);
      const h = (canvas.height = window.innerHeight);
      store.width = w;
      store.height = h;
    };
    syncSize();

    store.petals = Array.from({ length: 50 }, () => createPetal(store.width, store.height, true));
    store.sparks = [];
    store.trail = [];
    store.slashes = [];

    const introTimer = window.setTimeout(() => {
      spawnSlashAt(store.width * 0.62, store.height * 0.48);
    }, 280);

    const addTrailPoint = (x: number, y: number) => {
      const theme = themeRef.current;
      store.trail.push({ x, y, life: 1.0, color: theme.secondary });
      if (Math.random() < 0.45) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.8 + Math.random() * 5.5;
        store.sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 0.03 + Math.random() * 0.035,
          size: 1.8 + Math.random() * 2.8,
          color: theme.particles[Math.floor(Math.random() * theme.particles.length)],
        });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      addTrailPoint(e.clientX, e.clientY);
      if (katanaWrapperRef.current) {
        const dx = (e.clientX - store.width / 2) / 36;
        const dy = (e.clientY - store.height / 2) / 36;
        katanaWrapperRef.current.style.transform = `translate(${dx}px, ${dy}px) rotate(${-13 + dx * 0.15}deg)`;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        addTrailPoint(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, label, select, [data-no-slash]')) return;
      spawnSlashAt(e.clientX, e.clientY);
    };

    window.addEventListener('resize', syncSize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown);

    let animId = 0;

    const animate = (now: number) => {
      const theme = themeRef.current;
      ctx.clearRect(0, 0, store.width, store.height);

      for (let i = 0; i < store.petals.length; i++) {
        const p = store.petals[i];
        p.x += p.speedX + Math.sin(p.flip) * 0.6;
        p.y += p.speedY;
        p.rotation += p.rotSpeed;
        p.flip += p.flipSpeed;
        if (p.x < -30 || p.y > store.height + 30) {
          store.petals[i] = createPetal(store.width, store.height, false);
        }

        const color = theme.particles[p.colorIndex % theme.particles.length];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(1, Math.abs(Math.cos(p.flip)) * 0.7 + 0.3);
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.bezierCurveTo(p.size, -p.size, p.size, p.size, 0, p.size * 1.3);
        ctx.bezierCurveTo(-p.size, p.size, -p.size, -p.size, 0, -p.size);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.restore();
      }

      if (store.trail.length > 1) {
        for (let i = 1; i < store.trail.length; i++) {
          const p1 = store.trail[i - 1];
          const p2 = store.trail[i];
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = p2.color;
          ctx.lineWidth = p2.life * 7;
          ctx.lineCap = 'round';
          ctx.shadowColor = theme.primary;
          ctx.shadowBlur = 14;
          ctx.globalAlpha = p2.life;
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = p2.life * 2.3;
          ctx.stroke();
          ctx.restore();
        }
      }

      for (let i = store.trail.length - 1; i >= 0; i--) {
        store.trail[i].life -= 0.06;
        if (store.trail[i].life <= 0) store.trail.splice(i, 1);
      }

      for (let i = store.slashes.length - 1; i >= 0; i--) {
        const s = store.slashes[i];
        s.life -= 0.045;
        if (s.life <= 0) {
          store.slashes.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = s.life;

        const halfLen = s.length * (1.2 - s.life * 0.2);
        const thickness = 18 * s.life;

        ctx.shadowColor = s.color1;
        ctx.shadowBlur = 24;
        ctx.fillStyle = s.color2;
        ctx.beginPath();
        ctx.moveTo(-halfLen, 0);
        ctx.quadraticCurveTo(0, -thickness, halfLen, 0);
        ctx.quadraticCurveTo(0, thickness, -halfLen, 0);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-halfLen * 0.9, 0);
        ctx.quadraticCurveTo(0, -thickness * 0.35, halfLen * 0.9, 0);
        ctx.quadraticCurveTo(0, thickness * 0.35, -halfLen * 0.9, 0);
        ctx.fill();
        ctx.restore();
      }

      for (let i = store.sparks.length - 1; i >= 0; i--) {
        const sp = store.sparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vx *= 0.95;
        sp.vy *= 0.95;
        sp.life -= sp.decay;
        if (sp.life <= 0) {
          store.sparks.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, sp.life);
        ctx.fillStyle = sp.color;
        ctx.shadowColor = sp.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = window.requestAnimationFrame(animate);
    };

    animId = window.requestAnimationFrame(animate);

    return () => {
      window.clearTimeout(introTimer);
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', syncSize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [visible, spawnSlashAt]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  if (!visible) return null;

  const activeTheme = ELEMENT_THEMES[themeKey];
  const themeStyle = {
    '--cyber-primary': activeTheme.primary,
    '--cyber-secondary': activeTheme.secondary,
    '--cyber-accent': activeTheme.accent,
    '--cyber-bg-glow': activeTheme.bgGlow,
    '--cyber-bg-glow-2': activeTheme.bgGlow2,
  } as CSSProperties;

  return (
    <div
      style={themeStyle}
      className={`fixed inset-0 z-30 text-white font-rajdhani overflow-hidden select-none ${
        activeTheme.rainbow ? 'rainbow-mode-active' : ''
      }`}
    >
      {/* 1. Lớp phủ cực nhẹ để giữ khung cảnh đồng cỏ 3D sống động phía sau */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-sky-950/25 via-transparent to-emerald-950/35 pointer-events-none" />

      {/* 2. Canvas hiệu ứng hoa anh đào, tia lửa & vệt chém */}
      <canvas
        ref={fxCanvasRef}
        className="fixed inset-0 w-full h-full z-10 pointer-events-none"
      />

      {/* 3. Nội dung UI chính */}
      <div className="relative z-20 w-full h-full overflow-y-auto touch-pan-y flex flex-col justify-between p-4 sm:p-7 lg:p-9 gap-4">
        {/* THANH TRÊN */}
        <header className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="px-3.5 py-2 rounded-full font-cyber text-[11px] sm:text-xs font-bold tracking-wider uppercase border bg-black/65 hover:bg-white/15 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            style={{
              borderColor: isFullscreen ? activeTheme.primary : 'rgba(255,255,255,0.28)',
            }}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" style={{ color: activeTheme.primary }} />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" style={{ color: activeTheme.secondary }} />
            )}
            <span>{isFullscreen ? 'THOÁT FULL' : 'FULL MÀN HÌNH'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleSound}
            className="px-3.5 py-2 rounded-full font-cyber text-[11px] sm:text-xs font-bold tracking-wider uppercase border bg-black/65 hover:bg-white/15 transition-all flex items-center gap-1.5 cursor-pointer"
            style={{
              borderColor: soundEnabled ? activeTheme.secondary : 'rgba(255,255,255,0.25)',
            }}
          >
            <span>{soundEnabled ? '🔊' : '🔇'}</span>
            <span>{soundEnabled ? 'ÂM THANH: BẬT' : 'ÂM THANH: TẮT'}</span>
          </button>
        </header>

        {/* KHU VỰC TRUNG TÂM */}
        <main className="relative flex-1 flex flex-col lg:flex-row items-center justify-between my-auto gap-6 lg:gap-6 max-w-7xl w-full mx-auto">
          {/* CỘT TRÁI: TIÊU ĐỀ & CÁC NÚT CÀI ĐẶT / BẮT ĐẦU GIỮ NGUYÊN CHỨC NĂNG */}
          <div className="w-full lg:w-[46%] flex flex-col items-center lg:items-start text-center lg:text-left z-20">
            <h1
              className="cyber-game-title font-cyber text-4xl sm:text-5xl xl:text-6xl font-black tracking-tighter leading-none uppercase italic mb-5 drop-shadow-[0_4px_14px_rgba(4,12,24,0.85)]"
              data-text="NORI TOWN"
            >
              NORI TOWN
            </h1>

            {/* Khung cài đặt + nút bấm giữ nguyên đầy đủ như ban đầu */}
            <div className="w-full max-w-lg text-left space-y-3" data-no-slash="true">
              <div className="cyber-panel rounded-2xl p-4 space-y-3.5">
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
                      className="w-24 accent-cyan-400 cursor-pointer touch-auto"
                      aria-label="Tầm nhìn tải Chunk"
                    />
                    <span
                      className="font-mono-tech text-sm font-bold w-5 text-center"
                      style={{ color: activeTheme.secondary }}
                    >
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
                      className="w-24 accent-pink-500 cursor-pointer touch-auto"
                      aria-label="Độ nhạy chuột"
                    />
                    <span
                      className="font-mono-tech text-sm font-bold w-5 text-center"
                      style={{ color: activeTheme.primary }}
                    >
                      {sensitivity}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/10">
                  <div className="flex items-start gap-2.5">
                    <Smartphone
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: activeTheme.secondary }}
                    />
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
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                        : 'bg-slate-900/85 border-white/15 text-slate-300'
                    }`}
                  >
                    {touchControlsEnabled ? 'Đang bật' : 'Đang tắt'}
                  </button>
                </div>
              </div>

              <div className="cyber-panel rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGuideOpen((prev) => !prev)}
                  aria-expanded={guideOpen}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition cursor-pointer"
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
                          className="bg-black/50 px-3 py-2 rounded-xl border border-white/10 flex items-center justify-between gap-2"
                        >
                          <span>{item.label}</span>
                          <strong className="text-amber-300 font-mono-tech whitespace-nowrap">
                            {item.keys}
                          </strong>
                        </div>
                      ))}
                    </div>
                    {touchControlsEnabled && (
                      <div className="bg-emerald-950/60 border border-emerald-400/25 rounded-xl px-3 py-2 text-[11px] text-emerald-200 leading-relaxed">
                        <strong>Mẹo điện thoại:</strong> Kéo cần tròn góc trái để di chuyển mọi hướng, vuốt vùng trống để xoay góc nhìn. Chạm giữ vào thân cây 5s (hoặc chạm 1 lần khi cầm Katana) để chặt cây, chạm lên quái để chém, và chạm trực tiếp vào ô Balo để chọn đồ.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nút Bắt Đầu Khám Phá / Tiếp Tục Chơi giữ nguyên chức năng */}
              <button
                type="button"
                onClick={onPlay}
                className="katana-btn group w-full px-6 py-3.5 text-left flex items-center justify-between cursor-pointer"
              >
                <div className="relative z-10">
                  <div className="font-cyber text-lg sm:text-xl font-extrabold tracking-wider text-white group-hover:text-cyan-200 transition-colors">
                    {hasStarted ? 'Tiếp Tục Chơi' : 'Bắt Đầu Khám Phá'}
                  </div>
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-white/60 uppercase">
                    {hasStarted
                      ? 'RESUME // QUAY LẠI THẾ GIỚI NORI TOWN'
                      : 'START GAME // KHÁM PHÁ THẾ GIỚI VOXEL'}
                  </div>
                </div>
                <span
                  className="relative z-10 font-jp text-xl font-bold opacity-75 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                  style={{ color: activeTheme.secondary }}
                >
                  斬撃
                </span>
              </button>
            </div>
          </div>

          {/* CỘT PHẢI: THANH KATANA PHÁT SÁNG NEON */}
          <div className="relative w-full lg:w-[52%] h-52 sm:h-72 lg:h-[440px] flex items-center justify-center pointer-events-none shrink-0">
            <div className="magic-ring absolute w-52 h-52 sm:w-72 sm:h-72 lg:w-[400px] lg:h-[400px] rounded-full opacity-55" />
            <div className="magic-ring-reverse absolute w-40 h-40 sm:w-56 sm:h-56 lg:w-[320px] lg:h-[320px] rounded-full opacity-70" />

            <div
              className="font-jp font-black text-[120px] sm:text-[180px] lg:text-[250px] select-none opacity-20 transition-all duration-500"
              style={{
                color: activeTheme.primary,
                textShadow: `0 0 60px ${activeTheme.primary}`,
              }}
            >
              {activeTheme.kanji}
            </div>

            <div
              ref={katanaWrapperRef}
              className="katana-float absolute w-[108%] max-w-[740px] flex items-center justify-center"
            >
              <svg viewBox="0 0 900 220" className="w-full h-auto overflow-visible">
                <defs>
                  <linearGradient id="bladeEnergyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="25%" stopColor={activeTheme.secondary} />
                    <stop offset="65%" stopColor={activeTheme.primary} />
                    <stop offset="100%" stopColor={activeTheme.accent} />
                  </linearGradient>

                  <linearGradient id="bladeSpineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1a162b" />
                    <stop offset="50%" stopColor="#2d264a" />
                    <stop offset="100%" stopColor="#0f0c1d" />
                  </linearGradient>

                  <filter id="neonGlow" x="-30%" y="-50%" width="160%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="blur1" />
                    <feGaussianBlur stdDeviation="14" result="blur2" />
                    <feMerge>
                      <feMergeNode in="blur2" />
                      <feMergeNode in="blur1" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <path
                  d="M 245 103 Q 560 96 865 76 L 835 104 Q 560 116 245 116 Z"
                  fill="url(#bladeEnergyGrad)"
                  opacity="0.45"
                  filter="url(#neonGlow)"
                />

                <path
                  d="M 245 102 Q 560 95 868 74 L 855 86 Q 560 103 245 108 Z"
                  fill="url(#bladeSpineGrad)"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="0.8"
                />

                <path
                  d="M 245 108 Q 560 103 855 86 L 836 102 Q 560 115 245 115 Z"
                  fill="url(#bladeEnergyGrad)"
                  filter="url(#neonGlow)"
                />

                <path
                  d="M 260 105 Q 550 100 820 87"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeDasharray="18 6 4 6"
                  opacity="0.95"
                />

                <polygon
                  points="228,99 248,98 248,117 228,116"
                  fill={activeTheme.accent}
                  stroke="#fff"
                  strokeWidth="1"
                />
                <line x1="234" y1="99" x2="234" y2="116" stroke="#000" strokeWidth="1.5" />
                <line x1="241" y1="99" x2="241" y2="116" stroke="#000" strokeWidth="1.5" />

                <g filter="url(#neonGlow)">
                  <polygon
                    points="216,74 228,82 228,134 216,142 208,130 208,86"
                    fill="#120d24"
                    stroke={activeTheme.secondary}
                    strokeWidth="2.5"
                  />
                  <circle cx="218" cy="108" r="5" fill={activeTheme.primary} />
                </g>

                <rect
                  x="42"
                  y="99"
                  width="166"
                  height="18"
                  rx="3"
                  fill="#0d091a"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="1"
                />

                <g fill={activeTheme.primary} opacity="0.9">
                  <polygon points="58,99 68,108 58,117 48,108" />
                  <polygon points="80,99 90,108 80,117 70,108" />
                  <polygon points="102,99 112,108 102,117 92,108" />
                  <polygon points="124,99 134,108 124,117 114,108" />
                  <polygon points="146,99 156,108 146,117 136,108" />
                  <polygon points="168,99 178,108 168,117 158,108" />
                  <polygon points="190,99 200,108 190,117 180,108" />
                </g>

                <polygon
                  points="26,97 42,99 42,117 26,119 20,108"
                  fill={activeTheme.secondary}
                  filter="url(#neonGlow)"
                />
              </svg>
            </div>

            <div className="hidden sm:block absolute bottom-2 sm:bottom-4 right-2 sm:right-6 bg-black/70 border border-white/15 px-4 py-2.5 rounded-xl text-right">
              <div className="text-[10px] font-cyber tracking-widest text-white/50 uppercase">
                VŨ KHÍ ĐANG TRANG BỊ
              </div>
              <div
                className="font-cyber text-xs sm:text-sm font-bold tracking-wider"
                style={{ color: activeTheme.secondary }}
              >
                {activeTheme.name}
              </div>
              <div className="flex items-center justify-end gap-2 mt-1">
                <span className="text-[11px] text-white/70">CÔNG PHÁ:</span>
                <div className="w-24 h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: activeTheme.power,
                      background: `linear-gradient(90deg, ${activeTheme.primary}, ${activeTheme.secondary})`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* THANH DƯỚI: CHỌN HỆ NGUYÊN TỐ */}
        <footer className="flex flex-col sm:flex-row items-center justify-start gap-3 pt-1 shrink-0">
          <div className="flex flex-wrap items-center justify-center gap-2 bg-black/65 px-3.5 py-2 rounded-2xl border border-white/15 shadow-2xl">
            <span className="text-xs font-cyber font-bold tracking-widest text-white/70 mr-1 uppercase hidden md:inline">
              HỆ NGUYÊN TỐ:
            </span>

            {THEME_ORDER.map((key) => {
              const cfg = ELEMENT_THEMES[key];
              const isActive = themeKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectTheme(key)}
                  className={`element-pill px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'active border-white bg-white/15 text-white'
                      : 'border-white/15 bg-white/5 hover:bg-white/15 text-white/85'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${cfg.dotClass}`} />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </footer>
      </div>
    </div>
  );
});
