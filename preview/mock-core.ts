// Browser preview only: stands in for the Tauri backend with a fixed demo
// household so every screen can be rendered and screenshotted without Rust.
// Wired in by vite.preview.config.ts; the real app never imports this.

const MONTH = "2026-12";

const pad = (value: number) => String(value).padStart(2, "0");
const shift = (month: string, delta: number) => {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
};

const accounts = [
  { id: 1, name: "Itaú Conta", kind: "checking", bankId: "341", acctId: "12345-6", currency: "BRL" },
  { id: 2, name: "Nubank", kind: "credit_card", bankId: "260", acctId: "9876", currency: "BRL" },
  { id: 3, name: "Carteira", kind: "manual", bankId: "", acctId: "wallet", currency: "BRL" },
  { id: 4, name: "Itaú Cartão", kind: "credit_card", bankId: "341", acctId: "4410", currency: "BRL" },
];

const categories = [
  { id: 1, name: "Moradia", kind: "expense", color: "#6366f1", parentId: null, emoji: "🏠", sortOrder: 1, archivedAt: null },
  { id: 2, name: "Mercado", kind: "expense", color: "#16a34a", parentId: null, emoji: "🛒", sortOrder: 2, archivedAt: null },
  { id: 3, name: "Transporte", kind: "expense", color: "#f59e0b", parentId: null, emoji: "🚗", sortOrder: 3, archivedAt: null },
  { id: 4, name: "Restaurantes", kind: "expense", color: "#ef4444", parentId: null, emoji: "🍽️", sortOrder: 4, archivedAt: null },
  { id: 5, name: "Lazer", kind: "expense", color: "#ec4899", parentId: null, emoji: "🎬", sortOrder: 5, archivedAt: null },
  { id: 6, name: "Saúde", kind: "expense", color: "#14b8a6", parentId: null, emoji: "💊", sortOrder: 6, archivedAt: null },
  { id: 7, name: "Assinaturas", kind: "expense", color: "#8b5cf6", parentId: null, emoji: "📺", sortOrder: 7, archivedAt: null },
  { id: 8, name: "Salário", kind: "income", color: "#22c55e", parentId: null, emoji: "💼", sortOrder: 8, archivedAt: null },
];
const cat = (id: number) => categories.find((entry) => entry.id === id)!;

const tags = [
  { id: 1, name: "viagem" },
  { id: 2, name: "reembolsável" },
];

// Deterministic pseudo-random so screenshots are stable.
let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};

type Row = {
  id: number;
  accountId: number;
  accountName: string;
  postedOn: string;
  amountCents: number;
  description: string;
  merchant: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  trntype: string;
  manual: boolean;
  notes: string;
  origin: string;
  transferGroup: string | null;
  refundOf: number | null;
  hasRefund: boolean;
  tags: { id: number; name: string }[];
};

const templates: Array<[string, number, number, number]> = [
  // description, category, account, typical cents
  ["PAO DE ACUCAR", 2, 2, 28000],
  ["IFOOD *RESTAURANTE", 4, 2, 6500],
  ["UBER *TRIP", 3, 2, 2400],
  ["POSTO SHELL", 3, 1, 22000],
  ["NETFLIX.COM", 7, 2, 5590],
  ["SPOTIFY", 7, 2, 2190],
  ["DROGASIL", 6, 2, 8900],
  ["CINEMARK", 5, 2, 7200],
  ["HORTIFRUTI CENTRAL", 2, 1, 9500],
  ["PADARIA BELA VISTA", 4, 3, 1800],
];

const rows: Row[] = [];
let nextId = 1;
const push = (month: string, day: number, description: string, categoryId: number | null, accountId: number, amount: number, extra: Partial<Row> = {}) => {
  const category = categoryId ? cat(categoryId) : null;
  const account = accounts.find((entry) => entry.id === accountId)!;
  rows.push({
    id: nextId++,
    accountId,
    accountName: account.name,
    postedOn: `${month}-${pad(day)}`,
    amountCents: amount,
    description,
    merchant: description.split(" ")[0],
    categoryId,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
    trntype: amount < 0 ? "DEBIT" : "CREDIT",
    manual: accountId === 3,
    notes: "",
    origin: accountId === 3 ? "manual" : accountId === 2 ? "csv" : "ofx",
    transferGroup: null,
    refundOf: null,
    hasRefund: false,
    tags: [],
    ...extra,
  });
};

for (let back = 11; back >= 0; back -= 1) {
  const month = shift(MONTH, -back);
  const lastDay = 28;
  push(month, 5, "SALARIO EMPRESA LTDA", 8, 1, 1250000);
  push(month, 10, "ALUGUEL APTO", 1, 1, -320000);
  push(month, 12, "CONDOMINIO", 1, 1, -68000);
  for (let index = 0; index < 22; index += 1) {
    const [description, categoryId, accountId, cents] = templates[Math.floor(rand() * templates.length)];
    const day = 1 + Math.floor(rand() * lastDay);
    const amount = -Math.round(cents * (0.6 + rand() * 0.8));
    push(month, day, description, rand() < 0.08 ? null : categoryId, accountId, amount, {
      tags: rand() < 0.1 ? [tags[0]] : [],
    });
  }
}
for (let back = 11; back >= 0; back -= 1) {
  const month = shift(MONTH, -back);
  push(month, 6, "AMAZON MARKETPLACE", 5, 4, -89990);
  push(month, 11, "SMART FIT", 4, 4, -12990);
}
// December: 13th salary, year-end shopping and the card invoices to come.
push(MONTH, 20, "13O SALARIO EMPRESA LTDA", 8, 1, 625000);
push(MONTH, 18, "AMAZON PRESENTES NATAL", 5, 4, -64900);
push(MONTH, 19, "MAGAZINE LUIZA", 5, 2, -129900);
push(MONTH, 22, "CEIA DE NATAL MERCADO", 2, 1, -48700);
push(MONTH, 23, "VIAGEM AEREA LATAM", 5, 4, -184200);
push(MONTH, 14, "SEGURO AUTO PORTO", 3, 1, -38000);
push(MONTH, 16, "PLANO DE SAUDE", 6, 1, -62000);
push(MONTH, 17, "ACADEMIA SMART FIT", 4, 4, -12990);
rows.sort((left, right) => (left.postedOn === right.postedOn ? right.id - left.id : left.postedOn < right.postedOn ? 1 : -1));

const inMonth = (month: string) => rows.filter((row) => row.postedOn.startsWith(month) && !row.transferGroup);

const totalsOf = (month: string) => {
  const list = inMonth(month);
  return {
    month,
    incomeCents: list.filter((row) => row.amountCents > 0).reduce((sum, row) => sum + row.amountCents, 0),
    expenseCents: list.filter((row) => row.amountCents < 0).reduce((sum, row) => sum - row.amountCents, 0),
    transactionCount: list.length,
  };
};

const categoryTotals = (month: string) => {
  const map = new Map<number | null, number>();
  for (const row of inMonth(month)) {
    if (row.amountCents >= 0) continue;
    map.set(row.categoryId, (map.get(row.categoryId) ?? 0) - row.amountCents);
  }
  return [...map]
    .map(([categoryId, totalCents]) => ({
      categoryId,
      name: categoryId ? cat(categoryId).name : "Uncategorized",
      color: categoryId ? cat(categoryId).color : "#9aa3af",
      totalCents,
      budgetCents: categoryId === 2 ? 90000 : categoryId === 4 ? 40000 : null,
    }))
    .sort((left, right) => right.totalCents - left.totalCents);
};

const planner = {
  incomes: [{ id: 1, name: "Salário", amountCents: 1250000, frequency: "monthly", payDay: 5, accountId: 1, active: true }],
  bills: [
    { id: 1, name: "Aluguel", amountCents: 320000, dueDay: 10, frequency: "monthly", categoryId: 1, categoryName: "Moradia", categoryColor: "#6366f1", accountId: 1, goalId: null, startsOn: "2025-01-01", endsOn: null, installmentsTotal: null, active: true },
    { id: 2, name: "Condomínio", amountCents: 68000, dueDay: 12, frequency: "monthly", categoryId: 1, categoryName: "Moradia", categoryColor: "#6366f1", accountId: 1, goalId: null, startsOn: "2025-01-01", endsOn: null, installmentsTotal: null, active: true },
    { id: 3, name: "Internet", amountCents: 12000, dueDay: 15, frequency: "monthly", categoryId: 1, categoryName: "Moradia", categoryColor: "#6366f1", accountId: 1, goalId: null, startsOn: "2025-01-01", endsOn: null, installmentsTotal: null, active: true },
    { id: 4, name: "Energia", amountCents: 21000, dueDay: 20, frequency: "monthly", categoryId: 1, categoryName: "Moradia", categoryColor: "#6366f1", accountId: 1, goalId: null, startsOn: "2025-01-01", endsOn: null, installmentsTotal: null, active: true },
    { id: 5, name: "Notebook (10x)", amountCents: 45000, dueDay: 8, frequency: "monthly", categoryId: 5, categoryName: "Lazer", categoryColor: "#ec4899", accountId: 2, goalId: null, startsOn: "2026-06-01", endsOn: "2027-03-01", installmentsTotal: 10, active: true },
    { id: 6, name: "Seguro auto", amountCents: 38000, dueDay: 14, frequency: "monthly", categoryId: 3, categoryName: "Transporte", categoryColor: "#f59e0b", accountId: 1, goalId: null, startsOn: "2026-01-01", endsOn: null, installmentsTotal: null, active: true },
    { id: 7, name: "Plano de saúde", amountCents: 62000, dueDay: 16, frequency: "monthly", categoryId: 6, categoryName: "Saúde", categoryColor: "#14b8a6", accountId: 1, goalId: null, startsOn: "2026-01-01", endsOn: null, installmentsTotal: null, active: true },
    { id: 8, name: "Academia", amountCents: 12990, dueDay: 17, frequency: "monthly", categoryId: 4, categoryName: "Restaurantes", categoryColor: "#ef4444", accountId: 4, goalId: null, startsOn: "2026-01-01", endsOn: null, installmentsTotal: null, active: true },
  ],
  payments: [] as { id: number; billId: number; month: string; paidOn: string; amountCents: number }[],
  cards: [
    { id: 1, accountId: 2, accountName: "Nubank", brand: "mastercard", last4: "9876", limitCents: 800000, closingDay: 3, dueDay: 10, color: "#8a05be", texture: "waves" },
    { id: 2, accountId: 4, accountName: "Itaú Cartão", brand: "visa", last4: "4410", limitCents: 1200000, closingDay: 20, dueDay: 27, color: "#ec7000", texture: "glow" },
  ],
  goals: [
    { id: 1, name: "Reserva de emergência", kind: "reserve", targetCents: 4500000, monthlyCents: 150000, startsOn: "2025-06-01", accountId: 1, color: "#16a34a" },
    { id: 2, name: "Viagem Japão", kind: "goal", targetCents: 1800000, monthlyCents: 100000, startsOn: "2026-01-01", accountId: 1, color: "#0ea5e9" },
  ],
  goalTotals: [
    { goalId: 1, paidCents: 2400000, payments: 16 },
    { goalId: 2, paidCents: 900000, payments: 9 },
  ],
  reads: [],
  people: [
    { id: 1, name: "Lucas", color: "#2563eb", isSelf: true, weightPct: 60 },
    { id: 2, name: "Ana", color: "#ec4899", isSelf: false, weightPct: 40 },
  ],
  shares: [{ billId: 1, personId: 2 }],
  debts: [{ id: 1, personId: 2, personName: "Ana", label: "Jantar", amountCents: 8500, month: MONTH, settledOn: null }],
};

// Every bill is paid for the months already closed; December keeps the later ones open.
{
  const dueDays: Record<number, number> = {};
  const amounts: Record<number, number> = {};
  for (const bill of planner.bills) {
    dueDays[bill.id] = bill.dueDay;
    amounts[bill.id] = bill.amountCents;
  }
  let paymentId = 1;
  for (let back = 11; back >= 0; back -= 1) {
    const month = shift(MONTH, -back);
    for (const bill of planner.bills) {
      if (month < bill.startsOn.slice(0, 7)) continue;
      if (bill.endsOn && month > bill.endsOn.slice(0, 7)) continue;
      if (back === 0 && dueDays[bill.id] > 13) continue;
      planner.payments.push({ id: paymentId++, billId: bill.id, month, paidOn: `${month}-${pad(dueDays[bill.id])}`, amountCents: amounts[bill.id] });
    }
  }
}

const settings: Record<string, string | null> = {
  user_name: "Lucas",
  housing_category: "1",
};

const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
  list_accounts: () => accounts,
  list_categories: () => categories,
  list_tags: () => tags,
  list_holdings: () => [
    { id: 1, name: "Tesouro Selic", kind: "investment", amountCents: 3200000, updatedOn: `${MONTH}-01` },
    { id: 2, name: "Carro", kind: "property", amountCents: 6500000, updatedOn: `${MONTH}-01` },
  ],
  list_transactions: (args) => {
    const search = (args.search as string | null)?.toLowerCase();
    const month = args.month as string | null;
    return rows
      .filter((row) => !month || row.postedOn.startsWith(month))
      .filter((row) => !args.accountId || row.accountId === args.accountId)
      .filter((row) => !search || row.description.toLowerCase().includes(search))
      .filter((row) => !args.tagId || row.tags.some((tag) => tag.id === args.tagId))
      .slice(0, (args.limit as number) ?? 500);
  },
  month_totals: (args) => totalsOf(args.month as string),
  category_totals: (args) => categoryTotals(args.month as string),
  month_series: (args) =>
    Array.from({ length: args.count as number }, (_, offset) => {
      const totals = totalsOf(shift(args.month as string, offset - (args.count as number) + 1));
      return { month: totals.month, incomeCents: totals.incomeCents, expenseCents: totals.expenseCents };
    }),
  category_month_series: (args) =>
    Array.from({ length: args.count as number }, (_, offset) => shift(args.endMonth as string, offset - (args.count as number) + 1)).flatMap(
      (month) => categoryTotals(month).map(({ categoryId, name, color, totalCents }) => ({ month, categoryId, name, color, totalCents })),
    ),
  latest_month: () => MONTH,
  planner_state: (args) => ({ ...planner, payments: planner.payments.filter((payment) => payment.month === ((args.month as string) ?? MONTH)) }),
  budget_status: (args) => {
    const totals = categoryTotals(args.month as string);
    const line = (categoryId: number, limit: number) => {
      const spent = totals.find((entry) => entry.categoryId === categoryId)?.totalCents ?? 0;
      return { categoryId, name: cat(categoryId).name, color: cat(categoryId).color, limitCents: limit, overridden: false, carryover: false, carryInCents: 0, effectiveCents: limit, spentCents: spent };
    };
    return {
      month: args.month,
      global: { categoryId: null, name: "Total", color: "#64748b", limitCents: 900000, overridden: false, carryover: false, carryInCents: 0, effectiveCents: 900000, spentCents: totalsOf(args.month as string).expenseCents },
      lines: [line(2, 90000), line(4, 40000), line(3, 50000)],
    };
  },
  recurrence_rows: () =>
    rows
      .filter((row) => ["NETFLIX.COM", "SPOTIFY", "ALUGUEL APTO", "CONDOMINIO"].includes(row.description))
      .map(({ postedOn, merchant, description, amountCents }) => ({ postedOn, merchant, description, amountCents })),
  daily_expense: (args) =>
    Array.from({ length: 30 }, (_, index) => {
      const day = `${args.month}-${pad(index + 1)}`;
      const list = rows.filter((row) => row.postedOn === day);
      return {
        day,
        incomeCents: list.filter((row) => row.amountCents > 0).reduce((sum, row) => sum + row.amountCents, 0),
        expenseCents: list.filter((row) => row.amountCents < 0).reduce((sum, row) => sum - row.amountCents, 0),
      };
    }),
  list_rules: () => [
    { id: 1, pattern: "IFOOD", target: "both", categoryId: 4, categoryName: "Restaurantes", categoryColor: "#ef4444", sign: "out", minAmountCents: null, maxAmountCents: null, priority: 1 },
  ],
  list_imports: () => [
    { id: 1, path: "C:\\Users\\demo\\Downloads\\extrato-itau-nov2026.ofx", accountName: "Itaú Conta", importedAt: `${MONTH}-13T10:00:00Z`, inserted: 42, duplicates: 3 },
    { id: 2, path: "C:\\Users\\demo\\Downloads\\fatura-nubank-nov2026.csv", accountName: "Nubank", importedAt: `${MONTH}-12T09:00:00Z`, inserted: 31, duplicates: 0 },
  ],
  list_csv_profiles: () => [],
  demo_loaded: () => true,
  load_demo_data: () => null,
  card_usage: () => 412300,
  delete_card: (args) => {
    planner.cards = planner.cards.filter((card) => card.id !== (args.id as number));
    return null;
  },
  reorder_cards: (args) => {
    const ids = args.ids as number[];
    planner.cards.sort((left, right) => ids.indexOf(left.id) - ids.indexOf(right.id));
    return null;
  },
  get_setting: (args) => settings[args.key as string] ?? null,
  set_setting: (args) => {
    settings[args.key as string] = args.value as string;
    return null;
  },
  database_location: () => "C:\\Users\\demo\\AppData\\Roaming\\com.lucas.trove\\trove.db",
};

export async function invoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const handler = handlers[command];
  if (handler) return structuredClone(handler(args)) as T;
  if (command.startsWith("list_")) return [] as T;
  return null as T;
}

export const isTauri = () => false;

// `?theme=dark` picks the theme before the app reads it.
try {
  const theme = new URLSearchParams(window.location.search).get("theme");
  if (theme) window.localStorage.setItem("trove.theme", theme);
} catch {
  // storage blocked: the app falls back to light
}

// `?layout=cards:3,bills:2:mini` seeds the dashboard layout (id:span[:mode]) for screenshots.
try {
  const spec = new URLSearchParams(window.location.search).get("layout");
  if (spec) {
    settings.dashboard_layout = JSON.stringify(
      spec.split(",").map((part) => {
        const [id, span, mode] = part.split(":");
        return { id, span: Number(span) || 1, mode: mode || "full" };
      }),
    );
  }
} catch {
  // ignore a malformed spec
}
