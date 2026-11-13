import { Icon, type IconName } from "./Icons";
import { cn } from "@/lib/utils";

/**
 * Card title marks. These used to be colourful 3D renders; the app now uses the
 * same linear icon family everywhere, in a small tinted chip, so a card title
 * reads like every other. Large decorative renders (`card-art`, 60px and up)
 * are dropped: they carried no information and pushed the figures down.
 */
const ICONS = {
  "chart-up": "trend",
  "credit-card": "card",
  house: "home",
  pie: "grid",
  piggy: "target",
  receipt: "file-text",
  scale: "scale",
  target: "target",
} as const satisfies Record<string, IconName>;

export type Icon3DName = keyof typeof ICONS;

interface Icon3DProps {
  name: Icon3DName;
  size?: number;
  className?: string;
  /** Only set this when the picture carries meaning on its own. */
  alt?: string;
}

export function Icon3D({ name, size = 40, className, alt }: Icon3DProps) {
  if (size >= 60 || className?.includes("card-art")) return null;
  return (
    <span
      className={cn("card-icon", className)}
      role={alt ? "img" : undefined}
      aria-label={alt}
      aria-hidden={alt ? undefined : true}
    >
      <Icon name={ICONS[name]} size={15} />
    </span>
  );
}
