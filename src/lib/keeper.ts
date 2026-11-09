export const KEEPER_SHAPES = [
  "round",
  "oval",
  "egg",
  "pill",
  "square",
  "blob",
  "cloud",
  "hexagon",
  "drop",
  "star",
] as const;

export type KeeperShape = (typeof KEEPER_SHAPES)[number];

export const KEEPER_COLORS = [
  "#e9b949",
  "#f2a1b5",
  "#e2778a",
  "#8fd0b0",
  "#6aa6e0",
  "#a99bf5",
  "#c9b18a",
  "#7d8794",
  "#d97a4a",
  "#0f6b4f",
] as const;

export const KEEPER_EYES = [
  "dots",
  "bars",
  "arcs",
  "sleepy",
  "sparkle",
  "heart",
  "wink",
  "ring",
] as const;

export type KeeperEye = (typeof KEEPER_EYES)[number];

export const KEEPER_EYE_SIZES = ["small", "medium", "large"] as const;
export const KEEPER_EYE_SPACINGS = ["close", "normal", "wide"] as const;
export const KEEPER_EYE_TILTS = ["soft", "straight", "sharp"] as const;
export const KEEPER_EYE_COLORS = ["auto", "#241d33", "#fff6dd", "#ffffff"] as const;

export const SHAPE_LABELS: Record<KeeperShape, string> = {
  round: "Round",
  oval: "Oval",
  egg: "Egg",
  pill: "Pill",
  square: "Square",
  blob: "Blob",
  cloud: "Cloud",
  hexagon: "Hexagon",
  drop: "Drop",
  star: "Star",
};

export const EYE_LABELS: Record<KeeperEye, string> = {
  dots: "Dots",
  bars: "Bars",
  arcs: "Arcs",
  sleepy: "Sleepy",
  sparkle: "Sparkle",
  heart: "Heart",
  wink: "Wink",
  ring: "Ring",
};

export const SIZE_LABELS: Record<string, string> = {
  small: "S",
  medium: "M",
  large: "L",
};

export const SPACING_LABELS: Record<string, string> = {
  close: "Close",
  normal: "Normal",
  wide: "Wide",
};

export const TILT_LABELS: Record<string, string> = {
  soft: "Soft",
  straight: "Straight",
  sharp: "Sharp",
};

export interface KeeperLook {
  shape: KeeperShape;
  color: string;
  eyeStyle: KeeperEye;
  eyeSize: string;
  eyeSpacing: string;
  eyeTilt: string;
  eyeColor: string;
  snout: boolean;
  ears: boolean;
  slot: boolean;
  tail: boolean;
  blush: boolean;
}

export const KEEPER_DEFAULT: KeeperLook = {
  shape: "round",
  color: "#e9b949",
  eyeStyle: "bars",
  eyeSize: "medium",
  eyeSpacing: "normal",
  eyeTilt: "soft",
  eyeColor: "auto",
  snout: true,
  ears: true,
  slot: true,
  tail: true,
  blush: true,
};

const STORAGE_KEY = "trove.keeper.v1";

export function loadLook(): KeeperLook {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return KEEPER_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<KeeperLook>;
    return { ...KEEPER_DEFAULT, ...parsed };
  } catch {
    return KEEPER_DEFAULT;
  }
}

export function saveLook(look: KeeperLook) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(look));
  } catch {
    // a private window without storage should not break the mascot
  }
}
