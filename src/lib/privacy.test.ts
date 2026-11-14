import { afterEach, describe, expect, it } from "vitest";
import { formatCents, formatSignedCents } from "./format";
import { MASK, setPrivate } from "./privacy";

afterEach(() => setPrivate(false));

describe("privacy", () => {
  it("masks every money formatter while on, and restores them after", () => {
    setPrivate(true);
    expect(formatCents(123456)).toBe(MASK);
    expect(formatSignedCents(-5000)).toBe(MASK);
    setPrivate(false);
    expect(formatCents(123456)).toContain("1.234,56");
  });
});
