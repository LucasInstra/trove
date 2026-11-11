import { describe, expect, it } from "vitest";
import type { Bill } from "../lib/api";
import { installmentEndMonth, installmentOf, monthOffset, remainingInstallments } from "./installment";

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

describe("installmentEndMonth", () => {
  it("lands on the last parcel across year boundaries", () => {
    expect(installmentEndMonth(bill())).toBe("2028-02");
    expect(installmentEndMonth(bill({ installmentsTotal: 1 }))).toBe("2026-03");
    expect(installmentEndMonth(bill({ installmentsTotal: 11 }))).toBe("2027-01");
  });

  it("returns null without a count", () => {
    expect(installmentEndMonth(bill({ installmentsTotal: null }))).toBeNull();
  });
});

describe("remainingInstallments", () => {
  it("counts what is still left to pay", () => {
    expect(remainingInstallments(bill(), "2026-11")).toEqual({ left: 15, leftCents: 15 * 250_00 });
    expect(remainingInstallments(bill(), "2028-02")).toEqual({ left: 0, leftCents: 0 });
  });

  it("returns null outside the run", () => {
    expect(remainingInstallments(bill(), "2026-02")).toBeNull();
  });
});
