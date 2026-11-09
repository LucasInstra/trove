import { useCallback, useEffect, useState } from "react";
import { UpdateBanner } from "./components/UpdateBanner";
import { api, type Category, type MonthTotals, type TransactionRow } from "./lib/api";
import { BUILD_LABEL } from "./lib/build";
import { currentMonth } from "./lib/format";
import { useUpdater } from "./lib/updater";
import { ImportScreen } from "./screens/ImportScreen";
import { LedgerScreen } from "./screens/LedgerScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

type Route = "ledger" | "import" | "settings";

const NAV: Array<{ route: Route; label: string }> = [
  { route: "ledger", label: "Extrato" },
  { route: "import", label: "Importar" },
  { route: "settings", label: "Configurações" },
];

export function App() {
  const [route, setRoute] = useState<Route>("ledger");
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totals, setTotals] = useState<MonthTotals | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const updater = useUpdater();
  const month = currentMonth();

  const reload = useCallback(
    async (term: string) => {
      try {
        const [nextRows, nextCategories, nextTotals] = await Promise.all([
          api.transactions(term),
          api.categories(),
          api.monthTotals(month),
        ]);
        setRows(nextRows);
        setCategories(nextCategories);
        setTotals(nextTotals);
        setError("");
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : String(problem));
      } finally {
        setLoading(false);
      }
    },
    [month],
  );

  useEffect(() => {
    void reload("");
  }, [reload]);

  const onSearch = useCallback(
    (value: string) => {
      setSearch(value);
      void reload(value);
    },
    [reload],
  );

  const onCategory = useCallback(
    async (transactionId: number, categoryId: number | null) => {
      try {
        await api.setCategory(transactionId, categoryId);
        await reload(search);
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : String(problem));
      }
    },
    [reload, search],
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">c</span>
          <div>
            <strong>cofre</strong>
            <span>finanças locais</span>
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
              {item.label}
            </button>
          ))}
        </nav>

        <UpdateBanner updater={updater} onOpen={() => setRoute("settings")} />

        <div className="sidebar-foot">
          versão {updater.currentVersion || "0.1.0"} · {BUILD_LABEL}
        </div>
      </aside>

      <main className="main">
        {error ? <div className="alert">{error}</div> : null}

        {route === "ledger" ? (
          <LedgerScreen
            rows={rows}
            categories={categories}
            totals={totals}
            month={month}
            search={search}
            loading={loading}
            onSearch={onSearch}
            onCategory={onCategory}
            onImport={() => setRoute("import")}
          />
        ) : null}

        {route === "import" ? (
          <ImportScreen
            onImported={() => {
              void reload(search);
              setRoute("ledger");
            }}
          />
        ) : null}

        {route === "settings" ? <SettingsScreen updater={updater} /> : null}
      </main>
    </div>
  );
}
