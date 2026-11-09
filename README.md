<div align="center">

# cofre

**Um app de finanças pessoais que roda no seu computador, sem conta e sem servidor.**

[![CI](https://github.com/LucasInstra/cofre/actions/workflows/ci.yml/badge.svg)](https://github.com/LucasInstra/cofre/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/LucasInstra/cofre?color=4c9f70)](https://github.com/LucasInstra/cofre/releases)
[![license](https://img.shields.io/badge/license-MIT-4c9f70)](LICENSE)

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Windows](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows&logoColor=white)](#requirements)

</div>

## Por que outro app de finanças

Porque os apps existentes querem a sua senha do banco, uma conta na nuvem e uma assinatura. O cofre vai pelo caminho contrário: você importa o arquivo OFX que o banco **já entrega**, e os dados ficam num arquivo SQLite no seu computador.

A regra é simples: todo número na tela responde "de onde veio". Cada lançamento guarda o arquivo e a linha que o geraram.

## O que tem hoje (0.1.0)

- **Importação de OFX**, arrastando o arquivo ou escolhendo no computador. Lê o dialeto SGML do OFX 1.x e o XML do OFX 2.x, e aceita vários arquivos de uma vez.
- **Conta reconhecida do arquivo**: banco, agência, número e a diferença entre conta corrente e cartão de crédito.
- **Deduplicação de verdade**: `FITID` quando o banco mantém o identificador estável, impressão digital da transação quando não mantém. Reimportar o mesmo período não duplica nada.
- **Extrato com busca** por descrição, estabelecimento ou categoria, com a categoria editável direto na linha.
- **Estabelecimento limpo**: `IFD*IFOOD SAO PAULO` vira `IFOOD SAO PAULO`.
- **Entradas, saídas e resultado do mês**, calculados do banco local.
- **Atualização automática assinada**, com verificação ao abrir e botão manual nas configurações.

## O que ainda não tem

CSV e PDF, painel por categoria, projeção de fim de mês, radar de assinatura, recibos e etiqueta fiscal, notas de corretagem. A ordem está no [roadmap](#roadmap).

## Instalar

Baixe o `cofre_x.y.z_x64-setup.exe` na página de [releases](https://github.com/LucasInstra/cofre/releases). Também existe `cofre-portable-x64.zip`, que é o executável sozinho.

O build não tem assinatura de código, então o Windows SmartScreen pode avisar na primeira execução.

## Rodar do código

Pré-requisitos: Node 20+, Rust stable (toolchain MSVC) e Visual Studio Build Tools com a carga de trabalho C++.

```powershell
npm install
npm run tauri dev
```

Para testar sem extrato do banco, arraste [`fixtures/exemplo.ofx`](fixtures/exemplo.ofx) na tela Importar. Importe o mesmo arquivo duas vezes: a segunda deve dizer que os oito lançamentos já existiam.

## Verificações

```powershell
npm run test:unit                          # front, incluindo comparação de versão e build
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml   # parser OFX, deduplicação e banco
npm run version:check                      # as quatro cópias da versão em sincronia
```

## Release

1. `npm version patch` (ou `minor`), que sincroniza `package.json`, `Cargo.toml`, `Cargo.lock` e `tauri.conf.json`, e reseta o build para 1.
2. Escreva `release-notes/<versão>.md`.
3. `git tag v<versão>` e `git push --follow-tags`.

Build de correção sem mudar a versão: suba `BUILD_NUMBER` em `src/lib/build.ts` e publique a tag de novo. O manifesto anuncia `0.1.0 build 2` e o app compara semver mais o build, então quem já está em `0.1.0 build 1` recebe a correção.

O updater é assinado com minisign. A chave pública fica em `src-tauri/tauri.conf.json`; a privada vai no secret `TAURI_SIGNING_PRIVATE_KEY` do repositório.

## Roadmap

- [x] OFX, deduplicação, extrato e categorias
- [ ] CSV com mapeamento de coluna por banco
- [ ] Painel por categoria, comparação com a média e projeção de fim de mês
- [ ] Radar de assinatura e alerta de aumento de preço
- [ ] Recibos com OCR, etiqueta fiscal e dossiê para o contador
- [ ] Notas de corretagem, posição e curva de patrimônio

## Privacidade

Nenhum dado financeiro sai do computador. Não existe login, telemetria ou requisição para servidor nosso; a única chamada de rede é a verificação de atualização no GitHub. O banco fica em `%APPDATA%\com.lucas.cofre\cofre.db`, e a pasta aparece nas configurações do app.

## Estrutura

```
src/                      front em React + TypeScript
  lib/updater.ts          verificação, download e instalação
  lib/release.ts          comparação de semver e build
src-tauri/src/            núcleo em Rust
  ofx.rs                  parser dos dois dialetos de OFX
  db.rs                   schema, importação e consultas
scripts/                  sincronização de versão e manifesto do updater
fixtures/                 extrato de exemplo
```

## Licença

MIT. Veja [LICENSE](LICENSE).
