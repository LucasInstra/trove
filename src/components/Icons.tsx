import type { ReactNode } from "react";

export type IconName =
  | "ledger"
  | "import"
  | "settings"
  | "search"
  | "left"
  | "right"
  | "file"
  | "check"
  | "trend"
  | "card"
  | "home"
  | "target"
  | "calendar"
  | "bell"
  | "flow"
  | "sun"
  | "moon"
  | "plus"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "x"
  | "file-text"
  | "contactless"
  | "arrow-right"
  | "scale"
  | "grid"
  | "arrow-left-right"
  | "arrow-down-to-line"
  | "layout"
  | "chevron-up"
  | "minus";

const ICONS: Record<IconName, ReactNode> = {
  ledger: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </>
  ),
  import: (
    <>
      <path d="M12 3.5v11" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 20h16" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h4m4 0h8" />
      <path d="M4 12h9m4 0h3" />
      <path d="M4 18h2m4 0h10" />
      <circle cx="10" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m15.25 15.25 5.25 5.25" />
    </>
  ),
  left: <path d="M19 12H5m6-6-6 6 6 6" />,
  right: <path d="M5 12h14m-6-6 6 6-6 6" />,
  file: (
    <>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
      <path d="M14 3.5v5h5" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5L19.5 7" />,
  trend: (
    <>
      <path d="m3.5 17.5 5.75-5.75 3.75 3.75L20.5 8" />
      <path d="M15.5 8h5v5" />
    </>
  ),
  card: (
    <>
      <rect x="2.75" y="6" width="18.5" height="12" rx="2.25" />
      <path d="M3 10.5h18" />
      <path d="M6.5 14.5h5" />
    </>
  ),
  home: (
    <>
      <path d="m3.5 10 8.5-6.5 8.5 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.25" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 9.5h18" />
      <path d="M8 3v4M16 3v4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l2 2.5H4z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  flow: (
    <>
      <path d="M4 20.5V12" />
      <path d="M9.33 20.5V6" />
      <path d="M14.67 20.5v-9" />
      <path d="M20 20.5V4" />
      <path d="M3 21h18" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v1.75M12 19.75v1.75M2.5 12h1.75m15.5 0h1.75M5.28 5.28l1.24 1.24m10.96 10.96 1.24 1.24m0-13.44-1.24 1.24M6.52 17.48l-1.24 1.24" />
    </>
  ),
  moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.75 8.5 8.5 0 1 0 20.5 14.5Z" />,
  plus: (
    <>
      <path d="M12 4.5v15" />
      <path d="M4.5 12h15" />
    </>
  ),
  "chevron-left": <path d="m14.5 17-5-5 5-5" />,
  "chevron-right": <path d="m9.5 17 5-5-5-5" />,
  "chevron-down": <path d="m7 9.5 5 5 5-5" />,
  x: <path d="m17.5 6.5-11 11m0-11 11 11" />,
  "file-text": (
    <>
      <path d="M14.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" />
      <path d="M9 11h6m-6 4h6m-6 4h4" />
    </>
  ),
  contactless: (
    <>
      <path d="M7.5 8.5a5 5 0 0 1 0 7" />
      <path d="M12 5.5a9 9 0 0 1 0 13" />
      <path d="M16.5 2.5a13 13 0 0 1 0 19" />
    </>
  ),
  "arrow-right": <path d="M4 12h16m-7-7 7 7-7 7" />,
  grid: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  "arrow-left-right": (
    <>
      <path d="M19 8H5m0 0 3-3m-3 3 3 3" />
      <path d="M5 16h14m0 0-3-3m3 3-3 3" />
    </>
  ),
  "arrow-down-to-line": (
    <>
      <path d="M12 3.5v11.5" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 20h16" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M9 10v10" />
    </>
  ),
  "chevron-up": <path d="m7 14.5 5-5 5 5" />,
  minus: <path d="M4.5 12h15" />,
  scale: (
    <>
      <path d="M12 3.5v16M4 6.5h16M8 20.5h8" />
      <path d="M5 6.5 2.75 15h6.5L7 6.5m12 0-2.25 8.5h6.5L17 6.5" />
      <path d="M2.75 15c1.1 1.5 5.4 1.5 6.5 0m5.5 0c1.1 1.5 5.4 1.5 6.5 0" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
