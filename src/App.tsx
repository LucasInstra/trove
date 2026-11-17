import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
import { AccountsManager } from "./components/AccountsManager";
import { MultiAccountsBanner } from "./components/MultiAccountsBanner";
import { computeKpis } from "./domain/kpis";
import { accountRows, parseOpening, salaryAccountId, serializeOpening } from "./domain/accounts";
import { SalaryAccount } from "./components/SalaryAccount";
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
  PageHeader,
  ReserveScreen,
  RetirementScreen,
} from "./screens/PlannerScreens";
import { CategoriesScreen } from "./screens/CategoriesScreen";
import { InvestmentsScreen } from "./screens/InvestmentsScreen";
import { api, EMPTY_PLANNER } from "./lib/api";
import { CryptoPrompt } from "./components/CryptoCard";
import { LEDGER_EVENT, usePaidInvoices } from "./lib/paidInvoices";
import { CRYPTO_EVENT, CRYPTO_SETTING } from "./domain/crypto";
import type {
  Account,
  AccountBalance,
  AccountResult,
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
  PersonInput,
  TransactionRow,
  TransferInput,
} from "./lib/api";
import { PENDING_TAGS } from "./components/BudgetSheet";
import { useLanguage } from "./lib/language";
import { localizeError } from "./lib/backendErrors";
import { useUpdater } from "./lib/updater";
import { WhatsNew } from "./components/WhatsNew";
import { invoiceDifference, invoiceWindow } from "./domain/invoice";
import { incomesInMonth } from "./domain/planner";
import { planMonth } from "./domain/projection";
import { buildNotifications } from "./domain/notifications";
import { applyTheme, loadTheme, saveTheme, type Theme } from "./lib/theme";
import { currentMonth, isDisplayCurrency, setDisplayCurrency, todayIso, type DisplayCurrency } from "./lib/format";
import {
  moveCardTo,
  moveCardNear,
  parseLayout,
  setSpan,
  setHeight,
  serializeLayout,
  setMode,
  resetCard,
  type CardId,
  type CardMode,
  type LayoutCard,
  type Span,
} from "./domain/layout";
import { BUILD_LABEL } from "./lib/build";
import { SectionPage } from "./components/SectionPage";
import { SheetsScreen } from "./screens/SheetsScreen";
import { Onboarding, ONBOARDING_EVENT } from "./components/Onboarding";
import { ScreenTip } from "./components/ScreenTip";
import { rampOf } from "./lib/color";
import { initialsOf } from "./lib/avatar";
import { usePrivacy } from "./lib/privacy";

type Route =
  | "overview"
  | "transactions"
  | "flow"
  | "cards"
  | "goals"
  | "house"
  | "patrimony"
  | "sheets"
  | "categories"
  | "import"
  | "settings";

const ROUTES: readonly Route[] = [
  "overview",
  "transactions",
  "flow",
  "cards",
  "goals",
  "house",
  "patrimony",
  "sheets",
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
  { route: "goals", icon: "target" },
  { route: "house", icon: "home" },
  { route: "patrimony", icon: "bank" },
];

const ADJUST: Array<{ route: Route; icon: IconName }> = [
  { route: "sheets", icon: "layout" },
  { route: "categories", icon: "tag" },
  { route: "import", icon: "import" },
  { route: "settings", icon: "settings" },
];

type DialogState =
  | { kind: "income"; income: Income | null; personId?: number | null }
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
  | { kind: "accounts" }
  | { kind: "multiOn" }
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
  const invoices = usePaidInvoices();
  const [housingCategoryId, setHousingCategoryId] = useState<number | null>(null);
  const [ceilingPct, setCeilingPct] = useState(30);
  const [housingScope, setHousingScope] = useState<"primary" | "total">("primary");
  const [splitSettled, setSplitSettled] = useState(false);
  const [trackSettlement, setTrackSettlement] = useState(true);
  const [layout, setLayout] = useState<LayoutCard[]>(() => parseLayout(null));
  const layoutLoaded = useRef(false);
  // The sheet charts always cover the whole month, whatever filter the Transactions screen has.
  const [sheetRows, setSheetRows] = useState<TransactionRow[]>([]);
  useEffect(() => {
    if (route !== "sheets" || !month) return;
    let live = true;
    void api
      .transactions("", month, null, 5000, null)
      .then((next) => live && setSheetRows(next))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [route, month, rows]);
  // The order of the budget rows, chosen by dragging; rows not listed here go last.
  const [budgetOrder, setBudgetOrder] = useState<{ bills: number[]; incomes: number[] }>({ bills: [], incomes: [] });
  useEffect(() => {
    void api
      .getSetting("budget_order")
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as { bills?: unknown; incomes?: unknown };
        const ids = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is number => typeof id === "number") : []);
        setBudgetOrder({ bills: ids(parsed.bills), incomes: ids(parsed.incomes) });
      })
      .catch(() => undefined);
  }, []);
  // "Partner's expenses": the budget says whose each income and expense is.
  const [partnerMode, setPartnerMode] = useState(false);
  useEffect(() => {
    void api
      .getSetting("budget_partner")
      .then((raw) => setPartnerMode(raw === "1"))
      .catch(() => undefined);
  }, []);
  const changePartnerMode = (on: boolean) => {
    setPartnerMode(on);
    void api.setSetting("budget_partner", on ? "1" : "0");
  };
  const saveBudgetOrder = (kind: "bills" | "incomes", ids: number[]) => {
    const next = { ...budgetOrder, [kind]: ids };
    setBudgetOrder(next);
    void api.setSetting("budget_order", JSON.stringify(next));
  };
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number | null>(null);
  // The day picked in the top bar. Until the user picks one, new entries start on today.
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  // The account the salary counts on, `salary_account` in the settings.
  const [salaryChoice, setSalaryChoice] = useState<number | null>(null);
  const [currency, setCurrencyState] = useState<DisplayCurrency>("BRL");
  // The formatters read this while the screens render, so it is set before they do.
  setDisplayCurrency(currency);
  const [multiSetting, setMultiSetting] = useState<string | null>(null);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [monthResults, setMonthResults] = useState<AccountResult[]>([]);
  const [opening, setOpening] = useState<Record<number, number>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // First-run state lives with the data: a fresh database always starts with the onboarding,
  // and Settings can open it again. null while the setting is still being read.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [redoOnboarding, setRedoOnboarding] = useState(false);
  useEffect(() => {
    void api
      .getSetting("salary_account")
      .then((value) => setSalaryChoice(value && Number.isInteger(Number(value)) ? Number(value) : null))
      .catch(() => {});
    void api
      .getSetting("display_currency")
      .then((value) => {
        if (isDisplayCurrency(value)) setCurrencyState(value);
      })
      .catch(() => {});
  }, []);
  const changeSalaryAccount = (id: number) => {
    setSalaryChoice(id);
    void api.setSetting("salary_account", String(id)).catch(() => {});
  };
  const changeCurrency = (next: DisplayCurrency) => {
    setCurrencyState(next);
    void api.setSetting("display_currency", next).catch(() => {});
  };
  useEffect(() => {
    let cancelled = false;
    void api
      .getSetting("onboarded")
      .then((value) => {
        if (!cancelled) setOnboarded(value === "1");
      })
      .catch(() => {
        if (!cancelled) setOnboarded(true);
      });
    const again = () => {
      setRedoOnboarding(true);
      setRoute("overview");
    };
    window.addEventListener(ONBOARDING_EVENT, again);
    return () => {
      cancelled = true;
      window.removeEventListener(ONBOARDING_EVENT, again);
    };
  }, []);
  const showOnboarding = onboarded !== null && (redoOnboarding || (!onboarded && accounts.length === 0));
  // Crypto prices are opt-in: null means the user was never asked (first use, or an update from a version without it).
  const [cryptoChoice, setCryptoChoice] = useState<string | null | undefined>(undefined);
  const refreshDataRef = useRef<() => Promise<void>>(async () => {});
  // A payment entry was created or removed outside the ledger screens.
  useEffect(() => {
    const reload = () => void refreshDataRef.current();
    window.addEventListener(LEDGER_EVENT, reload);
    return () => window.removeEventListener(LEDGER_EVENT, reload);
  }, []);
  useEffect(() => {
    const read = () => {
      api
        .getSetting(CRYPTO_SETTING)
        .then(setCryptoChoice)
        .catch(() => setCryptoChoice("off"));
    };
    read();
    window.addEventListener(CRYPTO_EVENT, read);
    return () => window.removeEventListener(CRYPTO_EVENT, read);
  }, []);
  useEffect(() => {
    if (cryptoChoice !== "on") return;
    const update = () => {
      api
        .refreshCryptoPrices()
        .then((count) => {
          if (count > 0) void refreshDataRef.current();
        })
        .catch(() => {});
    };
    update();
    const timer = window.setInterval(update, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [cryptoChoice]);

  const finishOnboarding = () => {
    setOnboarded(true);
    setRedoOnboarding(false);
    void api.setSetting("onboarded", "1").catch(() => {});
  };
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  // Re-render the whole app when the eye toggles: every formatter reads the flag.
  usePrivacy();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const updater = useUpdater();
  const [settingsTab, setSettingsTab] = useState<"updates" | "account" | undefined>(undefined);
  useEffect(() => {
    if (route !== "settings") setSettingsTab(undefined);
  }, [route]);
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
    void api
      .getSetting("user_avatar")
      .then((stored) => {
        if (!cancelled) setUserAvatar(stored && stored.startsWith("data:image/") ? stored : null);
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
          track,
          storedLayout,
          nextRecent,
          nextBalances,
          storedOpening,
          storedMulti,
          nextResults,
        ] = await Promise.all([

          api.transactions(term, at, accountId, 500, tagId),
          api.accounts(),
          api.categories(),
          api.monthTotals(at, accountId),
          api.categoryTotals(at, accountId),
          api.monthSeries(at, 12, accountId),
          api.categoryMonthSeries(at, 12, accountId),
          api.plannerState(at),
          api.budgetStatus(at).catch(() => null),
          api.recurrenceRows(at, 12).catch(() => []),
          api.dailyExpense(at, accountId).catch(() => []),
          api.listRules().catch(() => []),
          api.tags().catch(() => []),
          api.holdings().catch(() => []),
          api.getSetting("housing_category").catch(() => null),
          api.getSetting("housing_ceiling").catch(() => null),
          api.getSetting("housing_scope").catch(() => null),
          api.getSetting(`split_settled_${at}`).catch(() => null),
          api.getSetting("split_track").catch(() => null),
          api.getSetting("dashboard_layout").catch(() => null),
          api.transactions("", at, null, 10, null).catch(() => []),
          api.accountBalances().catch(() => []),
          api.getSetting("account_opening").catch(() => null),
          api.getSetting("multi_accounts").catch(() => null),
          api.accountMonthResults(at).catch(() => []),
        ]);
        setMonthResults(nextResults);
        setMultiSetting(storedMulti);
        setBalances(nextBalances);
        setOpening(parseOpening(storedOpening));
        const ramp = rampOf(nextCategories.map((category) => category.color));
        const tone = (row: TransactionRow): TransactionRow =>
          row.categoryColor ? { ...row, categoryColor: ramp(row.categoryColor) } : row;
        setRows(nextRows.map(tone));
        setRecentRows(nextRecent.map(tone));
        setAccounts(nextAccounts);
        setCategories(nextCategories.map((category) => ({ ...category, color: ramp(category.color) })));
        setTotals(nextTotals);
        setByCategory(nextByCategory.map((entry) => ({ ...entry, color: ramp(entry.color) })));
        setSeries(nextSeries);
        setMatrix(nextMatrix.map((entry) => ({ ...entry, color: ramp(entry.color) })));
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
        setTrackSettlement(track !== "0");
        if (!layoutLoaded.current) {
          layoutLoaded.current = true;
          setLayout(parseLayout(storedLayout));
        }
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

  useEffect(() => {
    refreshDataRef.current = () => refreshData();
  }, [refreshData]);

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
    // `balances` is new after every change to the ledger, so an edited purchase refreshes the usage.
  }, [planner.cards, month, balances]);

  // The chart and the summary count the salary as income, like the plan does: the
  // recurring income of each month, and the statement only where none is set.
  const incomeSeries = useMemo(
    () =>
      series.map((point) => {
        const monthly = incomesInMonth(planner.incomes, point.month)
          .filter((income) => income.active && income.frequency === "monthly")
          .reduce((total, income) => total + income.amountCents, 0);
        return monthly > 0 ? { ...point, incomeCents: monthly } : point;
      }),
    [series, planner.incomes],
  );

  const monthIncomes = useMemo(() => incomesInMonth(planner.incomes, month ?? currentMonth()), [planner.incomes, month]);
  const monthlySalaryCents = useMemo(
    () =>
      monthIncomes
        .filter((income) => income.active && income.frequency === "monthly")
        .reduce((total, income) => total + income.amountCents, 0),
    [monthIncomes],
  );

  const plan = useMemo(
    () =>
      planMonth({
        month: month ?? currentMonth(),
        incomes: monthIncomes,
        bills: planner.bills,
        payments: planner.payments,
        goals: planner.goals,
        goalTotals: planner.goalTotals,
        totals,
        housingCategoryId,
        ceilingPct,
        debts: planner.debts,
      }),
    [month, planner, monthIncomes, totals, housingCategoryId, ceilingPct],
  );

  const cards = useMemo(
    () =>
      planner.cards.map((meta) => ({
        meta,
        // A paid invoice owes nothing, unless it grew after it was paid.
        paid: invoices.isPaid(meta.id, month ?? currentMonth()),
        usageCents: invoices.isPaid(meta.id, month ?? currentMonth())
          ? invoiceDifference(usage[meta.id] ?? 0, invoices.paidInvoice(meta.id, month ?? currentMonth()) ?? { amountCents: 0, paidOn: "" }, invoiceWindow(meta.closingDay, meta.dueDay, month ?? currentMonth()))
          : (usage[meta.id] ?? 0),
        window: invoiceWindow(meta.closingDay, meta.dueDay, month ?? currentMonth()),
      })),
    [planner.cards, usage, month, invoices],
  );

  // What is left of the month for the household: income with the salary, minus spending and bills to pay.
  const monthKpis = computeKpis(plan, incomeSeries, month ?? currentMonth());
  const monthLeftCents = monthKpis.income.valueCents - monthKpis.expense.valueCents;

  const daysInMonth = new Date(Number((month ?? currentMonth()).slice(0, 4)), Number((month ?? currentMonth()).slice(5, 7)), 0).getDate();
  const shownDay = Math.min(pickedDay ?? new Date().getDate(), daysInMonth);
  // The date a new entry starts on: the day picked in the top bar, else today.
  const entryDate =
    pickedDay === null ? undefined : `${month ?? currentMonth()}-${String(shownDay).padStart(2, "0")}`;

  const cardAccountSet = useMemo(() => new Set(planner.cards.map((meta) => meta.accountId)), [planner.cards]);
  const salaryChoices = accounts.filter((account) => !cardAccountSet.has(account.id));
  const salaryAccountIdNow = salaryAccountId(accounts, cardAccountSet, salaryChoice);

  const accountRowsList = useMemo(
    () =>
      accountRows(
        accounts,
        balances,
        opening,
        new Set(planner.cards.map((meta) => meta.accountId)),
        monthResults,
        {
          accountId: salaryAccountId(
            accounts,
            new Set(planner.cards.map((meta) => meta.accountId)),
            salaryChoice,
          ),
          cents: monthlySalaryCents,
        },
      ),
    [accounts, balances, opening, planner.cards, monthResults, monthlySalaryCents, salaryChoice],
  );

  // Several accounts is the user's choice. Without a choice yet, it is on for anyone who already
  // keeps more than one account besides cards, so nothing disappears from under them.
  const multiAccounts =
    multiSetting === "on" || (multiSetting === null && accountRowsList.filter((row) => !row.isCard).length > 1);

  const setMultiAccounts = (on: boolean, explain = false) => {
    setMultiSetting(on ? "on" : "off");
    if (on && explain) setDialog({ kind: "multiOn" });
    if (!on) setAccountFilter(null);
    void api.setSetting("multi_accounts", on ? "on" : "off").catch(() => {});
  };

  const saveOpening = async (accountId: number, cents: number) => {
    const next = { ...opening, [accountId]: cents };
    setOpening(next);
    await api.setSetting("account_opening", serializeOpening(next));
  };

  const notifications = useMemo(
    () =>
      buildNotifications({
        plan,
        cards,
        today: todayIso(),
        reads: planner.reads,
        hasIncome: monthIncomes.some((income) => income.active),
      }),
    [plan, cards, planner.reads, monthIncomes],
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
    layoutLoaded.current = true;
    setLayout(next);
    void api.setSetting("dashboard_layout", serializeLayout(next));
  };

  const onCategory = (transactionId: number, categoryId: number | null) =>
    mutateAndRefresh(() => api.setCategory(transactionId, categoryId));

  const clearMonth = async () => {
    if (!month) return;
    await mutateAndRefresh(() => api.clearMonth(month));
  };

  const withMonth = (input: IncomeInput): IncomeInput => (input.id ? { ...input, fromMonth: month ?? currentMonth() } : input);

  const saveIncome = (input: IncomeInput) =>
    mutateAndRefresh(() => api.saveIncome(withMonth(input)), { closeDialog: true });

  const removeIncome = (id: number) =>
    mutateAndRefresh(() => api.deleteIncome(id), { closeDialog: true });

  const removeGoal = (id: number) =>
    mutateAndRefresh(() => api.deleteGoal(id), { closeDialog: true });

  const saveBill = (input: BillInput, payerId: number | null) =>
    mutateAndRefresh(
      async () => {
        const id = await api.saveBill(input);
        if (payerId !== null) await api.setShare({ billId: id, personId: payerId });
      },
      { closeDialog: true },
    );

  const addPerson = (name: string) => mutateAndRefresh(() => api.addPerson(name));

  const removePerson = (id: number) => mutateAndRefresh(() => api.deletePerson(id));

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

  // With no account yet, the first entry creates a main one, so launching never dead-ends.
  const saveManual = (input: ManualInput) =>
    mutateAndRefresh(
      async () => {
        const accountId =
          input.accountId > 0 ? input.accountId : await api.createManualAccount(t("accounts.main"));
        return api.saveManual({ ...input, accountId });
      },
      { closeDialog: true },
    );

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

  const saveHolding = (input: HoldingInput) =>
    mutateAndRefresh(async () => {
      const id = await api.saveHolding(input);
      if (input.symbol) await api.refreshCryptoPrices().catch(() => 0);
      return id;
    });

  const savePeople = (inputs: PersonInput[]) =>
    mutateAndRefresh(async () => {
      for (const input of inputs) await api.savePerson(input);
    });

  const deleteHolding = (id: number) => mutateAndRefresh(() => api.deleteHolding(id));

  const bulkSetCategory = (ids: number[], categoryId: number | null) =>
    mutateAndRefresh(() => api.bulkSetCategory(ids, categoryId));

  const toggleEntryPending = (id: number, pending: boolean) =>
    mutateAndRefresh(async () => {
      const tagId = tags.find((tag) => PENDING_TAGS.includes(tag.name))?.id ?? (await api.saveTag(t("budget.pendingTag")));
      await api.bulkTag([id], tagId, pending);
    });

  const bulkTag = (ids: number[], tagId: number, assign: boolean) =>
    mutateAndRefresh(() => api.bulkTag(ids, tagId, assign));

  const createManualAccount = (name: string) =>
    mutateAndRefresh(() => api.createManualAccount(name));

  const renameManualAccount = (id: number, name: string) =>
    mutateAndRefresh(() => api.renameAccount(id, name));

  const loadDemo = async () => {
    await mutateAndRefresh(() => api.loadDemoData());
    setMonth("2026-12");
  };

  const eraseAll = () => mutateAndRefresh(() => api.eraseAllData());

  const removeDemo = () => mutateAndRefresh(() => api.removeDemoData());

  const archiveAccount = (id: number) => {
    if (accountFilter === id) setAccountFilter(null);
    return mutateAndRefresh(() => api.archiveAccount(id));
  };

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

  // `delta` moves a card one place up (-1) or down (+1) in the user's order.
  const moveCard = (id: number, delta: -1 | 1) => {
    const ids = planner.cards.map((meta) => meta.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void mutateAndRefresh(() => api.reorderCards(ids));
  };

  const removeCard = async (id: number) => {
    setDialog(null);
    await api.deleteCard(id);
    await refreshData();
  };

  const saveCard = (input: CardInput) =>
    mutateAndRefresh(
      async () => {
        // Account 0 is "a new account for this card": every card has its own.
        const accountId =
          input.accountId > 0
            ? input.accountId
            : await api.createManualAccount(
                [input.brand || t("planner.card"), input.last4 ? `•••• ${input.last4}` : ""]
                  .filter(Boolean)
                  .join(" "),
              );
        return api.saveCard({ ...input, accountId });
      },
      { closeDialog: true },
    );

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
        data-nav={item.route}
        onClick={() => setRoute(item.route)}
        className={sidebarCollapsed ? "justify-center px-0" : undefined}
        title={sidebarCollapsed ? label : undefined}
        aria-label={sidebarCollapsed ? label : undefined}
      >
        <Icon name={item.icon} size={18} />
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
            initials={initialsOf(profileName)}
            avatar={userAvatar}
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
              <UpdateBanner
                updater={updater}
                onOpen={() => {
                  setSettingsTab("updates");
                  setRoute("settings");
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                className="flex items-center rounded-full border border-line bg-surface-soft p-0.5"
                onClick={() => {
                  const next: Theme = theme === "dark" ? "light" : "dark";
                  saveTheme(next);
                  const swap = () => {
                    flushSync(() => setTheme(next));
                    applyTheme(next);
                  };
                  // The whole window cross-fades between the themes where the webview supports it.
                  if (
                    typeof document.startViewTransition === "function" &&
                    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ) {
                    document.startViewTransition(swap);
                  } else {
                    swap();
                  }
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
              {localizeError(error, t, lang)}
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
              day={shownDay}
              todayDay={month === currentMonth() ? new Date().getDate() : null}
              onPickDay={setPickedDay}
              accounts={multiAccounts ? accounts : []}
              accountFilter={accountFilter}
              onAccountFilter={setAccountFilter}
              primaryLabel={t("ledger.import")}
              showLayout={route === "overview"}
              layoutEditing={layoutEditing}
              onToggleLayout={() => setLayoutEditing((value) => !value)}
            />
          ) : null}

          {onboarded !== null && !showOnboarding ? <WhatsNew version={updater.currentVersion} /> : null}
          {onboarded !== null && !showOnboarding ? <ScreenTip route={route} /> : null}
          {onboarded !== null && !showOnboarding && multiSetting === null && !multiAccounts &&
          (route === "overview" || route === "transactions") ? (
            <MultiAccountsBanner onUse={() => setMultiAccounts(true, true)} onLater={() => setMultiAccounts(false)} />
          ) : null}

          <div className="route-view" key={`${route}-${currency}`}>
            {route === "overview" && !loading && showOnboarding ? (
              <Onboarding
                busy={false}
                onSaveName={(value) => {
                  setUserName(value);
                  void api.setSetting("user_name", value).catch(() => {});
                }}
                onMultiAccounts={(on) => setMultiAccounts(on)}
                onSaveIncome={(amountCents, payDay) =>
                  mutateAndRefresh(() => {
                    // Redoing the onboarding edits the salary instead of adding a second one.
                    const existing = planner.incomes.find((income) => income.active && income.frequency === "monthly");
                    return api.saveIncome(
                      withMonth({
                        id: existing?.id ?? null,
                        name: existing?.name ?? t("onboard.salaryName"),
                        amountCents,
                        frequency: "monthly",
                        payDay,
                        accountId: existing?.accountId ?? null,
                        personId: existing?.personId ?? null,
                        active: true,
                      }),
                    );
                  })
                }
                onImport={() => {
                  finishOnboarding();
                  setRoute("import");
                }}
                onDemo={() => {
                  finishOnboarding();
                  void loadDemo();
                }}
                onDismiss={finishOnboarding}
              />
            ) : null}

            {route === "overview" && (loading || onboarded === null || !showOnboarding) ? (
              <OverviewScreen
                plan={plan}
                accountRows={accountRowsList}
                monthLeftCents={monthLeftCents}
                multiAccounts={multiAccounts}
                accountFilter={accountFilter}
                onAccountFilter={setAccountFilter}
                onManageAccounts={() => setDialog({ kind: "accounts" })}
                cards={cards}
                byCategory={byCategory}
                series={incomeSeries}
                matrix={matrix}
                rows={recentRows}
                month={month ?? currentMonth()}
                onSelectMonth={setMonth}
                onOpenLedger={() => setRoute("transactions")}
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
                trackSettlement={trackSettlement}
                onAddDebt={() => setDialog({ kind: "debt", debt: null })}
                onEditDebt={(debt) => setDialog({ kind: "debt", debt })}
                onToggleDebt={(id, settled) => void toggleDebt(id, settled)}
                layout={layout}
                layoutEditing={layoutEditing}
                onLayoutMoveTo={(id: CardId, targetId: CardId, side?: "before" | "after") => {
                  saveLayout(side ? moveCardNear(layout, id, targetId, side) : moveCardTo(layout, id, targetId));
                }}
                onLayoutSet={saveLayout}
                onLayoutResize={(id: CardId, span: Span) => {
                  saveLayout(setSpan(layout, id, span));
                }}
                onLayoutHeight={(id: CardId, height: number | null) => {
                  saveLayout(setHeight(layout, id, height));
                }}
                onLayoutSpan={(id: CardId, span: number) => {
                  saveLayout(setSpan(layout, id, span));
                }}
                onLayoutResetCard={(id: CardId) => saveLayout(resetCard(layout, id))}
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
                salaryCents={accountFilter == null ? monthlySalaryCents : 0}
                categories={categories}
                tags={tags}
                search={search}
                loading={loading}
                onSearch={setSearch}
                onCategory={(id, categoryId) => void onCategory(id, categoryId)}
                onImport={() => setRoute("import")}
                onLaunch={() => setDialog({ kind: "manual", entry: null })}
                onManageAccounts={() => setDialog({ kind: "accounts" })}
                multiAccounts={multiAccounts}
                onMultiAccounts={(on) => setMultiAccounts(on, true)}
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
                    incomes={monthIncomes}
                    people={planner.people}
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
                    <PageHeader
                      eyebrow={t("nav.flow")}
                      title={t("tab.flowTrends")}
                      description={t("flow.trendsDescription")}
                    />
                    <FlowScreen
                      series={incomeSeries}
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
                    onMove={moveCard}
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

            {route === "house" ? (
              <SectionPage
                eyebrow={t("nav.house")}
                tabs={[{ id: "house", label: t("nav.house") }]}
                active="house"
                onTab={() => undefined}
              >
                <HouseScreen
                                    plan={plan}
                                    categories={categories}
                                    incomes={monthIncomes}
                                    housingCategoryId={housingCategoryId}
                                    housingScope={housingScope}
                                    people={planner.people}
                                    shares={planner.shares}
                                    splitSettled={splitSettled}
                                    trackSettlement={trackSettlement}
                                    onSavePeople={(inputs) => void savePeople(inputs)}
                                    onAddPerson={(name) => void addPerson(name)}
                                    onRemovePerson={(id) => void removePerson(id)}
                                    onAddIncome={(personId) => setDialog({ kind: "income", income: null, personId })}
                                    onEditIncome={(income) => setDialog({ kind: "income", income })}
                                    onCategory={(categoryId) => void saveHousingCategory(categoryId)}
                                    onTrackSettlement={(value) => {
                                      setTrackSettlement(value);
                                      void api.setSetting("split_track", value ? "1" : "0");
                                    }}
                                    onScope={(scope) => {
                                      setHousingScope(scope);
                                      void api.setSetting("housing_scope", scope);
                                    }}
                                    onEditCeiling={() => setDialog({ kind: "ceiling" })}
                                    onAddBill={() => setDialog({ kind: "bill", bill: null })}
                                    onEditBill={(bill) => setDialog({ kind: "bill", bill })}
                                    onSaveBill={(input) => void mutateAndRefresh(() => api.saveBill(input))}
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

            {route === "patrimony" ? (
              <SectionPage
                eyebrow={t("nav.patrimony")}
                tabs={[
                  { id: "wealth", label: t("tab.wealth") },
                  { id: "investments", label: t("tab.investments") },
                  { id: "health", label: t("nav.health") },
                ]}
                active={tabOf("patrimony", "wealth")}
                onTab={(id) => setTab("patrimony", id)}
              >
                {tabOf<string>("patrimony", "wealth") === "investments" ? (
                  <InvestmentsScreen
                    holdings={holdings}
                    onSaveHolding={(input) => void saveHolding(input)}
                    onDeleteHolding={(id) => void deleteHolding(id)}
                  />
                ) : tabOf("patrimony", "wealth") === "wealth" ? (
                  <PatrimonyScreen
                    plan={plan}
                    series={incomeSeries}
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

            {route === "sheets" ? (
              <SheetsScreen
                month={month ?? currentMonth()}
                tab={tabOf<"investments" | "spending" | "charts">("sheets", "spending")}
                onTab={(id) => setTab("sheets", id)}
                people={planner.people}
                onAddPerson={(name) => void addPerson(name)}
                holdings={holdings}
                onSaveHolding={(input) => void saveHolding(input)}
                onDeleteHolding={(id) => void deleteHolding(id)}
                rows={sheetRows}
                onEditEntry={(entry) => setDialog({ kind: "manual", entry })}
                onTogglePending={(id, pending) => void toggleEntryPending(id, pending)}
                incomes={monthIncomes}
                bills={planner.bills}
                payments={planner.payments}
                shares={planner.shares}
                partnerMode={partnerMode}
                onPartnerMode={changePartnerMode}
                onAssignBill={(billId, personId) => {
                  void api.setShare({ billId, personId }).then(() => {
                    void refreshData();
                  });
                }}
                order={budgetOrder}
                onOrder={saveBudgetOrder}
                onTogglePaid={(id, paid) => void toggleBill(id, paid)}
                onSaveIncome={(input) => void mutateAndRefresh(() => api.saveIncome(withMonth(input)))}
                onEditIncome={(income) => setDialog({ kind: "income", income })}
                onSaveBill={(input) => void mutateAndRefresh(() => api.saveBill(input))}
                onEditBill={(bill) => setDialog({ kind: "bill", bill })}
              />
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
                initialTab={settingsTab}
                salaryAccountId={salaryAccountIdNow}
                salaryChoices={salaryChoices}
                onSalaryAccount={changeSalaryAccount}
                currency={currency}
                onCurrency={changeCurrency}
                updater={updater}
                accounts={accounts}
                onSaveUserName={setUserName}
                avatar={userAvatar}
                onAvatar={(next) => {
                  setUserAvatar(next);
                  void api.setSetting("user_avatar", next ?? "");
                }}
                onLoadDemo={loadDemo}
                onRemoveDemo={removeDemo}
                onEraseAll={eraseAll}
                theme={theme}
                onTheme={(next) => {
                  setTheme(next);
                  saveTheme(next);
                }}
                onCreateAccount={(name) => void createManualAccount(name)}
                multiAccounts={multiAccounts}
                onMultiAccounts={setMultiAccounts}
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
            icon: <Icon name={item.icon} size={18} />,
            active: route === item.route,
            onSelect: () => setRoute(item.route),
          })),
          {
            key: "settings",
            label: t("nav.settings"),
            icon: <Icon name="settings" size={18} />,
            active: route === "settings",
            onSelect: () => setRoute("settings"),
          },
        ]}
      />

      {dialog?.kind === "income" ? (
        <IncomeDialog
          income={dialog.income}
          people={planner.people}
          defaultPersonId={dialog.personId ?? null}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveIncome(input)}
          onDelete={(id) => void removeIncome(id)}
        />
      ) : null}

      {cryptoChoice === null && !loading && onboarded !== null && !showOnboarding ? (
        <CryptoPrompt />
      ) : null}
      {dialog?.kind === "bill" ? (
        <BillDialog
          bill={dialog.bill}
          defaultStartsOn={month && month !== currentMonth() ? `${month}-01` : undefined}
          categories={categories}
          people={planner.people}
          payerId={dialog.bill ? (planner.shares.find((entry) => entry.billId === dialog.bill?.id)?.personId ?? null) : null}
          defaultCategoryId={route === "house" ? housingCategoryId : null}
          onClose={() => setDialog(null)}
          onSave={(input, payerId) => void saveBill(input, payerId)}
          onDelete={(id) => void removeBill(id)}
        />
      ) : null}

      {dialog?.kind === "card" ? (
        <CardDialog
          card={dialog.card}
          accounts={accounts}
          takenAccountIds={planner.cards.map((meta) => meta.accountId)}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveCard(input)}
          onDelete={(id) => void removeCard(id)}
        />
      ) : null}

      {dialog?.kind === "goal" ? (
        <GoalDialog
          goal={dialog.goal}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveGoal(input)}
          onDelete={(id) => void removeGoal(id)}
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
          month={month ?? currentMonth()}
          onClose={() => setDialog(null)}
          onSave={(input) => void saveDebt(input)}
          onDelete={(id) => void removeDebt(id)}
        />
      ) : null}

      {dialog?.kind === "manual" ? (
        <ManualDialog
          accounts={accounts}
          defaultDate={entryDate}
          askAccount={multiAccounts || dialog.entry !== null}
          defaultAccountId={accountRowsList.find((row) => !row.isCard)?.id}
          categories={categories}
          entry={dialog.entry}
          onClose={() => setDialog(null)}
          onCreate={(input) => void saveManual(input)}
          onUpdate={(input) => void updateManual(input)}
          onDelete={(id) => void deleteManual(id)}
        />
      ) : null}

      {dialog?.kind === "accounts" ? (
        <Dialog title={t("accounts.title")} onClose={() => setDialog(null)}>
          <AccountsManager
            bare
            hint={t("accounts.manageHint")}
            accounts={accounts}
            rows={accountRowsList}
            onOpening={(id, cents) => void saveOpening(id, cents)}
            onCreate={(name) => void createManualAccount(name)}
            onRename={(id, name) => void renameManualAccount(id, name)}
            onArchive={(id) => void archiveAccount(id)}
          />
          <SalaryAccount accounts={salaryChoices} value={salaryAccountIdNow} onChange={changeSalaryAccount} />
          <p className="muted small">{t("accounts.movementNote")}</p>
          <div className="dialog-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setMultiAccounts(false);
                setDialog(null);
              }}
            >
              {t("accounts.turnOff")}
            </button>
          </div>
        </Dialog>
      ) : null}

      {dialog?.kind === "multiOn" ? (
        <Dialog title={t("accounts.onTitle")} onClose={() => setDialog(null)}>
          <div className="dialog-form">
            <p>{t("accounts.onBody")}</p>
            <ul className="multi-on-list">
              <li>{t("accounts.onPoint1")}</li>
              <li>{t("accounts.onPoint2")}</li>
              <li>{t("accounts.onPoint3")}</li>
            </ul>
            <p className="muted small">{t("accounts.onTurnOff")}</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setDialog(null);
                  setSettingsTab("account");
                  setRoute("settings");
                }}
              >
                {t("accounts.onSettings")}
              </button>
              <button type="button" className="primary" onClick={() => setDialog({ kind: "accounts" })}>
                {t("accounts.onAdd")}
              </button>
            </div>
          </div>
        </Dialog>
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
          <span className="input-affix">
            <input
              type="number"
              min={5}
              max={100}
              value={ceiling}
              onChange={(event) => setCeiling(Number(event.target.value))}
            />
            <span>%</span>
          </span>
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
