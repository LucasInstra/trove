/** A small house on a green patch: the housing card. */
export function HouseArt() {
  return (
    <svg className="card-art" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="trove-house-roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="trove-house-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7ecdc" />
          <stop offset="1" stopColor="#e8d6bd" />
        </linearGradient>
        <linearGradient id="trove-house-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4ade80" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>

      <ellipse cx="48" cy="82" rx="28" ry="5" fill="#166534" opacity="0.16" />
      <ellipse cx="48" cy="79" rx="30" ry="7" fill="url(#trove-house-grass)" opacity="0.9" />

      <rect x="28" y="45" width="40" height="32" rx="4" fill="url(#trove-house-wall)" />
      <path d="M20 47 L48 24 L76 47 Z" fill="url(#trove-house-roof)" />
      <path d="M20 47 L48 24 L76 47 Z" fill="#ffffff" opacity="0.14" />
      <rect x="24" y="45" width="48" height="4" rx="2" fill="#1e40af" opacity="0.25" />

      <rect x="43" y="58" width="12" height="19" rx="2" fill="#2563eb" />
      <circle cx="52" cy="68" r="1.3" fill="#bfdbfe" />
      <rect x="32" y="53" width="9" height="9" rx="2" fill="#93c5fd" stroke="#ffffff" strokeWidth="1.5" />
      <rect x="57" y="53" width="9" height="9" rx="2" fill="#93c5fd" stroke="#ffffff" strokeWidth="1.5" />
      <rect x="46" y="30" width="5" height="12" rx="1.5" fill="#e2e8f0" />
    </svg>
  );
}
