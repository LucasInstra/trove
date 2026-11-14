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
export function BottomNav({
  items,
  label,
  className,
}: {
  items: BottomNavEntry[];
  label: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "bottom-nav fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onSelect}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "bottom-nav-item flex w-[68px] shrink-0 flex-col items-center gap-1 border-0 bg-transparent px-1 py-2 text-[10px] font-medium leading-[1.1] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-inset",
            item.active
              ? "bg-primary-soft font-semibold text-primary-strong [&_svg]:text-primary-strong"
              : "text-muted hover:text-ink",
          )}
        >
          {item.icon}
          <span className="min-w-0 max-w-full break-words text-center">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
