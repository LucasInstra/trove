# Mapa atual do app

Este arquivo descreve a arquitetura implementada. O histórico por versão fica em `release-notes/`.

## Stack e arquitetura

- Aplicativo desktop Windows com Tauri 2, React 19, TypeScript e Rust.
- `src/App.tsx` coordena navegação, estado compartilhado e chamadas ao backend. As telas ficam em `src/screens/`; componentes reutilizáveis em `src/components/`.
- `src/domain/` contém cálculos puros de orçamento, projeção, recorrência, relatórios, patrimônio e gráficos, com testes Vitest próximos aos módulos.
- `src/lib/api.ts` tipa a ponte Tauri. Os comandos e registro de plugins ficam em `src-tauri/src/lib.rs`.
- `src-tauri/src/db.rs` implementa SQLite, consultas, gravações e migrações. `ofx.rs` e `csv.rs` leem extratos; `planner.rs` trata os dados de planejamento.

## Dados e invariantes

- O banco local é `trove.db` no diretório de dados do app (`%APPDATA%\com.lucas.trove`). Dinheiro é armazenado em centavos inteiros; valores derivados são calculados, não persistidos.
- A versão atual do schema está em `SCHEMA_VERSION` (`src-tauri/src/db.rs`). `BASELINE_V1` é congelada; mudanças de schema devem ser feitas por migrações aditivas e idempotentes.
- Importações OFX/CSV guardam a origem e deduplicam por `FITID` quando disponível, ou por fingerprint de conta, data, valor e descrição normalizada. A mesma transação pode ser reconhecida entre os dois formatos.
- Transferências são pares indivisíveis e não entram nos totais de receitas/despesas. Estornos compensam a transação original; edições e exclusões respeitam esses vínculos.
- Backup usa `VACUUM INTO`. A restauração verifica integridade e compatibilidade do banco antes de substituir o arquivo ativo, depois reabre o banco pela cadeia de migrações.
- Os dados financeiros ficam locais. O acesso à rede é usado para consultar e baixar atualizações do GitHub.

## Fluxos principais

- **Importar extrato:** `ImportScreen.tsx` e `CsvImport.tsx` preparam OFX/CSV; o backend valida, importa e registra o histórico em `db.rs`.
- **Consultar e organizar lançamentos:** `TransactionsScreen.tsx`, `TransactionsPanel.tsx` e `db.rs` fornecem busca, filtros, categorias, tags, edição manual e edição em massa.
- **Planejar:** `PlannerScreens.tsx` combina estado persistido com cálculos de `src/domain/`; entradas persistidas passam por `planner.rs` e `db.rs`.
- **Proteger e mover dados:** exportação CSV e backup/restauração são expostos em Settings pela ponte de `src/lib/api.ts`.

## Verificações e release

Os comandos mantidos pelo projeto estão em `docs/development.md`: testes Vitest, lint e build do frontend, testes Rust e verificação de sincronização das versões. A CI executa esses mesmos checks em `.github/workflows/ci.yml`; releases são publicadas por `.github/workflows/release.yml`.
