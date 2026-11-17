import { describe, expect, it } from "vitest";
import { cryptoResult } from "./crypto";

describe("cryptoResult", () => {
  it("is a gain when it is worth more than was paid", () => {
    const result = cryptoResult([{ costCents: 100_000, amountCents: 125_000 }]);
    expect(result).toEqual({ costCents: 100_000, valueCents: 125_000, gainCents: 25_000, pct: 25 });
  });

  it("is a loss when it is worth less, summed over holdings", () => {
    const result = cryptoResult([
      { costCents: 100_000, amountCents: 60_000 },
      { costCents: 100_000, amountCents: 100_000 },
    ]);
    expect(result.gainCents).toBe(-40_000);
    expect(result.pct).toBe(-20);
  });

  it("has no percentage when nothing was paid in", () => {
    expect(cryptoResult([{ costCents: 0, amountCents: 5_000 }]).pct).toBeNull();
  });
});
