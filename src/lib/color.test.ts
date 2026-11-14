import { describe, expect, it } from "vitest";
import { DATA_OTHER, DATA_RAMP, rampOf } from "./color";

describe("rampOf", () => {
  it("maps the first five distinct colours onto the ramp, in order", () => {
    const stored = ["#e91e63", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7"];
    const ramp = rampOf(stored);
    stored.forEach((hex, index) => expect(ramp(hex)).toBe(DATA_RAMP[index]));
  });

  it("sends the rest, greys and unknown values to slate", () => {
    const ramp = rampOf(["#e91e63", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#8b93a1"]);
    expect(ramp("#ef4444")).toBe(DATA_OTHER);
    expect(ramp("#8b93a1")).toBe(DATA_OTHER);
    expect(ramp("#123456")).toBe(DATA_OTHER);
  });
});
