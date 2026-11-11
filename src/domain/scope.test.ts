import { describe, expect, it } from "vitest";
import type { Bill } from "../lib/api";
import { scopeOfBill } from "./scope";

const bill = (patch: Partial<Bill> = {}): Bill => ({
  id: 1,
  name: "Bill",
  amountCents: 100_00,
  dueDay: 5,
  frequency: "monthly",
  categoryId: 7,
  categoryName: null,
  categoryColor: null,
  accountId: null,
  goalId: null,
  startsOn: "2026-01-01",
  endsOn: null,
  installmentsTotal: null,
  active: true,
  ...patch,
});

describe("scopeOfBill", () => {
  it("marks the housing category as of the house", () => {
    expect(scopeOfBill(bill(), 7)).toBe("house");
  });

  it("treats everything else as personal", () => {
    expect(scopeOfBill(bill({ categoryId: 9 }), 7)).toBe("personal");
    expect(scopeOfBill(bill({ categoryId: null }), 7)).toBe("personal");
    expect(scopeOfBill(bill(), null)).toBe("personal");
  });
});
