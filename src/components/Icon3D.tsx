import plane from "@/assets/icons3d/plane.png";
import shield from "@/assets/icons3d/shield.png";
import umbrella from "@/assets/icons3d/umbrella.png";
import safe from "@/assets/icons3d/safe.png";
import sprout from "@/assets/icons3d/sprout.png";
import wallet from "@/assets/icons3d/wallet.png";
import bank from "@/assets/icons3d/bank.png";
import calendar from "@/assets/icons3d/calendar.png";
import checklist from "@/assets/icons3d/checklist.png";
import trophy from "@/assets/icons3d/trophy.png";
import coins from "@/assets/icons3d/coins.png";
import gear from "@/assets/icons3d/gear.png";
import chartUp from "@/assets/icons3d/chart-up.png";
import creditCard from "@/assets/icons3d/credit-card.png";
import house from "@/assets/icons3d/house.png";
import pie from "@/assets/icons3d/pie.png";
import piggy from "@/assets/icons3d/piggy.png";
import receipt from "@/assets/icons3d/receipt.png";
import scale from "@/assets/icons3d/scale.png";
import target from "@/assets/icons3d/target.png";
import bars from "@/assets/icons3d/bars.png";
import badge from "@/assets/icons3d/badge.png";
import walletPlus from "@/assets/icons3d/wallet-plus.png";
import walletMinus from "@/assets/icons3d/wallet-minus.png";
import { cn } from "@/lib/utils";

/**
 * The 3D icon set that came as a sprite sheet: cut once into transparent PNGs and
 * used where a card needs a recognisable object. They are colourful renders, so
 * they only make sense at 28px and up; the linear `Icon` family stays for
 * controls and the sidebar.
 *
 * The imports are explicit on purpose: a glob would bundle all 24 renders for
 * the ones the app actually shows.
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
  plane,
  shield,
  umbrella,
  safe,
  sprout,
  wallet,
  bank,
  calendar,
  checklist,
  trophy,
  coins,
  gear,
  bars,
  badge,
  "wallet-plus": walletPlus,
  "wallet-minus": walletMinus,
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
