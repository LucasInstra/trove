import { describe, expect, it } from "vitest";
import { detectRecurring, type LedgerRow } from "./recurrence";

const charge = (postedOn: string, amountCents = -1990): LedgerRow => ({
  postedOn,
  merchant: "Netflix",
  description: "NETFLIX.COM",
  amountCents,
});

describe("detectRecurring", () => {
  it("finds a monthly subscription and marks this month due", () => {
    const rows = [charge("2024-01-05"), charge("2024-02-05"), charge("2024-03-05")];
    const [netflix] = detectRecurring(rows, "2024-04");
    expect(netflix.label).toBe("Netflix");
    expect(netflix.nextMonth).toBe("2024-04");
    expect(netflix.status).toBe("due");
    expect(netflix.occurrences).toBe(3);
  });

  it("flags a skipped month as overdue", () => {
    const rows = [charge("2024-01-05"), charge("2024-02-05"), charge("2024-03-05")];
    const [netflix] = detectRecurring(rows, "2024-06");
    expect(netflix.status).toBe("overdue");
  });

  it("reads a charge already paid this month as scheduled", () => {
    const rows = [charge("2024-02-05"), charge("2024-03-05"), charge("2024-04-05")];
    const [netflix] = detectRecurring(rows, "2024-04");
    expect(netflix.nextMonth).toBe("2024-05");
    expect(netflix.status).toBe("scheduled");
  });

  it("ignores one-offs and non-monthly rhythms", () => {
    const rows = [
      charge("2024-01-05"),
      charge("2024-02-05"),
      { ...charge("2024-03-01"), merchant: "Padaria", description: "Pão", amountCents: -1200 },
      { ...charge("2024-01-10"), merchant: "Seguro", description: "Seguro", amountCents: -50000 },
      { ...charge("2024-04-10"), merchant: "Seguro", description: "Seguro", amountCents: -50000 },
      { ...charge("2024-07-10"), merchant: "Seguro", description: "Seguro", amountCents: -50000 },
    ];
    expect(detectRecurring(rows, "2024-04")).toHaveLength(0);
  });

  it("splits a changed amount instead of merging", () => {
    const rows = [
      charge("2024-01-05", -1990),
      charge("2024-02-05", -1990),
      charge("2024-03-05", -2490),
      charge("2024-04-05", -2490),
      charge("2024-05-05", -2490),
    ];
    const found = detectRecurring(rows, "2024-06");
    expect(found).toHaveLength(1);
    expect(found[0].amountCents).toBe(-2490);
  });
});
