# Inventário do app (Fase 0)

Levantamento em 2026-11-12, branch main em `6dc0147` (tag `v0.1.4`).
Convenção de dinheiro: centavos inteiros (`amount_cents: i64`), nada derivado é persistido.

## 1. Rotas (15)

Tipo `Route` em `src/App.tsx:66-79`. Grupos de navegação:

| Rota | Grupo | Ícone | Linha |
|---|---|---|---|
| overview | MENU | grid | App.tsx:82 |
| transactions | MENU | ledger | App.tsx:83 |
| flow | MENU | arrow-left-right | App.tsx:84 |
| cards | PLANNING | card | App.tsx:88 |
| reserve | PLANNING | target | App.tsx:89 |
| house | PLANNING | home | App.tsx:90 |
| income | PLANNING | income (`trend`) | App.tsx:91 |
| flows | STRATEGY | swap | App.tsx:95 |
| patrimony | STRATEGY | bank | App.tsx:96 |
| health | STRATEGY | scale | App.tsx:97 |
| debts | STRATEGY | file-text | App.tsx:98 |
| retirement | STRATEGY | hourglass | App.tsx:99 |
| import | ADJUST | import | App.tsx:103 |
| settings | ADJUST | settings | App.tsx:104 (+ BottomNav App.tsx:813) |

`TopBar` (App.tsx ~512) vale para todas exceto import/settings; saudação usa `greeting.*` + `user_name`.

## 2. Telas (6 arquivos)

| Arquivo | Telas exportadas |
|---|---|
| src/screens/OverviewScreen.tsx | Overview (grade de 12 cards, layout editável) |
| src/screens/TransactionsScreen.tsx | Transactions (repassa tudo a TransactionsPanel) |
| src/screens/FlowScreen.tsx | Cash flow (12 meses pares entra/sai + tabela com saldo acumulado) |
| src/screens/ImportScreen.tsx | Import (drag-drop OFX + histórico) |
| src/screens/SettingsScreen.tsx | Settings (idioma, perfil/nome, updates, dados, sobre) |
| src/screens/PlannerScreens.tsx | CardsScreen:66, ReserveScreen:173, HouseScreen:282, IncomeScreen:436, PatrimonyScreen:501, RetirementScreen:618, HealthScreen:771, FlowsScreen:846, DebtsScreen:1003 |

Diálogos em `src/components/PlannerDialogs.tsx`: IncomeDialog:31, BillDialog:72, CardDialog:158, GoalDialog:221, DepositDialog:267, BudgetDialog:298. `ManualDialog` em `src/components/ManualDialog.tsx`, `DebtDialog`+`DebtsCard` em `src/components/DebtsCard.tsx`, `KpiCards`, `ScoreCard`, `InstallmentsCard`, faturas em `InvoiceDialog`, genérico em `Dialog.tsx`. Primitivas em `src/components/ui/`: `sidebar.tsx`, `bottom-nav.tsx`, `progress.tsx`.

Gráficos hoje: `Donut.tsx` (anel SVG, **não mexer na Fase 3**), `BreakdownBar.tsx` (barra empilhada), `CompositionBar.tsx` (faixas do saldo livre), barras CSS puras em Overview/FlowScreen. Não existe `src/hooks/`, `src/styles/charts.css` nem `src/components/charts/`.

## 3. Tabelas (16, `src-tauri/src/db.rs`)

Baseline congelada `BASELINE_V1` (db.rs:18-69): `accounts` (:18, unique `(bank_id, acct_id)`), `categories` (:29, sem parent_id/emoji/sort_order/archived_at), `transactions` (:37, sem `notes` nem `origin`; `source` texto livre), `imports` (:56), `settings` (:65). Migrações aditivas e idempotentes até `SCHEMA_VERSION = 9` (db.rs:12), cadeia em db.rs:340-377, nunca editar a baseline. A v9 é também reparo: bancos carimbados à frente das colunas ganham exatamente o que faltava na próxima abertura.

| Tabela | Origem | Colunas-chave |
|---|---|---|
| goals | v2, db.rs:83 | target/monthly/starts_on/color |
| incomes | v2, db.rs:99 | amount, frequency, pay_day |
| bills | v2, db.rs:114 | amount, due_day, frequency, category/account/goal, starts/ends_on, installments_total (v4) |
| bill_payments | v2, db.rs:133 | bill_id, month, paid_on, amount (unique bill+month) |
| cards | v2, db.rs:148 | brand, last4, limit, closing/due_day |
| notification_reads | v3, db.rs:164 | key, read_at |
| people | v3, db.rs:174 | name, color, is_self, weight_pct (seed: Você + Parceiro(a)) |
| shares | v3, db.rs:186 | um pagador por conta (`on conflict (bill_id)`) |
| debts | v5, db.rs:485 | person, label, amount, month, settled_on |
| goal_deposits | v6, db.rs:460 | goal, amount, deposited_on |
| categories.budget_cents | v7, `add_column` | teto mensal opcional |

`soft_delete_transaction` (db.rs:883) existe mas é dead code (`#[allow(dead_code)]`): só o teste em db.rs:1709 o chama. Nenhum comando Tauri expõe delete de lançamento.

## 4. Comandos Tauri (`src-tauri/src/lib.rs`, handler em ~292-330)

Leitura: `planner_state` (:136), `list_accounts` (:46), `list_categories` (:52), `list_transactions` (:58), `category_totals` (:76), `category_month_series` (:82), `month_series` (:104), `month_totals` (:124), `latest_month` (:92), `list_imports` (:98), `card_usage` (:189). Escrita: `import_ofx` (:22), `save_manual_transaction` (:28), `clear_month` (:40), `set_category` (:114), `set_category_budget` (:34), `save/delete_income` (:142/:148), `save/delete_bill` (:154/:160), `set_bill_paid` (:166), `save_card` (:177), `save_goal` (:183), `set_share` (:200), `save/delete_debt` (:212/:224), `set_debt_settled` (:206), `save_deposit` (:218), `mark_notifications_read` (:230), `get/set_setting` (:236/:242).

## 5. Cálculos (`src/domain`, puro: sem React, sem SQL)

- `projection.ts`: `planMonth` (:145), `isDueIn` (:63, respeita parcelas e `ends_on`), `buildComposition` (:108, 5 faixas), `primaryOf` (:84), `groupByDay` (:90).
- `invoice.ts`: `invoiceWindow` (:19), `invoiceUsage` (:39), `invoiceLines` (:49), `isInsideWindow` (:29).
- `month.ts`: `daysInMonth`, `monthEnd`, `addMonths`, `dateInMonth`, `monthRange` (:5-27).
- `split.ts`: `computeSplit` (:44, um pagador por conta), `selfPartOf` (:37).
- `installment.ts`: `monthOffset` (:11), `installmentOf` (:22), `installmentEndMonth` (:32), `remainingInstallments` (:45).
- `kpis.ts`: `computeKpis` (:38, inclui `freed` de parcelas que terminam no mês).
- `score.ts`: `computeScore` (:36, 40/30/30 com veredito).
- `health.ts`: `healthSignals` (:33), `reserveMonths` (:20).
- `patrimony.ts`: `netWorthCurve` (:13, acumulado parte de zero — estimativa, não patrimônio absoluto).
- `retirement.ts`: `retirementProjection` (:23, juros mensais sobre taxa anual, sem inflação/imposto).
- `scope.ts`: `scopeOfBill` (:10, casa = categoria da moradia).
- `layout.ts`: `parseLayout` (:102), `moveCardTo` (:138), `setSpan` (:154), `nextMode` (:167); `packing.ts`: `rowSpanFor` (:12).
- `planner.ts`: `summarizeGoals`, `cardLimitUsage`, `activeIncomeCount` (:10-34).
- `notifications.ts`: `buildNotifications` (:29). `connector.ts`: geometria de pontos/linha tracejada para `UpcomingInvoices`.
- Rust (cálculos em SQL/Rust): `month_totals` (db.rs:1053), `category_totals` (db.rs:1085), `month_series` (db.rs:1162, preenche vazios), `category_month_series` (db.rs:1119), `goal_totals` (planner.rs:687, parcelas pagas + aportes), `clear_month` (db.rs:987, apaga manuais + marcas de pago, nunca importados), `save_manual_transaction` com `dedupe_key = 'manual:' || …` (db.rs:928), `card_usage`, `check_month`/`check_date` (db.rs:402/416).

## 6. Gaps mapeados para as fases (o que NÃO existe hoje)

- **Fase 1:** sem `notes`/`origin` em transactions; sem contas manuais (`accounts` exige `(bank_id, acct_id)` único — `acct_id = 'manual:<uid>'` ainda não existe); sem edição/exclusão de lançamento na UI; categorias sem `parent_id/emoji/sort_order/archived_at` e sem agregação pai/filhos (só `housingCategoryId` avulso); sem CSV em nenhum sentido; sem exportação; sem backup (`VACUUM INTO`) nem restauração.
- **Fase 2:** sem transferências (`transfer_group` inexistente; nada liga dois lançamentos); sem estorno (`refund_of` inexistente); sem motor de regras de categorização; sem tabela `budgets` (só `budget_cents` pontual em categories, sem `month`, sem `carryover`, sem teto global, sem ritmo); sem "quanto posso gastar"; sem radar de recorrências (só `UpcomingInvoices` por cartão).
- **Fase 3:** sem `src/domain/chart.ts`, sem `src/hooks/useChartWidth.ts`, sem `src/styles/charts.css`, sem `src/components/charts/`; sem comando Rust de acumulado diário (`daily_expense`).
- **Fase 4:** sem projeção 3/6/12 meses; sem relatório mensal; sem tags, filtros salvos ou edição em massa; patrimônio é só reservas + acumulado do extrato (sem investimentos além de aportes em meta).

## 7. Linha de base (2026-11-12, árvore limpa em v0.1.4)

- `npm run test:unit` → 17 arquivos, 121 testes, todos passando.
- `npm run lint` → sem erros nem warnings.
- `npm run build` → ok (`tsc --noEmit` + `vite build`, dist gerado).
- `cargo test` (src-tauri) → 30 testes passando, 0 falhando.
