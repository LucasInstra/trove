import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeeperPanel } from "./components/KeeperPanel";
import { Mascot } from "./components/Mascot";
import { TitleBar } from "./components/TitleBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { TopBar } from "./components/TopBar";
import { BillDialog, CardDialog, GoalDialog, IncomeDialog } from "./components/PlannerDialogs";
import { Dialog } from "./components/Dialog";
import { Icon, type IconName } from "./components/Icons";
import { OverviewScreen } from "./screens/OverviewScreen";
import { TransactionsScreen } from "./screens/TransactionsScreen";
import { FlowScreen } from "./screens/FlowScreen";
import { ImportScreen } from "./screens/ImportScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { api, EMPTY_PLANNER } from "./lib/api";
import type {
  Account,
  Bill,
  BillInput,
  CardInput,
  CardMeta,
  Category,
  CategoryTotal,
  Goal,
  GoalInput,
  Income,
  IncomeInput,
  MonthPoint,
  MonthTotals,
  PlannerState,
  TransactionRow,
} from "./lib/api";
import { formatCents, monthLabel } from "./lib/format";
import { useLanguage } from "./lib/language";
import { useUpdater } from "./lib/updater";
import { invoiceWindow } from "./domain/invoice";
import { planMonth } from "./domain/projection";
import { buildNotifications } from "./domain/notifications";
import { loadLook, saveLook, type KeeperLook } from "./lib/keeper";
import { applyTheme, loadTheme, saveTheme, type Theme } from "./lib/theme";
import { SHOW_KEEPER } from "./lib/features";
import {
  moveCardTo,
  parseLayout,
  resizeCard,
  serializeLayout,
  setMode,
  type CardId,
  type CardMode,
  type LayoutCard,
} from "./domain/layout";
import type { Mood } from "./components/Mascot";
import { BUILD_LABEL } from "./lib/build";

type Route = "overview" | "transactions" | "flow" | "import" | "settings";

const MENU: Array<{ route: Route; icon: IconName }> = [
  { route: "overview", icon: "grid" },
  { route: "transactions", icon: "ledger" },
  { route: "flow", icon: "arrow-left-right" },
];

const ADJUST: Array<{ route: Route; icon: IconName }> = [
  { route: "import", icon: "import" },
  { route: "settings", icon: "settings" },
];

type DialogState =
  | { kind: "income"; income: Income | null }
  | { kind: "bill"; bill: Bill | null }
  | { kind: "card"; card: CardMeta | null }
  | { kind: "goal"; goal: Goal | null }
  | { kind: "ceiling" }
  | null;

const currentMonth = () => new Date().toISOString().slice(0, 7);

function describeMonth(
  totals: MonthTotals | null,
  month: string | null,
  lang: "en" | "pt",
  t: (key: string, vars?: Record<string, string | number>) => string,
): { mood: Mood; line: string } {
  if (!month) return { mood: "sleepy", line: t("keeper.waking") };
  const label = monthLabel(month, lang);
  if (!totals || totals.transactionCount === 0) {
    return { mood: "sleepy", line: t("keeper.nothing", { month: label }) };
  }
  const net = totals.incomeCents - totals.expenseCents;
  if (totals.expenseCents === 0 && totals.incomeCents > 0) {
    return { mood: "happy", line: t("keeper.noSpending", { month: label }) };
  }
  if (net < 0) {
    return { mood: "worried", line: t("keeper.over", { amount: formatCents(-net) }) };
  }
  return { mood: "happy", line: t("keeper.kept", { amount: formatCents(net) }) };
}

export function App() {
  const { lang, setLang, t } = useLanguage();
  const [route, setRoute] = useState<Route>("overview");
  const [month, setMonth] = useState<string | null>(null);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totals, setTotals] = useState<MonthTotals | null>(null);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [series, setSeries] = useState<MonthPoint[]>([]);
  const [planner, setPlanner] = useState<PlannerState>(EMPTY_PLANNER);
  const [usage, setUsage] = useState<Record<number, number>>({});
  const [housingCategoryId, setHousingCategoryId] = useState<number | null>(null);
  const [ceilingPct, setCeilingPct] = useState(30);
  const [housingScope, setHousingScope] = useState<"primary" | "total">("primary");
  const [splitSettled, setSplitSettled] = useState(false);
  const [layout, setLayout] = useState<LayoutCard[]>(() => parseLayout(null));
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);
  const updater = useUpdater();
  const keeper = useMemo(() => describeMonth(totals, month, lang, t), [totals, month, lang, t]);
  const [look, setLook] = useState<KeeperLook>(() => loadLook());
  const [panelOpen, setPanelOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // The language also lives in the database, so the choice survives a cleared
  // webview profile and follows the installation, not the render process.
  const langHydrated = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void api
      .getSetting("lang")
      .then((stored) => {
        if (cancelled) return;
        if (stored === "pt" || stored === "en") setLang(stored);
        langHydrated.current = true;
      })
      .catch(() => {
        langHydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [setLang]);

  useEffect(() => {
    if (!langHydrated.current) return;
    void api.setSetting("lang", lang).catch(() => {});
  }, [lang]);

  const updateLook = useCallback((next: KeeperLook) => {
    setLook(next);
    saveLook(next);
  }, []);

  const reload = useCallback(async (term: string, at: string, accountId: number | null) => {
    try {
      const [nextRows, nextAccounts, nextCategories, nextTotals, nextByCategory, nextSeries, nextPlanner, housing, ceiling, scope, settled, storedLayout] =
        await Promise.all([
          api.transactions(term, at, accountId),
          api.accounts(),
          api.categories(),
          api.monthTotals(at),
          api.categoryTotals(at),
          api.monthSeries(at, 12),
          api.plannerState(at),
          api.getSetting("housing_category").catch(() => null),
          api.getSetting("housing_ceiling").catch(() => null),
          api.getSetting("housing_scope").catch(() => null),
          api.getSetting(`split_settled_${at}`).catch(() => null),
          api.getSetting("dashboard_layout").catch(() => null),
        ]);
      setRows(nextRows);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setTotals(nextTotals);
      setByCategory(nextByCategory);
      setSeries(nextSeries);
      setPlanner(nextPlanner);
      const storedHousing = housing ? Number(housing) : null;
      const fallback = nextCategories.find((category) => /housing|moradia/i.test(category.name));
      setHousingCategoryId(storedHousing ?? fallback?.id ?? null);
      setCeilingPct(ceiling ? Number(ceiling) : 30);
      setHousingScope(scope === "total" ? "total" : "primary");
      setSplitSettled(settled === "1");
      setLayout(parseLayout(storedLayout));
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const latest = await api.latestMonth().catch(() => null);
        if (!cancelled) setMonth(latest ?? currentMonth());
      } catch {
        if (!cancelled) setMonth(currentMonth());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (month) void reload(search, month, accountFilter);
  }, [month, search, accountFilter, reload]);

  // Card usage depends on the invoice window, which is calendar math, so it is
  // fetched per card after the planner state arrives.
  useEffect(() => {
    let cancelled = false;
    if (planner.cards.length === 0 || !month) {
      setUsage({});
      return;
    }
    (async () => {
      const entries = await Promise.all(
        planner.cards.map(async (meta) => {
          const window = invoiceWindow(meta.closingDay, meta.dueDay, month);
          const cents = await api.cardUsage(meta.accountId, window.from, window.to).catch(() => 0);
          return [meta.id, cents] as const;
        }),
      );
      if (!cancelled) setUsage(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [planner.cards, month]);

  const plan = useMemo(
    () =>
      planMonth({
        month: month ?? currentMonth(),
        incomes: planner.incomes,
        bills: planner.bills,
        payments: planner.payments,
        goals: planner.goals,
        goalTotals: planner.goalTotals,
        totals,
        housingCategoryId,
        ceilingPct,
      }),
    [month, planner, totals, housingCategoryId, ceilingPct],
  );

  const cards = useMemo(
    () =>
      planner.cards.map((meta) => ({
        meta,
        usageCents: usage[meta.id] ?? 0,
        window: invoiceWindow(meta.closingDay, meta.dueDay, month ?? currentMonth()),
      })),
    [planner.cards, usage, month],
  );

  const notifications = useMemo(
    () =>
      buildNotifications({
        plan,
        cards,
        today: new Date().toISOString().slice(0, 10),
        reads: planner.reads,
        hasIncome: planner.incomes.some((income) => income.active),
      }),
    [plan, cards, planner.reads, planner.incomes],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { rows: TransactionRow[]; total: number }>();
    for (const row of rows) {
      const entry = map.get(row.postedOn) ?? { rows: [], total: 0 };
      entry.rows.push(row);
      entry.total += row.amountCents;
      map.set(row.postedOn, entry);
    }
    return [...map.entries()].map(([day, value]) => ({ day, ...value }));
  }, [rows]);

  const onMonth = (delta: number) => {
    if (!month) return;
    const [year, index] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year, index - 1 + delta, 1));
    setMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const onCategory = async (transactionId: number, categoryId: number | null) => {
    try {
      await api.setCategory(transactionId, categoryId);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const saveIncome = async (input: IncomeInput) => {
    setDialog(null);
    await api.saveIncome(input);
    if (month) await reload(search, month, accountFilter);
  };

  const saveBill = async (input: BillInput) => {
    setDialog(null);
    await api.saveBill(input);
    if (month) await reload(search, month, accountFilter);
  };

  const removeBill = async (id: number) => {
    setDialog(null);
    await api.deleteBill(id);
    if (month) await reload(search, month, accountFilter);
  };

  const toggleBill = async (billId: number, paid: boolean) => {
    if (!month) return;
    await api.setBillPaid(billId, month, paid);
    await reload(search, month, accountFilter);
  };

  const saveCard = async (input: CardInput) => {
    setDialog(null);
    await api.saveCard(input);
    if (month) await reload(search, month, accountFilter);
  };

  const saveGoal = async (input: GoalInput) => {
    setDialog(null);
    await api.saveGoal(input);
    if (month) await reload(search, month, accountFilter);
  };

  const saveCeiling = async (value: number) => {
    setDialog(null);
    await api.setSetting("housing_ceiling", String(value));
    setCeilingPct(value);
  };

  const housingCategory = categories.find((category) => category.id === housingCategoryId);

  return (
    <div className="app">
      <TitleBar />

      <div className="shell">
        <aside className="rail">
          <div className="brand">
            <span className="brand-mark">t</span>
            <div>
              <strong>trove</strong>
              <span>{t("app.tagline")}</span>
            </div>
          </div>

          <nav className="nav">
            <span className="nav-group">{t("nav.menu")}</span>
            {MENU.map((item) => (
              <button
                key={item.route}
                type="button"
                className={route === item.route ? "nav-item active" : "nav-item"}
                onClick={() => setRoute(item.route)}
              >
                <Icon name={item.icon} size={17} />
                {t(`nav.${item.route}`)}
              </button>
            ))}
            <span className="nav-group">{t("nav.settingsGroup")}</span>
            {ADJUST.map((item) => (
              <button
                key={item.route}
                type="button"
                className={route === item.route ? "nav-item active" : "nav-item"}
                onClick={() => setRoute(item.route)}
              >
                <Icon name={item.icon} size={17} />
                {t(`nav.${item.route}`)}
              </button>
            ))}
          </nav>

          <div className="rail-spacer" />

          {SHOW_KEEPER ? (
            <div className="keeper">
              <Mascot
                look={look}
                mood={keeper.mood}
                size={58}
                animate={!panelOpen}
                hint={t("keeper.hint")}
              />
              <div className="keeper-copy">
                <p className="keeper-line">{keeper.line}</p>
                <button type="button" className="keeper-customize" onClick={() => setPanelOpen(true)}>
                  {t("common.customize")}
                </button>
              </div>
            </div>
          ) : null}

          <UpdateBanner updater={updater} onOpen={() => setRoute("settings")} />

          <div className="rail-foot">
            <button
              type="button"
              className="theme-pill"
              onClick={() => {
                const next: Theme = theme === "dark" ? "light" : "dark";
                setTheme(next);
                saveTheme(next);
              }}
              aria-label={t("common.theme")}
            >
              <span className={theme === "light" ? "theme-half active" : "theme-half"}>
                <Icon name="sun" size={14} />
              </span>
              <span className={theme === "dark" ? "theme-half" : "theme-half active"}>
                <Icon name="moon" size={14} />
              </span>
            </button>
            <span className="rail-version">
              {t("common.version", { value: updater.currentVersion || "0.1.0" })} · {BUILD_LABEL}
            </span>
          </div>
        </aside>

        <main className="main">
          {error ? (
            <div className="alert" role="alert">
              {error}
            </div>
          ) : null}

          {route === "overview" || route === "flow" || route === "transactions" ? (
            <TopBar
              month={month ?? currentMonth()}
              onMonth={onMonth}
              onPickMonth={setMonth}
              notifications={notifications}
              onReadAll={() => {
                void api.markNotificationsRead(notifications.map((item) => item.key)).then(() => {
                  if (month) void reload(search, month, accountFilter);
                });
              }}
              onImport={() => setRoute("import")}
              primaryLabel={t("ledger.import")}
              showLayout={route === "overview"}
              layoutEditing={layoutEditing}
              onToggleLayout={() => setLayoutEditing((value) => !value)}
            />
          ) : null}

          {route === "overview" ? (
            <OverviewScreen
              plan={plan}
              cards={cards}
              byCategory={byCategory}
              series={series}
              month={month ?? currentMonth()}
              onSelectMonth={setMonth}
              onToggleBill={(id, paid) => void toggleBill(id, paid)}
              onAddBill={() => setDialog({ kind: "bill", bill: null })}
              onEditBill={(bill) => setDialog({ kind: "bill", bill })}
              onAddCard={() => setDialog({ kind: "card", card: null })}
              onEditCard={(card) => setDialog({ kind: "card", card })}
              onAddGoal={() => setDialog({ kind: "goal", goal: null })}
              onEditHousing={() => setDialog({ kind: "ceiling" })}
              housingScope={housingScope}
              onHousingScope={(scope) => {
                setHousingScope(scope);
                void api.setSetting("housing_scope", scope);
              }}
              people={planner.people}
              shares={planner.shares}
              splitSettled={splitSettled}
              layout={layout}
              layoutEditing={layoutEditing}
              onLayoutMoveTo={(id: CardId, targetId: CardId) => {
                const next = moveCardTo(layout, id, targetId);
                setLayout(next);
                void api.setSetting("dashboard_layout", serializeLayout(next));
              }}
              onLayoutResize={(id: CardId, delta: number) => {
                const next = resizeCard(layout, id, delta);
                setLayout(next);
                void api.setSetting("dashboard_layout", serializeLayout(next));
              }}
              onLayoutMode={(id: CardId, mode: CardMode) => {
                const next = setMode(layout, id, mode);
                setLayout(next);
                void api.setSetting("dashboard_layout", serializeLayout(next));
              }}
              onLayoutReset={() => {
                const next = parseLayout(null);
                setLayout(next);
                void api.setSetting("dashboard_layout", serializeLayout(next));
              }}
              onLayoutDone={() => setLayoutEditing(false)}
              onAssignShare={(billId, personId) => {
                void api.setShare({ billId, personId }).then(() => {
                  if (month) void reload(search, month, accountFilter);
                });
              }}
              onSettle={() => {
                if (!month) return;
                setSplitSettled(true);
                void api.setSetting(`split_settled_${month}`, "1");
              }}
              onEditIncome={() => setDialog({ kind: "income", income: planner.incomes[0] ?? null })}
              look={look}
            />
          ) : null}

          {route === "transactions" ? (
            <TransactionsScreen
              rows={rows}
              categories={categories}
              search={search}
              loading={loading}
              onSearch={setSearch}
              onCategory={(id, categoryId) => void onCategory(id, categoryId)}
              onImport={() => setRoute("import")}
              groups={groups}
              accounts={accounts}
              accountFilter={accountFilter}
              onAccountFilter={setAccountFilter}
            />
          ) : null}

          {route === "flow" ? (
            <FlowScreen
              series={series}
              plan={plan}
              month={month ?? currentMonth()}
              onSelectMonth={setMonth}
            />
          ) : null}

          {route === "import" ? (
            <ImportScreen
              look={look}
              onImported={() => {
                if (month) void reload(search, month, accountFilter);
                setRoute("overview");
              }}
            />
          ) : null}

          {route === "settings" ? <SettingsScreen updater={updater} /> : null}
        </main>
      </div>

      {SHOW_KEEPER && panelOpen ? (
        <KeeperPanel look={look} onChange={updateLook} onClose={() => setPanelOpen(false)} />
      ) : null}

      {dialog?.kind === "income" ? (
        <IncomeDialog
          income={dialog.income}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveIncome(input)}
        />
      ) : null}

      {dialog?.kind === "bill" ? (
        <BillDialog
          bill={dialog.bill}
          categories={categories}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveBill(input)}
          onDelete={(id) => void removeBill(id)}
        />
      ) : null}

      {dialog?.kind === "card" ? (
        <CardDialog
          card={dialog.card}
          accounts={accounts}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveCard(input)}
        />
      ) : null}

      {dialog?.kind === "goal" ? (
        <GoalDialog
          goal={dialog.goal}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveGoal(input)}
        />
      ) : null}

      {dialog?.kind === "ceiling" ? (
        <CeilingDialog
          housing={housingCategory?.name ?? t("planner.housing")}
          value={ceilingPct}
          onClose={() => setDialog(null)}
          onSave={(value) => void saveCeiling(value)}
        />
      ) : null}
    </div>
  );
}

function CeilingDialog({
  housing,
  value,
  onClose,
  onSave,
}: {
  housing: string;
  value: number;
  onClose: () => void;
  onSave: (value: number) => void;
}) {
  const { t } = useLanguage();
  const [ceiling, setCeiling] = useState(value);
  return (
    <Dialog title={t("planner.housingCeiling")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(ceiling);
        }}
      >
        <p className="muted small">{t("planner.housingHint", { category: housing })}</p>
        <label className="field">
          <span>{t("planner.ceilingPct")}</span>
          <input
            type="number"
            min={5}
            max={100}
            value={ceiling}
            onChange={(event) => setCeiling(Number(event.target.value))}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="primary">
            {t("common.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
