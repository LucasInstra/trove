import type { Strings } from "./pt";

export const en: Strings = {
  lang: "en",
  code: "en",
  other: { code: "pt", label: "PT" },
  meta: {
    title: "Trove: personal finance on your computer, no account and no server",
    description:
      "Import the OFX file your bank already gives you and organise your finances in a local, free, open source app. No sign-up, no telemetry, no server.",
  },
  skip: "Skip to content",
  nav: {
    product: "Product",
    features: "Features",
    security: "Security",
    faq: "FAQ",
    changelog: "Changelog",
    github: "GitHub",
    download: "Download",
    label: "Main",
  },
  hero: {
    eyebrow: "WINDOWS · LOCAL-FIRST · OPEN SOURCE",
    h1: "Your money, on your computer.",
    sub: "Trove reads the OFX file your bank already gives you and organises everything in one local file. No account, no server, no subscription.",
    cta: "Download for Windows",
    ctaSecondary: "See how it works",
    proof: "Free and open source (MIT) · no sign-up · updates through GitHub",
    tagImported: "imported from statement.ofx",
    tagManual: "manual",
    alt: "Trove's overview screen with forecast balance, month at a glance, income versus spending and latest transactions.",
  },
  promises: [
    { title: "No account", text: "No login, no email, no password." },
    { title: "No server", text: "The database is a SQLite file on your machine." },
    { title: "No telemetry", text: "No events, no pixels, no cookies." },
  ],
  problem: {
    eyebrow: "The problem",
    h2: "Spreadsheets break. Apps that ask for your bank password are scary. Subscriptions charge you to look at your own money.",
    cards: [
      {
        title: "The spreadsheet",
        text: "Formulas break, categories turn into a mess, and by the third month nobody opens it.",
      },
      {
        title: "The password",
        text: "Linking your account to a third-party app hands the key to the vault to someone you do not know.",
      },
      {
        title: "The subscription",
        text: "You pay every month to look at data that is already yours.",
      },
    ],
    close: "Trove goes the other way: you download the statement from your bank and import it here. The data never leaves the machine.",
  },
  how: {
    eyebrow: "How it works",
    h2: "Three steps, once a month.",
    steps: [
      {
        title: "Download the statement.",
        text: "On your bank's site or app, export the month as OFX. The file already exists, you just did not know.",
      },
      {
        title: "Import with a preview.",
        text: "Trove shows what comes in, what is already there and what is a duplicate before it writes anything.",
      },
      {
        title: "See the month.",
        text: "Categories, accounts, cards and forecast in one place. Every number points to the file that produced it.",
      },
    ],
    close: "CSV works too, with a configurable profile per bank.",
  },
  features: {
    eyebrow: "Features",
    h2: "What is inside.",
    items: [
      {
        title: "A dashboard that is yours",
        text: "Drag cards anywhere, set each card's width and pick how much detail it shows. A wide card shows more of it, not the same content stretched.",
        solid: true,
      },
      {
        title: "Imports that do not duplicate",
        text: "OFX 1.x and 2.x, configurable bank CSV, deduplication by FITID and by fingerprint, and a history of every file that came in.",
      },
      {
        title: "Categories and rules",
        text: "A category tree, budgets per category and rules that classify without overwriting what you chose by hand.",
      },
      {
        title: "Transfers and refunds",
        text: "A paired transfer does not inflate income or spending. A refund nets against the original purchase.",
      },
      {
        title: "Cash flow and forecast",
        text: "Budgets with carryover, free-to-spend, recurring-charge detection and 3, 6 and 12-month forecasts.",
        solid: true,
      },
      {
        title: "Net worth",
        text: "Accounts, cards, investments and debts side by side, with their evolution over time.",
      },
    ],
    small: ["Backup and restore with verification", "English and Portuguese", "Automatic updates"],
  },
  data: {
    eyebrow: "Where the data lives",
    h2: "Your database is a file. You know where it is.",
    cols: [
      {
        title: "The file",
        text: "SQLite, open, inspectable, no proprietary format.",
        code: "%APPDATA%\\com.lucas.trove\\trove.db",
      },
      {
        title: "The copy",
        text: "Backup with VACUUM INTO, and a restore that checks the file's integrity before it replaces the live one.",
      },
      {
        title: "The only connection",
        text: "The app talks to GitHub to check for updates. Nothing else.",
      },
    ],
    diagram: { db: "trove.db", app: "Trove", you: "You", only: "updates only", github: "GitHub" },
    close: "There is no server of ours to leak, because there is no server of ours.",
  },
  proof: {
    eyebrow: "Proof",
    h2: "No testimonials. Only what you can check.",
    items: [
      { title: "Real screenshots", text: "Screens from the app, generated by the repository itself from sample data." },
      { title: "Open code", text: "MIT licence, on GitHub, to read, copy and audit." },
      { title: "Public changelog", text: "Every version with what changed, straight from the release notes." },
    ],
    shots: [
      { key: "transactions", alt: "Trove's transactions screen with the list of entries and filters.", label: "Transactions" },
      { key: "flow", alt: "Trove's cash flow screen with budget and forecast.", label: "Cash flow" },
      { key: "cards", alt: "Trove's cards screen with statements and limits.", label: "Cards" },
    ],
    stars: (n: number) => `${n} GitHub ${n === 1 ? "star" : "stars"}`,
    repo: "See the repository",
    version: (v: string) => `Current version: ${v}`,
  },
  who: {
    eyebrow: "Who it is for",
    h2: "Plainly.",
    yesTitle: "It is for you if you:",
    yes: [
      "use Windows;",
      "want to see your statement without giving your bank password to anyone;",
      "are fine importing OFX or CSV once a month;",
      "like to know where your data is.",
    ],
    noTitle: "It is not for you if you:",
    no: [
      "want automatic real-time sync;",
      "use Mac or Linux (not supported yet);",
      "need a phone app;",
      "want investment advice.",
    ],
  },
  faq: {
    eyebrow: "FAQ",
    h2: "Common questions.",
    items: [
      {
        q: "Windows warns that the app is not signed. Is it safe?",
        a: "Trove is open source, so the code that builds the installer is public. The build still has no code signature (a certificate costs a lot per year), so SmartScreen may warn on first run. If you trust where it came from, click “More info” and then “Run anyway”. Always download from the GitHub releases page.",
      },
      {
        q: "Which banks can I import from?",
        a: "Any bank that exports OFX (1.x or 2.x). For banks that only give you CSV, Trove has configurable column profiles you save per bank. There is no fixed list of banks, because Trove reads the file, not the account.",
      },
      {
        q: "Do I need internet to use it?",
        a: "No. Everything works offline. The app's only connection is to check for and download updates from GitHub.",
      },
      {
        q: "Where is my data?",
        a: "In a SQLite file on your computer: %APPDATA%\\com.lucas.trove\\trove.db. Settings shows the folder.",
      },
      {
        q: "Can I back it up?",
        a: "Yes. In Settings you make a local copy of the database and restore a validated one. Restoring checks the file's integrity before it replaces the live one.",
      },
      {
        q: "Is there a Mac or Linux version?",
        a: "Not yet. Today Trove is Windows 10 and 11 (x64) only.",
      },
      {
        q: "Is there a Portuguese version?",
        a: "Yes. The app switches between Portuguese and English in Settings and remembers the choice.",
      },
      {
        q: "How do I contribute?",
        a: "Open an issue or a pull request on the GitHub repository. Reports of a statement that did not import right are the most useful.",
      },
    ],
  },
  cta: {
    h2: "Start with last month's statement.",
    button: "Download for Windows",
    micro: "Free · MIT · no sign-up",
  },
  footer: {
    cols: [
      {
        title: "Product",
        links: [
          { label: "Features", href: "#features" },
          { label: "Security", href: "#security" },
          { label: "Download", href: "download/" },
          { label: "Changelog", href: "changelog/" },
        ],
      },
      {
        title: "Developer",
        links: [
          { label: "Code on GitHub", href: "https://github.com/LucasInstra/trove" },
          { label: "Releases", href: "https://github.com/LucasInstra/trove/releases" },
          { label: "Issues", href: "https://github.com/LucasInstra/trove/issues" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Privacy", href: "privacy/" },
          { label: "MIT licence", href: "https://github.com/LucasInstra/trove/blob/main/LICENSE" },
        ],
      },
      {
        title: "Community",
        links: [
          { label: "Discussions and issues", href: "https://github.com/LucasInstra/trove/issues" },
          { label: "Contribute", href: "https://github.com/LucasInstra/trove/pulls" },
        ],
      },
    ],
    legal: "MIT © 2026 Lucas",
    disclaimer: "Trove is not a financial service and gives no investment advice.",
  },
  download: {
    title: "Download Trove for Windows",
    description: "The MSI installer, the EXE installer and the portable build of Trove, free, straight from the GitHub releases.",
    h1: "Download Trove",
    lead: "Free, no sign-up. The files come straight from the GitHub releases.",
    latest: (v: string, date: string) => `Latest version: ${v}, published ${date}.`,
    reqTitle: "Requirements",
    req: "Windows 10 or 11, 64-bit.",
    files: {
      "trove-setup.msi": {
        name: "Installer (MSI)",
        text: "The recommended one. In-app updates use this package.",
      },
      "trove-setup.exe": {
        name: "Installer (EXE)",
        text: "An NSIS alternative, when the release includes this file.",
      },
      "trove-portable-x64.zip": {
        name: "Portable (ZIP)",
        text: "Just the executable, for when you do not want to install anything.",
      },
    },
    button: "Download",
    fallbackTitle: "The files could not be listed right now",
    fallback: "Open the GitHub releases page and pick the file from the latest version.",
    fallbackLink: "Go to the releases",
    smartTitle: "If Windows says “Windows protected your PC”",
    smart: [
      "Trove's build has no code signature, so SmartScreen warns on first run.",
      "Click “More info” and then “Run anyway”.",
      "Download only from the GitHub releases page, the official source.",
    ],
    afterTitle: "After installing",
    after: "Export the month's OFX from your bank and import it into Trove. Nothing else is asked of you.",
    size: "Size",
    back: "Back to the start",
  },
  changelog: {
    title: "Trove changelog",
    description: "Every Trove version with what changed, straight from the release notes.",
    h1: "Changelog",
    lead: "Every version, straight from the release notes.",
  },
  privacy: {
    title: "Trove privacy",
    description: "Trove has no account, no server and no telemetry. This site uses no cookies or analytics either.",
    h1: "Privacy",
    blocks: [
      {
        h: "The app",
        p: "No financial data leaves your computer. There is no login, no telemetry and no server of ours. The app only connects to GitHub to check for and download updates.",
      },
      {
        h: "Where the data is",
        p: "The database is the file trove.db in %APPDATA%\\com.lucas.trove. Settings shows the folder.",
      },
      {
        h: "This site",
        p: "It uses no cookies, analytics or trackers, so it has no consent banner. It is hosted on GitHub Pages, which may log requests at the server level under GitHub's own policy.",
      },
    ],
  },
  fmtDate: (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
  fmtSize: (b: number) => `${(b / 1048576).toFixed(1)} MB`,
  paths: { home: "", download: "download/", changelog: "changelog/", privacy: "privacy/" },
};
