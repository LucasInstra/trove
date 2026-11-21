import { describe, expect, it } from "vitest";
import { cashBasisExample, cashDate } from "./invoice";

// Same cases as cash_date_follows_the_invoice_due_date in src-tauri/src/db.rs: front and core must agree.
describe("cashDate", () => {
  it.each([
    ["2026-11-05", 24, 1, "2026-12-01"],
    ["2026-11-24", 24, 1, "2026-12-01"],
    ["2026-11-25", 24, 1, "2027-01-01"],
    ["2026-11-05", 5, 12, "2026-11-12"],
    ["2026-11-06", 5, 12, "2026-12-12"],
    ["2026-02-28", 31, 10, "2026-03-10"],
    ["2026-03-15", 20, 31, "2026-03-31"],
    ["2026-01-25", 20, 31, "2026-02-28"],
    ["2026-12-28", 24, 1, "2027-02-01"],
  ])("%s with closing %i and due %i counts on %s", (posted, closing, due, expected) => {
    expect(cashDate(posted, closing, due)).toBe(expected);
  });

  it("builds an example around the card's own days", () => {
    expect(cashBasisExample(24, 1, "2026-11")).toEqual({
      before: { on: "2026-11-05", counts: "2026-12-01" },
      after: { on: "2026-11-25", counts: "2027-01-01" },
    });
    expect(cashBasisExample(31, 10, "2026-11").after).toEqual({ on: "2026-12-01", counts: "2027-01-10" });
  });
});
