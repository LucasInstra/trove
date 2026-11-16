import { cn } from "@/lib/utils";

/**
 * The second batch of 3D renders, cut from the sprite sheets into
 * `assets/icons3d/set2/`. File names carry their group as a prefix: `goal-`,
 * `more-` (extra goals), `cat-` (spending categories), `tx-` (transactions),
 * `an-` (analysis), `sec-` (security), `acc-` (accounts and coins), `state-`
 * (success, error, warning...), `util-` and `onb-` (empty states, onboarding).
 *
 * Unlike `Icon3D`, which names its imports one by one, this takes the whole
 * folder: the goal picker alone uses about half of it, and the rest is there
 * for the screens that need a recognisable object. Same rule as `Icon3D`:
 * these are colourful renders, 28px and up.
 */
const FILES = import.meta.glob("../assets/icons3d/set2/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) {
  URLS[path.slice(path.lastIndexOf("/") + 1, -".png".length)] = url;
}

export function hasIcon3DSet(name: string): boolean {
  return name in URLS;
}

interface Icon3DSetProps {
  name: string;
  size?: number;
  className?: string;
  /** Only set this when the picture carries meaning on its own. */
  alt?: string;
}

export function Icon3DSet({ name, size = 40, className, alt }: Icon3DSetProps) {
  const src = URLS[name];
  if (!src) return null;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  );
}
