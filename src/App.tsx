import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { TopBar } from "./components/TopBar";
import {
  BillDialog,
  BudgetDialog,
  CardDialog,
  DepositDialog,
  GoalDialog,
  IncomeDialog,
} from "./components/PlannerDialogs";
import { ManualDialog } from "./components/ManualDialog";
import { TransferDialog } from "./components/TransferDialog";
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
import {
  CardsScreen,
  DebtsScreen,
  FlowsScreen,
  HealthScreen,
  HouseScreen,
  PatrimonyScreen,
  ScreenHeader,
  ReserveScreen,
  RetirementScreen,
} from "./screens/PlannerScreens";
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
  DailyPoint,
  PlannerState,
  RecurrenceRow,
  Rule,
  RuleInput,
  Tag,
  Holding,
  HoldingInput,
  TransactionRow,
  TransferInput,
} from "./lib/api";
import { useLanguage } from "./lib/language";
import { useUpdater } from "./lib/updater";
import { invoiceWindow } from "./domain/invoice";
import { planMonth } from "./domain/projection";
import { buildNotifications } from "./domain/notifications";
import { applyTheme, loadTheme, saveTheme, type Theme } from "./lib/theme";
import { currentMonth, todayIso } from "./lib/format";
import {
  moveCardTo,
  parseLayout,
  setSpan,
  serializeLayout,
  setMode,
  type CardId,
  type CardMode,
  type LayoutCard,
  type Span,
} from "./domain/layout";
import { BUILD_LABEL } from "./lib/build";
import { SectionPage } from "./components/SectionPage";

type Route =
  | "overview"
  | "transactions"
  | "flow"
  | "cards"
  | "house"
  | "goals"
  | "patrimony"
  | "categories"
  | "import"
  | "settings";

const ROUTES: readonly Route[] = [
  "overview",
  "transactions",
  "flow",
  "cards",
  "house",
  "goals",
  "patrimony",
  "categories",
  "import",
  "settings",
];

// One entry per question the app answers; related screens live behind tabs.
const MENU: Array<{ route: Route; icon: IconName }> = [
  { route: "overview", icon: "grid" },
  { route: "transactions", icon: "ledger" },
  { route: "flow", icon: "arrow-left-right" },
  { route: "cards", icon: "card" },
  { route: "house", icon: "home" },
  { route: "goals", icon: "target" },
  { route: "patrimony", icon: "bank" },
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
  | {
      kind: "budget";
      id: number;
      name: string;
      budget: number | null;
      monthly: number | null;
      carryover: boolean;
      overridden: boolean;
    }
  | { kind: "manual"; entry: TransactionRow | null }
  | { kind: "transfer" }
  | { kind: "ceiling" }
  | null;

export function App() {
  const { lang, setLang, t } = useLanguage();
  // The last tab picked inside each section, so coming back lands where you left.
  const [tabs, setTabs] = useState<Record<string, string>>(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    const at = new URLSearchParams(window.location.search).get("route");
    return requested && at ? { [at]: requested } : {};
  });
  const tabOf = <T extends string>(section: Route, fallback: T): T =>
    (tabs[section] as T) ?? fallback;
  const setTab = (section: Route, id: string) =>
    setTabs((current) => ({ ...current, [section]: id }));

  // `?route=` only exists in the browser preview, where it picks the screen to render.
  const [route, setRoute] = useState<Route>(() => {
    const requested = new URLSearchParams(window.location.search).get("route");
    return ROUTES.includes(requested as Route) ? (requested as Route) : "overview";
  });
  const [month, setMonth] = useState<string | null>(null);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [recentRows, setRecentRows] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totals, setTotals] = useState<MonthTotals | null>(null);
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [series, setSeries] = useState<MonthPoint[]>([]);
  const [matrix, setMatrix] = useState<CategoryMonth[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [recurrence, setRecurrence] = useState<RecurrenceRow[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // The rail keeps its width between launches, like the theme and the layout.
  useEffect(() => {
    let cancelled = false;
    void api
      .getSetting("sidebar_collapsed")
      .then((stored) => {
        if (!cancelled) setSidebarCollapsed(stored === "1");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const reload = useCallback(
    async (term: string, at: string, accountId: number | null, tagId: number | null) => {
      try {
        const [
          nextRows,
          nextAccounts,
          nextCategories,
          nextTotals,
          nextByCategory,
          nextSeries,
          nextMatrix,
          nextPlanner,
          nextBudgetStatus,
          nextHistory,
          nextDaily,
          nextRules,
          nextTags,
          nextHoldings,
          housing,
          ceiling,
          scope,
          settled,
          storedLayout,
          nextRecent,
        ] = await Promise.all([
          api.transactions(term, at, accountId, 500, tagId),
          api.accounts(),
          api.categories(),
          api.monthTotals(at),
          api.categoryTotals(at),
          api.monthSeries(at, 12),
          api.categoryMonthSeries(at, 12),
          api.plannerState(at),
          api.budgetStatus(at).catch(() => null),
          api.recurrenceRows(at, 12).catch(() => []),
          api.dailyExpense(at).catch(() => []),
          api.listRules().catch(() => []),
          api.tags().catch(() => []),
          api.holdings().catch(() => []),
          api.getSetting("housing_category").catch(() => null),
          api.getSetting("housing_ceiling").catch(() => null),
          api.getSetting("housing_scope").catch(() => null),
          api.getSetting(`split_settled_${at}`).catch(() => null),
          api.getSetting("dashboard_layout").catch(() => null),
          api.transactions("", at, null, 10, null).catch(() => []),
        ]);
        setRows(nextRows);
        setRecentRows(nextRecent);
        setAccounts(nextAccounts);
        setCategories(nextCategories);
        setTotals(nextTotals);
        setByCategory(nextByCategory);
        setSeries(nextSeries);
        setMatrix(nextMatrix);
        setPlanner(nextPlanner);
        setBudgetStatus(nextBudgetStatus);
        setRecurrence(nextHistory);
        setDaily(nextDaily);
        setRules(nextRules);
        setTags(nextTags);
        setHoldings(nextHoldings);
        const storedHousing = housing === "none" ? null : housing ? Number(housing) : null;
        const fallback = nextCategories.find((category) => /housing|moradia/i.test(category.name));
        setHousingCategoryId(housing === "none" ? null : (storedHousing ?? fallback?.id ?? null));
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
    },
    [],
  );

  const refreshData = useCallback(
    async (nextTagFilter: number | null = tagFilter) => {
      if (!month) return;
      await reload(search, month, accountFilter, nextTagFilter);
    },
    [month, search, accountFilter, tagFilter, reload],
  );

  const mutateAndRefresh = useCallback(
    async (
      operation: () => Promise<unknown>,
      { closeDialog = false }: { closeDialog?: boolean } = {},
    ) => {
      try {
        await operation();
        if (closeDialog) setDialog(null);
        await refreshData();
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : String(problem));
      }
    },
    [refreshData],
  );

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
    void refreshData();
  }, [refreshData]);

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
        today: todayIso(),
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

  const saveLayout = (next: LayoutCard[]) => {
    setLayout(next);
    void api.setSetting("dashboard_layout", serializeLayout(next));
  };

  const onCategory = (transactionId: number, categoryId: number | null) =>
    mutateAndRefresh(() => api.setCategory(transactionId, categoryId));

  const clearMonth = async () => {
    if (!month) return;
    await mutateAndRefresh(() => api.clearMonth(month));
  };

  const saveIncome = (input: IncomeInput) =>
    mutateAndRefresh(() => api.saveIncome(input), { closeDialog: true });

  const saveBill = (input: BillInput) =>
    mutateAndRefresh(() => api.saveBill(input), { closeDialog: true });

  const removeBill = async (id: number) => {
    setDialog(null);
    await api.deleteBill(id);
    await refreshData();
  };

  const saveDebt = (input: DebtInput) =>
    mutateAndRefresh(() => api.saveDebt(input), { closeDialog: true });

  const removeDebt = async (id: number) => {
    setDialog(null);
    await api.deleteDebt(id);
    await refreshData();
  };

  const saveManual = (input: ManualInput) =>
    mutateAndRefresh(() => api.saveManual(input), { closeDialog: true });

  const updateManual = (input: ManualEdit) =>
    mutateAndRefresh(() => api.updateManual(input), { closeDialog: true });

  const deleteManual = (id: number) =>
    mutateAndRefresh(() => api.deleteManual(id), { closeDialog: true });

  const saveTransfer = (input: TransferInput) =>
    mutateAndRefresh(() => api.saveTransfer(input), { closeDialog: true });

  const saveRefund = (originalId: number) => mutateAndRefresh(() => api.saveRefund({ originalId }));

  const saveRule = (input: RuleInput) => mutateAndRefresh(() => api.saveRule(input));

  const deleteRule = (id: number) => mutateAndRefresh(() => api.deleteRule(id));

  const applyRules = async (): Promise<number> => {
    const count = await api.applyRules();
    await refreshData();
    return count;
  };

  const saveTag = async (name: string): Promise<number | null> => {
    try {
      const id = await api.saveTag(name);
      await refreshData();
      return id;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
      return null;
    }
  };

  const deleteTag = async (id: number) => {
    try {
      await api.deleteTag(id);
      if (tagFilter === id) setTagFilter(null);
      await refreshData(tagFilter === id ? null : tagFilter);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const saveHolding = (input: HoldingInput) => mutateAndRefresh(() => api.saveHolding(input));

  const deleteHolding = (id: number) => mutateAndRefresh(() => api.deleteHolding(id));

  const bulkSetCategory = (ids: number[], categoryId: number | null) =>
    mutateAndRefresh(() => api.bulkSetCategory(ids, categoryId));

  const bulkTag = (ids: number[], tagId: number, assign: boolean) =>
    mutateAndRefresh(() => api.bulkTag(ids, tagId, assign));

  const createManualAccount = (name: string) =>
    mutateAndRefresh(() => api.createManualAccount(name));

  const renameManualAccount = (id: number, name: string) =>
    mutateAndRefresh(() => api.renameAccount(id, name));

  const archiveAccount = (id: number) => mutateAndRefresh(() => api.archiveAccount(id));

  const saveDeposit = (input: DepositInput) =>
    mutateAndRefresh(() => api.saveDeposit(input), { closeDialog: true });

  const saveBudget = async (
    id: number,
    budget: number | null,
    monthly: number | null,
    carryover: boolean,
  ) => {
    if (!month) return;
    const input: BudgetLimitInput = {
      month,
      categoryId: id,
      limitCents: monthly,
      carryover,
    };
    await mutateAndRefresh(
      async () => {
        await api.setCategoryBudget(id, budget);
        await api.saveBudgetLimit(input);
      },
      { closeDialog: true },
    );
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
    await mutateAndRefresh(() =>
      api.saveBudgetLimit({ month, categoryId: null, limitCents: limit, carryover }),
    );
  };

  const saveCategory = (input: CategoryInput) =>
    mutateAndRefresh(() => api.saveCategory(input), { closeDialog: true });

  const deleteCategory = (id: number) => mutateAndRefresh(() => api.deleteCategory(id));

  const archiveCategory = (id: number, archived: boolean) =>
    mutateAndRefresh(() => api.archiveCategory(id, archived));

  const toggleDebt = async (id: number, settled: boolean) => {
    if (!month) return;
    await mutateAndRefresh(() => api.setDebtSettled(id, settled));
  };

  const toggleBill = async (billId: number, paid: boolean) => {
    if (!month) return;
    await mutateAndRefresh(() => api.setBillPaid(billId, month, paid));
  };

  const saveCard = (input: CardInput) =>
    mutateAndRefresh(() => api.saveCard(input), { closeDialog: true });

  const saveGoal = (input: GoalInput) =>
    mutateAndRefresh(() => api.saveGoal(input), { closeDialog: true });

  const saveCeiling = async (value: number) => {
    setDialog(null);
    await api.setSetting("housing_ceiling", String(value));
    setCeilingPct(value);
  };

  const saveHousingCategory = async (categoryId: number | null) => {
    setHousingCategoryId(categoryId);
    try {
      await api.setSetting("housing_category", categoryId === null ? "none" : String(categoryId));
      await refreshData();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const housingCategory = categories.find((category) => category.id === housingCategoryId);
  const selfPerson = planner.people.find((person) => person.isSelf) ?? planner.people[0] ?? null;
  const profileName = userName?.trim() || t("split.you");

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    void api.setSetting("sidebar_collapsed", next ? "1" : "0");
  };

  // A collapsed rail shows only the icon, so the label becomes its tooltip and
  // its accessible name.
  const navItem = (item: { route: Route; icon: IconName }) => {
    const label = t(`nav.${item.route}`);
    return (
      <SidebarItem
        key={item.route}
        active={route === item.route}
        onClick={() => setRoute(item.route)}
        className={sidebarCollapsed ? "justify-center px-0" : undefined}
        title={sidebarCollapsed ? label : undefined}
        aria-label={sidebarCollapsed ? label : undefined}
      >
        <Icon name={item.icon} size={17} />
        <span className="sidebar-label">{label}</span>
      </SidebarItem>
    );
  };

  return (
    <div className="app">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <Sidebar className="hidden md:flex" collapsed={sidebarCollapsed}>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={t(sidebarCollapsed ? "sidebar.expand" : "sidebar.collapse")}
            aria-label={t(sidebarCollapsed ? "sidebar.expand" : "sidebar.collapse")}
            aria-expanded={!sidebarCollapsed}
          >
            <Icon name={sidebarCollapsed ? "chevron-right" : "chevron-left"} size={15} />
          </button>

          <SidebarProfile
            name={profileName}
            detail={t("app.tagline")}
            initials={profileName.slice(0, 2).toUpperCase()}
            color={selfPerson?.color}
            onClick={() => setRoute("settings")}
            collapsed={sidebarCollapsed}
            className={sidebarCollapsed ? "justify-center px-0" : undefined}
          />

          <nav
            aria-label={t("nav.primary")}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
          >
            <SidebarGroup label={t("nav.menu")}>{MENU.map(navItem)}</SidebarGroup>
            <div className="mt-auto">
              <SidebarGroup label={t("nav.settingsGroup")}>{ADJUST.map(navItem)}</SidebarGroup>
            </div>
          </nav>

          <SidebarFooter>
            <div className="sidebar-update">
              <UpdateBanner updater={updater} onOpen={() => setRoute("settings")} />
            </div>

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
                  className={[
                    "grid size-6 place-items-center rounded-full",
                    theme === "light" ? "bg-surface text-ink shadow-tile" : "text-faint",
                    sidebarCollapsed && theme !== "light" ? "hidden" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Icon name="sun" size={14} />
                </span>
                <span
                  className={[
                    "grid size-6 place-items-center rounded-full",
                    theme === "dark" ? "bg-surface text-ink shadow-tile" : "text-faint",
                    sidebarCollapsed && theme !== "dark" ? "hidden" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Icon name="moon" size={14} />
                </span>
              </button>
              <span className="sidebar-footer-meta truncate text-2xs text-faint">
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
                  void refreshData();
                });
              }}
              onImport={() => setRoute("import")}
              onLaunch={() => setDialog({ kind: "manual", entry: null })}
              canLaunch={accounts.length > 0}
              primaryLabel={t("ledger.import")}
              showLayout={route === "overview"}
              layoutEditing={layoutEditing}
              onToggleLayout={() => setLayoutEditing((value) => !value)}
            />
          ) : null}

          <div className="route-view" key={route}>
            {route === "overview" ? (
              <OverviewScreen
                plan={plan}
                cards={cards}
                byCategory={byCategory}
                series={series}
                matrix={matrix}
                rows={recentRows}
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
                  saveLayout(moveCardTo(layout, id, targetId));
                }}
                onLayoutResize={(id: CardId, span: Span) => {
                  saveLayout(setSpan(layout, id, span));
                }}
                onLayoutSpan={(id: CardId, span: number) => {
                  saveLayout(setSpan(layout, id, span));
                }}
                onLayoutMode={(id: CardId, mode: CardMode) => {
                  saveLayout(setMode(layout, id, mode));
                }}
                onLayoutReset={() => {
                  saveLayout(parseLayout(null));
                }}
                onLayoutDone={() => setLayoutEditing(false)}
                onAssignShare={(billId, personId) => {
                  void api.setShare({ billId, personId }).then(() => {
                    void refreshData();
                  });
                }}
                onSettle={() => {
                  if (!month) return;
                  setSplitSettled(true);
                  void api.setSetting(`split_settled_${month}`, "1");
                }}
                onEditIncome={() =>
                  setDialog({ kind: "income", income: planner.incomes[0] ?? null })
                }
                onEditBudget={(category) => openBudgetDialog(category)}
                housingCategoryId={housingCategoryId}
              />
            ) : null}

            {route === "transactions" ? (
              <TransactionsScreen
                rows={rows}
                categories={categories}
                tags={tags}
                search={search}
                loading={loading}
                onSearch={setSearch}
                onCategory={(id, categoryId) => void onCategory(id, categoryId)}
                onImport={() => setRoute("import")}
                onClearMonth={() => void clearMonth()}
                onEditEntry={(entry) => setDialog({ kind: "manual", entry })}
                onDeleteEntry={(id) => void deleteManual(id)}
                onRefund={(id) => void saveRefund(id)}
                onNewTransfer={() => setDialog({ kind: "transfer" })}
                onBulkCategory={(ids, categoryId) => void bulkSetCategory(ids, categoryId)}
                onBulkTag={(ids, tagId, assign) => void bulkTag(ids, tagId, assign)}
                onNewTag={(name) => saveTag(name)}
                onDeleteTag={(id) => void deleteTag(id)}
                month={month ?? currentMonth()}
                groups={groups}
                accounts={accounts}
                accountFilter={accountFilter}
                onAccountFilter={setAccountFilter}
                tagFilter={tagFilter}
                onTagFilter={setTagFilter}
              />
            ) : null}

            {route === "flow" ? (
              <SectionPage
                eyebrow={t("nav.flow")}
                tabs={[
                  { id: "summary", label: t("tab.flowSummary") },
                  { id: "trends", label: t("tab.flowTrends") },
                ]}
                active={tabOf("flow", "summary")}
                onTab={(id) => setTab("flow", id)}
              >
                {tabOf("flow", "summary") === "summary" ? (
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
                ) : (
                  <section className="screen planner-screen">
                    <ScreenHeader
                      eyebrow={t("nav.flow")}
                      title={t("tab.flowTrends")}
                      description={t("flow.trendsDescription")}
                    />
                    <FlowScreen
                      series={series}
                      daily={daily}
                      paceCents={budgetStatus?.global?.effectiveCents ?? null}
                      plan={plan}
                      month={month ?? currentMonth()}
                      onSelectMonth={setMonth}
                    />
                  </section>
                )}
              </SectionPage>
            ) : null}

            {route === "cards" ? (
              <SectionPage
                eyebrow={t("nav.cards")}
                tabs={[
                  { id: "cards", label: t("tab.cards") },
                  { id: "debts", label: t("tab.installments") },
                ]}
                active={tabOf("cards", "cards")}
                onTab={(id) => setTab("cards", id)}
              >
                {tabOf("cards", "cards") === "cards" ? (
                  <CardsScreen
                    cards={cards}
                    month={month ?? currentMonth()}
                    onAdd={() => setDialog({ kind: "card", card: null })}
                    onEdit={(card) => setDialog({ kind: "card", card })}
                  />
                ) : (
                  <DebtsScreen
                    plan={plan}
                    cards={cards}
                    month={month ?? currentMonth()}
                    history={recurrence}
                    onEditBill={(bill) => setDialog({ kind: "bill", bill })}
                  />
                )}
              </SectionPage>
            ) : null}

            {route === "goals" ? (
              <SectionPage
                eyebrow={t("nav.goals")}
                tabs={[
                  { id: "goals", label: t("tab.goals") },
                  { id: "retirement", label: t("nav.retirement") },
                ]}
                active={tabOf("goals", "goals")}
                onTab={(id) => setTab("goals", id)}
              >
                {tabOf("goals", "goals") === "goals" ? (
                  <ReserveScreen
                    plan={plan}
                    onAdd={() => setDialog({ kind: "goal", goal: null })}
                    onEdit={(goal) => setDialog({ kind: "goal", goal })}
                    onDeposit={(goal) => setDialog({ kind: "deposit", goal })}
                  />
                ) : (
                  <RetirementScreen plan={plan} />
                )}
              </SectionPage>
            ) : null}

            {route === "patrimony" ? (
              <SectionPage
                eyebrow={t("nav.patrimony")}
                tabs={[
                  { id: "wealth", label: t("tab.wealth") },
                  { id: "health", label: t("nav.health") },
                ]}
                active={tabOf("patrimony", "wealth")}
                onTab={(id) => setTab("patrimony", id)}
              >
                {tabOf("patrimony", "wealth") === "wealth" ? (
                  <PatrimonyScreen
                    plan={plan}
                    series={series}
                    month={month ?? currentMonth()}
                    holdings={holdings}
                    onSaveHolding={(input) => void saveHolding(input)}
                    onDeleteHolding={(id) => void deleteHolding(id)}
                  />
                ) : (
                  <HealthScreen
                    plan={plan}
                    byCategory={byCategory}
                    totals={totals}
                    month={month ?? currentMonth()}
                    status={budgetStatus}
                    history={recurrence}
                  />
                )}
              </SectionPage>
            ) : null}

            {route === "house" ? (
              <SectionPage eyebrow={t("nav.house")} tabs={[]} active="" onTab={() => {}}>
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
                      void refreshData();
                    });
                  }}
                  onSettle={() => {
                    if (!month) return;
                    setSplitSettled(true);
                    void api.setSetting(`split_settled_${month}`, "1");
                  }}
                />
              </SectionPage>
            ) : null}

            {route === "import" ? (
              <ImportScreen
                onImported={() => {
                  void refreshData();
                  setRoute("overview");
                }}
              />
            ) : null}

            {route === "categories" ? (
              <CategoriesScreen
                categories={categories}
                rules={rules}
                onSave={(input) => void saveCategory(input)}
                onDelete={(id) => void deleteCategory(id)}
                onArchive={(id, archived) => void archiveCategory(id, archived)}
                onSaveRule={(input) => void saveRule(input)}
                onDeleteRule={(id) => void deleteRule(id)}
                onApplyRules={() => applyRules()}
              />
            ) : null}

            {route === "settings" ? (
              <SettingsScreen
                updater={updater}
                accounts={accounts}
                onSaveUserName={setUserName}
                onCreateAccount={(name) => void createManualAccount(name)}
                onRenameAccount={(id, name) => void renameManualAccount(id, name)}
                onArchiveAccount={(id) => void archiveAccount(id)}
              />
            ) : null}
          </div>
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

      {dialog?.kind === "transfer" ? (
        <TransferDialog
          accounts={accounts}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveTransfer(input)}
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
