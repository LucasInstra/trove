/**
 * Dashboard layout: which cards exist, in what order, how wide each one is and
 * how much of it is shown.
 *
 * The layout is a small, validated list. A stored value is never trusted: an
 * unknown card is dropped, a missing one is appended with its default, the span
 * is clamped to the three columns the grid has and an unknown mode falls back to
 * a full card. A layout saved before the third state existed only knew whether a
 * card was collapsed, and that still reads as a compact card.
 *
 * A card whose mode is `hidden` is off the dashboard, which is how the cards
 * that only make sense for some households stay optional. `isCardAvailable`
 * answers whether the data supports a card at all: the house split needs a
 * second person and the housing card needs rent to measure.
 */

export const CARD_IDS = [
  "forecast",
  "bills",
  "cards",
  "housing",
  "goals",
  "split",
  "donut",
  "series",
] as const;

export type CardId = (typeof CARD_IDS)[number];
export type Span = 1 | 2 | 3;

/**
 * Off the dashboard, full card, full card without its detail section, one line
 * summary, or the smallest line.
 */
export const CARD_MODES = ["hidden", "full", "reduced", "compact", "mini"] as const;
export type CardMode = (typeof CARD_MODES)[number];

export interface LayoutCard {
  id: CardId;
  span: Span;
  mode: CardMode;
}

export const DEFAULT_LAYOUT: LayoutCard[] = [
  { id: "forecast", span: 2, mode: "full" },
  { id: "bills", span: 1, mode: "full" },
  { id: "cards", span: 2, mode: "full" },
  { id: "housing", span: 1, mode: "full" },
  { id: "goals", span: 1, mode: "full" },
  { id: "split", span: 2, mode: "full" },
  { id: "donut", span: 1, mode: "full" },
  { id: "series", span: 2, mode: "full" },
];

/** What the plan says about the household, for the cards that depend on it. */
export interface CardContext {
  people: number;
  housingCents: number;
}

export function isCardAvailable(id: CardId, context: CardContext): boolean {
  if (id === "split") return context.people > 1;
  if (id === "housing") return context.housingCents > 0;
  return true;
}

/** Whether the card has a second block that can be hidden on its own. */
export function hasDetailsSection(id: CardId): boolean {
  return id === "cards";
}

const clampSpan = (value: unknown, fallback: Span): Span => {
  const numeric = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(3, Math.max(1, numeric)) as Span;
};

const isCardId = (value: unknown): value is CardId =>
  typeof value === "string" && (CARD_IDS as readonly string[]).includes(value);

const isMode = (value: unknown): value is CardMode =>
  typeof value === "string" && (CARD_MODES as readonly string[]).includes(value);

const defaultSpan = (id: CardId): Span =>
  DEFAULT_LAYOUT.find((entry) => entry.id === id)?.span ?? 1;

function modeOf(entry: { mode?: unknown; collapsed?: unknown }): CardMode {
  if (isMode(entry.mode)) return entry.mode;
  // An older layout only stored whether the card was collapsed.
  if (entry.collapsed === true) return "compact";
  return "full";
}

export function parseLayout(raw: string | null | undefined): LayoutCard[] {
  if (!raw) return DEFAULT_LAYOUT.map((entry) => ({ ...entry }));

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_LAYOUT.map((entry) => ({ ...entry }));
  }
  if (!Array.isArray(parsed)) return DEFAULT_LAYOUT.map((entry) => ({ ...entry }));

  const seen = new Set<CardId>();
  const layout: LayoutCard[] = [];
  for (const entry of parsed) {
    const id = typeof entry === "object" && entry !== null ? (entry as { id?: unknown }).id : null;
    if (!isCardId(id) || seen.has(id)) continue;
    seen.add(id);
    const card = entry as { span?: unknown; mode?: unknown; collapsed?: unknown };
    layout.push({
      id,
      span: clampSpan(card.span, defaultSpan(id)),
      mode: modeOf(card),
    });
  }

  // A card added to the app after the layout was saved still shows up.
  for (const id of CARD_IDS) {
    if (!seen.has(id)) layout.push({ id, span: defaultSpan(id), mode: "full" });
  }
  return layout;
}

/**
 * Inserts `id` at the index of `targetId`. Moving down puts the card after the
 * target and shifts the cards in between up, which is what a drop on a card means.
 */
export function moveCardTo(layout: LayoutCard[], id: CardId, targetId: CardId): LayoutCard[] {
  if (id === targetId) return layout;
  const from = layout.findIndex((entry) => entry.id === id);
  const to = layout.findIndex((entry) => entry.id === targetId);
  if (from < 0 || to < 0) return layout;
  const next = [...layout];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Picks a width outright, which is what the numbered control in the toolbar does.
 * A width it cannot read falls back to one column, the same fallback parseLayout
 * uses for a value it cannot trust.
 */
export function setSpan(layout: LayoutCard[], id: CardId, span: number): LayoutCard[] {
  const changed = layout.some((entry) => entry.id === id && entry.span !== clampSpan(span, 1));
  if (!changed) return layout;
  return layout.map((entry) =>
    entry.id === id ? { ...entry, span: clampSpan(span, 1) } : entry,
  );
}

/**
 * The steps a card takes when its size control is pressed. A card with a detail
 * block drops that block first, so the labelled button always names the next
 * thing that will happen.
 */
export function nextMode(mode: CardMode, hasDetails = false): CardMode {
  switch (mode) {
    case "full":
      return hasDetails ? "reduced" : "compact";
    case "reduced":
      return "compact";
    case "compact":
      return "mini";
    case "mini":
      return "full";
    default:
      return "full";
  }
}

export function setMode(layout: LayoutCard[], id: CardId, mode: CardMode): LayoutCard[] {
  const next = isMode(mode) ? mode : "full";
  if (!layout.some((entry) => entry.id === id && entry.mode !== next)) return layout;
  return layout.map((entry) => (entry.id === id ? { ...entry, mode: next } : entry));
}

export function serializeLayout(layout: LayoutCard[]): string {
  return JSON.stringify(
    layout.map((entry) => ({ id: entry.id, span: entry.span, mode: entry.mode })),
  );
}
