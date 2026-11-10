/** A credit card seen slightly from above, glossy and tilted. */
export function CardArt() {
  return (
    <svg className="card-art" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="trove-card-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="0.45" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="trove-card-gloss" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trove-card-chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe6b0" />
          <stop offset="1" stopColor="#c99a3e" />
        </linearGradient>
        <clipPath id="trove-card-clip">
          <rect x="12" y="30" width="72" height="44" rx="9" />
        </clipPath>
      </defs>

      <ellipse cx="48" cy="80" rx="26" ry="5" fill="#1e3a8a" opacity="0.14" />
      <g transform="rotate(-12 48 52)">
        <rect x="12" y="30" width="72" height="44" rx="9" fill="url(#trove-card-face)" />
        <g clipPath="url(#trove-card-clip)">
          <path d="M12 74 L52 14 L74 14 L34 74 Z" fill="url(#trove-card-gloss)" />
          <rect x="12" y="40" width="72" height="7" fill="#ffffff" opacity="0.18" />
        </g>
        <rect x="21" y="55" width="17" height="13" rx="3" fill="url(#trove-card-chip)" />
        <rect x="25" y="59" width="9" height="5" rx="1.5" fill="#a97c2c" opacity="0.55" />
        <rect x="21" y="30" width="72" height="44" rx="9" fill="none" stroke="#1e40af" strokeOpacity="0.25" />
      </g>
    </svg>
  );
}
