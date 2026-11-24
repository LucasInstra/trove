import { useEffect, useState } from "react";
import { Dialog } from "../components/Dialog";
import { SortHeader } from "../components/SortHeader";
import { BarList, type BarListRow } from "../components/charts/BarList";
import { ColumnChart, CrossBars, GroupedDistribution, StatTiles, compactMoney, type Column, type CrossRow, type Grouping } from "../components/charts/ChartParts";
import { Icon } from "../components/Icons";
import { InvestmentRates, RATES_CHANGED } from "../components/InvestmentRates";
import { HoldingDialog } from "./PlannerScreens";
import { parseCents } from "../components/PlannerDialogs";
import { PRODUCTS, addMonthsIso, asOfDate, maturityOf, reconcileTerm, sheetLine, type SheetLine } from "../domain/investmentSheet";
import { DateCell, brDate } from "../components/DateField";
import { nextSort, sortRows, type SortState } from "../domain/sort";
import { DEFAULT_RATES, type RateAssumptions } from "../domain/patrimony";
import { api, type Holding, type HoldingInput, type Person } from "../lib/api";
import { formatCents, todayIso } from "../lib/format";
import { useLanguage } from "../lib/language";

const SERIES = ["#2563eb", "#0ea5e9", "#16a34a", "#f59e0b", "#ec4899", "#7c3aed", "#14b8a6", "#ef4444"];
/** Most bars a ranked chart shows; the tail folds into "others". */
const MAX_BARS = 8;
const MAX_RETURNS = 12;
const INDEXERS = ["none", "cdi", "selic", "ipca", "fixed"] as const;
const TIPPED = new Set(["date", "rate", "annualRate", "applied", "days", "daysLeft", "value", "gross", "grossPct", "irRate", "ir", "net"]);
const NEW_PERSON = "__new_person__";
const DESCRIPTIVE_KEYS: string[] = ["owner", "institution", "product", "notes"];
const NAME_KEYS = ["institution", "product", "maturityOn"] as const;

function toInput(holding: Holding, patch: Partial<HoldingInput>): HoldingInput {
  return {
    id: holding.id,
    name: holding.name,
    kind: holding.kind,
    amountCents: holding.amountCents,
    updatedOn: holding.updatedOn,
    costCents: holding.costCents,
    indexer: holding.indexer,
    rateBps: holding.rateBps,
    termMonths: holding.termMonths,
    startedOn: holding.startedOn,
    owner: holding.owner,
    institution: holding.institution,
    product: holding.product,
    taxable: holding.taxable,
    maturityOn: holding.maturityOn,
    notes: holding.notes,
    ...patch,
  };
}

/** The value a column is sorted by. */
function sheetCell(row: { holding: Holding; line: SheetLine }, key: string): string | number | boolean | null {
  const { holding, line } = row;
  switch (key) {
    case "date": return holding.startedOn;
    case "owner": return holding.owner;
    case "institution": return holding.institution;
    case "product": return holding.product;
    case "indexer": return holding.indexer === "none" ? "" : holding.indexer;
    case "rate": return holding.rateBps || null;
    case "annualRate": return line.annualRate;
    case "applied": return holding.costCents || null;
    case "maturity": return maturityOf(holding);
    case "tax": return !holding.taxable;
    case "days": return line.daysElapsed;
    case "daysLeft": return line.daysToMaturity;
    case "status": return line.status;
    case "value": return line.valueCents;
    case "gross": return line.grossCents;
    case "grossPct": return line.grossPct;
    case "irRate": return line.irRate;
    case "ir": return line.irCents;
    case "net": return line.netCents;
    default: return null;
  }
}

/** "Bank Product dd/mm/yyyy", the name a row gets while the sheet has no name column. */
function generatedName(input: HoldingInput, taken: Set<string>): string {
  const base =
    [input.institution, input.product, brDate(input.maturityOn ?? "")]
      .map((part) => (part ?? "").trim())
      .filter(Boolean)
      .join(" ") || "Investimento";
  let name = base.slice(0, 56);
  for (let n = 2; taken.has(name); n += 1) name = `${base.slice(0, 54)} (${n})`;
  return name;
}

/** An input that keeps its own text and saves once, on blur or Enter, only if it changed. */
function Cell({
  value,
  onCommit,
  type = "text",
  label,
  className,
  maxLength,
}: {
  value: string;
  onCommit: (next: string) => void;
  type?: "text" | "date";
  label: string;
  className?: string;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      className={`sheet-input ${className ?? ""}`}
      type={type}
      value={shown}
      aria-label={label}
      maxLength={maxLength}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(null);
      }}
    />
  );
}

interface Group {
  label: string;
  cents: number;
}

function groupBy(rows: { key: string; cents: number }[], empty: string): Group[] {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.key || empty, (map.get(row.key || empty) ?? 0) + row.cents);
  return [...map.entries()].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents);
}

/** The CDI the sheet converts "% of CDI" with; it is edited in Settings. */
function useCdi(): { rates: RateAssumptions } {
  const [rates, setRates] = useState<RateAssumptions>(DEFAULT_RATES);
  useEffect(() => {
    let alive = true;
    const load = () => void Promise.all([api.getSetting("rate_cdi"), api.getSetting("rate_ipca")])
      .then(([cdi, ipca]) => {
        if (!alive) return;
        setRates({
          cdiPct: Number(cdi) > 0 ? Number(cdi) : DEFAULT_RATES.cdiPct,
          ipcaPct: Number(ipca) > 0 ? Number(ipca) : DEFAULT_RATES.ipcaPct,
        });
      })
      .catch(() => undefined);
    load();
    window.addEventListener(RATES_CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(RATES_CHANGED, load);
    };
  }, []);
  return { rates };
}

/**
 * The investments as a spreadsheet: typed columns on the left are editable in
 * place, the computed ones follow from them and from the rates set in the gear popup. Nothing
 * derived is stored.
 */
export function InvestmentsSheet({
  month,
  people,
  holdings,
  onSave,
  onDelete,
}: {
  /** The month in the top bar: figures are worked out for its last day (or today, in the current month). */
  month: string;
  /** The people already registered in Housing: the owners an investment can be under. */
  people: Person[];
  holdings: Holding[];
  onSave: (input: HoldingInput) => void;
  onDelete: (id: number) => void;
}) {
  const { lang, t } = useLanguage();
  const { rates } = useCdi();
  const [sort, setSort] = useState<SortState>({ key: "date", dir: "asc" });
  const [confirmDelete, setConfirmDelete] = useState<Holding | null>(null);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [newPersonFor, setNewPersonFor] = useState<Holding | null>(null);
  const [personName, setPersonName] = useState("");
  const realToday = todayIso();
  const today = asOfMonth(month);
  const rows = holdings
    .filter((holding) => holding.kind === "investment")
    .map((holding) => ({ holding, line: sheetLine(holding, rates, today) }));
  const taken = new Set(holdings.map((holding) => holding.name));
  const number = (value: number, digits = 2) =>
    new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);

  const save = (holding: Holding, patch: Partial<HoldingInput>) => {
    let next = toInput(holding, patch);
    if ("maturityOn" in patch || "startedOn" in patch) {
      next = { ...next, ...reconcileTerm(next, "maturityOn" in patch ? "maturity" : "start") };
    }
    // Only a name the sheet itself generated is regenerated; one the person chose stays.
    if (NAME_KEYS.some((key) => key in patch)) {
      const others = new Set([...taken].filter((name) => name !== holding.name));
      const before = generatedName(toInput(holding, {}), new Set());
      const wasGenerated = holding.name === "Investimento" || holding.name.startsWith("Investimento (") || holding.name === before || holding.name.startsWith(`${before} (`);
      if (wasGenerated) next = { ...next, name: generatedName(next, others) };
    }
    // The rest of the app (Patrimony) reads the current value from the holding, so keep it in step
    // with what this sheet estimates; without an estimate the amount put in is the best figure.
    // A cell that only describes the row (owner, bank, notes...) must not touch the typed value.
    const describesOnly = Object.keys(patch).every((key) => DESCRIPTIVE_KEYS.includes(key));
    if (!describesOnly) {
      const line = sheetLine({ ...holding, ...next, id: holding.id } as Holding, rates, realToday);
      next = { ...next, amountCents: line.estimated ? line.valueCents : (next.costCents ?? 0) > 0 ? (next.costCents ?? 0) : next.amountCents, updatedOn: realToday };
    }
    onSave(next);
  };

  const addRow = () => {
    const input: HoldingInput = {
      id: null,
      name: generatedName({ id: null, name: "", kind: "investment", amountCents: 0, updatedOn: realToday }, taken),
      kind: "investment",
      amountCents: 0,
      updatedOn: realToday,
      costCents: 0,
      indexer: "cdi",
      startedOn: realToday,
      taxable: true,
    };
    onSave(input);
  };

  const statusLabel = (line: SheetLine) => t(`investments.sheet.status_${line.status}`);
  const valueOf = (row: (typeof rows)[number]) => row.line.valueCents;
  const totals = rows.reduce(
    (sum, row) => ({
      applied: sum.applied + row.holding.costCents,
      value: sum.value + valueOf(row),
      gross: sum.gross + (row.line.grossCents ?? 0),
      ir: sum.ir + (row.line.irCents ?? 0),
      net: sum.net + (row.line.netCents ?? 0),
    }),
    { applied: 0, value: 0, gross: 0, ir: 0, net: 0 },
  );

  return (
    <>
      <article className="card sheet-card">
        <header className="card-head">
          <div className="card-title">
            <h2>{t("investments.sheet.title")}</h2>
            <p className="muted small">
              {t("investments.sheet.hint")}
              {today !== realToday ? ` ${t("investments.sheet.asOf", { date: brDate(today) })}` : ""}
            </p>
          </div>
          <div className="sheet-head-actions">
          <button
            type="button"
            className="icon-button"
            title={t("investments.assumptions")}
            aria-label={t("investments.assumptions")}
            onClick={() => setRatesOpen(true)}
          >
            <Icon name="settings" size={18} />
          </button>
          <button type="button" className="primary" onClick={addRow}>
            <Icon name="plus" size={16} />
            {t("investments.sheet.addRow")}
          </button>
          </div>
        </header>
        <div className="sheet-wrap is-long">
          <table className="sheet-table">
            <thead>
              <tr>
                {[
                  "date", "owner", "institution", "product", "indexer", "rate",
                  "annualRate", "applied", "maturity", "tax",
                ].map((key) => (
                  <SortHeader
                    key={key}
                    id={key}
                    sort={sort}
                    onSort={(k) => setSort((current) => nextSort(current, k))}
                    className={key === "annualRate" ? "calc" : "typed"}
                    label={t(`investments.sheet.col_${key}`)}
                    title={TIPPED.has(key) ? t(`investments.sheet.tip_${key}`) : undefined}
                  />
                ))}
                {["days", "daysLeft", "status", "value", "gross", "grossPct", "irRate", "ir", "net"].map((key) => (
                  <SortHeader
                    key={key}
                    id={key}
                    sort={sort}
                    onSort={(k) => setSort((current) => nextSort(current, k))}
                    className="calc"
                    label={t(`investments.sheet.col_${key}`)}
                    title={TIPPED.has(key) ? t(`investments.sheet.tip_${key}`) : undefined}
                  />
                ))}
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {sortRows(rows, sort, sheetCell).map(({ holding, line }) => {
                const label = (column: string) => `${t(`investments.sheet.col_${column}`)}: ${holding.name}`;
                return (
                  <tr key={holding.id}>
                    <td>
                      <DateCell lang={lang} label={label("date")} value={holding.startedOn} onCommit={(v) => save(holding, { startedOn: v })} />
                    </td>
                    <td>
                      <select
                        className="sheet-input typed"
                        aria-label={label("owner")}
                        value={holding.owner}
                        onChange={(event) => {
                          if (event.target.value === NEW_PERSON) setNewPersonFor(holding);
                          else save(holding, { owner: event.target.value });
                        }}
                      >
                        <option value="">{t("investments.sheet.none")}</option>
                        {[...new Set([...people.map((person) => person.name), ...(holding.owner ? [holding.owner] : [])])].map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                        <option value={NEW_PERSON}>{t("investments.sheet.addPerson")}</option>
                      </select>
                    </td>
                    <td>
                      <Cell label={label("institution")} value={holding.institution} maxLength={60} onCommit={(v) => save(holding, { institution: v.trim() })} />
                    </td>
                    <td>
                      <select
                        className="sheet-input"
                        aria-label={label("product")}
                        value={holding.product}
                        onChange={(event) => save(holding, { product: event.target.value })}
                      >
                        <option value="">{t("investments.sheet.none")}</option>
                        {(PRODUCTS.includes(holding.product) || holding.product === "" ? PRODUCTS : [...PRODUCTS, holding.product]).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="sheet-input"
                        aria-label={label("indexer")}
                        value={holding.indexer}
                        onChange={(event) => save(holding, { indexer: event.target.value as (typeof INDEXERS)[number] })}
                      >
                        {INDEXERS.map((option) => (
                          <option key={option} value={option}>
                            {t(`investments.indexer_${option}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Cell
                        className="num"
                        label={label("rate")}
                        value={holding.rateBps ? String(holding.rateBps / 100).replace(".", ",") : ""}
                        onCommit={(v) => {
                          const pct = Number(v.replace(",", "."));
                          if (v.trim() === "" || (pct >= 0 && pct <= 10_000)) save(holding, { rateBps: Math.round((pct || 0) * 100) });
                        }}
                      />
                    </td>
                    <td className="calc num">{line.annualRate === null ? "—" : `${number(line.annualRate * 100)}%`}</td>
                    <td>
                      <Cell
                        className="num"
                        label={label("applied")}
                        value={holding.costCents ? (holding.costCents / 100).toFixed(2).replace(".", ",") : ""}
                        onCommit={(v) => save(holding, { costCents: v.trim() === "" ? 0 : parseCents(v) })}
                      />
                    </td>
                    <td>
                      <DateCell lang={lang} label={label("maturity")} value={holding.maturityOn} onCommit={(v) => save(holding, { maturityOn: v })} />
                    </td>
                    <td>
                      <select
                        className="sheet-input"
                        aria-label={label("tax")}
                        value={holding.taxable ? "1" : "0"}
                        onChange={(event) => save(holding, { taxable: event.target.value === "1" })}
                      >
                        <option value="1">{t("investments.sheet.taxable")}</option>
                        <option value="0">{t("investments.sheet.exempt")}</option>
                      </select>
                    </td>
                    <td className="calc num">{line.daysElapsed ?? "—"}</td>
                    <td className="calc num">{line.daysToMaturity ?? "—"}</td>
                    <td className={`calc status-${line.status}`}>{statusLabel(line)}</td>
                    <td className="calc num">{formatCents(line.valueCents)}</td>
                    <td className="calc num">{line.grossCents === null ? "—" : formatCents(line.grossCents)}</td>
                    <td className="calc num">{line.grossPct === null ? "—" : `${number(line.grossPct)}%`}</td>
                    <td className="calc num">{line.irRate === null ? "—" : `${number(line.irRate * 100, 1)}%`}</td>
                    <td className="calc num">{line.irCents === null ? "—" : formatCents(line.irCents)}</td>
                    <td className="calc num">{line.netCents === null ? "—" : formatCents(line.netCents)}</td>
                    <td className="sheet-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title={t("common.edit")}
                        aria-label={`${t("common.edit")}: ${holding.name}`}
                        onClick={() => setEditing(holding)}
                      >
                        <Icon name="pencil" size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        title={t("common.delete")}
                        aria-label={`${t("common.delete")}: ${holding.name}`}
                        onClick={() => setConfirmDelete(holding)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={7}>{t("investments.sheet.total")}</td>
                  <td className="num">{formatCents(totals.applied)}</td>
                  <td colSpan={5} />
                  <td className="num">{formatCents(totals.value)}</td>
                  <td className="num">{formatCents(totals.gross)}</td>
                  <td />
                  <td />
                  <td className="num">{formatCents(totals.ir)}</td>
                  <td className="num">{formatCents(totals.net)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
          {rows.length === 0 ? <p className="muted sheet-empty">{t("investments.sheet.empty")}</p> : null}
        </div>
      </article>

      {newPersonFor ? (
        <Dialog title={t("people.add")} onClose={() => setNewPersonFor(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const name = personName.trim();
              if (!name) return;
              save(newPersonFor, { owner: name });
              setPersonName("");
              setNewPersonFor(null);
            }}
          >
            <label className="field">
              <span>{t("investments.sheet.col_owner")}</span>
              <input
                autoFocus
                value={personName}
                maxLength={60}
                placeholder={t("people.addPlaceholder")}
                onChange={(event) => setPersonName(event.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="ghost" onClick={() => setNewPersonFor(null)}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="primary" disabled={personName.trim() === ""}>
                {t("common.save")}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {ratesOpen ? (
        <Dialog title={t("investments.assumptions")} onClose={() => setRatesOpen(false)}>
          <InvestmentRates />
        </Dialog>
      ) : null}

      {editing ? (
        <HoldingDialog
          initial={editing}
          defaultKind="investment"
          people={people.map((person) => person.name)}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            onSave(input);
            setEditing(null);
          }}
        />
      ) : null}

      {confirmDelete ? (
        <Dialog
          title={t("holdings.confirmDeleteTitle", { name: confirmDelete.name })}
          onClose={() => setConfirmDelete(null)}
        >
          <p className="muted">{t("holdings.confirmDeleteDesc")}</p>
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => setConfirmDelete(null)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onDelete(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              {t("common.delete")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** The date the figures are worked out for: today in the current month, the same day of the month otherwise. */
export function asOfMonth(month: string): string {
  return asOfDate(month, todayIso());
}

/** The investment charts: headline numbers, the money regrouped, its growth, returns and maturities. */
/** `part` lets the screen put the five totals above the sheet and the charts below it. */
export function InvestmentsCharts({
  holdings,
  month,
  part = "all",
}: {
  holdings: Holding[];
  month: string;
  part?: "all" | "stats" | "charts";
}) {
  const { lang, t } = useLanguage();
  const { rates } = useCdi();
  const [allReturns, setAllReturns] = useState(false);
  const today = asOfMonth(month);
  const rows = holdings
    .filter((holding) => holding.kind === "investment" && (!holding.startedOn || holding.startedOn <= today))
    .map((holding) => ({ holding, line: sheetLine(holding, rates, today) }));
  if (rows.length === 0) return <p className="muted sheet-empty">{t("investments.sheet.empty")}</p>;

  const none = t("investments.sheet.none");
  const total = rows.reduce((sum, row) => sum + row.line.valueCents, 0);
  const applied = rows.reduce((sum, row) => sum + row.holding.costCents, 0);
  const estimatedRows = rows.filter((row) => row.line.estimated);
  const net = estimatedRows.reduce((sum, row) => sum + (row.line.netCents ?? 0), 0);
  const gross = estimatedRows.reduce((sum, row) => sum + (row.line.grossCents ?? 0), 0);
  // The portfolio's average return: the gross return over what was put into the rows that have one.
  const base = estimatedRows.reduce((sum, row) => sum + row.holding.costCents, 0);
  const averagePct =
    base > 0
      ? `${new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((gross / base) * 100)}%`
      : "—";

  const split = (id: string, label: string, pick: (holding: Holding) => string): Grouping => ({
    id,
    label,
    rows: groupBy(rows.map((row) => ({ key: pick(row.holding), cents: row.line.valueCents })), none).map((group, index) => ({
      label: group.label,
      value: group.cents,
      display: formatCents(group.cents),
      color: SERIES[index % SERIES.length],
    })),
  });
  const groupings = [
    split("product", t("investments.sheet.col_product"), (holding) => holding.product),
    split("institution", t("investments.sheet.col_institution"), (holding) => holding.institution),
    split("owner", t("investments.sheet.col_owner"), (holding) => holding.owner),
    split("indexer", t("investments.sheet.col_indexer"), (holding) =>
      holding.indexer && holding.indexer !== "none" ? t(`investments.indexer_${holding.indexer}`) : "",
    ),
  ];

  const crossMap = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const type = row.holding.product || none;
    const owner = row.holding.owner || none;
    const parts = crossMap.get(type) ?? {};
    parts[owner] = (parts[owner] ?? 0) + row.holding.costCents;
    crossMap.set(type, parts);
  }
  const cross: CrossRow[] = [...crossMap.entries()].map(([label, parts]) => ({ label, parts }));

  // What each type earned so far: the net return and the tax that came out of it.
  const yieldMap = new Map<string, Record<string, number>>();
  for (const row of estimatedRows) {
    const type = row.holding.product || none;
    const parts = yieldMap.get(type) ?? {};
    parts[t("investments.sheet.netReturn")] = (parts[t("investments.sheet.netReturn")] ?? 0) + Math.max(0, row.line.netCents ?? 0);
    parts[t("investments.sheet.col_ir")] = (parts[t("investments.sheet.col_ir")] ?? 0) + (row.line.irCents ?? 0);
    yieldMap.set(type, parts);
  }
  const yieldByType: CrossRow[] = [...yieldMap.entries()].map(([label, parts]) => ({ label, parts }));

  const horizon = [0, 3, 6, 12, 18, 24, 36];
  const projection: Column[] = horizon.map((months) => {
    const date = addMonthsIso(today, months);
    const cents = rows.reduce((sum, row) => sum + sheetLine(row.holding, rates, date).valueCents, 0);
    const name = months === 0 ? t("investments.sheet.now") : t("investments.sheet.monthsAhead", { count: months });
    return { key: String(months), cents, tick: name, tip: `${name}: ${formatCents(cents)}` };
  });

  const years = new Map<string, number>();
  for (const row of rows) {
    const maturity = maturityOf(row.holding);
    if (maturity) years.set(maturity.slice(0, 4), (years.get(maturity.slice(0, 4)) ?? 0) + row.line.valueCents);
  }
  const maturities: BarListRow[] = [...years.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, cents]) => ({ label: year, value: cents, display: formatCents(cents), color: SERIES[0] }));

  const returns = estimatedRows
    .map((row) => ({
      name: [row.holding.institution, row.holding.product].filter(Boolean).join(" ") || row.holding.name,
      invested: row.holding.costCents,
      net: Math.max(0, row.line.netCents ?? 0),
      tax: row.line.irCents ?? 0,
    }))
    .sort((a, b) => b.invested + b.net + b.tax - (a.invested + a.net + a.tax));
  const returnCount = returns.length;
  if (returns.length > MAX_RETURNS && !allReturns) {
    const rest = returns.splice(MAX_RETURNS - 1);
    returns.push({
      name: `${t("transactions.sheet.others")} (${rest.length})`,
      invested: rest.reduce((sum, item) => sum + item.invested, 0),
      net: rest.reduce((sum, item) => sum + item.net, 0),
      tax: rest.reduce((sum, item) => sum + item.tax, 0),
    });
  }
  const reach = Math.max(...returns.map((item) => item.invested + item.net + item.tax), 1);

  const stats = (
      <StatTiles
        items={[
          { label: t("investments.sheet.kpiApplied"), value: formatCents(applied) },
          { label: t("investments.sheet.kpiValue"), value: formatCents(total) },
          { label: t("investments.sheet.kpiGross"), value: formatCents(gross) },
          { label: t("investments.sheet.kpiNet"), value: formatCents(net) },
          { label: t("investments.sheet.kpiAverage"), value: averagePct },
        ]}
      />
  );

  if (part === "stats") return stats;

  return (
    <>
      {part === "all" ? stats : null}

      <div className="sheet-charts-grid">
        <GroupedDistribution
          title={t("investments.sheet.distribution")}
          groupings={groupings}
          centerLabel={t("investments.sheet.col_value")}
          centerValue={compactMoney(total, lang)}
          max={MAX_BARS}
          others={t("transactions.sheet.others")}
          format={formatCents}
        />

        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("investments.sheet.projection")}</h2>
              <p className="muted small">{t("investments.sheet.projectionHint")}</p>
            </div>
          </header>
          <ColumnChart columns={projection} label={t("investments.sheet.projection")} lang={lang} />
        </article>
      </div>

      <div className="sheet-charts-grid">
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("investments.sheet.byOwner")}</h2>
            </div>
          </header>
          <BarList rows={groupings[2].rows} label={t("investments.sheet.byOwner")} max={MAX_BARS} others={t("transactions.sheet.others")} format={formatCents} />
        </article>
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("investments.sheet.byInstitution")}</h2>
            </div>
          </header>
          <BarList rows={groupings[1].rows} label={t("investments.sheet.byInstitution")} max={MAX_BARS} others={t("transactions.sheet.others")} format={formatCents} />
        </article>
      </div>

      <div className="sheet-charts-grid">
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("investments.sheet.crossProductOwner")}</h2>
            </div>
          </header>
          <CrossBars rows={cross} others={t("transactions.sheet.others")} format={formatCents} label={t("investments.sheet.crossProductOwner")} />
        </article>
        {yieldByType.length > 0 ? (
          <article className="card">
            <header className="card-head">
              <div className="card-title">
                <h2>{t("investments.sheet.yieldByType")}</h2>
                <p className="muted small">{t("investments.sheet.yieldByTypeHint")}</p>
              </div>
            </header>
            <CrossBars rows={yieldByType} others={t("transactions.sheet.others")} format={formatCents} label={t("investments.sheet.yieldByType")} />
          </article>
        ) : null}
      </div>

      <div className="sheet-charts-grid">
        {returns.length > 0 ? (
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("investments.sheet.returns")}</h2>
            </div>
            <ul className="sheet-key">
              <li><i style={{ background: SERIES[0] }} />{t("investments.sheet.col_applied")}</li>
              <li><i style={{ background: SERIES[2] }} />{t("investments.sheet.netReturn")}</li>
              <li><i style={{ background: SERIES[3] }} />{t("investments.sheet.col_ir")}</li>
            </ul>
          </header>
          <ul className={`barlist${allReturns ? " is-scroll" : ""}`}>
            {returns.map((item, index) => (
              <li key={`${index}:${item.name}`} className="barlist-row">
                <span className="barlist-label">{item.name}</span>
                <span className="barlist-track stacked">
                  {[
                    { label: t("investments.sheet.col_applied"), cents: item.invested, color: SERIES[0] },
                    { label: t("investments.sheet.netReturn"), cents: item.net, color: SERIES[2] },
                    { label: t("investments.sheet.col_ir"), cents: item.tax, color: SERIES[3] },
                  ].map((part) => (
                    <i
                      key={part.label}
                      data-tip={`${part.label}: ${formatCents(part.cents)}`}
                      style={{ width: `${(part.cents / reach) * 100}%`, background: part.color }}
                    />
                  ))}
                </span>
                <span className="barlist-value">{formatCents(item.invested + item.net + item.tax)}</span>
              </li>
            ))}
          </ul>
          {returnCount > MAX_RETURNS ? (
            <button type="button" className="outline-button show-all" onClick={() => setAllReturns((value) => !value)}>
              {allReturns ? t("investments.sheet.showLess") : t("investments.sheet.showAll", { count: returnCount })}
            </button>
          ) : null}
        </article>
      ) : null}

      {maturities.length > 0 ? (
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("investments.sheet.maturities")}</h2>
            </div>
          </header>
          <BarList rows={maturities} label={t("investments.sheet.maturities")} max={MAX_BARS} others={t("transactions.sheet.others")} format={formatCents} />
        </article>
      ) : null}
      </div>
    </>
  );
}
