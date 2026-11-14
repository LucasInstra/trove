import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// No domain of our own yet: GitHub Pages serves the site under /trove.
// When a domain exists, set SITE_URL (and SITE_BASE="/") in the workflow.
const site = process.env.SITE_URL ?? "https://lucasinstra.github.io";
const base = process.env.SITE_BASE ?? "/trove";

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  build: { inlineStylesheets: "always" },
  integrations: [sitemap({ i18n: { defaultLocale: "pt", locales: { pt: "pt-BR", en: "en" } } })],
});
