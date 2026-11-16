import { describe, expect, it } from "vitest";
import { nextSort, sortRows } from "./sort";

describe("sortRows", () => {
  const items = [
    { id: 1, date: "2024-05-01" },
    { id: 2, date: "" },
    { id: 3, date: "2023-01-10" },
    { id: 4, date: "2024-05-01" },
  ];
  const cell = (item: (typeof items)[number], key: string) => (key === "date" ? item.date : item.id);

  it("sorts ascending with empty cells last and ties kept in order", () => {
    expect(sortRows(items, { key: "date", dir: "asc" }, cell).map((i) => i.id)).toEqual([3, 1, 4, 2]);
  });
  it("keeps empty cells last when descending", () => {
    expect(sortRows(items, { key: "date", dir: "desc" }, cell).map((i) => i.id)).toEqual([1, 4, 3, 2]);
  });
  it("compares numbers as numbers", () => {
    expect(sortRows(items, { key: "id", dir: "desc" }, cell).map((i) => i.id)).toEqual([4, 3, 2, 1]);
  });
});

describe("nextSort", () => {
  it("flips the same column and restarts another one ascending", () => {
    expect(nextSort({ key: "a", dir: "asc" }, "a")).toEqual({ key: "a", dir: "desc" });
    expect(nextSort({ key: "a", dir: "desc" }, "b")).toEqual({ key: "b", dir: "asc" });
  });
});
