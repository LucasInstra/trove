import { describe, expect, it } from "vitest";
import { invoiceWindow, isInsideWindow } from "./invoice";

describe("invoiceWindow", () => {
  it("closes in the same month when the due day comes after the closing day", () => {
    const window = invoiceWindow(5, 12, "2026-12");
    expect(window.from).toBe("2026-11-05");
    expect(window.to).toBe("2026-12-05");
  });

  it("closes in the previous month when the due day comes before the closing day", () => {
    const window = invoiceWindow(28, 5, "2026-12");
    expect(window.from).toBe("2026-10-28");
    expect(window.to).toBe("2026-11-28");
  });

  it("puts a purchase on the right side of the closing date", () => {
    const window = invoiceWindow(5, 12, "2026-12");
    expect(isInsideWindow("2026-12-04", window)).toBe(true);
    expect(isInsideWindow("2026-12-05", window)).toBe(true);
    expect(isInsideWindow("2026-12-06", window)).toBe(false);
    expect(isInsideWindow("2026-11-05", window)).toBe(false);
    expect(isInsideWindow("2026-11-06", window)).toBe(true);
  });

  it("clamps a closing day the month does not have", () => {
    const window = invoiceWindow(30, 31, "2026-02");
    expect(window.from).toBe("2026-01-30");
    expect(window.to).toBe("2026-02-28");
    const leap = invoiceWindow(30, 31, "2028-02");
    expect(leap.to).toBe("2028-02-29");
  });

  it("handles the year boundary", () => {
    const window = invoiceWindow(28, 5, "2027-01");
    expect(window.from).toBe("2026-11-28");
    expect(window.to).toBe("2026-12-28");
  });
});
