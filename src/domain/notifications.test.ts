import { describe, expect, it } from "vitest";
import type { Bill } from "../lib/api";
import type { MonthPlan } from "./projection";
import { buildNotifications } from "./notifications";

const bill = (id: number, dueDay: number, name = `Bill ${id}`): Bill => ({
  id,
  name,
  amountCents: 10_000,
  dueDay,
  frequency: "monthly",
  categoryId: null,
  categoryName: null,
  categoryColor: null,
  accountId: null,
  goalId: null,
  startsOn: "2026-01-01",
  endsOn: null,
  installmentsTotal: null,
  active: true,
});

const plan = (dueBills: Bill[], paidBillIds: number[] = [], month = "2026-12"): MonthPlan =>
  ({
    month,
    dueBills,
    paidBillIds,
  }) as MonthPlan;

const today = "2026-12-10";

describe("buildNotifications", () => {
  it("flags a bill whose day has passed and is not paid", () => {
    const items = buildNotifications({
      plan: plan([bill(1, 5)], [], "2026-12"),
      cards: [],
      today,
      reads: [],
      hasIncome: true,
    });
    expect(items.map((item) => item.kind)).toEqual(["late"]);
    expect(items[0].key).toBe("bill:1:2026-12:late");
  });

  it("flags a bill due within three days", () => {
    const items = buildNotifications({
      plan: plan([bill(2, 12)], [], "2026-12"),
      cards: [],
      today,
      reads: [],
      hasIncome: true,
    });
    expect(items.map((item) => item.kind)).toEqual(["soon"]);
  });

  it("says nothing about a paid bill", () => {
    const items = buildNotifications({
      plan: plan([bill(3, 5)], [3], "2026-12"),
      cards: [],
      today,
      reads: [],
      hasIncome: true,
    });
    expect(items).toEqual([]);
  });

  it("drops what was already read", () => {
    const items = buildNotifications({
      plan: plan([bill(4, 5)], [], "2026-12"),
      cards: [],
      today,
      reads: ["bill:4:2026-12:late"],
      hasIncome: true,
    });
    expect(items).toEqual([]);
  });

  it("ignores another month and nags about the missing income", () => {
    const items = buildNotifications({
      plan: plan([bill(5, 5)], [], "2027-03"),
      cards: [],
      today,
      reads: [],
      hasIncome: false,
    });
    expect(items.map((item) => item.key)).toEqual(["plan:no-income"]);
  });
});
