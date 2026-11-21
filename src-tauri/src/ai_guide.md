# Trove: guia para assistentes de IA

Este arquivo fica na mesma pasta do banco `trove.db` e é regravado na abertura do Trove quando o texto muda.
Ele descreve como os dados são guardados. Versão do Trove: {version}. Versão do esquema: {schema}.

## O arquivo

- O banco é um arquivo SQLite em modo WAL (`trove.db`, com `trove.db-wal` e `trove.db-shm` ao lado enquanto está em uso).
- O app abre uma conexão nova a cada ação, então lê o que está no arquivo naquele momento.
- O app tem backup e restauração do banco em Ajustes.

## Convenções

- **Dinheiro em centavos inteiros.** `amount_cents` negativo = saída ou compra; positivo = entrada ou crédito.
  R$ 1.887,00 de gasto = `-188700`.
- **Datas** em texto `AAAA-MM-DD` (`posted_on`).
- **Carimbos** (`created_at`, `updated_at`, `deleted_at`) em RFC 3339 UTC, como `2026-11-21T01:50:38.123456789+00:00`.
  Em SQLite, `strftime('%Y-%m-%dT%H:%M:%f+00:00','now')` gera um valor no mesmo formato (com milissegundos).
- **Exclusão lógica.** O app não remove linhas: um item excluído recebe `deleted_at` e `updated_at`, e em
  `transactions` a chave vira `dedupe_key || ':del:' || uid`, o que libera a chave para uma reimportação.
  As telas só consideram linhas com `deleted_at is null` (em `transactions` e em `accounts`).
- **`uid`** único (`lower(hex(randomblob(16)))`) e `updated_at` existem nas tabelas de dados principais.
- **`dedupe_key`** é único em `transactions`. Formatos usados pelo app: importação = chave do extrato;
  lançamento manual = `'manual:' || hex`; estorno = `'refund:' || hex`; transferência = `<grupo>:out` e `<grupo>:in`.
- **`origin`** diz de onde a linha veio (`'manual'` ou o tipo de importação). A interface só edita e exclui linhas com `origin = 'manual'`.
- **Transferência = duas pernas** com o mesmo `transfer_group` (`'transfer:' || hex`): uma negativa (`trntype = 'DEBIT'`)
  na conta de origem e uma positiva (`'CREDIT'`) na de destino. Transferências não contam como receita nem gasto,
  e o app cria e exclui as duas pernas na mesma operação.
- **Estorno** é uma linha com `refund_of` apontando o original e o valor oposto; ela abate o gasto em vez de virar receita.
- **`merchant`** de um lançamento manual é derivado da descrição.

## Tabelas principais

| Tabela | Conteúdo |
|---|---|
| `accounts` | Contas (`kind`: `checking`, `credit_card`, …). |
| `transactions` | Lançamentos: `account_id`, `posted_on`, `amount_cents`, `description`, `merchant`, `category_id`, `notes`, `origin`, `transfer_group`, `refund_of`. |
| `categories` | Categorias (`parent_id` para subcategoria, `kind`: `expense`/`income`/`transfer`). As que vêm com o app têm nome em inglês no banco (`Groceries`, `Food`, `Transport`, `Health`, …) e são traduzidas na tela. |
| `cards` | Cartão ligado a uma conta: `closing_day`, `due_day`, `cash_basis` (1 = compras contam no mês do vencimento da fatura). |
| `bills` / `bill_payments` | Contas fixas do planejamento e os meses marcados como pagos. |
| `incomes` | Receitas planejadas (salário etc.). |
| `tags` / `transaction_tags` | Etiquetas. A etiqueta `Pendente` (ou `Pending`, conforme o idioma) marca um gasto ainda não pago. |
| `settings` | Preferências. `invoices_paid` guarda as faturas pagas em JSON, por `"idDoCartão:AAAA-MM"` (mês do vencimento), com `amountCents`, `paidOn` e `transferGroup`. Na planilha, o valor pago sai do saldo do mês de `paidOn`. |

## Em que mês um gasto conta

Pela data da compra (`posted_on`), exceto em cartão com `cash_basis = 1`: ali a compra conta na data de vencimento
da fatura a que pertence. A fatura fecha no `closing_day` (no último dia, se o mês for mais curto); uma compra depois
do fechamento vai para a fatura seguinte. A fatura vence no `due_day` do mesmo mês do fechamento, ou do mês seguinte
quando `due_day <= closing_day`. Exemplo: fecha 24, vence 1 → compra em 05/11 conta em 01/12; compra em 26/11 conta em 01/01.
Transferências (o pagamento da fatura) ficam na própria data. Essa conta é feita pelo app em tempo de consulta;
o banco guarda só `posted_on`.

## Ver na tela o que mudou no arquivo

Com o Trove aberto, a tela mantém em memória o que já carregou. O que foi gravado direto no `trove.db` aparece depois
de recarregar a janela com **Ctrl+Shift+R** (recarga completa, que lê tudo do banco de novo); trocar de tela ou de mês
também atualiza aquela tela. Fechar e abrir o app tem o mesmo efeito.

## Mudanças de comportamento e dados antigos

Algumas versões mudam a forma como o app conta ou registra os dados. Dados gravados antes de uma mudança (pelo
usuário, por importação ou por outra IA) continuam no formato antigo e podem passar a aparecer errados, por exemplo
contados em dobro. Por isso, ao trabalhar com este banco, vale comparar a versão no topo deste guia com a última que
você viu, ler as mudanças desde então e revisar os dados do usuário que ainda estejam no jeito antigo, ajustando-os
ao jeito novo de cada item abaixo. Como são os dados do usuário, convém mostrar a ele o que será convertido antes de gravar.

Cada item diz o que mudou, como reconhecer o dado antigo e como fica no jeito novo. Os itens mais novos vêm primeiro.

### 0.10.1: fatura paga sai do saldo do mês do pagamento

- **Mudou:** na planilha, o valor de uma fatura paga sai do saldo e de "Despesas pagas" do mês de `paidOn`, não do mês da fatura.
- **Dado antigo:** nenhum a converter. Só confira que `paidOn` em `settings.invoices_paid` é a data real do pagamento.

### 0.10.0: fatura de cartão pelas compras, pagamento como transferência

- **Mudou:** as compras do cartão são os gastos. A fatura não é um lançamento: o app soma as compras dela. Na aba
  **Planilhas**, as compras de cada cartão aparecem agrupadas numa linha **"Fatura <cartão>"** no mês em que contam
  (com `cards.cash_basis = 1`, o mês do vencimento), que abre a lista de compras. Pagar a fatura não é gasto: é uma
  transferência da conta corrente para o cartão (duas pernas com o mesmo `transfer_group`) mais um registro em
  `settings.invoices_paid`, que marca a fatura como paga.
- **Dado antigo:** um gasto na conta corrente com descrição como "Pagamento fatura", "Fatura Nubank" ou "Pgto cartão"
  (`transfer_group is null`, `amount_cents < 0`), enquanto as compras do mesmo cartão também estão lançadas. O mesmo
  dinheiro conta duas vezes. Quem controla o orçamento pelo mês em que paga costuma querer `cash_basis = 1` no cartão.
- **Jeito novo:** os exemplos "Pagamento de fatura lançado como gasto, convertido em transferência", "Fatura marcada
  como paga" e "Cartão contado pelo mês do vencimento", abaixo.

## Exemplos de SQL

Exemplos de como o app consulta e grava estes dados. Nomes (`'Nubank'`, `'Groceries'`) e o id `123` são ilustrativos.

Contas e categorias existentes:

```sql
select id, name, kind from accounts where deleted_at is null;
select id, name, kind, parent_id from categories where deleted_at is null and archived_at is null order by name;
```

Gastos de novembro pela data da compra (em cartão com `cash_basis = 1` o app conta pelo vencimento, como descrito acima):

```sql
select t.id, t.posted_on, a.name as conta, t.description, t.amount_cents / 100.0 as reais, c.name as categoria, t.notes
from transactions t
join accounts a on a.id = t.account_id
left join categories c on c.id = t.category_id
where t.posted_on like '2026-11-%' and t.amount_cents < 0
  and t.transfer_group is null and t.deleted_at is null and a.deleted_at is null
order by t.amount_cents;
```

Troca de categoria pelo texto da descrição:

```sql
update transactions
set category_id = (select id from categories where name = 'Groceries' and deleted_at is null),
    updated_at = strftime('%Y-%m-%dT%H:%M:%f+00:00','now')
where description like '%CARREFOUR%' and deleted_at is null and transfer_group is null;
```

Gasto manual, como o app grava:

```sql
insert into transactions
  (account_id, posted_on, amount_cents, description, merchant, memo, trntype, category_id, notes,
   origin, dedupe_key, source, created_at, uid, updated_at)
select a.id, '2026-11-05', -30000, 'Farmácia', 'Farmácia', '', 'DEBIT',
       (select id from categories where name = 'Health' and deleted_at is null), '',
       'manual', 'manual:' || lower(hex(randomblob(16))), 'manual',
       strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), lower(hex(randomblob(16))), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')
from accounts a where a.name = 'Nubank' and a.deleted_at is null
order by a.id limit 1;
```

Exclusão lógica de um lançamento manual sem estorno, como a interface faz:

```sql
update transactions
set deleted_at = strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%f+00:00','now'),
    dedupe_key = dedupe_key || ':del:' || uid
where id = 123 and origin = 'manual' and deleted_at is null and transfer_group is null
  and not exists (select 1 from transactions r where r.refund_of = 123 and r.deleted_at is null);
```

Pagamento de fatura lançado como gasto, convertido em transferência (conta corrente → cartão): as duas pernas no
mesmo formato que `save_transfer` grava, e a linha original, lançada antes como gasto, com exclusão lógica.

```sql
create temp table pagamento as
select p.id, p.account_id, p.posted_on, -p.amount_cents as cents, p.description,
       'transfer:' || lower(hex(randomblob(16))) as grupo,
       (select id from accounts where name = 'Nubank' and deleted_at is null order by id limit 1) as cartao
from transactions p
where p.id = 123 and p.origin = 'manual' and p.amount_cents < 0
  and p.transfer_group is null and p.refund_of is null and p.deleted_at is null;

insert into transactions
  (account_id, posted_on, amount_cents, description, merchant, memo, trntype, notes, origin,
   transfer_group, dedupe_key, source, created_at, uid, updated_at)
select account_id, posted_on, -cents, description, description, '', 'DEBIT', '', 'manual',
       grupo, grupo || ':out', 'manual', strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), lower(hex(randomblob(16))), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')
from pagamento where cartao is not null
union all
select cartao, posted_on, cents, description, description, '', 'CREDIT', '', 'manual',
       grupo, grupo || ':in', 'manual', strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), lower(hex(randomblob(16))), strftime('%Y-%m-%dT%H:%M:%f+00:00','now')
from pagamento where cartao is not null;

update transactions
set deleted_at = strftime('%Y-%m-%dT%H:%M:%f+00:00','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%f+00:00','now'),
    dedupe_key = dedupe_key || ':del:' || uid
where id in (select id from pagamento where cartao is not null);

drop table pagamento;
```

Fatura marcada como paga, como o diálogo "Pagar fatura" grava. A chave é `"idDoCartão:AAAA-MM"` com o mês do
vencimento; `paidOn` é a data do pagamento (o valor sai do saldo desse mês na planilha); `transferGroup` é o
`transfer_group` das duas pernas, quando houver:

```sql
insert into settings (key, value) values ('invoices_paid', '{}') on conflict(key) do nothing;

update settings
set value = json_set(value, '$."1:2026-12"',
      json_object('amountCents', 72500, 'paidOn', '2026-12-01', 'transferGroup', 'transfer:0123456789abcdef'))
where key = 'invoices_paid';
```

Cartão contado pelo mês do vencimento (efeito equivalente à opção no cartão, na tela Cartões):

```sql
update cards set cash_basis = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%f+00:00','now')
where account_id = (select id from accounts where name = 'Nubank' and deleted_at is null order by id limit 1)
  and deleted_at is null;
```
