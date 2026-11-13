import { describe, expect, it } from "vitest";
import {
  CARD_IDS,
  DEFAULT_LAYOUT,
  hasDetailsSection,
  isCardAvailable,
  moveCardTo,
  nextMode,
  parseLayout,
  resizeCard,
  serializeLayout,
  setMode,
  setSpan,
  spanOptions,
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
    expect(layout.slice(0, 3).map((entry) => entry.id)).toEqual(["bills", "forecast", "kpis"]);
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
    // The intermediate step is gone, so a stored one reads as a full card.
    expect(layout.find((entry) => entry.id === "cards")?.mode).toBe("full");
    expect(layout.find((entry) => entry.id === "housing")?.mode).toBe("full");
    expect(layout.find((entry) => entry.id === "goals")?.mode).toBe("full");
  });

  it("reads the old collapsed flag as the smallest step", () => {
    const layout = parseLayout(
      JSON.stringify([
        { id: "bills", span: 1, collapsed: true },
        { id: "cards", span: 2, collapsed: false },
        { id: "housing", span: 1, collapsed: "yes" },
        { id: "goals", span: 1, collapsed: null },
      ]),
    );
    expect(layout.find((entry) => entry.id === "bills")?.mode).toBe("mini");
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

describe("moveCardTo", () => {
  const layout: LayoutCard[] = [
    { id: "forecast", span: 2, mode: "full" },
    { id: "bills", span: 1, mode: "full" },
    { id: "cards", span: 1, mode: "full" },
    { id: "housing", span: 1, mode: "full" },
  ];

  it("drops the card where the target sits", () => {
    expect(moveCardTo(layout, "housing", "bills").map((entry) => entry.id)).toEqual([
      "forecast",
      "housing",
      "bills",
      "cards",
    ]);
    expect(moveCardTo(layout, "forecast", "cards").map((entry) => entry.id)).toEqual([
      "bills",
      "cards",
      "forecast",
      "housing",
    ]);
  });

  it("ignores a drop on itself or on a card that is not there", () => {
    expect(moveCardTo(layout, "bills", "bills")).toBe(layout);
    expect(moveCardTo(layout, "bills", "donut" as LayoutCard["id"])).toBe(layout);
    expect(moveCardTo(layout, "donut" as LayoutCard["id"], "bills")).toBe(layout);
  });

  it("keeps every card", () => {
    const next = moveCardTo(DEFAULT_LAYOUT, "series", "forecast");
    expect(next).toHaveLength(DEFAULT_LAYOUT.length);
    expect(new Set(next.map((entry) => entry.id)).size).toBe(DEFAULT_LAYOUT.length);
    expect(next[0].id).toBe("kpis");
    expect(next[1].id).toBe("series");
  });
});

describe("nextMode", () => {
  it("walks full, mini and back", () => {
    expect(nextMode("full")).toBe("mini");
    expect(nextMode("mini")).toBe("full");
  });

  it("drops the detail block first when the card has one", () => {
    expect(nextMode("full", true)).toBe("reduced");
    expect(nextMode("reduced")).toBe("mini");
    expect(nextMode("reduced", true)).toBe("mini");
  });
});

describe("hasDetailsSection", () => {
  it("knows which card has a block of its own to hide", () => {
    expect(hasDetailsSection("cards")).toBe(true);
    for (const id of CARD_IDS.filter((entry) => entry !== "cards")) {
      expect(hasDetailsSection(id)).toBe(false);
    }
  });
});

describe("isCardAvailable", () => {
  it("asks for a second person before offering the house split", () => {
    expect(isCardAvailable("split", { people: 1, housingCents: 0 })).toBe(false);
    expect(isCardAvailable("split", { people: 2, housingCents: 0 })).toBe(true);
  });

  it("asks for rent before offering the housing card", () => {
    expect(isCardAvailable("housing", { people: 1, housingCents: 0 })).toBe(false);
    expect(isCardAvailable("housing", { people: 1, housingCents: 185_000 })).toBe(true);
  });

  it("always offers the cards that do not depend on the household", () => {
    const idle = { people: 1, housingCents: 0 };
    for (const id of ["forecast", "bills", "cards", "goals", "donut", "series"] as const) {
      expect(isCardAvailable(id, idle)).toBe(true);
    }
  });
});

describe("hidden cards", () => {
  it("parses a lean card and a card that was taken off the dashboard", () => {
    const lean = parseLayout(JSON.stringify([{ id: "cards", span: 2, mode: "reduced" }]));
    expect(lean.find((entry) => entry.id === "cards")?.mode).toBe("reduced");
  });

  it("parses a card that was taken off the dashboard", () => {
    const layout = parseLayout(JSON.stringify([{ id: "split", span: 1, mode: "hidden" }]));
    expect(layout.find((entry) => entry.id === "split")?.mode).toBe("hidden");
  });

  it("puts a card back as a full card", () => {
    const layout = parseLayout(JSON.stringify([{ id: "split", span: 2, mode: "hidden" }]));
    const back = setMode(layout, "split", "full");
    expect(back.find((entry) => entry.id === "split")?.mode).toBe("full");
    expect(back.find((entry) => entry.id === "split")?.span).toBe(2);
  });

  it("round trips a shelf of hidden cards", () => {
    const layout = setMode(setMode(parseLayout(null), "split", "hidden"), "housing", "mini");
    expect(parseLayout(serializeLayout(layout))).toEqual(layout);
  });
});

describe("setMode", () => {
  it("changes only the selected card without mutating the layout", () => {
    const layout = parseLayout(null);
    const next = setMode(layout, "bills", "mini");
    expect(next).not.toBe(layout);
    expect(next.find((entry) => entry.id === "bills")?.mode).toBe("mini");
    expect(next.find((entry) => entry.id === "forecast")?.mode).toBe("full");
    expect(layout.find((entry) => entry.id === "bills")?.mode).toBe("full");
    expect(setMode(next, "bills", "full").find((entry) => entry.id === "bills")?.mode).toBe("full");
  });

  it("fits a card to its content when its display mode changes", () => {
    const resized = resizeCard(parseLayout(null), "bills", 2, 320);
    const smallest = setMode(resized, "bills", "mini");
    const bills = smallest.find((entry) => entry.id === "bills");

    expect(bills?.mode).toBe("mini");
    expect(bills?.span).toBe(2);
    expect(bills?.height).toBeUndefined();
  });

  it("leaves an unknown card alone and keeps the same array", () => {
    const layout = parseLayout(null);
    expect(setMode(layout, "ghost" as LayoutCard["id"], "mini")).toBe(layout);
    expect(setMode(layout, "bills", "full")).toBe(layout);
  });

  it("treats a mode it does not know as a full card", () => {
    const layout = parseLayout(null);
    expect(setMode(layout, "bills", "tiny" as LayoutCard["mode"]).find((row) => row.id === "bills")?.mode).toBe(
      "full",
    );
  });
});

describe("setSpan", () => {
  const spanOf = (layout: LayoutCard[], id: LayoutCard["id"]) =>
    layout.find((entry) => entry.id === id)?.span;

  it("sets the width the control asked for", () => {
    const layout = parseLayout(null);
    expect(spanOf(setSpan(layout, "bills", 2), "bills")).toBe(2);
    expect(spanOf(setSpan(layout, "series", 2), "series")).toBe(2);
  });

  it("clamps to the card's own range, not just to the grid", () => {
    const layout = parseLayout(null);
    // A gauge has nothing to show in a wider box.
    expect(spanOf(setSpan(layout, "score", 3), "score")).toBe(1);
    // A single-column list cannot grow past two.
    expect(spanOf(setSpan(layout, "bills", 3), "bills")).toBe(2);
    // One column is the narrowest step, and the carousel accepts it.
    expect(spanOf(setSpan(layout, "cards", 1), "cards")).toBe(1);
    expect(spanOf(setSpan(layout, "bills", 0), "bills")).toBe(1);
  });

  it("falls back to the card's minimum on a width it cannot read", () => {
    const layout = parseLayout(null);
    expect(spanOf(setSpan(layout, "bills", Number.NaN), "bills")).toBe(1);
    expect(spanOf(setSpan(layout, "series", Number.NaN), "series")).toBe(1);
  });

  it("returns the same layout when the width does not change", () => {
    const layout = parseLayout(null);
    expect(setSpan(layout, "kpis", 1)).toBe(layout);
    expect(setSpan(layout, "ghost" as LayoutCard["id"], 2)).toBe(layout);
  });
});

describe("spanOptions", () => {
  it("offers only the widths the card supports", () => {
    expect(spanOptions("score")).toEqual([1]);
    expect(spanOptions("bills")).toEqual([1, 2]);
    expect(spanOptions("series")).toEqual([1, 2, 3]);
    expect(spanOptions("inout")).toEqual([1, 2, 3]);
  });
});

describe("resizeCard", () => {
  it("snaps and clamps a mouse-resized card size", () => {
    const layout = parseLayout(null);
    const next = resizeCard(layout, "inout", 2, 213);
    const inout = next.find((entry) => entry.id === "inout");

    expect(inout?.span).toBe(2);
    expect(inout?.height).toBe(216);
    expect(resizeCard(next, "inout", 8, 20).find((entry) => entry.id === "inout")).toMatchObject({
      span: 3,
      height: 160,
    });
    expect(layout.find((entry) => entry.id === "inout")).toMatchObject({ span: 1 });
  });

  it("supports old auto-height layouts and resetting back to content height", () => {
    const legacy = parseLayout(JSON.stringify([{ id: "bills", span: 2, mode: "full" }]));
    expect(legacy.find((entry) => entry.id === "bills")?.height).toBeUndefined();

    const resized = resizeCard(legacy, "bills", 2, 320);
    const autoSized = resizeCard(resized, "bills", 2, null);
    expect(autoSized.find((entry) => entry.id === "bills")?.height).toBeUndefined();
    expect(parseLayout(serializeLayout(resized))).toEqual(resized);
    expect(parseLayout(serializeLayout(autoSized))).toEqual(autoSized);
  });
});

describe("serializeLayout", () => {
  it("round trips through parse", () => {
    const layout = setMode(
      setSpan(moveCardTo(DEFAULT_LAYOUT, "cards", "forecast"), "cards", 3),
      "cards",
      "mini",
    );
    expect(parseLayout(serializeLayout(layout))).toEqual(layout);
  });
});
