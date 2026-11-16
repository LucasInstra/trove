export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

/** A click on a column: the same column flips direction, another one starts ascending. */
export function nextSort(current: SortState, key: string): SortState {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: "asc" };
}

type Cell = string | number | boolean | null | undefined;

function isEmpty(cell: Cell): boolean {
  return cell === null || cell === undefined || cell === "";
}

/**
 * Stable sort by one column. Empty cells go last in both directions, so a
 * column with gaps never buries the filled rows.
 */
export function sortRows<T>(items: readonly T[], sort: SortState, cell: (item: T, key: string) => Cell): T[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return items
    .map((item, index) => ({ item, index, value: cell(item, sort.key) }))
    .sort((a, b) => {
      const aEmpty = isEmpty(a.value);
      const bEmpty = isEmpty(b.value);
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      const x = typeof a.value === "boolean" ? Number(a.value) : a.value!;
      const y = typeof b.value === "boolean" ? Number(b.value) : b.value!;
      const order =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" });
      return order !== 0 ? order * sign : a.index - b.index;
    })
    .map((entry) => entry.item);
}
