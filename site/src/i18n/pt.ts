export const pt = {
  lang: "pt-BR",
  code: "pt",
  other: { code: "en", label: "EN" },
  meta: {
    title: "Trove: finanças pessoais no seu computador, sem conta e sem servidor",
    description:
      "Importe o OFX do seu banco e organize suas finanças em um app local, gratuito e open source. Sem cadastro, sem telemetria, sem servidor.",
  },
  skip: "Ir para o conteúdo",
  nav: {
    product: "Produto",
    features: "Recursos",
    security: "Segurança",
    faq: "FAQ",
    changelog: "Changelog",
    github: "GitHub",
    download: "Baixar",
    label: "Principal",
  },
  hero: {
    eyebrow: "WINDOWS · LOCAL-FIRST · OPEN SOURCE",
    h1: "Seu dinheiro, no seu computador.",
    sub: "O Trove lê o OFX que o seu banco já entrega e organiza tudo em um arquivo local. Sem conta, sem servidor, sem assinatura.",
    cta: "Baixar para Windows",
    ctaSecondary: "Ver como funciona",
    proof: "Grátis e open source (MIT) · sem cadastro · atualizações pelo GitHub",
    tagImported: "importado de extrato.ofx",
    tagManual: "manual",
    alt: "Tela de resumo do Trove com saldo previsto, resumo do mês, receitas contra gastos e últimas transações.",
  },
  promises: [
    { title: "Sem conta", text: "Nada de login, e-mail ou senha." },
    { title: "Sem servidor", text: "O banco é um arquivo SQLite na sua máquina." },
    { title: "Sem telemetria", text: "Nenhum evento, nenhum pixel, nenhum cookie." },
  ],
  problem: {
    eyebrow: "O problema",
    h2: "Planilha quebra. App que pede senha do banco assusta. Assinatura cobra para você ver o seu próprio dinheiro.",
    cards: [
      {
        title: "A planilha",
        text: "Fórmula quebra, categoria vira bagunça, e no terceiro mês ninguém abre mais.",
      },
      {
        title: "A senha",
        text: "Conectar conta em app de terceiro é entregar a chave do cofre para quem você não conhece.",
      },
      {
        title: "A assinatura",
        text: "Você paga todo mês para consultar dados que já são seus.",
      },
    ],
    close: "O Trove faz o caminho contrário: você baixa o extrato no banco e importa aqui. O dado não sai da máquina.",
  },
  how: {
    eyebrow: "Como funciona",
    h2: "Três passos, uma vez por mês.",
    steps: [
      {
        title: "Baixe o extrato.",
        text: "No site ou no app do seu banco, exporte o OFX do mês. O arquivo já existe, você só não sabia.",
      },
      {
        title: "Importe com prévia.",
        text: "O Trove mostra o que entra, o que já existe e o que é duplicata antes de gravar qualquer coisa.",
      },
      {
        title: "Veja o mês.",
        text: "Categorias, contas, cartões e projeção no mesmo lugar. Cada número aponta para o arquivo que o gerou.",
      },
    ],
    close: "CSV também funciona, com perfil configurável por banco.",
  },
  features: {
    eyebrow: "Recursos",
    h2: "O que cabe dentro.",
    items: [
      {
        title: "Dashboard que é seu",
        text: "Arraste os cards, escolha a largura de cada um e o nível de detalhe. Card largo mostra mais conteúdo, não o mesmo conteúdo esticado.",
        solid: true,
      },
      {
        title: "Importação que não duplica",
        text: "OFX 1.x e 2.x, CSV de banco configurável, deduplicação por FITID e por impressão digital, histórico de cada arquivo que entrou.",
      },
      {
        title: "Categorias e regras",
        text: "Árvore de categorias, orçamento por categoria e regras que classificam sem sobrescrever o que você escolheu à mão.",
      },
      {
        title: "Transferências e estornos",
        text: "Par de transferência não infla receita nem despesa. Estorno compensa a compra original.",
      },
      {
        title: "Fluxo e projeção",
        text: "Orçamento com carryover, livre para gastar, detecção de recorrência e previsão de 3, 6 e 12 meses.",
        solid: true,
      },
      {
        title: "Patrimônio",
        text: "Contas, cartões, investimentos e dívidas lado a lado, com evolução no tempo.",
      },
    ],
    small: [
      "Backup e restauração com verificação",
      "Inglês e português",
      "Atualização automática",
    ],
  },
  data: {
    eyebrow: "Onde o dado mora",
    h2: "Seu banco de dados é um arquivo. Você sabe onde ele está.",
    cols: [
      {
        title: "O arquivo",
        text: "SQLite, aberto, inspecionável, sem formato proprietário.",
        code: "%APPDATA%\\com.lucas.trove\\trove.db",
      },
      {
        title: "A cópia",
        text: "Backup com VACUUM INTO e restauração com verificação de integridade antes de substituir o arquivo ativo.",
      },
      {
        title: "A única conexão",
        text: "O app fala com o GitHub para checar atualização. Nada mais.",
      },
    ],
    diagram: { db: "trove.db", app: "Trove", you: "Você", only: "só atualização", github: "GitHub" },
    close: "Não existe servidor nosso para vazar, porque não existe servidor nosso.",
  },
  proof: {
    eyebrow: "Prova",
    h2: "Nada de depoimento. Só o que dá para conferir.",
    items: [
      { title: "Capturas reais", text: "Telas do app, geradas pelo próprio repositório a partir de dados de exemplo." },
      { title: "Código aberto", text: "Licença MIT, no GitHub, para ler, copiar e auditar." },
      { title: "Changelog público", text: "Cada versão com o que mudou, direto das notas de release." },
    ],
    shots: [
      { key: "transactions", alt: "Tela de transações do Trove com a lista de lançamentos e filtros.", label: "Transações" },
      { key: "flow", alt: "Tela de fluxo de caixa do Trove com orçamento e projeção.", label: "Fluxo de caixa" },
      { key: "cards", alt: "Tela de cartões do Trove com faturas e limites.", label: "Cartões" },
    ],
    stars: (n: number) => `${n} ${n === 1 ? "estrela" : "estrelas"} no GitHub`,
    repo: "Ver o repositório",
    version: (v: string) => `Versão atual: ${v}`,
  },
  who: {
    eyebrow: "Para quem é",
    h2: "Sem meias palavras.",
    yesTitle: "É para você se:",
    yes: [
      "usa Windows;",
      "quer ver o extrato sem dar senha do banco para ninguém;",
      "aceita importar OFX ou CSV uma vez por mês;",
      "gosta de saber onde o dado está.",
    ],
    noTitle: "Não é para você se:",
    no: [
      "quer sincronização automática em tempo real;",
      "usa Mac ou Linux (ainda não suportado);",
      "precisa de app no celular;",
      "quer recomendação de investimento.",
    ],
  },
  faq: {
    eyebrow: "FAQ",
    h2: "Perguntas comuns.",
    items: [
      {
        q: "O Windows avisa que o app não é assinado. É seguro?",
        a: "O Trove é open source, então o código que gera o instalador está público. Mesmo assim, a build não tem assinatura de código (um certificado custa caro por ano), e por isso o SmartScreen pode avisar na primeira execução. Se você confia na origem, clique em “Mais informações” e depois em “Executar assim mesmo”. Baixe sempre pela página de releases do GitHub.",
      },
      {
        q: "De quais bancos consigo importar?",
        a: "De qualquer banco que exporte OFX (1.x ou 2.x). Para os que só entregam CSV, o Trove tem perfis configuráveis de colunas, que você salva por banco. Não há lista fechada de bancos, porque o Trove lê o arquivo, não a conta.",
      },
      {
        q: "Preciso de internet para usar?",
        a: "Não. Tudo funciona offline. A única conexão do app é para checar e baixar atualizações no GitHub.",
      },
      {
        q: "Onde ficam meus dados?",
        a: "Em um arquivo SQLite no seu computador: %APPDATA%\\com.lucas.trove\\trove.db. A tela de Configurações mostra a pasta.",
      },
      {
        q: "Consigo fazer backup?",
        a: "Sim. Em Configurações você cria uma cópia local do banco e restaura uma cópia validada. A restauração confere a integridade do arquivo antes de substituir o ativo.",
      },
      {
        q: "Tem versão para Mac ou Linux?",
        a: "Ainda não. Hoje o Trove é só para Windows 10 e 11 (x64).",
      },
      {
        q: "Tem versão em inglês?",
        a: "Sim. O app troca entre português e inglês em Configurações e lembra a escolha.",
      },
      {
        q: "Como contribuir?",
        a: "Abra uma issue ou um pull request no repositório do GitHub. Relatos de extrato que não importou direito são os mais úteis.",
      },
    ],
  },
  cta: {
    h2: "Comece com o extrato do mês passado.",
    button: "Baixar para Windows",
    micro: "Grátis · MIT · sem cadastro",
  },
  footer: {
    cols: [
      {
        title: "Produto",
        links: [
          { label: "Recursos", href: "#features" },
          { label: "Segurança", href: "#security" },
          { label: "Baixar", href: "download/" },
          { label: "Changelog", href: "changelog/" },
        ],
      },
      {
        title: "Desenvolvedor",
        links: [
          { label: "Código no GitHub", href: "https://github.com/LucasInstra/trove" },
          { label: "Releases", href: "https://github.com/LucasInstra/trove/releases" },
          { label: "Issues", href: "https://github.com/LucasInstra/trove/issues" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Privacidade", href: "privacidade/" },
          { label: "Licença MIT", href: "https://github.com/LucasInstra/trove/blob/main/LICENSE" },
        ],
      },
      {
        title: "Comunidade",
        links: [
          { label: "Discussões e issues", href: "https://github.com/LucasInstra/trove/issues" },
          { label: "Contribuir", href: "https://github.com/LucasInstra/trove/pulls" },
        ],
      },
    ],
    legal: "MIT © 2026 Lucas",
    disclaimer: "O Trove não é um serviço financeiro e não dá recomendação de investimento.",
  },
  download: {
    title: "Baixar o Trove para Windows",
    description: "Instalador MSI, instalador EXE e versão portátil do Trove, de graça, direto das releases do GitHub.",
    h1: "Baixar o Trove",
    lead: "Grátis, sem cadastro. Os arquivos saem direto das releases do GitHub.",
    latest: (v: string, date: string) => `Última versão: ${v}, publicada em ${date}.`,
    reqTitle: "Requisitos",
    req: "Windows 10 ou 11, 64 bits.",
    files: {
      "trove-setup.msi": {
        name: "Instalador (MSI)",
        text: "O recomendado. As atualizações dentro do app usam este pacote.",
      },
      "trove-setup.exe": {
        name: "Instalador (EXE)",
        text: "Alternativa em NSIS, quando a release traz este arquivo.",
      },
      "trove-portable-x64.zip": {
        name: "Portátil (ZIP)",
        text: "Só o executável, para quem não quer instalar nada.",
      },
    } as Record<string, { name: string; text: string }>,
    button: "Baixar",
    fallbackTitle: "Não deu para listar os arquivos agora",
    fallback: "Abra a página de releases do GitHub e escolha o arquivo da última versão.",
    fallbackLink: "Ir para as releases",
    smartTitle: "Se o Windows avisar “O Windows protegeu o seu computador”",
    smart: [
      "A build do Trove não tem assinatura de código, por isso o SmartScreen avisa na primeira execução.",
      "Clique em “Mais informações” e depois em “Executar assim mesmo”.",
      "Baixe só pela página de releases do GitHub, que é a origem oficial.",
    ],
    afterTitle: "Depois de instalar",
    after: "Exporte o OFX do mês no seu banco e importe no Trove. Nada é pedido além disso.",
    size: "Tamanho",
    back: "Voltar para o início",
  },
  changelog: {
    title: "Changelog do Trove",
    description: "Cada versão do Trove com o que mudou, direto das notas de release.",
    h1: "Changelog",
    lead: "Cada versão, direto das notas de release. As notas são escritas em inglês.",
  },
  privacy: {
    title: "Privacidade do Trove",
    description: "O Trove não tem conta, servidor nem telemetria. Este site também não usa cookies nem analytics.",
    h1: "Privacidade",
    blocks: [
      {
        h: "O app",
        p: "Nenhum dado financeiro sai do seu computador. Não há login, telemetria nem servidor nosso. O app só se conecta ao GitHub para checar e baixar atualizações.",
      },
      {
        h: "Onde ficam os dados",
        p: "O banco de dados é o arquivo trove.db em %APPDATA%\\com.lucas.trove. A tela de Configurações mostra a pasta.",
      },
      {
        h: "Este site",
        p: "Não usa cookies, analytics nem rastreadores, e por isso não tem banner de consentimento. Ele é hospedado no GitHub Pages, que pode registrar acessos no nível do servidor, conforme a política do próprio GitHub.",
      },
    ],
  },
  fmtDate: (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
  fmtSize: (b: number) => `${(b / 1048576).toFixed(1).replace(".", ",")} MB`,
  paths: { home: "", download: "download/", changelog: "changelog/", privacy: "privacidade/" },
};

export type Strings = typeof pt;
