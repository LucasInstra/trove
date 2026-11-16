import { describe, expect, it } from "vitest";
import { applyOrder, moveId, parseCents } from "./BudgetSheet";

describe("budget row order", () => {
  const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

  it("follows the saved order and puts rows added since at the end", () => {
    expect(applyOrder(rows, [3, 1]).map((row) => row.id)).toEqual([3, 1, 2, 4]);
    expect(applyOrder(rows, []).map((row) => row.id)).toEqual([1, 2, 3, 4]);
  });

  it("drops a dragged row where it lands, going down or up", () => {
    expect(moveId([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
    expect(moveId([1, 2, 3, 4], 4, 2)).toEqual([1, 4, 2, 3]);
    expect(moveId([1, 2, 3, 4], 2, 2)).toEqual([1, 2, 3, 4]);
  });
});

describe("budget amounts", () => {
  it("reads a thousands dot, a decimal comma and a decimal dot", () => {
    expect(parseCents("1.500")).toBe(150000);
    expect(parseCents("1.234,56")).toBe(123456);
    expect(parseCents("1500.50")).toBe(150050);
    expect(parseCents("abc")).toBeNull();
  });
});
