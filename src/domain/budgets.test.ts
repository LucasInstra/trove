import { describe, expect, it } from "vitest";
import { freeToSpend, paceOf } from "./budgets";

describe("paceOf", () => {
  it("stays ok while spending trails the pro-rata share", () => {
    // March has 31 days: by day 10 the share of 31000 is 10000.
    const pace = paceOf(9000, 31000, "2024-03-10", "2024-03");
    expect(pace.expectedCents).toBe(10000);
    expect(pace.status).toBe("ok");
    expect(pace.remainingCents).toBe(22000);
  });

  it("watches when spending runs ahead of the share", () => {
    const pace = paceOf(15000, 31000, "2024-03-10", "2024-03");
    expect(pace.status).toBe("watch");
  });

  it("flags over as soon as the cap breaks", () => {
    const pace = paceOf(32000, 31000, "2024-03-10", "2024-03");
    expect(pace.status).toBe("over");
    expect(pace.perDayCents).toBe(0);
  });

  it("reads past months final and future months untouched", () => {
    const past = paceOf(31000, 31000, "2024-04-02", "2024-03");
    expect(past.status).toBe("ok");
    const future = paceOf(0, 31000, "2024-02-02", "2024-03");
    expect(future.expectedCents).toBe(0);
    expect(future.status).toBe("ok");
  });

  it("divides what is left by the days left", () => {
    // 21000 left over the last 21 days of March: 1000 a day.
    const pace = paceOf(10000, 31000, "2024-03-11", "2024-03");
    expect(pace.perDayCents).toBe(1000);
  });
});

describe("freeToSpend", () => {
  it("subtracts spending from the whole-month cap", () => {
    expect(freeToSpend(4000, 10000)).toBe(6000);
    expect(freeToSpend(12000, 10000)).toBe(-2000);
  });

  it("refuses to guess without a cap", () => {
    expect(freeToSpend(4000, null)).toBe(null);
  });
});
