/** A target with a dart in the middle: the goals card. */
export function TargetArt() {
  return (
    <svg className="card-art" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="trove-target-outer" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#93c5fd" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="trove-target-tip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>

      <ellipse cx="48" cy="82" rx="24" ry="5" fill="#1e3a8a" opacity="0.14" />

      <circle cx="44" cy="52" r="28" fill="url(#trove-target-outer)" />
      <circle cx="44" cy="52" r="28" fill="none" stroke="#1e40af" strokeOpacity="0.25" />
      <circle cx="44" cy="52" r="20" fill="#ffffff" />
      <circle cx="44" cy="52" r="13" fill="#3b82f6" />
      <circle cx="44" cy="52" r="6" fill="#ffffff" />
      <circle cx="44" cy="52" r="6" fill="#f43f5e" opacity="0.9" />
      <circle cx="34" cy="36" r="7" fill="#ffffff" opacity="0.22" />

      <g transform="rotate(36 44 52)">
        <rect x="42" y="8" width="4" height="26" rx="2" fill="#1d4ed8" />
        <path d="M40 8 L44 0 L48 8 Z" fill="url(#trove-target-tip)" opacity="0.55" />
        <path d="M44 34 L49 40 L39 40 Z" fill="url(#trove-target-tip)" />
      </g>
      <circle cx="44" cy="52" r="3" fill="#0f172a" />
    </svg>
  );
}
