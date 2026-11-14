/** Calendar helpers for the planner. Pure, no React, no SQL. */

const pad2 = (value: number) => String(value).padStart(2, "0");

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonths(month: string, delta: number): string {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

/** A day of month clamped to what the month actually has. */
export function dateInMonth(month: string, day: number): string {
  const [year, index] = month.split("-").map(Number);
  return `${month}-${pad2(Math.min(Math.max(1, day), daysInMonth(year, index)))}`;
}

/** `count` month keys starting at `start`, in order. */
export function monthRange(start: string, count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_value, index) => addMonths(start, index));
}
