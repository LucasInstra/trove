/**
 * Dashboard layout: which cards exist, in what order, and how wide each one is.
 *
 * The layout is a small, validated list. A stored value is never trusted: an
 * unknown card is dropped, a missing one is appended with its default, and the
 * span is clamped to the three columns the grid has.
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

export interface LayoutCard {
  id: CardId;
  span: Span;
}

export const DEFAULT_LAYOUT: LayoutCard[] = [
  { id: "forecast", span: 2 },
  { id: "bills", span: 1 },
  { id: "cards", span: 2 },
  { id: "housing", span: 1 },
  { id: "goals", span: 1 },
  { id: "split", span: 2 },
  { id: "donut", span: 1 },
  { id: "series", span: 2 },
];

const clampSpan = (value: unknown, fallback: Span): Span => {
  const numeric = typeof value === "number" ? Math.round(value) : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(3, Math.max(1, numeric)) as Span;
};

const isCardId = (value: unknown): value is CardId =>
  typeof value === "string" && (CARD_IDS as readonly string[]).includes(value);

const defaultSpan = (id: CardId): Span =>
  DEFAULT_LAYOUT.find((entry) => entry.id === id)?.span ?? 1;

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
    layout.push({ id, span: clampSpan((entry as { span?: unknown }).span, defaultSpan(id)) });
  }

  // A card added to the app after the layout was saved still shows up.
  for (const id of CARD_IDS) {
    if (!seen.has(id)) layout.push({ id, span: defaultSpan(id) });
  }
  return layout;
}

export function moveCard(layout: LayoutCard[], id: CardId, delta: number): LayoutCard[] {
  const index = layout.findIndex((entry) => entry.id === id);
  if (index < 0) return layout;
  const target = Math.min(layout.length - 1, Math.max(0, index + delta));
  if (target === index) return layout;
  const next = [...layout];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

export function resizeCard(layout: LayoutCard[], id: CardId, delta: number): LayoutCard[] {
  return layout.map((entry) =>
    entry.id === id ? { ...entry, span: clampSpan(entry.span + delta, entry.span) } : entry,
  );
}

export function serializeLayout(layout: LayoutCard[]): string {
  return JSON.stringify(layout.map((entry) => ({ id: entry.id, span: entry.span })));
}
