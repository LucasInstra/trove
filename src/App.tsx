import { useCallback, useEffect, useState } from "react";
import { UpdateBanner } from "./components/UpdateBanner";
import { Icon, type IconName } from "./components/Icons";
import {
  api,
  type Category,
  type CategoryTotal,
  type MonthPoint,
  type MonthTotals,
  type TransactionRow,
} from "./lib/api";
import { BUILD_LABEL } from "./lib/build";
import { currentMonth, shiftMonth } from "./lib/format";
import { useUpdater } from "./lib/updater";
import { ImportScreen } from "./screens/ImportScreen";
import { LedgerScreen } from "./screens/LedgerScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

type Route = "ledger" | "import" | "settings";

const NAV: Array<{ route: Route; label: string; icon: IconName }> = [
  { route: "ledger", label: "Ledger", icon: "ledger" },
  { route: "import", label: "Import", icon: "import" },
  { route: "settings", label: "Settings", icon: "settings" },
];

export function App() {
  const [route, setRoute] = useState<Route>("ledger");
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totals, setTotals] = useState<MonthTotals | null>(null);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [series, setSeries] = useState<MonthPoint[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const updater = useUpdater();

  const reload = useCallback(async (term: string, at: string) => {
    try {
      const [nextRows, nextCategories, nextTotals, nextByCategory, nextSeries] =
        await Promise.all([
          api.transactions(term, at),
          api.categories(),
          api.monthTotals(at),
          api.categoryTotals(at),
          api.monthSeries(at, 6),
        ]);
      setRows(nextRows);
      setCategories(nextCategories);
      setTotals(nextTotals);
      setByCategory(nextByCategory);
      setSeries(nextSeries);
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload("", month);
  }, [reload, month]);

  const onSearch = useCallback(
    (value: string) => {
      setSearch(value);
      void reload(value, month);
    },
    [reload, month],
  );

  const onMonth = useCallback(
    (delta: number) => {
      setMonth((current) => shiftMonth(current, delta));
      setLoading(true);
    },
    [],
  );

  const onCategory = useCallback(
    async (transactionId: number, categoryId: number | null) => {
      try {
        await api.setCategory(transactionId, categoryId);
        await reload(search, month);
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : String(problem));
      }
    },
    [reload, search, month],
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">t</span>
          <div>
            <strong>trove</strong>
            <span>local finance</span>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.route}
              type="button"
              className={route === item.route ? "nav-item active" : "nav-item"}
              onClick={() => setRoute(item.route)}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <UpdateBanner updater={updater} onOpen={() => setRoute("settings")} />

        <div className="sidebar-foot">
          <span>version {updater.currentVersion || "0.1.0"}</span>
          <span>{BUILD_LABEL}</span>
        </div>
      </aside>

      <main className="main">
        {error ? (
          <div className="alert" role="alert">
            {error}
          </div>
        ) : null}

        {route === "ledger" ? (
          <LedgerScreen
            rows={rows}
            categories={categories}
            totals={totals}
            byCategory={byCategory}
            series={series}
            month={month}
            search={search}
            loading={loading}
            onSearch={onSearch}
            onMonth={onMonth}
            onCategory={onCategory}
            onImport={() => setRoute("import")}
          />
        ) : null}

        {route === "import" ? (
          <ImportScreen
            onImported={() => {
              void reload(search, month);
              setRoute("ledger");
            }}
          />
        ) : null}

        {route === "settings" ? <SettingsScreen updater={updater} /> : null}
      </main>
    </div>
  );
}
