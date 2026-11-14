import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon3D, type Icon3DName } from "./Icon3D";

/**
 * The warm frame around the cold data. Everything here lives on the edges of
 * the app: card headers, plan screens, empty states. Tables, charts and KPI
 * cards stay neutral.
 */

/** A tinted circle that holds one 3D illustration. */
export function IconBubble({
  name,
  size = "md",
  className,
}: {
  name: Icon3DName;
  /** `sm` for card headers, `md` (56px) for editorial spots. */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const art = size === "lg" ? 44 : size === "md" ? 32 : 22;
  return (
    <span className={cn("icon-bubble", `icon-bubble-${size}`, className)} aria-hidden="true">
      <Icon3D name={name} size={art} />
    </span>
  );
}

/** The one dark card of a screen: month summary on the Overview. */
export function AnchorCard({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cn("account-card anchor-card", className)}>{children}</article>;
}

/** A warm paper surface for plan screens, how-it-works and import summaries. */
export function PaperBand({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "header";
}) {
  return <Tag className={cn("paper-band", className)}>{children}</Tag>;
}

/**
 * A hand-drawn stroke under one key word. At most one per screen: the month
 * in the top bar.
 */
export function BrushUnderline({ children }: { children: ReactNode }) {
  return (
    <span className="brush-underline">
      {children}
      <svg
        className="brush-stroke"
        viewBox="0 0 120 10"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M2 6.5C14 3.2 26 7.4 40 4.6c13-2.6 22 2.4 36 .4 14-2 26 1.8 42-1.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/**
 * The paper-collage signature: a polaroid pinned to the page with a handwritten
 * caption. Only plan screens (home, goals, retirement) and their empty states
 * use it; never next to a number someone has to read in a column.
 */
export function Polaroid({
  icon,
  caption,
  tilt = -2.5,
  className,
}: {
  icon: Icon3DName;
  caption: string;
  /** Degrees, between -3 and 3. */
  tilt?: number;
  className?: string;
}) {
  const style = { "--polaroid-tilt": `${Math.max(-3, Math.min(3, tilt))}deg` } as CSSProperties;
  return (
    <figure className={cn("polaroid", className)} style={style}>
      <div className="polaroid-photo">
        <Icon3D name={icon} size={64} />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/** The empty state of a plan screen: paper, polaroid, one sentence, one action. */
export function PlanEmpty({
  icon,
  caption,
  label,
  actionLabel,
  onAction,
}: {
  icon: Icon3DName;
  caption: string;
  label: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <PaperBand className="plan-empty">
      <Polaroid icon={icon} caption={caption} tilt={2} />
      <div className="plan-empty-copy">
        <strong>{label}</strong>
        <button type="button" className="primary" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </PaperBand>
  );
}
