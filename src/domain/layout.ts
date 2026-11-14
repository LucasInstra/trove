/**
 * Dashboard layout: which cards exist, in what order, how wide each one is and
 * how much of it is shown.
 *
 * The layout is a small, validated list. A stored value is never trusted: an
 * unknown card is dropped, a missing one is appended with its default, the span
 * is clamped to the supported widths and an unknown mode falls back to a full
 * card. A layout saved before the third state existed only knew whether a card
 * was collapsed; see `modeOf` for how that value is read today.
 *
 * A card whose mode is `hidden` is off the dashboard, which is how the cards
 * that only make sense for some households stay optional. `isCardAvailable`
 * answers whether the data supports a card at all: the house split needs a
 * second person and the housing card needs rent to measure.
 */

export const CARD_IDS = [
  "kpis",
  "forecast",
  "inout",
  "bills",
  "recent",
  "series",
  "cards",
  "donut",
  "goals",
  "debts",
  "score",
  "installments",
  "housing",
  "split",
] as const;

export type CardId = (typeof CARD_IDS)[number];
export type Span = 1 | 2 | 3;

/**
 * The widths that make sense for each card. A single gauge has nothing to gain
 * from three columns, so the grid only
 * offers the range that carries content. Growing past it would stretch the same
 * thing over a wider box, which is exactly the empty space this avoids.
 */
export const CARD_SPANS: Record<CardId, { min: Span; max: Span }> = {
  kpis: { min: 1, max: 3 },
  forecast: { min: 1, max: 3 },
  bills: { min: 1, max: 2 },
  inout: { min: 1, max: 3 },
  recent: { min: 1, max: 2 },
  donut: { min: 1, max: 2 },
  series: { min: 1, max: 3 },
  cards: { min: 1, max: 3 },
  installments: { min: 1, max: 2 },
  housing: { min: 1, max: 2 },
  goals: { min: 1, max: 2 },
  score: { min: 1, max: 1 },
  split: { min: 1, max: 3 },
  debts: { min: 1, max: 2 },
};

export function spanOptions(id: CardId): Span[] {
  const { min, max } = CARD_SPANS[id];
  return Array.from({ length: max - min + 1 }, (_, offset) => (min + offset) as Span);
}

/** Off the dashboard, the full card, or the one-chip summary. */
export const CARD_MODES = ["hidden", "full", "mini"] as const;
export type CardMode = (typeof CARD_MODES)[number];

export const MIN_CARD_HEIGHT = 160;
export const MAX_CARD_HEIGHT = 1200;
export const CARD_HEIGHT_STEP = 8;

export interface LayoutCard {
  id: CardId;
  span: Span;
  mode: CardMode;
  /** Minimum height in CSS pixels; omitted means size to content. */
  height?: number;
}

/**
 * Three cards per row at one column each, with the bills card taking two so its
 * list has room: 1+1+1 | 2+1 | 1+1+1 | 1+1+1 | 1+1. The house split starts off
 * the dashboard because most households do not split anything.
 */
export const DEFAULT_LAYOUT: LayoutCard[] = [
  { id: "kpis", span: 1, mode: "full" },
  { id: "forecast", span: 1, mode: "full" },
  { id: "inout", span: 1, mode: "full" },
  { id: "bills", span: 2, mode: "full" },
  { id: "recent", span: 1, mode: "full" },
  { id: "series", span: 1, mode: "full" },
  { id: "cards", span: 1, mode: "full" },
  { id: "donut", span: 1, mode: "full" },
  { id: "goals", span: 1, mode: "full" },
  { id: "debts", span: 1, mode: "full" },
  { id: "score", span: 1, mode: "full" },
  { id: "installments", span: 1, mode: "full" },
  { id: "housing", span: 1, mode: "full" },
  { id: "split", span: 1, mode: "hidden" },
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

const clampSpan = (value: unknown, fallback: Span): Span => {
  const numeric = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(3, Math.max(1, numeric)) as Span;
};

/** Clamps a width to the range the card actually supports. */
const clampSpanFor = (id: CardId, value: unknown, fallback: Span): Span => {
  const { min, max } = CARD_SPANS[id];
  return Math.min(max, Math.max(min, clampSpan(value, fallback))) as Span;
};

/** Snaps a height to the step and clamps it to the supported range. */
export function normalizeHeight(value: number): number;
export function normalizeHeight(value: unknown): number | undefined;
export function normalizeHeight(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const snapped = Math.round(value / CARD_HEIGHT_STEP) * CARD_HEIGHT_STEP;
  return Math.min(MAX_CARD_HEIGHT, Math.max(MIN_CARD_HEIGHT, snapped));
}

const isCardId = (value: unknown): value is CardId =>
  typeof value === "string" && (CARD_IDS as readonly string[]).includes(value);

const isMode = (value: unknown): value is CardMode =>
  typeof value === "string" && (CARD_MODES as readonly string[]).includes(value);

const defaultSpan = (id: CardId): Span =>
  DEFAULT_LAYOUT.find((entry) => entry.id === id)?.span ?? 1;

function modeOf(entry: { mode?: unknown; collapsed?: unknown }): CardMode {
  if (isMode(entry.mode)) return entry.mode;
  // The lean card was folded into the one-column width, which says the same.
  if (entry.mode === "reduced") return "full";
  // An older layout only stored whether the card was collapsed, and the step
  // between full and the one-line chip no longer exists.
  if (entry.collapsed === true) return "mini";
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
    const card = entry as { span?: unknown; mode?: unknown; collapsed?: unknown; height?: unknown };
    const height = normalizeHeight(card.height);
    layout.push({
      id,
      span: clampSpanFor(id, card.span, defaultSpan(id)),
      mode: modeOf(card),
      ...(height === undefined ? {} : { height }),
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
 * The value is clamped to the card's own range, so a control can never stretch a
 * card past what it has to show.
 */
export function setSpan(layout: LayoutCard[], id: CardId, span: number): LayoutCard[] {
  const range = CARD_SPANS[id];
  if (!range) return layout;
  const next = clampSpanFor(id, span, range.min);
  if (!layout.some((entry) => entry.id === id && entry.span !== next)) return layout;
  return layout.map((entry) => (entry.id === id ? { ...entry, span: next } : entry));
}

/** Applies the width and minimum height selected by the resize handle. */
export function resizeCard(
  layout: LayoutCard[],
  id: CardId,
  span: number,
  height: number | null,
): LayoutCard[] {
  const range = CARD_SPANS[id];
  if (!range) return layout;
  const nextSpan = clampSpanFor(id, span, range.min);
  const nextHeight = normalizeHeight(height ?? undefined);
  const current = layout.find((entry) => entry.id === id);
  if (!current || (current.span === nextSpan && current.height === nextHeight)) return layout;
  return layout.map((entry) => {
    if (entry.id !== id) return entry;
    if (nextHeight === undefined) {
      const autoSized = { ...entry };
      delete autoSized.height;
      return { ...autoSized, span: nextSpan };
    }
    return { ...entry, span: nextSpan, height: nextHeight };
  });
}

/** The step a card takes when its size control is pressed. */
export function nextMode(mode: CardMode): CardMode {
  return mode === "full" ? "mini" : "full";
}

export function setMode(layout: LayoutCard[], id: CardId, mode: CardMode): LayoutCard[] {
  const next = isMode(mode) ? mode : "full";
  if (!layout.some((entry) => entry.id === id && entry.mode !== next)) return layout;
  return layout.map((entry) => {
    if (entry.id !== id) return entry;
    const changed = { ...entry, mode: next };
    delete changed.height;
    return changed;
  });
}

export function serializeLayout(layout: LayoutCard[]): string {
  return JSON.stringify(
    layout.map(({ id, span, mode, height }) => ({
      id,
      span,
      mode,
      ...(height === undefined ? {} : { height }),
    })),
  );
}
