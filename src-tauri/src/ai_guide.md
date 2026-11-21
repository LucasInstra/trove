# Trove: guia para assistentes de IA

Este arquivo é gravado pelo Trove a cada abertura, na mesma pasta do banco `trove.db`.
Ele explica como ler e corrigir os dados com segurança. Versão do esquema: {schema}.

## Antes de mexer

1. **Feche o Trove.** O app relê o banco a cada ação, mas a tela aberta não sabe que algo mudou.
2. **Faça uma cópia** de `trove.db` (por exemplo `trove-antes-da-ia.db`). Se sobrar um `trove.db-wal`,
   copie junto ou abra e feche o banco uma vez antes, para o WAL ser gravado no arquivo principal.
3. Use SQLite (`sqlite3 trove.db`, ou Python com `sqlite3`). Faça tudo numa transação:
   `begin;` … confira com `select` … `commit;` (ou `rollback;` se algo saiu errado).
4. Prefira o próprio app quando der: importar OFX/CSV, "Pagar fatura", "Transferência".

## Regras que o app espera

- **Dinheiro em centavos inteiros.** `amount_cents` negativo = saída/compra; positivo = entrada/crédito.
  R$ 1.887,00 de gasto = `-188700`.
- **Datas** em texto `AAAA-MM-DD` (`posted_on`). Carimbos (`created_at`, `updated_at`, `deleted_at`) em ISO 8601 UTC,
  por exemplo `strftime('%Y-%m-%dT%H:%M:%SZ','now')`.
- **Nunca use `delete`.** Apagar é marcar: `deleted_at` e `updated_at` com o agora, e
  `dedupe_key = dedupe_key || ':del:' || uid` (libera a chave para uma reimportação).
- **Toda linha nova precisa de `uid`** único (`lower(hex(randomblob(16)))`) e de `updated_at`.
- **`dedupe_key` é único** em `transactions`. Lançamento manual: `'manual:' || lower(hex(randomblob(16)))`.
- **Transferência = duas pernas** com o mesmo `transfer_group`: uma negativa na conta de origem e uma positiva
  na de destino. Transferências não contam como receita nem gasto. Não deixe uma perna sozinha.
- **Estorno** é uma linha com `refund_of` apontando o original e o valor oposto.
- Filtre sempre `deleted_at is null` (em `transactions` e em `accounts`).

## Tabelas principais

| Tabela | Para quê |
|---|---|
| `accounts` | Contas (`kind`: `checking`, `credit_card`, …). |
| `transactions` | Todo lançamento: `account_id`, `posted_on`, `amount_cents`, `description`, `merchant`, `category_id`, `notes`, `transfer_group`, `refund_of`. |
| `categories` | Categorias (`parent_id` para subcategoria, `kind`: `expense`/`income`/`transfer`). |
| `cards` | Cartão ligado a uma conta: `closing_day`, `due_day`, `cash_basis` (1 = compras contam no mês do vencimento da fatura). |
| `bills` / `bill_payments` | Contas fixas do planejamento e os meses marcados como pagos. |
| `incomes` | Receitas planejadas (salário etc.). |
| `tags` / `transaction_tags` | Etiquetas; a etiqueta `Pendente` marca um gasto ainda não pago. |
| `settings` | Preferências. `invoices_paid` guarda as faturas pagas em JSON, por `"idDoCartão:AAAA-MM"` (mês do vencimento). |

## Como o mês de um gasto é contado

Por padrão, pela data da compra (`posted_on`). Num cartão com `cash_basis = 1`, a compra conta no mês do
vencimento da fatura: a fatura fecha no `closing_day` (se o mês for mais curto, no último dia) e vence no
`due_day` do mesmo mês, ou do mês seguinte quando `due_day <= closing_day`. Exemplo: fecha 24, vence 1,
compra em 05/11 → conta em dezembro.

## Receitas prontas

Descobrir as contas e as categorias:

```sql
select id, name, kind from accounts where deleted_at is null;
select id, name, kind, parent_id from categories where deleted_at is null and archived_at is null order by name;
```

Ver os gastos de um mês, do maior para o menor:

```sql
select t.id, t.posted_on, a.name as conta, t.description, t.amount_cents / 100.0 as reais, c.name as categoria
from transactions t
join accounts a on a.id = t.account_id
left join categories c on c.id = t.category_id
where t.posted_on like '2026-11-%' and t.amount_cents < 0
  and t.transfer_group is null and t.deleted_at is null and a.deleted_at is null
order by t.amount_cents;
```

Trocar a categoria de todos os lançamentos com um texto na descrição:

```sql
update transactions
set category_id = (select id from categories where name = 'Mercado' and deleted_at is null),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
where description like '%CARREFOUR%' and deleted_at is null and transfer_group is null;
```

Lançar um gasto manual:

```sql
insert into transactions
  (account_id, posted_on, amount_cents, description, merchant, memo, trntype, category_id, notes,
   origin, dedupe_key, source, created_at, uid, updated_at)
select a.id, '2026-11-05', -30000, 'Farmácia', '', '', 'DEBIT',
       (select id from categories where name = 'Health' and deleted_at is null), '',
       'manual', 'manual:' || lower(hex(randomblob(16))), 'manual',
       strftime('%Y-%m-%dT%H:%M:%SZ','now'), lower(hex(randomblob(16))), strftime('%Y-%m-%dT%H:%M:%SZ','now')
from accounts a where a.name = 'Nubank' and a.deleted_at is null;
```

Apagar um lançamento (troque 123 pelo id):

```sql
update transactions
set deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
    dedupe_key = dedupe_key || ':del:' || uid
where id = 123 and deleted_at is null and transfer_group is null;
```

Transformar um pagamento de fatura lançado como gasto em transferência (conta corrente → cartão), para ele
não contar duas vezes. Troque 123 pelo id do lançamento e `'Nubank'` pelo nome da conta do cartão:

```sql
update transactions
set transfer_group = 'transfer:' || lower(hex(randomblob(16))), category_id = null,
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
where id = 123 and amount_cents < 0 and transfer_group is null and refund_of is null and deleted_at is null;

insert into transactions
  (account_id, posted_on, amount_cents, description, merchant, memo, trntype, notes, origin,
   transfer_group, dedupe_key, source, created_at, uid, updated_at)
select k.id, p.posted_on, -p.amount_cents, p.description, '', '', 'CREDIT', '', 'manual',
       p.transfer_group, p.transfer_group || ':in', 'manual',
       strftime('%Y-%m-%dT%H:%M:%SZ','now'), lower(hex(randomblob(16))), strftime('%Y-%m-%dT%H:%M:%SZ','now')
from transactions p
join accounts k on k.name = 'Nubank' and k.deleted_at is null
where p.id = 123 and p.transfer_group is not null and p.deleted_at is null;
```

Fazer um cartão contar as compras no mês do vencimento da fatura:

```sql
update cards set cash_basis = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
where account_id = (select id from accounts where name = 'Nubank' and deleted_at is null)
  and deleted_at is null;
```

## Depois de mexer

Abra o Trove e confira o mês na tela. Se algo ficou errado, feche o app e volte a cópia que você fez.
