import { expect, it } from "vitest";
import { currentMonth, todayIso } from "./format";

it("formats calendar dates locally instead of converting them to UTC", () => {
  const date = new Date(2024, 1, 29, 23, 30);
  date.toISOString = () => "2024-03-01T02:30:00.000Z";

  expect(currentMonth(date)).toBe("2024-02");
  expect(todayIso(date)).toBe("2024-02-29");
});
