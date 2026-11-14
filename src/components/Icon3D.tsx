import chartUp from "@/assets/icons3d/chart-up.png";
import creditCard from "@/assets/icons3d/credit-card.png";
import house from "@/assets/icons3d/house.png";
import pie from "@/assets/icons3d/pie.png";
import piggy from "@/assets/icons3d/piggy.png";
import receipt from "@/assets/icons3d/receipt.png";
import scale from "@/assets/icons3d/scale.png";
import target from "@/assets/icons3d/target.png";
import chainCoin from "@/assets/icons3d/set2/chain-coin.png";
import coinSteps from "@/assets/icons3d/set2/coin-steps.png";
import trophy from "@/assets/icons3d/set2/trophy.png";
import people from "@/assets/icons3d/set2/people.png";
import houseKey from "@/assets/icons3d/set2/house-key.png";
import bars from "@/assets/icons3d/set2/bars.png";
import growth from "@/assets/icons3d/set2/growth.png";
import box from "@/assets/icons3d/set2/box.png";
import { cn } from "@/lib/utils";

/**
 * The 3D icon set that came as a sprite sheet: cut once into transparent PNGs and
 * used where a card needs a recognisable object. They are colourful renders, so
 * they only make sense at 28px and up; the linear `Icon` family stays for
 * controls and the sidebar.
 *
 * The imports are explicit on purpose: a glob would bundle all 24 renders for
 * the eight the app actually shows.
 */
const ICONS = {
  "chart-up": chartUp,
  "credit-card": creditCard,
  house,
  pie,
  piggy,
  receipt,
  scale,
  target,
  "chain-coin": chainCoin,
  "coin-steps": coinSteps,
  "trophy": trophy,
  "people": people,
  "house-key": houseKey,
  "bars": bars,
  "growth": growth,
  "box": box,
} as const;

export type Icon3DName = keyof typeof ICONS;

interface Icon3DProps {
  name: Icon3DName;
  size?: number;
  className?: string;
  /** Only set this when the picture carries meaning on its own. */
  alt?: string;
}

export function Icon3D({ name, size = 40, className, alt }: Icon3DProps) {
  return (
    <img
      src={ICONS[name]}
      width={size}
      height={size}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  );
}
