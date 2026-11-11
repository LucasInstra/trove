import { describe, expect, it } from "vitest";
import type { Bill } from "../lib/api";
import { installmentOf, monthOffset } from "./installment";

const bill = (patch: Partial<Bill> = {}): Bill => ({
  id: 1,
  name: "Peugeot",
  amountCents: 250_00,
  dueDay: 20,
  frequency: "monthly",
  categoryId: null,
  categoryName: null,
  categoryColor: null,
  accountId: null,
  goalId: null,
  startsOn: "2026-03-01",
  endsOn: null,
  installmentsTotal: 24,
  active: true,
  ...patch,
});

describe("monthOffset", () => {
  it("counts whole months between YYYY-MM pairs", () => {
    expect(monthOffset("2026-03", "2026-03")).toBe(0);
    expect(monthOffset("2026-03", "2026-11")).toBe(8);
    expect(monthOffset("2026-03", "2028-02")).toBe(23);
    expect(monthOffset("2026-03", "2026-01")).toBe(-2);
  });
});

describe("installmentOf", () => {
  it("numbers the parcel inside the run", () => {
    expect(installmentOf(bill(), "2026-03")).toEqual({ current: 1, total: 24 });
    expect(installmentOf(bill(), "2026-11")).toEqual({ current: 9, total: 24 });
    expect(installmentOf(bill(), "2028-02")).toEqual({ current: 24, total: 24 });
  });

  it("returns null outside the run", () => {
    expect(installmentOf(bill(), "2026-02")).toBeNull();
    expect(installmentOf(bill(), "2028-03")).toBeNull();
  });

  it("returns null without an installment count or when inactive", () => {
    expect(installmentOf(bill({ installmentsTotal: null }), "2026-11")).toBeNull();
    expect(installmentOf(bill({ installmentsTotal: 0 }), "2026-11")).toBeNull();
    expect(installmentOf(bill({ active: false }), "2026-11")).toBeNull();
  });
});
