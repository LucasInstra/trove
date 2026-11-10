export const KEEPER_SHAPES = ["round", "egg", "oval", "square", "blob", "pill"] as const;

export type KeeperShape = (typeof KEEPER_SHAPES)[number];

export const KEEPER_COLORS = [
  "#f0a2b2",
  "#e2778a",
  "#e9b949",
  "#8fd0b0",
  "#6aa6e0",
  "#a99bf5",
  "#c9b18a",
  "#7d8794",
  "#d97a4a",
  "#f3e6d0",
] as const;

export const KEEPER_EYES = ["dots", "bars", "arcs", "sleepy", "sparkle", "heart"] as const;

export type KeeperEye = (typeof KEEPER_EYES)[number];

export const KEEPER_EYE_SIZES = ["small", "medium", "large"] as const;
export const KEEPER_EYE_SPACINGS = ["close", "normal", "wide"] as const;
export const KEEPER_EYE_TILTS = ["soft", "straight", "sharp"] as const;
export const KEEPER_EYE_COLORS = ["auto", "#241d33", "#fff6dd", "#ffffff"] as const;

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
  tail: boolean;
  blush: boolean;
}

export const KEEPER_DEFAULT: KeeperLook = {
  shape: "round",
  color: "#f0a2b2",
  eyeStyle: "bars",
  eyeSize: "medium",
  eyeSpacing: "normal",
  eyeTilt: "soft",
  eyeColor: "auto",
  snout: true,
  ears: true,
  tail: true,
  blush: true,
};

const STORAGE_KEY = "trove.keeper.v1";

export function loadLook(): KeeperLook {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return KEEPER_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<KeeperLook>;
    const shape = KEEPER_SHAPES.includes(parsed.shape as KeeperShape)
      ? (parsed.shape as KeeperShape)
      : KEEPER_DEFAULT.shape;
    const eyeStyle = KEEPER_EYES.includes(parsed.eyeStyle as KeeperEye)
      ? (parsed.eyeStyle as KeeperEye)
      : KEEPER_DEFAULT.eyeStyle;
    return { ...KEEPER_DEFAULT, ...parsed, shape, eyeStyle };
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
