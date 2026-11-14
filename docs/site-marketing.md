# Trove: site antes do dashboard

Objetivo deste documento: especificar o site público que apresenta o Trove e leva ao download, usando como referência estrutural o que o site do Visor faz bem, sem herdar os defeitos medidos nos dois estudos.

Público principal: brasileiro, Windows, que já baixa extrato do banco e desconfia de app que pede senha. Público secundário: quem procura alternativa a planilha e a assinatura.

---

## 1. O papel do site

O app é grátis, local e sem conta. Isso muda a função da página:

| Site do Visor | Site do Trove |
|---|---|
| Vender assinatura | Fazer baixar |
| Paywall e trial | Nenhum |
| Prova social de loja de app | Prova de código aberto e changelog |
| Mockup do produto idealizado | Captura real do app |
| Cadastro e login | Nenhum |

A página tem um trabalho só: em 30 segundos, a pessoa entende que o Trove não pede conta, não pede senha de banco e não manda dado para lugar nenhum. Depois disso, ela baixa.

---

## 2. Posicionamento

**Frase de posicionamento:** um app de finanças pessoais que roda no seu computador, lê o extrato que o seu banco já entrega e guarda tudo em um arquivo seu.

**Promessa principal:** clareza sem entregar o acesso.

**O que o Trove tem e o Visor não tem:** open source, MIT, zero servidor, zero telemetria, funciona offline, dado exportável e restaurável por você.

**O que o Visor tem e o Trove não tem:** sincronização automática com o banco, app mobile, múltiplos bancos conectados em tempo real. O site deve dizer isso com clareza na seção "para quem não é". É diferencial de honestidade, não fraqueza.

---

## 3. Estrutura da página

Coluna de conteúdo: 990px no desktop, 1200px para as bandas full-bleed. Doze seções, não mais.

1. Navegação
2. Herói
3. Faixa de três promessas
4. O problema
5. Como funciona
6. Recursos em bento
7. Onde o dado mora (banda escura)
8. Prova honesta
9. Para quem é / não é
10. FAQ
11. CTA final
12. Rodapé

---

## 4. Conteúdo, seção por seção

### 4.1 Navegação

Barra branca fixa de 64px, borda inferior de 1px. Logo à esquerda, links no centro, botão primário à direita.

```
Trove    Produto   Recursos   Segurança   FAQ   Changelog   GitHub    [ Baixar ]
```

Sem seletor de idioma na barra no mobile. No desktop, `PT / EN` discreto antes do botão.

### 4.2 Herói

Eyebrow: `WINDOWS · LOCAL-FIRST · OPEN SOURCE`

H1: **Seu dinheiro, no seu computador.**

Subheadline: O Trove lê o OFX que o seu banco já entrega e organiza tudo em um arquivo local. Sem conta, sem servidor, sem assinatura.

CTA primário: **Baixar para Windows**
CTA secundário: Ver como funciona

Micro-prova sob os botões: `Grátis e open source (MIT) · sem cadastro · atualizações pelo GitHub`

Visual: a janela real do app (Overview, tema claro), emoldurada com borda de 1px e sombra suave, inclinada em 0 grau, ocupando 900px de largura. Três ícones 3D do próprio app (porco, prancheta, moeda) flutuando fora da moldura, a 72px, sem sobrepor o conteúdo. Nada de collage de polaroids.

Por que assim: o site do Visor acerta ao colocar **um número** no herói. O Trove tem o equivalente: o saldo do mês com a origem do dado. A moldura do screenshot inclui, no canto, uma etiqueta pequena `importado de extrato.ofx` e outra `manual`. É a promessa da marca aparecendo no primeiro pixel.

### 4.3 Faixa de três promessas

Três colunas, fundo `#f7f8fa`, 56px de padding, ícones de linha 20px.

| Sem conta | Sem servidor | Sem telemetria |
|---|---|---|
| Nada de login, e-mail ou senha. | O banco é um arquivo SQLite na sua máquina. | Nenhum evento, nenhum pixel, nenhum cookie. |

### 4.4 O problema

Título: **Planilha quebra. App que pede senha do banco assusta. Assinatura cobra para você ver o seu próprio dinheiro.**

Três cards curtos:

- **A planilha.** Fórmula quebra, categoria vira bagunça, e no terceiro mês ninguém abre mais.
- **A senha.** Conectar conta em app de terceiro é entregar a chave do cofre para quem você não conhece.
- **A assinatura.** Você paga todo mês para consultar dados que já são seus.

Fecho: O Trove faz o caminho contrário: você baixa o extrato no banco e importa aqui. O dado não sai da máquina.

### 4.5 Como funciona

Banda em `--paper` (`#faf7f2`), três passos com número grande em display.

1. **Baixe o extrato.** No site ou no app do seu banco, exporte o OFX do mês. O arquivo já existe, você só não sabia.
2. **Importe com prévia.** O Trove mostra o que entra, o que já existe e o que é duplicata antes de gravar qualquer coisa.
3. **Veja o mês.** Categorias, contas, cartões e projeção no mesmo lugar. Cada número aponta para o arquivo que o gerou.

Fecho: CSV também funciona, com perfil configurável por banco.

### 4.6 Recursos em bento

Seis cards, dois deles em azul sólido, os outros em `#f7f8fa`. Título de card em 20px, corpo em 15px.

1. **Dashboard que é seu.** Arraste os cards, escolha a largura de cada um e o nível de detalhe. Card largo mostra mais conteúdo, não o mesmo conteúdo esticado.
2. **Importação que não duplica.** OFX 1.x e 2.x, CSV de banco configurável, deduplicação por FITID e por impressão digital, histórico de cada arquivo que entrou.
3. **Categorias e regras.** Árvore de categorias, orçamento por categoria e regras que classificam sem sobrescrever o que você escolheu à mão.
4. **Transferências e estornos.** Par de transferência não infla receita nem despesa. Estorno compensa a compra original.
5. **Fluxo e projeção.** Orçamento com carryover, livre para gastar, detecção de recorrência e previsão de 3, 6 e 12 meses.
6. **Patrimônio.** Contas, cartões, investimentos e dívidas lado a lado, com evolução no tempo.

Três linhas menores abaixo: backup e restauração com verificação, inglês e português, atualização automática.

### 4.7 Onde o dado mora (banda escura)

Equivalente à seção de segurança do Visor, mas com fato em vez de selo.

Título: **Seu banco de dados é um arquivo. Você sabe onde ele está.**

Conteúdo em três colunas:

- **O arquivo.** `%APPDATA%\com.lucas.trove\trove.db`. SQLite, aberto, inspecionável, sem formato proprietário.
- **A cópia.** Backup com `VACUUM INTO`, restauração com verificação de integridade antes de substituir o arquivo ativo.
- **A única conexão.** O app fala com o GitHub para checar atualização. Nada mais.

Fecho: Não existe servidor nosso para vazar, porque não existe servidor nosso.

Visual: diagrama simples, três retângulos ligados (banco, app, você), com a seta para fora marcada como "só atualização". Sem logos de banco, sem selo de LGPD. O Trove não é uma fintech regulada e não deve fingir que é.

### 4.8 Prova honesta

Sem depoimento inventado, sem número de usuários. Três provas verificáveis:

- **Capturas reais.** Três telas do app, geradas pelo próprio repositório.
- **Código aberto.** MIT, no GitHub, com CI verde.
- **Changelog público.** Cada versão com o que mudou, gerado de `release-notes/`.

Formato: faixa de screenshots em carrossel estático com scroll horizontal, sem autoplay, mais uma linha com estrelas do GitHub e link para o repositório.

### 4.9 Para quem é / não é

Duas colunas, sem meias palavras.

**É para você se:**

- usa Windows;
- quer ver o extrato sem dar senha do banco para ninguém;
- aceita importar OFX ou CSV uma vez por mês;
- gosta de saber onde o dado está.

**Não é para você se:**

- quer sincronização automática em tempo real;
- usa Mac ou Linux (ainda não suportado);
- precisa de app no celular;
- quer recomendação de investimento.

### 4.10 FAQ

Usar `<details>` nativo, sem JavaScript.

1. O Windows avisa que o app não é assinado. É seguro?
2. De quais bancos consigo importar?
3. Preciso de internet para usar?
4. Onde ficam meus dados?
5. Consigo fazer backup?
6. Tem versão para Mac ou Linux?
7. Tem versão em inglês?
8. Como contribuir?

### 4.11 CTA final

Título: **Comece com o extrato do mês passado.**

Botão: Baixar para Windows. Micro: `Grátis · MIT · sem cadastro`.

### 4.12 Rodapé

Quatro colunas: Produto, Desenvolvedor, Legal, Comunidade. Linha final com `MIT © 2026 Lucas` e o aviso de que o Trove não é serviço financeiro.

---

## 5. Sistema visual do site

O site precisa parecer o mesmo produto do app, senão o usuário cai em outra marca ao abrir o executável. É exatamente o erro do Visor, medido no estudo: site quente com cinco fontes, app frio com uma.

**Regra:** os tokens do site são os mesmos do app (`docs/redesign-direcao-visual.md`, seção 5). Nada de paleta paralela.

| Item | Site | App |
|---|---|---|
| Azul | `#1d63ed` | `#1d63ed` |
| Tinta | `#101828` | `#101828` |
| Fundo de página | `#ffffff` | `#f4f5f7` |
| Banda de papel | `#faf7f2` | `#faf7f2` |
| Banda escura | `#0b1120` | `#0b1120` |
| Display | Bricolage Grotesque (ou Satoshi) | idem |
| UI | Inter | Inter |
| Raio | 12 botão, 16 card, 24 banda | idem |

Diferenças permitidas: o site usa H1 de 56px e corpo de 17px (leitura em tela grande), enquanto o app usa 13px. O site pode ter uma banda escura inteira; o app tem tema escuro opcional.

Ilustração 3D: no site, só como acento no herói e na seção "para quem é". Nada de 3D em toda seção.

---

## 6. Componentes e layout

- Grid de 12 colunas, `max-width: 1200px`, gutter de 24px.
- Breakpoints: 640, 880, 1120. O site é desktop-first porque o produto é desktop, mas precisa funcionar em 390 sem overflow.
- Título de seção: eyebrow em 12px caixa alta `#1d63ed`, H2 em display 36px, subtítulo em 17px `#4d5766`.
- Botão primário: 48px, raio 12, `#1d63ed`, texto branco. Igual ao app.
- Captura de tela: moldura de 1px `#e6eaf1`, raio 16, sombra `0 24px 64px rgba(16,24,40,.12)`.
- Sem animação de entrada por scroll. Sem parallax. Uma transição de hover por componente, 150ms.

---

## 7. Stack e deploy

**Recomendado:** Astro, saída estática, zero JavaScript no caminho crítico.

- `site/` como pasta nova no repositório, ao lado de `src/`.
- Páginas: `/` (PT), `/en` (EN), `/download`, `/changelog`, `/privacidade`.
- Fontes próprias em `site/public/fonts`, subset latin, `woff2`, `font-display: swap`, preload do Inter 400 e do display 700.
- Imagens em AVIF com fallback WebP, todas com `width` e `height`.
- Deploy no Cloudflare Pages a partir de `main`, preview por pull request.
- Sem analytics. Se um dia quiser número de downloads, use a API pública do GitHub Releases, no servidor, não no navegador.

**Se preferir não adicionar Astro nesta fase:** um `index.html` mais um CSS resolve a v1 do site. Astro entra quando existir changelog e documentação, que são páginas de conteúdo.

**O que não muda:** o site não usa React, não compartilha componentes com o app. Compartilha tokens e capturas de tela.

---

## 8. Capturas de tela: usar o que já existe

O repositório tem `preview/` com backend mockado, `vite.preview.config.ts` e `preview/shoot.sh`, que já fotografa todas as rotas. Isso resolve o problema que o site do Visor tem: mockup que não corresponde ao produto.

**Proposta:**

1. Estender `shoot.sh` para aceitar resolução e destino: `preview/shoot.sh site/src/assets/shots light overview transactions cards --scale 2`.
2. Fixar os dados de `preview/mock-core.ts` para que a mesma captura saia igual em qualquer máquina.
3. Rodar no CI em pull request que mexa em `src/`, comparando hash das imagens. Se mudou a tela, o PR atualiza as capturas e o site nunca fica desatualizado.
4. Nomear os arquivos por rota e tema: `overview-light@2x.avif`.

---

## 9. Download

- O CTA aponta para `/download`, nunca direto para um asset, para poder explicar o SmartScreen uma vez.
- `/download` lista os três artefatos da última release: `trove-setup.msi`, `trove-setup.exe`, `trove-portable-x64.zip`, com tamanho e data vindos da API do GitHub em tempo de build.
- Aviso do SmartScreen com uma captura real da tela do Windows e a explicação de que a build não é assinada, com o custo de assinar um certificado EV mencionado só se você quiser.
- Requisitos: Windows 10 ou 11, x64.
- Nada de e-mail, nada de formulário.

---

## 10. SEO e compartilhamento

- `title`: Trove: finanças pessoais no seu computador, sem conta e sem servidor
- `description`: Importe o OFX do seu banco e organize suas finanças em um app local, gratuito e open source. Sem cadastro, sem telemetria, sem servidor.
- `canonical` em `/`, `hreflang` entre `/` e `/en`.
- Open Graph 1200x630 com a janela do app e a frase "Seu dinheiro, no seu computador."
- JSON-LD `SoftwareApplication`: `operatingSystem: Windows`, `applicationCategory: FinanceApplication`, `offers.price: 0`, `license: MIT`, `downloadUrl` da release.
- `sitemap.xml` e `robots.txt` gerados no build.
- Domínio a definir. Não verifiquei disponibilidade de nenhum; `trove.app` provavelmente está ocupado.

---

## 11. Performance e acessibilidade

Orçamento:

| Métrica | Meta |
|---|---|
| JavaScript no caminho crítico | 0 KB |
| Total da primeira dobra | menos de 400 KB |
| LCP em 4G | menos de 1,5 s |
| CLS | 0 |
| Fontes | 2 arquivos, menos de 150 KB somados |

Acessibilidade, com os erros do Visor corrigidos por princípio:

- Foco visível em todo elemento focável, 2px de anel e 2px de offset.
- Contraste mínimo 4.5:1 em todo texto, inclusive eyebrow azul. Se `#1d63ed` em 12px ficar em 5.1:1, está aprovado; se cair abaixo, escurecer para `#1a56d8`.
- Nenhum texto em cinza claro. `#69707d` é o piso.
- Skip link, `lang` correto em cada página, alt descritivo em toda captura.
- Sem banner de cookies, porque não há cookie.

---

## 12. Roadmap de conteúdo

**Fase 1 (lançamento):** home, download, changelog gerado de `release-notes/`, página de privacidade curta.

**Fase 2 (confiança):** documentação de importação por banco, com o nome do arquivo que cada banco entrega e uma captura da tela de importação.

**Fase 3 (alcance):** comparativo honesto "Trove, planilha e app de assinatura", e um texto sobre por que o app não pede senha do banco. Sem blog genérico de educação financeira.

---

## 13. O que não copiar do Visor

1. Paywall cobrindo metade do produto. O Trove não tem nada para vender.
2. Cinco famílias tipográficas.
3. Dois azuis de marca.
4. Mockup que não é o app. Aqui as capturas vêm do próprio código.
5. Prova social inventada. Nada de "15 mil pessoas" sem lastro.
6. Página de 11.500px com dez seções. Aqui são doze blocos curtos e uma decisão por dobra.
7. Banner de cookies para um site sem cookies.
8. Urgência falsa ("últimas vagas", contador).
