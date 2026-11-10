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
  | "plus";

const ICONS: Record<IconName, ReactNode> = {
  ledger: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h8" />
      <circle cx="15.5" cy="7" r="2.5" />
      <path d="M20 17h-8" />
      <circle cx="8.5" cy="17" r="2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  left: <path d="m14 6-6 6 6 6" />,
  right: <path d="m10 6 6 6-6 6" />,
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  check: <path d="m5 13 4 4L19 7" />,
  trend: (
    <>
      <path d="M4 16.5 9.5 11l3.5 3.5L20 7.5" />
      <path d="M15 7.5h5v5" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </>
  ),
  home: (
    <>
      <path d="m4 10 8-6 8 6" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2.5h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  flow: (
    <>
      <path d="M4 18V9" />
      <path d="M9 18V5" />
      <path d="M14 18v-6" />
      <path d="M19 18v-9" />
      <path d="M3 20h18" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
