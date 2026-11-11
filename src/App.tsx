import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { TopBar } from "./components/TopBar";
import { BillDialog, BudgetDialog, CardDialog, DepositDialog, GoalDialog, IncomeDialog } from "./components/PlannerDialogs";
import { ManualDialog } from "./components/ManualDialog";
import { DebtDialog } from "./components/DebtsCard";
import { Dialog } from "./components/Dialog";
import { Icon, type IconName } from "./components/Icons";
import { BottomNav } from "./components/ui/bottom-nav";
import {
  Sidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarItem,
  SidebarProfile,
} from "./components/ui/sidebar";
import { OverviewScreen } from "./screens/OverviewScreen";
import { TransactionsScreen } from "./screens/TransactionsScreen";
import { FlowScreen } from "./screens/FlowScreen";
import { ImportScreen } from "./screens/ImportScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { CardsScreen, DebtsScreen, FlowsScreen, HealthScreen, HouseScreen, IncomeScreen, PatrimonyScreen, ReserveScreen, RetirementScreen } from "./screens/PlannerScreens";
import { CategoriesScreen } from "./screens/CategoriesScreen";
import { api, EMPTY_PLANNER } from "./lib/api";
import type {
  Account,
  Bill,
  BillInput,
  BudgetLimitInput,
  BudgetStatus,
  CardInput,
  CardMeta,
  Category,
  CategoryInput,
  CategoryMonth,
  CategoryTotal,
  Debt,
  DebtInput,
  DepositInput,
  Goal,
  GoalInput,
  Income,
  IncomeInput,
  ManualEdit,
  ManualInput,
  MonthPoint,
  MonthTotals,
  PlannerState,
  TransactionRow,
} from "./lib/api";
import { useLanguage } from "./lib/language";
import { useUpdater } from "./lib/updater";
import { invoiceWindow } from "./domain/invoice";
import { planMonth } from "./domain/projection";
import { buildNotifications } from "./domain/notifications";
import { applyTheme, loadTheme, saveTheme, type Theme } from "./lib/theme";
import {
  moveCardTo,
  parseLayout,
  setSpan,
  serializeLayout,
  setMode,
  type CardId,
  type CardMode,
  type LayoutCard,
} from "./domain/layout";
import { BUILD_LABEL } from "./lib/build";

type Route =
  | "overview"
  | "transactions"
  | "flow"
  | "cards"
  | "reserve"
  | "house"
  | "income"
  | "patrimony"
  | "flows"
  | "health"
  | "debts"
  | "retirement"
  | "debts"
  | "categories"
  | "import"
  | "settings";

const MENU: Array<{ route: Route; icon: IconName }> = [
  { route: "overview", icon: "grid" },
  { route: "transactions", icon: "ledger" },
  { route: "flow", icon: "arrow-left-right" },
];

const PLANNING: Array<{ route: Route; icon: IconName }> = [
  { route: "cards", icon: "card" },
  { route: "reserve", icon: "target" },
  { route: "house", icon: "home" },
  { route: "income", icon: "trend" },
];

const STRATEGY: Array<{ route: Route; icon: IconName }> = [
  { route: "flows", icon: "swap" },
  { route: "patrimony", icon: "bank" },
  { route: "health", icon: "scale" },
  { route: "debts", icon: "file-text" },
  { route: "retirement", icon: "hourglass" },
];

const ADJUST: Array<{ route: Route; icon: IconName }> = [
  { route: "import", icon: "import" },
  { route: "categories", icon: "tag" },
  { route: "settings", icon: "settings" },
];

type DialogState =
  | { kind: "income"; income: Income | null }
  | { kind: "bill"; bill: Bill | null }
  | { kind: "card"; card: CardMeta | null }
  | { kind: "goal"; goal: Goal | null }
  | { kind: "debt"; debt: Debt | null }
  | { kind: "deposit"; goal: Goal }
  | { kind: "budget"; id: number; name: string; budget: number | null; monthly: number | null; carryover: boolean; overridden: boolean }
  | { kind: "manual"; entry: TransactionRow | null }
  | { kind: "ceiling" }
  | null;

const currentMonth = () => new Date().toISOString().slice(0, 7);

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
  const [matrix, setMatrix] = useState<CategoryMonth[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
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
  const [userName, setUserName] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const updater = useUpdater();
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

  // The profile name lives with the other settings; TopBar greets with it.
  useEffect(() => {
    let cancelled = false;
    void api
      .getSetting("user_name")
      .then((stored) => {
        if (!cancelled) setUserName(stored && stored.trim() ? stored.trim() : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [route]);

  const reload = useCallback(async (term: string, at: string, accountId: number | null) => {
    try {
      const [nextRows, nextAccounts, nextCategories, nextTotals, nextByCategory, nextSeries, nextMatrix, nextPlanner, nextBudgetStatus, housing, ceiling, scope, settled, storedLayout] =
        await Promise.all([
          api.transactions(term, at, accountId),
          api.accounts(),
          api.categories(),
          api.monthTotals(at),
          api.categoryTotals(at),
          api.monthSeries(at, 12),
          api.categoryMonthSeries(at, 12),
          api.plannerState(at),
          api.budgetStatus(at).catch(() => null),
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
      setMatrix(nextMatrix);
      setPlanner(nextPlanner);
      setBudgetStatus(nextBudgetStatus);
      const storedHousing = housing === "none" ? null : housing ? Number(housing) : null;
      const fallback = nextCategories.find((category) => /housing|moradia/i.test(category.name));
      setHousingCategoryId(housing === "none" ? null : storedHousing ?? fallback?.id ?? null);
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
        debts: planner.debts,
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

  const clearMonth = async () => {
    if (!month) return;
    try {
      await api.clearMonth(month);
      await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const saveIncome = async (input: IncomeInput) => {
    try {
      await api.saveIncome(input);
      setDialog(null);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const saveBill = async (input: BillInput) => {
    try {
      await api.saveBill(input);
      setDialog(null);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const removeBill = async (id: number) => {
    setDialog(null);
    await api.deleteBill(id);
    if (month) await reload(search, month, accountFilter);
  };

  const saveDebt = async (input: DebtInput) => {
    try {
      await api.saveDebt(input);
      setDialog(null);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const removeDebt = async (id: number) => {
    setDialog(null);
    await api.deleteDebt(id);
    if (month) await reload(search, month, accountFilter);
  };

  const saveManual = async (input: ManualInput) => {
    try {
      await api.saveManual(input);
      setDialog(null);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const updateManual = async (input: ManualEdit) => {
    try {
      await api.updateManual(input);
      setDialog(null);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const deleteManual = async (id: number) => {
    try {
      await api.deleteManual(id);
      setDialog(null);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const createManualAccount = async (name: string) => {
    try {
      await api.createManualAccount(name);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const renameManualAccount = async (id: number, name: string) => {
    try {
      await api.renameAccount(id, name);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const archiveAccount = async (id: number) => {
    try {
      await api.archiveAccount(id);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const saveDeposit = async (input: DepositInput) => {
    try {
      await api.saveDeposit(input);
      setDialog(null);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const saveBudget = async (
    id: number,
    budget: number | null,
    monthly: number | null,
    carryover: boolean,
  ) => {
    if (!month) return;
    try {
      await api.setCategoryBudget(id, budget);
      const input: BudgetLimitInput = {
        month,
        categoryId: id,
        limitCents: monthly,
        carryover,
      };
      await api.saveBudgetLimit(input);
      setDialog(null);
      await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const openBudgetDialog = (category: { id: number; name: string; budget: number | null }) => {
    const line = budgetStatus?.lines.find((entry) => entry.categoryId === category.id);
    setDialog({
      kind: "budget",
      ...category,
      monthly: line?.overridden ? line.limitCents : null,
      carryover: line?.carryover ?? false,
      overridden: line?.overridden ?? false,
    });
  };

  const saveGlobalBudget = async (limit: number | null, carryover: boolean) => {
    if (!month) return;
    try {
      await api.saveBudgetLimit({ month, categoryId: null, limitCents: limit, carryover });
      await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const saveCategory = async (input: CategoryInput) => {
    try {
      await api.saveCategory(input);
      setDialog(null);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const deleteCategory = async (id: number) => {
    try {
      await api.deleteCategory(id);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const archiveCategory = async (id: number, archived: boolean) => {
    try {
      await api.archiveCategory(id, archived);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const toggleDebt = async (id: number, settled: boolean) => {
    if (!month) return;
    try {
      await api.setDebtSettled(id, settled);
      await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const toggleBill = async (billId: number, paid: boolean) => {
    if (!month) return;
    try {
      await api.setBillPaid(billId, month, paid);
      await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const saveCard = async (input: CardInput) => {
    try {
      await api.saveCard(input);
      setDialog(null);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const saveGoal = async (input: GoalInput) => {
    try {
      await api.saveGoal(input);
      setDialog(null);
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const saveCeiling = async (value: number) => {
    setDialog(null);
    await api.setSetting("housing_ceiling", String(value));
    setCeilingPct(value);
  };

  const saveHousingCategory = async (categoryId: number | null) => {
    setHousingCategoryId(categoryId);
    try {
      await api.setSetting("housing_category", categoryId === null ? "none" : String(categoryId));
      if (month) await reload(search, month, accountFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const housingCategory = categories.find((category) => category.id === housingCategoryId);
  const selfPerson = planner.people.find((person) => person.isSelf) ?? planner.people[0] ?? null;

  return (
    <div className="app">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <Sidebar className="hidden md:flex">
          <SidebarProfile
            name={selfPerson?.name ?? t("split.you")}
            detail={t("app.tagline")}
            initials={(selfPerson?.name ?? t("split.you")).slice(0, 2).toUpperCase()}
            color={selfPerson?.color}
            onClick={() => setRoute("settings")}
          />

          <nav aria-label={t("nav.primary")} className="flex flex-col gap-3">
            <SidebarGroup label={t("nav.menu")}>
              {MENU.map((item) => (
                <SidebarItem
                  key={item.route}
                  active={route === item.route}
                  onClick={() => setRoute(item.route)}
                >
                  <Icon name={item.icon} size={17} />
                  {t(`nav.${item.route}`)}
                </SidebarItem>
              ))}
            </SidebarGroup>
            <SidebarGroup label={t("nav.planningGroup")}>
              {PLANNING.map((item) => (
                <SidebarItem
                  key={item.route}
                  active={route === item.route}
                  onClick={() => setRoute(item.route)}
                >
                  <Icon name={item.icon} size={17} />
                  {t(`nav.${item.route}`)}
                </SidebarItem>
              ))}
            </SidebarGroup>
            <SidebarGroup label={t("nav.strategyGroup")}>
              {STRATEGY.map((item) => (
                <SidebarItem
                  key={item.route}
                  active={route === item.route}
                  onClick={() => setRoute(item.route)}
                >
                  <Icon name={item.icon} size={17} />
                  {t(`nav.${item.route}`)}
                </SidebarItem>
              ))}
            </SidebarGroup>
            <SidebarGroup label={t("nav.settingsGroup")}>
              {ADJUST.map((item) => (
                <SidebarItem
                  key={item.route}
                  active={route === item.route}
                  onClick={() => setRoute(item.route)}
                >
                  <Icon name={item.icon} size={17} />
                  {t(`nav.${item.route}`)}
                </SidebarItem>
              ))}
            </SidebarGroup>
          </nav>

          <SidebarFooter>
            <UpdateBanner updater={updater} onOpen={() => setRoute("settings")} />

            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                className="flex items-center rounded-full border border-line bg-surface-soft p-0.5"
                onClick={() => {
                  const next: Theme = theme === "dark" ? "light" : "dark";
                  setTheme(next);
                  saveTheme(next);
                }}
                aria-label={t("common.theme")}
                aria-pressed={theme === "dark"}
              >
                <span
                  className={
                    theme === "light"
                      ? "grid size-6 place-items-center rounded-full bg-surface text-ink shadow-tile"
                      : "grid size-6 place-items-center rounded-full text-faint"
                  }
                >
                  <Icon name="sun" size={14} />
                </span>
                <span
                  className={
                    theme === "dark"
                      ? "grid size-6 place-items-center rounded-full bg-surface text-ink shadow-tile"
                      : "grid size-6 place-items-center rounded-full text-faint"
                  }
                >
                  <Icon name="moon" size={14} />
                </span>
              </button>
              <span className="truncate text-2xs text-faint">
                {t("common.version", { value: updater.currentVersion || "0.1.0" })} · {BUILD_LABEL}
              </span>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="main min-w-0 flex-1 pb-20 md:pb-11">
          {error ? (
            <div className="alert" role="alert">
              {error}
            </div>
          ) : null}

          {route !== "import" && route !== "settings" ? (
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
              onLaunch={() => setDialog({ kind: "manual", entry: null })}
              canLaunch={accounts.length > 0}
              userName={userName}
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
              matrix={matrix}
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
              debts={planner.debts}
              splitSettled={splitSettled}
              onAddDebt={() => setDialog({ kind: "debt", debt: null })}
              onToggleDebt={(id, settled) => void toggleDebt(id, settled)}
              layout={layout}
              layoutEditing={layoutEditing}
              onLayoutMoveTo={(id: CardId, targetId: CardId) => {
                const next = moveCardTo(layout, id, targetId);
                setLayout(next);
                void api.setSetting("dashboard_layout", serializeLayout(next));
              }}
              onLayoutSpan={(id: CardId, span: number) => {
                const next = setSpan(layout, id, span);
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
              onEditBudget={(category) => openBudgetDialog(category)}
              housingCategoryId={housingCategoryId}
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
              onClearMonth={() => void clearMonth()}
              onEditEntry={(entry) => setDialog({ kind: "manual", entry })}
              onDeleteEntry={(id) => void deleteManual(id)}
              month={month ?? currentMonth()}
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

          {route === "cards" ? (
            <CardsScreen
              cards={cards}
              month={month ?? currentMonth()}
              onAdd={() => setDialog({ kind: "card", card: null })}
              onEdit={(card) => setDialog({ kind: "card", card })}
            />
          ) : null}

          {route === "reserve" ? (
            <ReserveScreen
              plan={plan}
              onAdd={() => setDialog({ kind: "goal", goal: null })}
              onEdit={(goal) => setDialog({ kind: "goal", goal })}
              onDeposit={(goal) => setDialog({ kind: "deposit", goal })}
            />
          ) : null}

          {route === "patrimony" ? (
            <PatrimonyScreen
              plan={plan}
              series={series}
              month={month ?? currentMonth()}
            />
          ) : null}

          {route === "flows" ? (
            <FlowsScreen
              incomes={planner.incomes}
              totals={totals}
              byCategory={byCategory}
              month={month ?? currentMonth()}
              status={budgetStatus}
              onAddIncome={() => setDialog({ kind: "income", income: null })}
              onEditIncome={(income) => setDialog({ kind: "income", income })}
              onEditBudget={(category) => openBudgetDialog(category)}
              onSaveGlobal={(limit, carryover) => void saveGlobalBudget(limit, carryover)}
            />
          ) : null}

          {route === "health" ? <HealthScreen plan={plan} byCategory={byCategory} /> : null}

          {route === "debts" ? (
            <DebtsScreen
              plan={plan}
              cards={cards}
              month={month ?? currentMonth()}
              onEditBill={(bill) => setDialog({ kind: "bill", bill })}
            />
          ) : null}

          {route === "retirement" ? <RetirementScreen plan={plan} /> : null}

          {route === "house" ? (
            <HouseScreen
              plan={plan}
              categories={categories}
              housingCategoryId={housingCategoryId}
              housingScope={housingScope}
              people={planner.people}
              shares={planner.shares}
              splitSettled={splitSettled}
              onCategory={(categoryId) => void saveHousingCategory(categoryId)}
              onScope={(scope) => {
                setHousingScope(scope);
                void api.setSetting("housing_scope", scope);
              }}
              onEditCeiling={() => setDialog({ kind: "ceiling" })}
              onAddBill={() => setDialog({ kind: "bill", bill: null })}
              onEditBill={(bill) => setDialog({ kind: "bill", bill })}
              onAssign={(billId, personId) => {
                void api.setShare({ billId, personId }).then(() => {
                  if (month) void reload(search, month, accountFilter);
                });
              }}
              onSettle={() => {
                if (!month) return;
                setSplitSettled(true);
                void api.setSetting(`split_settled_${month}`, "1");
              }}
            />
          ) : null}

          {route === "income" ? (
            <IncomeScreen
              incomes={planner.incomes}
              plan={plan}
              onAdd={() => setDialog({ kind: "income", income: null })}
              onEdit={(income) => setDialog({ kind: "income", income })}
            />
          ) : null}

          {route === "import" ? (
            <ImportScreen
              onImported={() => {
                if (month) void reload(search, month, accountFilter);
                setRoute("overview");
              }}
            />
          ) : null}

          {route === "categories" ? (
            <CategoriesScreen
              categories={categories}
              onSave={(input) => void saveCategory(input)}
              onDelete={(id) => void deleteCategory(id)}
              onArchive={(id, archived) => void archiveCategory(id, archived)}
            />
          ) : null}

          {route === "settings" ? (
          <SettingsScreen
            updater={updater}
            accounts={accounts}
            onCreateAccount={(name) => void createManualAccount(name)}
            onRenameAccount={(id, name) => void renameManualAccount(id, name)}
            onArchiveAccount={(id) => void archiveAccount(id)}
          />
        ) : null}
        </main>
      </div>

      <BottomNav
        label={t("nav.primary")}
        items={[
          ...MENU.map((item) => ({
            key: item.route,
            label: t(`nav.${item.route}`),
            icon: <Icon name={item.icon} size={19} />,
            active: route === item.route,
            onSelect: () => setRoute(item.route),
          })),
          ...PLANNING.map((item) => ({
            key: item.route,
            label: t(`nav.${item.route}`),
            icon: <Icon name={item.icon} size={19} />,
            active: route === item.route,
            onSelect: () => setRoute(item.route),
          })),
          ...STRATEGY.map((item) => ({
            key: item.route,
            label: t(`nav.${item.route}`),
            icon: <Icon name={item.icon} size={19} />,
            active: route === item.route,
            onSelect: () => setRoute(item.route),
          })),
          {
            key: "settings",
            label: t("nav.settings"),
            icon: <Icon name="settings" size={19} />,
            active: route === "settings",
            onSelect: () => setRoute("settings"),
          },
        ]}
      />

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
          defaultCategoryId={route === "house" ? housingCategoryId : null}
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

      {dialog?.kind === "deposit" ? (
        <DepositDialog
          goal={dialog.goal}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveDeposit(input)}
        />
      ) : null}

      {dialog?.kind === "budget" ? (
        <BudgetDialog
          name={dialog.name}
          budget={dialog.budget}
          month={month ?? currentMonth()}
          monthly={dialog.monthly}
          carryover={dialog.carryover}
          onClose={() => setDialog(null)}
          onSave={(base, only, carry) => void saveBudget(dialog.id, base, only, carry)}
        />
      ) : null}

      {dialog?.kind === "debt" ? (
        <DebtDialog
          debt={dialog.debt}
          people={planner.people}
          month={month ?? currentMonth()}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveDebt(input)}
          onDelete={(id) => void removeDebt(id)}
        />
      ) : null}

      {dialog?.kind === "manual" ? (
        <ManualDialog
          accounts={accounts}
          categories={categories}
          entry={dialog.entry}
          onClose={() => setDialog(null)}
          onCreate={(input) => void saveManual(input)}
          onUpdate={(input) => void updateManual(input)}
          onDelete={(id) => void deleteManual(id)}
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
