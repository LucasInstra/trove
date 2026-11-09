import { useCallback, useEffect, useState } from "react";
import { UpdateBanner } from "./components/UpdateBanner";
import { Icon, type IconName } from "./components/Icons";
import { KeeperPanel } from "./components/KeeperPanel";
import { Mascot, type Mood } from "./components/Mascot";
import {
  api,
  type Category,
  type CategoryTotal,
  type MonthPoint,
  type MonthTotals,
  type TransactionRow,
} from "./lib/api";
import { BUILD_LABEL } from "./lib/build";
import { currentMonth, formatCents, monthLabel, shiftMonth } from "./lib/format";
import { loadLook, saveLook, type KeeperLook } from "./lib/keeper";
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

function describeMonth(
  totals: MonthTotals | null,
  month: string | null,
): { mood: Mood; line: string } {
  if (!month) return { mood: "sleepy", line: "Waking up..." };
  if (!totals || totals.transactionCount === 0) {
    return { mood: "sleepy", line: `Nothing recorded for ${monthLabel(month)} yet.` };
  }
  const net = totals.incomeCents - totals.expenseCents;
  if (totals.expenseCents === 0 && totals.incomeCents > 0) {
    return { mood: "happy", line: `No spending in ${monthLabel(month)}. Rare sight.` };
  }
  if (net < 0) {
    return {
      mood: "worried",
      line: `You spent ${formatCents(-net)} more than you made this month.`,
    };
  }
  return { mood: "happy", line: `You kept ${formatCents(net)} this month.` };
}

export function App() {
  const [route, setRoute] = useState<Route>("ledger");
  const [month, setMonth] = useState<string | null>(null);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totals, setTotals] = useState<MonthTotals | null>(null);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [series, setSeries] = useState<MonthPoint[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const updater = useUpdater();
  const keeper = describeMonth(totals, month);
  const [look, setLook] = useState<KeeperLook>(() => loadLook());
  const [panelOpen, setPanelOpen] = useState(false);

  const updateLook = useCallback((next: KeeperLook) => {
    setLook(next);
    saveLook(next);
  }, []);

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
    let alive = true;
    api
      .latestMonth()
      .then((value) => {
        if (alive) setMonth(value ?? currentMonth());
      })
      .catch(() => {
        if (alive) setMonth(currentMonth());
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (month) void reload("", month);
  }, [reload, month]);

  const onSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (month) void reload(value, month);
    },
    [reload, month],
  );

  const onMonth = useCallback((delta: number) => {
    setLoading(true);
    setMonth((current) => shiftMonth(current ?? currentMonth(), delta));
  }, []);

  const onCategory = useCallback(
    async (transactionId: number, categoryId: number | null) => {
      if (!month) return;
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

        <div className="keeper">
          <Mascot look={look} mood={keeper.mood} size={66} />
          <div className="keeper-copy">
            <p className="keeper-line">{keeper.line}</p>
            <button
              type="button"
              className="keeper-customize"
              onClick={() => setPanelOpen(true)}
            >
              Customize
            </button>
          </div>
        </div>

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

        {route === "ledger" && month ? (
          <LedgerScreen
            rows={rows}
            categories={categories}
            totals={totals}
            byCategory={byCategory}
            series={series}
            look={look}
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
            look={look}
            onImported={() => {
              if (month) void reload(search, month);
              setRoute("ledger");
            }}
          />
        ) : null}

        {route === "settings" ? <SettingsScreen updater={updater} /> : null}
      </main>

      {panelOpen ? (
        <KeeperPanel look={look} onChange={updateLook} onClose={() => setPanelOpen(false)} />
      ) : null}
    </div>
  );
}
