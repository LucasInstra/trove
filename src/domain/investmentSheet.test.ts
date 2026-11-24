import { describe, expect, it } from "vitest";
import { addMonthsIso, asOfDate, daysBetween, irRateFor, maturityOf, monthsBetweenIso, reconcileTerm, sheetLine } from "./investmentSheet";

describe("sheetLine", () => {
  const example = {
    amountCents: 0,
    costCents: 199_000,
    indexer: "cdi",
    rateBps: 11_000,
    startedOn: "2024-11-06",
    maturityOn: "2027-11-08",
    taxable: true,
  };

  it("reproduces the example row of the spreadsheet", () => {
    const line = sheetLine(example, { cdiPct: 13.9, ipcaPct: 4.5 }, "2026-11-15");
    expect(line.daysElapsed).toBe(739);
    expect(line.daysToMaturity).toBe(358);
    expect(line.status).toBe("running");
    expect(line.irRate).toBe(0.15);
    expect(Math.abs((line.valueCents ?? 0) - 265_436)).toBeLessThanOrEqual(1);
    expect(Math.abs((line.grossCents ?? 0) - 66_436)).toBeLessThanOrEqual(1);
    expect(Math.abs((line.irCents ?? 0) - 9_965)).toBeLessThanOrEqual(1);
    expect(Math.abs((line.netCents ?? 0) - 56_471)).toBeLessThanOrEqual(1);
  });

  it("keeps the typed value when there is nothing to estimate", () => {
    const line = sheetLine({ amountCents: 5_000, costCents: 0 }, undefined, "2026-11-15");
    expect(line.valueCents).toBe(5_000);
    expect(line.estimated).toBe(false);
    expect(line.netCents).toBeNull();
    expect(line.status).toBe("open");
  });

  it("charges no tax on exempt products and flags matured ones", () => {
    const line = sheetLine({ ...example, taxable: false, maturityOn: "2026-01-01" }, undefined, "2026-11-15");
    expect(line.irCents).toBe(0);
    expect(line.status).toBe("matured");
  });
});

describe("helpers", () => {
  it("steps through the regressive table", () => {
    expect([180, 181, 360, 361, 720, 721].map(irRateFor)).toEqual([0.225, 0.2, 0.2, 0.175, 0.175, 0.15]);
  });
  it("counts days and derives a maturity from the old term", () => {
    expect(daysBetween("2024-11-06", "2026-11-15")).toBe(739);
    expect(daysBetween("x", "2026-11-15")).toBeNull();
    expect(maturityOf({ startedOn: "2024-03-10", termMonths: 24 })).toBe("2026-03-10");
    expect(maturityOf({})).toBe("");
  });
});

describe("dates", () => {
  it("counts a month ahead as the same day of that month", () => {
    expect(asOfDate("2026-12", "2026-11-24")).toBe("2026-12-24");
    expect(daysBetween("2026-11-24", asOfDate("2026-12", "2026-11-24"))).toBe(30);
    expect(asOfDate("2026-11", "2026-11-24")).toBe("2026-11-24");
    expect(asOfDate("2027-02", "2026-11-30")).toBe("2027-02-28");
  });
  it("clamps a term ending past a shorter month", () => {
    expect(maturityOf({ startedOn: "2026-01-31", termMonths: 1 })).toBe("2026-02-28");
  });
});

describe("start, term and maturity stay in step", () => {
  it("adds months and clamps to a shorter month", () => {
    expect(addMonthsIso("2026-03-10", 24)).toBe("2028-03-10");
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2026-11-16", 2)).toBe("2027-01-16");
  });

  it("counts whole months between two dates", () => {
    expect(monthsBetweenIso("2026-11-16", "2028-11-16")).toBe(24);
    expect(monthsBetweenIso("", "2028-11-16")).toBeNull();
  });

  it("a typed maturity sets the term, and a typed term sets the maturity", () => {
    expect(reconcileTerm({ startedOn: "2026-11-16", maturityOn: "2028-11-16", termMonths: 0 }, "maturity")).toEqual({
      startedOn: "2026-11-16",
      maturityOn: "2028-11-16",
      termMonths: 24,
    });
    expect(reconcileTerm({ startedOn: "2026-11-16", maturityOn: "", termMonths: 12 }, "term")).toEqual({
      startedOn: "2026-11-16",
      maturityOn: "2027-11-16",
      termMonths: 12,
    });
    expect(reconcileTerm({ startedOn: "2026-11-16", maturityOn: "2027-11-16", termMonths: 12 }, "maturity").termMonths).toBe(12);
  });

  it("clearing the maturity clears the term; moving the start moves the maturity", () => {
    expect(reconcileTerm({ startedOn: "2026-11-16", maturityOn: "", termMonths: 24 }, "maturity").termMonths).toBe(0);
    expect(reconcileTerm({ startedOn: "2027-01-10", maturityOn: "", termMonths: 12 }, "start").maturityOn).toBe("2028-01-10");
  });
});
