import { cn } from "@/lib/utils";

export interface BreakdownItem {
  name: string;
  color: string;
  value: number;
}

/**
 * The stacked progress bar the chart references use for a spending breakdown: one
 * bar split by share, then the same colours in the legend. It reads better than a
 * donut in a narrow card, because the names and the figures sit on a line instead
 * of around a ring.
 */
export function BreakdownBar({
  items,
  active,
  onActive,
  className,
}: {
  items: BreakdownItem[];
  active?: number | null;
  onActive?: (index: number | null) => void;
  className?: string;
}) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  if (total <= 0) return null;

  return (
    <div className={cn("breakdown-track", className)} role="img" aria-label={items.map((item) => item.name).join(", ")}>
      {items.map((item, index) => {
        const share = (Math.max(0, item.value) / total) * 100;
        return (
          <span
            key={item.name}
            className={cn("breakdown-seg", active === index && "active")}
            style={{
              flexBasis: `${share}%`,
              background: item.color,
              opacity: active === null || active === undefined || active === index ? 1 : 0.32,
            }}
            onPointerEnter={() => onActive?.(index)}
            onPointerLeave={() => onActive?.(null)}
            title={`${item.name}: ${Math.round(share)}%`}
          />
        );
      })}
    </div>
  );
}
