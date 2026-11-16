import type { SortState } from "../domain/sort";

/** A table header cell that sorts its column on click and says which way it is sorted. */
export function SortHeader({
  id,
  label,
  sort,
  onSort,
  className,
  title,
}: {
  id: string;
  label: string;
  sort: SortState;
  onSort: (key: string) => void;
  className?: string;
  title?: string;
}) {
  const active = sort.key === id;
  return (
    <th className={className} title={title} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="sheet-sort" onClick={() => onSort(id)}>
        {label}
        <span className="sheet-sort-mark" aria-hidden="true">
          {active ? (sort.dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
}
