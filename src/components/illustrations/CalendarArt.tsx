/** A desk calendar with a gold coin leaning against it. */
export function CalendarArt() {
  return (
    <svg className="card-art" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="trove-cal-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="trove-cal-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde9b2" />
          <stop offset="1" stopColor="#cf9f3f" />
        </linearGradient>
        <linearGradient id="trove-cal-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.7" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <ellipse cx="48" cy="82" rx="27" ry="5" fill="#1e3a8a" opacity="0.14" />

      <g transform="rotate(-8 48 48)">
        <rect x="20" y="22" width="54" height="54" rx="9" fill="#ffffff" />
        <path d="M20 31a9 9 0 0 1 9-9h36a9 9 0 0 1 9 9v9H20z" fill="url(#trove-cal-top)" />
        <rect x="20" y="40" width="54" height="9" fill="url(#trove-cal-top)" />
        <rect x="20" y="49" width="54" height="27" fill="#ffffff" />
        <g fill="#cbd5e1">
          <circle cx="29" cy="58" r="2" />
          <circle cx="38" cy="58" r="2" />
          <circle cx="47" cy="58" r="2" />
          <circle cx="56" cy="58" r="2" />
          <circle cx="65" cy="58" r="2" />
          <circle cx="29" cy="67" r="2" />
          <circle cx="38" cy="67" r="2" />
          <circle cx="56" cy="67" r="2" />
          <circle cx="65" cy="67" r="2" />
        </g>
        <rect x="44" y="64" width="9" height="9" rx="2.5" fill="#2563eb" />
        <rect x="20" y="22" width="54" height="54" rx="9" fill="none" stroke="#1e40af" strokeOpacity="0.14" />
        <rect x="28" y="15" width="4" height="14" rx="2" fill="#1d4ed8" />
        <rect x="62" y="15" width="4" height="14" rx="2" fill="#1d4ed8" />
        <rect x="20" y="22" width="54" height="54" rx="9" fill="url(#trove-cal-sheen)" />
      </g>

      <g transform="translate(60 60)">
        <circle r="16" fill="url(#trove-cal-coin)" stroke="#b8862c" strokeOpacity="0.45" strokeWidth="1.5" />
        <circle r="11" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
        <text
          x="0"
          y="4.5"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#8a5a12"
          fontFamily="Segoe UI, system-ui, sans-serif"
        >
          R$
        </text>
      </g>
    </svg>
  );
}
