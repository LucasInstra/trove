import { describe, expect, it } from "vitest";
import {
  CARD_IDS,
  DEFAULT_LAYOUT,
  moveCard,
  parseLayout,
  resizeCard,
  serializeLayout,
  type LayoutCard,
} from "./layout";

describe("parseLayout", () => {
  it("falls back to the default for nothing, garbage or a non array", () => {
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout("")).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout("{not json")).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('{"a":1}')).toEqual(DEFAULT_LAYOUT);
  });

  it("keeps the stored order and drops what it does not know", () => {
    const stored = JSON.stringify([
      { id: "bills", span: 2 },
      { id: "ghost", span: 1 },
      { id: "forecast", span: 3 },
    ]);
    const layout = parseLayout(stored);
    expect(layout.slice(0, 3).map((entry) => entry.id)).toEqual(["bills", "forecast", "cards"]);
    expect(layout[0].span).toBe(2);
    expect(layout[1].span).toBe(3);
    expect(layout.some((entry) => (entry.id as string) === "ghost")).toBe(false);
  });

  it("clamps a span and ignores a duplicated card", () => {
    const stored = JSON.stringify([
      { id: "cards", span: 9 },
      { id: "cards", span: 1 },
      { id: "goals", span: -3 },
    ]);
    const layout = parseLayout(stored);
    expect(layout[0].span).toBe(3);
    expect(layout.filter((entry) => entry.id === "cards")).toHaveLength(1);
    expect(layout.find((entry) => entry.id === "goals")?.span).toBe(1);
  });

  it("always returns every card exactly once", () => {
    const layout = parseLayout(JSON.stringify([{ id: "series", span: 1 }]));
    expect(layout).toHaveLength(CARD_IDS.length);
    expect(new Set(layout.map((entry) => entry.id)).size).toBe(CARD_IDS.length);
  });
});

describe("moveCard", () => {
  const layout: LayoutCard[] = [
    { id: "forecast", span: 2 },
    { id: "bills", span: 1 },
    { id: "cards", span: 1 },
  ];

  it("swaps with the neighbour", () => {
    expect(moveCard(layout, "cards", -1).map((entry) => entry.id)).toEqual([
      "forecast",
      "cards",
      "bills",
    ]);
    expect(moveCard(layout, "forecast", 1).map((entry) => entry.id)).toEqual([
      "bills",
      "forecast",
      "cards",
    ]);
  });

  it("stays put at the edges", () => {
    expect(moveCard(layout, "forecast", -1)).toBe(layout);
    expect(moveCard(layout, "cards", 1).map((entry) => entry.id)).toEqual([
      "forecast",
      "bills",
      "cards",
    ]);
  });

  it("does nothing for an unknown card", () => {
    expect(moveCard(layout, "donut" as LayoutCard["id"], 1)).toBe(layout);
  });
});

describe("resizeCard", () => {
  it("clamps between one and three columns", () => {
    const layout = parseLayout(null);
    expect(resizeCard(layout, "bills", 1)[1].span).toBe(2);
    expect(resizeCard(layout, "bills", -1)[1].span).toBe(1);
    expect(resizeCard(layout, "series", 1).find((entry) => entry.id === "series")?.span).toBe(3);
  });
});

describe("serializeLayout", () => {
  it("round trips through parse", () => {
    const layout = resizeCard(moveCard(DEFAULT_LAYOUT, "cards", -1), "cards", 1);
    expect(parseLayout(serializeLayout(layout))).toEqual(layout);
  });
});
