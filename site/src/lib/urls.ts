import type { Strings } from "../i18n/pt";

const BASE = import.meta.env.BASE_URL.replace(/\/?$/, "/");

/** Site-relative path for a page of a language, with the base applied. */
export function pageUrl(t: Strings, key: keyof Strings["paths"]): string {
  return `${BASE}${t.code === "en" ? "en/" : ""}${t.paths[key]}`;
}

/** Footer and nav links: external stay, "#x" goes to the home, the rest is a page path. */
export function link(t: Strings, href: string): string {
  if (/^https?:/.test(href)) return href;
  if (href.startsWith("#")) return `${pageUrl(t, "home")}${href}`;
  return `${BASE}${t.code === "en" ? "en/" : ""}${href}`;
}
