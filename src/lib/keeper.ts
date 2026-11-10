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

export type KeeperEyeSize = (typeof KEEPER_EYE_SIZES)[number];
export type KeeperEyeSpacing = (typeof KEEPER_EYE_SPACINGS)[number];
export type KeeperEyeTilt = (typeof KEEPER_EYE_TILTS)[number];
export type KeeperEyeColor = (typeof KEEPER_EYE_COLORS)[number];

export type KeeperToggle = "snout" | "ears" | "tail" | "blush";

export interface KeeperLook {
  shape: KeeperShape;
  color: string;
  eyeStyle: KeeperEye;
  eyeSize: KeeperEyeSize;
  eyeSpacing: KeeperEyeSpacing;
  eyeTilt: KeeperEyeTilt;
  eyeColor: KeeperEyeColor;
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
const HEX = /^#[0-9a-f]{6}$/i;

function oneOf<T extends readonly string[]>(list: T, value: unknown): value is T[number] {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function defaultStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the saved look field by field. A value that no longer exists (a shape or
 * an eye style that was removed) or that has the wrong type falls back to the
 * default, and a sanitized copy is written back once so the same bad value is
 * not repaired on every launch.
 */
export function loadLook(storage: Storage | null = defaultStorage()): KeeperLook {
  if (!storage) return { ...KEEPER_DEFAULT };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { ...KEEPER_DEFAULT };
  }
  if (!raw) return { ...KEEPER_DEFAULT };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...KEEPER_DEFAULT };
  }

  const source: Record<string, unknown> =
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};

  const look: KeeperLook = {
    shape: oneOf(KEEPER_SHAPES, source.shape) ? source.shape : KEEPER_DEFAULT.shape,
    color:
      typeof source.color === "string" && HEX.test(source.color)
        ? source.color.toLowerCase()
        : KEEPER_DEFAULT.color,
    eyeStyle: oneOf(KEEPER_EYES, source.eyeStyle) ? source.eyeStyle : KEEPER_DEFAULT.eyeStyle,
    eyeSize: oneOf(KEEPER_EYE_SIZES, source.eyeSize) ? source.eyeSize : KEEPER_DEFAULT.eyeSize,
    eyeSpacing: oneOf(KEEPER_EYE_SPACINGS, source.eyeSpacing)
      ? source.eyeSpacing
      : KEEPER_DEFAULT.eyeSpacing,
    eyeTilt: oneOf(KEEPER_EYE_TILTS, source.eyeTilt) ? source.eyeTilt : KEEPER_DEFAULT.eyeTilt,
    eyeColor: oneOf(KEEPER_EYE_COLORS, source.eyeColor)
      ? source.eyeColor
      : KEEPER_DEFAULT.eyeColor,
    snout: typeof source.snout === "boolean" ? source.snout : KEEPER_DEFAULT.snout,
    ears: typeof source.ears === "boolean" ? source.ears : KEEPER_DEFAULT.ears,
    tail: typeof source.tail === "boolean" ? source.tail : KEEPER_DEFAULT.tail,
    blush: typeof source.blush === "boolean" ? source.blush : KEEPER_DEFAULT.blush,
  };

  const repaired = JSON.stringify(look) !== raw;
  if (repaired) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(look));
    } catch {
      // a full or blocked storage keeps the sanitized value in memory
    }
  }

  return look;
}

export function saveLook(look: KeeperLook, storage: Storage | null = defaultStorage()) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(look));
  } catch {
    // a private window without storage should not break the mascot
  }
}
