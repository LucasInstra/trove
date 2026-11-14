# Trove: direção visual e plano de redesign

Versão 2: **máxima semelhança com o Visor**, exceto nos sete erros listados na seção 11.

Base: os dois estudos em `Documents/visor-design-audit`, o código atual do Trove e o preview em `localhost:1421/?route=<rota>&theme=<light|dark>`.

A regra desta versão: copiar tudo o que dá o aspecto do Visor sem trazer o que está errado lá. Onde a semelhança custaria correção, eu digo onde parei e por quê.

---

## 0. Veredito de stack

**Não trocar a stack.** Tauri 2, React 19, TypeScript, Tailwind 4 e Rust ficam. O visual muda por tokens, componentes e fontes, não por framework.

O que muda na infraestrutura:

1. **Fontes empacotadas.** Satoshi, Inter e Gloria Hallelujah em `src/assets/fonts`, `.woff2`, subset latin, `font-display: swap`, preload das duas que aparecem na primeira dobra.
2. **Tokens em um arquivo só.** Hoje existem três `:root` (`styles.css`, `theme.css`, `design.css`). Viram `src/styles/tokens.css`.
3. **`@layer legacy` removido por fases**, ao fim da fase 5.
4. **Toggle "Visual: novo" fora da build de produção.**

---

## 1. A tradução do look do Visor para um app denso

O site do Visor acerta por cinco coisas concretas, e todas são transportáveis:

| O que dá a cara | Como o Trove recebe |
|---|---|
| Tipografia display apertada e grande (Satoshi 52/700, tracking -2.08px) | Satoshi nos títulos de página e nos números herói, tracking -0.03em |
| Papel e colagem: polaroid, percevejo, legenda manuscrita | Moldura de polaroid nos três contextos editoriais, com Gloria Hallelujah |
| Ilustração 3D isométrica em círculo colorido | Os 45 PNGs que já existem, em círculos tintados nos cards |
| Azul único e disciplinado sobre branco | `#1846e1`, o mesmo botão do site |
| Banda escura como pausa | Um card âncora escuro no Overview e a superfície de onboarding |

O que **não** transporta: página de 11.500px, cinco fontes, dois azuis, paywall, mockup fake, cinza a 2.47:1, foco invisível, ausência de dark mode.

Regra de dosagem: **80% sóbrio, 20% editorial**. Tabela, gráfico e KPI continuam frios. O calor entra na moldura, no card âncora, nas telas de plano e nos estados vazios. Se o app inteiro virar scrapbook, ele perde a função.

---

## 2. O que o Trove é hoje

Observado no preview, 1280x860, claro e escuro.

**Já está certo:** densidade de desktop (base 13px), números tabulares, centavos em corpo menor, tema escuro funcional, cartões sem sombra com borda de 1px, movimento de 150ms com press `scale(.97)`, 45 ícones 3D disponíveis.

**O que está errado:** `Settings` duplicado na sidebar; rota `house` rotulada "Home" ao lado de "Overview"; seletor de mês em 24px competindo com os botões; `--primary` definido duas vezes (`#1d63ed` e `#2563eb`); separação de superfície em 1.03:1; cartões de crédito em gradiente roxo e laranja; tipografia sem hierarquia de display; raios misturados.

---

## 3. Conceito

**Prova e calor.**

O Trove tem o que o Visor não tem: todo número responde de onde veio. O redesign torna isso visível e, em volta, aplica a moldura calorosa do site. O dado fica frio; a moldura fica quente.

Diferença de ambição em relação à versão 1 deste documento: aqui a moldura é maior, mais colorida e mais presente, porque a intenção é parecer o Visor de verdade, não apenas se inspirar nele.

---

## 4. Princípios

1. **Provenance em primeiro lugar.** Número agregado abre a origem em um clique: arquivo, linha, data de importação, ou "manual".
2. **Moldura quente, dado frio.** Ilustração, polaroid e cor viva vivem nas bordas. Tabela e gráfico são neutros.
3. **Um azul, um verde, um vermelho, um âmbar.** A disciplina de cor do Visor é justamente o que dá elegância a ele.
4. **Densidade com ar.** 13px de base, mas com entrelinha, padding e ritmo explícitos.
5. **Card é painel.** Sombra suave permitida, mas de um único token, e nada de levantar no hover.
6. **Teclado é cidadão de primeira classe.** Foco sempre visível.

---

## 5. Sistema

### 5.1 Tipografia

Três famílias, cada uma com um trabalho distinto. Isso resolve o erro do Visor (três sans fazendo a mesma coisa) sem abrir mão do look.

| Papel | Família | Licença | Pesos | Onde |
|---|---|---|---|---|
| Display | **Satoshi** | Fontshare (verificar redistribuição) | 600, 700 | título de página, número herói, eyebrow, capa de estado vazio |
| Interface | **Inter Variable** | SIL OFL | 400, 500, 600, 700 | tabela, corpo, botão, campo, gráfico |
| Manuscrito | **Gloria Hallelujah** | SIL OFL | 400 | só legendas de polaroid, 13.5px |

Se a licença da Fontshare não permitir redistribuir dentro de um app MIT, a substituta é **Bricolage Grotesque** (OFL), tracking um pouco mais fechado. Não use Inter Display como display: perde o contraste de personalidade que dá o look.

Escala:

| Token | Tamanho | Entrelinha | Fonte | Uso |
|---|---|---|---|---|
| `text-2xs` | 11px | 14px | Inter | eixo, metadado de linha |
| `text-xs` | 12px | 16px | Inter | rótulo de KPI, legenda |
| `text-sm` | 13px | 18px | Inter | corpo padrão, tabela |
| `text-md` | 15px | 22px | Inter | título de card |
| `text-lg` | 18px | 24px | Satoshi 600 | subtítulo de seção |
| `text-xl` | 26px | 30px | Satoshi 700 | título de página |
| `text-2xl` | 34px | 38px | Satoshi 700 | número herói secundário |
| `text-3xl` | 46px | 48px | Satoshi 700 | número herói do mês |
| `text-hero` | 64px | 64px | Satoshi 700 | onboarding e import concluído |

Regras:

- Títulos e números herói com `letter-spacing: -0.03em`, como o H1 do site (-2.08px em 52px).
- Números sempre em Inter com `font-variant-numeric: tabular-nums`. Satoshi só no número herói, onde não há coluna para alinhar.
- Centavos a `0.62em`, peso 500, na linha de base. Mantém o que já existe.
- Eyebrow: 12px, caixa alta, `letter-spacing: .08em`, `#1846e1`, com o glifo `✦` depois do texto. É assinatura direta do site.

### 5.2 Cor

Um azul só, o do botão do site.

**Tema claro**

| Token | Valor | Contraste | Uso |
|---|---|---|---|
| `--bg` | `#f4f5f7` | | fundo da janela |
| `--surface` | `#ffffff` | | card, tabela |
| `--surface-soft` | `#f7f8fa` | | cabeçalho de tabela, faixa |
| `--sunken` | `#eceff4` | | poço, desabilitado |
| `--paper` | `#faf7f2` | | superfície editorial, banda de plano |
| `--hero-band` | `#0b1120` | | card âncora, onboarding |
| `--ink` | `#0d0d0d` | 18.9:1 | texto principal |
| `--muted` | `#4d5766` | 7.4:1 | texto secundário |
| `--faint` | `#69707d` | 4.96:1 | metadado, eixo |
| `--line` | `#e6eaf1` | | borda de card |
| `--line-strong` | `#cfd6e2` | | hover, divisor forte |
| `--primary` | `#1846e1` | 6.6:1 | ação, link, progresso |
| `--primary-soft` | `#e8effd` | | seleção, círculo de ícone, card tintado |
| `--positive` | `#0f7a3d` | 5.0:1 | entrada |
| `--negative` | `#a53a26` | 6.4:1 | saída |
| `--warning` | `#a16207` | 4.9:1 | vencimento |
| `--clay` | `#d9603b` | | percevejo e moldura de polaroid |

`#16a34a` e `#008af9` ficam permitidos apenas como **preenchimento gráfico** em ilustração e chart, nunca como cor de texto ou de fundo de pílula com texto branco, porque não passam em 4.5:1 no tamanho em que o app usa.

**Tema escuro**

| Token | Valor |
|---|---|
| `--bg` | `#0b1120` |
| `--surface` | `#141b2b` |
| `--surface-soft` | `#1a2338` |
| `--paper` | `#1b2130` |
| `--hero-band` | `#0b1120` |
| `--ink` | `#e8edf7` |
| `--muted` | `#a7b1c4` |
| `--faint` | `#8b96aa` |
| `--line` | `#253148` |
| `--primary` | `#6d9bff` |
| `--primary-soft` | `#1b2740` |
| `--positive` | `#4ade80` |
| `--negative` | `#e0806c` |

O card âncora escuro no tema claro vira `--surface-soft` no tema escuro, para não desaparecer no fundo.

### 5.3 Superfície, raio, sombra

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | 8px | input, chip |
| `radius-md` | 12px | botão, campo, aba |
| `radius-lg` | 20px | card |
| `radius-xl` | 24px | dialog, banda editorial |
| `radius-full` | 9999px | pílula, avatar, círculo de ícone |

Sombra única, aplicada em **todo card**:

```css
--shadow-card: 0 1px 2px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.06);
```

Isso é deliberadamente diferente do que está no app hoje. O Visor usa cards flutuando sobre fundo claro, e é parte do look. A correção do erro dele não é remover a sombra, é **ter uma sombra só** em vez de três. No tema escuro, sombra vira `none` e a borda carrega a separação.

Botão primário com brilho curto, como no site:

```css
box-shadow: 0 1px 2px rgba(24, 70, 225, 0.24), 0 8px 20px -8px rgba(24, 70, 225, 0.45);
```

### 5.4 Espaçamento e grade

Base 4px. Escala 4, 8, 12, 16, 20, 24, 32, 40, 56.

- Padding de card: 16px compacto, 20px padrão, 24px editorial.
- Gap entre cards: 16px, como no bento do site.
- Sidebar 208px, colapsada 64px.
- Conteúdo com `max-width: 1440px` e gráfico com teto de 1100px.

### 5.5 Ícones e ilustração

**UI:** linha, grade 16 ou 20, stroke 1.5, `currentColor`. Padronizar o que já existe em `Icons.tsx`.

**3D:** os 45 PNGs, em 40, 56 ou 72px, sempre dentro de um círculo de 56 ou 72px com fundo tintado (`--primary-soft` ou uma cor de categoria a 15%). É exatamente o padrão dos cards de recurso do site. Só em: cabeçalho de página, card editorial, estado vazio, conclusão de import, onboarding.

**Polaroid:** a assinatura mais forte do site, e a que dá mais risco. Especificação:

```css
.polaroid {
  background: #fff;
  padding: 8px 8px 30px;
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(15,23,42,.08), 0 10px 24px rgba(15,23,42,.10);
  transform: rotate(-2.5deg); /* variar entre -3 e 3 graus */
}
.polaroid::before {           /* percevejo */
  content: "";
  position: absolute; top: -6px; left: 50%; translate: -50% 0;
  width: 12px; height: 12px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ff8a7a, #d9603b 60%, #a53a26);
  box-shadow: 0 1px 2px rgba(0,0,0,.25);
}
.polaroid figcaption {
  font-family: "Gloria Hallelujah"; font-size: 13.5px;
  color: #2b2b2b; text-align: center; margin-top: 6px;
}
```

Onde a polaroid pode aparecer, e só aqui:

1. **Onboarding**, uma por tela, com o nome do que a pessoa está planejando.
2. **Telas de plano**: Home (casa), Goals (viagem, carro, casamento), Retirement (período sabático), Reserve (colchão de segurança). Aqui a semelhança é literal: são momentos planejados, como no site.
3. **Estado vazio** de uma tela de plano.

Nunca em tabela, gráfico, card de KPI, dialog de valor ou qualquer lugar onde exista número para ler em coluna.

### 5.6 Movimento

- 150ms, `cubic-bezier(.2,.8,.2,1)`.
- Press em botão `scale(.97)`.
- Card não levanta no hover. Só a borda escurece.
- Polaroid entra com 8px de deslocamento e rotação de 0.5 grau, 220ms, uma vez, e só na primeira montagem da tela.
- Gráfico anima 250ms, uma vez, respeitando `prefers-reduced-motion`.
- Troca de tema instantânea.

### 5.7 Foco e acessibilidade

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: inherit;
}
```

Piso de contraste 4.5:1 até 18px. `--faint` em 4.96:1 é o mínimo aceitável. Alvo de 32x32 no desktop, 44x44 se houver toque. Toda ação destrutiva confirma com o número do que será apagado.

---

## 6. Assinaturas do Visor aplicadas

Dez transplantes diretos, com o nome do componente no app.

| # | Assinatura | Onde no Trove | Componente |
|---|---|---|---|
| 1 | Eyebrow caixa alta azul com `✦` | cabeçalho de página e de seção | `PageHeader` |
| 2 | Título display apertado | `Overview`, `Cards`, `Net worth` | `PageTitle` |
| 3 | Número herói grande com centavos pequenos | saldo do mês, patrimônio | `Money variant="hero"` |
| 4 | Bento com dois cards tintados | grid do `Overview` | `OverviewGrid` |
| 5 | Círculo tintado com 3D | cards de recurso e de plano | `IconBubble` |
| 6 | Polaroid com percevejo e manuscrito | onboarding, Goals, Home, Retirement | `Polaroid` |
| 7 | Card âncora escuro | resumo do mês no `Overview` | `AnchorCard` |
| 8 | Pílula flutuante com sombra | barra de mês e ações | `FloatingBar` |
| 9 | Traço de pincel sob palavra-chave | onboarding e título do mês | `BrushUnderline` |
| 10 | Banda de papel | `Como funciona`, import concluído | `PaperBand` |

O `BrushUnderline` é um SVG de traço irregular em `--primary` a 55% de opacidade, 3px de espessura, posicionado sob a palavra. Use no máximo uma vez por tela, como faz o site.

---

## 7. Componentes

| Componente | Hoje | Direção |
|---|---|---|
| `TitleBar` | logo, toggle de dev, controles | remove o toggle; logo 20px; faixa arrastável inteira |
| `Sidebar` | 9 itens, Settings duplicado | 6 no grupo principal, 3 no grupo de configuração; raio 12 na pílula ativa |
| `TopBar` | mês em 24px, botões soltos | `FloatingBar`: pílula branca com sombra, mês em Satoshi 18px, ações à direita |
| `Card` | borda 1px, raio 16, sem sombra | raio 20, `--shadow-card`, cabeçalho com eyebrow + título |
| `AnchorCard` | não existe | card `--hero-band`, texto claro, número herói, usado uma vez no Overview |
| `MetricStrip` | faixa azulada | `--surface-soft`, divisor 1px, rótulo 12px e valor 22px |
| `Money` | centavos menores | adiciona `variant="hero"` em Satoshi 46px |
| Tabela | densa, funcional | mantém; coluna de origem com ícone de arquivo ou lápis |
| Chip de categoria | cor sólida | tinta 15%, texto na cor cheia, raio full |
| Gráfico | SVG com CSS vars | eixo `--faint`, grid `--line`, tooltip com sombra de flutuação |
| `Dialog` | painel central | raio 24, sombra única, foco preso |
| `IconBubble` | não existe | círculo 56px com 3D de 32px |
| `Polaroid` | não existe | especificado em 5.5 |
| `PaperBand` | não existe | seção `--paper` com raio 24 e padding 32 |
| Estado vazio | texto centralizado | `PaperBand` + `Polaroid` + uma frase + uma ação |
| Import | formulário longo | 4 passos com barra de progresso, prévia e resumo |
| Cartão de crédito | gradiente roxo e laranja | azul `#1846e1` em gradiente para `#0b2a8a`, e grafite para o segundo cartão |

---

## 8. Tela por tela

**Overview.** Vira bento. Faixa de 4 KPIs em largura total, com eyebrow e sparkline. Abaixo, grid assimétrico: `AnchorCard` escuro com o saldo do mês (2 colunas), gráfico de fluxo (3), "onde o dinheiro foi" (2), "contas a pagar" (3), "últimas transações" (2). Dois cards tintados em `--primary-soft`. Cada KPI com ícone de informação que abre a origem.

**Transactions.** A melhor tela atual, mexer pouco. Coluna de origem, chip tintado, cabeçalho de dia em `--surface-soft`, seleção em `--primary-soft`, barra de ações em massa flutuante.

**Cash flow.** Aplicar o grid novo, teto de 1100px no gráfico, e um `MetricStrip` no topo.

**Cards.** Gradientes azul e grafite. Faixa de fatura vira `MetricStrip`. Barra de limite com `--primary` e vermelho só acima de 80%.

**Home, Goals, Retirement, Reserve.** O território da polaroid. Cada plano é um card `--paper` com polaroid, legenda em Gloria, projeção em `text-lg` e barra de progresso. É aqui que o app mais se parece com o site, e é intencional.

**Net worth, Investments, Patrimony.** Sem ilustração. Número herói em Satoshi 46px, composição ativo/passivo em duas linhas semânticas, tabela densa.

**Categories.** Árvore com indentação clara, chip tintado, cor de categoria visível na linha.

**Import.** `PaperBand` em cada passo, 3D de 56px no topo, resumo final com a origem do arquivo e a contagem de duplicatas.

**Settings.** Grupos: Conta e dados, Aparência, Idioma, Atualizações, Sobre. Backup com caminho do banco visível e botão de copiar.

---

## 9. Migração

**Fase 0: inventário (P).** Auditar `--primary`, raio e padding. Congelar screenshots de referência.

**Fase 1: fundação (M).** `tokens.css` único, fontes empacotadas, `@theme` do Tailwind 4, bloco de `:focus-visible`, remoção dos `:root` duplicados.

**Fase 2: shell (M).** `TitleBar`, `Sidebar`, `FloatingBar`. Resolver Settings duplicado e renomear "Home".

**Fase 3: superfícies e tabela (G).** `Card`, `MetricStrip`, `Money`, tabela, chips, gráficos.

**Fase 4: assinaturas (G).** `AnchorCard`, `IconBubble`, `PaperBand`, `BrushUnderline`, grid bento do Overview.

**Fase 5: editorial (M).** `Polaroid` no onboarding, nas telas de plano e nos estados vazios. Cartões de crédito.

**Fase 6: limpeza (M).** Apagar `@layer legacy`, rodar build, lint e testes, conferir 16 rotas nos dois temas.

---

## 10. Critérios de aceite

1. Três famílias carregadas, todas locais, nenhuma requisição externa: Satoshi, Inter, Gloria.
2. Um único `--primary`, definido uma vez.
3. Contraste mínimo 4.5:1 em texto até 18px nas 16 rotas, nos dois temas.
4. Foco visível em 100% dos focáveis.
5. Sombra de card vinda de um token só.
6. Polaroid apenas nos contextos listados em 5.5, verificado por grep de classe.
7. Nenhum gradiente fora da arte do cartão.
8. Nenhum PNG 3D em tabela.
9. `@layer legacy` vazio.
10. Screenshots de todas as rotas em `preview/` antes e depois, anexados ao PR.

---

## 11. Riscos

- **Licença da Fontshare.** Verificar redistribuição dentro de um app MIT antes de empacotar Satoshi. Se não permitir, Bricolage Grotesque.
- **Polaroid virar ruído.** Se aparecer em mais de três contextos, o app perde credibilidade. Tratar como assinatura, não como decoração.
- **Sombra em card denso.** Em tela com 30 cards, sombra vira sujeira. O `--shadow-card` é fraco o bastante para 30 cards, mas precisa ser testado no Overview antes de aplicar em tabela.
- **Card âncora escuro.** Um por tela, no máximo. Dois viram tema quebrado.
- **Paridade de dark mode.** Cada token novo entra com os dois valores no mesmo commit.
- **Deriva de screenshots.** O preview usa mock; regenerar antes de comparar.

---

## 12. O que não copiar do Visor

1. Cinco famílias tipográficas. Aqui são três, com papéis distintos.
2. Dois azuis de marca. Aqui é um.
3. Ausência de dark mode. Aqui existem os dois temas desde o primeiro token.
4. Foco de teclado invisível.
5. Cinza terciário a 2.47:1.
6. Mockup que não corresponde à tela real.
7. Paywall bloqueando conteúdo. O Trove é local e grátis, não tem upgrade para vender.
