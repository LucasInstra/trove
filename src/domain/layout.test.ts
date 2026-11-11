import { describe, expect, it } from "vitest";
import {
  CARD_IDS,
  DEFAULT_LAYOUT,
  moveCard,
  nextMode,
  parseLayout,
  resizeCard,
  serializeLayout,
  setMode,
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

  it("reads an unknown or missing mode as a full card", () => {
    const layout = parseLayout(
      JSON.stringify([
        { id: "bills", span: 1 },
        { id: "cards", span: 2, mode: "compact" },
        { id: "housing", span: 1, mode: "tiny" },
        { id: "goals", span: 1, mode: 3 },
      ]),
    );
    expect(layout.find((entry) => entry.id === "bills")?.mode).toBe("full");
    expect(layout.find((entry) => entry.id === "cards")?.mode).toBe("compact");
    expect(layout.find((entry) => entry.id === "housing")?.mode).toBe("full");
    expect(layout.find((entry) => entry.id === "goals")?.mode).toBe("full");
  });

  it("reads the old collapsed flag as a compact card", () => {
    const layout = parseLayout(
      JSON.stringify([
        { id: "bills", span: 1, collapsed: true },
        { id: "cards", span: 2, collapsed: false },
        { id: "housing", span: 1, collapsed: "yes" },
        { id: "goals", span: 1, collapsed: null },
      ]),
    );
    expect(layout.find((entry) => entry.id === "bills")?.mode).toBe("compact");
    expect(layout.find((entry) => entry.id === "cards")?.mode).toBe("full");
    expect(layout.find((entry) => entry.id === "housing")?.mode).toBe("full");
    expect(layout.find((entry) => entry.id === "goals")?.mode).toBe("full");
  });

  it("prefers an explicit mode over the old flag", () => {
    const layout = parseLayout(JSON.stringify([{ id: "bills", span: 1, mode: "mini", collapsed: true }]));
    expect(layout.find((entry) => entry.id === "bills")?.mode).toBe("mini");
  });

  it("always returns every card exactly once", () => {
    const layout = parseLayout(JSON.stringify([{ id: "series", span: 1 }]));
    expect(layout).toHaveLength(CARD_IDS.length);
    expect(new Set(layout.map((entry) => entry.id)).size).toBe(CARD_IDS.length);
  });
});

describe("moveCard", () => {
  const layout: LayoutCard[] = [
    { id: "forecast", span: 2, mode: "full" },
    { id: "bills", span: 1, mode: "full" },
    { id: "cards", span: 1, mode: "full" },
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

describe("nextMode", () => {
  it("walks full, compact, mini and back", () => {
    expect(nextMode("full")).toBe("compact");
    expect(nextMode("compact")).toBe("mini");
    expect(nextMode("mini")).toBe("full");
  });
});

describe("setMode", () => {
  it("changes only the selected card without mutating the layout", () => {
    const layout = parseLayout(null);
    const next = setMode(layout, "bills", "compact");
    expect(next).not.toBe(layout);
    expect(next.find((entry) => entry.id === "bills")?.mode).toBe("compact");
    expect(next.find((entry) => entry.id === "forecast")?.mode).toBe("full");
    expect(layout.find((entry) => entry.id === "bills")?.mode).toBe("full");
    expect(setMode(next, "bills", "mini").find((entry) => entry.id === "bills")?.mode).toBe("mini");
    expect(setMode(next, "bills", "full").find((entry) => entry.id === "bills")?.mode).toBe("full");
  });

  it("leaves an unknown card alone", () => {
    const layout = parseLayout(null);
    expect(setMode(layout, "ghost" as LayoutCard["id"], "mini")).toEqual(layout);
  });

  it("treats a mode it does not know as a full card", () => {
    const layout = parseLayout(null);
    expect(setMode(layout, "bills", "tiny" as LayoutCard["mode"]).find((row) => row.id === "bills")?.mode).toBe(
      "full",
    );
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
    const layout = setMode(
      resizeCard(moveCard(DEFAULT_LAYOUT, "cards", -1), "cards", 1),
      "cards",
      "mini",
    );
    expect(parseLayout(serializeLayout(layout))).toEqual(layout);
  });
});
