import { CharacterGender } from '../game/firstPersonArms';
import { KatanaVisualVariant } from '../game/katana';
import { OutfitId } from '../game/outfits';

export function LeafKatanaSvg({ className = 'w-full h-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 80" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="leafBladeGrad" x1="108" y1="30" x2="346" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#166534" />
          <stop offset="45%" stopColor="#22c55e" />
          <stop offset="85%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#bbf7d0" />
        </linearGradient>
        <linearGradient id="leafEdgeGrad" x1="108" y1="42" x2="348" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      {/* Kashira (đầu chuôi kiếm sắt tối) */}
      <rect x="8" y="34" width="12" height="17" rx="4" fill="#27272a" stroke="#09090b" strokeWidth="1.5" />

      {/* Chuôi kiếm nền kem giả da cá đuối */}
      <path d="M18 35 L98 33 L98 48 L18 50 Z" fill="#fef3c7" stroke="#451a03" strokeWidth="1.5" />

      {/* Dây quấn Tsuka-ito đỏ đan chéo hình thoi */}
      <path
        d="M20 35 L95 33 L95 48 L20 50 Z"
        fill="#991b1b"
        stroke="#450a0a"
        strokeWidth="1.2"
        opacity="0.92"
      />
      {/* Các ô hình thoi lộ lớp kem bên trong */}
      <polygon points="27,42 32,37 37,42 32,47" fill="#fef3c7" stroke="#450a0a" strokeWidth="0.9" />
      <polygon points="39,42 44,37 49,42 44,47" fill="#fef3c7" stroke="#450a0a" strokeWidth="0.9" />
      <polygon points="51,42 56,37 61,42 56,47" fill="#d97706" stroke="#450a0a" strokeWidth="0.9" />
      <polygon points="63,41 68,36 73,41 68,46" fill="#fef3c7" stroke="#450a0a" strokeWidth="0.9" />
      <polygon points="75,41 80,36 85,41 80,46" fill="#fef3c7" stroke="#450a0a" strokeWidth="0.9" />
      <polygon points="87,40 91,36 95,40 91,45" fill="#fef3c7" stroke="#450a0a" strokeWidth="0.9" />

      {/* Tsuba (chắn tay sắt tối hình bầu dục) */}
      <ellipse cx="101" cy="40" rx="5.5" ry="17" fill="#27272a" stroke="#09090b" strokeWidth="1.6" />
      <ellipse cx="100.5" cy="40" rx="2.5" ry="11" fill="#3f3f46" />

      {/* Habaki (khâu đồng vàng) */}
      <path d="M105 33 L118 33 L118 46 L105 46 Z" fill="#ca8a04" stroke="#713f12" strokeWidth="1.3" />
      <path d="M106 34.5 L117 34.5" stroke="#fef08a" strokeWidth="1.2" opacity="0.8" />

      {/* Lưỡi kiếm xanh ngọc cong thanh thoát */}
      <path
        d="M118 33 Q238 32 348 16 L338 28 Q236 45 118 46 Z"
        fill="url(#leafBladeGrad)"
        stroke="#064e3b"
        strokeWidth="1.4"
      />

      {/* Đường Hamon gợn sóng + mép lưỡi bạc sáng */}
      <path
        d="M118 42 Q132 38 146 41 T174 40 T202 39 T230 37 T258 34 T286 30 T314 25 T344 18 L338 28 Q236 45 118 46 Z"
        fill="url(#leafEdgeGrad)"
        opacity="0.88"
      />
      <path
        d="M120 35 Q236 34 342 19"
        stroke="#bbf7d0"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}

export function NormalKatanaSvg({ className = 'w-full h-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 80" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="normBladeGrad" x1="108" y1="30" x2="346" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="48%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>
        <linearGradient id="normEdgeGrad" x1="108" y1="42" x2="348" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      {/* Kashira vàng đồng */}
      <rect x="8" y="34" width="12" height="17" rx="4" fill="#eab308" stroke="#713f12" strokeWidth="1.5" />

      {/* Chuôi kiếm đen tuyền & dây quấn hổ phách */}
      <path d="M18 35 L98 33 L98 48 L18 50 Z" fill="#18181b" stroke="#09090b" strokeWidth="1.5" />
      <polygon points="27,42 32,37 37,42 32,47" fill="#b45309" stroke="#451a03" strokeWidth="0.9" />
      <polygon points="39,42 44,37 49,42 44,47" fill="#b45309" stroke="#451a03" strokeWidth="0.9" />
      <polygon points="51,42 56,37 61,42 56,47" fill="#d97706" stroke="#451a03" strokeWidth="0.9" />
      <polygon points="63,41 68,36 73,41 68,46" fill="#b45309" stroke="#451a03" strokeWidth="0.9" />
      <polygon points="75,41 80,36 85,41 80,46" fill="#b45309" stroke="#451a03" strokeWidth="0.9" />
      <polygon points="87,40 91,36 95,40 91,45" fill="#b45309" stroke="#451a03" strokeWidth="0.9" />

      {/* Tsuba vàng */}
      <ellipse cx="101" cy="40" rx="5.5" ry="17" fill="#eab308" stroke="#854d0e" strokeWidth="1.6" />
      <ellipse cx="100.5" cy="40" rx="2.5" ry="11" fill="#fde047" />

      {/* Habaki vàng */}
      <path d="M105 33 L117 33 L117 46 L105 46 Z" fill="#ca8a04" stroke="#713f12" strokeWidth="1.2" />

      {/* Lưỡi thép bạc */}
      <path
        d="M117 33 Q238 32 348 16 L338 28 Q236 45 117 46 Z"
        fill="url(#normBladeGrad)"
        stroke="#334155"
        strokeWidth="1.4"
      />
      <path
        d="M117 41 Q236 39 343 18 L338 28 Q236 45 117 46 Z"
        fill="url(#normEdgeGrad)"
        opacity="0.9"
      />
      <path d="M120 35 Q236 34 342 19" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

export function IceKatanaSvg({ className = 'w-full h-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 80" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="iceBladeGrad" x1="115" y1="24" x2="348" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="28%" stopColor="#0ea5e9" />
          <stop offset="68%" stopColor="#38bdf8" />
          <stop offset="92%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#f0f9ff" />
        </linearGradient>
        <linearGradient id="iceEdgeGrad" x1="115" y1="44" x2="348" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="55%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="iceHabakiGrad" x1="106" y1="30" x2="122" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="iceIcicleGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.88" />
        </linearGradient>
      </defs>

      {/* Làn sương băng tỏa nhẹ quanh thanh kiếm */}
      <path
        d="M28 45 Q130 56 245 36 Q315 24 348 18"
        stroke="#7dd3fc"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.18"
      />

      {/* Kashira vương miện tinh thể băng nhọn */}
      <polygon
        points="20,34 11,30 14,37 6,41 13,45 9,52 20,49"
        fill="#bae6fd"
        stroke="#0284c7"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <polygon points="18,36 10,41 18,47" fill="#e0f2fe" />

      {/* Nhũ băng rủ dưới chuôi kiếm */}
      <polygon points="24,49 27,49 25.5,64" fill="url(#iceIcicleGrad)" stroke="#38bdf8" strokeWidth="0.6" />
      <polygon points="35,49 38,49 36.5,58" fill="url(#iceIcicleGrad)" stroke="#38bdf8" strokeWidth="0.6" />
      <polygon points="62,48 65,48 63.5,61" fill="url(#iceIcicleGrad)" stroke="#38bdf8" strokeWidth="0.6" />
      <polygon points="73,48 75.5,48 74,56" fill="url(#iceIcicleGrad)" stroke="#38bdf8" strokeWidth="0.6" />

      {/* Chuôi kiếm xanh navy sâu + dây quấn băng chéo */}
      <path d="M20 35 L96 33 L96 48 L20 50 Z" fill="#172554" stroke="#0f172a" strokeWidth="1.4" />
      <polygon points="26,42 31,37 36,42 31,47" fill="#dbeafe" stroke="#1e3a8a" strokeWidth="0.8" />
      <polygon points="38,42 43,37 48,42 43,47" fill="#e0f2fe" stroke="#1e3a8a" strokeWidth="0.8" />
      <polygon points="50,41.5 55,36.5 60,41.5 55,46.5" fill="#bae6fd" stroke="#1e3a8a" strokeWidth="0.8" />
      <polygon points="62,41 67,36 72,41 67,46" fill="#e0f2fe" stroke="#1e3a8a" strokeWidth="0.8" />
      <polygon points="74,40.5 79,35.5 84,40.5 79,45.5" fill="#dbeafe" stroke="#1e3a8a" strokeWidth="0.8" />
      <polygon points="86,40 90,36 94,40 90,44.5" fill="#e0f2fe" stroke="#1e3a8a" strokeWidth="0.8" />
      {/* Sương trắng viền mép chuôi */}
      <path d="M22 35 L95 33" stroke="#bae6fd" strokeWidth="1" opacity="0.6" />

      {/* Tsuba hoa tuyết 6 cánh tinh thể băng + nhũ băng rủ */}
      <polygon points="99,40 94,20 101,12 108,20" fill="#bae6fd" stroke="#0284c7" strokeWidth="1.1" />
      <polygon points="101,40 94,59 101,69 108,59" fill="#93c5fd" stroke="#0284c7" strokeWidth="1.1" />
      <polygon points="101,38 89,26 95,21 104,33" fill="#e0f2fe" stroke="#0284c7" strokeWidth="0.9" />
      <polygon points="101,38 113,26 107,21 98,33" fill="#e0f2fe" stroke="#0284c7" strokeWidth="0.9" />
      <polygon points="101,42 89,54 95,58 104,46" fill="#bae6fd" stroke="#0284c7" strokeWidth="0.9" />
      <polygon points="101,42 113,54 107,58 98,46" fill="#bae6fd" stroke="#0284c7" strokeWidth="0.9" />
      <polygon points="94,59 96.5,59 95,72" fill="url(#iceIcicleGrad)" stroke="#38bdf8" strokeWidth="0.6" />
      <ellipse cx="101" cy="40" rx="5.5" ry="11" fill="#7dd3fc" stroke="#0369a1" strokeWidth="1.2" />

      {/* Habaki bạc khắc chạm + viên ngọc lam hình thoi */}
      <path d="M106 32.5 L121 32.5 L121 46.5 L106 46.5 Z" fill="url(#iceHabakiGrad)" stroke="#334155" strokeWidth="1.2" />
      <polygon points="113.5,35.5 117.5,39.5 113.5,43.5 109.5,39.5" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="0.9" />

      {/* Lưỡi kiếm pha lê băng cong + vân nứt + cổ ngữ + bông tuyết */}
      <path
        d="M121 32.5 Q240 31.5 352 14 L341 28 Q238 45.5 121 46.5 Z"
        fill="url(#iceBladeGrad)"
        stroke="#0369a1"
        strokeWidth="1.3"
      />
      <path
        d="M121 41 Q238 39.5 346 17 L341 28 Q238 45.5 121 46.5 Z"
        fill="url(#iceEdgeGrad)"
        opacity="0.93"
      />

      {/* Đường nứt tinh thể phát sáng dọc lưỡi kiếm */}
      <path
        d="M136 37 L160 35 L178 38 L206 33 L232 36 L262 29 L292 30 L322 21 L344 17"
        stroke="#e0f2fe"
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path d="M178 38 L192 42" stroke="#bae6fd" strokeWidth="0.9" opacity="0.75" />
      <path d="M232 36 L248 39" stroke="#bae6fd" strokeWidth="0.9" opacity="0.75" />
      <path d="M292 30 L306 32" stroke="#ffffff" strokeWidth="0.9" opacity="0.8" />

      {/* Bông tuyết & ký tự băng trên lưỡi kiếm */}
      <g stroke="#ffffff" strokeWidth="0.85" opacity="0.9">
        <line x1="274" y1="31" x2="280" y2="31" />
        <line x1="277" y1="28" x2="277" y2="34" />
        <line x1="275" y1="29" x2="279" y2="33" />
        <line x1="279" y1="29" x2="275" y2="33" />

        <line x1="311" y1="24" x2="317" y2="24" />
        <line x1="314" y1="21" x2="314" y2="27" />
        <line x1="312" y1="22" x2="316" y2="26" />
        <line x1="316" y1="22" x2="312" y2="26" />
      </g>
      {/* Viền sống kiếm sáng trắng */}
      <path d="M123 34.5 Q240 33.5 346 17" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

export function KatanaVariantSvg({
  variant,
  className = 'w-full h-auto',
}: {
  variant: KatanaVisualVariant;
  className?: string;
}) {
  if (variant === 'leaf') return <LeafKatanaSvg className={className} />;
  if (variant === 'ice') return <IceKatanaSvg className={className} />;
  return <NormalKatanaSvg className={className} />;
}

export function ShieldItemSvg({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="shieldFaceGrad" x1="14" y1="10" x2="50" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5a432d" />
          <stop offset="55%" stopColor="#3b2b1d" />
          <stop offset="100%" stopColor="#261b12" />
        </linearGradient>
      </defs>

      {/* Thân khiên heater */}
      <path
        d="M12 12 Q32 16 52 12 C53 31 46 46 32 56 C18 46 11 31 12 12 Z"
        fill="url(#shieldFaceGrad)"
        stroke="#8c6236"
        strokeWidth="4.2"
        strokeLinejoin="round"
      />

      {/* Thanh ngang đồng phía trên */}
      <path
        d="M12 12 Q32 16 52 12 L51.5 18 Q32 21.5 12.5 18 Z"
        fill="#9a6e3e"
        stroke="#5c3e1e"
        strokeWidth="1"
      />

      {/* Đường xước ánh kim nhẹ */}
      <path d="M23 26 L36 33" stroke="#856343" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      <path d="M26 39 L38 36" stroke="#1c120a" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />

      {/* Đinh tán đồng dọc viền khiên */}
      <circle cx="17" cy="15.5" r="1.7" fill="#d4ab6a" />
      <circle cx="26" cy="16.8" r="1.7" fill="#d4ab6a" />
      <circle cx="38" cy="16.8" r="1.7" fill="#d4ab6a" />
      <circle cx="47" cy="15.5" r="1.7" fill="#d4ab6a" />
      <circle cx="15.5" cy="26" r="1.6" fill="#d4ab6a" />
      <circle cx="48.5" cy="26" r="1.6" fill="#d4ab6a" />
      <circle cx="19" cy="38" r="1.6" fill="#d4ab6a" />
      <circle cx="45" cy="38" r="1.6" fill="#d4ab6a" />
      <circle cx="32" cy="51.5" r="1.8" fill="#d4ab6a" />
    </svg>
  );
}

export function PotionItemSvg({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      {/* Nút bần gỗ */}
      <rect x="26" y="7" width="12" height="7" rx="2" fill="#92400e" stroke="#451a03" strokeWidth="1.5" />
      {/* Cổ vàng */}
      <rect x="23" y="13" width="18" height="4.5" rx="1.8" fill="#fbbf24" stroke="#78350f" strokeWidth="1.3" />
      {/* Thân bình thủy tinh */}
      <path
        d="M25 17.5 L39 17.5 L39 24 L49 33 C51 35 51 47 47 52 C44 55.5 20 55.5 17 52 C13 47 13 35 15 33 L25 24 Z"
        fill="#e0f2fe"
        fillOpacity="0.32"
        stroke="#bae6fd"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Dung dịch máu đỏ phát sáng */}
      <path
        d="M17 36 L47 36 C48.5 42 47.5 48 45 50.5 C42 53.2 22 53.2 19 50.5 C16.5 48 15.5 42 17 36 Z"
        fill="#ef4444"
        stroke="#991b1b"
        strokeWidth="1.4"
      />
      <ellipse cx="32" cy="36" rx="14.5" ry="2.6" fill="#fda4af" />
      {/* Lõi sáng bên trong */}
      <polygon points="32,39 37,44 32,49 27,44" fill="#fecdd3" opacity="0.88" />
      {/* Vệt phản chiếu thủy tinh */}
      <path d="M21 31 L19 42" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function BackpackItemSvg({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      {/* Quai xách trên */}
      <path d="M25 14 C25 8 39 8 39 14" stroke="#78350f" strokeWidth="3.5" strokeLinecap="round" />
      {/* Thân balo da nâu */}
      <rect x="14" y="15" width="36" height="40" rx="9" fill="#b45309" stroke="#451a03" strokeWidth="2.2" />
      {/* Nắp gập trên */}
      <path d="M13 21 C13 15 51 15 51 21 L51 29 C51 32 13 32 13 29 Z" fill="#92400e" stroke="#451a03" strokeWidth="2" />
      {/* Túi phụ phía trước */}
      <rect x="19" y="36" width="26" height="14" rx="4" fill="#92400e" stroke="#451a03" strokeWidth="1.8" />
      {/* Khóa vàng nổi bật */}
      <rect x="28" y="27" width="8" height="7" rx="2" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
    </svg>
  );
}

export function OutfitItemSvg({
  outfit,
  gender,
  className = 'w-11 h-11',
}: {
  outfit: OutfitId;
  gender: CharacterGender;
  className?: string;
}) {
  const palette = (() => {
    switch (outfit) {
      case 'black_shinigami':
        return {
          body: '#181920',
          collar: '#f1f5f9',
          sleeve: '#181920',
          cuff: '#f1f5f9',
          obi: '#f8fafc',
          hakama: '#111318',
          stroke: '#64748b',
          flower: null as string | null,
        };
      case 'red_samurai':
        return {
          body: '#8f1d22',
          collar: '#ef4444',
          sleeve: '#991b1b',
          cuff: '#fecaca',
          obi: '#111318',
          hakama: '#18181b',
          stroke: '#fca5a5',
          flower: null as string | null,
        };
      case 'female_black':
        return {
          body: '#161720',
          collar: '#eab308',
          sleeve: '#181922',
          cuff: '#eab308',
          obi: '#dc2626',
          hakama: '#161720',
          stroke: '#eab308',
          flower: '#f43f5e',
        };
      case 'female_red':
        return {
          body: '#b91c24',
          collar: '#facc15',
          sleeve: '#dc2626',
          cuff: '#facc15',
          obi: '#18181b',
          hakama: '#b91c24',
          stroke: '#fde047',
          flower: '#fecdd3',
        };
      case 'female_white':
        return {
          body: '#f8fafc',
          collar: '#dc2626',
          sleeve: '#ffffff',
          cuff: '#dc2626',
          obi: '#dc2626',
          hakama: '#f1f5f9',
          stroke: '#dc2626',
          flower: '#ef4444',
        };
      default:
        return gender === 'male'
          ? {
              body: '#f8fafc',
              collar: '#ef4444',
              sleeve: '#f97316',
              cuff: '#ea580c',
              obi: '#334155',
              hakama: '#1e293b',
              stroke: '#fdba74',
              flower: null as string | null,
            }
          : {
              body: '#ffffff',
              collar: '#f43f5e',
              sleeve: '#f472b6',
              cuff: '#fb7185',
              obi: '#e11d48',
              hakama: '#ffffff',
              stroke: '#fda4af',
              flower: '#f472b6',
            };
    }
  })();

  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      {/* Tay áo trái & phải xòe kiểu Kimono */}
      <path d="M22 14 L8 22 L12 37 L22 33 Z" fill={palette.sleeve} stroke={palette.stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M42 14 L56 22 L52 37 L42 33 Z" fill={palette.sleeve} stroke={palette.stroke} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Viền cổ tay áo */}
      <path d="M8 22 L12 37" stroke={palette.cuff} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M56 22 L52 37" stroke={palette.cuff} strokeWidth="2.6" strokeLinecap="round" />

      {/* Thân trên + vạt dưới (Hakama cho Nam, Váy xòe Kimono cho Nữ) */}
      {gender === 'male' ? (
        <path
          d="M22 13 L42 13 L44 37 L46 56 L34 56 L32 42 L30 56 L18 56 L20 37 Z"
          fill={palette.body}
          stroke={palette.stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M22 13 L42 13 L43 35 L50 56 L14 56 L21 35 Z"
          fill={palette.body}
          stroke={palette.stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}

      {/* Phần quần/váy dưới nếu khác màu áo trên */}
      {gender === 'male' && (
        <path
          d="M20 37 L44 37 L46 56 L34 56 L32 42 L30 56 L18 56 Z"
          fill={palette.hakama}
          stroke={palette.stroke}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      )}

      {/* Cổ áo chữ Y truyền thống */}
      <path d="M25 13 L33 26 L39 13" stroke={palette.collar} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

      {/* Đai thắt lưng Obi */}
      <rect x="20.5" y="32" width="23" height="6" rx="1.5" fill={palette.obi} stroke={palette.stroke} strokeWidth="1" />
      <rect x="29" y="31.5" width="6" height="7" rx="1.5" fill={palette.collar} />

      {/* Họa tiết hoa nhỏ cho trang phục Nữ */}
      {palette.flower && (
        <>
          <circle cx="24" cy="46" r="2.2" fill={palette.flower} />
          <circle cx="38" cy="49" r="2.4" fill={palette.flower} />
          <circle cx="30" cy="51" r="1.7" fill={palette.collar} />
        </>
      )}
    </svg>
  );
}

export function SlimeOrbSvg({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      {/* Bóng vỏ thủy tinh xanh mint bên ngoài */}
      <path
        d="M8 42 C8 22 19 10 32 10 C45 10 56 22 56 42 C56 50 47 54 32 54 C17 54 8 50 8 42 Z"
        fill="#bbf7d0"
        stroke="#18181b"
        strokeWidth="2.4"
      />
      {/* Lõi slime xanh đậm uốn lượn bên trong */}
      <path
        d="M13 43 C13 36 18 33 21 31 C19 25 23 20 29 20 C36 20 42 25 41 30 C44 31 44 33 41 34 C48 36 51 40 51 44 C51 48 43 50 32 50 C20 50 13 48 13 43 Z"
        fill="#22c55e"
        stroke="#15803d"
        strokeWidth="1.6"
      />
      {/* Điểm bóng sáng đặc trưng */}
      <ellipse cx="44" cy="23" rx="5.5" ry="3.2" transform="rotate(34 44 23)" fill="#ffffff" />
      <circle cx="50" cy="31" r="2.1" fill="#ffffff" />
      <circle cx="27" cy="25" r="1.5" fill="#dcfce7" />
    </svg>
  );
}

export function RedMushroomSvg({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      {/* Thân nấm kem */}
      <path
        d="M25 39 L39 39 L41 53 C41 55 37 57 32 57 C27 57 23 55 23 53 Z"
        fill="#fef3c7"
        stroke="#5c1d0c"
        strokeWidth="2.2"
      />
      {/* Mũ nấm đỏ bo tròn */}
      <path
        d="M8 38 C8 19 19 9 32 9 C45 9 56 19 56 38 C56 43 46 45 32 45 C18 45 8 43 8 38 Z"
        fill="#ea4326"
        stroke="#5c1d0c"
        strokeWidth="2.4"
      />
      {/* Bóng tối nhẹ dưới vành mũ nấm */}
      <path
        d="M10 38 C16 42 48 42 54 38 C52 43 44 44 32 44 C20 44 12 43 10 38 Z"
        fill="#c22e14"
      />
      {/* Chấm tròn màu kem trên mũ */}
      <circle cx="19" cy="25" r="5" fill="#fef3c7" stroke="#b91c1c" strokeWidth="1" />
      <circle cx="38" cy="20" r="5.5" fill="#fef3c7" stroke="#b91c1c" strokeWidth="1" />
      <circle cx="29" cy="34" r="5.5" fill="#fef3c7" stroke="#b91c1c" strokeWidth="1" />
      <circle cx="45" cy="33" r="4.2" fill="#fef3c7" stroke="#b91c1c" strokeWidth="1" />
      <circle cx="16" cy="36" r="2.6" fill="#fef3c7" stroke="#b91c1c" strokeWidth="0.9" />
      {/* Vệt bóng trắng */}
      <ellipse cx="44" cy="17" rx="4.8" ry="2.2" transform="rotate(34 44 17)" fill="#ffffff" />
      <circle cx="50" cy="23" r="1.8" fill="#ffffff" />
    </svg>
  );
}
