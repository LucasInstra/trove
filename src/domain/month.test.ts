import { describe, expect, it } from "vitest";
import { addMonths, monthRange } from "./month";

describe("monthRange", () => {
  it("walks forward from the start month", () => {
    expect(monthRange("2026-11", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("is empty for a non-positive count", () => {
    expect(monthRange("2026-11", 0)).toEqual([]);
    expect(monthRange("2026-11", -2)).toEqual([]);
  });

  it("agrees with addMonths across a year boundary", () => {
    expect(monthRange("2026-11", 4).at(-1)).toBe(addMonths("2026-11", 3));
  });
});
