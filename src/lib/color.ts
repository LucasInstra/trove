/**
 * Categorical data colours: a single-hue ramp of the primary, not a rainbow.
 * The first five distinct stored colours (in category order) take the ramp;
 * everything else, and every grey ("Other", "Transfer"), is slate.
 */
export const DATA_RAMP = ["#1846e1", "#4a6ff0", "#7d97f5", "#b0c2fa", "#d9e2fd"] as const;
export const DATA_OTHER = "#64748b";

function isGrey(hex: string): boolean {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return true;
  const n = parseInt(match[1], 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (Math.max(...channels) - Math.min(...channels)) / 255 < 0.12;
}

/** Builds the stored-colour to ramp-colour lookup from the categories, in their order. */
export function rampOf(stored: string[]): (hex: string) => string {
  const order: string[] = [];
  for (const hex of stored) {
    const key = hex.trim().toLowerCase();
    if (!isGrey(key) && !order.includes(key)) order.push(key);
  }
  return (hex: string) => {
    const index = order.indexOf(hex.trim().toLowerCase());
    return index >= 0 && index < DATA_RAMP.length ? DATA_RAMP[index] : DATA_OTHER;
  };
}
