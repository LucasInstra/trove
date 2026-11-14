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
 * The widths that make sense for each card. A card only grows to a width where
 * it has more to show: the cards card adds the upcoming invoices and then the
 * invoice lines, the charts add months, the lists add rows. A card whose
 * content would just stretch over a wider box stays one column, which is
 * exactly the empty space this avoids.
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
  installments: { min: 1, max: 1 },
  housing: { min: 1, max: 2 },
  goals: { min: 1, max: 2 },
  score: { min: 1, max: 1 },
  split: { min: 1, max: 1 },
  debts: { min: 1, max: 1 },
};

export function spanOptions(id: CardId): Span[] {
  const { min, max } = CARD_SPANS[id];
  return Array.from({ length: max - min + 1 }, (_, offset) => (min + offset) as Span);
}

/** Off the dashboard, or on it. */
const CARD_MODES = ["hidden", "full"] as const;
export type CardMode = (typeof CARD_MODES)[number];

/** Cards whose content is a list or a chart can be made taller or shorter by hand. */
export const HEIGHT_CARDS: readonly CardId[] = [
  "bills",
  "recent",
  "series",
  "inout",
  "donut",
  "goals",
  "cards",
  "installments",
  "debts",
  "kpis",
  "forecast",
];
export const MIN_CARD_HEIGHT = 200;
export const MAX_CARD_HEIGHT = 1200;

export interface LayoutCard {
  id: CardId;
  span: Span;
  mode: CardMode;
  /** Height in pixels chosen by the user; absent means the card sizes to its content. */
  height?: number;
  /** First of the three columns the card sits in; absent means the grid places it. */
  col?: number;
}

export const GRID_COLUMNS = 3;

const clampCol = (span: number, col: unknown): number | undefined =>
  typeof col === "number" && Number.isInteger(col) && col >= 1
    ? Math.min(col, GRID_COLUMNS - span + 1)
    : undefined;

/**
 * The column each card starts in. A card with a saved column keeps it; the others
 * go where the columns are emptiest, in order, which for a fresh layout gives the
 * same arrangement a plain left-to-right flow would.
 */
export function resolveColumns(cards: LayoutCard[]): Map<CardId, number> {
  const fill = Array.from({ length: GRID_COLUMNS }, () => 0);
  const placed = new Map<CardId, number>();
  for (const card of cards) {
    const col = clampCol(card.span, card.col);
    if (col === undefined) continue;
    placed.set(card.id, col);
  }
  for (const card of cards) {
    let col = placed.get(card.id);
    if (col === undefined) {
      let best = 1;
      let bestFill = Number.POSITIVE_INFINITY;
      for (let start = 1; start <= GRID_COLUMNS - card.span + 1; start += 1) {
        const level = Math.max(...fill.slice(start - 1, start - 1 + card.span));
        if (level < bestFill) {
          best = start;
          bestFill = level;
        }
      }
      col = best;
      placed.set(card.id, col);
    }
    const level = Math.max(...fill.slice(col - 1, col - 1 + card.span)) + 1;
    for (let index = col - 1; index < col - 1 + card.span; index += 1) fill[index] = level;
  }
  return placed;
}

/**
 * Drops `id` into column `col`, right before `beforeId` (or at the end of the
 * order when null). Every card in `resolved` gets its column written down, so
 * placing one card never lets the others drift to a new spot.
 */
export function placeCard(
  layout: LayoutCard[],
  resolved: Map<CardId, number>,
  id: CardId,
  col: number,
  beforeId: CardId | null,
): LayoutCard[] {
  const from = layout.findIndex((entry) => entry.id === id);
  if (from < 0) return layout;
  const stamped = layout.map((entry) => {
    const own = resolved.get(entry.id);
    const wanted = entry.id === id ? clampCol(entry.span, col) : own;
    return wanted === undefined ? entry : { ...entry, col: wanted };
  });
  const [moved] = stamped.splice(from, 1);
  const to = beforeId === null ? -1 : stamped.findIndex((entry) => entry.id === beforeId);
  if (to < 0) stamped.push(moved);
  else stamped.splice(to, 0, moved);
  return stamped;
}

/** A stored height is kept only for cards that can be resized, and clamped to a sane range. */
export function clampHeight(id: CardId, value: unknown): number | undefined {
  if (!HEIGHT_CARDS.includes(id)) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(MAX_CARD_HEIGHT, Math.max(MIN_CARD_HEIGHT, Math.round(value)));
}

/** Sets the height of one card; null puts it back to sizing by content. */
export function setHeight(layout: LayoutCard[], id: CardId, height: number | null): LayoutCard[] {
  const next = height === null ? undefined : clampHeight(id, height);
  if (!layout.some((entry) => entry.id === id && entry.height !== next)) return layout;
  return layout.map((entry) => {
    if (entry.id !== id) return entry;
    const { height: _previous, ...rest } = entry;
    void _previous;
    return next === undefined ? rest : { ...rest, height: next };
  });
}

/**
 * Three cards per row at one column each, with the bills card taking two so its
 * list has room: 1+1+1 | 2+1 | 1+1+1 | 1+1+1 | 1+1. The house split starts off
 * the dashboard because most households do not split anything.
 */
export const DEFAULT_LAYOUT: LayoutCard[] = [
  { id: "forecast", span: 1, mode: "full" },
  { id: "kpis", span: 1, mode: "full" },
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
  // A one-line chip (or a collapsed card) no longer exists: the card is shown whole.
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
    const height = clampHeight(id, card.height);
    const span = clampSpanFor(id, card.span, defaultSpan(id));
    const col = clampCol(span, (card as { col?: unknown }).col);
    layout.push({
      id,
      span,
      mode: modeOf(card),
      ...(height === undefined ? {} : { height }),
      ...(col === undefined ? {} : { col }),
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
 * Puts `id` right before or right after `targetId`, whichever side the card was
 * dropped on. Unlike `moveCardTo` the side is explicit, so a card can be placed
 * after the last card of a row instead of taking that card's slot.
 */
export function moveCardNear(
  layout: LayoutCard[],
  id: CardId,
  targetId: CardId,
  side: "before" | "after",
): LayoutCard[] {
  if (id === targetId) return layout;
  const from = layout.findIndex((entry) => entry.id === id);
  if (from < 0 || !layout.some((entry) => entry.id === targetId)) return layout;
  const next = [...layout];
  const [moved] = next.splice(from, 1);
  const to = next.findIndex((entry) => entry.id === targetId);
  next.splice(side === "after" ? to + 1 : to, 0, moved);
  const same = next.every((entry, index) => entry.id === layout[index].id);
  return same ? layout : next;
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
  return layout.map((entry) => {
    if (entry.id !== id) return entry;
    const col = entry.col === undefined ? undefined : clampCol(next, entry.col);
    const { col: _col, ...rest } = entry;
    void _col;
    return { ...rest, span: next, ...(col === undefined ? {} : { col }) };
  });
}

/** Puts one card back to its default width and to sizing by its content; its place and visibility stay. */
export function resetCard(layout: LayoutCard[], id: CardId): LayoutCard[] {
  const span = defaultSpan(id);
  return layout.map((entry) => {
    if (entry.id !== id) return entry;
    const { height: _height, ...rest } = entry;
    void _height;
    const col = entry.col === undefined ? undefined : clampCol(span, entry.col);
    const { col: _col, ...bare } = rest;
    void _col;
    return { ...bare, span, ...(col === undefined ? {} : { col }) };
  });
}

export function setMode(layout: LayoutCard[], id: CardId, mode: CardMode): LayoutCard[] {
  const next = isMode(mode) ? mode : "full";
  if (!layout.some((entry) => entry.id === id && entry.mode !== next)) return layout;
  return layout.map((entry) => (entry.id === id ? { ...entry, mode: next } : entry));
}

export function serializeLayout(layout: LayoutCard[]): string {
  return JSON.stringify(
    layout.map(({ id, span, mode, height, col }) => ({
      id,
      span,
      mode,
      ...(height ? { height } : {}),
      ...(col ? { col } : {}),
    })),
  );
}
