export const pt = {
  lang: "pt-BR",
  code: "pt",
  other: { code: "en", label: "EN" },
  meta: {
    title: "Trove: finanças pessoais no seu computador, sem conta e sem servidor",
    description:
      "Importe o OFX do seu banco e organize suas finanças em um app local, open source e gratuito por enquanto. Sem cadastro, sem telemetria, sem servidor.",
  },
  skip: "Ir para o conteúdo",
  nav: {
    features: "Recursos",
    security: "Segurança",
    faq: "FAQ",
    changelog: "Changelog",
    github: "GitHub",
    theme: "Alternar tema claro e escuro",
    download: "Baixar",
    label: "Principal",
  },
  hero: {
    eyebrow: "WINDOWS · LOCAL-FIRST · OPEN SOURCE",
    h1: "Seu dinheiro, no seu computador.",
    sub: "O Trove lê o OFX que o seu banco já entrega e organiza tudo em um arquivo local. Sem conta, sem servidor, sem senha do banco.",
    cta: "Baixar para Windows",
    ctaSecondary: "Ver como funciona",
    proof: "Grátis por enquanto, open source (MIT) · sem cadastro · atualizações pelo GitHub",
    alt: "Tela de resumo do Trove com saldo previsto, resumo do mês, receitas contra gastos e últimas transações.",
  },
  features: {
    eyebrow: "Recursos",
    h2: "O que cabe dentro.",
    lead: "O Trove faz o caminho contrário: você baixa o extrato no banco e importa aqui. O dado não sai da máquina.",
    items: [
      {
        title: "Dashboard que é seu",
        text: "Arraste os cards, escolha a largura de cada um e o nível de detalhe.",
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
      },
      {
        title: "Patrimônio",
        text: "Contas, cartões, investimentos e dívidas lado a lado, com evolução no tempo.",
      },
    ],
    small: [
      "Modo planilha para gastos e investimentos",
      "Backup e restauração com verificação",
      "Inglês e português",
      "Atualização automática",
      "Cotação de criptomoedas opcional (desligada por padrão)",
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
        title: "As conexões",
        text: "O app fala com o GitHub para checar atualização. Se você ativar o acompanhamento opcional de criptomoedas (desligado por padrão), ele também consulta a CoinGecko pelas cotações, enviando só o nome das moedas. Nada mais.",
      },
    ],
    diagram: { bank: "Seu banco", file: "extrato.ofx", app: "Trove", db: "trove.db", github: "GitHub", only: "atualização, cotação cripto opcional" },
    close: "Seus dados nunca saem do seu computador: sem conta, sem nuvem e sem servidor no caminho.",
  },
  proof: {
    eyebrow: "O app de verdade",
    h2: "Esta é a tela que você vai usar.",
    sub: "Capturas geradas pelo próprio repositório, a partir de dados de exemplo.",
    stars: (n: number) => `${n} ${n === 1 ? "estrela" : "estrelas"} no GitHub`,
    repo: "Ver o repositório",
    version: (v: string) => `Versão atual: ${v}`,
  },
  who: {
    eyebrow: "Para quem é",
    h2: "Sem meias palavras.",
    lead: "Um app de nicho, feito para quem prefere um arquivo seu a uma conta em nuvem.",
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
        a: "Não. Tudo funciona offline. As únicas conexões do app são para checar e baixar atualizações no GitHub e, só se você ativar o acompanhamento opcional de criptomoedas, para buscar cotações.",
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
    micro: "Grátis por enquanto · MIT · sem cadastro",
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
    lead: "Grátis por enquanto, sem cadastro. Os arquivos saem direto das releases do GitHub.",
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
    lead: "Cada versão, direto das notas de release.",
  },
  privacy: {
    title: "Privacidade do Trove",
    description: "O Trove não tem conta, servidor nem telemetria. Este site também não usa cookies nem analytics.",
    h1: "Privacidade",
    blocks: [
      {
        h: "O app",
        p: "Nenhum dado financeiro sai do seu computador. Não há login, telemetria nem servidor nosso. O app só se conecta ao GitHub para checar e baixar atualizações. O acompanhamento de criptomoedas é opcional e fica desligado até você ativar em Configurações: quando ligado, o app consulta a CoinGecko pelo preço atual das moedas que você tem, enviando só o nome das moedas (por exemplo, bitcoin), nunca valores, contas ou dados pessoais. Desligue quando quiser e nenhuma consulta de preço é feita.",
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
  demo: {
    label: "Prévia animada: o Trove importa um extrato, mostra duplicatas, categoriza e fecha o mês.",
    steps: ["Importar", "Prévia", "Categorizar", "Mês fechado"],
    file: "extrato-dezembro.ofx",
    fileMeta: "OFX · 50 lançamentos",
    drop: "Solte o extrato aqui",
    previewTitle: "Prévia da importação",
    newLabel: "novos",
    dupLabel: "já existem",
    rows: [
      { name: "IFOOD", cat: "Restaurantes", tone: "violet" },
      { name: "UBER", cat: "Transporte", tone: "teal" },
      { name: "HORTIFRUTI", cat: "Mercado", tone: "green" },
      { name: "CINEMARK", cat: "Lazer", tone: "amber" },
    ],
    closedTitle: "Dezembro fechado",
    free: "54% da renda livre",
    balance: { int: "R$ 3.734", dec: ",01" },
    floatTx: { name: "UBER", cat: "Transporte", amount: "−R$ 33,53" },
    floatBar: { title: "Renda do mês", free: "54% livre" },
  },
  seals: [
    { key: "mit", title: "MIT", text: "código aberto" },
    { key: "sqlite", title: "SQLite", text: "um arquivo seu" },
    { key: "telemetry", title: "Sem telemetria", text: "nenhum evento" },
    { key: "signed", title: "Atualização assinada", text: "verificada pelo app" },
  ],
  frag: {
    layout: ["Saldo previsto", "Contas a pagar", "Gráficos"],
    import: { fresh: "42 novos", dup: "8 já existem" },
    transfer: { a: "Conta corrente", b: "Poupança", off: "fora dos totais", amount: "R$ 500,00" },
    flow: { free: "54% livre", caption: "Previsão de 6 meses" },
    net: { value: "R$ 128.400,00", caption: "Patrimônio" },
  },
  quote: {
    text: "Todo número na tela responde a uma pergunta:",
    hand: "de onde isso veio?",
    note: "Lançamentos importados guardam o arquivo e a linha que os gerou. Os manuais são marcados como manuais.",
  },
  tabs: { label: "Tema dos prints", light: "Claro", dark: "Escuro" },
  polaroids: ["Reserva de emergência", "Uma viagem no fim do ano", "Casa própria", "Sobra no fim do mês", "Tudo no seu PC", "Contas em dia"],
  fmtDate: (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
  fmtSize: (b: number) => `${(b / 1048576).toFixed(1).replace(".", ",")} MB`,
  paths: { home: "", download: "download/", changelog: "changelog/", privacy: "privacidade/" },
};

export type Strings = typeof pt;
