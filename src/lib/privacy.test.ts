import { afterEach, describe, expect, it } from "vitest";
import { formatCents, formatDelta, formatSignedCents, setDisplayCurrency } from "./format";
import { MASK, setPrivate } from "./privacy";

afterEach(() => {
  setPrivate(false);
  setDisplayCurrency("BRL");
});

describe("privacy", () => {
  it("masks every money formatter while on, and restores them after", () => {
    setPrivate(true);
    expect(formatCents(123456)).toBe(MASK);
    expect(formatSignedCents(-5000)).toBe(MASK);
    expect(formatDelta(-5000)).toBe(MASK);
    setPrivate(false);
    expect(formatCents(123456)).toContain("1.234,56");
  });

  it("uses the chosen display currency symbol in the mask", () => {
    setPrivate(true);
    setDisplayCurrency("USD");
    expect(formatCents(123456)).toBe("US$ ••••");
    setDisplayCurrency("EUR");
    expect(formatDelta(-999)).toBe("€ ••••");
    setDisplayCurrency("BRL");
    expect(formatCents(123456)).toBe(MASK);
  });
});
