import type { CSSProperties, ReactNode } from "react";

/**
 * The glyphs a goal can wear. Drawn on a 24px grid with the same 1.7 stroke as
 * the rest of the line icons, so they sit next to them without looking pasted
 * in. The key is what gets stored with the goal.
 */
const GLYPHS: Record<string, ReactNode> = {
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  piggy: (
    <>
      <path d="M5 11.5c0-3 3-5.5 7-5.5 1.6 0 3 .4 4.200 1.100L19 6.500v3.300c.7.800 1 1.700 1 2.700 0 1.200-.5 2.300-1.400 3.100V18h-2.800l-.6-1.500H11l-.6 1.500H7.600v-2.300C6 14.900 5 13.300 5 11.500Z" />
      <circle cx="15.200" cy="11" r=".7" fill="currentColor" stroke="none" />
      <path d="M10 9.200h3" />
    </>
  ),
  house: (
    <>
      <path d="M4 11.500 12 5l8 6.500" />
      <path d="M6 10.200V19h12v-8.800" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  plane: (
    <path d="m3.500 11.500 17-6.500-3.200 14-4.800-4.300-3 2.300-.5-4.200L3.500 11.500Zm6.800 3.200 7-6.600" />
  ),
  car: (
    <>
      <path d="M5 15.500v-3.800l1.700-4.200h10.600L19 11.700v3.800" />
      <path d="M4 15.500h16v2.800H4z" />
      <path d="M5.500 11.700h13" />
      <circle cx="8" cy="15.500" r=".6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15.500" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="14.500" r="5" />
      <path d="m9.500 6.500 1.200-2h2.600l1.200 2-2.500 2.700L9.500 6.500Z" />
    </>
  ),
  cap: (
    <>
      <path d="M3 9.500 12 5l9 4.500-9 4.500L3 9.500Z" />
      <path d="M7 12v4c1.500 1.500 3.200 2 5 2s3.500-.5 5-2v-4" />
      <path d="M21 9.500V15" />
    </>
  ),
  laptop: (
    <>
      <rect x="5" y="6" width="14" height="9.500" rx="1.500" />
      <path d="M3 18.500h18" />
    </>
  ),
  beach: (
    <>
      <path d="M4 12.500c1.500-4.700 6.200-7 11-6-2 .8-3.500 2.700-4.500 6.500H4Z" />
      <path d="M11.500 11.500 15 19" />
      <path d="M4 20c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1" />
    </>
  ),
  heart: <path d="M12 19.500s-7-4.200-7-9.300A3.900 3.900 0 0 1 12 8a3.900 3.900 0 0 1 7 2.200c0 5.100-7 9.300-7 9.300Z" />,
  baby: (
    <>
      <circle cx="12" cy="12" r="7.500" />
      <path d="M9.500 13.500c.7 1 1.500 1.500 2.500 1.500s1.800-.5 2.500-1.500" />
      <circle cx="9.800" cy="10.500" r=".6" fill="currentColor" stroke="none" />
      <circle cx="14.200" cy="10.500" r=".6" fill="currentColor" stroke="none" />
      <path d="M11 4.800c.3-1 1.500-1.300 2-.5" />
    </>
  ),
  paw: (
    <>
      <circle cx="7" cy="10" r="1.600" />
      <circle cx="10.500" cy="6.800" r="1.600" />
      <circle cx="14.500" cy="6.800" r="1.600" />
      <circle cx="18" cy="10" r="1.600" />
      <path d="M12.500 11c-2.700 0-5 3-5 5.200 0 1.500 1.200 2 2.500 1.700.8-.2 1.700-.5 2.500-.5s1.700.3 2.500.5c1.300.3 2.500-.2 2.500-1.700 0-2.200-2.300-5.200-5-5.200Z" />
    </>
  ),
  tool: (
    <>
      <path d="M14.500 6.500a4 4 0 0 0-5 5L4.500 16.500l3 3 5-5a4 4 0 0 0 5-5l-2.500 2.500-2.200-.5-.5-2.200 2.200-2.800Z" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="4" rx="1" />
      <path d="M5.500 13v6.500h13V13M12 9v10.500" />
      <path d="M12 9c-1-3.500-4.500-3.500-4.500-1.500C7.500 9 9.500 9 12 9Zm0 0c1-3.500 4.500-3.500 4.500-1.500C16.500 9 14.500 9 12 9Z" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19.500h16" />
      <path d="m5 15 4.500-4.500 3 3L19 7" />
      <path d="M15 7h4v4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 4.500 5.500 7v5c0 3.700 2.700 6.200 6.500 7.500 3.800-1.300 6.500-3.800 6.500-7.500V7L12 4.500Z" />
      <path d="m9.200 12 2 2 3.600-3.800" />
    </>
  ),
  phone: (
    <>
      <rect x="7.500" y="3.500" width="9" height="17" rx="2" />
      <path d="M11 17.500h2" />
    </>
  ),
};

export const GOAL_ICONS = Object.keys(GLYPHS);

export function GoalIcon({
  name,
  size = 20,
  color,
}: {
  name: string | undefined;
  size?: number;
  color?: string;
}) {
  const glyph = GLYPHS[name ?? ""] ?? GLYPHS.target;
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
      style={color ? { color } : undefined}
    >
      {glyph}
    </svg>
  );
}

/** The grid of glyphs in the goal dialog: one radio group, tinted with the goal's colour. */
export function GoalIconPicker({
  value,
  color,
  label,
  onChange,
  nameOf,
}: {
  value: string;
  color: string;
  label: string;
  onChange: (name: string) => void;
  nameOf: (name: string) => string;
}) {
  return (
    <div className="icon-picker" role="radiogroup" aria-label={label}>
      {GOAL_ICONS.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={nameOf(name)}
          title={nameOf(name)}
          className="icon-picker-item"
          data-selected={value === name || undefined}
          style={{ "--goal-color": color } as CSSProperties}
          onClick={() => onChange(name)}
        >
          <GoalIcon name={name} size={20} />
        </button>
      ))}
    </div>
  );
}
