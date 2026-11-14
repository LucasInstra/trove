import { describe, expect, it } from "vitest";
import { vivid } from "./color";

describe("vivid", () => {
  it("leaves greys and non-hex values alone", () => {
    expect(vivid("#8b93a1")).toBe("#8b93a1");
    expect(vivid("red")).toBe("red");
  });

  it("raises the saturation of a muted colour and keeps its hue family", () => {
    const out = vivid("#4c9f70");
    const g = parseInt(out.slice(3, 5), 16);
    const r = parseInt(out.slice(1, 3), 16);
    expect(g).toBeGreaterThan(r);
    const spread = (hex: string) => {
      const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return Math.max(...v) - Math.min(...v);
    };
    expect(spread(out)).toBeGreaterThan(spread("#4c9f70"));
  });
});
