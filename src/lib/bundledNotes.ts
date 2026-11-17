import { highlights, summary, type Highlight } from "./highlights";
import type { Lang } from "./i18n";

// The notes ship inside the app, so what is new can be shown right after an update, offline.
const english = import.meta.glob("../../release-notes/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const portuguese = import.meta.glob("../../release-notes/pt/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** The notes of one version in the language, or null when that version has none. */
export function notesFor(version: string, lang: Lang): { summary: string; items: Highlight[] } | null {
  const pick = (files: Record<string, string>) =>
    Object.entries(files).find(([path]) => path.endsWith(`/${version}.md`))?.[1] ?? null;
  const text = (lang === "pt" ? pick(portuguese) : null) ?? pick(english);
  if (!text) return null;
  const items = highlights(text);
  return items.length > 0 ? { summary: summary(text), items } : null;
}
