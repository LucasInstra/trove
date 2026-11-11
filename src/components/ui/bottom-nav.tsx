import * as React from "react";
import { cn } from "@/lib/utils";

export interface BottomNavEntry {
  key: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onSelect: () => void;
}

/**
 * The same routes as the rail, for the narrow window. Only the icon and the
 * label fit, so it stays a plain row of buttons; the active one is the only
 * thing that takes the primary colour.
 */
export function BottomNav({ items, className }: { items: BottomNavEntry[]; className?: string }) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onSelect}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex flex-col items-center gap-1 border-0 bg-transparent py-2 text-2xs font-medium transition-colors outline-none focus-visible:bg-surface-soft",
            item.active ? "text-primary [&_svg]:text-primary" : "text-muted hover:text-ink",
          )}
        >
          {item.icon}
          <span className="truncate px-1">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
