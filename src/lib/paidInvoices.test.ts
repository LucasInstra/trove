import { describe, expect, it } from "vitest";
import { invoicePaymentsIn } from "./paidInvoices";

describe("invoicePaymentsIn", () => {
  const records = {
    "1:2026-11": { amountCents: 57000, paidOn: "2026-12-01" },
    "2:2026-11": { amountCents: 20000, paidOn: "2026-11-10" },
    "3:2026-10": { amountCents: 5000, paidOn: "" },
  };
  it("counts a payment in the month it was made, not the invoice's month", () => {
    expect(invoicePaymentsIn(records, "2026-11")).toBe(20000);
    expect(invoicePaymentsIn(records, "2026-12")).toBe(57000);
  });
  it("keeps undated records in their invoice's month", () => {
    expect(invoicePaymentsIn(records, "2026-10")).toBe(5000);
  });
});
