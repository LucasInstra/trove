import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0 to 100. Everything outside the range is clamped. */
  value: number;
  tone?: "primary" | "positive" | "negative";
  size?: "sm" | "md";
  label?: string;
}

const tones = {
  primary: "bg-primary",
  positive: "bg-positive",
  negative: "bg-negative",
};

export function Progress({
  value,
  tone = "primary",
  size = "md",
  label,
  className,
  ...props
}: ProgressProps) {
  const safe = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safe)}
      aria-label={label}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-bar-rest",
        size === "sm" ? "h-1.5" : "h-2.5",
        className,
      )}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", tones[tone])}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}
