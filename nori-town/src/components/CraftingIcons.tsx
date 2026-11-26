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
